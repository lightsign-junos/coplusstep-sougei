import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Printer, Plus, Copy, UserPlus, LayoutGrid, Table, Car, Check } from 'lucide-react';
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

type ViewMode = 'schedule' | 'table';


export function WeeklySchedule() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isNewFlow = searchParams.get('new') === '1';

  const {
    vehicles, routes, routeStops, members, staff, dailyOverrides,
    updateMember, addMember, addRoute, addRouteStop, deleteRouteStop,
    updateRoute, recalcRouteStopTimes,
  } = useDataStore();

  const allActiveVehicles = vehicles.filter(v => v.active);

  // Wizard step: only shown when coming from Dashboard's "作成" button
  const [wizardStep, setWizardStep] = useState<'select-vehicles' | 'edit'>(
    isNewFlow ? 'select-vehicles' : 'edit'
  );
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<Set<string>>(
    () => new Set(allActiveVehicles.filter(v => v.color !== 'vel').map(v => v.id))
  );

  const toggleVehicle = (id: string) => {
    setSelectedVehicleIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const [viewMode, setViewMode] = useState<ViewMode>('schedule');
  const [weekBase, setWeekBase] = useState(new Date());
  const [draggingMemberId, setDraggingMemberId] = useState<string | null>(null);
  const [dragOverVehicleId, setDragOverVehicleId] = useState<string | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newName, setNewName] = useState('');
  const [newKana, setNewKana] = useState('');
  const [copyToast, setCopyToast] = useState(false);
  const [picking, setPicking] = useState<{ dayLabel: string; vehicleId: string } | null>(null);
  const [editingStaff, setEditingStaff] = useState<{ vehicleId: string; field: 'driverId' | 'attendantId' } | null>(null);

  const goRoutes = routes.filter(r => r.direction === 'go');
  // When in wizard flow, only show selected vehicles; otherwise show all
  const activeVehicles = wizardStep === 'edit' && isNewFlow
    ? allActiveVehicles.filter(v => selectedVehicleIds.has(v.id))
    : allActiveVehicles;

  // ── Vehicle assignment helpers ──────────────────────────────

  const getVehicleRoute = (vehicleId: string) =>
    goRoutes.find(r => r.vehicleId === vehicleId);

  const getVehicleMembers = (vehicleId: string) => {
    const route = getVehicleRoute(vehicleId);
    if (!route) return [];
    const ids = new Set(routeStops.filter(rs => rs.routeId === route.id).map(rs => rs.memberId));
    return members
      .filter(m => ids.has(m.id))
      .sort((a, b) => (a.nameKana ?? '').localeCompare(b.nameKana ?? '', 'ja'));
  };

  const assignedIds = new Set(
    routeStops
      .filter(rs => goRoutes.some(r => r.id === rs.routeId))
      .map(rs => rs.memberId)
  );

  const unassignedMembers = members
    .filter(m => !assignedIds.has(m.id))
    .sort((a, b) => (a.nameKana ?? '').localeCompare(b.nameKana ?? '', 'ja'));

  // ── Drag and drop ──────────────────────────────────────────

  const handleDrop = (vehicleId: string) => {
    if (!draggingMemberId) return;

    // Remove from current vehicle if already assigned
    const existingStop = routeStops.find(rs =>
      goRoutes.some(r => r.id === rs.routeId) && rs.memberId === draggingMemberId
    );
    if (existingStop) deleteRouteStop(existingStop.id);

    // Get or create go route for this vehicle
    let route = getVehicleRoute(vehicleId);
    if (!route) {
      const vehicle = vehicles.find(v => v.id === vehicleId);
      const newRoute = {
        id: `r-${Date.now()}`,
        name: `${vehicle?.name ?? ''}号 行き`,
        direction: 'go' as const,
        vehicleId,
        driverId: '',
        attendantId: '',
        arrivalTime: '09:30',
        velEnabled: false,
        notes: '',
      };
      addRoute(newRoute);
      route = newRoute;
    }

    const maxOrder = routeStops
      .filter(rs => rs.routeId === route!.id)
      .reduce((max, rs) => Math.max(max, rs.order), 0);

    addRouteStop({
      id: `rs-${Date.now()}`,
      routeId: route.id,
      memberId: draggingMemberId,
      locationId: '',
      order: maxOrder + 1,
      scheduledTime: '00:00',
    });

    setDraggingMemberId(null);
    setDragOverVehicleId(null);
  };

  const handleUnassign = (memberId: string) => {
    const stop = routeStops.find(rs =>
      goRoutes.some(r => r.id === rs.routeId) && rs.memberId === memberId
    );
    if (stop) deleteRouteStop(stop.id);
  };

  // ── Add member ─────────────────────────────────────────────

  const handleAddMember = () => {
    if (!newName) return;
    addMember({
      id: `m-${Date.now()}`,
      name: newName,
      nameKana: newKana,
      phone: '',
      defaultDays: [],
      sendFlag: true,
      returnFlag: true,
      notes: '',
      createdAt: new Date().toISOString(),
    });
    setNewName('');
    setNewKana('');
    setShowAddMember(false);
  };

  const handleCopyWeek = () => {
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 2500);
  };

  // ── Table view helpers ─────────────────────────────────────

  const weekStart = startOfWeek(weekBase, { weekStartsOn: 1 });
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

  let maxRows = 6;
  for (const d of weekDates) {
    for (const v of activeVehicles) {
      const { stops } = getDayVehicleData(d.dateStr, d.label, v.id);
      if (stops.length >= maxRows) maxRows = stops.length + 1;
    }
  }
  const numVehicles = activeVehicles.length;

  const handleAdd = (memberId: string) => {
    if (!picking) return;
    const { dayLabel, vehicleId } = picking;
    const route = goRoutes.find(r => r.vehicleId === vehicleId);
    if (!route) { setPicking(null); return; }
    const hasStop = routeStops.some(rs => rs.routeId === route.id && rs.memberId === memberId);
    if (!hasStop) {
      const maxOrder = routeStops.filter(rs => rs.routeId === route.id).reduce((max, rs) => Math.max(max, rs.order), 0);
      addRouteStop({ id: `rs-${Date.now()}`, routeId: route.id, memberId, locationId: '', order: maxOrder + 1, scheduledTime: '00:00' });
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
    const ids = new Set(
      routeStops.filter(rs => rs.routeId === route.id)
        .filter(rs => getMember(rs.memberId)?.defaultDays.includes(dayLabel))
        .map(rs => rs.memberId)
    );
    return members.filter(m => !ids.has(m.id));
  };

  const pickingVehicle = picking ? activeVehicles.find(v => v.id === picking.vehicleId) : null;
  const editingRoute = editingStaff ? goRoutes.find(r => r.vehicleId === editingStaff.vehicleId) : null;

  // ── 車両選択ステップ ───────────────────────────────────────
  if (wizardStep === 'select-vehicles') {
    const VEHICLE_STYLES: Record<string, { header: string; card: string; check: string }> = {
      pink: { header: 'vehicle-pink-header', card: 'border-pink-300 bg-pink-50', check: 'bg-pink-500' },
      blue: { header: 'vehicle-blue-header', card: 'border-blue-300 bg-blue-50', check: 'bg-blue-500' },
      vel:  { header: 'vehicle-vel-header',  card: 'border-gray-300 bg-gray-50',  check: 'bg-gray-700' },
    };

    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
        <div className="w-full max-w-xl">
          {/* ステップ表示 */}
          <div className="flex items-center gap-2 mb-6">
            <button onClick={() => navigate('/dashboard')} className="text-sm text-gray-400 hover:text-gray-600 cursor-pointer">
              ← 当日確認に戻る
            </button>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">今週の送迎表を作成</h1>
          <p className="text-gray-500 text-sm mb-8">使用する車両を選択してください</p>

          <div className="flex flex-col gap-3 mb-8">
            {allActiveVehicles.map(vehicle => {
              const styles = VEHICLE_STYLES[vehicle.color] ?? VEHICLE_STYLES.vel;
              const selected = selectedVehicleIds.has(vehicle.id);
              const memberCount = routeStops.filter(rs =>
                goRoutes.some(r => r.vehicleId === vehicle.id && r.id === rs.routeId)
              ).length;

              return (
                <div
                  key={vehicle.id}
                  onClick={() => toggleVehicle(vehicle.id)}
                  className={`flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all select-none ${
                    selected ? styles.card + ' shadow-sm' : 'border-gray-200 bg-white opacity-50'
                  }`}
                >
                  {/* 車両カラーバー */}
                  <div className={`${styles.header} w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <Car size={22} />
                  </div>

                  <div className="flex-1">
                    <p className="font-bold text-gray-900">{vehicle.name}号</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {vehicle.color === 'vel' ? '補助稼働（必要な時のみ）' : '常時稼働'}
                      {memberCount > 0 && <span className="ml-2">{memberCount}名 登録済み</span>}
                    </p>
                  </div>

                  {/* チェックマーク */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                    selected ? styles.check + ' text-white' : 'border-2 border-gray-300 bg-white'
                  }`}>
                    {selected && <Check size={14} strokeWidth={3} />}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => setWizardStep('edit')}
            disabled={selectedVehicleIds.size === 0}
            className="w-full py-3.5 bg-pink-500 hover:bg-pink-600 text-white font-bold text-base rounded-2xl cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            次へ進む → 利用者を配置する
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 no-print">
        <h1 className="text-2xl font-bold text-gray-900">送迎スケジュール</h1>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('schedule')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all ${viewMode === 'schedule' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <LayoutGrid size={13} /> 編集
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all ${viewMode === 'table' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Table size={13} /> 週次一覧
            </button>
          </div>

          <button
            onClick={handleCopyWeek}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
          >
            <Copy size={13} /> 前週をコピー
          </button>
          {viewMode === 'table' && (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* Copy toast */}
      {copyToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50 pointer-events-none">
          前週のスケジュールをコピーしました
        </div>
      )}

      {/* ── SCHEDULE EDIT VIEW ── */}
      {viewMode === 'schedule' && (
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Left: unassigned member list */}
          <div className="w-44 flex-shrink-0 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500">未割当の利用者</span>
              <button
                onClick={() => setShowAddMember(true)}
                className="flex items-center gap-1 text-xs text-pink-600 hover:text-pink-700 cursor-pointer"
              >
                <UserPlus size={12} /> 新規追加
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {unassignedMembers.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">全員割り当て済み</p>
              ) : (
                unassignedMembers.map(member => (
                  <div
                    key={member.id}
                    draggable
                    onDragStart={() => setDraggingMemberId(member.id)}
                    onDragEnd={() => { setDraggingMemberId(null); setDragOverVehicleId(null); }}
                    className={`px-3 py-2.5 bg-white border border-gray-200 rounded-xl cursor-grab active:cursor-grabbing select-none shadow-sm hover:shadow-md hover:border-pink-200 transition-all ${draggingMemberId === member.id ? 'opacity-40 scale-95' : ''}`}
                  >
                    <p className="text-sm font-semibold text-gray-800 leading-tight">{member.name}</p>
                    {member.nameKana && <p className="text-[11px] text-gray-400 mt-0.5">{member.nameKana}</p>}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Vehicle columns */}
          <div className="flex-1 grid grid-cols-3 gap-3 overflow-y-auto">
            {activeVehicles.map(vehicle => {
              const vehicleMembers = getVehicleMembers(vehicle.id);
              const isOver = dragOverVehicleId === vehicle.id;

              return (
                <div
                  key={vehicle.id}
                  onDragOver={e => { e.preventDefault(); setDragOverVehicleId(vehicle.id); }}
                  onDragLeave={e => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragOverVehicleId(null);
                    }
                  }}
                  onDrop={() => handleDrop(vehicle.id)}
                  className={`flex flex-col rounded-2xl border overflow-hidden transition-all duration-150 ${isOver ? 'ring-2 ring-pink-400 ring-offset-1 scale-[1.01]' : 'border-gray-200'}`}
                >
                  {/* Vehicle header */}
                  <div className={`vehicle-${vehicle.color}-header px-4 py-3`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-base">{vehicle.name}号</span>
                      <span className="text-sm opacity-80">{vehicleMembers.length}名</span>
                    </div>
                  </div>

                  {/* Member cards */}
                  <div className="flex-1 bg-white p-3 space-y-2 min-h-[200px]">
                    {vehicleMembers.length === 0 && (
                      <div className={`border-2 border-dashed rounded-xl p-6 text-center text-sm transition-colors ${isOver ? 'border-pink-300 bg-pink-50 text-pink-400' : 'border-gray-200 text-gray-300'}`}>
                        {isOver ? 'ここにドロップ' : 'ドラッグして追加'}
                      </div>
                    )}

                    {vehicleMembers.map(member => (
                      <div
                        key={member.id}
                        className="bg-gray-50 rounded-xl border border-gray-100 px-3 py-2.5 group flex items-center justify-between"
                      >
                        <div>
                          <span className="text-sm font-semibold text-gray-800">{member.name}</span>
                          {member.defaultDays.length > 0 && (
                            <p className="text-xs text-gray-400 mt-0.5">{member.defaultDays.join('・')}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleUnassign(member.id)}
                          className="w-5 h-5 rounded-full bg-gray-200 text-gray-400 hover:bg-red-100 hover:text-red-500 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-all flex-shrink-0"
                        >
                          ×
                        </button>
                      </div>
                    ))}

                    {vehicleMembers.length > 0 && isOver && (
                      <div className="border-2 border-dashed border-pink-300 bg-pink-50 rounded-xl p-3 text-center text-sm text-pink-400">
                        ここにドロップ
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TABLE VIEW ── */}
      {viewMode === 'table' && (
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
                          const stop = stops[rowIdx];
                          const member = stop ? getMember(stop.memberId) : null;
                          const absent = stop && route ? isAbsent(d.dateStr, stop.memberId, route.id) : false;
                          const isToday = d.dateStr === today;
                          const showAdd = !member && !!route;
                          return (
                            <td
                              key={`cell-${d.label}-${v.id}-${rowIdx}`}
                              onClick={showAdd ? () => setPicking({ dayLabel: d.label, vehicleId: v.id }) : undefined}
                              className={`border border-gray-200 px-2 py-2 text-center align-middle min-w-[80px] ${isToday ? 'bg-pink-50/40' : ''} ${showAdd ? 'cursor-pointer hover:bg-gray-50' : ''}`}
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
                                    <div className="text-gray-600 font-mono text-[14px] font-semibold">{stop.scheduledTime}</div>
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
      )}

      {/* Add member modal */}
      {showAddMember && (
        <Modal title="新しい利用者を追加" onClose={() => setShowAddMember(false)} size="sm">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">氏名 *</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddMember()}
                placeholder="例：田中 太郎"
                autoFocus
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">読み仮名（50音順に並び替わります）</label>
              <input
                value={newKana}
                onChange={e => setNewKana(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddMember()}
                placeholder="例：たなか たろう"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
              />
            </div>
            <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
              <button onClick={() => setShowAddMember(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer">キャンセル</button>
              <button onClick={handleAddMember} disabled={!newName} className="px-4 py-2 text-sm bg-pink-500 text-white rounded-lg hover:bg-pink-600 cursor-pointer disabled:opacity-50">追加</button>
            </div>
          </div>
        </Modal>
      )}

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
