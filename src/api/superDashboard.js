import { useEffect, useState } from "react";
import { fetchCuttingReport } from "./cutting.js";
import { fetchMyInspections, loadDefectTypes } from "./inspections.js";

/* Ringkasan Super Admin: tiap section untuk tanggal terpilih dan hari sebelumnya
   (untuk delta "vs yesterday"). Section inspeksi dihitung dari daftar inspeksinya
   (laporan harian super admin tidak lagi memisah section). Cutting memakai laporan harian.
   Hari ini diperbarui otomatis (polling). Final tetap data tiruan. */

export const LIVE_SECTIONS = ["cutting", "sewing", "washing", "finishing", "packing"];
export const SECTION_NAME = {
  cutting: "Cutting",
  sewing: "Sewing",
  washing: "Washing",
  finishing: "Finishing",
  packing: "Packing",
};

const REFRESH_MS = 30000;

const pad2 = (n) => String(n).padStart(2, "0");
const isoOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const todayISO = () => isoOf(new Date());
const dayBefore = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return isoOf(new Date(y, m - 1, d - 1));
};

const pctChange = (a, b) => (b ? +(((a - b) / b) * 100).toFixed(1) : 0);
const passOf = (qty, def) => (qty ? +(100 - (def / qty) * 100).toFixed(1) : 0);

const nameKey = (s) => String(s ?? "").trim().toUpperCase().replace(/\s+/g, " ");

// laporan cutting -> { inspections, qty, defects, types }
const adaptReport = (rep) => {
  const types = new Map();
  const add = (name, n) => {
    if (!name || !(n > 0)) return;
    const k = nameKey(name);
    const c = types.get(k) ?? { name: String(name).trim(), count: 0 };
    c.count += n;
    types.set(k, c);
  };
  (rep?.defectSummaries ?? []).forEach((d) => add(d.defectType, d.totalDefects));
  (rep?.processSummaries ?? []).forEach((p) =>
    (p.detailRows ?? []).forEach((r) => add(r.defectTypeName, r.quantityDefect)),
  );
  return {
    inspections: rep?.totalInspections ?? rep?.totalInspection ?? 0,
    qty: rep?.totalQuantityInspect ?? 0,
    defects: rep?.totalDefects ?? 0,
    types: [...types.values()],
  };
};

// daftar inspeksi -> { inspections, qty, defects, types } untuk satu tanggal
function adaptList(list, typesById, iso) {
  const day = list.filter((x) => x.createdAt && isoOf(new Date(x.createdAt)) === iso);
  const types = new Map();
  let qty = 0;
  let defects = 0;
  day.forEach((x) => {
    qty += x.inspectQuantity ?? 0;
    defects += x.totalDefect ?? 0;
    (x.defects ?? []).forEach((d) => {
      const name = (typesById[d.defectTypeId]?.name ?? "Defect").trim();
      const k = nameKey(name);
      const c = types.get(k) ?? { name, count: 0 };
      c.count += d.quantity ?? 0;
      types.set(k, c);
    });
  });
  return { inspections: day.length, qty, defects, types: [...types.values()] };
}

// laporan cutting hari yang sudah lewat tidak berubah lagi, jadi boleh disimpan
const cache = new Map();
async function loadCutting(date, signal) {
  const old = date < dayBefore(todayISO());
  const k = `cutting|${date}`;
  if (old && cache.has(k)) return cache.get(k);
  const v = adaptReport(await fetchCuttingReport("daily", date, signal));
  if (old) cache.set(k, v);
  return v;
}

const sumOf = (rows) =>
  rows.reduce(
    (a, r) => ({
      inspections: a.inspections + r.inspections,
      qty: a.qty + r.qty,
      defects: a.defects + r.defects,
    }),
    { inspections: 0, qty: 0, defects: 0 },
  );

// mock: { kpi, sections, topDefects } dari superDay(date) — dipakai untuk Final dan Active QC
export function useSuperDay(date, mock) {
  const [state, setState] = useState({
    data: null, loading: true, error: "", failed: [], updatedAt: null, refreshKey: 0, forDate: null,
  });
  const [tick, setTick] = useState(0);

  // refresh otomatis hanya untuk hari ini
  useEffect(() => {
    if (date !== todayISO()) return undefined;
    const bump = () => { if (!document.hidden) setTick((n) => n + 1); };
    const t = setInterval(bump, REFRESH_MS);
    document.addEventListener("visibilitychange", bump);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", bump);
    };
  }, [date]);

  useEffect(() => {
    const ctrl = new AbortController();
    // loading penuh hanya saat ganti tanggal; refresh berkala berjalan diam-diam
    setState((s) => (s.forDate === date ? s : { ...s, data: null, loading: true, error: "", forDate: date }));
    const prevDate = dayBefore(date);

    const typesP = loadDefectTypes().catch(() => []);

    const jobs = LIVE_SECTIONS.map((sec) => {
      if (sec === "cutting") {
        return Promise.allSettled([loadCutting(date, ctrl.signal), loadCutting(prevDate, ctrl.signal)]);
      }
      const listP = fetchMyInspections(sec, ctrl.signal);
      const bundle = Promise.all([listP, typesP]).then(([list, types]) => ({
        list,
        byId: Object.fromEntries(types.map((t) => [t.id, t])),
      }));
      return Promise.allSettled([
        bundle.then((b) => adaptList(b.list, b.byId, date)),
        bundle.then((b) => adaptList(b.list, b.byId, prevDate)),
      ]);
    });

    Promise.all(jobs).then((results) => {
      if (ctrl.signal.aborted) return;

      const rows = [];
      const failed = [];
      results.forEach(([cur, prv], i) => {
        const sec = LIVE_SECTIONS[i];
        if (cur.status !== "fulfilled") {
          if (cur.reason?.name !== "AbortError") failed.push(SECTION_NAME[sec]);
          return;
        }
        rows.push({
          key: sec,
          cur: cur.value,
          prev: prv.status === "fulfilled" ? prv.value : null,
        });
      });

      if (rows.length === 0) {
        // saat refresh diam-diam gagal, tampilan lama dipertahankan
        setState((s) =>
          s.data
            ? { ...s, failed }
            : { ...s, data: null, loading: false, error: "Failed to load data. Please try again.", failed },
        );
        return;
      }

      const cur = sumOf(rows.map((r) => r.cur));
      // delta hanya membandingkan section yang datanya ada di kedua hari
      const both = rows.filter((r) => r.prev);
      const curCmp = sumOf(both.map((r) => r.cur));
      const prev = sumOf(both.map((r) => r.prev));
      const curPass = passOf(cur.qty, cur.defects);
      const prevPass = passOf(prev.qty, prev.defects);
      const curCmpPass = passOf(curCmp.qty, curCmp.defects);

      const sections = rows
        .filter((r) => r.cur.inspections > 0 || r.cur.qty > 0)
        .map((r) => ({
          key: r.key,
          name: SECTION_NAME[r.key],
          pct: Math.round(passOf(r.cur.qty, r.cur.defects)),
          inspections: r.cur.inspections,
          defects: r.cur.defects,
          top: [...r.cur.types].sort((a, b) => b.count - a.count).slice(0, 3),
        }));

      // Top Defects: gabung antar section menurut nama defect
      const merged = new Map();
      rows.forEach((r) =>
        r.cur.types.forEach((t) => {
          const k = nameKey(t.name);
          const c = merged.get(k) ?? { name: t.name, count: 0 };
          c.count += t.count;
          merged.set(k, c);
        }),
      );
      const topDefects = [...merged.values()].sort((a, b) => b.count - a.count).slice(0, 3);

      // Final: data tiruan, diberi tanda
      const finalRow = mock.sections.find((s) => s.key === "final");
      if (finalRow) sections.push({ ...finalRow, sample: true });

      setState({
        data: {
          kpi: {
            inspections: {
              value: cur.inspections,
              delta: pctChange(curCmp.inspections, prev.inspections),
            },
            passRate: {
              value: curPass,
              delta: +(curCmpPass - prevPass).toFixed(1),
            },
            defects: { value: cur.defects, delta: pctChange(curCmp.defects, prev.defects) },
          },
          sections,
          topDefects,
        },
        loading: false,
        error: "",
        failed,
        updatedAt: Date.now(),
        refreshKey: tick,
        forDate: date,
      });
    });

    return () => ctrl.abort();
  }, [date, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}