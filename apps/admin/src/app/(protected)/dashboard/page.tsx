"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
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
  totalProducts: number;
  totalCategories: number;
  totalStockCostValue: string;
  totalStockSaleValue: string;
  expectedProfit: string;
  todaySalesCount: number;
  avgCheckAmount: string;
  totalCustomerDebt: string;
  topProducts: TopProduct[];
  lowStock: LowStockItem[];
  recentShifts: RecentShift[];
}

function diffColor(value: number) {
  if (value > 0) return "text-success-text";
  if (value < 0) return "text-error-text";
  return "text-text/70";
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    setLoading(true);
    api
      .get<DashboardData>("/reports/dashboard")
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Xatolik yuz berdi"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (error) {
    return (
      <div className="p-6">
        <div className="border border-error-border bg-error-bg text-error-text p-4 text-sm mb-4">
          {error}
        </div>
        <button
          onClick={loadData}
          className="font-condensed h-9 px-4 bg-accent text-white font-semibold text-sm hover:bg-accent-dark"
        >
          Qayta urinish
        </button>
      </div>
    );
  }

  if (!data) {
    return <div className="p-6 text-text/60">Yuklanmoqda...</div>;
  }

  const cashDiff = Number(data.todayCashDiff);
  const stockSaleVal = Number(data.totalStockSaleValue) || 0;
  const expectedProfitVal = Number(data.expectedProfit) || 0;
  const stockMarginPct =
    stockSaleVal > 0 ? Math.round((expectedProfitVal / stockSaleVal) * 100) : 0;

  const todayRevVal = Number(data.todayRevenue) || 0;
  const todayProfVal = Number(data.todayProfit) || 0;
  const todayMarginPct =
    todayRevVal > 0 ? Math.round((todayProfVal / todayRevVal) * 100) : 0;

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-condensed text-2xl font-bold">Dashboard</h1>
          <p className="text-xs text-text/60 mt-0.5">
            Do&apos;konning umumiy tovar, savdo va kassa ko&apos;rsatkichlari
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="font-condensed h-9 px-3 border border-divider text-sm bg-white hover:bg-black/5 self-start sm:self-auto disabled:opacity-50"
        >
          {loading ? "Yangilanmoqda..." : "Yangilash"}
        </button>
      </div>

      {/* 1. Ombor va tovar ko'rsatkichlari */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-condensed text-lg font-semibold uppercase tracking-wide text-text/80">
            Ombor va tovarlar zaxirasi
          </h2>
          <Link href="/products" className="text-xs text-accent hover:underline">
            Barcha tovarlar →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface p-4 border border-divider flex flex-col justify-between">
            <div className="text-xs text-text/60 uppercase">Umumiy tovarlar</div>
            <div className="font-condensed text-2xl font-bold mt-1">
              {data.totalProducts} <span className="text-sm font-normal text-text/60">xil tovar</span>
            </div>
            <div className="text-xs text-text/50 mt-2">
              {data.totalCategories} ta kategoriyada
            </div>
          </div>

          <div className="bg-surface p-4 border border-divider flex flex-col justify-between">
            <div className="text-xs text-text/60 uppercase">Ombor tannarxi (Zaxira qiymati)</div>
            <div className="font-condensed text-2xl font-bold mt-1">
              {formatSom(data.totalStockCostValue)}
            </div>
            <div className="text-xs text-text/50 mt-2">
              Xarid qilingan tan narxi bo&apos;yicha
            </div>
          </div>

          <div className="bg-surface p-4 border border-divider flex flex-col justify-between">
            <div className="text-xs text-text/60 uppercase">Kutilayotgan tushum (Sotuv narxida)</div>
            <div className="font-condensed text-2xl font-bold mt-1">
              {formatSom(data.totalStockSaleValue)}
            </div>
            <div className="text-xs text-text/50 mt-2">
              Hamma tovar sotilgandagi umumiy summa
            </div>
          </div>

          <div className="bg-surface p-4 border border-divider flex flex-col justify-between">
            <div className="text-xs text-text/60 uppercase">Kutilayotgan foyda</div>
            <div className="font-condensed text-2xl font-bold mt-1 text-success-text">
              {formatSom(data.expectedProfit)}
            </div>
            <div className="text-xs text-text/50 mt-2">
              Rentabellik: <span className="font-semibold text-success-text">+{stockMarginPct}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Bugungi savdo ko'rsatkichlari */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-condensed text-lg font-semibold uppercase tracking-wide text-text/80">
            Bugungi savdo ko&apos;rsatkichlari
          </h2>
          <Link href="/sales" className="text-xs text-accent hover:underline">
            Sotuvlar tarixi →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface p-4 border border-divider flex flex-col justify-between">
            <div className="text-xs text-text/60 uppercase">Bugungi tushum</div>
            <div className="font-condensed text-2xl font-bold mt-1">
              {formatSom(data.todayRevenue)}
            </div>
            <div className="text-xs text-text/50 mt-2">
              Kunlik jami savdo aylanmasi
            </div>
          </div>

          <div className="bg-surface p-4 border border-divider flex flex-col justify-between">
            <div className="text-xs text-text/60 uppercase">Bugungi sof foyda</div>
            <div className="font-condensed text-2xl font-bold mt-1 text-success-text">
              {formatSom(data.todayProfit)}
            </div>
            <div className="text-xs text-text/50 mt-2">
              Kunlik marja: <span className="font-semibold text-success-text">+{todayMarginPct}%</span>
            </div>
          </div>

          <div className="bg-surface p-4 border border-divider flex flex-col justify-between">
            <div className="text-xs text-text/60 uppercase">Sotuvlar soni</div>
            <div className="font-condensed text-2xl font-bold mt-1">
              {data.todaySalesCount} <span className="text-sm font-normal text-text/60">ta chek</span>
            </div>
            <div className="text-xs text-text/50 mt-2">
              Bugun rasmiylashtirilgan cheklar
            </div>
          </div>

          <div className="bg-surface p-4 border border-divider flex flex-col justify-between">
            <div className="text-xs text-text/60 uppercase">O&apos;rtacha chek</div>
            <div className="font-condensed text-2xl font-bold mt-1">
              {formatSom(data.avgCheckAmount)}
            </div>
            <div className="text-xs text-text/50 mt-2">
              Bitta xarid uchun o&apos;rtacha summa
            </div>
          </div>
        </div>
      </div>

      {/* 3. Kassa va moliyaviy holat */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-condensed text-lg font-semibold uppercase tracking-wide text-text/80">
            Kassa va moliyaviy holat
          </h2>
          <Link href="/reports" className="text-xs text-accent hover:underline">
            To&apos;liq hisobotlar →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface p-4 border border-divider flex flex-col justify-between">
            <div className="text-xs text-text/60 uppercase">Naqd pul farqi (Bugun)</div>
            <div className={`font-condensed text-2xl font-bold mt-1 ${diffColor(cashDiff)}`}>
              {formatSom(data.todayCashDiff)}
            </div>
            <div className="text-xs text-text/50 mt-2">
              Kassadagi ortiqcha / kamomad
            </div>
          </div>

          <div className="bg-surface p-4 border border-divider flex flex-col justify-between">
            <div className="text-xs text-text/60 uppercase">Ochiq smenalar</div>
            <div className="font-condensed text-2xl font-bold mt-1">
              {data.openShiftsCount} <span className="text-sm font-normal text-text/60">ta kassa</span>
            </div>
            <div className="text-xs text-text/50 mt-2">
              Ayni paytda faol kassa smenalari
            </div>
          </div>

          <div className="bg-surface p-4 border border-divider flex flex-col justify-between">
            <div className="text-xs text-text/60 uppercase">Mijozlar qarzi (Nasiyalar)</div>
            <div className="font-condensed text-2xl font-bold mt-1 text-warning-text">
              {formatSom(data.totalCustomerDebt)}
            </div>
            <div className="text-xs text-text/50 mt-2">
              <Link href="/customers" className="text-accent hover:underline">
                Mijozlar sahifasida ko&apos;rish →
              </Link>
            </div>
          </div>

          <div className="bg-surface p-4 border border-divider flex flex-col justify-between">
            <div className="text-xs text-text/60 uppercase">Kategoriyalar soni</div>
            <div className="font-condensed text-2xl font-bold mt-1">
              {data.totalCategories}
            </div>
            <div className="text-xs text-text/50 mt-2">
              <Link href="/categories" className="text-accent hover:underline">
                Kategoriyalarni boshqarish →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Top tovarlar va kam qolgan tovarlar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-condensed text-lg font-semibold">Top sotilgan tovarlar (bugun)</h2>
            <Link href="/reports" className="text-xs text-accent hover:underline">
              Foyda hisoboti →
            </Link>
          </div>
          <div className="border border-divider bg-white">
            {data.topProducts.length === 0 ? (
              <div className="px-4 py-8 text-center text-text/50 text-sm">
                Bugun hali sotuv yo&apos;q
              </div>
            ) : (
              data.topProducts.map((p, idx) => (
                <div
                  key={p.productId}
                  className="flex items-center justify-between px-4 py-2.5 border-b border-divider last:border-0 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-condensed font-semibold text-text/50 text-xs w-4">
                      {idx + 1}.
                    </span>
                    <span>{p.name}</span>
                  </div>
                  <span className="font-condensed font-semibold">{formatQty(p.qty)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-condensed text-lg font-semibold">Qoldig&apos;i tugayotgan tovarlar</h2>
            <Link href="/products" className="text-xs text-accent hover:underline">
              Zaxirani to&apos;ldirish →
            </Link>
          </div>
          <div className="border border-divider bg-white">
            {data.lowStock.length === 0 ? (
              <div className="px-4 py-8 text-center text-text/50 text-sm">
                Kam qolgan tovar yo&apos;q
              </div>
            ) : (
              data.lowStock.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-4 py-2.5 border-b border-divider last:border-0 text-sm"
                >
                  <span>{p.name}</span>
                  <span className="border border-error-border bg-error-bg text-error-text px-2 py-0.5 text-xs font-condensed font-semibold">
                    {formatQty(p.stock)} qoldi
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 5. Oxirgi smenalar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-condensed text-lg font-semibold">Oxirgi smenalar</h2>
          <Link href="/reports" className="text-xs text-accent hover:underline">
            Barcha smenalar hisoboti →
          </Link>
        </div>
        <div className="border border-divider bg-white overflow-x-auto">
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
                    <td className="px-4 py-2.5 font-medium">{s.cashierName}</td>
                    <td className="px-4 py-2.5">
                      {s.status === "OPEN" ? (
                        <span className="border border-success-border text-success-text px-2 py-0.5 text-xs">
                          Ochiq
                        </span>
                      ) : (
                        <span className="border border-divider text-text/60 px-2 py-0.5 text-xs">
                          Yopiq
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-condensed font-semibold">
                      {formatSom(s.revenue)}
                    </td>
                    <td
                      className={`px-4 py-2.5 font-condensed font-semibold ${
                        s.diffCash !== null ? diffColor(Number(s.diffCash)) : "text-text/40"
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
      </div>
    </div>
  );
}
