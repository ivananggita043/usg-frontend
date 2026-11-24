import { apiFetch } from "./client.js";
import { loadSession } from "../auth/session.js";

const isSuper = () => loadSession()?.user?.role === "super_admin";
const root = () => (isSuper() ? "/super-admin" : "/admin");
const lower = (v) => (v ? String(v).toLowerCase() : null);
const todayISO = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });

// jalankan fn untuk semua item dengan batas permintaan bersamaan; item gagal -> null
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const k = next++;
      try {
        out[k] = await fn(items[k], k);
      } catch {
        out[k] = null;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export async function fetchAttendanceByDate(date, signal) {
  const d = await apiFetch(`${root()}/attendance/date/paginated?date=${date}&page=0&size=100`, { signal });
  return (d?.content ?? []).map((a) => ({ ...a, section: lower(a.section), lines: a.lines ?? [] }));
}

export async function fetchAttendanceByUser(userId, signal) {
  const d = await apiFetch(`${root()}/attendance/user/${userId}/paginated?page=0&size=100`, { signal });
  return (d?.content ?? []).map((a) => ({ ...a, section: lower(a.section), line: a.lines ?? [] }));
}

// produktivitas harian satu QC (hari lampau di-cache)
const prodCache = new Map();
export const clearProductivityCache = () => prodCache.clear();

export async function fetchProductivity(userId, date) {
  const key = `${userId}|${date}`;
  if (prodCache.has(key)) return prodCache.get(key);
  const d = await apiFetch(`${root()}/management/productivity/${userId}/daily?date=${date}`);
  const s = d?.summary ?? {};
  const v = {
    actual: s.inspectedQuantity ?? 0,
    target: s.targetQuantity ?? 0,
    rate: s.productivityRate ?? 0,
    effectiveMinutes: s.effectiveMinutes ?? 0,
    slots: d?.hourlyProductivities ?? [],
  };
  if (date !== todayISO()) prodCache.set(key, v);
  return v;
}

export const correctAttendance = (id, body) =>
  apiFetch(
    isSuper() ? `/super-admin/attendance/status/correction/${id}` : `/admin/attendance/${id}/correction`,
    { method: "PUT", body },
  );

export const markAttendance = (body) =>
  apiFetch(isSuper() ? "/super-admin/attendance/status" : "/admin/attendance/correction", {
    method: "POST",
    body,
  });