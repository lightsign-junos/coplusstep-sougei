import type {
  Member, MemberLocation, Staff, Vehicle,
  Route, RouteStop, DailyOverride, AllowedUser,
} from '../types';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbwPds7ghq7ZLFJ1VNfTtV7yucE9G24AOYpbh_Sbm1Hu1HNeaTZ606E_qI9fbL8sxlkH/exec';

export interface GASData {
  members: Member[];
  memberLocations: MemberLocation[];
  staff: Staff[];
  vehicles: Vehicle[];
  routes: Route[];
  routeStops: RouteStop[];
  dailyOverrides: DailyOverride[];
  allowedUsers: AllowedUser[];
  // 利用者シフト（出欠・振替）と日次稼働率レポート
  shiftAbsences?: { date: string; memberId: string }[];
  shiftExtras?: { date: string; memberId: string }[];
  attendanceDaily?: { date: string; scheduled: number; present: number; rate: number | '' }[];
}

// GAS returns time values as 1899-12-xx dates (spreadsheet internal format)
// Convert them back to HH:MM strings (JST = UTC+9)
function fixGASValues(val: unknown): unknown {
  if (typeof val === 'string' && /^1899-12-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
    const d = new Date(val);
    const mins = (d.getUTCHours() * 60 + d.getUTCMinutes() + 540) % (24 * 60);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  if (Array.isArray(val)) return val.map(fixGASValues);
  if (val && typeof val === 'object') {
    return Object.fromEntries(Object.entries(val as Record<string, unknown>).map(([k, v]) => [k, fixGASValues(v)]));
  }
  return val;
}

// シート保存で配列が "月,火,水" のような文字列に化けるので配列に戻す
function normalizeMembers(members: Member[] | undefined): Member[] {
  if (!Array.isArray(members)) return [];
  return members.map(m => ({
    ...m,
    defaultDays: Array.isArray(m.defaultDays)
      ? m.defaultDays
      : String(m.defaultDays ?? '').split(',').map(s => s.trim()).filter(Boolean),
  }));
}

export async function gasGetAll(): Promise<GASData | null> {
  try {
    const res = await fetch(`${GAS_URL}?action=getAllData`);
    const json = await res.json();
    if (!json.ok) return null;
    const data = fixGASValues(json.data) as GASData;
    data.members = normalizeMembers(data.members);
    // シート保存で "2026-07-03" が日時型("2026-07-02T15:00:00.000Z")に化けるためJST日付に戻す
    const fixDate = (v: unknown): string => {
      const s = String(v ?? '');
      if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
        const d = new Date(s);
        d.setUTCHours(d.getUTCHours() + 9);
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      }
      return s;
    };
    data.shiftAbsences = (data.shiftAbsences ?? []).map(a => ({ ...a, date: fixDate(a.date) }));
    data.shiftExtras = (data.shiftExtras ?? []).map(e => ({ ...e, date: fixDate(e.date) }));
    // 行き便の到着時刻は10:55固定
    data.routes = (data.routes ?? []).map(r =>
      r.direction === 'go' ? { ...r, arrivalTime: '10:55' } : r
    );
    return data;
  } catch {
    return null;
  }
}

export async function gasSaveAll(data: GASData): Promise<void> {
  try {
    // シートのセルに配列を書くと先頭要素しか残らないため、カンマ区切り文字列で保存する
    const payload: Record<string, unknown> = {
      ...data,
      members: data.members.map(m => ({
        ...m,
        defaultDays: Array.isArray(m.defaultDays) ? m.defaultDays.join(',') : m.defaultDays,
      })),
    };
    // 空配列を送るとGAS側がシートを丸ごと消すため、絶対に空であってはならないマスタは除外する
    for (const key of ['members', 'memberLocations', 'staff', 'vehicles', 'routes'] as const) {
      const v = payload[key];
      if (Array.isArray(v) && v.length === 0) delete payload[key];
    }
    await fetch(`${GAS_URL}?action=saveAllData`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
    });
  } catch {
    // silent fail — localStorage is the fallback
  }
}
