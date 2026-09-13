import { useEffect, useState } from 'react';
import { useApp } from '../state/app-context';
import { api, ApiError } from '../lib/api';
import { formatSom } from '../lib/format';
import { NumericPadModal } from '../components/NumericPad';
import type { Customer } from '../state/types';

interface DebtEntry {
  id: string;
  type: 'CREDIT_SALE' | 'PAYMENT' | 'RETURN_CREDIT' | 'ADJUSTMENT';
  amount: string;
  balanceAfter: string;
  occurredAt: string;
}

interface CustomerDetail extends Customer {
  entries: DebtEntry[];
}

export function CreditCustomersScreen() {
  const { backToSale } = useApp();
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      api
        .get<Customer[]>(`/customers?q=${encodeURIComponent(query)}`)
        .then(setCustomers)
        .catch(() => setCustomers([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  function loadDetail(id: string) {
    setSelectedId(id);
    api
      .get<CustomerDetail>(`/customers/${id}`)
      .then(setDetail)
      .catch(() => setDetail(null));
  }

  async function pay(amount: number) {
    if (!selectedId) return;
    setShowPayment(false);
    setError(null);
    try {
      await api.post(`/customers/${selectedId}/payments`, { amount, tender: 'CASH' });
      loadDetail(selectedId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "To'lovni saqlab bo'lmadi");
    }
  }

  return (
    <div className="h-full flex flex-col">
      <header className="h-11 flex items-center px-4 border-b border-divider shrink-0">
        <button type="button" onClick={backToSale} className="text-sm text-text/70">
          ← Orqaga
        </button>
        <span className="ml-auto font-condensed font-bold">Nasiya mijozlari</span>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 shrink-0 border-r border-divider flex flex-col">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Qidirish..."
            className="h-11 px-3 border-b border-divider"
          />
          <div className="flex-1 overflow-y-auto">
            {customers.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => loadDetail(c.id)}
                className={`w-full flex justify-between px-3 py-2.5 text-sm text-left border-b border-divider ${
                  selectedId === c.id ? 'bg-accent-tint-bg' : ''
                }`}
              >
                <span>{c.name}</span>
                <span className={Number(c.debtBalance) > 0 ? 'text-error-text' : 'text-text/40'}>
                  {formatSom(c.debtBalance)}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 p-4 overflow-y-auto">
          {!detail ? (
            <div className="text-sm text-text/50">Mijozni tanlang</div>
          ) : (
            <div className="max-w-md">
              <div className="font-condensed text-xl font-bold">{detail.name}</div>
              <div className="text-sm text-text/60 mb-4">{detail.phone ?? ''}</div>

              <div className="p-4 bg-surface mb-4">
                <div className="text-sm text-text/60">Joriy qarz</div>
                <div className="font-condensed text-2xl font-bold">{formatSom(detail.debtBalance)}</div>
              </div>

              {error && <div className="text-sm text-error-text mb-3">{error}</div>}

              <button
                type="button"
                onClick={() => setShowPayment(true)}
                className="w-full h-12 bg-accent text-white font-condensed font-semibold mb-4"
              >
                To'lov qabul qilish
              </button>

              <div className="font-condensed text-lg font-semibold mb-2">Tarix</div>
              {detail.entries.map((e) => (
                <div key={e.id} className="flex justify-between text-sm py-1.5 border-b border-divider">
                  <span className="text-text/60">{new Date(e.occurredAt).toLocaleDateString('uz-UZ')}</span>
                  <span className={Number(e.amount) < 0 ? 'text-success-text' : 'text-error-text'}>
                    {Number(e.amount) > 0 ? '+' : ''}
                    {formatSom(e.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showPayment && (
        <NumericPadModal
          title="To'lov summasi"
          allowDecimal={false}
          onConfirm={pay}
          onCancel={() => setShowPayment(false)}
        />
      )}
    </div>
  );
}
