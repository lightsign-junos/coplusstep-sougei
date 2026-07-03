import { useDataStore } from '../store/dataStore';
import { getMemberSortKey } from '../lib/memberDisplay';
import type { Member } from '../types';

const WEEK_DAYS = ['月', '火', '水', '木', '金', '土'];

const DAY_COLORS: Record<string, { header: string; badge: string }> = {
  月: { header: 'bg-red-50 text-red-700', badge: 'bg-red-100 text-red-700' },
  火: { header: 'bg-orange-50 text-orange-700', badge: 'bg-orange-100 text-orange-700' },
  水: { header: 'bg-sky-50 text-sky-700', badge: 'bg-sky-100 text-sky-700' },
  木: { header: 'bg-green-50 text-green-700', badge: 'bg-green-100 text-green-700' },
  金: { header: 'bg-amber-50 text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  土: { header: 'bg-violet-50 text-violet-700', badge: 'bg-violet-100 text-violet-700' },
};

// defaultDaysが文字列("月,火")のまま残っている古いデータにも対応
const daysOf = (m: Member): string[] =>
  Array.isArray(m.defaultDays)
    ? m.defaultDays
    : String(m.defaultDays ?? '').split(',').map(s => s.trim()).filter(Boolean);

export function MemberShift() {
  const { members } = useDataStore();

  const sorted = [...members].sort((a, b) =>
    getMemberSortKey(a).localeCompare(getMemberSortKey(b), 'ja')
  );

  const byDay = WEEK_DAYS.map(day => ({
    day,
    list: sorted.filter(m => daysOf(m).includes(day)),
  }));

  const maxRows = Math.max(...byDay.map(d => d.list.length), 1);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">利用者シフト</h1>
        <p className="text-xs text-gray-400">利用者マスタの利用日をもとに表示しています</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse table-fixed">
            <thead>
              <tr>
                {byDay.map(({ day, list }) => (
                  <th
                    key={day}
                    className={`border border-gray-200 px-2 py-2.5 text-center font-bold text-sm ${DAY_COLORS[day].header}`}
                  >
                    {day}
                    <span className="ml-1.5 text-[11px] font-medium opacity-70">{list.length}名</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: maxRows }, (_, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                  {byDay.map(({ day, list }) => {
                    const m = list[i];
                    return (
                      <td key={day} className="border border-gray-100 px-2 py-1.5 text-center">
                        {m ? (
                          <span className="text-gray-800 font-medium text-[13px]">{m.name}</span>
                        ) : (
                          <span className="text-gray-200">―</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
