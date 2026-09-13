import { api } from './api';
import { dequeueSale, listQueuedSales } from './db';

interface SyncResultItem {
  idempotencyKey: string;
  status: 'created' | 'duplicate' | 'failed';
  saleId?: string;
  message?: string;
}

let syncing = false;

// Sends every queued offline sale to /sales/sync in one batch. Each item is
// independent server-side (own idempotencyKey), so a partial failure never
// blocks the rest — only the failed ones stay queued for the next attempt.
export async function flushQueue(onChange?: () => void): Promise<void> {
  if (syncing || !navigator.onLine) return;
  syncing = true;
  try {
    const queued = await listQueuedSales();
    if (queued.length === 0) return;

    const results = await api.post<SyncResultItem[]>('/sales/sync', {
      sales: queued.map((q) => ({ ...q.payload, idempotencyKey: q.idempotencyKey })),
    });

    for (const result of results) {
      if (result.status !== 'failed') {
        await dequeueSale(result.idempotencyKey);
      }
    }
    onChange?.();
  } catch {
    // Network still down, or the server rejected the whole batch — leave the
    // queue intact and let the next online event / poll retry it.
  } finally {
    syncing = false;
  }
}

export function setupAutoSync(onChange?: () => void): void {
  window.addEventListener('online', () => {
    void flushQueue(onChange);
  });
  void flushQueue(onChange);
}
