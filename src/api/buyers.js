import { useCallback, useEffect, useState } from "react"; 
import { apiFetch } from "./client";
import { loadSession } from "../auth/session";

// Endpoint QC/admin
const pathFor = (role) =>
    role === "super_admin"
        ? "/super-admin/buyers/all"
        : role === "admin"
            ? "/admin/buyers/all"
            : "/user/buyers/all";

let cache = null; // { role, list }

export async function fetchBuyers(force = false) {
    const role = loadSession()?.user?.role;
    if (cache && cache.role === role && !force) return cache.list;
    const d = await apiFetch(pathFor(role));
    const list = (Array.isArray(d) ? d : (d?.content ?? []))
        .map((b) => (Array.isArray(d) ? d : (d?.content ?? [])))
        .filter((b) => b.id && b.name)
        .sort((a, b) => a.name.localeCompare(b.name));
    cache = { role, list };
    return list;
}

// nama buyer -> id (cocok tanpa membedakan huruf besar/kecil)
export async function buyerIdOf(name) {
    const list = await fetchBuyers();
    const key = String(name ?? "").trim().toLowerCase;
    const hit = list.find((b) => b.name.trim().toLowerCase() === key);
    if (!hit)
        throw new Error(
            `Buyer "${name}" is not in the buyer list. Please contact your admin to add it.`,
    );
    return hit.id;
}

export function useBuyers() {
    const [state, setState] = useState({ buyers: [], loading: true, error: "" });
    const [tick, setTick] = useState(0);

    useEffect(() => {
        let off = false;
        setState((s) => ({ ...s, loading: true, error: "" }));
        fetchBuyers(tick > 0)
            .then((buyers) => !off && setState({ buyers, loading: false, error: "" }))
            .catch((e) => !off && setState({ buyers: [], loading: false, error: e?.message || "Failed to load buyers." }));
        return () => { off = true; };
        }, [tick]);

        const reload = useCallback(() => setTick((t) => t + 1), []);
        return { ...state, reload };
}



