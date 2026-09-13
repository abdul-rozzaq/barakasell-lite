import { useEffect, useState } from 'react';
import { useApp } from '../state/app-context';
import { api } from '../lib/api';
import { NumericKeypad } from '../components/NumericPad';
import type { Cashier } from '../state/types';

export function LoginScreen() {
  const { login } = useApp();
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [selected, setSelected] = useState<Cashier | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<Cashier[]>('/auth/cashiers').then(setCashiers).catch(() => setCashiers([]));
  }, []);

  useEffect(() => {
    if (pin.length !== 4 || !selected || busy) return;
    setBusy(true);
    login(selected.id, pin)
      .catch(() => {
        setError(true);
        setTimeout(() => {
          setError(false);
          setPin('');
        }, 450);
      })
      .finally(() => setBusy(false));
  }, [pin, selected, busy, login]);

  if (!selected) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 gap-6">
        <h1 className="font-condensed text-2xl font-bold">BarakaSELL</h1>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full max-w-md">
          {cashiers.map((cashier) => (
            <button
              key={cashier.id}
              type="button"
              onClick={() => setSelected(cashier)}
              className="flex flex-col items-center gap-2 p-4 bg-surface"
            >
              <span className="avatar-circle flex items-center justify-center h-14 w-14 bg-accent text-white font-condensed text-xl font-bold">
                {cashier.name.charAt(0).toUpperCase()}
              </span>
              <span className="font-condensed font-semibold text-sm text-center">{cashier.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-6">
      <button
        type="button"
        onClick={() => {
          setSelected(null);
          setPin('');
        }}
        className="self-start text-sm text-text/70"
      >
        ← Orqaga
      </button>
      <div className="font-condensed text-xl font-semibold">{selected.name}</div>
      <div className="flex gap-3">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-4 w-4 border border-divider ${i < pin.length ? 'bg-accent' : 'bg-white'}`}
          />
        ))}
      </div>
      <div className="h-5 text-sm text-error-text">{error ? "Noto'g'ri PIN kod" : ''}</div>
      <div className="w-full max-w-xs">
        <NumericKeypad value={pin} onChange={(v) => setPin(v.slice(0, 4))} allowDecimal={false} />
      </div>
    </div>
  );
}
