import { useCallback, useEffect, useState } from "react";
import StatusBar from "./StatusBar.jsx";
import {
  fetchSectionLines,
  createLine,
  renameLine,
  setLineActive,
} from "../api/lines.js";
import "./DashboardUser.jsx";
import "./Users.css";
import "./Lines.css";

const friendly = (e) => {
  const m = e?.message || "";
  if (/sudah digunakan/i.test(m)) return "A line with this name already exits.";
  return m || "Something went wrong. Please try again.";
};

export default function Lines({ section = "sewing", onBack }) {
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setLoadError("");
    fetchSectionLines(section)
      .then(setLines)
      .catch((e) => setLoadError(e?.message || "Failed to load lines."))
      .finally(() => setLoading(false));
  }, [section]);

  useEffect(load, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const run = async (job, okMsg) => {
    setBusy(true);
    setError("");
    try {
      await job();
      setToast(okMsg);
      load();
      return true;
    } catch (e) {
      setError(friendly(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setError("Please enter a line name.");
    if (await run(() => createLine(n, section), `Line "${n}" added.`))
      setName("");
  };

  const saveEdit = async (l) => {
    const n = editName.trim();
    if (!n) return setError("Line name cannot be empty.");
    if (n === l.name) return setEditId(null);
    if (await run(() => renameLine(l.id, n, section), "Line renamed."))
        setEditId(null);
    };

   const toggle = (l) =>
    run(
        () => setLineActive(l.id, !l.active),
        l.active ? `Line "${l.name}" deactivated.` : `Line "${l.name}" activated.`,
    );

  const activeCount = lines.filter((l) => l.active).length;

  return (
    <main className="dash us-bg">
      <StatusBar />
      <div className="dash-inner us">
        <header className="us-head">
          <button
            type="button"
            className="us-back"
            aria-label="Back"
            onClick={onBack}
          >
            ‹
          </button>
          <h1 className="us-title">Lines</h1>
        </header>

        {toast && (
          <p className="us-toast" role="status">
            {toast}
          </p>
        )}

        <form className="ln-add" onSubmit={add}>
          <label htmlFor="ln-name">Add new line</label>
          <div className="ln-add-row">
            <input
              id="ln-name"
              value={name}
              maxLength={30}
              placeholder="e.g. Line 7"
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
            />
            <button type="submit" disabled={busy}>
              Add
            </button>
          </div>
        </form>

        {loadError ? (
          <div className="us-banner" role="alert">
            <p>{loadError}</p>
            <button type="button" onClick={load}>
              Retry
            </button>
          </div>
        ) : (
          <ul className="us-list">
            {!loading && lines.length === 0 && (
              <li className="us-empty">
                {" "}
                No lines yet. Add the first one above.
              </li>
            )}
            {lines.map((l) => (
              <li key={l.id} className={`ln-row${l.active ? "" : " off"}`}>
                {editId === l.id ? (
                  <div className="ln-edit">
                    <input
                      value={editName}
                      maxLength={30}
                      autoFocus
                      aria-label="Line name"
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveEdit(l)}
                    />
                    <button
                      type="button"
                      className="solid"
                      disabled={busy}
                      onClick={() => saveEdit(l)}
                    >
                      Save
                    </button>
                    <button type="button" onClick={() => setEditId(null)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="ln-info">
                      <strong>{l.name}</strong>
                      <span className={`us-badge ${l.active ? "on" : "off"}`}>
                        {l.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="ln-actions">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setEditId(l.id);
                          setEditName(l.name);
                          setError("");
                        }}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => toggle(l)}
                      >
                        {l.active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
