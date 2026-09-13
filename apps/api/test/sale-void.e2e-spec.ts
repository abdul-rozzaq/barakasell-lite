import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import * as OTPAuth from 'otpauth';

const TOTP_SECRET =
  process.env.TOTP_SECRET ?? 'MFRGGZDFMZTWQ2LK';
const TOTP_OPTS = { digits: 6, step: 30, window: 1 } as const;

function validTotpCode() {
  return new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(TOTP_SECRET), digits: 6, period: 30 }).generate();
}

describe('Sale Void (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let cashierToken: string;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: 'admin', password: 'admin123' });
    adminToken = login.body.accessToken;

    const users = await request(app.getHttpServer())
      .get('/api/users')
      .set(auth(adminToken));
    const cashier = users.body.find(
      (u: { role: string }) => u.role === 'CASHIER',
    );
    const cashierLogin = await request(app.getHttpServer())
      .post('/api/auth/pin-login')
      .send({ userId: cashier.id, pin: '1234' });
    cashierToken = cashierLogin.body.accessToken;

    // Ensure cashier has an open shift
    const current = await request(app.getHttpServer())
      .get('/api/shifts/current')
      .set(auth(cashierToken));
    if (current.body) {
      await request(app.getHttpServer())
        .post(`/api/shifts/${current.body.id}/close`)
        .set(auth(cashierToken))
        .send({ countedCash: Number(current.body.expectedCash) });
    }
    await request(app.getHttpServer())
      .post('/api/shifts/open')
      .set(auth(cashierToken))
      .send({ openingCash: 0 });
  });

  afterEach(async () => {
    await app.close();
  });

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  async function createProductWithStock(
    name: string,
    price: number,
    qty: number,
    unitCost: number,
  ) {
    const sku = `SKU-VOID-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const product = await request(app.getHttpServer())
      .post('/api/products')
      .set(auth(adminToken))
      .send({
        sku,
        name,
        units: [{ label: 'dona', factor: 1, price, isBase: true }],
      });
    const productId = product.body.id as string;

    const receipt = await request(app.getHttpServer())
      .post('/api/receipts')
      .set(auth(adminToken))
      .send({
        lines: [
          { productId, unitLabel: 'dona', qtyInUnit: qty, unitCostPack: unitCost },
        ],
      });
    await request(app.getHttpServer())
      .post(`/api/receipts/${receipt.body.id}/post`)
      .set(auth(adminToken))
      .expect(201);

    return productId;
  }

  async function makeSale(productId: string, qty: number, price: number) {
    const sale = await request(app.getHttpServer())
      .post('/api/sales')
      .set(auth(cashierToken))
      .set(
        'Idempotency-Key',
        `void-test-sale-${Date.now()}-${Math.random()}`,
      )
      .send({
        lines: [{ productId, unitLabel: 'dona', qtyInUnit: qty }],
        tenders: [{ type: 'CASH', amount: qty * price }],
      })
      .expect(201);
    return sale.body;
  }

  it('rejects void with no X-Totp-Code header (403)', async () => {
    const productId = await createProductWithStock('Void tovar 1', 10000, 20, 4000);
    const sale = await makeSale(productId, 5, 10000);

    await request(app.getHttpServer())
      .delete(`/api/sales/${sale.id}`)
      .set(auth(adminToken))
      .expect(403);
  });

  it('rejects void with invalid TOTP code (403)', async () => {
    const productId = await createProductWithStock('Void tovar 2', 10000, 20, 4000);
    const sale = await makeSale(productId, 5, 10000);

    await request(app.getHttpServer())
      .delete(`/api/sales/${sale.id}`)
      .set(auth(adminToken))
      .set('X-Totp-Code', '000000')
      .expect(403);
  });

  it('voids a sale with valid TOTP: status=VOIDED, stock restored', async () => {
    const productId = await createProductWithStock('Void tovar 3', 10000, 20, 4000);
    const sale = await makeSale(productId, 5, 10000);

    // Check stock after sale: 20 - 5 = 15
    const afterSale = await request(app.getHttpServer())
      .get(`/api/products/${productId}`)
      .set(auth(adminToken));
    expect(Number(afterSale.body.stock)).toBe(15);

    const res = await request(app.getHttpServer())
      .delete(`/api/sales/${sale.id}`)
      .set(auth(adminToken))
      .set('X-Totp-Code', validTotpCode())
      .expect(200);

    expect(res.body.status).toBe('VOIDED');
    expect(res.body.voidedAt).toBeTruthy();
    expect(res.body.id).toBe(sale.id);

    // Check stock restored: 15 + 5 = 20
    const afterVoid = await request(app.getHttpServer())
      .get(`/api/products/${productId}`)
      .set(auth(adminToken));
    expect(Number(afterVoid.body.stock)).toBe(20);
  });

  it('rejects voiding an already-voided sale (409)', async () => {
    const productId = await createProductWithStock('Void tovar 4', 10000, 20, 4000);
    const sale = await makeSale(productId, 3, 10000);

    // Void once successfully
    await request(app.getHttpServer())
      .delete(`/api/sales/${sale.id}`)
      .set(auth(adminToken))
      .set('X-Totp-Code', validTotpCode())
      .expect(200);

    // Try to void again
    await request(app.getHttpServer())
      .delete(`/api/sales/${sale.id}`)
      .set(auth(adminToken))
      .set('X-Totp-Code', validTotpCode())
      .expect(409);
  });

  it('rejects voiding a sale that has returns (409)', async () => {
    const productId = await createProductWithStock('Void tovar 5', 10000, 20, 4000);
    const sale = await makeSale(productId, 5, 10000);

    // Create a partial return for this sale
    const confirmRes = await request(app.getHttpServer())
      .post('/api/auth/confirm-pin')
      .set(auth(cashierToken))
      .send({ pin: '1234' });
    const confirmationToken = confirmRes.body.confirmationToken as string;

    await request(app.getHttpServer())
      .post('/api/returns')
      .set(auth(cashierToken))
      .set('X-Pin-Confirmation', confirmationToken)
      .send({
        saleId: sale.id,
        lines: [{ saleLineId: sale.lines[0].id, qtyBase: 1 }],
        refundTender: 'CASH',
      })
      .expect(201);

    // Now attempt void — should fail since there's a return
    await request(app.getHttpServer())
      .delete(`/api/sales/${sale.id}`)
      .set(auth(adminToken))
      .set('X-Totp-Code', validTotpCode())
      .expect(409);
  });

  it('non-admin cannot void even with valid TOTP (403)', async () => {
    const productId = await createProductWithStock('Void tovar 6', 10000, 20, 4000);
    const sale = await makeSale(productId, 2, 10000);

    await request(app.getHttpServer())
      .delete(`/api/sales/${sale.id}`)
      .set(auth(cashierToken))
      .set('X-Totp-Code', validTotpCode())
      .expect(403);
  });
});
