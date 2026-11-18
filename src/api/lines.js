import { apiFetch } from "./client";
import { loadSession } from "../auth/session.js";

const base = () => (loadSession()?.user?.role === "super_admin" ? "/super-admin" : "/admin");
const lower = (v) => (v ? String(v).toLowerCase() : null);

const fromApi = (l) => ({
    id: l.id,
    name: l.name ?? String(l.id),
    section: lower(l.section),
    active: l.active !== false,
});

export async function fetchSectionLines(section, signal){
    const data = await apiFetch(`${base()}/lines/all`, { signal });
    return (Array.isArray(data) ? data : [])
        .map(fromApi)
        .filter((l) => l.section === section)
        .sort((a, b) => a.name.localCompare(b.name, undefined, { numberic: true }));
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
    apiFetch(`${base()}/lines/${id}/status?=${active}`, { method: "PATCH"});
