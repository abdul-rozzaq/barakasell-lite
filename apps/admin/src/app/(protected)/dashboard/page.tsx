"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { formatSom, formatQty } from "@/lib/format";

interface TopProduct {
  productId: string;
  name: string;
  qty: string;
}

interface LowStockItem {
  id: string;
  name: string;
  stock: string;
}

interface RecentShift {
  id: string;
  openedAt: string;
  closedAt: string | null;
  status: "OPEN" | "CLOSED";
  cashierName: string;
  revenue: string;
  diffCash: string | null;
}

interface DashboardData {
  todayRevenue: string;
  todayProfit: string;
  todayCashDiff: string;
  openShiftsCount: number;
  topProducts: TopProduct[];
  lowStock: LowStockItem[];
  recentShifts: RecentShift[];
}

function diffColor(value: number) {
  if (value > 0) return "text-[color:var(--color-success-text)]";
  if (value < 0) return "text-[color:var(--color-error-text)]";
  return "text-text/70";
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DashboardData>("/reports/dashboard")
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Xatolik yuz berdi"));
  }, []);

  if (error) {
    return <div className="p-6 text-[color:var(--color-error-text)]">{error}</div>;
  }
  if (!data) {
    return <div className="p-6 text-text/60">Yuklanmoqda...</div>;
  }

  const cashDiff = Number(data.todayCashDiff);

  return (
    <div className="p-6">
      <h1 className="font-condensed text-2xl font-bold mb-5">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-surface p-4">
          <div className="text-sm text-text/60">Bugungi tushum</div>
          <div className="font-condensed text-2xl font-bold mt-1">{formatSom(data.todayRevenue)}</div>
        </div>
        <div className="bg-surface p-4">
          <div className="text-sm text-text/60">Bugungi foyda</div>
          <div className="font-condensed text-2xl font-bold mt-1">{formatSom(data.todayProfit)}</div>
        </div>
        <div className="bg-surface p-4">
          <div className="text-sm text-text/60">Naqd farqi</div>
          <div className={`font-condensed text-2xl font-bold mt-1 ${diffColor(cashDiff)}`}>
            {formatSom(data.todayCashDiff)}
          </div>
        </div>
        <div className="bg-surface p-4">
          <div className="text-sm text-text/60">Ochiq smenalar</div>
          <div className="font-condensed text-2xl font-bold mt-1">{data.openShiftsCount}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div>
          <h2 className="font-condensed text-lg font-semibold mb-2">Top sotilgan tovarlar (bugun)</h2>
          <div className="border border-divider bg-white">
            {data.topProducts.length === 0 ? (
              <div className="px-4 py-6 text-center text-text/50 text-sm">Bugun hali sotuv yo&apos;q</div>
            ) : (
              data.topProducts.map((p) => (
                <div key={p.productId} className="flex justify-between px-4 py-2 border-b border-divider last:border-0 text-sm">
                  <span>{p.name}</span>
                  <span className="font-condensed font-semibold">{formatQty(p.qty)}</span>
                </div>
              ))
            )}
          </div>
        </div>
        <div>
          <h2 className="font-condensed text-lg font-semibold mb-2">Qoldig&apos;i tugayotgan tovarlar</h2>
          <div className="border border-divider bg-white">
            {data.lowStock.length === 0 ? (
              <div className="px-4 py-6 text-center text-text/50 text-sm">Kam qolgan tovar yo&apos;q</div>
            ) : (
              data.lowStock.map((p) => (
                <div key={p.id} className="flex justify-between px-4 py-2 border-b border-divider last:border-0 text-sm">
                  <span>{p.name}</span>
                  <span className="font-condensed font-semibold text-[color:var(--color-error-text)]">
                    {formatQty(p.stock)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <h2 className="font-condensed text-lg font-semibold mb-2">Oxirgi smenalar</h2>
      <div className="border border-divider bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-divider text-left text-text/60">
              <th className="px-4 py-2.5 font-medium">Sana</th>
              <th className="px-4 py-2.5 font-medium">Kassir</th>
              <th className="px-4 py-2.5 font-medium">Holat</th>
              <th className="px-4 py-2.5 font-medium">Tushum</th>
              <th className="px-4 py-2.5 font-medium">Naqd farqi</th>
            </tr>
          </thead>
          <tbody>
            {data.recentShifts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-text/50">
                  Smenalar yo&apos;q
                </td>
              </tr>
            ) : (
              data.recentShifts.map((s) => (
                <tr key={s.id} className="border-b border-divider last:border-0">
                  <td className="px-4 py-2.5">{new Date(s.openedAt).toLocaleString("uz-UZ")}</td>
                  <td className="px-4 py-2.5">{s.cashierName}</td>
                  <td className="px-4 py-2.5">{s.status === "OPEN" ? "Ochiq" : "Yopiq"}</td>
                  <td className="px-4 py-2.5">{formatSom(s.revenue)}</td>
                  <td className={`px-4 py-2.5 ${s.diffCash !== null ? diffColor(Number(s.diffCash)) : "text-text/40"}`}>
                    {s.diffCash !== null ? formatSom(s.diffCash) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
