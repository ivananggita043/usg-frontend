import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "./client.js";
import { mapLimit } from "./attendanceAdmin.js";

const USE_MOCK = true; // ubah ke false setelah backend punya endpoint riwayat user
const TZ = "Asia/Jakarta";

export const todayISO = () => new Date().toLocaleDateString("sv-SE", { timeZone: TZ });

/* ---------- data tiruan (bentuk sama dengan AttendanceResponse) ---------- */
const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9973, 7);

function mockAll() {
  const out = [];
  let i = 0;
  for (let n = 0; out.length < 40; n += 1) {
    const d = new Date(Date.now() - n * 86400000);
    if (d.toLocaleDateString("en-US", { weekday: "short", timeZone: TZ }) === "Sun") continue;
    const day = d.toLocaleDateString("sv-SE", { timeZone: TZ });
    const base = { id: `m${i}`, attendanceDate: day, section: "SEWING", lines: [{ id: "l3", name: "3" }] };
    if (i % 11 === 6) {
      out.push({ ...base, status: i % 2 ? "ABSENT" : "PERMISSION" });
    } else {
      const noOut = i === 0 || i % 9 === 4;
      const inAt = new Date(`${day}T0${7 + (i % 2)}:${i % 2 ? "05" : "52"}:00+07:00`);
      const outAt = new Date(`${day}T17:0${i % 6}:00+07:00`);
      const work = Math.round((outAt - inAt) / 60000);
      out.push({
        ...base,
        checkInAt: inAt.toISOString(),
        checkOutAt: noOut ? null : outAt.toISOString(),
        breakMinutes: 60,
        effectiveMinutes: noOut ? null : work - 60,
        workingMinutes: noOut ? null : work,
        status: noOut ? "INCOMPLETE" : "PRESENT",
      });
    }
    i += 1;
  }
  return out;
}

async function fetchAll(signal) {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 250));
    return mockAll();
  }
  const d = await apiFetch("/user/attendance/paginated?page=0&size=100", { signal }); // endpoint tebakan
  return (d?.content ?? []).map((a) => ({ ...a, lines: a.lines ?? [] }));
}

async function fetchPerf(date) {
  if (USE_MOCK) {
    const h = hash(date);
    const target = 320 + (h % 9) * 10;
    return { actual: Math.round(target * (0.55 + (h % 45) / 100)), target, rate: 0 };
  }
  const d = await apiFetch(`/user/productivity/daily?date=${date}`);
  const s = d?.summary ?? {};
  return { actual: s.inspectedQuantity ?? 0, target: Math.round(s.targetQuantity ?? 0), rate: s.productivityRate ?? 0 };
}

/* ---------- tanggal ---------- */
export const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekStart = (iso) => addDays(iso, -((new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7));
const monthStart = (iso) => `${iso.slice(0, 8)}01`;
const monthEnd = (iso) => {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};
export const rangeOf = (mode, a) =>
  mode === "daily" ? [a, a] : mode === "weekly" ? [weekStart(a), addDays(weekStart(a), 6)] : [monthStart(a), monthEnd(a)];
export const shift = (mode, a, dir) =>
  mode === "daily" ? addDays(a, dir) : mode === "weekly" ? addDays(a, 7 * dir)
  : dir < 0 ? addDays(monthStart(a), -1) : addDays(monthEnd(a), 1);

/* ---------- hook ---------- */
export function useMyAttendance(mode, anchor) {
  const [all, setAll] = useState(null);
  const [perf, setPerf] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError("");
    fetchAll(ctrl.signal)
      .then((r) => { setAll(r); setLoading(false); })
      .catch((e) => {
        if (e?.name === "AbortError") return;
        setError(e?.message || "Failed to load attendance.");
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [tick]);

  const range = useMemo(() => rangeOf(mode, anchor), [mode, anchor]);
  const recs = useMemo(
    () => (all ?? []).filter((a) => a.attendanceDate >= range[0] && a.attendanceDate <= range[1])
      .sort((a, b) => (a.attendanceDate < b.attendanceDate ? 1 : -1)),
    [all, range],
  );

  // persen performa per hari (bertahap)
  useEffect(() => {
    let off = false;
    const need = recs.filter((a) => a.checkInAt && a.status !== "ABSENT" && a.status !== "PERMISSION");
    mapLimit(need, 6, async (a) => {
      const p = await fetchPerf(a.attendanceDate);
      const rate = p.rate || (p.target ? (p.actual / p.target) * 100 : 0);
      if (!off) setPerf((prev) => ({ ...prev, [a.attendanceDate]: { ...p, rate } }));
    });
    return () => { off = true; };
  }, [recs]);

  return { range, recs, perf, loading, error, reload: () => setTick((t) => t + 1), mock: USE_MOCK };
}