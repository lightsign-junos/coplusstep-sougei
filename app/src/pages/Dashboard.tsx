import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Calendar, Users, Car, AlertTriangle, ChevronRight, UserX } from 'lucide-react';

import { useDataStore } from '../store/dataStore';
import { VehicleBadge, StatusBadge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';

const DAYS_JP = ['日', '月', '火', '水', '木', '金', '土'];

export function Dashboard() {
  const navigate = useNavigate();
  const { routes, routeStops, members, staff, vehicles, dailyOverrides, addDailyOverride } = useDataStore();
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const dayOfWeek = DAYS_JP[today.getDay()];

  const [showAbsentModal, setShowAbsentModal] = useState(false);
  const [absentMemberId, setAbsentMemberId] = useState('');
  const [absentRouteId, setAbsentRouteId] = useState('');

  // Today's overrides
  const todayOverrides = dailyOverrides.filter(o => o.date === todayStr);
  const todayAbsents = todayOverrides.filter(o => o.type === 'absent');

  // Active routes for today
  const activeRoutes = routes.filter(r => r.direction === 'go');

  // Stats
  const totalMembers = members.length;
  const activeVehicleCount = vehicles.filter(v => v.active && activeRoutes.some(r => r.vehicleId === v.id)).length;
  const absentCount = todayAbsents.length;

  // Get stops for a route
  const getStops = (routeId: string) =>
    routeStops
      .filter(rs => rs.routeId === routeId)
      .sort((a, b) => a.order - b.order);

  const getMember = (id: string) => members.find(m => m.id === id);
  const getStaffName = (id: string) => staff.find(s => s.id === id)?.name ?? '未設定';
  const getVehicle = (id: string) => vehicles.find(v => v.id === id);

  const handleAddAbsent = () => {
    if (!absentMemberId || !absentRouteId) return;
    addDailyOverride({
      id: `ov-${Date.now()}`,
      date: todayStr,
      type: 'absent',
      routeId: absentRouteId,
      memberId: absentMemberId,
      notes: '',
      createdAt: new Date().toISOString(),
    });
    setShowAbsentModal(false);
    setAbsentMemberId('');
    setAbsentRouteId('');
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
        <p className="text-sm text-gray-500 mt-1">
          {format(today, 'yyyy年M月d日', { locale: ja })}（{dayOfWeek}）
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {[
          { icon: Users, label: '利用者数', value: totalMembers, color: 'blue', sub: '登録済み' },
          { icon: Car, label: '稼働車両', value: activeVehicleCount, color: 'green', sub: '台' },
          { icon: UserX, label: '本日の欠席', value: absentCount, color: absentCount > 0 ? 'red' : 'gray', sub: '名' },
        ].map(({ icon: Icon, label, value, color, sub }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">{label}</p>
                <p className={`text-2xl font-bold mt-1 text-${color}-600`}>{value}</p>
                <p className="text-xs text-gray-400">{sub}</p>
              </div>
              <div className={`w-9 h-9 rounded-lg bg-${color}-50 flex items-center justify-center`}>
                <Icon size={18} className={`text-${color}-500`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={() => navigate('/daily')}
          className="flex items-center gap-2 px-4 py-2 bg-pink-500 text-white text-sm font-medium rounded-lg hover:bg-pink-600 cursor-pointer transition-colors"
        >
          <Calendar size={16} />
          日別送迎表を見る
        </button>
        <button
          onClick={() => setShowAbsentModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
        >
          <UserX size={16} />
          欠席を登録する
        </button>
      </div>

      {/* Today's routes — 3 vehicles fixed */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">本日の送迎ルート</h2>
          <button
            onClick={() => navigate('/daily')}
            className="flex items-center gap-1 text-xs text-pink-600 hover:text-pink-700 cursor-pointer"
          >
            詳細を見る <ChevronRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {vehicles.filter(v => v.active).map(vehicle => {
            const route = activeRoutes.find(r => r.vehicleId === vehicle.id);
            const stops = route ? getStops(route.id) : [];
            const absentIds = route
              ? todayAbsents.filter(o => o.routeId === route.id).map(o => o.memberId)
              : [];
            const presentCount = stops.filter(s => !absentIds.includes(s.memberId)).length;

            return (
              <div key={vehicle.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                {/* Colored header */}
                <div className={`vehicle-${vehicle.color}-header px-5 py-4`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Car size={20} />
                      <span className="text-lg font-bold">{vehicle.name}</span>
                    </div>
                    {route && (
                      <span className="text-sm font-semibold opacity-90">
                        到着 {route.arrivalTime}
                      </span>
                    )}
                  </div>
                  {route ? (
                    <div className="text-xs opacity-80 space-y-0.5">
                      <p>運転：{getStaffName(route.driverId)}</p>
                      <p>添乗：{getStaffName(route.attendantId)}</p>
                    </div>
                  ) : (
                    <p className="text-xs opacity-70">本日ルートなし</p>
                  )}
                </div>

                {/* Passenger count bar */}
                {route && (
                  <div className={`vehicle-${vehicle.color} px-5 py-2 border-b flex items-center justify-between`}>
                    <span className="text-xs font-medium text-gray-600">乗車人数</span>
                    <span className="text-sm font-bold text-gray-800">
                      {presentCount}名
                      {absentIds.length > 0 && (
                        <span className="ml-1.5 text-xs font-normal text-red-400">
                          （欠席{absentIds.length}名）
                        </span>
                      )}
                    </span>
                  </div>
                )}

                {/* Stop list */}
                <div className="p-4 flex-1">
                  {!route ? (
                    <div className="flex flex-col items-center justify-center py-6 text-gray-300">
                      <Car size={28} className="mb-2" />
                      <p className="text-sm">ルート未設定</p>
                    </div>
                  ) : stops.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">停車地点なし</p>
                  ) : (
                    <div className="space-y-2">
                      {stops.map((stop, i) => {
                        const member = getMember(stop.memberId);
                        const isAbsent = absentIds.includes(stop.memberId);
                        return (
                          <div
                            key={stop.id}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${isAbsent ? 'bg-red-50' : 'bg-gray-50'}`}
                          >
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isAbsent ? 'bg-red-200 text-red-500' : 'bg-gray-200 text-gray-500'}`}>
                              {i + 1}
                            </span>
                            <span className={`flex-1 text-sm font-medium ${isAbsent ? 'line-through text-red-300' : 'text-gray-800'}`}>
                              {member?.name ?? '不明'}
                            </span>
                            <span className="text-sm font-mono text-gray-500">{stop.scheduledTime}</span>
                            {isAbsent && <StatusBadge variant="absent" />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Today's notices */}
      {(todayOverrides.length > 0) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-yellow-600" />
            <h3 className="text-sm font-semibold text-yellow-800">本日の変更・欠席</h3>
          </div>
          <div className="space-y-2">
            {todayOverrides.map(o => {
              const member = getMember(o.memberId ?? '');
              return (
                <div key={o.id} className="flex items-center gap-2 text-sm text-yellow-800">
                  <StatusBadge variant={o.type === 'absent' ? 'absent' : 'changed'} />
                  <span>{member?.name ?? '不明'}</span>
                  {o.notes && <span className="text-yellow-600 text-xs">({o.notes})</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Absent Modal */}
      {showAbsentModal && (
        <Modal title="欠席登録" onClose={() => setShowAbsentModal(false)} size="sm">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">ルート</label>
              <select
                value={absentRouteId}
                onChange={e => setAbsentRouteId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
              >
                <option value="">選択してください</option>
                {activeRoutes.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">欠席者</label>
              <select
                value={absentMemberId}
                onChange={e => setAbsentMemberId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                disabled={!absentRouteId}
              >
                <option value="">選択してください</option>
                {absentRouteId && getStops(absentRouteId).map(s => {
                  const m = getMember(s.memberId);
                  return <option key={s.memberId} value={s.memberId}>{m?.name}</option>;
                })}
              </select>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setShowAbsentModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer">キャンセル</button>
              <button
                onClick={handleAddAbsent}
                disabled={!absentMemberId || !absentRouteId}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                欠席登録
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
