import { apiFetch } from "./client";
import { loadSession } from "../auth/session.js";

const base = () => (loadSession()?.user?.role === "super_admin" ? "/super-admin" : "/admin");
const lower = (v) => (v ? String(v).toLowerCase() : null);

const fromApi = (l) => ({
    id: l.id,
    name: String(l.name ?? l.id),
    section: lower(l.section),
    active: l.active !== false,
});

const numOf = (s) => {
    const m = /\d+/.exec(s);
    return m ? Number(m[0]) : Infinity;
};

export async function fetchSectionLines(section, signal) {
    const data = await apiFetch(`${base()}/lines/all`, { signal });
    return (Array.isArray(data) ? data : [])
        .map(fromApi)
        .filter((l) => l.section === section)
        .sort(
            (a, b) =>
                numOf(a.name) - numOf(b.name) ||
                a.name.localeCompare(b.name, undefined, { numeric: true })
        );
}

export const createLine = (name, section) =>
    apiFetch(`${base()}/lines`, {
        method: "POST",
        body: { name: name.trim(), section: section.toUpperCase() },
    });

export const renameLine = (id, name, section) =>
    apiFetch(`${base()}/lines/${id}`, {
        method: "PUT",
        body: { name: name.trim(), section: section.toUpperCase() },
    });

export const setLineActive = (id, active) =>
    apiFetch(`${base()}/lines/${id}/status?active=${active}`, { method: "PATCH" });
