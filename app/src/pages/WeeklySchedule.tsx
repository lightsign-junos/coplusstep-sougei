import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Printer, Plus, Copy } from 'lucide-react';
import { useDataStore } from '../store/dataStore';
import { getMemberDisplayName } from '../lib/memberDisplay';
import { Modal } from '../components/common/Modal';


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
  } = useDataStore();

  const allActiveVehicles = vehicles.filter(v => v.active);
  const activeVehicles = allActiveVehicles;

  const [weekBase, setWeekBase] = useState(new Date());
  const [copyToast, setCopyToast] = useState(false);
  const [picking, setPicking] = useState<{ dayLabel: string; vehicleId: string; rowIdx: number } | null>(null);
  const [editingStaff, setEditingStaff] = useState<{ vehicleId: string; field: 'driverId' | 'attendantId' } | null>(null);
  // 乗車時間計算: key="dayLabel-vehicleId-memberId" → "HH:MM"
  const [pickupTimes, setPickupTimes] = useState<Record<string, string>>({});
  // ORS結果キャッシュ: key="lat,lng" → 分
  const [travelCache, setTravelCache] = useState<Record<string, number>>({});
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

  const calcPickupTime = (arrivalTime: string, travelMins: number): string => {
    const [h, m] = arrivalTime.split(':').map(Number);
    const total = ((h * 60 + m - travelMins) % 1440 + 1440) % 1440;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  };

  const handleCopyWeek = () => {
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 2500);
  };

  // ── 乗車時間の自動計算（ORS） ────────────────────────────────
  useEffect(() => {
    const newTimes: Record<string, string> = {};
    const newLoading = new Set<string>();
    const newNoCoord = new Set<string>();
    // 同一座標への重複リクエストをまとめる: cacheKey → { lat, lng, targets }
    const pending = new Map<string, { lat: number; lng: number; targets: { timeKey: string; arrival: string }[] }>();

    for (const v of activeVehicles) {
      const route = goRoutes.find(r => r.vehicleId === v.id);
      if (!route) continue;

      for (const d of WEEK_DAYS) {
        // その日のマス配置（row最大 = 一番下 = 最後に乗る人）
        const ovs = weeklyDayOverrides.filter(
          o => o.weekKey === weekKey && o.vehicleId === v.id && o.dayLabel === d.label && o.type === 'add'
        );
        if (ovs.length === 0) continue;
        const bottom = ovs.reduce((a, b) => ((a.row ?? 0) > (b.row ?? 0) ? a : b));
        const timeKey = `${d.label}-${v.id}-${bottom.memberId}`;

        const loc = memberLocations.find(l =>
          l.memberId === bottom.memberId &&
          (l.direction === 'go' || l.direction === 'both') &&
          l.lat != null && l.lng != null
        );
        if (!loc || loc.lat == null || loc.lng == null) {
          newNoCoord.add(timeKey);
          continue;
        }

        const cacheKey = `${loc.lat.toFixed(5)},${loc.lng.toFixed(5)}`;
        if (travelCache[cacheKey] !== undefined) {
          newTimes[timeKey] = calcPickupTime(route.arrivalTime, travelCache[cacheKey]);
          continue;
        }

        newLoading.add(timeKey);
        const entry = pending.get(cacheKey) ?? { lat: loc.lat, lng: loc.lng, targets: [] };
        entry.targets.push({ timeKey, arrival: route.arrivalTime });
        pending.set(cacheKey, entry);
      }
    }

    if (Object.keys(newTimes).length > 0) {
      setPickupTimes(pt => ({ ...pt, ...newTimes }));
    }
    setLoadingTimes(prev => {
      const merged = new Set(prev);
      newLoading.forEach(k => merged.add(k));
      return merged;
    });
    setNoCoordIds(newNoCoord);

    // 座標ごとに直列でリクエスト（レート制限対策）＋失敗時は自動リトライ
    if (pending.size > 0) {
      const apiKey = import.meta.env.VITE_ORS_API_KEY as string;
      (async () => {
        for (const [cacheKey, p] of pending) {
          let mins: number | null = null;
          for (let attempt = 0; attempt < 3 && mins === null; attempt++) {
            try {
              const r = await fetch(
                `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${p.lng},${p.lat}&end=${FACILITY_LNG},${FACILITY_LAT}`
              );
              if (!r.ok) throw new Error(`HTTP ${r.status}`);
              const data: { features: { properties: { summary: { duration: number } } }[] } = await r.json();
              mins = Math.ceil(data.features[0].properties.summary.duration / 60);
            } catch (e) {
              console.error('[ORS] API error (attempt', attempt + 1, '):', e, cacheKey);
              await new Promise(res => setTimeout(res, 1000 * (attempt + 1)));
            }
          }
          if (mins !== null) {
            const m = mins;
            setTravelCache(c => ({ ...c, [cacheKey]: m }));
            setPickupTimes(pt => {
              const n = { ...pt };
              p.targets.forEach(t => { n[t.timeKey] = calcPickupTime(t.arrival, m); });
              return n;
            });
          } else {
            setPickupTimes(pt => {
              const n = { ...pt };
              p.targets.forEach(t => { n[t.timeKey] = 'ERR'; });
              return n;
            });
          }
          setLoadingTimes(s => {
            const n = new Set(s);
            p.targets.forEach(t => n.delete(t.timeKey));
            return n;
          });
          // 連続リクエストの間隔を空ける
          await new Promise(res => setTimeout(res, 300));
        }
      })();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    weekKey,
    weeklyDayOverrides.map(o => `${o.id}-${o.type}-${o.row ?? ''}`).join(),
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

  // 週次一覧への配置は完全手動（addオーバーライドがある場合のみ表示）
  const isActiveOnDay = (memberId: string, vehicleId: string, dayLabel: string): boolean => {
    return weeklyDayOverrides.some(
      o => o.weekKey === weekKey && o.memberId === memberId && o.vehicleId === vehicleId && o.dayLabel === dayLabel && o.type === 'add'
    );
  };

  // マス位置はオーバーライドのrowに記録（マスは完全に独立。他の配置に影響しない）
  // rowを持たない古いデータは空いている行へ順に割り当てる
  const getPlacements = (dayLabel: string, vehicleId: string): { memberId: string; row: number }[] => {
    const ovs = weeklyDayOverrides.filter(
      o => o.weekKey === weekKey && o.vehicleId === vehicleId && o.dayLabel === dayLabel && o.type === 'add'
    );
    const used = new Set(ovs.filter(o => o.row != null).map(o => o.row as number));
    let next = 0;
    return ovs.map(o => {
      if (o.row != null) return { memberId: o.memberId, row: o.row };
      while (used.has(next)) next++;
      used.add(next);
      return { memberId: o.memberId, row: next++ };
    });
  };

  const getDayVehicleData = (dateStr: string, dayLabel: string, vehicleId: string) => {
    const route = goRoutes.find(r => r.vehicleId === vehicleId);
    if (!route) return { route: null, placed: [] as { memberId: string; row: number }[], presentCount: 0, bottomMemberId: null as string | null };
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

  const handleRemove = (memberId: string, dayLabel: string, vehicleId: string) => {
    const addOverride = weeklyDayOverrides.find(
      o => o.weekKey === weekKey && o.memberId === memberId && o.vehicleId === vehicleId && o.dayLabel === dayLabel && o.type === 'add'
    );
    if (addOverride) removeWeeklyDayOverride(addOverride.id);
  };

  const availableForPicking = () => {
    if (!picking) return [];
    const { dayLabel, vehicleId } = picking;
    // 現在その曜日に表示されているメンバーを除外
    const presentIds = new Set(
      routeStops
        .filter(rs => {
          const route = goRoutes.find(r => r.vehicleId === vehicleId);
          return route && rs.routeId === route.id;
        })
        .filter(rs => isActiveOnDay(rs.memberId, vehicleId, dayLabel))
        .map(rs => rs.memberId)
    );
    return members.filter(m => !presentIds.has(m.id));
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
                        const { route, placed, bottomMemberId } = getDayVehicleData(d.dateStr, d.label, v.id);
                        const p = placed.find(x => x.row === rowIdx);
                        const member = p ? getMember(p.memberId) : null;
                        const absent = p && route ? isAbsent(d.dateStr, p.memberId, route.id) : false;
                        const isToday = d.dateStr === today;
                        const showAdd = !member && !!route;
                        const isBottom = !!p && p.memberId === bottomMemberId;
                        const timeKey2 = isBottom ? `${d.label}-${v.id}-${p!.memberId}` : '';
                        const pickupTime = isBottom ? pickupTimes[timeKey2] : undefined;
                        const isLoadingTime = isBottom && loadingTimes.has(timeKey2);
                        const isNoCoord = isBottom && noCoordIds.has(timeKey2);
                        return (
                          <td
                            key={`cell-${d.label}-${v.id}-${rowIdx}`}
                            onClick={showAdd ? () => setPicking({ dayLabel: d.label, vehicleId: v.id, rowIdx }) : undefined}
                            className={`border border-gray-200 px-0 py-0 text-center align-middle min-w-[80px] ${isToday ? 'bg-pink-50/40' : ''} ${showAdd ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                            style={{height: '52px', maxHeight: '52px', overflow: 'hidden'}}
                          >
                            <div className="h-[52px] flex flex-col items-center justify-center px-2 overflow-hidden">
                            {member ? (
                              absent ? (
                                <div className="cell-line text-red-400">
                                  <div className="line-through text-[11px]">{displayName(member)}<span className="text-[9px] ml-0.5">様</span></div>
                                  <div className="text-[10px] font-bold">欠席</div>
                                </div>
                              ) : (
                                <div className="cell-line group relative">
                                  <div className="font-medium text-gray-800 text-[15px] leading-tight">
                                    {displayName(member)}<span className="print-sama text-[11px] text-gray-500 ml-0.5">様</span>
                                  </div>
                                  {pickupTime && pickupTime !== 'ERR' && (() => {
                                    const [ph, pm] = pickupTime.split(':').map(Number);
                                    const [ah, am] = (route?.arrivalTime ?? '10:55').split(':').map(Number);
                                    const travelMin = (ah * 60 + am) - (ph * 60 + pm);
                                    const isWeird = travelMin > 60 || travelMin < 0;
                                    return (
                                      <>
                                        <div className={`text-[11px] font-mono font-semibold mt-0.5 ${isWeird ? 'text-red-500' : 'text-blue-600'}`}>{pickupTime}</div>
                                        <div className={`text-[10px] mt-0 ${isWeird ? 'text-red-400' : 'text-gray-400'}`}>{travelMin}分</div>
                                      </>
                                    );
                                  })()}
                                  {pickupTime === 'ERR' && (
                                    <div className="text-[10px] text-red-500 mt-0.5">API失敗</div>
                                  )}
                                  {isLoadingTime && !pickupTime && (
                                    <div className="text-[10px] text-gray-400 mt-0.5">計算中...</div>
                                  )}
                                  {isNoCoord && (
                                    <div className="text-[10px] text-orange-500 mt-0.5">座標なし</div>
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
          <div className="space-y-2">
            {availableForPicking().length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">追加できる利用者がいません</p>
            ) : (
              availableForPicking().map(m => (
                <button
                  key={m.id}
                  onClick={() => handleAdd(m.id)}
                  className="w-full text-left px-4 py-3 rounded-xl border border-gray-100 hover:bg-pink-50 hover:border-pink-200 cursor-pointer transition-colors flex items-center justify-between"
                >
                  <span className="font-medium text-gray-800 text-sm">{m.name}</span>
                  <span className="text-xs text-gray-400">{(Array.isArray(m.defaultDays) ? m.defaultDays : String(m.defaultDays ?? '').split(',').filter(Boolean)).join('・') || '曜日未設定'}</span>
                </button>
              ))
            )}
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
