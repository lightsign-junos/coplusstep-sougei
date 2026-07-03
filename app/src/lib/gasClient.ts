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
