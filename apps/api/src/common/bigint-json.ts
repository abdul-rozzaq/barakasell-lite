// Prisma BigInt fields (StockLedgerEntry.seq, CustomerDebtEntry.seq,
// Product.lastLedgerSeq) don't survive JSON.stringify by default. Side-effect
// import this once from app.module.ts so every bootstrap path (main.ts, e2e
// tests instantiating AppModule directly) gets it.
declare global {
  interface BigInt {
    toJSON(): string;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function (this: bigint) {
  return this.toString();
};
