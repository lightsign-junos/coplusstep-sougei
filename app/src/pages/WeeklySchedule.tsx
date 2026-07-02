import { useState } from 'react';
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
    vehicles, routes, routeStops, members, staff, dailyOverrides, weeklyDayOverrides,
    addRouteStop, updateRouteStop,
    updateRoute, addWeeklyDayOverride, removeWeeklyDayOverride,
  } = useDataStore();

  const allActiveVehicles = vehicles.filter(v => v.active);
  const activeVehicles = allActiveVehicles;

  const [weekBase, setWeekBase] = useState(new Date());
  const [copyToast, setCopyToast] = useState(false);
  const [picking, setPicking] = useState<{ dayLabel: string; vehicleId: string; rowIdx: number } | null>(null);
  const [editingStaff, setEditingStaff] = useState<{ vehicleId: string; field: 'driverId' | 'attendantId' } | null>(null);

  const goRoutes = routes.filter(r => r.direction === 'go');

  const handleCopyWeek = () => {
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 2500);
  };

  // ── Table view helpers ─────────────────────────────────────

  const weekStart = startOfWeek(weekBase, { weekStartsOn: 1 });
  const weekKey = format(weekStart, 'yyyy-MM-dd');
  const weekDates = WEEK_DAYS.map(d => ({
    ...d,
    date: addDays(weekStart, d.idx - 1),
    dateStr: format(addDays(weekStart, d.idx - 1), 'yyyy-MM-dd'),
  }));
  const today = format(new Date(), 'yyyy-MM-dd');

  const getStops = (routeId: string) =>
    routeStops.filter(rs => rs.routeId === routeId).sort((a, b) => a.order - b.order);
  const getMember = (id: string) => members.find(m => m.id === id);
  const displayName = (m: ReturnType<typeof getMember>) =>
    m ? getMemberDisplayName(m, members) : '';
  const getStaffName = (id: string) => staff.find(s => s.id === id)?.name ?? '未設定';
  const isAbsent = (dateStr: string, memberId: string, routeId: string) =>
    dailyOverrides.some(
      o => o.date === dateStr && o.memberId === memberId && o.routeId === routeId && o.type === 'absent'
    );

  // defaultDays をベースに、週次オーバーライドで追加・除外を反映
  const isActiveOnDay = (memberId: string, vehicleId: string, dayLabel: string): boolean => {
    const member = getMember(memberId);
    if (!member) return false;
    const overrides = weeklyDayOverrides.filter(
      o => o.weekKey === weekKey && o.memberId === memberId && o.vehicleId === vehicleId && o.dayLabel === dayLabel
    );
    const removed = overrides.some(o => o.type === 'remove');
    const added   = overrides.some(o => o.type === 'add');
    if (removed) return false;
    if (added) return true;
    return member.defaultDays.includes(dayLabel);
  };

  const getDayVehicleData = (dateStr: string, dayLabel: string, vehicleId: string) => {
    const route = goRoutes.find(r => r.vehicleId === vehicleId);
    if (!route) return { route: null, stops: [], presentCount: 0 };
    const allStops = getStops(route.id);
    const stops = allStops.filter(s => isActiveOnDay(s.memberId, vehicleId, dayLabel));
    const presentCount = stops.filter(s => !isAbsent(dateStr, s.memberId, route.id)).length;
    return { route, stops, presentCount };
  };

  const maxRows = 7;
  const numVehicles = activeVehicles.length;

  const handleAdd = (memberId: string) => {
    if (!picking) return;
    const { dayLabel, vehicleId, rowIdx } = picking;
    const route = goRoutes.find(r => r.vehicleId === vehicleId);
    if (!route) { setPicking(null); return; }

    const targetOrder = rowIdx + 1;

    // 車両へのrouteStop（乗車割当）がなければ追加
    const hasStop = routeStops.some(rs => rs.routeId === route.id && rs.memberId === memberId);
    if (!hasStop) {
      // targetOrder以上のstopを1つ後ろにずらして空きを作る
      routeStops
        .filter(rs => rs.routeId === route.id && rs.order >= targetOrder)
        .forEach(rs => updateRouteStop({ ...rs, order: rs.order + 1 }));
      addRouteStop({ id: `rs-${Date.now()}`, routeId: route.id, memberId, locationId: '', order: targetOrder, scheduledTime: '00:00' });
    }

    // defaultDaysにない曜日 → この週だけの追加オーバーライドを作成（defaultDaysは変更しない）
    const member = members.find(m => m.id === memberId);
    if (member && !member.defaultDays.includes(dayLabel)) {
      // 除外オーバーライドがあれば削除、なければ追加オーバーライドを作成
      const removeOverride = weeklyDayOverrides.find(
        o => o.weekKey === weekKey && o.memberId === memberId && o.vehicleId === vehicleId && o.dayLabel === dayLabel && o.type === 'remove'
      );
      if (removeOverride) {
        removeWeeklyDayOverride(removeOverride.id);
      } else {
        addWeeklyDayOverride({ id: `wdo-${Date.now()}`, weekKey, memberId, vehicleId, dayLabel, type: 'add' });
      }
    }
    // defaultDaysにある曜日 → 除外オーバーライドがあれば削除
    else if (member && member.defaultDays.includes(dayLabel)) {
      const removeOverride = weeklyDayOverrides.find(
        o => o.weekKey === weekKey && o.memberId === memberId && o.vehicleId === vehicleId && o.dayLabel === dayLabel && o.type === 'remove'
      );
      if (removeOverride) removeWeeklyDayOverride(removeOverride.id);
    }

    setPicking(null);
  };

  const handleRemove = (memberId: string, dayLabel: string, vehicleId: string) => {
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    if (member.defaultDays.includes(dayLabel)) {
      // defaultDaysにある → この週だけの除外オーバーライドを作成
      const addOverride = weeklyDayOverrides.find(
        o => o.weekKey === weekKey && o.memberId === memberId && o.vehicleId === vehicleId && o.dayLabel === dayLabel && o.type === 'add'
      );
      if (addOverride) {
        removeWeeklyDayOverride(addOverride.id);
      } else {
        addWeeklyDayOverride({ id: `wdo-${Date.now()}`, weekKey, memberId, vehicleId, dayLabel, type: 'remove' });
      }
    } else {
      // 追加オーバーライドで表示されていた → そのオーバーライドを削除
      const addOverride = weeklyDayOverrides.find(
        o => o.weekKey === weekKey && o.memberId === memberId && o.vehicleId === vehicleId && o.dayLabel === dayLabel && o.type === 'add'
      );
      if (addOverride) removeWeeklyDayOverride(addOverride.id);
    }
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
                    activeVehicles.map(v => (
                      <th key={`veh-${d.label}-${v.id}`} className={`border border-gray-300 px-2 py-1.5 text-center text-xs font-bold text-white vehicle-${v.color}-header`}>
                        {v.name}
                      </th>
                    ))
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
                  <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                    <td className="border border-gray-300 bg-gray-50 px-1 py-1 text-center text-xs text-gray-400 w-14">{rowIdx + 1}</td>
                    {weekDates.flatMap(d =>
                      activeVehicles.map(v => {
                        const { route, stops } = getDayVehicleData(d.dateStr, d.label, v.id);
                        // 行番号(rowIdx+1) = order番号で直接検索
                        const stop = stops.find(s => s.order === rowIdx + 1);
                        const member = stop ? getMember(stop.memberId) : null;
                        const absent = stop && route ? isAbsent(d.dateStr, stop.memberId, route.id) : false;
                        const isToday = d.dateStr === today;
                        const showAdd = !member && !!route;
                        return (
                          <td
                            key={`cell-${d.label}-${v.id}-${rowIdx}`}
                            onClick={showAdd ? () => setPicking({ dayLabel: d.label, vehicleId: v.id, rowIdx }) : undefined}
                            className={`border border-gray-200 px-2 py-2 text-center align-middle min-w-[80px] ${isToday ? 'bg-pink-50/40' : ''} ${showAdd ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                          >
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
                  <span className="text-xs text-gray-400">{m.defaultDays.length > 0 ? m.defaultDays.join('・') : '曜日未設定'}</span>
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
