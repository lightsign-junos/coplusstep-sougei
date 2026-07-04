import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Printer, Plus, Copy, GripVertical } from 'lucide-react';
import { useDataStore } from '../store/dataStore';
import { getMemberDisplayName } from '../lib/memberDisplay';
import { Modal } from '../components/common/Modal';
import type { Member } from '../types';


const WEEK_DAYS = [
  { label: '月', idx: 1 },
  { label: '火', idx: 2 },
  { label: '水', idx: 3 },
  { label: '木', idx: 4 },
  { label: '金', idx: 5 },
  { label: '土', idx: 6 },
];


export function WeeklySchedule() {
  const navigate = useNavigate();

  const {
    vehicles, routes, routeStops, members, memberLocations, staff, dailyOverrides, weeklyDayOverrides,
    addRouteStop, deleteRouteStop,
    updateRoute, addWeeklyDayOverride, removeWeeklyDayOverride, clearWeekOverrides,
    shiftExtras, addShiftExtra, setWeeklyOverrideTime, setWeeklyOverrideRow,
  } = useDataStore();

  const allActiveVehicles = vehicles.filter(v => v.active);
  const activeVehicles = allActiveVehicles;

  const [weekBase, setWeekBase] = useState(new Date());
  const [copyToast, setCopyToast] = useState(false);
  const [picking, setPicking] = useState<{ dayLabel: string; vehicleId: string; rowIdx: number } | null>(null);
  const [editingStaff, setEditingStaff] = useState<{ vehicleId: string; field: 'driverId' | 'attendantId' } | null>(null);
  // 乗車時間の手動編集モーダル
  const [editingTime, setEditingTime] = useState<{ overrideId: string; memberName: string; current: string; isManual: boolean } | null>(null);
  const [timeInput, setTimeInput] = useState('');
  // ドラッグ&ドロップ（同じ曜日×同じ車両の列内のみ）
  const [dragging, setDragging] = useState<{ overrideId: string; dayLabel: string; vehicleId: string; row: number } | null>(null);
  const [dragOverRow, setDragOverRow] = useState<number | null>(null);
  // 乗車時間計算: key="dayLabel-vehicleId-memberId" → "HH:MM"
  const [pickupTimes, setPickupTimes] = useState<Record<string, string>>({});
  // ORS結果キャッシュ: key="区間" → 分。座標が変わらない限り再取得不要なのでlocalStorageに永続化
  const [travelCache, setTravelCache] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem('coplus-travel-cache') ?? '{}');
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('coplus-travel-cache', JSON.stringify(travelCache));
    } catch { /* 容量超過時は諦める */ }
  }, [travelCache]);
  // 計算ループの世代管理（データ変更で新ループが始まったら古いループを止める＝多重リクエスト防止）
  const calcGenRef = useRef(0);
  // 計算中のkey
  const [loadingTimes, setLoadingTimes] = useState<Set<string>>(new Set());
  // 座標なしのmemberId
  const [noCoordIds, setNoCoordIds] = useState<Set<string>>(new Set());

  const goRoutes = routes.filter(r => r.direction === 'go');

  // weekKeyをuseEffectより先に定義（TDZ回避）
  const weekStart = startOfWeek(weekBase, { weekStartsOn: 1 });
  const weekKey = format(weekStart, 'yyyy-MM-dd');

  // 事業所（昭和島教室）〒143-0004 東京都大田区昭和島1-2-8
  const FACILITY_LAT = 35.5702778;
  const FACILITY_LNG = 139.7513047;
  // 1人あたりの乗降作業時間（車を停める・迎えに行く・乗せる）。走行時間には含まれないため別途加算
  const BOARDING_BUFFER_MIN = 3;

  const handleCopyWeek = () => {
    const prevWeekKey = format(subWeeks(weekStart, 1), 'yyyy-MM-dd');
    const prevOvs = weeklyDayOverrides.filter(o => o.weekKey === prevWeekKey && o.type === 'add');
    if (prevOvs.length === 0) {
      alert('前週に配置がないためコピーできません');
      return;
    }
    const hasCurrent = weeklyDayOverrides.some(o => o.weekKey === weekKey && o.type === 'add');
    if (hasCurrent && !confirm('今週の配置を前週の内容で置き換えますか？\n（今週の現在の配置は消えます）')) return;
    // 今週分をクリアして前週の配置を複製
    clearWeekOverrides(weekKey);
    prevOvs.forEach((o, i) => {
      addWeeklyDayOverride({
        id: `wdo-${Date.now()}-${i}`,
        weekKey,
        memberId: o.memberId,
        vehicleId: o.vehicleId,
        dayLabel: o.dayLabel,
        type: 'add',
        row: o.row,
      });
    });
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 2500);
  };

  // ── 乗車時間の自動計算（ORS・下から連鎖） ─────────────────────
  // 一番下の人: 到着時刻 −（その人の場所→事業所）
  // その上の人: 下の人の乗車時間 −（上の人の場所→下の人の場所）… を上へ連鎖
  useEffect(() => {
    type Point = { lat: number; lng: number };
    type ChainStop = { memberId: string; timeKey: string; loc: Point | null; manualTime?: string };
    const chains: { arrival: string; stops: ChainStop[] }[] = [];
    const newNoCoord = new Set<string>();

    for (const v of activeVehicles) {
      const route = goRoutes.find(r => r.vehicleId === v.id);
      if (!route) continue;
      for (const d of WEEK_DAYS) {
        const ovs = weeklyDayOverrides
          .filter(o => o.weekKey === weekKey && o.vehicleId === v.id && o.dayLabel === d.label && o.type === 'add')
          .sort((a, b) => (a.row ?? 0) - (b.row ?? 0));
        if (ovs.length === 0) continue;
        const stops: ChainStop[] = ovs.map(o => {
          const loc = memberLocations.find(l =>
            l.memberId === o.memberId &&
            (l.direction === 'go' || l.direction === 'both') &&
            l.lat != null && l.lng != null
          );
          const timeKey = `${d.label}-${v.id}-${o.memberId}`;
          if (!loc || loc.lat == null || loc.lng == null) {
            // 手動時間があれば座標なしでも表示できる
            if (!o.manualTime) newNoCoord.add(timeKey);
            return { memberId: o.memberId, timeKey, loc: null, manualTime: o.manualTime };
          }
          return { memberId: o.memberId, timeKey, loc: { lat: loc.lat, lng: loc.lng }, manualTime: o.manualTime };
        });
        chains.push({ arrival: route.arrivalTime, stops });
      }
    }

    setNoCoordIds(newNoCoord);
    if (chains.length === 0) {
      setLoadingTimes(new Set());
      return;
    }

    // 必要な区間（出発地→目的地）を重複なく集める。目的地nullは事業所
    const legKey = (from: Point, to: Point | null) =>
      to
        ? `${from.lat.toFixed(5)},${from.lng.toFixed(5)}->${to.lat.toFixed(5)},${to.lng.toFixed(5)}`
        : `${from.lat.toFixed(5)},${from.lng.toFixed(5)}->FAC`;
    const needed = new Map<string, { from: Point; to: Point | null }>();
    for (const chain of chains) {
      const s = chain.stops;
      for (let i = 0; i < s.length; i++) {
        const from = s[i].loc;
        if (!from || s[i].manualTime) continue; // 手動の人は区間不要
        // 下の人（次の有効な行き先）: 最後尾は事業所
        const isLast = i === s.length - 1;
        const to = isLast ? null : s[i + 1].loc;
        if (!isLast && !to) continue; // 下の人が座標なし → この区間は計算不能
        const key = legKey(from, to);
        if (travelCache[key] === undefined && !needed.has(key)) needed.set(key, { from, to });
      }
    }

    // 下から上へ連鎖計算（各段で5分切り下げ）。
    // 区間が揃っている列はその場で計算し、足りない列のマスだけpendingとして返す
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const toStr = (min: number) => {
      const m = ((min % 1440) + 1440) % 1440;
      return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    };
    const computeAll = (durations: Record<string, number>) => {
      const times: Record<string, string> = {};
      const pending = new Set<string>();
      for (const chain of chains) {
        const s = chain.stops;
        let below = toMin(chain.arrival); // 直下の基準時刻（最後尾は到着時刻）
        for (let i = s.length - 1; i >= 0; i--) {
          // 手動設定があれば最優先。上の人はこの時間を基準に連鎖する
          if (s[i].manualTime) {
            times[s[i].timeKey] = s[i].manualTime!;
            below = toMin(s[i].manualTime!);
            continue;
          }
          const from = s[i].loc;
          if (!from) break; // 座標なし → その人と上は計算不能
          const isLast = i === s.length - 1;
          const to = isLast ? null : s[i + 1].loc;
          if (!isLast && !to) break;
          const dur = durations[legKey(from, to)];
          if (dur === undefined) {
            // この区間が未取得 → この人から上（手動を除く）は計算待ち
            for (let j = i; j >= 0; j--) if (!s[j].manualTime) pending.add(s[j].timeKey);
            break;
          }
          // 走行時間 + 乗降作業バッファ（1人あたり3分）
          below = Math.floor((below - dur - BOARDING_BUFFER_MIN) / 5) * 5;
          times[s[i].timeKey] = toStr(below);
        }
      }
      return { times, pending };
    };

    // まずキャッシュだけで計算 → 揃っている列（＝変更のない列）は即表示。
    // 足りない列のマスだけ「計算中」になる
    const durations: Record<string, number> = { ...travelCache };
    const init = computeAll(durations);
    setPickupTimes(pt => ({ ...pt, ...init.times }));
    setLoadingTimes(new Set(init.pending));
    if (needed.size === 0) return;

    const apiKey = import.meta.env.VITE_ORS_API_KEY as string;
    // この実行の世代番号。データ変更で新しい計算が始まったら古いループは即終了（多重リクエスト防止）
    const gen = ++calcGenRef.current;

    (async () => {
      // 不足区間を直列で取得。ORS無料枠は40回/分なので1.6秒間隔で消化する
      for (const [key, leg] of needed) {
        if (calcGenRef.current !== gen) return; // 新しい計算が始まった
        let mins: number | null = null;
        const endLng = leg.to ? leg.to.lng : FACILITY_LNG;
        const endLat = leg.to ? leg.to.lat : FACILITY_LAT;
        for (let attempt = 0; attempt < 3 && mins === null; attempt++) {
          if (calcGenRef.current !== gen) return;
          try {
            const r = await fetch(
              `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${leg.from.lng},${leg.from.lat}&end=${endLng},${endLat}`
            );
            if (r.status === 429 || r.status === 403) {
              // レート制限: 待ってからリトライ
              console.warn('[ORS] rate limited, waiting...', key);
              await new Promise(res => setTimeout(res, 15000 * (attempt + 1)));
              continue;
            }
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const data: { features: { properties: { summary: { duration: number; distance: number } } }[] } = await r.json();
            const sum = data.features[0].properties.summary;
            // ORSは信号・渋滞なしの楽観的な速度で計算するため、
            // 都市部の実勢速度15km/hで走った場合の時間を下限にする
            const orsMins = sum.duration / 60;
            const realisticMins = (sum.distance / 1000) / 15 * 60;
            mins = Math.ceil(Math.max(orsMins, realisticMins));
          } catch (e) {
            console.error('[ORS] API error (attempt', attempt + 1, '):', e, key);
            await new Promise(res => setTimeout(res, 2000 * (attempt + 1)));
          }
        }
        if (mins !== null) {
          durations[key] = mins;
          const m = mins;
          setTravelCache(c => ({ ...c, [key]: m }));
          // 区間が1つ取れるたびに、揃った列から順次表示していく
          const step = computeAll(durations);
          setPickupTimes(pt => ({ ...pt, ...step.times }));
          setLoadingTimes(new Set(step.pending));
        }
        // レート制限内に収める間隔
        await new Promise(res => setTimeout(res, 1600));
      }
      if (calcGenRef.current !== gen) return;

      // 最後まで取得できなかったマスはエラー表示
      const final = computeAll(durations);
      setPickupTimes(pt => {
        const n = { ...pt, ...final.times };
        final.pending.forEach(k => { n[k] = 'ERR'; });
        return n;
      });
      setLoadingTimes(new Set());
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    weekKey,
    weeklyDayOverrides.map(o => `${o.id}-${o.type}-${o.row ?? ''}-${o.manualTime ?? ''}`).join(),
    memberLocations.map(l => `${l.id}-${l.lat}-${l.lng}`).join(),
    routes.map(r => `${r.id}-${r.arrivalTime}`).join(),
  ]);

  // ── Table view helpers ─────────────────────────────────────

  const weekDates = WEEK_DAYS.map(d => ({
    ...d,
    date: addDays(weekStart, d.idx - 1),
    dateStr: format(addDays(weekStart, d.idx - 1), 'yyyy-MM-dd'),
  }));
  const today = format(new Date(), 'yyyy-MM-dd');

  const getMember = (id: string) => members.find(m => m.id === id);
  const displayName = (m: ReturnType<typeof getMember>) =>
    m ? getMemberDisplayName(m, members) : '';
  const getStaffName = (id: string) => staff.find(s => s.id === id)?.name ?? '未設定';
  const isAbsent = (dateStr: string, memberId: string, routeId: string) =>
    dailyOverrides.some(
      o => o.date === dateStr && o.memberId === memberId && o.routeId === routeId && o.type === 'absent'
    );

  // マス位置はオーバーライドのrowに記録（マスは完全に独立。他の配置に影響しない）
  // rowを持たない古いデータは空いている行へ順に割り当てる
  const getPlacements = (dayLabel: string, vehicleId: string): { id: string; memberId: string; row: number; manualTime?: string }[] => {
    const ovs = weeklyDayOverrides.filter(
      o => o.weekKey === weekKey && o.vehicleId === vehicleId && o.dayLabel === dayLabel && o.type === 'add'
    );
    const used = new Set(ovs.filter(o => o.row != null).map(o => o.row as number));
    let next = 0;
    return ovs.map(o => {
      if (o.row != null) return { id: o.id, memberId: o.memberId, row: o.row, manualTime: o.manualTime };
      while (used.has(next)) next++;
      used.add(next);
      return { id: o.id, memberId: o.memberId, row: next++, manualTime: o.manualTime };
    });
  };

  const getDayVehicleData = (dateStr: string, dayLabel: string, vehicleId: string) => {
    const route = goRoutes.find(r => r.vehicleId === vehicleId);
    if (!route) return { route: null, placed: [] as ReturnType<typeof getPlacements>, presentCount: 0, bottomMemberId: null as string | null };
    const placed = getPlacements(dayLabel, vehicleId);
    const presentCount = placed.filter(p => !isAbsent(dateStr, p.memberId, route.id)).length;
    const bottomMemberId = placed.length > 0
      ? placed.reduce((a, b) => (a.row > b.row ? a : b)).memberId
      : null;
    return { route, placed, presentCount, bottomMemberId };
  };

  const maxRows = 7;
  const numVehicles = activeVehicles.length;

  const handleAdd = (memberId: string) => {
    if (!picking) return;
    const { dayLabel, vehicleId, rowIdx } = picking;
    const route = goRoutes.find(r => r.vehicleId === vehicleId);
    if (!route) { setPicking(null); return; }

    // routeStopは他画面との互換のために維持（順番のずらしはしない。表示はoverride.rowで決まる）
    const existingStop = routeStops.find(rs => rs.routeId === route.id && rs.memberId === memberId);
    if (!existingStop) {
      // 他車両のrouteStopを削除（1人は1台のみ）
      routeStops
        .filter(rs => rs.memberId === memberId && rs.routeId !== route.id)
        .forEach(rs => deleteRouteStop(rs.id));
      addRouteStop({ id: `rs-${Date.now()}`, routeId: route.id, memberId, locationId: '', order: rowIdx + 1, scheduledTime: '00:00' });
    }

    // 同じ日の他車両addオーバーライドを削除（1日1台制限）
    weeklyDayOverrides
      .filter(o => o.weekKey === weekKey && o.memberId === memberId && o.dayLabel === dayLabel && o.vehicleId !== vehicleId && o.type === 'add')
      .forEach(o => removeWeeklyDayOverride(o.id));
    // この車両+曜日のaddオーバーライドを作成（マス位置rowを記録）
    const existingAdd = weeklyDayOverrides.find(
      o => o.weekKey === weekKey && o.memberId === memberId && o.vehicleId === vehicleId && o.dayLabel === dayLabel && o.type === 'add'
    );
    if (existingAdd) removeWeeklyDayOverride(existingAdd.id);
    addWeeklyDayOverride({ id: `wdo-${Date.now()}`, weekKey, memberId, vehicleId, dayLabel, type: 'add', row: rowIdx });

    setPicking(null);
  };

  // ドロップ時: 同じ曜日×同じ車両の列内で移動（相手がいれば入れ替え）
  const handleDropOnCell = (dayLabel: string, vehicleId: string, targetRow: number) => {
    if (!dragging) return;
    if (dragging.dayLabel !== dayLabel || dragging.vehicleId !== vehicleId) { setDragging(null); return; }
    if (dragging.row !== targetRow) {
      const placed = getPlacements(dayLabel, vehicleId);
      const target = placed.find(p => p.row === targetRow);
      if (target && target.id !== dragging.overrideId) {
        setWeeklyOverrideRow(target.id, dragging.row); // 入れ替え
      }
      setWeeklyOverrideRow(dragging.overrideId, targetRow);
    }
    setDragging(null);
  };

  const handleRemove = (memberId: string, dayLabel: string, vehicleId: string) => {
    const addOverride = weeklyDayOverrides.find(
      o => o.weekKey === weekKey && o.memberId === memberId && o.vehicleId === vehicleId && o.dayLabel === dayLabel && o.type === 'add'
    );
    if (addOverride) removeWeeklyDayOverride(addOverride.id);
  };

  // defaultDaysが文字列("月,火")のまま残っている古いデータにも対応
  const memberDays = (m: (typeof members)[number]): string[] =>
    Array.isArray(m.defaultDays)
      ? m.defaultDays
      : String(m.defaultDays ?? '').split(',').map(s => s.trim()).filter(Boolean);

  // 配置候補: scheduled=その曜日の利用予定者（利用日未設定・振替済み含む） / others=それ以外（選ぶと振替登録）
  const availableForPicking = () => {
    if (!picking) return { scheduled: [] as Member[], others: [] as Member[], dateStr: '' };
    const { dayLabel } = picking;
    const dateStr = weekDates.find(d => d.label === dayLabel)?.dateStr ?? '';
    // その曜日にどこかの車両へ配置済みのメンバーを除外（1日1台）
    const placedIds = new Set(
      weeklyDayOverrides
        .filter(o => o.weekKey === weekKey && o.dayLabel === dayLabel && o.type === 'add')
        .map(o => o.memberId)
    );
    const scheduled: Member[] = [];
    const others: Member[] = [];
    for (const m of members) {
      if (placedIds.has(m.id)) continue;
      const days = memberDays(m);
      const isScheduled =
        days.length === 0 ||
        days.includes(dayLabel) ||
        shiftExtras.some(e => e.date === dateStr && e.memberId === m.id);
      (isScheduled ? scheduled : others).push(m);
    }
    return { scheduled, others, dateStr };
  };

  const pickingVehicle = picking ? activeVehicles.find(v => v.id === picking.vehicleId) : null;
  const editingRoute = editingStaff ? goRoutes.find(r => r.vehicleId === editingStaff.vehicleId) : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 no-print">
        <h1 className="text-2xl font-bold text-gray-900">送迎スケジュール</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyWeek}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
          >
            <Copy size={13} /> 前週をコピー
          </button>
          <button
            onClick={() => { if (confirm('今週の配置変更をすべてリセットしますか？\n（登録済みの利用日に戻ります）')) clearWeekOverrides(weekKey); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 text-red-600 text-xs font-medium rounded-lg hover:bg-red-50 cursor-pointer transition-colors"
          >
            今週リセット
          </button>
          <button onClick={() => setWeekBase(w => subWeeks(w, 1))} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setWeekBase(new Date())} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            今週
          </button>
          <button onClick={() => setWeekBase(w => addWeeks(w, 1))} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-800 text-white rounded-lg hover:bg-gray-700 cursor-pointer"
          >
            <Printer size={13} /> 印刷
          </button>
        </div>
      </div>

      {/* Copy toast */}
      {copyToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50 pointer-events-none">
          前週のスケジュールをコピーしました
        </div>
      )}

      {/* ── TABLE VIEW ── */}
      <>
        <div className="hidden print-block mb-3">
          <h2 className="text-lg font-bold text-center">コプラスステップ 昭和島教室　送迎表</h2>
          <p className="text-sm text-center">
            {format(weekDates[0].date, 'yyyy年M月d日', { locale: ja })}（月）〜
            {format(weekDates[5].date, 'M月d日', { locale: ja })}（土）
          </p>
        </div>

        <p className="text-sm text-gray-500 mb-2 no-print">
          {format(weekDates[0].date, 'M月d日', { locale: ja })}（月）〜
          {format(weekDates[5].date, 'M月d日', { locale: ja })}（土）
        </p>

        <div
          className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden print-table-wrap flex flex-col"
          style={{ height: 'calc(100vh - 180px)' }}
        >
          <div className="overflow-x-auto flex-1 flex flex-col">
            <table className="w-full text-xs border-collapse table-fixed" style={{ height: '100%' }}>
              <thead>
                <tr>
                  <th className="border border-gray-300 bg-gray-100 px-2 py-2 text-center text-xs font-semibold text-gray-600 w-14" rowSpan={5}>
                    お迎え
                  </th>
                  {weekDates.map(d => (
                    <th
                      key={d.label}
                      colSpan={numVehicles}
                      onClick={() => navigate(`/dashboard?date=${d.dateStr}`)}
                      className={`border border-gray-300 px-2 py-2 text-center font-bold text-sm cursor-pointer select-none transition-colors ${
                        d.dateStr === today ? 'bg-pink-100 text-pink-700 hover:bg-pink-200'
                        : d.label === '土' ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                        : 'bg-gray-50 text-gray-800 hover:bg-gray-100'
                      }`}
                    >
                      {format(d.date, 'M/d', { locale: ja })}（{d.label}）
                    </th>
                  ))}
                </tr>
                <tr>
                  {weekDates.flatMap(d =>
                    activeVehicles.map(v => {
                      const route = goRoutes.find(r => r.vehicleId === v.id);
                      return (
                        <th key={`veh-${d.label}-${v.id}`} className={`border border-gray-300 px-2 py-1.5 text-center text-xs font-bold text-white vehicle-${v.color}-header`}>
                          <div>{v.name}</div>
                          {route && (
                            <div className="text-[10px] font-normal opacity-90 no-print">
                              到着 {route.arrivalTime}
                            </div>
                          )}
                        </th>
                      );
                    })
                  )}
                </tr>
                <tr className="bg-gray-50">
                  {weekDates.flatMap(d =>
                    activeVehicles.map(v => {
                      const route = goRoutes.find(r => r.vehicleId === v.id);
                      return (
                        <td key={`drv-${d.label}-${v.id}`} className="border border-gray-300 px-2 py-1 text-center text-xs text-gray-700">
                          <div className="cell-line">
                            <div className="row-label text-gray-400 text-[10px]">運転</div>
                            <div className="no-print cursor-pointer hover:text-blue-600 transition-colors" onClick={() => route && setEditingStaff({ vehicleId: v.id, field: 'driverId' })}>
                              {route ? getStaffName(route.driverId) : '―'}
                            </div>
                          </div>
                        </td>
                      );
                    })
                  )}
                </tr>
                <tr className="bg-gray-50">
                  {weekDates.flatMap(d =>
                    activeVehicles.map(v => {
                      const route = goRoutes.find(r => r.vehicleId === v.id);
                      return (
                        <td key={`att-${d.label}-${v.id}`} className="border border-gray-300 px-2 py-1 text-center text-xs text-gray-700">
                          <div className="cell-line">
                            <div className="row-label text-gray-400 text-[10px]">添乗</div>
                            <div className="no-print cursor-pointer hover:text-blue-600 transition-colors" onClick={() => route && setEditingStaff({ vehicleId: v.id, field: 'attendantId' })}>
                              {route ? getStaffName(route.attendantId) : '―'}
                            </div>
                          </div>
                        </td>
                      );
                    })
                  )}
                </tr>
                <tr className="bg-gray-50">
                  {weekDates.map(d => {
                    const total = activeVehicles.reduce((sum, v) => {
                      const { presentCount } = getDayVehicleData(d.dateStr, d.label, v.id);
                      return sum + presentCount;
                    }, 0);
                    return (
                      <td key={`total-${d.label}`} colSpan={numVehicles} className={`border border-gray-300 px-2 py-1 text-center text-xs font-semibold ${d.dateStr === today ? 'bg-pink-50 text-pink-700' : 'text-gray-700'}`}>
                        合計 {total} 名
                      </td>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: maxRows }, (_, rowIdx) => (
                  <tr key={rowIdx} style={{height: '52px'}} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                    <td className="border border-gray-300 bg-gray-50 px-1 py-1 text-center text-xs text-gray-400 w-14">{rowIdx + 1}</td>
                    {weekDates.flatMap(d =>
                      activeVehicles.map(v => {
                        const { route, placed } = getDayVehicleData(d.dateStr, d.label, v.id);
                        const p = placed.find(x => x.row === rowIdx);
                        const member = p ? getMember(p.memberId) : null;
                        const absent = p && route ? isAbsent(d.dateStr, p.memberId, route.id) : false;
                        const isToday = d.dateStr === today;
                        const showAdd = !member && !!route;
                        // 全員に乗車時間を表示（下から連鎖計算）
                        const timeKey2 = p ? `${d.label}-${v.id}-${p.memberId}` : '';
                        const pickupTime = p ? pickupTimes[timeKey2] : undefined;
                        const isLoadingTime = !!p && loadingTimes.has(timeKey2);
                        const isNoCoord = !!p && noCoordIds.has(timeKey2);
                        // ドラッグ中: 同じ曜日×同じ車両の列だけ受け入れ可能
                        const isDropTarget = !!dragging && dragging.dayLabel === d.label && dragging.vehicleId === v.id;
                        return (
                          <td
                            key={`cell-${d.label}-${v.id}-${rowIdx}`}
                            onClick={showAdd ? () => setPicking({ dayLabel: d.label, vehicleId: v.id, rowIdx }) : undefined}
                            onDragOver={isDropTarget ? (e) => { e.preventDefault(); if (dragOverRow !== rowIdx) setDragOverRow(rowIdx); } : undefined}
                            onDragLeave={isDropTarget ? () => setDragOverRow(cur => (cur === rowIdx ? null : cur)) : undefined}
                            onDrop={isDropTarget ? (e) => { e.preventDefault(); handleDropOnCell(d.label, v.id, rowIdx); setDragOverRow(null); } : undefined}
                            className={`relative border border-gray-200 px-0 py-0 text-center align-middle min-w-[80px] transition-all duration-150 ${isToday ? 'bg-pink-50/40' : ''} ${showAdd && !dragging ? 'cursor-pointer hover:bg-gray-50' : ''} ${
                              isDropTarget && dragging!.row !== rowIdx
                                ? dragOverRow === rowIdx
                                  ? 'ring-2 ring-inset ring-pink-500 bg-pink-100/80'
                                  : 'ring-1 ring-inset ring-pink-200 bg-pink-50/50'
                                : ''
                            }`}
                            style={{height: '52px', maxHeight: '52px', overflow: 'hidden'}}
                          >
                            {/* ドロップ先ラベル */}
                            {isDropTarget && dragOverRow === rowIdx && dragging!.row !== rowIdx && (
                              <span className="absolute inset-x-0 top-0.5 z-10 flex justify-center pointer-events-none no-print">
                                <span className="text-[9px] font-bold text-white bg-pink-500 rounded-full px-2 py-px shadow">
                                  {member ? '⇄ 入れ替え' : '↓ ここへ'}
                                </span>
                              </span>
                            )}
                            <div
                              className="h-[52px] flex flex-col items-center justify-center px-2 overflow-hidden transition-opacity duration-150"
                              style={{ opacity: dragging && !isDropTarget ? 0.25 : 1 }}
                            >
                            {member ? (
                              absent ? (
                                <div className="cell-line text-red-400">
                                  <div className="line-through text-[11px]">{displayName(member)}<span className="text-[9px] ml-0.5">様</span></div>
                                  <div className="text-[10px] font-bold">欠席</div>
                                </div>
                              ) : (
                                <div
                                  className={`cell-line group relative w-full cursor-grab active:cursor-grabbing transition-opacity ${
                                    dragging?.overrideId === p!.id ? 'opacity-30' : ''
                                  }`}
                                  draggable
                                  onDragStart={(e) => {
                                    e.dataTransfer.setData('text/plain', '');
                                    e.dataTransfer.effectAllowed = 'move';
                                    // 名前入りピルをドラッグゴーストにする
                                    const ghost = document.createElement('div');
                                    ghost.textContent = `${displayName(member)} 様`;
                                    ghost.style.cssText =
                                      'position:fixed;top:-100px;left:-100px;padding:6px 16px;background:#fff;border:2px solid #ec4899;border-radius:9999px;font-size:13px;font-weight:700;color:#1f2937;box-shadow:0 6px 16px rgba(236,72,153,.3);white-space:nowrap;';
                                    document.body.appendChild(ghost);
                                    e.dataTransfer.setDragImage(ghost, 40, 16);
                                    setTimeout(() => ghost.remove(), 0);
                                    setDragging({ overrideId: p!.id, dayLabel: d.label, vehicleId: v.id, row: rowIdx });
                                  }}
                                  onDragEnd={() => { setDragging(null); setDragOverRow(null); }}
                                >
                                  {/* つかめる印（ホバー時に表示） */}
                                  <GripVertical
                                    size={11}
                                    className="absolute -left-1 top-1/2 -translate-y-1/2 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity no-print"
                                  />
                                  <div className="font-medium text-gray-800 text-[14px] leading-tight whitespace-nowrap truncate text-center">
                                    {displayName(member)}<span className="print-sama text-[10px] text-gray-500 ml-0.5">様</span>
                                  </div>
                                  {pickupTime && pickupTime !== 'ERR' && (
                                    <button
                                      onClick={e => {
                                        e.stopPropagation();
                                        setTimeInput(pickupTime);
                                        setEditingTime({ overrideId: p!.id, memberName: displayName(member), current: pickupTime, isManual: !!p!.manualTime });
                                      }}
                                      className={`text-[11px] font-mono font-semibold mt-0.5 cursor-pointer hover:underline ${
                                        p!.manualTime ? 'text-orange-600' : 'text-blue-600'
                                      }`}
                                      title="クリックで時間を手動設定"
                                    >
                                      {pickupTime}{p!.manualTime && <span className="text-[9px] ml-0.5 no-print">手</span>}
                                    </button>
                                  )}
                                  {pickupTime === 'ERR' && (
                                    <div className="text-[10px] text-red-500 mt-0.5">API失敗</div>
                                  )}
                                  {isLoadingTime && !pickupTime && (
                                    <div className="text-[10px] text-gray-400 mt-0.5">計算中...</div>
                                  )}
                                  {isNoCoord && !pickupTime && (
                                    <button
                                      onClick={e => {
                                        e.stopPropagation();
                                        setTimeInput('10:30');
                                        setEditingTime({ overrideId: p!.id, memberName: displayName(member), current: '', isManual: false });
                                      }}
                                      className="text-[10px] text-orange-500 mt-0.5 cursor-pointer hover:underline"
                                      title="クリックで時間を手動設定"
                                    >
                                      座標なし
                                    </button>
                                  )}
                                  <button
                                    onClick={e => { e.stopPropagation(); handleRemove(member.id, d.label, v.id); }}
                                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-100 text-red-500 rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity no-print"
                                  >×</button>
                                </div>
                              )
                            ) : showAdd ? (
                              <div className="flex items-center justify-center text-gray-300 hover:text-gray-400 transition-colors no-print">
                                <Plus size={14} />
                              </div>
                            ) : (
                              <span className="text-gray-200">―</span>
                            )}
                            </div>
                          </td>
                        );
                      })
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>

      {/* Member picker modal (table view) */}
      {picking && (
        <Modal
          title={`追加 — ${picking.dayLabel}曜 / ${pickingVehicle?.name ?? ''}`}
          onClose={() => setPicking(null)}
          size="sm"
        >
          {(() => {
            const { scheduled, others, dateStr } = availableForPicking();
            const extraIds = new Set(shiftExtras.filter(e => e.date === dateStr).map(e => e.memberId));
            return (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {scheduled.length === 0 && others.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">追加できる利用者がいません</p>
                )}
                {scheduled.map(m => (
                  <button
                    key={m.id}
                    onClick={() => handleAdd(m.id)}
                    className="w-full text-left px-4 py-3 rounded-xl border border-gray-100 hover:bg-pink-50 hover:border-pink-200 cursor-pointer transition-colors flex items-center justify-between"
                  >
                    <span className="font-medium text-gray-800 text-sm flex items-center gap-2">
                      {m.name}
                      {extraIds.has(m.id) && (
                        <span className="text-[10px] font-bold text-violet-600 bg-violet-100 rounded px-1.5 py-0.5">振替</span>
                      )}
                    </span>
                    <span className="text-xs text-gray-400">{(Array.isArray(m.defaultDays) ? m.defaultDays : String(m.defaultDays ?? '').split(',').filter(Boolean)).join('・') || '曜日未設定'}</span>
                  </button>
                ))}
                {others.length > 0 && (
                  <>
                    <p className="pt-2 px-1 text-[11px] font-semibold text-violet-500">
                      その他の利用者（選ぶと振替として登録されます）
                    </p>
                    {others.map(m => (
                      <button
                        key={m.id}
                        onClick={() => {
                          if (dateStr) addShiftExtra(dateStr, m.id);
                          handleAdd(m.id);
                        }}
                        className="w-full text-left px-4 py-3 rounded-xl border border-dashed border-violet-200 hover:bg-violet-50 cursor-pointer transition-colors flex items-center justify-between"
                      >
                        <span className="font-medium text-gray-700 text-sm flex items-center gap-2">
                          {m.name}
                          <span className="text-[10px] font-bold text-violet-600 bg-violet-100 rounded px-1.5 py-0.5">＋振替</span>
                        </span>
                        <span className="text-xs text-gray-400">{(Array.isArray(m.defaultDays) ? m.defaultDays : String(m.defaultDays ?? '').split(',').filter(Boolean)).join('・') || '曜日未設定'}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            );
          })()}
        </Modal>
      )}

      {/* 乗車時間の手動編集モーダル */}
      {editingTime && (
        <Modal
          title={`${editingTime.memberName}様の乗車時間`}
          onClose={() => setEditingTime(null)}
          size="sm"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">乗車時間</label>
              <input
                type="time"
                value={timeInput}
                onChange={e => setTimeInput(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
              />
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                手動で設定すると、この時間を基準に<span className="font-semibold text-gray-600">上のマスの利用者の時間が自動で再計算</span>されます。
              </p>
            </div>
            <div className="flex gap-2 justify-between pt-2 border-t border-gray-100">
              <button
                onClick={() => {
                  setWeeklyOverrideTime(editingTime.overrideId, null);
                  setEditingTime(null);
                }}
                disabled={!editingTime.isManual}
                className="px-3 py-2 text-xs text-gray-500 hover:bg-gray-100 rounded-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                自動計算に戻す
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingTime(null)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => {
                    if (/^\d{2}:\d{2}$/.test(timeInput)) {
                      setWeeklyOverrideTime(editingTime.overrideId, timeInput);
                      setEditingTime(null);
                    }
                  }}
                  disabled={!/^\d{2}:\d{2}$/.test(timeInput)}
                  className="px-4 py-2 text-sm bg-pink-500 text-white rounded-lg hover:bg-pink-600 cursor-pointer disabled:opacity-50"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Staff picker modal (table view) */}
      {editingStaff && editingRoute && (
        <Modal
          title={editingStaff.field === 'driverId' ? '運転手を変更' : '添乗員を変更'}
          onClose={() => setEditingStaff(null)}
          size="sm"
        >
          <div className="space-y-2">
            {staff.filter(s => s.active).map(s => {
              const isCurrent = editingRoute[editingStaff.field] === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => { updateRoute({ ...editingRoute, [editingStaff.field]: s.id }); setEditingStaff(null); }}
                  className={`w-full text-left px-4 py-3 rounded-xl border cursor-pointer transition-colors flex items-center justify-between ${isCurrent ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-100 hover:bg-gray-50'}`}
                >
                  <span className="font-medium text-sm">{s.name}</span>
                  {isCurrent && <span className="text-xs text-blue-500">現在</span>}
                </button>
              );
            })}
          </div>
        </Modal>
      )}
    </div>
  );
}
