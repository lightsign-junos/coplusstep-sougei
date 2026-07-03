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
  const todayStr = format(new Date(), 'yyyy-MM-dd');

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
          <p className="text-xs text-gray-400 mt-1">日付をクリックすると出欠を管理できます（利用者マスタの利用日をもとに自動作成）</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonthBase(m => subMonths(m, 1))} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
            <ChevronLeft size={16} />
          </button>
          <span className="text-base font-bold text-gray-800 min-w-[110px] text-center">
            {format(monthBase, 'yyyy年M月', { locale: ja })}
          </span>
          <button onClick={() => setMonthBase(m => addMonths(m, 1))} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
            <ChevronRight size={16} />
          </button>
          <button onClick={() => setMonthBase(new Date())} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            今月
          </button>
        </div>
      </div>

      {/* カレンダー */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-100">
          {['月', '火', '水', '木', '金', '土', '日'].map(d => (
            <div key={d} className={`py-2 text-center text-xs font-bold ${d === '土' ? 'text-blue-500' : d === '日' ? 'text-red-400' : 'text-gray-500'}`}>
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {gridDays.map(d => {
            const dateStr = format(d, 'yyyy-MM-dd');
            const inMonth = isSameMonth(d, monthBase);
            const isToday = dateStr === todayStr;
            const isSunday = dayLabelOf(d) === '日';
            const scheduled = scheduledFor(d);
            const absent = scheduled.filter(m => absentSetFor(dateStr).has(m.id)).length;
            const present = scheduled.length - absent;
            const clickable = inMonth && !isSunday && scheduled.length > 0;
            return (
              <button
                key={dateStr}
                onClick={clickable ? () => setSelectedDate(d) : undefined}
                className={`h-[88px] border-b border-r border-gray-100 p-1.5 flex flex-col items-start text-left transition-colors ${
                  !inMonth ? 'bg-gray-50/60' : isSunday ? 'bg-gray-50/40' : 'bg-white'
                } ${clickable ? 'cursor-pointer hover:bg-pink-50/50' : 'cursor-default'}`}
              >
                <span
                  className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday ? 'bg-pink-500 text-white' : !inMonth ? 'text-gray-300' : isSunday ? 'text-red-300' : 'text-gray-600'
                  }`}
                >
                  {format(d, 'd')}
                </span>
                {inMonth && !isSunday && scheduled.length > 0 && (
                  <div className="mt-1 space-y-0.5 w-full">
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                      出勤 {present} 名
                    </div>
                    <div className={`flex items-center gap-1 text-[11px] font-semibold ${absent > 0 ? 'text-red-500' : 'text-gray-300'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${absent > 0 ? 'bg-red-400' : 'bg-gray-200'}`} />
                      欠勤 {absent} 名
                    </div>
                  </div>
                )}
                {inMonth && isSunday && (
                  <span className="mt-1 text-[10px] text-gray-300">休業</span>
                )}
              </button>
            );
          })}
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
