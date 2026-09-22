import { useEffect, useState } from 'react';
import { useApp } from '../state/app-context';
import { api, ApiError } from '../lib/api';
import { formatSom, formatQty } from '../lib/format';
import type { SaleDetail, TenderType } from '../state/types';

const TENDER_LABEL: Record<TenderType, string> = {
  CASH: 'Naqd',
  CARD: 'Karta',
  CLICK: 'Click',
  CREDIT: 'Nasiya',
};

export function SalesTodayScreen() {
  const { backToSale, openReturnsFor } = useApp();
  const [sales, setSales] = useState<SaleDetail[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function load() {
    setSales(null);
    setError(null);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    api
      .get<SaleDetail[]>(`/sales?from=${startOfDay.toISOString()}`)
      .then(setSales)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Yuklab bo'lmadi"));
  }

  useEffect(load, []);

  return (
    <div className="h-full flex flex-col">
      <header className="h-11 flex items-center px-4 border-b border-divider shrink-0">
        <button type="button" onClick={backToSale} className="text-sm text-text/70">
          ← Orqaga
        </button>
        <span className="ml-auto font-condensed font-bold">Bugungi sotuvlar</span>
      </header>

      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="p-6 text-center text-sm text-error-text">
            {error} <button onClick={load} className="underline">Qayta urinish</button>
          </div>
        )}
        {!error && sales === null && (
          <div className="p-4 flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 bg-surface animate-pulse" />
            ))}
          </div>
        )}
        {sales?.length === 0 && <div className="p-6 text-center text-sm text-text/50">Hali sotuvlar yo'q</div>}
        {sales?.map((sale) => (
          <div key={sale.id} className="border-b border-divider">
            <button
              type="button"
              onClick={() => setExpandedId(expandedId === sale.id ? null : sale.id)}
              className="w-full flex items-center gap-3 px-4 h-14 text-left"
            >
              <span className="font-condensed font-semibold">{sale.code}</span>
              <span className="text-sm text-text/60">{new Date(sale.soldAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</span>
              <span className="text-xs bg-surface px-2 py-0.5">{sale.tenders.map((t) => TENDER_LABEL[t.type]).join(' + ')}</span>
              <span className="ml-auto flex flex-col items-end">
                <span className="font-condensed font-semibold">{formatSom(sale.total)}</span>
                {Number(sale.discountAmount) > 0 && (
                  <span className="text-[10px] text-success-text">-{formatSom(sale.discountAmount)} chegirma</span>
                )}
              </span>
            </button>
            {expandedId === sale.id && (
              <div className="px-4 pb-4">
                {sale.lines.map((line) => {
                  const unitDiscount = Number(line.unitDiscountAmount);
                  return (
                    <div key={line.id} className="flex justify-between text-sm py-1 text-text/70">
                      <span>
                        {line.productName} × {formatQty(line.qtyBase)} {line.unitLabel}
                        {unitDiscount > 0 && (
                          <span className="text-success-text"> (-{formatSom(unitDiscount)}/dona)</span>
                        )}
                      </span>
                      <span>{formatSom(line.lineTotal)}</span>
                    </div>
                  );
                })}
                <div className="flex flex-col gap-0.5 mt-2 pt-2 border-t border-divider text-sm">
                  <div className="flex justify-between text-text/60">
                    <span>Oraliq jami</span>
                    <span>{formatSom(sale.subtotal)}</span>
                  </div>
                  {Number(sale.discountAmount) > 0 && (
                    <div className="flex justify-between text-success-text">
                      <span>Umumiy chegirma</span>
                      <span>-{formatSom(sale.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold">
                    <span>Jami</span>
                    <span>{formatSom(sale.total)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openReturnsFor(sale.code)}
                  className="mt-2 h-9 px-4 border border-divider text-sm"
                >
                  Qaytarish
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
