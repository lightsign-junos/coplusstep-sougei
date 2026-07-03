// === Master Data Types ===

export type Direction = 'go' | 'return' | 'both';
export type VehicleColor = 'pink' | 'blue' | 'vel';
export type StaffRole = 'driver' | 'attendant' | 'both';
export type OverrideType = 'absent' | 'route_change';

export interface Member {
  id: string;
  name: string;
  nameKana?: string; // "たなか たろう" 苗字と名前をスペース区切り
  phone: string;
  defaultDays: string[]; // ['月', '火', '水', '木', '金', '土']
  sendFlag: boolean;
  returnFlag: boolean;
  notes: string;
  createdAt: string;
}

export interface MemberLocation {
  id: string;
  memberId: string;
  name: string;
  address: string;
  direction: Direction;
  notes: string;
  lat?: number;
  lng?: number;
}

export interface Staff {
  id: string;
  name: string;
  role: StaffRole;
  phone: string;
  notes: string;
  active: boolean;
}

export interface Vehicle {
  id: string;
  name: string;
  color: VehicleColor;
  capacity: number;
  number: string;
  active: boolean;
}

// === Route Types ===

export interface Route {
  id: string;
  name: string;
  direction: Direction;
  vehicleId: string;
  driverId: string;
  attendantId: string;
  arrivalTime: string; // HH:MM - facility arrival time
  velEnabled: boolean;
  notes: string;
}

export interface RouteStop {
  id: string;
  routeId: string;
  memberId: string;
  locationId: string;
  order: number;
  scheduledTime: string; // HH:MM calculated
  manualTime?: string; // user override
}

// === Daily Schedule Types ===

export interface DailyOverride {
  id: string;
  date: string; // YYYY-MM-DD
  type: OverrideType;
  routeId: string;
  memberId?: string;
  newOrder?: number;
  newTime?: string;
  newDriverId?: string;
  newAttendantId?: string;
  notes: string;
  createdAt: string;
}

export interface MonthlySchedule {
  id: string;
  date: string; // YYYY-MM-DD
  routeId: string;
  isDefault: boolean;
  notes: string;
}

// === Auth Types ===

export interface AllowedUser {
  email: string;
  name: string;
  addedAt: string;
  isAdmin: boolean;
}

export interface AuthUser {
  email: string;
  name: string;
  photoURL?: string;
  isAdmin: boolean;
}

// === UI State Types ===

export interface WeekSchedule {
  weekStart: string; // YYYY-MM-DD (Monday)
  velEnabled: boolean;
}

// 週次一覧での1週間限定の追加・除外（defaultDaysには影響しない）
export interface WeeklyDayOverride {
  id: string;
  weekKey: string;    // その週の月曜日 YYYY-MM-DD
  memberId: string;
  vehicleId: string;
  dayLabel: string;   // '月'〜'土'
  type: 'add' | 'remove';
  row?: number;       // 週次一覧のマス位置（0始まり）。マスは独立していて他の配置に影響されない
}
