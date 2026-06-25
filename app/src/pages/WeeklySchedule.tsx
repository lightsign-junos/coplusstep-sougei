import { useState } from 'react';
import { format, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Printer, Car } from 'lucide-react';
import { useDataStore } from '../store/dataStore';

const WEEK_DAYS: { label: string; idx: number }[] = [
  { label: '月', idx: 1 },
  { label: '火', idx: 2 },
  { label: '水', idx: 3 },
  { label: '木', idx: 4 },
  { label: '金', idx: 5 },
  { label: '土', idx: 6 },
];

export function WeeklySchedule() {
  const { vehicles, routes, routeStops, members, staff, dailyOverrides } = useDataStore();
  const [weekBase, setWeekBase] = useState(new Date());

  const weekStart = startOfWeek(weekBase, { weekStartsOn: 1 }); // Monday

  // Build array of Mon–Sat dates
  const weekDates = WEEK_DAYS.map(d => ({
    ...d,
    date: addDays(weekStart, d.idx - 1),
    dateStr: format(addDays(weekStart, d.idx - 1), 'yyyy-MM-dd'),
  }));

  const goRoutes = routes.filter(r => r.direction === 'go');

  const getStops = (routeId: string) =>
    routeStops.filter(rs => rs.routeId === routeId).sort((a, b) => a.order - b.order);

  const getMember = (id: string) => members.find(m => m.id === id);
  const getStaffName = (id: string) => staff.find(s => s.id === id)?.name ?? '未設定';

  const isAbsent = (dateStr: string, memberId: string, routeId: string) =>
    dailyOverrides.some(
      o => o.date === dateStr && o.memberId === memberId && o.routeId === routeId && o.type === 'absent'
    );

  const today = format(new Date(), 'yyyy-MM-dd');

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5 no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">週次送迎表</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {format(weekDates[0].date, 'M月d日', { locale: ja })}（月）〜
            {format(weekDates[5].date, 'M月d日', { locale: ja })}（土）
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekBase(w => subWeeks(w, 1))}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => setWeekBase(new Date())}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
          >
            今週
          </button>
          <button
            onClick={() => setWeekBase(w => addWeeks(w, 1))}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer"
          >
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
      <div className="hidden print-block mb-4">
        <h1 className="text-xl font-bold">コプラスステップ 昭和島教室 週次送迎表</h1>
        <p className="text-sm">
          {format(weekDates[0].date, 'yyyy年M月d日', { locale: ja })}（月）〜
          {format(weekDates[5].date, 'M月d日', { locale: ja })}（土）
        </p>
      </div>

      {/* Vehicle sections */}
      <div className="space-y-6">
        {vehicles.filter(v => v.active).map(vehicle => {
          const route = goRoutes.find(r => r.vehicleId === vehicle.id);
          const stops = route ? getStops(route.id) : [];

          return (
            <div key={vehicle.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Vehicle header */}
              <div className={`vehicle-${vehicle.color}-header px-5 py-3 flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                  <Car size={18} />
                  <span className="font-bold text-base">{vehicle.name}</span>
                  {route && (
                    <span className="text-xs opacity-80 ml-2">
                      到着 {route.arrivalTime}
                      運転：{getStaffName(route.driverId)}
                      添乗：{getStaffName(route.attendantId)}
                    </span>
                  )}
                </div>
                {!route && <span className="text-xs opacity-70">ルート未設定</span>}
              </div>

              {/* Schedule table */}
              {!route || stops.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm">
                  {!route ? 'ルートが登録されていません' : '停車地点がありません'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={`vehicle-${vehicle.color}`}>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-600 w-28">利用者</th>
                        {weekDates.map(d => (
                          <th
                            key={d.label}
                            className={`text-center px-3 py-2.5 font-medium w-24 ${
                              d.dateStr === today ? 'text-pink-600' : 'text-gray-600'
                            } ${d.label === '土' ? 'text-blue-500' : ''}`}
                          >
                            <div>{d.label}</div>
                            <div className="text-xs font-normal">
                              {format(d.date, 'M/d', { locale: ja })}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stops.map((stop, i) => {
                        const member = getMember(stop.memberId);
                        if (!member) return null;
                        return (
                          <tr key={stop.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-2.5 font-medium text-gray-800 border-r border-gray-100">
                              <div>{member.name}</div>
                              <div className="text-xs text-gray-400 font-normal">{stop.scheduledTime}</div>
                            </td>
                            {weekDates.map(d => {
                              const comesThisDay = member.defaultDays.includes(d.label);
                              const absent = isAbsent(d.dateStr, stop.memberId, route.id);
                              const isToday = d.dateStr === today;

                              return (
                                <td
                                  key={d.label}
                                  className={`text-center px-3 py-2.5 border-r border-gray-100 last:border-r-0 ${
                                    isToday ? 'bg-pink-50' : ''
                                  }`}
                                >
                                  {absent ? (
                                    <span className="inline-flex items-center justify-center w-14 h-7 rounded-full bg-red-100 text-red-500 text-xs font-bold">
                                      欠席
                                    </span>
                                  ) : comesThisDay ? (
                                    <span className="font-mono text-gray-800 text-sm font-medium">
                                      {stop.scheduledTime}
                                    </span>
                                  ) : (
                                    <span className="text-gray-300">―</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
