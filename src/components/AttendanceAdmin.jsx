import { useEffect, useMemo, useState } from "react";
import StatusBar from "./StatusBar.jsx";
import { fetchUsers } from "../api/users.js";
import {
  fetchAttendanceByDate,
  fetchProductivity,
  correctAttendance,
  markAttendance,
  clearProductivityCache,
  mapLimit,
} from "../api/attendanceAdmin.js";
import { SECTIONS } from "../config/sections.js";
import "./DashboardUser.css";
import "./Users.css";
import "./AttendanceAdmin.css";
import AttendanceDetail from "./AttendanceDetail.jsx";
import { DEFAULT_AQL } from "../config/aql.js";

const TZ = "Asia/Jakarta";
const todayISO = () => new Date().toLocaleDateString("sv-SE", { timeZone: TZ });

/* ---------- tanggal ---------- */
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const addDays = (iso, n) => {
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
const rangeOf = (mode, a) =>
  mode === "daily" ? [a, a] : mode === "weekly" ? [weekStart(a), addDays(weekStart(a), 6)] : [monthStart(a), monthEnd(a)];
const shift = (mode, a, dir) =>
  mode === "daily" ? addDays(a, dir) : mode === "weekly" ? addDays(a, 7 * dir)
  : dir < 0 ? addDays(monthStart(a), -1) : addDays(monthEnd(a), 1);
const dp = (iso) => { const [y, m, d] = iso.split("-").map(Number); return { y, m: m - 1, d }; };
const label = (mode, [from, to]) => {
  if (mode === "daily")
    return new Date(`${from}T12:00:00+07:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: TZ });
  const a = dp(from), b = dp(to);
  if (mode === "monthly") return `${MONTHS[a.m]} ${a.y}`;
  return a.m === b.m ? `${a.d} – ${b.d} ${MONTHS[b.m]} ${b.y}` : `${a.d} ${MONTHS[a.m].slice(0, 3)} – ${b.d} ${MONTHS[b.m].slice(0, 3)} ${b.y}`;
};

/* ---------- format ---------- */
const clock = (t) => (t ? new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ }) : "");
const dur = (m) => (m == null ? "–" : `${Math.floor(m / 60)}h ${m % 60}min`);
const toMin = (hm) => { const [h, m] = hm.split(":").map(Number); return h * 60 + m; };
const toInstant = (date, hm) => `${date}T${hm}:00+07:00`;
const secLabel = (s) => String(SECTIONS[s]?.label ?? s ?? "").toUpperCase();
const lineText = (lines) => {
  const n = (lines ?? []).map((l) => l.name).join(", ");
  return n ? (/^line/i.test(n) ? n.toUpperCase() : `LINE ${n.toUpperCase()}`) : "NO LINE";
};
const toneOfRate = (r) => (r >= 90 ? "ok" : r >= 70 ? "warn" : "bad");
const STATUS = {
  INCOMPLETE: ["No check-out", "warn"],
  ABSENT: ["Absent", "bad"],
  PERMISSION: ["Permission", "info"],
};

export default function AttendanceAdmin({ isSuper, onBack }) {
  const [mode, setMode] = useState("daily");
  const [anchor, setAnchor] = useState(todayISO());
  const [filter, setFilter] = useState({ section: "all", lineId: "all" });
  const [sort, setSort] = useState("low");
  const [users, setUsers] = useState([]);
  const [recs, setRecs] = useState([]);
  const [perf, setPerf] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const [sheet, setSheet] = useState(null); // { kind: "filter" | "edit" | "mark", item? }
  const [toast, setToast] = useState("");
  const [detail, setDetail] = useState(null);

  const range = useMemo(() => rangeOf(mode, anchor), [mode, anchor]);
  const dates = useMemo(() => {
    const out = [];
    const last = range[1] < todayISO() ? range[1] : todayISO();
    for (let d = range[0]; d <= last; d = addDays(d, 1)) out.push(d);
    return out;
  }, [range]);

  useEffect(() => {
    let off = false;
    setLoading(true);
    setError("");
    setPerf({});
    (async () => {
      try {
        const [byDay, us] = await Promise.all([
          mapLimit(dates, 5, async (d) => (await fetchAttendanceByDate(d)).map((x) => ({ ...x, _date: d }))),
          fetchUsers(),
        ]);
        if (off) return;
        if (dates.length && byDay.every((x) => x === null)) throw new Error("Failed to load attendance.");
        const flat = byDay.flat().filter(Boolean);
        setUsers(us.filter((u) => u.role === "user"));
        setRecs(flat);
        setLoading(false);
        if (mode === "daily") {
          await mapLimit(flat.filter((r) => r.checkInAt), 6, async (r) => {
            const p = await fetchProductivity(r.userId, r._date);
            if (!off) setPerf((prev) => ({ ...prev, [r.userId]: p }));
          });
        }
      } catch (e) {
        if (off) return;
        setError(e?.message || "Failed to load attendance.");
        setLoading(false);
      }
    })();
    return () => { off = true; };
  }, [mode, dates, tick]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const nameOf = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u.nama])), [users]);
  const workDays = dates.filter((d) => new Date(`${d}T12:00:00Z`).getUTCDay() !== 0).length;

  const passes = (section, lineIds) =>
    (filter.section === "all" || section === filter.section) &&
    (filter.lineId === "all" || lineIds.includes(filter.lineId));

  // satu baris per orang
  const items = useMemo(() => {
    if (mode === "daily") {
      return recs
        .filter((a) => passes(a.section, a.lines.map((l) => l.id)))
        .map((a) => {
          const p = perf[a.userId];
          const st = STATUS[a.status];
          const base = { key: a.id, rec: a, name: nameOf[a.userId] ?? a.username, head: `${secLabel(a.section)} . ${lineText(a.lines)}` };
          if (st) return { ...base, pill: st[0], tone: st[1], rate: null, tail: a.checkInAt ? `In ${clock(a.checkInAt)}` : "No check-in" };
          if (!p) return { ...base, pill: "…", tone: "info", rate: null, tail: dur(a.effectiveMinutes ?? a.workingMinutes) };
          const r = Math.round(p.rate);
          return { ...base, pill: `${r}%`, tone: toneOfRate(r), rate: r, out: `${p.actual}/${Math.round(p.target)}`, tail: dur(a.effectiveMinutes ?? a.workingMinutes) };
        });
    }
    const byUser = new Map();
    recs.forEach((a) => {
      const o = byUser.get(a.userId) ?? { rec: a, present: 0, minutes: 0 };
      if (a.status === "PRESENT") {
        o.present += 1;
        o.minutes += a.effectiveMinutes ?? a.workingMinutes ?? 0;
      }
      if (a._date >= o.rec._date) o.rec = a;
      byUser.set(a.userId, o);
    });
    return [...byUser.values()]
      .filter((o) => passes(o.rec.section, o.rec.lines.map((l) => l.id)))
      .map((o) => {
        const r = workDays ? Math.round((o.present / workDays) * 100) : 0;
        return {
          userId: o.rec.userId,
          key: o.rec.userId, rec: null,
          name: nameOf[o.rec.userId] ?? o.rec.username,
          head: `${secLabel(o.rec.section)} . ${lineText(o.rec.lines)}`,
          pill: `${r}%`, tone: toneOfRate(r), rate: r,
          out: `${o.present}/${workDays} days`, tail: dur(o.minutes),
        };
      });
  }, [mode, recs, perf, nameOf, filter, workDays]); // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = [...items].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    const ra = a.rate ?? (sort === "low" ? 1e9 : -1);
    const rb = b.rate ?? (sort === "low" ? 1e9 : -1);
    return sort === "low" ? ra - rb : rb - ra;
  });

  const missing = useMemo(() => {
    if (mode !== "daily") return [];
    const seen = new Set(recs.map((a) => a.userId));
    return users.filter(
      (u) => u.active && !seen.has(u.id) && passes(u.section, u.lineIds ?? []),
    );
  }, [mode, recs, users, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const lineOptions = useMemo(() => {
    const m = new Map();
    recs.forEach((a) => {
      if (filter.section !== "all" && a.section !== filter.section) return;
      a.lines.forEach((l) => m.set(l.id, l.name));
    });
    return [...m].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [recs, filter.section]);

  const filterText = (() => {
    const s = filter.section === "all" ? (isSuper ? "All sections" : "All lines") : secLabel(filter.section);
    const l = lineOptions.find((x) => x.id === filter.lineId)?.name;
    return l ? `${filter.section === "all" ? "" : `${s} · `}Line ${l}` : s;
  })();

  const reload = () => { clearProductivityCache(); setTick((t) => t + 1); };
  const saved = (msg) => { setSheet(null); setToast(msg); reload(); };
  const nextDisabled = shift(mode, anchor, 1) > todayISO() && rangeOf(mode, shift(mode, anchor, 1))[0] > todayISO();

  if (detail) {
    return (
      <AttendanceDetail 
        {...detail}
        Edit={EditSheet}
        onBack={() => { setDetail(null); reload(); }}
      />
    );
  }

  return (
    <main className="dash us-bg">
      <StatusBar />
      <div className="dash-inner us aa">
        <header className="us-head">
          <button type="button" className="us-back" aria-label="Back" onClick={onBack}>‹</button>
          <h1 className="us-title">Attendance</h1>
        </header>

        {toast && <p className="us-toast" role="status">{toast}</p>}

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
          <button type="button" aria-label="Next period" disabled={nextDisabled} onClick={() => setAnchor(shift(mode, anchor, 1))}>›</button>
        </div>

        <div className="aa-filterbar">
          <button type="button" className="aa-filterbtn" onClick={() => setSheet({ kind: "filter" })}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" />
            </svg>
            {filterText}
          </button>
        </div>

        <label className="aa-sort">
          <span className="sr">Sort by</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="low">Lowest performance first</option>
            <option value="high">Highest performance first</option>
            <option value="name">Name A–Z</option>
          </select>
        </label>
        {mode !== "daily" && <p className="aa-note">Weekly and monthly show attendance (days present ÷ working days). Open a day to see output and target.</p>}

        {error ? (
          <div className="us-banner" role="alert"><p>{error}</p><button type="button" onClick={reload}>Retry</button></div>
        ) : (
          <ul className="aa-list" aria-busy={loading}>
            {loading && <li className="us-empty">Loading…</li>}
            {!loading && sorted.length === 0 && missing.length === 0 && <li className="us-empty">No attendance records for this period.</li>}
            {!loading && sorted.map((it) => (
              <li key={it.key} className="aa-card">
                {it.userId ? (
                  <button
                    type="button"
                    className="aa-main aa-open"
                    aria-label={`Open Attendance details for ${it.name}`}
                    onClick={() => setDetail({ userId: it.userId, name: it.name, head: it.head, range, rangeLabel: label(mode, range) })}
                  >
                    <strong className="aa-name">{it.name}</strong>
                    <p className="aa-sub">
                      {it.head}
                      {it.out && <> | <b>{it.out}</b></>}
                      {it.tail && <> | {it.tail}</>}
                    </p>
                  </button>
                ) : (
                  <div className="aa-main">
                    <strong className="aa-name">{it.name}</strong>
                    <p className="aa-sub">
                        {it.head}
                        {it.out && <> | <b>{it.out}</b></>}
                        {it.tail && <> | {it.tail} </>}
                    </p>
                  </div>
                )}
                <span className={`aa-pill ${it.tone}`}>{it.pill}</span>
                {it.rec ? (
                  <button type="button" className={`aa-edit ${it.tone}`} aria-label={`Edit attendance ${it.name}`} onClick={() => setSheet({ kind: "edit", item: it })}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M4 4h91-2 2H6v12h12v-5l2-2v9H4V4z" />
                      <path d="M18.6 3.4l2 2-8.2 8.2-2.8.8.8-2.8 8.2-8.2z" />
                    </svg>
                  </button>
                ) : (
                  <span className="aa-go" aria-hidden="true">›</span>
                )}
              </li>
            ))}
          </ul>
        )}

        {!loading && missing.length > 0 && (
          <>
            <h2 className="aa-h">Not checked in ({missing.length})</h2>
            <ul className="aa-list">
              {missing.map((u) => (
                <li key={u.id} className="aa-card">
                  <div className="aa-main">
                    <strong className="aa-name">{u.nama}</strong>
                    <p className="aa-sub">{secLabel(u.section)} · @{u.username}</p>
                  </div>
                  <button type="button" className="aa-mark" onClick={() => setSheet({ kind: "mark", item: u })}>Mark</button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {sheet?.kind === "filter" && (
        <FilterSheet
          isSuper={isSuper}
          value={filter}
          lineOptions={lineOptions}
          onClose={() => setSheet(null)}
          onApply={(f) => { setFilter(f); setSheet(null); }}
        />
      )}
      {sheet?.kind === "edit" && (
        <EditSheet
          rec={sheet.item.rec}
          name={sheet.item.name}
          perf={perf[sheet.item.rec.userId]}
          onClose={() => setSheet(null)}
          onSaved={saved}
        />
      )}
      {sheet?.kind === "mark" && (
        <MarkSheet user={sheet.item} date={anchor} onClose={() => setSheet(null)} onSaved={saved} />
      )}
    </main>
  );
}

/* ---------- Filter ---------- */
function FilterSheet({ isSuper, value, lineOptions, onClose, onApply }) {
  const [f, setF] = useState(value);
  const sections = ["all", ...Object.keys(SECTIONS)];
  return (
    <div className="aa-overlay" onClick={onClose}>
      <div className="aa-sheet" role="dialog" aria-modal="true" aria-label="Filter" onClick={(e) => e.stopPropagation()}>
        <h2>Filter</h2>

        {isSuper && (
          <>
            <p className="aa-lbl">Section</p>
            <div className="aa-chips">
              {sections.map((s) => (
                <button key={s} type="button" aria-pressed={f.section === s} className={f.section === s ? "on" : ""}
                  onClick={() => setF({ section: s, lineId: "all" })}>
                  {s === "all" ? "All" : secLabel(s)}
                </button>
              ))}
            </div>
          </>
        )}

        <p className="aa-lbl">Line</p>
        <div className="aa-chips">
          <button type="button" aria-pressed={f.lineId === "all"} className={f.lineId === "all" ? "on" : ""} onClick={() => setF({ ...f, lineId: "all" })}>All</button>
          {lineOptions.map((l) => (
            <button key={l.id} type="button" aria-pressed={f.lineId === l.id} className={f.lineId === l.id ? "on" : ""} onClick={() => setF({ ...f, lineId: l.id })}>
              Line {l.name}
            </button>
          ))}
        </div>

        <div className="aa-btns col">
          <button type="button" onClick={() => setF({ section: "all", lineId: "all" })}>Reset</button>
          <button type="button" className="solid" onClick={() => onApply(f)}>Show Results</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Edit Attendance ---------- */
function EditSheet({ rec, name, perf, onClose, onSaved }) {
  const date = rec._date ?? rec.attendanceDate;
  const [tin, setTin] = useState(clock(rec.checkInAt));
  const [tout, setTout] = useState(clock(rec.checkOutAt));
  const [reason, setReason] = useState("");
  const [active, setActive] = useState("in"); // kotak jam yang sedang diedit: "in" | "out"
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // slot produktivitas pertama/terakhir yang ada produksinya
  const used = (perf?.slots ?? []).filter((s) => s.inspectedQuantity > 0 && /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(s.timeSlot));
  const first = used.length ? used[0].timeSlot.slice(0, 5) : null;
  const last = used.length ? used[used.length - 1].timeSlot.slice(6) : null;

  // pratinjau Hours / Target / Performance
  const effOld = rec.effectiveMinutes ?? rec.workingMinutes ?? null;
  const span = tin && tout ? toMin(tout) - toMin(tin) : null;
  const effNew = span != null && span > 0 ? span - (rec.breakMinutes ?? 0) : null;
  const hOld = perf?.effectiveMinutes ? Math.floor(perf.effectiveMinutes / 60) : 0;
  const perHour = perf && hOld > 0 ? perf.target / hOld : null;
  const tgtNew = perHour != null && effNew != null ? Math.round(perHour * Math.floor(effNew / 60)) : null;
  const rateNew = tgtNew ? Math.round((perf.actual / tgtNew) * 100) : null;
  const arrow = (a, b) => `${a ?? "–"}  →  ${b ?? "–"}`;

  const save = async (status) => {
    if (!reason.trim()) return setErr("Please write the reason for this change.");
    let body = { status, reason: reason.trim() };
    if (status === "PRESENT") {
      if (!tin) return setErr("Please enter the check-in time.");
      if (!tout && rec.status !== "INCOMPLETE") return setErr("Please enter the check-out time.");
      if (tout && toMin(tout) <= toMin(tin)) return setErr("Check-out must be after check-in.");
      body = { ...body, status: tout ? "PRESENT" : "INCOMPLETE", checkInAt: toInstant(date, tin), checkOutAt: tout ? toInstant(date, tout) : null };
    }
    setBusy(true);
    setErr("");
    try {
      await correctAttendance(rec.id, body);
      onSaved("Attendance updated.");
    } catch (e) {
      setErr(e?.message || "Could not save. Please try again.");
      setBusy(false);
    }
  };

  const dateText = new Date(`${date}T12:00:00+07:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: TZ });

  return (
    <div className="aa-overlay" onClick={busy ? undefined : onClose}>
      <div className="aa-sheet" role="dialog" aria-modal="true" aria-label="Edit attendance" onClick={(e) => e.stopPropagation()}>
        <h2>Edit Attendance</h2>
        <p className="aa-who">{name} . {dateText}</p>

        <div className="aa-times">
           <label className={`aa-time ${active === "in" ? "active" : ""}`} onClick={() => setActive("in")}>
              <span>Check in</span>
              <input 
                type="time"
                value={tin}
                aria-label="Check-in time"
                onFocus={() => setActive("in")}
                onChange={(e) => setTin(e.target.value)}
              />
              <em>click to edit</em>
          </label>
          <label className={`aa-time ${active === "out" ? "active" : ""}`} onClick={() => setActive("out")}>
          <span>Check out</span>
          <input 
          type="time"
          value={tout}
          aria-label="Check-out time"
          onFocus={() => setActive("out")}
          onChange={(e) => setTout(e.target.value)}
          />
          <em>click to edit</em>
          </label>
        </div>

        {first && (
          <div className={`aa-use ${active === "in" ? "active" : ""}`}>
            <span>1st inspection at {first}</span>
            <button type="button" onClick={() => { setTin(first); setActive("in"); }}>Use</button>
          </div>
        )}
        {last && (
          <div className={`aa-use ${active === "out" ? "active" : ""}`}>
            <span> Last inspection at {last}</span>
            <button type="button" onClick={() => { setTout(last); setActive("out"); }}>Use</button>
          </div>
        )}

        <label className="aa-lbl" htmlFor="aa-reason">Reason</label>
        <textarea id="aa-reason" rows={4} maxLength={200} placeholder="Tap to start writing…" value={reason} onChange={(e) => setReason(e.target.value)} />

        <dl className="aa-sum">
          <div><dt>Hours</dt><dd>{arrow(effOld != null ? dur(effOld) : null, effNew != null ? dur(effNew) : null)}</dd></div>
          <div><dt>Target</dt><dd>{arrow(perf ? Math.round(perf.target) : null, tgtNew)}</dd></div>
          <div><dt>Performance</dt><dd>{arrow(perf ? `${Math.round(perf.rate)}%` : null, rateNew != null ? `${rateNew}%` : null)}</dd></div>
        </dl>

        {err && <p className="aa-err" role="alert">{err}</p>}

        <div className="aa-btns col">
          <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="solid" onClick={() => save("PRESENT")} disabled={busy}>{busy ? "Saving…" : "Save Changes"}</button>
        </div>
        <div className="aa-alt">
          <button type="button" disabled={busy} onClick={() => save("ABSENT")}>Mark as Absent</button>
          <button type="button" disabled={busy} onClick={() => save("PERMISSION")}>Mark as Permission</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- QC yang belum check-in ---------- */
function MarkSheet({ user, date, onClose, onSaved }) {
  const [status, setStatus] = useState("ABSENT");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const save = async () => {
    if (!reason.trim()) return setErr("Please write the reason.");
    setBusy(true);
    setErr("");
    try {
      await markAttendance({ userId: user.id, attendanceDate: date, status, reason: reason.trim() });
      onSaved(`${user.nama} marked as ${status === "ABSENT" ? "Absent" : "Permission"}.`);
    } catch (e) {
      setErr(e?.message || "Could not save. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="aa-overlay" onClick={busy ? undefined : onClose}>
      <div className="aa-sheet" role="dialog" aria-modal="true" aria-label="Mark attendance" onClick={(e) => e.stopPropagation()}>
        <h2>Mark Attendance</h2>
        <p className="aa-who">{user.nama} . {date}</p>
        <div className="aa-chips">
          {[["ABSENT", "Absent"], ["PERMISSION", "Permission"]].map(([v, l]) => (
            <button key={v} type="button" aria-pressed={status === v} className={status === v ? "on" : ""} onClick={() => setStatus(v)}>{l}</button>
          ))}
        </div>
        <label className="aa-lbl" htmlFor="aa-mreason">Reason</label>
        <textarea id="aa-mreason" rows={4} maxLength={200} placeholder="Tap to start writing…" value={reason} onChange={(e) => setReason(e.target.value)} />
        {err && <p className="aa-err" role="alert">{err}</p>}
        <div className="aa-btns col">
          <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="solid" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save Changes"}</button>
        </div>
      </div>
    </div>
  );
}