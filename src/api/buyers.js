import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "./client";
import { loadSession } from "../auth/session";

const pathFor = (role) =>
    role === "super_admin"
        ? "/super-admin/inspections/all/buyer"
        : role === "admin"
            ? "/admin/inspections/all/buyer"
            : "/user/inspections/all/buyer";

const TTL_MS = 15000;
let cache = null; // { role, list, at }

const cachedFor = (role) => (cache && cache.role === role ? cache : null);

export async function fetchBuyers(force) {
    const role = loadSession()?.user?.role;
    const c = cachedFor(role);
    if (c && !force && Date.now() - c.at < TTL_MS) return c.list;
    const d = await apiFetch(pathFor(role));
    const list = (Array.isArray(d) ? d : (d?.content ?? []))
        .map((b) => ({ id: b.id, name: String(b.name ?? "").trim() }))
        .filter((b) => b.id && b.name)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    cache = { role, list, at: Date.now() };
    return list; 
}

// nama buyer -> id (cocok tanpa membedakan huruf besar/kecil)
export async function buyerIdOf(name) {
    const key = String(name ?? "").trim().toLowerCase();
    const find = (list) => list.find((b) => b.name.toLowerCase() === key);
    let hit = find(await fetchBuyers());
    if (!hit) hit = find(await fetchBuyers(true)); // mungkin buyer baru, ambil ulang sekali
    if (!hit)
        throw new Error(
            `Buyer "${name}" is not in the buyer list. Please contact your admin to add it.`,
        );
    return hit.id;
}

export function useBuyers() {
    const role = loadSession()?.user?.role;
    const [state, setState] = useState(() => {
        const c = cachedFor(role);
        return { buyers: c?.list ?? [], loading: !c, error: "" };
    });
    const [tick, setTick] = useState(0);

    useEffect(() => {
        let off = false;
        setState((s) => ({ ...s, loading: s.buyers.length === 0, error: ""}));
        fetchBuyers(true) // selalu ambil data terbaru saat from dibuka
            .then((buyers) => !off  && setState({ buyers, loading: false, error: "" }))
            .catch(
                (e) =>
                    !off &&
                setState((s) => ({
                    buyers: s.buyers,
                    loading: false,
                    error: s.buyers.length ? "" : e?.message || "Failed to load buyers.",
                })),
            );
        return () => {
            off = true;
        };
    }, [tick]);

    const reload = useCallback(() => setTick((t) => t + 1), []);
    return { ...state, reload };
}



