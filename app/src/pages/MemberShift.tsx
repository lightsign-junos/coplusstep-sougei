import { useState } from 'react';
import { format } from 'date-fns';
import { Users, Printer, X } from 'lucide-react';
import { useDataStore } from '../store/dataStore';
import { getMemberSortKey } from '../lib/memberDisplay';
import type { Member } from '../types';

const WEEK_DAYS = ['月', '火', '水', '木', '金', '土'];

// 曜日ごとのアクセントカラー
const DAY_STYLE: Record<string, { bar: string; avatar: string; count: string; ring: string; selBg: string; selText: string }> = {
  月: { bar: 'bg-rose-500',    avatar: 'bg-rose-100 text-rose-600',       count: 'bg-rose-50 text-rose-600',       ring: 'ring-rose-300',    selBg: 'bg-rose-50 ring-1 ring-rose-300',       selText: 'text-rose-700' },
  火: { bar: 'bg-orange-500',  avatar: 'bg-orange-100 text-orange-600',   count: 'bg-orange-50 text-orange-600',   ring: 'ring-orange-300',  selBg: 'bg-orange-50 ring-1 ring-orange-300',   selText: 'text-orange-700' },
  水: { bar: 'bg-sky-500',     avatar: 'bg-sky-100 text-sky-600',         count: 'bg-sky-50 text-sky-600',         ring: 'ring-sky-300',     selBg: 'bg-sky-50 ring-1 ring-sky-300',         selText: 'text-sky-700' },
  木: { bar: 'bg-emerald-500', avatar: 'bg-emerald-100 text-emerald-600', count: 'bg-emerald-50 text-emerald-600', ring: 'ring-emerald-300', selBg: 'bg-emerald-50 ring-1 ring-emerald-300', selText: 'text-emerald-700' },
  金: { bar: 'bg-amber-500',   avatar: 'bg-amber-100 text-amber-700',     count: 'bg-amber-50 text-amber-700',     ring: 'ring-amber-300',   selBg: 'bg-amber-50 ring-1 ring-amber-400',     selText: 'text-amber-700' },
  土: { bar: 'bg-violet-500',  avatar: 'bg-violet-100 text-violet-600',   count: 'bg-violet-50 text-violet-600',   ring: 'ring-violet-300',  selBg: 'bg-violet-50 ring-1 ring-violet-300',   selText: 'text-violet-700' },
};

// defaultDaysが文字列("月,火")のまま残っている古いデータにも対応
const daysOf = (m: Member): string[] =>
  Array.isArray(m.defaultDays)
    ? m.defaultDays
    : String(m.defaultDays ?? '').split(',').map(s => s.trim()).filter(Boolean);

export function MemberShift() {
  const { members } = useDataStore();
  // クリックした利用者を全曜日で追跡ハイライト
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const sorted = [...members].sort((a, b) =>
    getMemberSortKey(a).localeCompare(getMemberSortKey(b), 'ja')
  );

  // 利用日未入力の人は毎日表示する
  const byDay = WEEK_DAYS.map(day => ({
    day,
    list: sorted.filter(m => {
      const days = daysOf(m);
      return days.length === 0 || days.includes(day);
    }),
  }));

  const totalSlots = byDay.reduce((sum, d) => sum + d.list.length, 0);
  const maxCount = Math.max(...byDay.map(d => d.list.length), 1);
  // ISO曜日(1=月〜7=日)を日本語ラベルへ
  const today = ['月', '火', '水', '木', '金', '土', '日'][Number(format(new Date(), 'i')) - 1];

  const selected = selectedId ? members.find(m => m.id === selectedId) : null;
  const selectedDays = selected ? WEEK_DAYS.filter(d => daysOf(selected).includes(d)) : [];
  const activeId = selectedId ?? hoverId;

  const handleChipClick = (id: string) => setSelectedId(cur => (cur === id ? null : id));

  return (
    <div className="flex flex-col h-full">
      {/* ヘッダー */}
      <div className="flex items-end justify-between mb-5 no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">利用者シフト</h1>
          <p className="text-xs text-gray-400 mt-1">
            利用者マスタの利用日をもとに自動作成 ・ 名前をクリックすると利用曜日をまとめて確認できます
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
            <Users size={13} className="text-pink-500" />
            登録 {members.length} 名 ・ 週延べ {totalSlots} 名
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-800 text-white rounded-lg hover:bg-gray-700 cursor-pointer transition-colors"
          >
            <Printer size={13} /> 印刷
          </button>
        </div>
      </div>

      {/* 印刷用タイトル */}
      <div className="hidden print-block mb-3">
        <h2 className="text-lg font-bold text-center">コプラスステップ 昭和島教室　利用者シフト</h2>
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
              <div className={`h-1 ${s.bar}`} />

              {/* 曜日ヘッダー */}
              <div className="px-3 pt-2.5 pb-2 border-b border-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base font-bold text-gray-800">{day}</span>
                    {isToday && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full no-print ${s.count}`}>今日</span>
                    )}
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${s.count}`}>
                    {list.length}名
                  </span>
                </div>
                {/* 人数バランスバー（最多曜日を100%として相対表示） */}
                <div className="mt-1.5 h-1 rounded-full bg-gray-100 overflow-hidden no-print">
                  <div
                    className={`h-full rounded-full ${s.bar} transition-all duration-300`}
                    style={{ width: `${Math.round((list.length / maxCount) * 100)}%` }}
                  />
                </div>
              </div>

              {/* 利用者リスト */}
              <div className="p-2 space-y-1">
                {list.length === 0 ? (
                  <p className="text-center text-xs text-gray-300 py-6">利用なし</p>
                ) : (
                  list.map(m => {
                    const isActive = activeId === m.id;
                    const isDimmed = activeId !== null && !isActive;
                    return (
                      <button
                        key={m.id}
                        onClick={() => handleChipClick(m.id)}
                        onMouseEnter={() => setHoverId(m.id)}
                        onMouseLeave={() => setHoverId(null)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left cursor-pointer transition-all duration-150 ${
                          isActive ? s.selBg : 'hover:bg-gray-50'
                        } ${isDimmed ? 'opacity-35' : ''}`}
                      >
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${s.avatar}`}
                        >
                          {m.name.charAt(0)}
                        </span>
                        <span className={`text-[13px] font-medium truncate ${isActive ? s.selText : 'text-gray-800'}`}>
                          {m.name}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 選択中の利用者サマリー */}
      {selected && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 no-print">
          <div className="flex items-center gap-3 bg-gray-900 text-white rounded-full pl-4 pr-2 py-2 shadow-xl">
            <span className="text-sm font-bold">{selected.name} さん</span>
            <span className="flex items-center gap-1">
              {WEEK_DAYS.map(d => (
                <span
                  key={d}
                  className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center ${
                    selectedDays.includes(d) ? 'bg-white text-gray-900' : 'bg-white/15 text-white/40'
                  }`}
                >
                  {d}
                </span>
              ))}
            </span>
            <span className="text-xs text-white/70">週{selectedDays.length}日</span>
            <button
              onClick={() => setSelectedId(null)}
              className="w-7 h-7 rounded-full hover:bg-white/15 flex items-center justify-center cursor-pointer transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
