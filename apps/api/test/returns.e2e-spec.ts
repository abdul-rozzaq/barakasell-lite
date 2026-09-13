import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

describe('Returns (e2e)', () => {
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

  async function confirmPin(token: string) {
    const res = await request(app.getHttpServer())
      .post('/api/auth/confirm-pin')
      .set(auth(token))
      .send({ pin: '1234' });
    return res.body.confirmationToken as string;
  }

  async function makeSale() {
    const sku = `SKU-RET-${Date.now()}`;
    const product = await request(app.getHttpServer())
      .post('/api/products')
      .set(auth(adminToken))
      .send({
        sku,
        name: 'Qaytariladigan tovar',
        units: [{ label: 'dona', factor: 1, price: 10000, isBase: true }],
      });
    const productId = product.body.id;

    const receipt = await request(app.getHttpServer())
      .post('/api/receipts')
      .set(auth(adminToken))
      .send({
        lines: [
          { productId, unitLabel: 'dona', qtyInUnit: 20, unitCostPack: 4000 },
        ],
      });
    await request(app.getHttpServer())
      .post(`/api/receipts/${receipt.body.id}/post`)
      .set(auth(adminToken));

    const sale = await request(app.getHttpServer())
      .post('/api/sales')
      .set(auth(cashierToken))
      .set('Idempotency-Key', `sale-for-return-${Date.now()}`)
      .send({
        lines: [{ productId, unitLabel: 'dona', qtyInUnit: 10 }],
        tenders: [{ type: 'CASH', amount: 100000 }],
      });

    return { productId, sale: sale.body };
  }

  it('requires PIN confirmation', async () => {
    const { sale } = await makeSale();
    await request(app.getHttpServer())
      .post('/api/returns')
      .set(auth(cashierToken))
      .send({
        saleId: sale.id,
        lines: [{ saleLineId: sale.lines[0].id, qtyBase: 2 }],
        refundTender: 'CASH',
      })
      .expect(403);
  });

  it('partially returns a sale at the original cost snapshot, leaving avgCost untouched', async () => {
    const { productId, sale } = await makeSale();

    // Move avgCost away from the sale's snapshot so we can prove the return
    // reverses at the ORIGINAL cost (4000), not the current one.
    const receipt2 = await request(app.getHttpServer())
      .post('/api/receipts')
      .set(auth(adminToken))
      .send({
        lines: [
          { productId, unitLabel: 'dona', qtyInUnit: 10, unitCostPack: 9000 },
        ],
      });
    await request(app.getHttpServer())
      .post(`/api/receipts/${receipt2.body.id}/post`)
      .set(auth(adminToken));

    const beforeReturn = await request(app.getHttpServer())
      .get(`/api/products/${productId}`)
      .set(auth(adminToken));
    const avgCostBefore = Number(beforeReturn.body.avgCost);

    const pin = await confirmPin(cashierToken);
    const ret = await request(app.getHttpServer())
      .post('/api/returns')
      .set(auth(cashierToken))
      .set('X-Pin-Confirmation', pin)
      .send({
        saleId: sale.id,
        lines: [{ saleLineId: sale.lines[0].id, qtyBase: 3 }],
        refundTender: 'CASH',
        reason: "Mijoz noto'g'ri rangni oldi",
      })
      .expect(201);

    expect(Number(ret.body.refundTotal)).toBe(30000); // 3 x 10000, no sale-level discount
    expect(Number(ret.body.lines[0].unitCostBase)).toBe(4000); // original snapshot, not 9000

    const afterReturn = await request(app.getHttpServer())
      .get(`/api/products/${productId}`)
      .set(auth(adminToken));
    expect(Number(afterReturn.body.stock)).toBe(23); // 20 - 10 (sale) + 3 (return) + 10 (2nd receipt)
    expect(Number(afterReturn.body.avgCost)).not.toBe(avgCostBefore); // blended in at the original 4000, per costing.util RETURN branch

    const saleAfter = await request(app.getHttpServer())
      .get(`/api/sales/${sale.id}`)
      .set(auth(cashierToken));
    expect(Number(saleAfter.body.lines[0].returnedQtyBase)).toBe(3);
  });

  it('rejects returning more than was sold', async () => {
    const { sale } = await makeSale();
    const pin = await confirmPin(cashierToken);
    await request(app.getHttpServer())
      .post('/api/returns')
      .set(auth(cashierToken))
      .set('X-Pin-Confirmation', pin)
      .send({
        saleId: sale.id,
        lines: [{ saleLineId: sale.lines[0].id, qtyBase: 999 }],
        refundTender: 'CASH',
      })
      .expect(409);
  });
});
