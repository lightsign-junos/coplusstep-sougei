import { useState, useRef } from 'react';
import { format, parseISO, addDays, subDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Printer, UserX, RefreshCw, Car } from 'lucide-react';
import { useDataStore } from '../store/dataStore';
import { VehicleBadge, StatusBadge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import type { Vehicle } from '../types';

const DAYS_JP = ['日', '月', '火', '水', '木', '金', '土'];

export function DailyRoute() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(today);
  const [showAbsentModal, setShowAbsentModal] = useState(false);
  const [absentMemberId, setAbsentMemberId] = useState('');
  const [absentRouteId, setAbsentRouteId] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  const { routes, routeStops, members, staff, vehicles, dailyOverrides, addDailyOverride, removeDailyOverride } = useDataStore();

  const activeRoutes = routes.filter(r => r.direction === 'go');
  const todayOverrides = dailyOverrides.filter(o => o.date === selectedDate);
  const absentIds = todayOverrides.filter(o => o.type === 'absent').map(o => o.memberId);

  const getStops = (routeId: string) =>
    routeStops.filter(rs => rs.routeId === routeId).sort((a, b) => a.order - b.order);

  const getMember = (id: string) => members.find(m => m.id === id);
  const getStaffName = (id: string) => staff.find(s => s.id === id)?.name ?? '未設定';
  const getVehicle = (id: string) => vehicles.find(v => v.id === id);

  const dateObj = parseISO(selectedDate);
  const dayLabel = DAYS_JP[dateObj.getDay()];

  const handleAddAbsent = () => {
    if (!absentMemberId || !absentRouteId) return;
    addDailyOverride({
      id: `ov-${Date.now()}`,
      date: selectedDate,
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

  const handlePrint = () => window.print();

  const getVehicleHeaderClass = (v?: Vehicle) => {
    if (!v) return 'bg-gray-500 text-white';
    const cls: Record<string, string> = {
      pink: 'bg-pink-500 text-white',
      blue: 'bg-blue-500 text-white',
      vel: 'bg-purple-500 text-white',
    };
    return cls[v.color] ?? 'bg-gray-500 text-white';
  };

  const getVehicleBgClass = (v?: Vehicle) => {
    if (!v) return 'bg-gray-50 border-gray-200';
    const cls: Record<string, string> = {
      pink: 'bg-pink-50 border-pink-200',
      blue: 'bg-blue-50 border-blue-200',
      vel: 'bg-purple-50 border-purple-200',
    };
    return cls[v.color] ?? 'bg-gray-50 border-gray-200';
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 no-print">
        <h1 className="text-2xl font-bold text-gray-900">日別送迎表</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAbsentModal(true)} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors">
            <UserX size={16} /> 欠席登録
          </button>
          <button onClick={handlePrint} className="flex items-center gap-2 px-3 py-2 bg-pink-500 text-white rounded-lg text-sm hover:bg-pink-600 cursor-pointer transition-colors">
            <Printer size={16} /> 印刷
          </button>
        </div>
      </div>

      {/* Date nav */}
      <div className="flex items-center gap-3 mb-6 no-print">
        <button onClick={() => setSelectedDate(format(subDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
          />
          <span className="text-sm font-semibold text-gray-700">
            ({dayLabel})
          </span>
        </div>
        <button onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
          <ChevronRight size={16} />
        </button>
        {selectedDate !== today && (
          <button onClick={() => setSelectedDate(today)} className="flex items-center gap-1 px-3 py-2 text-sm text-pink-600 border border-pink-200 rounded-lg hover:bg-pink-50 cursor-pointer">
            <RefreshCw size={14} /> 今日
          </button>
        )}
      </div>

      {/* Overrides notice */}
      {todayOverrides.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4 no-print">
          <p className="text-sm font-semibold text-yellow-800 mb-2">当日変更・欠席あり</p>
          <div className="flex flex-wrap gap-2">
            {todayOverrides.map(o => {
              const m = getMember(o.memberId ?? '');
              return (
                <div key={o.id} className="flex items-center gap-2 bg-white border border-yellow-200 rounded-lg px-3 py-1.5 text-sm">
                  <StatusBadge variant={o.type === 'absent' ? 'absent' : 'changed'} />
                  <span className="text-gray-800">{m?.name}</span>
                  <button onClick={() => removeDailyOverride(o.id)} className="text-gray-400 hover:text-red-500 cursor-pointer text-xs ml-1">✕</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Print header */}
      <div className="print-block text-center mb-6">
        <h2 className="text-xl font-bold">コプラスステップ 昭和島教室 送迎表</h2>
        <p className="text-base">{format(dateObj, 'yyyy年M月d日', { locale: ja })}（{dayLabel}）</p>
      </div>

      {/* Route cards */}
      <div ref={printRef} className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {activeRoutes.length === 0 ? (
          <div className="col-span-3 bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
            <Car size={40} className="mx-auto mb-3 opacity-30" />
            <p>ルートが登録されていません</p>
            <p className="text-xs mt-1">ルートマスタからルートを追加してください</p>
          </div>
        ) : (
          activeRoutes.map(route => {
            const vehicle = getVehicle(route.vehicleId);
            const stops = getStops(route.id);
            const presentStops = stops.filter(s => !absentIds.includes(s.memberId));

            return (
              <div key={route.id} className={`rounded-xl border overflow-hidden shadow-sm ${getVehicleBgClass(vehicle)}`}>
                {/* Card Header */}
                <div className={`px-4 py-3 ${getVehicleHeaderClass(vehicle)}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Car size={16} />
                      <span className="font-bold text-sm">{route.name}</span>
                    </div>
                    <span className="text-xs font-mono bg-white/20 px-2 py-0.5 rounded">到着 {route.arrivalTime}</span>
                  </div>
                  <div className="text-xs opacity-90 mt-1 flex gap-4">
                    <span>運転：{getStaffName(route.driverId)}</span>
                    <span>添乗：{getStaffName(route.attendantId)}</span>
                  </div>
                  <div className="mt-1 flex gap-2">
                    <VehicleBadge color={vehicle?.color ?? 'pink'} name={`乗車 ${presentStops.length}名`} />
                    {stops.length !== presentStops.length && (
                      <span className="text-xs bg-white/30 px-2 py-0.5 rounded-full">欠席 {stops.length - presentStops.length}名</span>
                    )}
                  </div>
                </div>

                {/* Stops */}
                <div className="p-3 bg-white/70">
                  {stops.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">停車地点が設定されていません</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 border-b border-gray-200">
                          <th className="text-left pb-2 w-8">順</th>
                          <th className="text-left pb-2">氏名</th>
                          <th className="text-right pb-2 font-mono">時刻</th>
                          <th className="text-right pb-2 w-12">状態</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stops.map((stop, i) => {
                          const member = getMember(stop.memberId);
                          const isAbsent = absentIds.includes(stop.memberId);
                          return (
                            <tr key={stop.id} className={`border-b border-gray-100 last:border-0 ${isAbsent ? 'opacity-50' : ''}`}>
                              <td className="py-2">
                                <span className="w-5 h-5 rounded-full bg-gray-100 inline-flex items-center justify-center text-xs font-bold text-gray-500">
                                  {i + 1}
                                </span>
                              </td>
                              <td className={`py-2 font-medium ${isAbsent ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                {member?.name ?? '不明'}
                              </td>
                              <td className="py-2 text-right font-mono text-gray-600">
                                {stop.manualTime ?? stop.scheduledTime}
                              </td>
                              <td className="py-2 text-right">
                                {isAbsent && <StatusBadge variant="absent" />}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Absent Modal */}
      {showAbsentModal && (
        <Modal title="欠席登録" onClose={() => setShowAbsentModal(false)} size="sm">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">ルート</label>
              <select value={absentRouteId} onChange={e => setAbsentRouteId(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300">
                <option value="">選択してください</option>
                {activeRoutes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">欠席者</label>
              <select value={absentMemberId} onChange={e => setAbsentMemberId(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" disabled={!absentRouteId}>
                <option value="">選択してください</option>
                {absentRouteId && getStops(absentRouteId).map(s => {
                  const m = getMember(s.memberId);
                  return <option key={s.memberId} value={s.memberId}>{m?.name}</option>;
                })}
              </select>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setShowAbsentModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer">キャンセル</button>
              <button onClick={handleAddAbsent} disabled={!absentMemberId || !absentRouteId} className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                欠席登録
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
