import { useState } from "react";
import StatusBar from "./StatusBar.jsx";
import { SECTIONS } from "../config/sections.js";
import { useMyAttendance, todayISO, shift, rangeOf } from "../api/attendanceHistory.js";
import "./DashboardUser.css";
import "./Users.css";
import "./AttendanceAdmin.css";
import "./AttendanceHistory.css";

const TZ = "Asia/Jakarta";
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const dp = (iso) => { const [y, m, d] = iso.split("-").map(Number); return { y, m: m - 1, d }; };
const label = (mode, [from, to]) => {
  if (mode === "daily")
    return new Date(`${from}T12:00:00+07:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: TZ });
  const a = dp(from), b = dp(to);
  if (mode === "monthly") return `${MONTHS[a.m]} ${a.y}`;
  return a.m === b.m ? `${a.d} – ${b.d} ${MONTHS[b.m]} ${b.y}` : `${a.d} ${MONTHS[a.m].slice(0, 3)} – ${b.d} ${MONTHS[b.m].slice(0, 3)} ${b.y}`;
};
const dayText = (iso) =>
  new Date(`${iso}T12:00:00+07:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: TZ });
const clock = (t) => (t ? new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).replace(":", ".") : "–");
const dur = (m) => (m == null ? "–" : `${Math.floor(m / 60)}h ${m % 60}min`);
const tone = (r) => (r >= 90 ? "ok" : r >= 70 ? "warn" : "bad");
const secLabel = (s) => String(SECTIONS[String(s).toLowerCase()]?.label ?? s ?? "").toUpperCase();
const lineText = (lines) => {
  const n = (lines ?? []).map((l) => l.name).join(", ");
  return n ? (/^line/i.test(n) ? n.toUpperCase() : `LINE ${n.toUpperCase()}`) : "NO LINE";
};
const STATUS = { INCOMPLETE: ["No check-out", "warn"], ABSENT: ["Absent", "bad"], PERMISSION: ["Permission", "info"] };

export default function AttendanceHistory({ onBack }) {
  const [mode, setMode] = useState("daily");
  const [anchor, setAnchor] = useState(todayISO());
  const { range, recs, perf, loading, error, reload, mock } = useMyAttendance(mode, anchor);

  const next = rangeOf(mode, shift(mode, anchor, 1))[0] > todayISO();
  const present = recs.filter((a) => a.status === "PRESENT");
  const minutes = present.reduce((s, a) => s + (a.effectiveMinutes ?? a.workingMinutes ?? 0), 0);

  return (
    <main className="dash us-bg">
      <StatusBar />
      <div className="dash-inner us aa">
        <header className="us-head">
          <button type="button" className="us-back" aria-label="Back" onClick={onBack}>‹</button>
          <h1 className="us-title">Attendance</h1>
        </header>

        {mock && <p className="ah-mock" role="note">Sample data. Live attendance history is not available from the server yet.</p>}

        <div className="aa-tabs" role="tablist" aria-label="Period">
          {[["daily", "DAILY"], ["weekly", "WEEKLY"], ["monthly", "MONTHLY"]].map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={mode === k} className={mode === k ? "on" : ""}
              onClick={() => { setMode(k); setAnchor(todayISO()); }}>
              {l}
            </button>
          ))}
        </div>

        <div className="aa-nav">
          <button type="button" aria-label="Previous period" onClick={() => setAnchor(shift(mode, anchor, -1))}>‹</button>
          <span>{label(mode, range)}</span>
          <button type="button" aria-label="Next period" disabled={next} onClick={() => setAnchor(shift(mode, anchor, 1))}>›</button>
        </div>

        {mode !== "daily" && !loading && !error && recs.length > 0 && (
          <p className="ah-summary">
            <b>{present.length}</b> days present · <b>{dur(minutes)}</b> worked
          </p>
        )}

        {error ? (
          <div className="us-banner" role="alert"><p>{error}</p><button type="button" onClick={reload}>Retry</button></div>
        ) : (
          <ul className="aa-list one" aria-busy={loading}>
            {loading && <li className="us-empty">Loading…</li>}
            {!loading && recs.length === 0 && <li className="us-empty">No attendance record for this period.</li>}
            {!loading && recs.map((a) => {
              const st = STATUS[a.status];
              const p = perf[a.attendanceDate];
              const r = p ? Math.round(p.rate) : null;
              const pill = st ? st[0] : r != null ? `${r}%` : a.checkInAt ? "…" : "Present";
              const t = st ? st[1] : r != null ? tone(r) : "info";
              return (
                <li key={a.id} className="aa-card">
                  <div className="aa-main">
                    <strong className="aa-name">{dayText(a.attendanceDate)}</strong>
                    <p className="aa-sub">
                      {secLabel(a.section)} . {lineText(a.lines)}
                      {p && <> | <b>{p.actual}/{p.target}</b></>}
                      {a.checkOutAt && <> | {dur(a.effectiveMinutes ?? a.workingMinutes)}</>}
                    </p>
                    {a.checkInAt && <p className="aa-sub">In {clock(a.checkInAt)} · Out {clock(a.checkOutAt)}</p>}
                  </div>
                  <span className={`aa-pill ${t}`}>{pill}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}