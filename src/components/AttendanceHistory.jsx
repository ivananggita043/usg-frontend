import { useState } from "react";
import StatusBar from "./StatusBar.jsx";
import Pager from "./Pager.jsx";
import { useAttendanceHistory } from "../api/attendanceHistory.js";
import "./DashboardUser.css";
import "./Users.css";
import "./AttendanceHistory.css";

const TZ = "Asia/Jakarta";
const STATUS = {
  PRESENT: ["Present", "ok"],
  INCOMPLETE: ["No check-out", "warn"],
  ABSENT: ["Absent", "bad"],
  PERMISSION: ["Permission", "info"],
};

const dayText = (iso) =>
  new Date(`${iso}T12:00:00+07:00`).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: TZ,
  });
const clock = (t) =>
  t ? new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).replace(":", ".") : "–";
const dur = (m) => (m == null ? "–" : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}min`);

export default function AttendanceHistory({ onBack }) {
  const [page, setPage] = useState(1);
  const { items, total, loading, error, reload, mock } = useAttendanceHistory(page, 10);

  return (
    <main className="dash us-bg">
      <StatusBar />
      <div className="dash-inner us">
        <header className="us-head">
          <button type="button" className="us-back" aria-label="Back" onClick={onBack}>‹</button>
          <h1 className="us-title">Attendance</h1>
        </header>

        {mock && <p className="ah-mock" role="note">Sample data. Live attendance history is not available from the server yet.</p>}

        {error ? (
          <div className="us-banner" role="alert">
            <p>{error}</p>
            <button type="button" onClick={reload}>Retry</button>
          </div>
        ) : (
          <ul className="ah-list" aria-busy={loading}>
            {loading && items.length === 0 && <li className="us-empty">Loading…</li>}
            {!loading && items.length === 0 && <li className="us-empty">No attendance records yet.</li>}
            {items.map((a) => {
              const [label, tone] = STATUS[a.status] ?? [a.status, "info"];
              const lines = (a.lines ?? []).map((l) => l.name).join(", ");
              return (
                <li key={a.id} className={`ah-row ${tone}`}>
                  <div className="ah-top">
                    <strong>{dayText(a.attendanceDate)}</strong>
                    <span className={`ah-badge ${tone}`}>{label}</span>
                  </div>
                  {a.checkInAt ? (
                    <>
                      <p className="ah-times">In {clock(a.checkInAt)} · Out {clock(a.checkOutAt)}</p>
                      <p className="ah-sub">
                        {a.checkOutAt ? `${dur(a.effectiveMinutes ?? a.workingMinutes)} worked` : "Check-out missing"}
                        {lines ? ` · Line ${lines}` : ""}
                      </p>
                    </>
                  ) : (
                    <p className="ah-sub">No check-in on this day</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {!error && total > 10 && <Pager total={total} page={page} size={10} onPage={setPage} />}
      </div>
    </main>
  );
}