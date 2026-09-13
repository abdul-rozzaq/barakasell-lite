import { useEffect, useState } from 'react';
import { useApp } from '../state/app-context';
import { api, ApiError } from '../lib/api';
import { formatSom } from '../lib/format';
import { NumericKeypad } from '../components/NumericPad';
import { PinConfirmModal } from '../components/PinConfirmModal';
import type { CashMovementEntry, ShiftDetail } from '../state/types';

export function CashMovementScreen() {
  const { state, backToSale, refreshShift } = useApp();
  const [type, setType] = useState<'OUT' | 'IN'>('OUT');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [moves, setMoves] = useState<CashMovementEntry[]>([]);
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const shiftId = state.shift?.id;

  function loadMoves() {
    if (!shiftId) return;
    api
      .get<ShiftDetail>(`/shifts/${shiftId}`)
      .then((s) => setMoves(s.cashMoves))
      .catch(() => setMoves([]));
  }

  useEffect(loadMoves, [shiftId]);

  const value = Number(amount) || 0;

  async function submit(confirmationToken: string) {
    if (!shiftId) return;
    setShowPin(false);
    setBusy(true);
    setError(null);
    try {
      await api.post(
        `/shifts/${shiftId}/cash-movements`,
        { type, amount: value, reason },
        { 'X-Pin-Confirmation': confirmationToken },
      );
      setAmount('');
      setReason('');
      await refreshShift();
      loadMoves();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Saqlab bo'lmadi");
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
        <span className="ml-auto font-condensed font-bold">Kassa harakati</span>
      </header>

      <div className="flex-1 overflow-y-auto p-4 max-w-md">
        <div className="flex border border-divider w-fit mb-4">
          <button
            type="button"
            onClick={() => setType('OUT')}
            className={`h-10 px-4 text-sm font-condensed font-semibold ${type === 'OUT' ? 'bg-accent text-white' : ''}`}
          >
            Pul olib chiqish
          </button>
          <button
            type="button"
            onClick={() => setType('IN')}
            className={`h-10 px-4 text-sm font-condensed font-semibold ${type === 'IN' ? 'bg-accent text-white' : ''}`}
          >
            Pul kiritish
          </button>
        </div>

        <div className="text-right text-3xl font-condensed font-bold mb-3 h-10">{formatSom(value)}</div>
        <NumericKeypad value={amount} onChange={setAmount} allowDecimal={false} />

        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Sabab"
          className="w-full h-11 px-3 border border-divider mt-4 mb-2"
        />

        {error && <div className="text-sm text-error-text mb-2">{error}</div>}

        <button
          type="button"
          disabled={value <= 0 || !reason.trim() || busy}
          onClick={() => setShowPin(true)}
          className="w-full h-12 bg-accent text-white font-condensed font-semibold disabled:opacity-40"
        >
          Tasdiqlash
        </button>

        <div className="font-condensed text-lg font-semibold mt-6 mb-2">Bugungi harakatlar</div>
        {moves.length === 0 ? (
          <div className="text-sm text-text/50">Harakatlar yo'q</div>
        ) : (
          moves.map((m) => (
            <div key={m.id} className="flex justify-between text-sm py-1.5 border-b border-divider">
              <span className="text-text/70">{m.reason}</span>
              <span className={m.type === 'IN' ? 'text-success-text' : 'text-error-text'}>
                {m.type === 'IN' ? '+' : '-'}
                {formatSom(m.amount)}
              </span>
            </div>
          ))
        )}
      </div>

      {showPin && <PinConfirmModal onConfirmed={submit} onCancel={() => setShowPin(false)} />}
    </div>
  );
}
