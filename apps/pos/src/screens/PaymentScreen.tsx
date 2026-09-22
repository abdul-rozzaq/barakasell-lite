import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../state/app-context';
import { api, ApiError } from '../lib/api';
import { formatSom } from '../lib/format';
import { NumericPadModal } from '../components/NumericPad';
import type { Customer, TenderDraft, TenderType } from '../state/types';

const CASH_TENDERS: { type: TenderType; label: string }[] = [
  { type: 'CASH', label: 'Naqd' },
  { type: 'CARD', label: 'Karta' },
  { type: 'CLICK', label: 'Click' },
];

export function PaymentScreen() {
  const { state, checkout, setCustomer, backToSale } = useApp();
  const [mode, setMode] = useState<'mixed' | 'credit'>('mixed');
  const [amounts, setAmounts] = useState<Record<TenderType, number>>({ CASH: 0, CARD: 0, CLICK: 0, CREDIT: 0 });
  const [editingTender, setEditingTender] = useState<TenderType | null>(null);
  const [editingDiscount, setEditingDiscount] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const subtotal = useMemo(
    () =>
      state.cart.reduce(
        (acc, l) => acc + l.qtyInUnit * Math.max(0, l.unitPrice - l.discountAmount),
        0,
      ),
    [state.cart],
  );
  const total = Math.max(0, subtotal - discountAmount);
  const itemCount = state.cart.length;

  useEffect(() => {
    if (mode !== 'credit') return;
    const timer = setTimeout(() => {
      api
        .get<Customer[]>(`/customers?q=${encodeURIComponent(customerQuery)}`)
        .then(setCustomers)
        .catch(() => setCustomers([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [mode, customerQuery]);

  const paid = amounts.CASH + amounts.CARD + amounts.CLICK;
  const remaining = Math.max(0, total - paid);
  const change = Math.max(0, paid - total);
  const canFinish = mode === 'mixed' ? paid >= total : Boolean(state.customer);

  async function finish() {
    if (!canFinish || busy) return;
    setBusy(true);
    setError(null);
    try {
      const tenders: TenderDraft[] =
        mode === 'mixed'
          ? CASH_TENDERS.filter((t) => amounts[t.type] > 0).map((t) => ({ type: t.type, amount: amounts[t.type] }))
          : [{ type: 'CREDIT', amount: total }];
      await checkout(tenders, discountAmount);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sotuvni yakunlab bo'lmadi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full flex flex-col md:flex-row overflow-y-auto">
      <div className="p-4 md:w-64 shrink-0">
        <button type="button" onClick={backToSale} className="text-sm text-text/70 mb-3">
          ← Savatga qaytish
        </button>
        <div className="p-4 bg-surface">
          <div className="text-sm text-text/60">{itemCount} tovar</div>
          {discountAmount > 0 && (
            <div className="text-sm text-text/60 line-through">{formatSom(subtotal)}</div>
          )}
          <div className="font-condensed text-3xl font-bold mt-1">{formatSom(total)}</div>
        </div>

        <button
          type="button"
          onClick={() => setEditingDiscount(true)}
          className="w-full h-11 mt-2 px-3 border border-divider text-left flex items-center justify-between"
        >
          <span className="text-sm font-condensed font-semibold">Chegirma</span>
          <span className="font-condensed">{formatSom(discountAmount)}</span>
        </button>
      </div>

      <div className="flex-1 p-4 flex flex-col gap-4">
        <div className="flex bg-surface w-fit">
          <button
            type="button"
            onClick={() => setMode('mixed')}
            className={`h-10 px-4 font-condensed font-semibold text-sm ${mode === 'mixed' ? 'bg-accent text-white' : ''}`}
          >
            Aralash to'lov
          </button>
          <button
            type="button"
            onClick={() => setMode('credit')}
            className={`h-10 px-4 font-condensed font-semibold text-sm ${mode === 'credit' ? 'bg-accent text-white' : ''}`}
          >
            Nasiya
          </button>
        </div>

        {mode === 'mixed' ? (
          <div className="flex flex-col gap-2 max-w-sm">
            {CASH_TENDERS.map((t) => (
              <button
                key={t.type}
                type="button"
                onClick={() => setEditingTender(t.type)}
                className="flex items-center justify-between h-14 px-4 border border-divider text-left"
              >
                <span className="font-condensed font-semibold">{t.label}</span>
                <span className="font-condensed">{formatSom(amounts[t.type])}</span>
              </button>
            ))}
            <div className="flex justify-between text-sm mt-2">
              <span>To'langan</span>
              <span>{formatSom(paid)}</span>
            </div>
            {remaining > 0 && (
              <div className="flex justify-between text-sm text-error-text">
                <span>Qolgan</span>
                <span>{formatSom(remaining)}</span>
              </div>
            )}
            {change > 0 && (
              <div className="flex justify-between text-sm text-success-text">
                <span>Qaytim</span>
                <span>{formatSom(change)}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-w-sm">
            <input
              type="text"
              value={customerQuery}
              onChange={(e) => setCustomerQuery(e.target.value)}
              placeholder="Mijozni qidirish..."
              className="h-11 px-3 border border-divider"
            />
            <div className="flex flex-col gap-1 max-h-52 overflow-y-auto">
              {customers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCustomer(c)}
                  className={`flex items-center justify-between h-12 px-3 text-left border ${state.customer?.id === c.id ? 'border-accent bg-accent-tint-bg' : 'border-divider'}`}
                >
                  <span>{c.name}</span>
                  <span className="text-error-text text-sm">{formatSom(c.debtBalance)}</span>
                </button>
              ))}
            </div>
            {state.customer && (
              <div className="p-3 bg-surface text-sm">
                <div>Joriy qarz: {formatSom(state.customer.debtBalance)}</div>
                <div>Yangi qarz: {formatSom(Number(state.customer.debtBalance) + total)}</div>
              </div>
            )}
          </div>
        )}

        {error && <div className="text-sm text-error-text">{error}</div>}

        <button
          type="button"
          disabled={!canFinish || busy}
          onClick={finish}
          className="w-full max-w-sm h-14 bg-accent text-white font-condensed font-semibold disabled:opacity-40 mt-auto"
        >
          Sotuvni yakunlash
        </button>
      </div>

      {editingTender && (
        <NumericPadModal
          title={CASH_TENDERS.find((t) => t.type === editingTender)?.label ?? ''}
          initialValue={amounts[editingTender]}
          fullAmount={amounts[editingTender] + remaining}
          allowDecimal={false}
          onConfirm={(value) => {
            setAmounts((prev) => ({ ...prev, [editingTender]: value }));
            setEditingTender(null);
          }}
          onCancel={() => setEditingTender(null)}
        />
      )}

      {editingDiscount && (
        <NumericPadModal
          title="Chegirma (so'm)"
          initialValue={discountAmount}
          fullAmount={subtotal}
          fullAmountLabel="To'liq chegirma"
          allowDecimal={false}
          onConfirm={(value) => {
            setDiscountAmount(Math.min(value, subtotal));
            setEditingDiscount(false);
          }}
          onCancel={() => setEditingDiscount(false)}
        />
      )}
    </div>
  );
}
