import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Member, MemberLocation, Staff, Vehicle,
  Route, RouteStop, DailyOverride, AllowedUser, AuthUser, WeeklyDayOverride, WeeklyStaffOverride
} from '../types';
import { gasGetAll, gasSaveAll, gasSaveAllowedUsers } from '../lib/gasClient';

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

// 初期値は管理者のみ（ここに入れたアドレスはドライブ未読込時でもログインできてしまうため最小限にする）
const seedAllowedUsers: AllowedUser[] = [
  { email: ADMIN_EMAIL, name: 'JUNOS', addedAt: '2024-01-01', isAdmin: true },
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
  // 曜日×車両ごとの運転手・添乗員の割り当て（未設定は便のデフォルト）
  weeklyStaffOverrides: WeeklyStaffOverride[];
  // 利用者シフト（カレンダー）の欠勤マーク。date="yyyy-MM-dd"。記録がない人は出勤扱い
  shiftAbsences: { date: string; memberId: string }[];
  // 振替・臨時利用（その日だけ追加で来る人）
  shiftExtras: { date: string; memberId: string }[];
  // Vel weekly toggle
  velWeeks: Record<string, boolean>; // weekStart -> enabled
  // GAS sync
  gasLoaded: boolean;
  // GASから実データを取得・反映できた場合のみtrue。falseの間は自動保存を行わない
  // （取得失敗・空応答時にローカルの古い値を書き戻して本番データを壊す事故を防ぐ）
  gasSynced: boolean;
  syncStatus: 'idle' | 'saving' | 'saved' | 'error';

  // GAS sync action
  initFromGAS: () => Promise<void>;

  // Auth actions
  login: (user: AuthUser) => Promise<boolean>;
  logout: () => void;
  // ログイン許可の管理はセキュリティ操作なので、ドライブへ直接書き込み、
  // 成功が確認できた場合のみ画面へ反映する（falseなら保存失敗）
  addAllowedUser: (user: AllowedUser) => Promise<boolean>;
  updateAllowedUser: (email: string, patch: Partial<AllowedUser>) => Promise<boolean>;
  removeAllowedUser: (email: string) => Promise<boolean>;

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
  // 週次一覧の乗車時間の手動設定（null で自動計算に戻す）
  setWeeklyOverrideTime: (id: string, time: string | null) => void;
  // 週次一覧のマス位置変更（ドラッグ&ドロップ用）
  setWeeklyOverrideRow: (id: string, row: number) => void;
  // 曜日×車両ごとの運転手・添乗員の設定（staffId=null でその曜日の設定を解除し便のデフォルトに戻す）
  setWeeklyStaff: (weekKey: string, vehicleId: string, dayLabel: string, field: 'driverId' | 'attendantId', staffId: string | null) => void;

  // 利用者シフトの出欠
  markShiftAbsent: (date: string, memberId: string) => void;
  markShiftPresent: (date: string, memberId: string) => void;
  addShiftExtra: (date: string, memberId: string) => void;
  removeShiftExtra: (date: string, memberId: string) => void;

  // Vel toggle
  setVelEnabled: (weekStart: string, enabled: boolean) => void;
  isVelEnabled: (weekStart: string) => boolean;

  // Auto time calculation (10 min intervals, working backwards from arrivalTime)
  recalcRouteStopTimes: (routeId: string) => void;
}

let _gasDebounceTimer: ReturnType<typeof setTimeout> | null = null;
// initFromGASの多重実行防止（StrictMode等で二重に走ると読込→保存の競合が起きる）
let _gasLoading = false;

// activeな車両すべてに「行き」の便を保証する（無い車両には自動作成 → 週次一覧で配置可能になる）
function ensureGoRoutes(routes: Route[], vehicles: Vehicle[]): Route[] {
  const missing = vehicles.filter(
    v => v.active && !routes.some(r => r.direction === 'go' && r.vehicleId === v.id)
  );
  if (missing.length === 0) return routes;
  return [
    ...routes,
    ...missing.map(v => ({
      id: `r-${v.id}-go`,
      name: `${v.name}号 行き`,
      direction: 'go' as const,
      vehicleId: v.id,
      driverId: '',
      attendantId: '',
      arrivalTime: '10:55',
      velEnabled: false,
      notes: '',
    })),
  ];
}

// 日次の利用予定/実利用/稼働率を集計（今年の営業日すべて）。ドライブのattendance_dailyシートに書き出す
function computeAttendanceDaily(s: DataState): { date: string; scheduled: number; present: number; rate: number | '' }[] {
  const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'];
  const daysOf = (m: Member): string[] =>
    Array.isArray(m.defaultDays)
      ? m.defaultDays
      : String(m.defaultDays ?? '').split(',').map(x => x.trim()).filter(Boolean);
  const memberIds = new Set(s.members.map(m => m.id));
  const year = new Date().getFullYear();
  const rows: { date: string; scheduled: number; present: number; rate: number | '' }[] = [];
  const d = new Date(year, 0, 1);
  while (d.getFullYear() === year) {
    const label = DAY_LABELS[(d.getDay() + 6) % 7]; // getDay: 0=日 → ISO月曜始まりへ
    if (label !== '日') {
      const iso = `${year}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const base = s.members.filter(m => {
        const dd = daysOf(m);
        return dd.length === 0 || dd.includes(label);
      });
      const baseIds = new Set(base.map(m => m.id));
      const extras = s.shiftExtras.filter(e => e.date === iso && !baseIds.has(e.memberId) && memberIds.has(e.memberId));
      const scheduled = base.length + extras.length;
      const absent = s.shiftAbsences.filter(a => a.date === iso && baseIds.has(a.memberId)).length;
      const present = scheduled - absent;
      rows.push({ date: iso, scheduled, present, rate: scheduled > 0 ? Math.round((present / scheduled) * 100) : '' });
    }
    d.setDate(d.getDate() + 1);
  }
  return rows;
}

function scheduleGASSave() {
  if (_gasDebounceTimer) clearTimeout(_gasDebounceTimer);
  useDataStore.setState({ syncStatus: 'saving' });
  _gasDebounceTimer = setTimeout(async () => {
    const s = useDataStore.getState();
    if (!s.gasSynced) return;
    try {
      await gasSaveAll({
        members: s.members,
        memberLocations: s.memberLocations,
        staff: s.staff,
        vehicles: s.vehicles,
        routes: s.routes,
        routeStops: s.routeStops,
        dailyOverrides: s.dailyOverrides,
        // allowedUsersは含めない: 古い画面の一括保存が最新の許可リストを
        // 巻き戻さないよう、書き込みは管理者設定の直接保存に限定する
        weeklyDayOverrides: s.weeklyDayOverrides,
        weeklyStaffOverrides: s.weeklyStaffOverrides,
        shiftAbsences: s.shiftAbsences,
        shiftExtras: s.shiftExtras,
        attendanceDaily: computeAttendanceDaily(s),
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
      weeklyStaffOverrides: [],
      shiftAbsences: [],
      shiftExtras: [],
      velWeeks: {},
      gasLoaded: false,
      gasSynced: false,
      syncStatus: 'idle' as const,

      initFromGAS: async () => {
        if (get().gasLoaded || _gasLoading) return;
        _gasLoading = true;
        try {
          const data = await gasGetAll();
          if (get().gasLoaded) return; // 二重実行の後着側は何もしない
          if (!data) {
            // GAS取得失敗: gasSyncedをtrueにしないことで自動保存を止め、
            // 古い/不完全なローカルデータが後から本番を上書きする事故を防ぐ
            // （手元のデータで表示は継続し、次回起動時に再取得を試みる）
            set({ gasLoaded: true });
            return;
          }
          const hasData = (data.members?.length ?? 0) > 0 || (data.routes?.length ?? 0) > 0;
          if (hasData) {
            // このページはDriveの内容をそのまま映すスクリーンなので、
            // 取得できたものはローカルの古い値と混ぜずGASの値をそのまま採用する
            // （アカウント・端末が違っても常に同じ内容が表示されるようにする）
            const nextVehicles = data.vehicles ?? [];
            const nextRoutes = ensureGoRoutes(data.routes ?? [], nextVehicles);
            set({
              members: data.members ?? [],
              memberLocations: data.memberLocations ?? [],
              staff: data.staff ?? [],
              vehicles: nextVehicles,
              routes: nextRoutes,
              routeStops: data.routeStops ?? [],
              dailyOverrides: data.dailyOverrides ?? [],
              allowedUsers: data.allowedUsers ?? [],
              weeklyDayOverrides: data.weeklyDayOverrides ?? [],
              weeklyStaffOverrides: data.weeklyStaffOverrides ?? [],
              shiftAbsences: data.shiftAbsences ?? [],
              shiftExtras: data.shiftExtras ?? [],
              gasLoaded: true,
              gasSynced: true,
            });
            // 許可リストから削除された人はログイン状態を解除する
            // （ログイン済みセッションが残り続けて入れてしまうのを防ぐ）
            const cu = get().currentUser;
            if (cu && !(data.allowedUsers ?? []).some(u => u.email === cu.email)) {
              set({ currentUser: null });
            }
          } else {
            // GASが空（初回セットアップ等）: gasSyncedはtrueにせず自動保存を止める。
            // 本当に初回セットアップの場合は手動でのデータ投入が必要
            set({ gasLoaded: true });
          }
        } finally {
          _gasLoading = false;
        }
      },

      login: async (user) => {
        // 必ずドライブの最新の許可リストで判定する。ブラウザに残った古いリストを
        // 先に見てしまうと、削除済みのアドレスでもログインできてしまうため
        const data = await gasGetAll();
        const list = data?.allowedUsers?.length ? data.allowedUsers : get().allowedUsers;
        if (data?.allowedUsers?.length) set({ allowedUsers: data.allowedUsers });
        const allowed = list.find(u => u.email === user.email);
        if (!allowed) return false;
        const authUser: AuthUser = { ...user, isAdmin: allowed.isAdmin };
        set({ currentUser: authUser });
        return true;
      },
      logout: () => set({ currentUser: null }),

      // 許可リストの変更は「ドライブの最新リストを取得 → 変更を適用 → ドライブへ書き込み →
      // 成功したら画面反映」の順で行う。古い画面からの操作でも他の人の追加・削除を巻き戻さない
      addAllowedUser: async (user) => {
        const data = await gasGetAll();
        const base = data?.allowedUsers?.length ? data.allowedUsers : get().allowedUsers;
        const next = [...base.filter(u => u.email !== user.email), user];
        const ok = await gasSaveAllowedUsers(next);
        if (ok) set({ allowedUsers: next });
        return ok;
      },
      updateAllowedUser: async (email, patch) => {
        const data = await gasGetAll();
        const base = data?.allowedUsers?.length ? data.allowedUsers : get().allowedUsers;
        const next = base.map(u => u.email === email ? { ...u, ...patch } : u);
        const ok = await gasSaveAllowedUsers(next);
        if (ok) set({ allowedUsers: next });
        return ok;
      },
      removeAllowedUser: async (email) => {
        const data = await gasGetAll();
        const base = data?.allowedUsers?.length ? data.allowedUsers : get().allowedUsers;
        const next = base.filter(u => u.email !== email);
        const ok = await gasSaveAllowedUsers(next);
        if (ok) set({ allowedUsers: next });
        return ok;
      },

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
      markShiftAbsent: (date, memberId) => set(s => ({
        shiftAbsences: s.shiftAbsences.some(a => a.date === date && a.memberId === memberId)
          ? s.shiftAbsences
          : [...s.shiftAbsences, { date, memberId }],
      })),
      markShiftPresent: (date, memberId) => set(s => ({
        shiftAbsences: s.shiftAbsences.filter(a => !(a.date === date && a.memberId === memberId)),
      })),
      addShiftExtra: (date, memberId) => set(s => ({
        shiftExtras: s.shiftExtras.some(e => e.date === date && e.memberId === memberId)
          ? s.shiftExtras
          : [...s.shiftExtras, { date, memberId }],
      })),
      removeShiftExtra: (date, memberId) => set(s => ({
        shiftExtras: s.shiftExtras.filter(e => !(e.date === date && e.memberId === memberId)),
        // 振替を取り消したらその日の欠勤記録も掃除
        shiftAbsences: s.shiftAbsences.filter(a => !(a.date === date && a.memberId === memberId)),
      })),
      removeWeeklyDayOverride: (id) => set(s => ({ weeklyDayOverrides: s.weeklyDayOverrides.filter(x => x.id !== id) })),
      clearWeekOverrides: (weekKey) => set(s => ({
        weeklyDayOverrides: s.weeklyDayOverrides.filter(x => x.weekKey !== weekKey),
        weeklyStaffOverrides: s.weeklyStaffOverrides.filter(x => x.weekKey !== weekKey),
      })),
      setWeeklyOverrideTime: (id, time) => set(s => ({
        weeklyDayOverrides: s.weeklyDayOverrides.map(o =>
          o.id === id ? { ...o, manualTime: time ?? undefined } : o
        ),
      })),
      setWeeklyOverrideRow: (id, row) => set(s => ({
        weeklyDayOverrides: s.weeklyDayOverrides.map(o =>
          o.id === id ? { ...o, row } : o
        ),
      })),
      setWeeklyStaff: (weekKey, vehicleId, dayLabel, field, staffId) => set(s => {
        const existing = s.weeklyStaffOverrides.find(
          o => o.weekKey === weekKey && o.vehicleId === vehicleId && o.dayLabel === dayLabel
        );
        if (existing) {
          const updated = { ...existing, [field]: staffId ?? undefined };
          // 両方とも未設定になったらエントリごと削除
          if (!updated.driverId && !updated.attendantId) {
            return { weeklyStaffOverrides: s.weeklyStaffOverrides.filter(o => o.id !== existing.id) };
          }
          return { weeklyStaffOverrides: s.weeklyStaffOverrides.map(o => o.id === existing.id ? updated : o) };
        }
        if (!staffId) return {};
        return {
          weeklyStaffOverrides: [
            ...s.weeklyStaffOverrides,
            // 前週コピーで同一ミリ秒に連続作成されてもIDが衝突しないよう乱数を付与
            { id: `wso-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, weekKey, vehicleId, dayLabel, [field]: staffId },
          ],
        };
      }),

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
      // gasLoaded / gasSynced / syncStatus は保存しない（毎回GASから最新データを読み込む）
      partialize: (state) => {
        const { gasLoaded: _g, gasSynced: _gs, syncStatus: _s, ...rest } = state as unknown as Record<string, unknown>;
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
          // 行き便の到着時刻は10:55固定 + 便が無い車両には自動作成
          const fixedRoutes = ensureGoRoutes(
            s.routes.map(r =>
              r.direction === 'go' && r.arrivalTime !== '10:55' ? { ...r, arrivalTime: '10:55' } : r
            ),
            s.vehicles
          );
          const membersChanged = fixedMembers.some((m, i) => m.defaultDays !== s.members[i].defaultDays);
          const routesChanged =
            fixedRoutes.length !== s.routes.length ||
            fixedRoutes.some((r, i) => r !== s.routes[i]);
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
  // GASから実データを取得・反映できたセッションでのみ自動保存する
  if (!state.gasSynced) return;
  // GAS読み込み直後のデータ置き換えは「変更」ではないので保存しない
  if (!prev.gasSynced) return;
  const changed =
    state.members !== prev.members ||
    state.memberLocations !== prev.memberLocations ||
    state.staff !== prev.staff ||
    state.vehicles !== prev.vehicles ||
    state.routes !== prev.routes ||
    state.routeStops !== prev.routeStops ||
    state.dailyOverrides !== prev.dailyOverrides ||
    // allowedUsersは管理者設定の操作時にドライブへ直接書き込むため、ここでは監視しない
    state.weeklyDayOverrides !== prev.weeklyDayOverrides ||
    state.weeklyStaffOverrides !== prev.weeklyStaffOverrides ||
    state.shiftAbsences !== prev.shiftAbsences ||
    state.shiftExtras !== prev.shiftExtras;
  if (changed) scheduleGASSave();
});
