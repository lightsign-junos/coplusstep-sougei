import { format } from 'date-fns';
import { Users } from 'lucide-react';
import { useDataStore } from '../store/dataStore';
import { getMemberSortKey } from '../lib/memberDisplay';
import type { Member } from '../types';

const WEEK_DAYS = ['月', '火', '水', '木', '金', '土'];

// 曜日ごとのアクセントカラー（ヘッダー帯・アバター・カウント）
const DAY_STYLE: Record<string, { bar: string; avatar: string; count: string; ring: string }> = {
  月: { bar: 'bg-rose-500',   avatar: 'bg-rose-100 text-rose-600',     count: 'bg-rose-50 text-rose-600',     ring: 'ring-rose-300' },
  火: { bar: 'bg-orange-500', avatar: 'bg-orange-100 text-orange-600', count: 'bg-orange-50 text-orange-600', ring: 'ring-orange-300' },
  水: { bar: 'bg-sky-500',    avatar: 'bg-sky-100 text-sky-600',       count: 'bg-sky-50 text-sky-600',       ring: 'ring-sky-300' },
  木: { bar: 'bg-emerald-500',avatar: 'bg-emerald-100 text-emerald-600', count: 'bg-emerald-50 text-emerald-600', ring: 'ring-emerald-300' },
  金: { bar: 'bg-amber-500',  avatar: 'bg-amber-100 text-amber-700',   count: 'bg-amber-50 text-amber-700',   ring: 'ring-amber-300' },
  土: { bar: 'bg-violet-500', avatar: 'bg-violet-100 text-violet-600', count: 'bg-violet-50 text-violet-600', ring: 'ring-violet-300' },
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

  const totalSlots = byDay.reduce((sum, d) => sum + d.list.length, 0);
  // ISO曜日(1=月〜7=日)を日本語ラベルへ
  const today = ['月', '火', '水', '木', '金', '土', '日'][Number(format(new Date(), 'i')) - 1];

  return (
    <div className="flex flex-col h-full">
      {/* ヘッダー */}
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">利用者シフト</h1>
          <p className="text-xs text-gray-400 mt-1">利用者マスタの利用日をもとに自動作成 ・ 週あたり延べ {totalSlots} 名</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
          <Users size={13} className="text-pink-500" />
          登録利用者 {members.length} 名
        </div>
      </div>

      {/* 曜日カラム */}
      <div className="grid grid-cols-6 gap-3 items-start">
        {byDay.map(({ day, list }) => {
          const s = DAY_STYLE[day];
          const isToday = day === today;
          return (
            <div
              key={day}
              className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col ${
                isToday ? `ring-2 ${s.ring}` : ''
              }`}
            >
              {/* カラーバー */}
              <div className={`h-1 ${s.bar}`} />

              {/* 曜日ヘッダー */}
              <div className="flex items-center justify-between px-3 pt-2.5 pb-2 border-b border-gray-50">
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-bold text-gray-800">{day}</span>
                  {isToday && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${s.count}`}>今日</span>
                  )}
                </div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${s.count}`}>
                  {list.length}名
                </span>
              </div>

              {/* 利用者リスト */}
              <div className="p-2 space-y-1">
                {list.length === 0 ? (
                  <p className="text-center text-xs text-gray-300 py-6">利用なし</p>
                ) : (
                  list.map(m => (
                    <div
                      key={m.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${s.avatar}`}
                      >
                        {m.name.charAt(0)}
                      </span>
                      <span className="text-[13px] font-medium text-gray-800 truncate">{m.name}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
