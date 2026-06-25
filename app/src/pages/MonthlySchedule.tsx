import { useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isToday, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Car } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDataStore } from '../store/dataStore';
import { VehicleBadge } from '../components/common/Badge';

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

export function MonthlySchedule() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const navigate = useNavigate();
  const { routes, routeStops, dailyOverrides, vehicles } = useDataStore();

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days: Date[] = [];
  let d = calStart;
  while (d <= calEnd) {
    days.push(d);
    d = addDays(d, 1);
  }

  const getDateOverrides = (dateStr: string) =>
    dailyOverrides.filter(o => o.date === dateStr);

  const getActiveRoutes = (dateStr: string) => {
    const date = parseISO(dateStr);
    void date;
    return routes.filter(r => r.direction === 'go');
  };

  const getVehicle = (id: string) => vehicles.find(v => v.id === id);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">月別シフト</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-base font-semibold text-gray-900 min-w-[100px] text-center">
            {format(currentMonth, 'yyyy年M月', { locale: ja })}
          </span>
          <button
            onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {WEEKDAY_LABELS.map((label, i) => (
            <div
              key={label}
              className={`py-2 text-center text-xs font-semibold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}`}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const inMonth = isSameMonth(day, currentMonth);
            const todayFlag = isToday(day);
            const overrides = getDateOverrides(dateStr);
            const activeRoutes = getActiveRoutes(dateStr);
            const dow = day.getDay();
            const isSun = dow === 0;
            const isSat = dow === 6;

            return (
              <div
                key={idx}
                onClick={() => {
                  if (inMonth) navigate(`/daily?date=${dateStr}`);
                }}
                className={`min-h-[100px] border-r border-b border-gray-100 p-1.5 cursor-pointer transition-colors ${
                  !inMonth ? 'bg-gray-50 opacity-40' : 'hover:bg-gray-50'
                }`}
              >
                {/* Date number */}
                <div className="flex items-center justify-end mb-1">
                  <span
                    className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold ${
                      todayFlag
                        ? 'bg-pink-500 text-white'
                        : isSun
                        ? 'text-red-500'
                        : isSat
                        ? 'text-blue-500'
                        : 'text-gray-600'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                </div>

                {/* Routes for this day */}
                {inMonth && activeRoutes.slice(0, 2).map(route => {
                  const vehicle = getVehicle(route.vehicleId);
                  const stops = routeStops.filter(rs => rs.routeId === route.id);
                  return (
                    <div key={route.id} className="mb-1">
                      <div className={`rounded px-1 py-0.5 text-xs flex items-center gap-1 ${
                        vehicle?.color === 'pink' ? 'bg-pink-100 text-pink-700' :
                        vehicle?.color === 'blue' ? 'bg-blue-100 text-blue-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        <Car size={10} />
                        <span className="truncate">{vehicle?.name} {stops.length}名</span>
                      </div>
                    </div>
                  );
                })}

                {/* Override indicators */}
                {overrides.length > 0 && (
                  <div className="mt-1">
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-1 py-0.5 rounded">
                      変更{overrides.length}件
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 text-xs text-gray-500">
        {vehicles.filter(v => v.active).map(v => (
          <div key={v.id} className="flex items-center gap-1.5">
            <VehicleBadge color={v.color} name={v.name} />
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">変更あり</span>
        </div>
      </div>
    </div>
  );
}
