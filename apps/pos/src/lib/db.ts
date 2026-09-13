import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { CartLine, SalePayload } from '../state/types';

export interface QueuedSale {
  idempotencyKey: string;
  payload: SalePayload;
  createdAt: number;
}

interface CartRecord {
  lines: CartLine[];
  customerId: string | null;
}

interface PosDB extends DBSchema {
  cart: {
    key: string;
    value: CartRecord;
  };
  saleQueue: {
    key: string;
    value: QueuedSale;
  };
}

let dbPromise: Promise<IDBPDatabase<PosDB>> | undefined;

function getDb(): Promise<IDBPDatabase<PosDB>> {
  dbPromise ??= openDB<PosDB>('barakasell-pos', 1, {
    upgrade(db) {
      db.createObjectStore('cart');
      db.createObjectStore('saleQueue', { keyPath: 'idempotencyKey' });
    },
  });
  return dbPromise;
}

const CART_KEY = 'current';

export async function saveCart(lines: CartLine[], customerId: string | null): Promise<void> {
  const db = await getDb();
  await db.put('cart', { lines, customerId }, CART_KEY);
}

export async function loadCart(): Promise<CartRecord | undefined> {
  const db = await getDb();
  return db.get('cart', CART_KEY);
}

export async function clearCart(): Promise<void> {
  const db = await getDb();
  await db.delete('cart', CART_KEY);
}

export async function enqueueSale(sale: QueuedSale): Promise<void> {
  const db = await getDb();
  await db.put('saleQueue', sale);
}

export async function dequeueSale(idempotencyKey: string): Promise<void> {
  const db = await getDb();
  await db.delete('saleQueue', idempotencyKey);
}

export async function listQueuedSales(): Promise<QueuedSale[]> {
  const db = await getDb();
  return db.getAll('saleQueue');
}

export async function countQueuedSales(): Promise<number> {
  const db = await getDb();
  return db.count('saleQueue');
}
