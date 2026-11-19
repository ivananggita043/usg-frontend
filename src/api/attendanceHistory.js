import { useEffect, useState } from "react";
import { apiFetch } from "./client.js";

const USE_MOCK = true; // ubah ke false setelah backend punya endpoint riwayat user
const PATH = "/user/attendance/paginated"; // tebakan, belum ada di backend

const TZ = "Asia/Jakarta";
const isoDay = (d) => d.toLocaleDateString("sv-SE", { timeZone: TZ });

// data tiruan: hari kerja ke belakang, bentuk sama dengan AttendanceResponse
function mockAll() {
    const out = [];
    const d = new Date();
    let n = 0;
    while (out.length < 34) {
        d.setDate(d.getDate() - (n === 0 ? 0 : 1));
        n += 1;
        if (d.getDay() === 0) continue;
        const i = out.length;
        const day = isoDay(d);
        const missed = i % 11 === 6;
        const noOut = i === 0 || i % 9 === 4;
        const inAt = new Date(`${day}T0${7 + (i % 2)}:${i % 2 ? "05" : "52"}:00+07:00`);
        const outAt = new Date(`${day}T17:0${i % 6}:00+07:00`);
        if (missed) {
            out.push({ id: `m${i}`, attendanceDate: day, status: i % 2 ? "ABSENT" : "PERMISSION", lines: [] });
            continue;
        }
        const work = Math.round((outAt - inAt) / 60000);
        out.push({
            id: `m${i}`,
            attendanceDate: day,
            checkInAt: inAt.toISOString(),
            checkOutAt: noOut ? null : outAt.toISOString(),
            workingMinutes: noOut ? null : work,
            breakMinutes: noOut ? null : 60,
            effectiveMinutes: noOut ? null : work - 60,
            status: noOut ? "INCOMPLETE" : "PRESENT",
            lines: [{ id: "l3", name: "3" }],
        });
    }
    return out;
}

async function fetchPage(page, size, signal) {
    if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 300));
        const all = mockAll();
        return { items: all.slice((page - 1) * size, page * size), total: all.length };
    }
    const d = await apiFetch(`${PATH}?page=${page - 1}&size=${size}`, { signal });
    return {
        items: d?.content ?? [],
        total: d?.totalElements ?? d?.page?.totalElements ?? 0,
    };
}

export function useAttendanceHistory(page, size) {
    const [state, setState] = useState({ items: [], total: 0, loading: true, error: "" });
    const [tick, setTick] = useState(0);

    useEffect(() => {
        const ctrl = new AbortController();
        setState((s) => ({ ...s, loading: true, error: "" }));
        fetchPage(page, size, ctrl.signal)
            .then((r) => setState({ ...r, loading: false, error: "" }))
            .catch((e) => {
                if (e?.name === "AbortError") return;
                setState((s) => ({ ...s, loading: false, error: e?.message || "Failed to load attendance." }));
            });
        return () => ctrl.abort();
    }, [page, size, tick]);

    return { ...state, reload: () => setTick((t) => t + 1), mock: USE_MOCK };
}