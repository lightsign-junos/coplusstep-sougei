import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Member, MemberLocation, Staff, Vehicle,
  Route, RouteStop, DailyOverride, AllowedUser, AuthUser, WeeklyDayOverride
} from '../types';
import { gasGetAll, gasSaveAll } from '../lib/gasClient';

const ADMIN_EMAIL = 'junnosuke.honda@lightsign.jp';

// Sample seed data
const seedMembers: Member[] = [
  { id: 'm1', name: '田中 太郎', nameKana: 'たなか たろう', phone: '090-1234-5678', defaultDays: ['月', '火', '水', '木', '金'], sendFlag: true, returnFlag: true, notes: '', createdAt: '2024-01-01' },
  { id: 'm2', name: '鈴木 花子', nameKana: 'すずき はなこ', phone: '090-2345-6789', defaultDays: ['月', '水', '金'], sendFlag: true, returnFlag: true, notes: '', createdAt: '2024-01-01' },
  { id: 'm3', name: '佐藤 次郎', nameKana: 'さとう じろう', phone: '090-3456-7890', defaultDays: ['火', '木'], sendFlag: true, returnFlag: false, notes: '帰りは自力', createdAt: '2024-01-01' },
  { id: 'm4', name: '山田 三郎', nameKana: 'やまだ さぶろう', phone: '090-4567-8901', defaultDays: ['月', '火', '水', '木', '金'], sendFlag: true, returnFlag: true, notes: '', createdAt: '2024-01-01' },
  { id: 'm5', name: '伊藤 四郎', nameKana: 'いとう しろう', phone: '090-5678-9012', defaultDays: ['月', '火', '木', '金'], sendFlag: true, returnFlag: true, notes: '', createdAt: '2024-01-01' },
  { id: 'm6', name: '渡辺 五郎', nameKana: 'わたなべ ごろう', phone: '090-6789-0123', defaultDays: ['水', '金'], sendFlag: true, returnFlag: true, notes: '', createdAt: '2024-01-01' },
];

const seedLocations: MemberLocation[] = [
  { id: 'l1', memberId: 'm1', name: '自宅', address: '東京都大田区昭和島1-1-1', direction: 'both', notes: '' },
  { id: 'l2', memberId: 'm2', name: '自宅', address: '東京都大田区大森東2-2-2', direction: 'both', notes: '' },
  { id: 'l3', memberId: 'm3', name: '自宅', address: '東京都大田区平和島3-3-3', direction: 'go', notes: '' },
  { id: 'l4', memberId: 'm4', name: '自宅', address: '東京都大田区昭和島4-4-4', direction: 'both', notes: '' },
  { id: 'l5', memberId: 'm5', name: '自宅', address: '東京都大田区大森南5-5-5', direction: 'both', notes: '' },
  { id: 'l6', memberId: 'm6', name: '最寄り駅', address: '東京都大田区大森北6-6-6', direction: 'both', notes: '改札前で待機' },
];

const seedStaff: Staff[] = [
  { id: 's1', name: '山本 運転手', role: 'driver', phone: '090-1111-1111', notes: '', active: true },
  { id: 's2', name: '中村 添乗員', role: 'attendant', phone: '090-2222-2222', notes: '', active: true },
  { id: 's3', name: '小林 兼務', role: 'both', phone: '090-3333-3333', notes: '', active: true },
  { id: 's4', name: '加藤 運転手', role: 'driver', phone: '090-4444-4444', notes: '', active: true },
];

const seedVehicles: Vehicle[] = [
  { id: 'v1', name: 'ピンク', color: 'pink', capacity: 8, number: '品川 11 あ 1111', active: true },
  { id: 'v2', name: '青', color: 'blue', capacity: 8, number: '品川 22 い 2222', active: true },
  { id: 'v3', name: 'ヴェル', color: 'vel', capacity: 10, number: '品川 33 う 3333', active: true },
];

const seedRoutes: Route[] = [
  { id: 'r1', name: 'ピンク号 行き', direction: 'go', vehicleId: 'v1', driverId: 's1', attendantId: 's2', arrivalTime: '10:55', velEnabled: false, notes: '' },
  { id: 'r2', name: '青号 行き', direction: 'go', vehicleId: 'v2', driverId: 's4', attendantId: 's3', arrivalTime: '10:55', velEnabled: false, notes: '' },
];

const seedRouteStops: RouteStop[] = [
  { id: 'rs1', routeId: 'r1', memberId: 'm1', locationId: 'l1', order: 1, scheduledTime: '08:45' },
  { id: 'rs2', routeId: 'r1', memberId: 'm2', locationId: 'l2', order: 2, scheduledTime: '08:55' },
  { id: 'rs3', routeId: 'r1', memberId: 'm3', locationId: 'l3', order: 3, scheduledTime: '09:10' },
  { id: 'rs4', routeId: 'r2', memberId: 'm4', locationId: 'l4', order: 1, scheduledTime: '08:50' },
  { id: 'rs5', routeId: 'r2', memberId: 'm5', locationId: 'l5', order: 2, scheduledTime: '09:05' },
  { id: 'rs6', routeId: 'r2', memberId: 'm6', locationId: 'l6', order: 3, scheduledTime: '09:15' },
];

const seedAllowedUsers: AllowedUser[] = [
  { email: ADMIN_EMAIL, name: 'JUNOS', addedAt: '2024-01-01', isAdmin: true },
  { email: 'staff1@coplus-step.jp', name: 'スタッフ1', addedAt: '2024-01-01', isAdmin: false },
];

interface DataState {
  // Auth
  currentUser: AuthUser | null;
  allowedUsers: AllowedUser[];
  // Masters
  members: Member[];
  memberLocations: MemberLocation[];
  staff: Staff[];
  vehicles: Vehicle[];
  // Routes
  routes: Route[];
  routeStops: RouteStop[];
  // Daily
  dailyOverrides: DailyOverride[];
  // Weekly day overrides (defaultDaysを変えずに週単位で追加・除外)
  weeklyDayOverrides: WeeklyDayOverride[];
  // Vel weekly toggle
  velWeeks: Record<string, boolean>; // weekStart -> enabled
  // GAS sync
  gasLoaded: boolean;
  syncStatus: 'idle' | 'saving' | 'saved' | 'error';

  // GAS sync action
  initFromGAS: () => Promise<void>;

  // Auth actions
  login: (user: AuthUser) => boolean;
  logout: () => void;
  addAllowedUser: (user: AllowedUser) => void;
  updateAllowedUser: (email: string, patch: Partial<AllowedUser>) => void;
  removeAllowedUser: (email: string) => void;

  // Member actions
  addMember: (member: Member) => void;
  updateMember: (member: Member) => void;
  deleteMember: (id: string) => void;
  addMemberLocation: (loc: MemberLocation) => void;
  updateMemberLocation: (loc: MemberLocation) => void;
  deleteMemberLocation: (id: string) => void;

  // Staff actions
  addStaff: (staff: Staff) => void;
  updateStaff: (staff: Staff) => void;
  deleteStaff: (id: string) => void;

  // Vehicle actions
  addVehicle: (vehicle: Vehicle) => void;
  updateVehicle: (vehicle: Vehicle) => void;
  deleteVehicle: (id: string) => void;

  // Route actions
  addRoute: (route: Route) => void;
  updateRoute: (route: Route) => void;
  deleteRoute: (id: string) => void;
  addRouteStop: (stop: RouteStop) => void;
  updateRouteStop: (stop: RouteStop) => void;
  deleteRouteStop: (id: string) => void;
  reorderRouteStops: (routeId: string, orderedIds: string[]) => void;

  // Daily override actions
  addDailyOverride: (override: DailyOverride) => void;
  removeDailyOverride: (id: string) => void;

  // Weekly day override actions
  addWeeklyDayOverride: (override: WeeklyDayOverride) => void;
  removeWeeklyDayOverride: (id: string) => void;
  clearWeekOverrides: (weekKey: string) => void;

  // Vel toggle
  setVelEnabled: (weekStart: string, enabled: boolean) => void;
  isVelEnabled: (weekStart: string) => boolean;

  // Auto time calculation (10 min intervals, working backwards from arrivalTime)
  recalcRouteStopTimes: (routeId: string) => void;
}

let _gasDebounceTimer: ReturnType<typeof setTimeout> | null = null;
// initFromGASの多重実行防止（StrictMode等で二重に走ると読込→保存の競合が起きる）
let _gasLoading = false;

function scheduleGASSave() {
  if (_gasDebounceTimer) clearTimeout(_gasDebounceTimer);
  useDataStore.setState({ syncStatus: 'saving' });
  _gasDebounceTimer = setTimeout(async () => {
    const s = useDataStore.getState();
    if (!s.gasLoaded) return;
    try {
      await gasSaveAll({
        members: s.members,
        memberLocations: s.memberLocations,
        staff: s.staff,
        vehicles: s.vehicles,
        routes: s.routes,
        routeStops: s.routeStops,
        dailyOverrides: s.dailyOverrides,
        allowedUsers: s.allowedUsers,
      });
      useDataStore.setState({ syncStatus: 'saved' });
      setTimeout(() => useDataStore.setState({ syncStatus: 'idle' }), 2000);
    } catch {
      useDataStore.setState({ syncStatus: 'error' });
      setTimeout(() => useDataStore.setState({ syncStatus: 'idle' }), 3000);
    }
  }, 1500);
}

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      allowedUsers: seedAllowedUsers,
      members: seedMembers,
      memberLocations: seedLocations,
      staff: seedStaff,
      vehicles: seedVehicles,
      routes: seedRoutes,
      routeStops: seedRouteStops,
      dailyOverrides: [],
      weeklyDayOverrides: [],
      velWeeks: {},
      gasLoaded: false,
      syncStatus: 'idle' as const,

      initFromGAS: async () => {
        if (get().gasLoaded || _gasLoading) return;
        _gasLoading = true;
        try {
          const data = await gasGetAll();
          if (get().gasLoaded) return; // 二重実行の後着側は何もしない
          if (!data) {
            // GAS unavailable: seed GAS with current store data
            const s = get();
            await gasSaveAll({
              members: s.members, memberLocations: s.memberLocations,
              staff: s.staff, vehicles: s.vehicles, routes: s.routes,
              routeStops: s.routeStops, dailyOverrides: s.dailyOverrides,
              allowedUsers: s.allowedUsers,
            });
            set({ gasLoaded: true });
            return;
          }
          const hasData = (data.members?.length ?? 0) > 0 || (data.routes?.length ?? 0) > 0;
          if (hasData) {
            // シートに列がない項目（nameKana等）はローカル保存値を引き継ぐ（GASロードで消さない）
            const localMembers = get().members;
            const mergedMembers = (data.members ?? []).map(gm => {
              const local = localMembers.find(lm => lm.id === gm.id);
              return {
                ...gm,
                nameKana: gm.nameKana || local?.nameKana || '',
              };
            });
            // マスタ系はGASが空を返しても手元の値を維持（誤消去からの防御）
            set({
              members: mergedMembers.length ? mergedMembers : get().members,
              memberLocations: data.memberLocations?.length ? data.memberLocations : get().memberLocations,
              staff: data.staff?.length ? data.staff : get().staff,
              vehicles: data.vehicles?.length ? data.vehicles : get().vehicles,
              routes: data.routes?.length ? data.routes : get().routes,
              routeStops: data.routeStops ?? [],
              dailyOverrides: data.dailyOverrides ?? [],
              allowedUsers: data.allowedUsers?.length ? data.allowedUsers : get().allowedUsers,
              gasLoaded: true,
            });
          } else {
            // GAS is empty: push current store data to GAS
            const s = get();
            await gasSaveAll({
              members: s.members, memberLocations: s.memberLocations,
              staff: s.staff, vehicles: s.vehicles, routes: s.routes,
              routeStops: s.routeStops, dailyOverrides: s.dailyOverrides,
              allowedUsers: s.allowedUsers,
            });
            set({ gasLoaded: true });
          }
        } finally {
          _gasLoading = false;
        }
      },

      login: (user) => {
        const allowed = get().allowedUsers.find(u => u.email === user.email);
        if (!allowed) return false;
        const authUser: AuthUser = { ...user, isAdmin: allowed.isAdmin };
        set({ currentUser: authUser });
        return true;
      },
      logout: () => set({ currentUser: null }),

      addAllowedUser: (user) => set(s => ({ allowedUsers: [...s.allowedUsers, user] })),
      updateAllowedUser: (email, patch) => set(s => ({
        allowedUsers: s.allowedUsers.map(u => u.email === email ? { ...u, ...patch } : u),
      })),
      removeAllowedUser: (email) => set(s => ({ allowedUsers: s.allowedUsers.filter(u => u.email !== email) })),

      addMember: (m) => set(s => ({ members: [...s.members, m] })),
      updateMember: (m) => set(s => ({ members: s.members.map(x => x.id === m.id ? m : x) })),
      deleteMember: (id) => set(s => ({ members: s.members.filter(x => x.id !== id) })),
      addMemberLocation: (l) => set(s => ({ memberLocations: [...s.memberLocations, l] })),
      updateMemberLocation: (l) => set(s => ({ memberLocations: s.memberLocations.map(x => x.id === l.id ? l : x) })),
      deleteMemberLocation: (id) => set(s => ({ memberLocations: s.memberLocations.filter(x => x.id !== id) })),

      addStaff: (st) => set(s => ({ staff: [...s.staff, st] })),
      updateStaff: (st) => set(s => ({ staff: s.staff.map(x => x.id === st.id ? st : x) })),
      deleteStaff: (id) => set(s => ({ staff: s.staff.filter(x => x.id !== id) })),

      addVehicle: (v) => set(s => ({ vehicles: [...s.vehicles, v] })),
      updateVehicle: (v) => set(s => ({ vehicles: s.vehicles.map(x => x.id === v.id ? v : x) })),
      deleteVehicle: (id) => set(s => ({ vehicles: s.vehicles.filter(x => x.id !== id) })),

      addRoute: (r) => set(s => ({ routes: [...s.routes, r] })),
      updateRoute: (r) => set(s => ({ routes: s.routes.map(x => x.id === r.id ? r : x) })),
      deleteRoute: (id) => set(s => ({
        routes: s.routes.filter(x => x.id !== id),
        routeStops: s.routeStops.filter(x => x.routeId !== id),
      })),
      addRouteStop: (rs) => set(s => ({ routeStops: [...s.routeStops, rs] })),
      updateRouteStop: (rs) => set(s => ({ routeStops: s.routeStops.map(x => x.id === rs.id ? rs : x) })),
      deleteRouteStop: (id) => set(s => ({ routeStops: s.routeStops.filter(x => x.id !== id) })),
      reorderRouteStops: (routeId, orderedIds) => set(s => ({
        routeStops: s.routeStops.map(rs => {
          if (rs.routeId !== routeId) return rs;
          const idx = orderedIds.indexOf(rs.id);
          return idx >= 0 ? { ...rs, order: idx + 1 } : rs;
        }),
      })),

      addDailyOverride: (o) => set(s => ({ dailyOverrides: [...s.dailyOverrides, o] })),
      removeDailyOverride: (id) => set(s => ({ dailyOverrides: s.dailyOverrides.filter(x => x.id !== id) })),

      addWeeklyDayOverride: (o) => set(s => ({ weeklyDayOverrides: [...s.weeklyDayOverrides, o] })),
      removeWeeklyDayOverride: (id) => set(s => ({ weeklyDayOverrides: s.weeklyDayOverrides.filter(x => x.id !== id) })),
      clearWeekOverrides: (weekKey) => set(s => ({ weeklyDayOverrides: s.weeklyDayOverrides.filter(x => x.weekKey !== weekKey) })),

      setVelEnabled: (weekStart, enabled) => set(s => ({ velWeeks: { ...s.velWeeks, [weekStart]: enabled } })),
      isVelEnabled: (weekStart) => get().velWeeks[weekStart] ?? false,

      recalcRouteStopTimes: (routeId) => {
        const s = get();
        const route = s.routes.find(r => r.id === routeId);
        if (!route) return;
        const stops = s.routeStops
          .filter(rs => rs.routeId === routeId)
          .sort((a, b) => a.order - b.order);
        if (stops.length === 0) return;
        const [h, m] = route.arrivalTime.split(':').map(Number);
        const arrMins = h * 60 + m;
        const INTERVAL = 10;
        const timeMap = new Map<string, string>();
        stops.forEach((stop, i) => {
          const mins = arrMins - (stops.length - i) * INTERVAL;
          const adjusted = ((mins % 1440) + 1440) % 1440;
          const ph = Math.floor(adjusted / 60);
          const pm = adjusted % 60;
          timeMap.set(stop.id, `${String(ph).padStart(2, '0')}:${String(pm).padStart(2, '0')}`);
        });
        set(s => ({
          routeStops: s.routeStops.map(rs =>
            timeMap.has(rs.id) ? { ...rs, scheduledTime: timeMap.get(rs.id)! } : rs
          ),
        }));
      },
    }),
    {
      name: 'coplus-step-data',
      // gasLoaded / syncStatus は保存しない（毎回GASから最新データを読み込む）
      partialize: (state) => {
        const { gasLoaded: _g, syncStatus: _s, ...rest } = state as unknown as Record<string, unknown>;
        return rest;
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // ストア初期化完了後に修復を実行（初期化中のsetStateを避ける）
        setTimeout(() => {
          const s = useDataStore.getState();
          // 過去にGAS経由で defaultDays が "月,火" のような文字列になったデータを配列に修復
          const fixedMembers = s.members.map(m => ({
            ...m,
            defaultDays: Array.isArray(m.defaultDays)
              ? m.defaultDays
              : String(m.defaultDays ?? '').split(',').map(x => x.trim()).filter(Boolean),
          }));
          // 行き便の到着時刻は10:55固定
          const fixedRoutes = s.routes.map(r =>
            r.direction === 'go' && r.arrivalTime !== '10:55' ? { ...r, arrivalTime: '10:55' } : r
          );
          const membersChanged = fixedMembers.some((m, i) => m.defaultDays !== s.members[i].defaultDays);
          const routesChanged = fixedRoutes.some((r, i) => r !== s.routes[i]);
          if (membersChanged || routesChanged) {
            useDataStore.setState({
              ...(membersChanged ? { members: fixedMembers } : {}),
              ...(routesChanged ? { routes: fixedRoutes } : {}),
            });
          }
        }, 0);
      },
    }
  )
);

// Auto-save to GAS on data changes (debounced 1.5s)
useDataStore.subscribe((state, prev) => {
  if (!state.gasLoaded) return;
  // GAS読み込み直後のデータ置き換えは「変更」ではないので保存しない
  if (!prev.gasLoaded) return;
  const changed =
    state.members !== prev.members ||
    state.memberLocations !== prev.memberLocations ||
    state.staff !== prev.staff ||
    state.vehicles !== prev.vehicles ||
    state.routes !== prev.routes ||
    state.routeStops !== prev.routeStops ||
    state.dailyOverrides !== prev.dailyOverrides ||
    state.allowedUsers !== prev.allowedUsers;
  if (changed) scheduleGASSave();
});
