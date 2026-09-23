"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { formatSom, formatQty } from "@/lib/format";

type Tab = "stock" | "profit" | "shifts" | "dead" | "demand";

const TABS: { key: Tab; label: string }[] = [
  { key: "stock", label: "Qoldiq hisoboti" },
  { key: "profit", label: "Foyda-zarar" },
  { key: "shifts", label: "Smenalar" },
  { key: "dead", label: "Harakatsiz tovarlar" },
  { key: "demand", label: "Talab qilingan" },
];

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("stock");

  return (
    <div className="p-6">
      <h1 className="font-condensed text-2xl font-bold mb-5">Hisobotlar</h1>
      <div className="flex border border-divider w-fit mb-5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`h-10 px-4 text-sm font-condensed font-semibold ${
              tab === t.key ? "bg-accent text-white" : "bg-white text-text/70"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "stock" && <StockTab />}
      {tab === "profit" && <ProfitTab />}
      {tab === "shifts" && <ShiftsTab />}
      {tab === "dead" && <DeadStockTab />}
      {tab === "demand" && <DemandTab />}
    </div>
  );
}

function useReportData<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    api
      .get<T>(path)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Xatolik yuz berdi"));
  }, [path]);

  return { data, error };
}

interface StockRow {
  productId: string;
  name: string;
  stock: string;
  avgCost: string;
  costValue: string;
  saleValue: string;
}

function StockTab() {
  const { data, error } = useReportData<StockRow[]>("/reports/stock");
  if (error) return <div className="text-error-text text-sm">{error}</div>;
  if (!data) return <div className="text-text/50 text-sm">Yuklanmoqda...</div>;

  return (
    <div className="border border-divider bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-divider text-left text-text/60">
            <th className="px-4 py-2.5 font-medium">Tovar</th>
            <th className="px-4 py-2.5 font-medium">Miqdor</th>
            <th className="px-4 py-2.5 font-medium">Tannarx summasi</th>
            <th className="px-4 py-2.5 font-medium">Sotuv narxi summasi</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-10 text-center text-text/50">
                Ma&apos;lumot yo&apos;q
              </td>
            </tr>
          ) : (
            data.map((r) => (
              <tr key={r.productId} className="border-b border-divider last:border-0">
                <td className="px-4 py-2.5">{r.name}</td>
                <td className="px-4 py-2.5">{formatQty(r.stock)}</td>
                <td className="px-4 py-2.5">{formatSom(r.costValue)}</td>
                <td className="px-4 py-2.5">{formatSom(r.saleValue)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

interface ProfitRow {
  label: string;
  revenue: string;
  cost: string;
  profit: string;
}

function ProfitTab() {
  const [groupBy, setGroupBy] = useState<"period" | "product" | "category">("period");
  const { data, error } = useReportData<ProfitRow[]>(`/reports/profit?groupBy=${groupBy}`);

  return (
    <div>
      <div className="flex border border-divider w-fit mb-4">
        {(["period", "product", "category"] as const).map((g) => (
          <button
            key={g}
            onClick={() => setGroupBy(g)}
            className={`h-9 px-3 text-sm ${groupBy === g ? "bg-accent text-white" : "bg-white text-text/70"}`}
          >
            {g === "period" ? "Davr bo'yicha" : g === "product" ? "Tovar bo'yicha" : "Kategoriya bo'yicha"}
          </button>
        ))}
      </div>
      {error && <div className="text-error-text text-sm">{error}</div>}
      {!error && !data && <div className="text-text/50 text-sm">Yuklanmoqda...</div>}
      {data && (
        <div className="border border-divider bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-divider text-left text-text/60">
                <th className="px-4 py-2.5 font-medium">{groupBy === "period" ? "Sana" : groupBy === "product" ? "Tovar" : "Kategoriya"}</th>
                <th className="px-4 py-2.5 font-medium">Tushum</th>
                <th className="px-4 py-2.5 font-medium">Tannarx</th>
                <th className="px-4 py-2.5 font-medium">Foyda</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-text/50">
                    Bu oraliqda sotuv yo&apos;q
                  </td>
                </tr>
              ) : (
                data.map((r) => (
                  <tr key={r.label} className="border-b border-divider last:border-0">
                    <td className="px-4 py-2.5">{r.label}</td>
                    <td className="px-4 py-2.5">{formatSom(r.revenue)}</td>
                    <td className="px-4 py-2.5 text-text/70">{formatSom(r.cost)}</td>
                    <td className="px-4 py-2.5 font-medium">{formatSom(r.profit)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface ShiftRow {
  id: string;
  openedBy: { name: string };
  status: "OPEN" | "CLOSED";
  openingCash: string;
  expectedCash: string | null;
  countedCash: string | null;
  diffCash: string | null;
  openedAt: string;
  closedAt: string | null;
}

function ShiftsTab() {
  const { data, error } = useReportData<ShiftRow[]>("/shifts");
  if (error) return <div className="text-error-text text-sm">{error}</div>;
  if (!data) return <div className="text-text/50 text-sm">Yuklanmoqda...</div>;

  return (
    <div className="border border-divider bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-divider text-left text-text/60">
            <th className="px-4 py-2.5 font-medium">Ochilgan</th>
            <th className="px-4 py-2.5 font-medium">Kassir</th>
            <th className="px-4 py-2.5 font-medium">Holat</th>
            <th className="px-4 py-2.5 font-medium">Boshlang&apos;ich</th>
            <th className="px-4 py-2.5 font-medium">Kutilgan</th>
            <th className="px-4 py-2.5 font-medium">Sanalgan</th>
            <th className="px-4 py-2.5 font-medium">Farq</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-text/50">
                Smenalar yo&apos;q
              </td>
            </tr>
          ) : (
            data.map((s) => (
              <tr key={s.id} className="border-b border-divider last:border-0">
                <td className="px-4 py-2.5">{new Date(s.openedAt).toLocaleString("uz-UZ")}</td>
                <td className="px-4 py-2.5">{s.openedBy.name}</td>
                <td className="px-4 py-2.5">{s.status === "OPEN" ? "Ochiq" : "Yopiq"}</td>
                <td className="px-4 py-2.5">{formatSom(s.openingCash)}</td>
                <td className="px-4 py-2.5">{s.expectedCash !== null ? formatSom(s.expectedCash) : "—"}</td>
                <td className="px-4 py-2.5">{s.countedCash !== null ? formatSom(s.countedCash) : "—"}</td>
                <td
                  className={`px-4 py-2.5 ${
                    s.diffCash === null
                      ? "text-text/40"
                      : Number(s.diffCash) < 0
                        ? "text-error-text"
                        : Number(s.diffCash) > 0
                          ? "text-warning-text"
                          : "text-success-text"
                  }`}
                >
                  {s.diffCash !== null ? formatSom(s.diffCash) : "—"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

interface DeadStockRow {
  productId: string;
  name: string;
  stock: string;
  lastSoldAt: string | null;
}

interface DemandRow {
  productId: string;
  name: string;
  stock: string;
  requestCount: number;
}

function DemandTab() {
  const { data, error } = useReportData<DemandRow[]>("/reports/demand?days=30");
  if (error) return <div className="text-error-text text-sm">{error}</div>;
  if (!data) return <div className="text-text/50 text-sm">Yuklanmoqda...</div>;

  return (
    <div>
      <p className="text-sm text-text/60 mb-3">
        Oxirgi 30 kunda mijozlar so&apos;ragan, lekin qoldig&apos;i tugagan tovarlar — xarid rejasi uchun.
      </p>
      <div className="border border-divider bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-divider text-left text-text/60">
              <th className="px-4 py-2.5 font-medium">Tovar</th>
              <th className="px-4 py-2.5 font-medium">Qoldiq</th>
              <th className="px-4 py-2.5 font-medium">So&apos;ralgan soni</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-text/50">
                  So&apos;rov yo&apos;q
                </td>
              </tr>
            ) : (
              data.map((r) => (
                <tr key={r.productId} className="border-b border-divider last:border-0">
                  <td className="px-4 py-2.5">{r.name}</td>
                  <td className="px-4 py-2.5">{formatQty(r.stock)}</td>
                  <td className="px-4 py-2.5 font-medium">{r.requestCount}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DeadStockTab() {
  const { data, error } = useReportData<DeadStockRow[]>("/reports/dead-stock?days=30");
  if (error) return <div className="text-error-text text-sm">{error}</div>;
  if (!data) return <div className="text-text/50 text-sm">Yuklanmoqda...</div>;

  return (
    <div className="border border-divider bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-divider text-left text-text/60">
            <th className="px-4 py-2.5 font-medium">Tovar</th>
            <th className="px-4 py-2.5 font-medium">Qoldiq</th>
            <th className="px-4 py-2.5 font-medium">Oxirgi sotuv sanasi</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-4 py-10 text-center text-text/50">
                Harakatsiz tovar yo&apos;q
              </td>
            </tr>
          ) : (
            data.map((r) => (
              <tr key={r.productId} className="border-b border-divider last:border-0">
                <td className="px-4 py-2.5">{r.name}</td>
                <td className="px-4 py-2.5">{formatQty(r.stock)}</td>
                <td className="px-4 py-2.5 text-warning-text">
                  {r.lastSoldAt ? new Date(r.lastSoldAt).toLocaleDateString("uz-UZ") : "Hech qachon"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
