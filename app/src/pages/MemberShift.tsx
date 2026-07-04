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
  const {
    members, shiftAbsences, shiftExtras,
    markShiftAbsent, markShiftPresent, addShiftExtra, removeShiftExtra,
  } = useDataStore();
  const [monthBase, setMonthBase] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showExtraPicker, setShowExtraPicker] = useState(false);

  const sorted = [...members].sort((a, b) =>
    getMemberSortKey(a).localeCompare(getMemberSortKey(b), 'ja')
  );

  // その日の固定利用予定者（利用日未入力の人は毎日扱い・日曜は休み）
  const baseScheduledFor = (d: Date): Member[] => {
    const label = dayLabelOf(d);
    if (label === '日') return [];
    return sorted.filter(m => {
      const days = daysOf(m);
      return days.length === 0 || days.includes(label);
    });
  };

  // その日の振替・臨時利用者
  const extrasFor = (d: Date, base: Member[]): Member[] => {
    const dateStr = format(d, 'yyyy-MM-dd');
    const baseIds = new Set(base.map(m => m.id));
    return sorted.filter(m =>
      !baseIds.has(m.id) && shiftExtras.some(e => e.date === dateStr && e.memberId === m.id)
    );
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

  // 出勤/予定/稼働率の集計ヘルパー（予定 = 固定利用 + 振替）
  const dayStats = (d: Date) => {
    const base = baseScheduledFor(d);
    const extras = extrasFor(d, base);
    const scheduled = base.length + extras.length;
    const absent = base.filter(m => absentSetFor(format(d, 'yyyy-MM-dd')).has(m.id)).length;
    return { scheduled, absent, present: scheduled - absent };
  };
  const statsFor = (days: Date[]) => {
    let scheduled = 0;
    let absent = 0;
    for (const d of days) {
      if (!isSameMonth(d, monthBase) || dayLabelOf(d) === '日') continue;
      const st = dayStats(d);
      scheduled += st.scheduled;
      absent += st.absent;
    }
    const present = scheduled - absent;
    const rate = scheduled > 0 ? Math.round((present / scheduled) * 100) : null;
    return { scheduled, absent, present, rate };
  };

  // 月間サマリー（当月の営業日のみ）
  const monthStats = statsFor(gridDays);

  // モーダル用
  const selDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const selBase = selectedDate ? baseScheduledFor(selectedDate) : [];
  const selExtras = selectedDate ? extrasFor(selectedDate, selBase) : [];
  const selAbsent = absentSetFor(selDateStr);
  const selScheduledCount = selBase.length + selExtras.length;
  const selCandidates = selectedDate
    ? sorted.filter(m => !selBase.some(b => b.id === m.id) && !selExtras.some(e => e.id === m.id))
    : [];

  return (
    <div className="flex flex-col h-full">
      {/* ヘッダー */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">利用者シフト</h1>
          <p className="text-xs text-gray-400 mt-1">日付をクリックして出欠をつけます</p>
        </div>
        {/* 月間稼働率サマリー */}
        <div className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl px-4 py-2">
          <div className="text-center">
            <p className="text-[10px] text-gray-400 leading-tight">月間稼働率</p>
            <p className={`text-xl font-bold leading-tight tabular-nums ${
              monthStats.rate !== null && monthStats.rate < 90 ? 'text-red-500' : 'text-emerald-600'
            }`}>
              {monthStats.rate !== null ? `${monthStats.rate}%` : '―'}
            </p>
          </div>
          <div className="h-8 w-px bg-gray-100" />
          <div className="text-xs text-gray-500 leading-relaxed">
            <p>出勤 <span className="font-bold text-gray-800 tabular-nums">{monthStats.present}</span> ／ 予定 <span className="font-bold text-gray-800 tabular-nums">{monthStats.scheduled}</span></p>
            <p>欠勤 <span className={`font-bold tabular-nums ${monthStats.absent > 0 ? 'text-red-500' : 'text-gray-800'}`}>{monthStats.absent}</span> 件</p>
          </div>
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
        <div className="grid grid-cols-[repeat(7,1fr)_96px] border-b border-gray-200">
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
          <div className="py-1.5 text-center text-[11px] font-bold tracking-widest text-gray-500 bg-gray-100/80 border-l border-gray-200">
            週計
          </div>
        </div>
        <div className="flex-1 grid" style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))` }}>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-[repeat(7,1fr)_96px] border-b border-gray-100 last:border-b-0">
              {week.map(d => {
                const dateStr = format(d, 'yyyy-MM-dd');
                const inMonth = isSameMonth(d, monthBase);
                const isToday = dateStr === todayStr;
                const label = dayLabelOf(d);
                const isSunday = label === '日';
                const isSaturday = label === '土';
                const st = inMonth && !isSunday ? dayStats(d) : { scheduled: 0, absent: 0, present: 0 };
                const { scheduled: schedCount, absent, present } = st;
                const clickable = inMonth && !isSunday;

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
                        {schedCount > 0 && (
                          <span className={`ml-auto text-[11px] font-bold tabular-nums ${
                            absent > 0 ? 'text-red-500' : 'text-gray-300'
                          }`}>
                            {Math.round((present / schedCount) * 100)}%
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
              {/* 週計（当月の営業日のみ集計） */}
              {(() => {
                const ws = statsFor(week);
                return (
                  <div className="border-l border-gray-200 bg-gray-50/80 px-2 pt-1.5 pb-1 flex flex-col">
                    {ws.scheduled > 0 ? (
                      <>
                        <span className={`text-lg font-bold tabular-nums leading-tight ${
                          ws.rate !== null && ws.rate < 90 ? 'text-red-500' : 'text-gray-700'
                        }`}>
                          {ws.rate}%
                        </span>
                        <span className="mt-auto text-[10px] text-gray-400 tabular-nums leading-tight">
                          {ws.present}/{ws.scheduled}名
                        </span>
                        {ws.absent > 0 && (
                          <span className="text-[10px] text-red-500 font-semibold tabular-nums leading-tight">
                            欠 {ws.absent}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-[10px] text-gray-300">―</span>
                    )}
                  </div>
                );
              })()}
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
              <span>利用予定 {selScheduledCount} 名{selExtras.length > 0 && `（うち振替 ${selExtras.length}）`}</span>
              <span>
                <span className="text-emerald-600 font-semibold">出勤 {selScheduledCount - [...selAbsent].filter(id => selBase.some(b => b.id === id)).length}</span>
                <span className="mx-1">/</span>
                <span className={selAbsent.size > 0 ? 'text-red-500 font-semibold' : ''}>欠勤 {[...selAbsent].filter(id => selBase.some(b => b.id === id)).length}</span>
              </span>
            </div>
            {/* 固定利用者 */}
            {selBase.map(m => {
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

            {/* 振替・臨時利用者 */}
            {selExtras.map(m => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-violet-100 bg-violet-50/50"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-gray-800 truncate">{m.name}</span>
                  <span className="text-[10px] font-bold text-violet-600 bg-violet-100 rounded px-1.5 py-0.5 flex-shrink-0">振替</span>
                </span>
                <button
                  onClick={() => removeShiftExtra(selDateStr, m.id)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-400 bg-gray-100 hover:bg-red-50 hover:text-red-500 cursor-pointer transition-colors flex-shrink-0"
                >
                  取消
                </button>
              </div>
            ))}

            {/* 振替の追加 */}
            {!showExtraPicker ? (
              <button
                onClick={() => setShowExtraPicker(true)}
                className="w-full mt-1 px-3 py-2 rounded-xl border border-dashed border-violet-200 text-xs font-semibold text-violet-500 hover:bg-violet-50 cursor-pointer transition-colors"
              >
                ＋ 振替・臨時利用を追加
              </button>
            ) : (
              <div className="mt-1 border border-violet-100 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-1.5 bg-violet-50 text-[11px] font-semibold text-violet-600">
                  追加する利用者を選択
                  <button onClick={() => setShowExtraPicker(false)} className="text-violet-400 hover:text-violet-600 cursor-pointer">
                    <X size={13} />
                  </button>
                </div>
                <div className="max-h-40 overflow-y-auto">
                  {selCandidates.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-gray-400 text-center">追加できる利用者がいません</p>
                  ) : (
                    selCandidates.map(m => (
                      <button
                        key={m.id}
                        onClick={() => { addShiftExtra(selDateStr, m.id); setShowExtraPicker(false); }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-violet-50 cursor-pointer border-b border-gray-50 last:border-0"
                      >
                        {m.name}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
