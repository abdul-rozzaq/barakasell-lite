import { useApp } from '../state/app-context';
import { formatSom } from '../lib/format';
import { CornerMarks } from '../components/CornerMarks';

const TENDER_LABELS: Record<string, string> = {
  CASH: 'Naqd',
  CARD: 'Karta',
  CLICK: 'Click',
  CREDIT: 'Nasiya',
};

export function SaleCompleteScreen() {
  const { state, startNewSale } = useApp();
  const sale = state.saleResult;
  if (!sale) return null;

  const methodLine = sale.tenders.map((t) => TENDER_LABELS[t.type] ?? t.type).join(' + ');

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-4">
      <div className="relative bg-surface p-8 flex flex-col items-center gap-3 max-w-sm w-full">
        <CornerMarks />
        <span className="flex items-center justify-center h-16 w-16 rounded-full bg-success-border text-white text-3xl">
          ✓
        </span>
        <div className="font-condensed text-3xl font-bold">{sale.code}</div>
        <div className="font-condensed text-2xl">{formatSom(sale.total)}</div>
        <div className="text-sm text-text/70">{methodLine}</div>
        {sale.pending && (
          <div className="text-sm text-warning-text bg-warning-bg border border-warning-border px-3 py-1">
            Internet yo'q — navbatga qo'yildi, ulanish tiklanganda yuboriladi
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={startNewSale}
        className="w-full max-w-sm h-14 bg-accent text-white font-condensed font-semibold"
      >
        Yangi sotuv
      </button>
    </div>
  );
}
