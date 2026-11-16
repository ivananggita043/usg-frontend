import { useMemo, useState } from "react";
import { superDay } from "../mock/dashboardData.js";
import { SECTIONS } from "../config/sections.js";
import StatusBar from "./StatusBar";
import BuyerPerformance from "./BuyerPerformance.jsx";
import "./AdminDashboard.css";
import "./SuperAdminDashboard.css";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const longDate = (s) => { const d = fromISO(s); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const num = (n) => Number(n).toLocaleString("en-US");
const pct = (n) => `${Number(n).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
const level = (p) => (p >= 90 ? "good" : p >= 80 ? "warn" : "bad");
const TODAY = toISO(new Date());

export default function VisitorDemo({ onExit }) {
  const [date, setDate] = useState(TODAY);
  const d = useMemo(() => superDay(date), [date]);
  const maxDefect = Math.max(1, ...d.topDefects.map((x) => x.count));

  return (
    <main className="dash">
      <StatusBar />
      <div className="dash-inner">
        <div
          role="status"
          style={{ background: "#fff4d6", border: "1px solid #e0b64a", borderRadius: 10, padding: "12px 14px", margin: "0 0 14px", fontSize: 16, color: "#5a4300" }}
        >
          <strong>Visitor mode.</strong> All numbers below are sample data, not real production data.
        </div>

        <header className="dash-head">
          <div>
            <h1 className="dash-greeting">Welcome, <span className="code">Visitor!</span></h1>
            <p className="dash-area">Sample QC overview</p>
          </div>
        </header>

        <div className="datepick">
          <label style={{ fontSize: 16, display: "inline-flex", alignItems: "center", gap: 8 }}>
            {longDate(date)}
            <input
              type="date"
              value={date}
              max={TODAY}
              aria-label="Choose date"
              style={{ minHeight: 44, fontSize: 16 }}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </label>
        </div>

        <div className="sa-kpis">
          <Kpi label="Total Inspection" value={num(d.kpi.inspections.value)} delta={d.kpi.inspections.delta} upIsGood />
          <Kpi label="Pass Rate" value={pct(d.kpi.passRate.value)} delta={d.kpi.passRate.delta} upIsGood tone="green" />
          <Kpi label="Defects" value={num(d.kpi.defects.value)} delta={d.kpi.defects.delta} upIsGood={false} tone="red" />
          <Kpi label="Active QC" value={num(d.kpi.activeQc.value)} delta={d.kpi.activeQc.delta} upIsGood />
        </div>

        <h2 className="recent-title">Quality Performance</h2>
        <ul className="card sa-sections">
          {d.sections.map((s) => (
            <li key={s.key}>
              <div className={`sa-section ${level(s.pct)}`}>
                <div className="top"><span className="nm">{s.name}</span><strong>{s.pct}%</strong></div>
                <div className="bar" role="img" aria-label={`${s.name} ${s.pct} percent`}><i style={{ width: `${s.pct}%` }} /></div>
                <div className="meta">
                  <span>{num(s.inspections)} inspections</span>
                  <span>{num(s.defects)} defect</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <p className="perf-legend">Green 90% above · Yellow 80–89% · Red below 80%</p>

        <h2 className="recent-title">Top Defects</h2>
        <ul className="card sa-top">
          {d.topDefects.map((x, i) => (
            <li key={x.name}>
              <span className="rank">{i + 1}</span>
              <div className="grow">
                <div className="top"><span className="nm">{x.name}</span><strong>{x.count}</strong></div>
                <div className="bar red"><i style={{ width: `${(x.count / maxDefect) * 100}%` }} /></div>
              </div>
            </li>
          ))}
        </ul>

        <BuyerPerformance sections={Object.keys(SECTIONS)} date={date} />

        <button
          type="button"
          onClick={onExit}
          style={{ width: "100%", minHeight: 50, margin: "20px 0 32px", fontSize: 17, borderRadius: 10, border: "1px solid #5b5bd6", background: "#fff", color: "#5b5bd6" }}
        >
          Exit visitor mode
        </button>
      </div>
    </main>
  );
}

function Kpi({ label, value, delta, upIsGood, tone }) {
  const dir = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const good = dir === "flat" ? null : (dir === "up") === upIsGood;
  return (
    <div className="card sa-kpi">
      <p className="lbl">{label}</p>
      <p className={`val ${tone ?? ""}`}>{value}</p>
      <p className={`delta ${good === null ? "flat" : good ? "good" : "bad"}`}>
        <span aria-hidden="true">{dir === "up" ? "↑" : dir === "down" ? "↓" : "–"}</span>{" "}
        {Math.abs(delta).toLocaleString("en-US", { maximumFractionDigits: 1 })}%
        <span className="vs"> vs yesterday</span>
      </p>
    </div>
  );
}