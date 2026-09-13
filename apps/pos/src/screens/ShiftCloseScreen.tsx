import { useEffect, useState } from 'react';
import { useApp } from '../state/app-context';
import { api, ApiError } from '../lib/api';
import { formatSom } from '../lib/format';
import { NumericKeypad } from '../components/NumericPad';

export function ShiftCloseScreen() {
  const { state, backToSale, refreshShift, logout } = useApp();
  const [counted, setCounted] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshShift();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const expected = Number(state.shift?.expectedCash ?? 0);
  const countedValue = Number(counted) || 0;
  const diff = countedValue - expected;

  async function close() {
    if (!state.shift) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/shifts/${state.shift.id}/close`, { countedCash: countedValue });
      logout();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Smenani yopib bo'lmadi");
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
        <span className="ml-auto font-condensed font-bold">Smenani yopish</span>
      </header>

      <div className="flex-1 overflow-y-auto p-4 max-w-md flex flex-col gap-4">
        <div className="p-4 bg-surface">
          <div className="text-sm text-text/60">Kutilgan naqd</div>
          <div className="font-condensed text-2xl font-bold">{formatSom(expected)}</div>
        </div>

        <div>
          <div className="text-sm text-text/60 mb-2">Sanalgan naqd</div>
          <div className="text-right text-3xl font-condensed font-bold mb-3 h-10">{formatSom(countedValue)}</div>
          <NumericKeypad value={counted} onChange={setCounted} allowDecimal={false} />
        </div>

        {counted !== '' && (
          <div
            className={`p-3 flex justify-between font-condensed font-semibold ${
              diff < 0 ? 'bg-error-bg text-error-text' : diff > 0 ? 'bg-warning-bg text-warning-text' : 'bg-success-border/20 text-success-text'
            }`}
          >
            <span>Farq</span>
            <span>{formatSom(diff)}</span>
          </div>
        )}

        {error && <div className="text-sm text-error-text">{error}</div>}

        <button
          type="button"
          disabled={counted === '' || busy}
          onClick={close}
          className="w-full h-14 bg-accent text-white font-condensed font-semibold disabled:opacity-40"
        >
          Smenani yopish
        </button>
      </div>
    </div>
  );
}
