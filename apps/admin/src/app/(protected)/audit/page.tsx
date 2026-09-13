"use client";

import { useEffect, useState, useCallback } from "react";
import { api, ApiError } from "@/lib/api";

interface AuditRow {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  detail: Record<string, unknown>;
  ip: string | null;
  createdAt: string;
  user: { name: string } | null;
}

const ACTION_COLOR: Record<string, string> = {
  Sotuv: "text-[color:var(--color-accent-tint-text)] bg-[color:var(--color-accent-tint-bg)]",
  Qaytarish: "text-[color:var(--color-warning-text)] bg-[color:var(--color-warning-bg)]",
  Inventarizatsiya: "text-[color:var(--color-warning-text)] bg-[color:var(--color-warning-bg)]",
  "O'chirish": "text-[color:var(--color-error-text)] bg-[color:var(--color-error-bg)]",
};

function actionClass(action: string) {
  return ACTION_COLOR[action] ?? "text-text/70 bg-surface";
}

export default function AuditPage() {
  const [items, setItems] = useState<AuditRow[]>([]);
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState<"loading" | "ok" | "empty" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const params = new URLSearchParams();
      if (action) params.set("action", action);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await api.get<AuditRow[]>(`/audit?${params.toString()}`);
      setItems(res);
      setStatus(res.length === 0 ? "empty" : "ok");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
      setStatus("error");
    }
  }, [action, from, to]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="p-6">
      <h1 className="font-condensed text-2xl font-bold mb-5">Audit log</h1>

      <div className="flex gap-3 mb-4">
        <input
          placeholder="Amal bo'yicha qidirish..."
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="h-10 px-3 border border-divider bg-white text-sm w-56 outline-none focus:border-accent"
        />
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="h-10 px-3 border border-divider bg-white text-sm"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="h-10 px-3 border border-divider bg-white text-sm"
        />
      </div>

      <div className="border border-divider bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-divider text-left text-text/60">
              <th className="px-4 py-2.5 font-medium">Vaqt</th>
              <th className="px-4 py-2.5 font-medium">Foydalanuvchi</th>
              <th className="px-4 py-2.5 font-medium">Amal</th>
              <th className="px-4 py-2.5 font-medium">Tafsilot</th>
            </tr>
          </thead>
          <tbody>
            {status === "loading" &&
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-divider">
                  <td colSpan={4} className="px-4 py-3">
                    <div className="h-4 bg-black/[.05] animate-pulse w-full" />
                  </td>
                </tr>
              ))}
            {status === "empty" && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-text/50">
                  Yozuvlar topilmadi
                </td>
              </tr>
            )}
            {status === "error" && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center">
                  <span className="text-[color:var(--color-error-text)]">{error}</span>{" "}
                  <button onClick={load} className="text-accent underline ml-2">
                    Qayta urinish
                  </button>
                </td>
              </tr>
            )}
            {status === "ok" &&
              items.map((row) => (
                <tr key={row.id} className="border-b border-divider last:border-0 align-top">
                  <td className="px-4 py-2.5 whitespace-nowrap">{new Date(row.createdAt).toLocaleString("uz-UZ")}</td>
                  <td className="px-4 py-2.5">{row.user?.name ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 text-xs ${actionClass(row.action)}`}>{row.action}</span>
                  </td>
                  <td className="px-4 py-2.5 text-text/70 max-w-md truncate" title={JSON.stringify(row.detail)}>
                    {JSON.stringify(row.detail)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
