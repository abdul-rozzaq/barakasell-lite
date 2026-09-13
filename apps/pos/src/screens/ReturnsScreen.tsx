import { useEffect, useState } from 'react';
import { useApp } from '../state/app-context';
import { api, ApiError } from '../lib/api';
import { formatSom, formatQty } from '../lib/format';
import { PinConfirmModal } from '../components/PinConfirmModal';
import type { SaleDetail } from '../state/types';

export function ReturnsScreen() {
  const { state, backToSale, refreshShift } = useApp();
  const [query, setQuery] = useState(state.returnPrefillCode ?? '');
  const [sale, setSale] = useState<SaleDetail | null>(null);
  const [qtyByLine, setQtyByLine] = useState<Record<string, number>>({});
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function search(code: string) {
    if (!code.trim()) return;
    setSearchError(null);
    setSale(null);
    setQtyByLine({});
    api
      .get<SaleDetail>(`/sales/by-code/${encodeURIComponent(code.trim())}`)
      .then(setSale)
      .catch((err) => setSearchError(err instanceof ApiError ? err.message : 'Sotuv topilmadi'));
  }

  useEffect(() => {
    if (state.returnPrefillCode) search(state.returnPrefillCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalReturnAmount =
    sale?.lines.reduce((acc, line) => {
      const qty = qtyByLine[line.id] ?? 0;
      const available = Number(line.qtyBase) - Number(line.returnedQtyBase);
      const ratio = available > 0 ? qty / Number(line.qtyBase) : 0;
      return acc + ratio * Number(line.lineTotal) * (1 - Number(sale.discountPct) / 100);
    }, 0) ?? 0;
  const hasSelection = Object.values(qtyByLine).some((q) => q > 0);

  async function submitReturn(confirmationToken: string) {
    if (!sale) return;
    setShowPin(false);
    setBusy(true);
    setSubmitError(null);
    try {
      await api.post(
        '/returns',
        {
          saleId: sale.id,
          lines: Object.entries(qtyByLine)
            .filter(([, qty]) => qty > 0)
            .map(([saleLineId, qtyBase]) => ({ saleLineId, qtyBase })),
          refundTender: 'CASH',
        },
        { 'X-Pin-Confirmation': confirmationToken },
      );
      await refreshShift();
      backToSale();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Qaytarishni saqlab bo'lmadi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full flex flex-col">
      <header className="h-11 flex items-center px-4 border-b border-divider shrink-0">
        <button type="button" onClick={backToSale} className="text-sm text-text/70">
          ← Orqaga
        </button>
        <span className="ml-auto font-condensed font-bold">Qaytarish</span>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex gap-2 mb-4 max-w-md">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search(query)}
            placeholder="Sotuv kodi (masalan #4821)"
            className="flex-1 h-11 px-3 border border-divider"
          />
          <button type="button" onClick={() => search(query)} className="h-11 px-4 bg-accent text-white font-condensed font-semibold">
            Qidirish
          </button>
        </div>

        {searchError && <div className="text-sm text-error-text mb-4">{searchError}</div>}

        {sale && (
          <div className="max-w-md">
            <div className="font-condensed text-lg font-semibold mb-3">{sale.code}</div>
            <div className="flex flex-col gap-2 mb-4">
              {sale.lines.map((line) => {
                const available = Number(line.qtyBase) - Number(line.returnedQtyBase);
                const qty = qtyByLine[line.id] ?? 0;
                return (
                  <div key={line.id} className="flex items-center gap-2 p-2 border border-divider">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{line.productName}</div>
                      <div className="text-xs text-text/50">Sotilgan: {formatQty(line.qtyBase)}, mavjud: {formatQty(available)}</div>
                    </div>
                    <button
                      type="button"
                      disabled={qty <= 0}
                      onClick={() => setQtyByLine((prev) => ({ ...prev, [line.id]: Math.max(0, qty - 1) }))}
                      className="h-8 w-8 bg-surface font-condensed font-bold disabled:opacity-30"
                    >
                      −
                    </button>
                    <span className="min-w-8 text-center font-condensed">{formatQty(qty)}</span>
                    <button
                      type="button"
                      disabled={qty >= available}
                      onClick={() => setQtyByLine((prev) => ({ ...prev, [line.id]: Math.min(available, qty + 1) }))}
                      className="h-8 w-8 bg-surface font-condensed font-bold disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between font-condensed text-lg font-bold mb-4">
              <span>Taxminiy qaytarim</span>
              <span>{formatSom(totalReturnAmount)}</span>
            </div>

            {submitError && <div className="text-sm text-error-text mb-3">{submitError}</div>}

            <button
              type="button"
              disabled={!hasSelection || busy}
              onClick={() => setShowPin(true)}
              className="w-full h-14 bg-accent text-white font-condensed font-semibold disabled:opacity-40"
            >
              Qaytarishni tasdiqlash
            </button>
          </div>
        )}
      </div>

      {showPin && <PinConfirmModal onConfirmed={submitReturn} onCancel={() => setShowPin(false)} />}
    </div>
  );
}
