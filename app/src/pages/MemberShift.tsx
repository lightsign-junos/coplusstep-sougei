import { useState } from 'react';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, addMonths, subMonths, isSameMonth,
} from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react';
import { useDataStore } from '../store/dataStore';
import { getMemberSortKey } from '../lib/memberDisplay';
import { Modal } from '../components/common/Modal';
import type { Member } from '../types';

// ISO曜日(1=月〜7=日) → 日本語ラベル
const dayLabelOf = (d: Date) => ['月', '火', '水', '木', '金', '土', '日'][Number(format(d, 'i')) - 1];

// defaultDaysが文字列("月,火")のまま残っている古いデータにも対応
const daysOf = (m: Member): string[] =>
  Array.isArray(m.defaultDays)
    ? m.defaultDays
    : String(m.defaultDays ?? '').split(',').map(s => s.trim()).filter(Boolean);

export function MemberShift() {
  const { members, shiftAbsences, markShiftAbsent, markShiftPresent } = useDataStore();
  const [monthBase, setMonthBase] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const sorted = [...members].sort((a, b) =>
    getMemberSortKey(a).localeCompare(getMemberSortKey(b), 'ja')
  );

  // その日の利用予定者（利用日未入力の人は毎日扱い・日曜は休み）
  const scheduledFor = (d: Date): Member[] => {
    const label = dayLabelOf(d);
    if (label === '日') return [];
    return sorted.filter(m => {
      const days = daysOf(m);
      return days.length === 0 || days.includes(label);
    });
  };

  const absentSetFor = (dateStr: string) =>
    new Set(shiftAbsences.filter(a => a.date === dateStr).map(a => a.memberId));

  // カレンダーのマス（月曜始まり）
  const monthStart = startOfMonth(monthBase);
  const gridDays = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(monthBase), { weekStartsOn: 1 }),
  });
  const weeks: Date[][] = [];
  for (let i = 0; i < gridDays.length; i += 7) weeks.push(gridDays.slice(i, i + 7));
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // 月間サマリー（当月の営業日のみ）
  const monthDays = gridDays.filter(d => isSameMonth(d, monthBase) && dayLabelOf(d) !== '日');
  const monthAbsences = monthDays.reduce(
    (sum, d) => sum + scheduledFor(d).filter(m => absentSetFor(format(d, 'yyyy-MM-dd')).has(m.id)).length,
    0
  );

  // モーダル用
  const selDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const selScheduled = selectedDate ? scheduledFor(selectedDate) : [];
  const selAbsent = absentSetFor(selDateStr);

  return (
    <div className="flex flex-col h-full">
      {/* ヘッダー */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">利用者シフト</h1>
          <p className="text-xs text-gray-400 mt-1">
            日付をクリックして出欠をつけます ・ 今月の欠勤 {monthAbsences} 件
          </p>
        </div>
        <div className="flex items-center bg-white border border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setMonthBase(m => subMonths(m, 1))}
            className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-r border-gray-100"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="px-4 text-sm font-bold text-gray-800 tabular-nums min-w-[104px] text-center">
            {format(monthBase, 'yyyy年 M月', { locale: ja })}
          </span>
          <button
            onClick={() => setMonthBase(m => addMonths(m, 1))}
            className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-l border-gray-100"
          >
            <ChevronRight size={15} />
          </button>
          <button
            onClick={() => setMonthBase(new Date())}
            className="px-3 py-2 text-xs font-medium text-pink-600 hover:bg-pink-50 cursor-pointer border-l border-gray-100"
          >
            今月
          </button>
        </div>
      </div>

      {/* カレンダー */}
      <div
        className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col"
        style={{ height: 'calc(100vh - 150px)' }}
      >
        <div className="grid grid-cols-7 border-b border-gray-200">
          {['月', '火', '水', '木', '金', '土', '日'].map(d => (
            <div
              key={d}
              className={`py-1.5 text-center text-[11px] font-bold tracking-widest ${
                d === '土' ? 'text-sky-600 bg-sky-50/60' : d === '日' ? 'text-gray-300 bg-gray-50' : 'text-gray-400'
              }`}
            >
              {d}
            </div>
          ))}
        </div>
        <div className="flex-1 grid" style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))` }}>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-gray-100 last:border-b-0">
              {week.map(d => {
                const dateStr = format(d, 'yyyy-MM-dd');
                const inMonth = isSameMonth(d, monthBase);
                const isToday = dateStr === todayStr;
                const label = dayLabelOf(d);
                const isSunday = label === '日';
                const isSaturday = label === '土';
                const scheduled = inMonth ? scheduledFor(d) : [];
                const absent = scheduled.filter(m => absentSetFor(dateStr).has(m.id)).length;
                const present = scheduled.length - absent;
                const clickable = inMonth && !isSunday && scheduled.length > 0;

                if (!inMonth) {
                  return <div key={dateStr} className="border-r border-gray-100 last:border-r-0 bg-gray-50/50" />;
                }
                return (
                  <button
                    key={dateStr}
                    onClick={clickable ? () => setSelectedDate(d) : undefined}
                    className={`relative border-r border-gray-100 last:border-r-0 px-2 pt-1.5 pb-1 text-left flex flex-col transition-colors ${
                      isSunday ? 'bg-gray-50 cursor-default'
                      : isSaturday ? 'bg-sky-50/40 cursor-pointer hover:bg-sky-50'
                      : 'bg-white cursor-pointer hover:bg-pink-50/40'
                    }`}
                  >
                    {/* 今日マーカー（左端の縦バー） */}
                    {isToday && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-pink-500" />}

                    <div className="flex items-baseline justify-between">
                      <span className={`text-[13px] font-bold tabular-nums ${
                        isToday ? 'text-pink-600' : isSunday ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        {format(d, 'd')}
                      </span>
                      {/* 欠勤がある日だけ右上に赤バッジ */}
                      {absent > 0 && (
                        <span className="text-[10px] font-bold text-red-500 bg-red-50 rounded px-1 tabular-nums">
                          欠 {absent}
                        </span>
                      )}
                    </div>

                    {isSunday ? (
                      <span className="mt-1.5 text-[10px] text-gray-300">休業</span>
                    ) : (
                      <div className="mt-1.5 flex items-baseline gap-1">
                        <span className={`text-xl font-bold tabular-nums leading-none ${
                          absent > 0 ? 'text-gray-800' : 'text-gray-700'
                        }`}>
                          {present}
                        </span>
                        <span className="text-[10px] text-gray-400">名 出勤</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* 出欠管理モーダル */}
      {selectedDate && (
        <Modal
          title={`${format(selectedDate, 'M月d日（EEEEE）', { locale: ja })}の出欠`}
          onClose={() => setSelectedDate(null)}
          size="sm"
        >
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
            <div className="flex items-center justify-between px-1 pb-2 text-xs text-gray-400">
              <span>利用予定 {selScheduled.length} 名</span>
              <span>
                <span className="text-emerald-600 font-semibold">出勤 {selScheduled.length - selAbsent.size}</span>
                <span className="mx-1">/</span>
                <span className={selAbsent.size > 0 ? 'text-red-500 font-semibold' : ''}>欠勤 {selAbsent.size}</span>
              </span>
            </div>
            {selScheduled.map(m => {
              const isAbsent = selAbsent.has(m.id);
              return (
                <div
                  key={m.id}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border transition-colors ${
                    isAbsent ? 'border-red-100 bg-red-50/50' : 'border-gray-100 bg-white'
                  }`}
                >
                  <span className={`text-sm font-medium truncate ${isAbsent ? 'text-red-400 line-through' : 'text-gray-800'}`}>
                    {m.name}
                  </span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => markShiftPresent(selDateStr, m.id)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                        !isAbsent
                          ? 'bg-emerald-500 text-white'
                          : 'bg-gray-100 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600'
                      }`}
                    >
                      <Check size={12} /> 出勤
                    </button>
                    <button
                      onClick={() => markShiftAbsent(selDateStr, m.id)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                        isAbsent
                          ? 'bg-red-500 text-white'
                          : 'bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500'
                      }`}
                    >
                      <X size={12} /> 欠勤
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Modal>
      )}
    </div>
  );
}
