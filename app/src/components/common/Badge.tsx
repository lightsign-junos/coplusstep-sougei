import type { VehicleColor } from '../../types';

interface VehicleBadgeProps {
  color: VehicleColor;
  name: string;
  size?: 'sm' | 'md';
}

const VEHICLE_STYLES: Record<VehicleColor, string> = {
  pink: 'bg-pink-100 text-pink-700 border-pink-200',
  blue: 'bg-blue-100 text-blue-700 border-blue-200',
  vel: 'bg-purple-100 text-purple-700 border-purple-200',
};

export function VehicleBadge({ color, name, size = 'sm' }: VehicleBadgeProps) {
  return (
    <span className={`inline-flex items-center border rounded-full font-medium ${VEHICLE_STYLES[color]} ${size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'}`}>
      {name}
    </span>
  );
}

interface StatusBadgeProps {
  variant: 'absent' | 'changed' | 'normal';
  label?: string;
}

const STATUS_STYLES = {
  absent: 'bg-red-100 text-red-700 border-red-200',
  changed: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  normal: 'bg-green-100 text-green-700 border-green-200',
};

export function StatusBadge({ variant, label }: StatusBadgeProps) {
  const labels = { absent: '欠席', changed: '変更あり', normal: '通常' };
  return (
    <span className={`inline-flex items-center border rounded-full text-xs px-2 py-0.5 font-medium ${STATUS_STYLES[variant]}`}>
      {label ?? labels[variant]}
    </span>
  );
}

interface DayBadgeProps {
  day: string;
  active?: boolean;
}

const DAY_COLORS: Record<string, string> = {
  '月': 'bg-blue-100 text-blue-700', '火': 'bg-green-100 text-green-700',
  '水': 'bg-cyan-100 text-cyan-700', '木': 'bg-yellow-100 text-yellow-700',
  '金': 'bg-orange-100 text-orange-700', '土': 'bg-purple-100 text-purple-700',
  '日': 'bg-red-100 text-red-700',
};

export function DayBadge({ day, active = true }: DayBadgeProps) {
  return (
    <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-bold ${active ? (DAY_COLORS[day] ?? 'bg-gray-100 text-gray-600') : 'bg-gray-100 text-gray-300'}`}>
      {day}
    </span>
  );
}
