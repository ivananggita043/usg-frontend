import { useEffect, useMemo, useState } from "react";
import StatusBar from "./StatusBar";
import { SECTIONS } from "../config/sections.js";
import {
  fetchAttendanceByUser,
  fetchProductivity,
  clearProductivityCache,
  mapLimit,
} from "../api/attendanceAdmin.js";
import "./DashboardUser.css";
import "./Users.css";
import "./AttendanceAdmin.css";
import "./AttendanceDetail.css";

const TZ = "Asia/Jakarta";
const todayISO = () => new Date().toLocaleDateString("sv-SE", { timeZone: TZ });
const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dayText = (iso) =>
  new Date(`${iso}T12:00:00+07:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    timeZone: TZ,
  });
const weekday = (iso) =>
  new Date(`${iso}T12:00:00+07:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    timeZone: TZ,
  });
const dur = (m) => (m == null ? "" : `${Math.floor(m / 60)}h ${m % 60}min`);
const tone = (r) => (r >= 90 ? "ok" : r >= 70 ? "warn" : "bad");
const secLabel = (s) =>
  String(SECTIONS[String(s).toLowerCase()]?.label ?? s ?? "").toUpperCase();
const lineText = (lines) => {
  const n = (lines ?? []).map((l) => l.name).join(", ");
  return n
    ? /^line/i.test(n)
      ? n.toUpperCase()
      : `LINE ${n.toUpperCase()}`
    : "NO LINE";
};
const STATUS = {
  INCOMPLETE: ["No check-out", "warn"],
  ABSENT: ["Absent", "bad"],
  PERMISSION: ["Permisson", "info"],
};

export default function AttendanceDetail({
  userId,
  name,
  head,
  range,
  rangeLabel,
  Edit,
  onBack,
}) {
  const [recs, setRecs] = useState([]);
  const [perf, setPerf] = useState({}); // per tanggal
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const [sort, setSort] = useState("low");
  const [edit, setEdit] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    let off = false;
    setLoading(true);
    setError("");
    setPerf({});
    (async () => {
      try {
        const all = await fetchAttendanceByUser(userId);
        if (off) return;
        const list = all
          .filter(
            (a) =>
              a.AttendanceDetail >= range[0] && a.attendanceDate <= range[1],
          )
          .map((a) => ({ ...a, _date: a.attendanceDate }));
        setRecs(list);
        setLoading(false);
        await mapLimit(
          list.filter(
            (a) =>
              a.checkInAt && a.status !== "ABSENT" && a.status !== "PERMISSION",
          ),
          6,
          async (a) => {
            const p = await fetchProductivity(userId, a._date);
            if (!off) setPerf((prev) => ({ ...prev, [a._date]: p }));
          },
        );
      } catch (e) {
        if (off) return;
        setError(e?.message || "Failed to load attendance.");
        setLoading(false);
      }
    })();
    return () => {
      off = true;
    };
  }, [userId, range, tick]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const byDate = useMemo(
    () => Object.fromEntries(recs.map((a) => [a._date, a])),
    [recs],
  );

  // satu batang per hari kerja (Senin-Sabtu) sampai hari ini
  const bars = useMemo(() => {
    const out = [];
    const last = range[1] < todayISO() ? range[1] : todayISO();
    for (let d = range[0]; d <= last; d = addDays(d, 1)) {
      if (new Date(`${d}T12:00:00Z`).getUTCDay() === 0) continue;
      const a = byDate[d];
      const p = perf[d];
      let kind = "none";
      let rate = 0;
      if (a && p) {
        kind = "rate";
        rate = Math.round(p.rate);
      } else if (a && p) {
        kind = "rate";
        rate = Math.round(p.rate);
      } else if (a) kind = "wait";
      out.push({ d, kind, rate });
    }
    return out;
  }, [range, byDate, perf]);

  const scale = Math.max(100, ...bars.map((b) => b.rate));
  const showValue = bars.length <= 7;

  const rows = useMemo(() => {
    const list = recs.map((a) => {
      const p = perf[a.date];
      const st = STATUS[a.status];
      const base = { rec: a, date: a._date };
      if (st)
        return {
          ...base,
          pill: st[0],
          tone: st[1],
          rate: a.status === "INCOMPLETE" ? null : 0,
        };
      if (!p) return { ...base, pill: "…", tone: "info", rate: null };
      const r = Math.round(p.rate);
      return {
        ...base,
        pill: `${r}%`,
        tone: tone(r),
        rate: r,
        out: `${p.actual}/${Math.round(p.target)}`,
      };
    });
    return list.sort((a, b) => {
      if (sort === "date") return a.date < b.date ? 1 : -1;
      const ra = a.rate ?? (sort === "low" ? 1e9 : -1);
      const rb = b.rate ?? (sort === "low" ? 1e9 : -1);
      return sort === "low" ? ra - rb : rb - ra;
    });
  }, [recs, perf, sort]);

  const reload = () => {
    clearProdictivityCache();
    setTick((t) => t + 1);
  };
  const saved = (msg) => {
    setEdit(null);
    setToast(msg);
    reload();
  };

  return (
    <main className="dash us-bg">
      <StatusBar />
      <div className="dash-inner us aa ad">
        <header className="us-head">
          <button
            type="button"
            className="us-back"
            aria-label="Back"
            onClick={onBack}
          >
            ‹
          </button>
          <h1 className="us-title">Attendance Details</h1>
        </header>

        {toast && (
          <p className="us-toast" role="status">
            {toast}
          </p>
        )}

        <h2 className="ad-name">{name}</h2>
        <p className="ad-meta">
          {head} | <span>{rangeLabel}</span>
        </p>

        <section className="ad-chart" aria-label="Daily performance chart">
          {bars.length === 0 ? (
            <p className="us-empty">No working days in this period yet.</p>
          ) : (
            <>
              <div
                className="ad-plot"
                role="img"
                aria-label={`Performance per day for ${name}`}
              >
                <span
                  className="ad-guide"
                  style={{ bottom: `${(100 / scale) * 100}%` }}
                  aria-hidden="true"
                />
                {bars.map((b) => (
                  <div key={b.d} className="ad=col">
                    {showValue && (
                      <span className="ad-val">
                        {b.kind === "rate"
                          ? `${b.rate}%`
                          : b.kind === "absent"
                            ? "Abs"
                            : b.kind === "wait"
                              ? "…"
                              : "-"}
                      </span>
                    )}
                    <span
                      className={`ad-bar ${b.kind === "rate" ? tone(b.rate) : b.kind}`}
                      style={{
                        height:
                          b.kind === "rate"
                            ? `${Math.max((b.rate / scale) * 100, 3)}%`
                            : "3%",
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="ad-axis" aria-hidden="true">
                {bars.map((b, i) => (
                  <span key={b.d}>
                    {bars.length <= 7
                      ? weekday(b.d)
                      : i % 5 === 0
                        ? Number(b.d.slice(8))
                        : ""}
                  </span>
                ))}
              </div>
              <p className="ad-legend">
                <i className="ok" /> 90%+ <i className="warn" /> 70-89%{" "}
                <i className="bad" /> Below 70%
              </p>
            </>
          )}
        </section>

        <label className="aa-sort">
          <span className="sr">Sort by</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="low">Lowest performance first</option>
            <option value="high">Highest performance first</option>
            <option value="date">Newest date first</option>
          </select>
        </label>

        {error ? (
          <div className="us-banner" role="alert">
            <p>{error}</p>
            <button type="button" onClick={reload}>
              Retry
            </button>
          </div>
        ) : (
          <ul className="aa-list one" aria-busy={loading}>
            {loading && <li className="us-empty">Loading…</li>}
            {!loading && rows.length === 0 && (
              <li className="us-empty">
                No attendance record for this period.
              </li>
            )}
            {!loading &&
              rows.map((r) => (
                <li key={r.rec.id} className="aa-card">
                  <div className="aa-main">
                    <strong className="aa-name">{dayText(r.date)}</strong>
                    <p className="aa-sub">
                      {secLabel(r.rec.section)} . {lineText(r.rec.lines)}
                      {r.out && (
                        <>
                          {" "}
                          | <b>{r.out}</b>
                        </>
                      )}
                      {r.rec.checkOutAt && (
                        <>
                          {" "}
                          |{" "}
                          {dur(r.rec.effectiveMinutes ?? r.rec.workingMinutes)}
                        </>
                      )}
                    </p>
                  </div>
                  <span className={`aa-pill ${r.tone}`}>{r.pill}</span>
                  <button
                    type="button"
                    className={`aa-edit ${r.tone}`}
                    aria-label={`Edit attendance ${dayText(r.date)}`}
                    onClick={() => setEdit(r)}
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M4 4h9l-2 2H6v12h12v-512-2v9H4V4z" />
                      <path d="M18.6 3.412 2-8.2 8.2-2.8.8.8-2.8 8.2-8.2z" />
                    </svg>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>

      {edit && (
        <Edit
          rec={edit.rec}
          name={name}
          perf={perf[edit.date]}
          onClose={() => setEdit(null)}
          onSaved={saved}
        />
      )}
    </main>
  );
}
