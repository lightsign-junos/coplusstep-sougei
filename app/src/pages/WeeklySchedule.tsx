import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Printer, Plus } from 'lucide-react';
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
    vehicles, routes, routeStops, members, staff, dailyOverrides,
    updateMember, addRouteStop, deleteRouteStop, updateRoute, recalcRouteStopTimes,
  } = useDataStore();

  const [weekBase, setWeekBase] = useState(new Date());
  const [picking, setPicking] = useState<{ dayLabel: string; vehicleId: string } | null>(null);
  const [editingStaff, setEditingStaff] = useState<{ vehicleId: string; field: 'driverId' | 'attendantId' } | null>(null);

  const weekStart = startOfWeek(weekBase, { weekStartsOn: 1 });
  const weekDates = WEEK_DAYS.map(d => ({
    ...d,
    date: addDays(weekStart, d.idx - 1),
    dateStr: format(addDays(weekStart, d.idx - 1), 'yyyy-MM-dd'),
  }));

  const goRoutes = routes.filter(r => r.direction === 'go');
  const activeVehicles = vehicles.filter(v => v.active);
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

  const getDayVehicleData = (dateStr: string, dayLabel: string, vehicleId: string) => {
    const route = goRoutes.find(r => r.vehicleId === vehicleId);
    if (!route) return { route: null, stops: [], presentCount: 0 };
    const allStops = getStops(route.id);
    const stops = allStops.filter(s => {
      const m = getMember(s.memberId);
      return m && m.defaultDays.includes(dayLabel);
    });
    const presentCount = stops.filter(s => !isAbsent(dateStr, s.memberId, route.id)).length;
    return { route, stops, presentCount };
  };

  // Enough rows for all columns + 1 add-button row, min 6
  let maxRows = 6;
  for (const d of weekDates) {
    for (const v of activeVehicles) {
      const { stops } = getDayVehicleData(d.dateStr, d.label, v.id);
      if (stops.length >= maxRows) maxRows = stops.length + 1;
    }
  }

  const numVehicles = activeVehicles.length;

  // ── handlers ──────────────────────────────────────────────

  const handleAdd = (memberId: string) => {
    if (!picking) return;
    const { dayLabel, vehicleId } = picking;
    const route = goRoutes.find(r => r.vehicleId === vehicleId);
    if (!route) { setPicking(null); return; }

    const hasStop = routeStops.some(rs => rs.routeId === route.id && rs.memberId === memberId);
    if (!hasStop) {
      const maxOrder = routeStops
        .filter(rs => rs.routeId === route.id)
        .reduce((max, rs) => Math.max(max, rs.order), 0);
      addRouteStop({
        id: `rs-${Date.now()}`,
        routeId: route.id,
        memberId,
        locationId: '',
        order: maxOrder + 1,
        scheduledTime: '00:00',
      });
    }

    const member = members.find(m => m.id === memberId);
    if (member && !member.defaultDays.includes(dayLabel)) {
      updateMember({ ...member, defaultDays: [...member.defaultDays, dayLabel] });
    }

    setPicking(null);
    recalcRouteStopTimes(route.id);
  };

  const handleRemove = (memberId: string, dayLabel: string, vehicleId: string) => {
    const member = members.find(m => m.id === memberId);
    if (!member) return;
    const newDays = member.defaultDays.filter(d => d !== dayLabel);
    updateMember({ ...member, defaultDays: newDays });

    const route = goRoutes.find(r => r.vehicleId === vehicleId);
    if (route && newDays.length === 0) {
      const stop = routeStops.find(rs => rs.routeId === route.id && rs.memberId === memberId);
      if (stop) deleteRouteStop(stop.id);
    }
    if (route) recalcRouteStopTimes(route.id);
  };

  const availableForPicking = () => {
    if (!picking) return [];
    const { dayLabel, vehicleId } = picking;
    const route = goRoutes.find(r => r.vehicleId === vehicleId);
    if (!route) return members;
    const assignedIds = new Set(
      routeStops
        .filter(rs => rs.routeId === route.id)
        .filter(rs => getMember(rs.memberId)?.defaultDays.includes(dayLabel))
        .map(rs => rs.memberId)
    );
    return members.filter(m => !assignedIds.has(m.id));
  };

  const pickingVehicle = picking ? activeVehicles.find(v => v.id === picking.vehicleId) : null;
  const editingRoute = editingStaff ? goRoutes.find(r => r.vehicleId === editingStaff.vehicleId) : null;

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between mb-5 no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">週次送迎表</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {format(weekDates[0].date, 'M月d日', { locale: ja })}（月）〜
            {format(weekDates[5].date, 'M月d日', { locale: ja })}（土）
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekBase(w => subWeeks(w, 1))} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => setWeekBase(new Date())} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            今週
          </button>
          <button onClick={() => setWeekBase(w => addWeeks(w, 1))} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
            <ChevronRight size={18} />
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-700 cursor-pointer ml-2"
          >
            <Printer size={15} />
            印刷
          </button>
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print-block mb-3">
        <h2 className="text-lg font-bold text-center">コプラスステップ 昭和島教室　送迎表</h2>
        <p className="text-sm text-center">
          {format(weekDates[0].date, 'yyyy年M月d日', { locale: ja })}（月）〜
          {format(weekDates[5].date, 'M月d日', { locale: ja })}（土）
        </p>
      </div>

      {/* Table */}
      <div
        className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden print-table-wrap flex flex-col"
        style={{ height: 'calc(100vh - 160px)' }}
      >
        <div className="overflow-x-auto flex-1 flex flex-col">
          <table className="w-full text-xs border-collapse table-fixed" style={{ height: '100%' }}>
            <thead>
              {/* Row 1: Date — click → dashboard */}
              <tr>
                <th
                  className="border border-gray-300 bg-gray-100 px-2 py-2 text-center text-xs font-semibold text-gray-600 w-14"
                  rowSpan={5}
                >
                  お迎え
                </th>
                {weekDates.map(d => (
                  <th
                    key={d.label}
                    colSpan={numVehicles}
                    onClick={() => navigate(`/?date=${d.dateStr}`)}
                    className={`border border-gray-300 px-2 py-2 text-center font-bold text-sm cursor-pointer select-none transition-colors ${
                      d.dateStr === today
                        ? 'bg-pink-100 text-pink-700 hover:bg-pink-200'
                        : d.label === '土'
                        ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                        : 'bg-gray-50 text-gray-800 hover:bg-gray-100'
                    }`}
                  >
                    {format(d.date, 'M/d', { locale: ja })}（{d.label}）
                  </th>
                ))}
              </tr>

              {/* Row 2: Vehicle names */}
              <tr>
                {weekDates.flatMap(d =>
                  activeVehicles.map(v => (
                    <th
                      key={`veh-${d.label}-${v.id}`}
                      className={`border border-gray-300 px-2 py-1.5 text-center text-xs font-bold text-white vehicle-${v.color}-header`}
                    >
                      {v.name}
                    </th>
                  ))
                )}
              </tr>

              {/* Row 3: Driver (click to edit) */}
              <tr className="bg-gray-50">
                {weekDates.flatMap(d =>
                  activeVehicles.map(v => {
                    const route = goRoutes.find(r => r.vehicleId === v.id);
                    return (
                      <td
                        key={`drv-${d.label}-${v.id}`}
                        className="border border-gray-300 px-2 py-1 text-center text-xs text-gray-700"
                      >
                        <div className="cell-line">
                          <div className="row-label text-gray-400 text-[10px]">運転</div>
                          <div
                            className="no-print cursor-pointer hover:text-blue-600 transition-colors"
                            onClick={() => route && setEditingStaff({ vehicleId: v.id, field: 'driverId' })}
                          >
                            {route ? getStaffName(route.driverId) : '―'}
                          </div>
                        </div>
                      </td>
                    );
                  })
                )}
              </tr>

              {/* Row 4: Attendant (click to edit) */}
              <tr className="bg-gray-50">
                {weekDates.flatMap(d =>
                  activeVehicles.map(v => {
                    const route = goRoutes.find(r => r.vehicleId === v.id);
                    return (
                      <td
                        key={`att-${d.label}-${v.id}`}
                        className="border border-gray-300 px-2 py-1 text-center text-xs text-gray-700"
                      >
                        <div className="cell-line">
                          <div className="row-label text-gray-400 text-[10px]">添乗</div>
                          <div
                            className="no-print cursor-pointer hover:text-blue-600 transition-colors"
                            onClick={() => route && setEditingStaff({ vehicleId: v.id, field: 'attendantId' })}
                          >
                            {route ? getStaffName(route.attendantId) : '―'}
                          </div>
                        </div>
                      </td>
                    );
                  })
                )}
              </tr>

              {/* Row 5: Total count */}
              <tr className="bg-gray-50">
                {weekDates.map(d => {
                  const total = activeVehicles.reduce((sum, v) => {
                    const { presentCount } = getDayVehicleData(d.dateStr, d.label, v.id);
                    return sum + presentCount;
                  }, 0);
                  return (
                    <td
                      key={`total-${d.label}`}
                      colSpan={numVehicles}
                      className={`border border-gray-300 px-2 py-1 text-center text-xs font-semibold ${
                        d.dateStr === today ? 'bg-pink-50 text-pink-700' : 'text-gray-700'
                      }`}
                    >
                      合計 {total} 名
                    </td>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {Array.from({ length: maxRows }, (_, rowIdx) => (
                <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                  <td className="border border-gray-300 bg-gray-50 px-1 py-1 text-center text-xs text-gray-400 w-14">
                    {rowIdx + 1}
                  </td>
                  {weekDates.flatMap(d =>
                    activeVehicles.map(v => {
                      const { route, stops } = getDayVehicleData(d.dateStr, d.label, v.id);
                      const stop = stops[rowIdx];
                      const member = stop ? getMember(stop.memberId) : null;
                      const absent = stop && route ? isAbsent(d.dateStr, stop.memberId, route.id) : false;
                      const isToday = d.dateStr === today;
                      const showAdd = !member && rowIdx === stops.length && !!route;

                      return (
                        <td
                          key={`cell-${d.label}-${v.id}-${rowIdx}`}
                          onClick={showAdd ? () => setPicking({ dayLabel: d.label, vehicleId: v.id }) : undefined}
                          className={`border border-gray-200 px-2 py-2 text-center align-middle min-w-[80px] ${
                            isToday ? 'bg-pink-50/40' : ''
                          } ${showAdd ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                        >
                          {member ? (
                            absent ? (
                              <div className="cell-line text-red-400">
                                <div className="line-through text-[11px]">{displayName(member)} 様</div>
                                <div className="text-[10px] font-bold">欠席</div>
                              </div>
                            ) : (
                              <div className="cell-line group relative">
                                <div className="font-medium text-gray-800 text-[15px] leading-tight">
                                  {displayName(member)}<span className="print-sama"> 様</span>
                                </div>
                                <div className="text-gray-600 font-mono text-[14px] font-semibold">
                                  {stop.scheduledTime}
                                </div>
                                <button
                                  onClick={e => { e.stopPropagation(); handleRemove(member.id, d.label, v.id); }}
                                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-100 text-red-500 rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity no-print"
                                >
                                  ×
                                </button>
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

      {/* Member picker modal */}
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
                  <span className="text-xs text-gray-400">
                    {m.defaultDays.length > 0 ? m.defaultDays.join('・') : '曜日未設定'}
                  </span>
                </button>
              ))
            )}
          </div>
        </Modal>
      )}

      {/* Staff picker modal */}
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
                  onClick={() => {
                    updateRoute({ ...editingRoute, [editingStaff.field]: s.id });
                    setEditingStaff(null);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-xl border cursor-pointer transition-colors flex items-center justify-between ${
                    isCurrent
                      ? 'border-blue-200 bg-blue-50 text-blue-700'
                      : 'border-gray-100 hover:bg-gray-50'
                  }`}
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
