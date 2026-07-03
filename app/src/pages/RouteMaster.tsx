import { useState } from 'react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, GripVertical, Trash2, Car, Clock, Edit2, X, Check } from 'lucide-react';
import { useDataStore } from '../store/dataStore';
import { Modal } from '../components/common/Modal';
import type { Route, RouteStop } from '../types';

function SortableStop({ stop, memberName, onDelete, onTimeEdit }: {
  stop: RouteStop;
  memberName: string;
  onDelete: (id: string) => void;
  onTimeEdit: (id: string, time: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.id });
  const [editing, setEditing] = useState(false);
  const [time, setTime] = useState(stop.manualTime ?? stop.scheduledTime);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-2.5 group">
      <button {...attributes} {...listeners} className="drag-handle text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing">
        <GripVertical size={16} />
      </button>
      <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0">
        {stop.order}
      </span>
      <span className="flex-1 text-sm font-medium text-gray-800">{memberName}</span>
      <div className="flex items-center gap-1">
        {editing ? (
          <>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="w-24 text-xs border border-gray-200 rounded px-2 py-1"
            />
            <button onClick={() => { onTimeEdit(stop.id, time); setEditing(false); }} className="p-1 text-green-600 hover:bg-green-50 rounded cursor-pointer">
              <Check size={14} />
            </button>
            <button onClick={() => setEditing(false)} className="p-1 text-gray-400 hover:bg-gray-100 rounded cursor-pointer">
              <X size={14} />
            </button>
          </>
        ) : (
          <>
            <span className="text-xs font-mono text-gray-500">{stop.manualTime ?? stop.scheduledTime}</span>
            <button onClick={() => setEditing(true)} className="p-1 text-gray-300 hover:text-gray-600 cursor-pointer opacity-0 group-hover:opacity-100">
              <Edit2 size={12} />
            </button>
          </>
        )}
        <button onClick={() => onDelete(stop.id)} className="p-1 text-gray-300 hover:text-red-500 cursor-pointer opacity-0 group-hover:opacity-100">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export function RouteMaster() {
  const { routes, routeStops, members, staff, vehicles, addRoute, updateRoute, deleteRoute,
    addRouteStop, deleteRouteStop, updateRouteStop, reorderRouteStops } = useDataStore();

  const [showRouteModal, setShowRouteModal] = useState(false);
  const [showAddStopModal, setShowAddStopModal] = useState<string | null>(null);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [newStopMemberId, setNewStopMemberId] = useState('');

  const [form, setForm] = useState({
    name: '', direction: 'go' as const, vehicleId: '', driverId: '',
    attendantId: '', arrivalTime: '10:55', notes: '',
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const activeRoutes = routes.filter(r => r.direction === 'go');
  const getStops = (routeId: string) =>
    routeStops.filter(rs => rs.routeId === routeId).sort((a, b) => a.order - b.order);
  const getMember = (id: string) => members.find(m => m.id === id);
  const getVehicle = (id: string) => vehicles.find(v => v.id === id);
  const getStaffName = (id: string) => staff.find(s => s.id === id)?.name ?? '未設定';

  const handleDragEnd = (event: DragEndEvent, routeId: string) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const stops = getStops(routeId);
    const oldIdx = stops.findIndex(s => s.id === active.id);
    const newIdx = stops.findIndex(s => s.id === over.id);
    const reordered = arrayMove(stops, oldIdx, newIdx);
    reorderRouteStops(routeId, reordered.map(s => s.id));
  };

  const openCreateRoute = () => {
    setEditingRoute(null);
    setForm({ name: '', direction: 'go', vehicleId: vehicles[0]?.id ?? '', driverId: '', attendantId: '', arrivalTime: '10:55', notes: '' });
    setShowRouteModal(true);
  };

  const openEditRoute = (route: Route) => {
    setEditingRoute(route);
    setForm({ name: route.name, direction: route.direction as 'go', vehicleId: route.vehicleId, driverId: route.driverId, attendantId: route.attendantId, arrivalTime: route.arrivalTime, notes: route.notes });
    setShowRouteModal(true);
  };

  const handleSaveRoute = () => {
    if (!form.name) return;
    if (editingRoute) {
      updateRoute({ ...editingRoute, ...form });
    } else {
      addRoute({ id: `r-${Date.now()}`, velEnabled: false, ...form });
    }
    setShowRouteModal(false);
  };

  const handleAddStop = (routeId: string) => {
    if (!newStopMemberId) return;
    const stops = getStops(routeId);
    addRouteStop({
      id: `rs-${Date.now()}`,
      routeId,
      memberId: newStopMemberId,
      locationId: '',
      order: stops.length + 1,
      scheduledTime: '--:--',
    });
    setNewStopMemberId('');
    setShowAddStopModal(null);
  };

  const vehicleHeaderClass: Record<string, string> = {
    pink: 'bg-pink-500 text-white',
    blue: 'bg-blue-500 text-white',
    vel: 'bg-purple-500 text-white',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">ルートマスタ</h1>
        <button
          onClick={openCreateRoute}
          className="flex items-center gap-2 px-4 py-2 bg-pink-500 text-white rounded-lg text-sm font-medium hover:bg-pink-600 cursor-pointer transition-colors"
        >
          <Plus size={16} /> ルート追加
        </button>
      </div>

      {activeRoutes.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
          <Car size={40} className="mx-auto mb-3 opacity-30" />
          <p>ルートが登録されていません</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {activeRoutes.map(route => {
            const vehicle = getVehicle(route.vehicleId);
            const stops = getStops(route.id);
            const headerClass = vehicle ? (vehicleHeaderClass[vehicle.color] ?? 'bg-gray-500 text-white') : 'bg-gray-500 text-white';

            return (
              <div key={route.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Header */}
                <div className={`px-4 py-3 ${headerClass}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Car size={16} />
                      <span className="font-bold text-sm">{route.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEditRoute(route)} className="p-1 text-white/70 hover:text-white cursor-pointer rounded">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => deleteRoute(route.id)} className="p-1 text-white/70 hover:text-white cursor-pointer rounded">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="text-xs opacity-80 mt-1 flex gap-4">
                    <span className="flex items-center gap-1"><Clock size={11} /> 到着 {route.arrivalTime}</span>
                    <span>運転：{getStaffName(route.driverId)}</span>
                    <span>添乗：{getStaffName(route.attendantId)}</span>
                  </div>
                </div>

                {/* Sortable stops */}
                <div className="p-3">
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={e => handleDragEnd(e, route.id)}>
                    <SortableContext items={stops.map(s => s.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2 mb-3">
                        {stops.map(stop => (
                          <SortableStop
                            key={stop.id}
                            stop={stop}
                            memberName={getMember(stop.memberId)?.name ?? '不明'}
                            onDelete={deleteRouteStop}
                            onTimeEdit={(id, time) => {
                              const s = routeStops.find(rs => rs.id === id);
                              if (s) updateRouteStop({ ...s, manualTime: time });
                            }}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                  <button
                    onClick={() => { setShowAddStopModal(route.id); setNewStopMemberId(''); }}
                    className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-400 hover:border-pink-300 hover:text-pink-500 cursor-pointer transition-colors"
                  >
                    <Plus size={14} /> 利用者を追加
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Route Form Modal */}
      {showRouteModal && (
        <Modal title={editingRoute ? 'ルートを編集' : '新規ルート作成'} onClose={() => setShowRouteModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">ルート名 *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" placeholder="例：ピンク号 行き" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">車両</label>
                <select value={form.vehicleId} onChange={e => setForm(f => ({ ...f, vehicleId: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300">
                  <option value="">未設定</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">事業所到着時刻</label>
                <input type="time" value={form.arrivalTime} onChange={e => setForm(f => ({ ...f, arrivalTime: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">運転手</label>
                <select value={form.driverId} onChange={e => setForm(f => ({ ...f, driverId: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300">
                  <option value="">未設定</option>
                  {staff.filter(s => s.role !== 'attendant').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">添乗員</label>
                <select value={form.attendantId} onChange={e => setForm(f => ({ ...f, attendantId: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300">
                  <option value="">未設定</option>
                  {staff.filter(s => s.role !== 'driver').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">備考</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 resize-none" />
            </div>
            <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
              <button onClick={() => setShowRouteModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer">キャンセル</button>
              <button onClick={handleSaveRoute} disabled={!form.name} className="px-4 py-2 text-sm bg-pink-500 text-white rounded-lg hover:bg-pink-600 cursor-pointer disabled:opacity-50">保存</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Stop Modal */}
      {showAddStopModal && (
        <Modal title="利用者を追加" onClose={() => setShowAddStopModal(null)} size="sm">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">利用者</label>
              <select value={newStopMemberId} onChange={e => setNewStopMemberId(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300">
                <option value="">選択してください</option>
                {members.map(m => {
                  const already = getStops(showAddStopModal).some(s => s.memberId === m.id);
                  return <option key={m.id} value={m.id} disabled={already}>{m.name}{already ? '（登録済）' : ''}</option>;
                })}
              </select>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setShowAddStopModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer">キャンセル</button>
              <button onClick={() => handleAddStop(showAddStopModal)} disabled={!newStopMemberId} className="px-4 py-2 text-sm bg-pink-500 text-white rounded-lg hover:bg-pink-600 cursor-pointer disabled:opacity-50">追加</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
