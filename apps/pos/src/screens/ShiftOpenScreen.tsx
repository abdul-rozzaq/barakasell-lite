import { useState } from 'react';
import { useApp } from '../state/app-context';
import { NumericKeypad } from '../components/NumericPad';
import { formatSom } from '../lib/format';

export function ShiftOpenScreen() {
  const { openShift, logout, state } = useApp();
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value = Number(amount) || 0;

  async function start() {
    setBusy(true);
    setError(null);
    try {
      await openShift(value);
    } catch {
      setError("Smenani ochib bo'lmadi, qayta urinib ko'ring");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-6">
      <div className="text-center">
        <div className="font-condensed text-lg font-semibold">{state.cashierName}</div>
        <div className="text-sm text-text/60">Smenani boshlash uchun kassadagi naqd pulni kiriting</div>
      </div>
      <div className="text-right text-4xl font-condensed font-bold h-12 w-full max-w-xs">
        {formatSom(value)}
      </div>
      {error && <div className="text-sm text-error-text">{error}</div>}
      <div className="w-full max-w-xs">
        <NumericKeypad value={amount} onChange={setAmount} allowDecimal={false} />
      </div>
      <button
        type="button"
        disabled={value <= 0 || busy}
        onClick={start}
        className="relative w-full max-w-xs h-14 bg-accent text-white font-condensed font-semibold disabled:opacity-40"
      >
        Smenani boshlash
      </button>
      <button type="button" onClick={logout} className="text-sm text-text/60">
        Chiqish
      </button>
    </div>
  );
}
