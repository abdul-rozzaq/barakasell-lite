import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

describe('Loyalty (e2e)', () => {
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
    await request(app.getHttpServer())
      .patch('/api/settings')
      .set(auth(adminToken))
      .send({ loyaltyEnabled: false });
    await app.close();
  });

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  async function enableLoyalty() {
    await request(app.getHttpServer())
      .patch('/api/settings')
      .set(auth(adminToken))
      .send({
        loyaltyEnabled: true,
        loyaltyEarnPoints: 1,
        loyaltyEarnPerSum: 1000,
      })
      .expect(200);
  }

  async function createCustomer() {
    const res = await request(app.getHttpServer())
      .post('/api/customers')
      .set(auth(adminToken))
      .send({ name: `Loyalty mijoz ${Date.now()}` });
    return res.body.id as string;
  }

  async function createProduct(price: number) {
    const sku = `SKU-LOY-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const res = await request(app.getHttpServer())
      .post('/api/products')
      .set(auth(adminToken))
      .send({
        sku,
        name: 'Loyalty tovari',
        units: [{ label: 'dona', factor: 1, price, isBase: true }],
      });
    return res.body.id as string;
  }

  async function receive(productId: string, qty: number, unitCost: number) {
    const receipt = await request(app.getHttpServer())
      .post('/api/receipts')
      .set(auth(adminToken))
      .send({
        lines: [{ productId, unitLabel: 'dona', qtyInUnit: qty, unitCostPack: unitCost }],
      });
    await request(app.getHttpServer())
      .post(`/api/receipts/${receipt.body.id}/post`)
      .set(auth(adminToken))
      .expect(201);
  }

  it('earns points on a sale with a customer attached, with a correct balanceAfter', async () => {
    await enableLoyalty();
    const customerId = await createCustomer();
    const productId = await createProduct(10000);
    await receive(productId, 20, 4000);

    const sale = await request(app.getHttpServer())
      .post('/api/sales')
      .set(auth(cashierToken))
      .set('Idempotency-Key', `loy-${Date.now()}`)
      .send({
        lines: [{ productId, unitLabel: 'dona', qtyInUnit: 5 }],
        tenders: [{ type: 'CASH', amount: 50000 }],
        customerId,
      })
      .expect(201);

    expect(sale.body.loyaltyPointsEarned).toBe(50); // 50000 so'm / 1000 = 50 points

    const loyalty = await request(app.getHttpServer())
      .get(`/api/customers/${customerId}/loyalty`)
      .set(auth(adminToken))
      .expect(200);
    expect(loyalty.body.pointsBalance).toBe(50);
    expect(loyalty.body.entries[0].balanceAfter).toBe(50);
    expect(loyalty.body.entries[0].type).toBe('EARN');
  });

  it('does not earn points when loyaltyEnabled is off', async () => {
    const customerId = await createCustomer();
    const productId = await createProduct(10000);
    await receive(productId, 20, 4000);

    const sale = await request(app.getHttpServer())
      .post('/api/sales')
      .set(auth(cashierToken))
      .set('Idempotency-Key', `loy-off-${Date.now()}`)
      .send({
        lines: [{ productId, unitLabel: 'dona', qtyInUnit: 5 }],
        tenders: [{ type: 'CASH', amount: 50000 }],
        customerId,
      })
      .expect(201);

    expect(sale.body.loyaltyPointsEarned).toBe(0);
  });

  it('reverses points proportionally on a partial return', async () => {
    await enableLoyalty();
    const customerId = await createCustomer();
    const productId = await createProduct(10000);
    await receive(productId, 20, 4000);

    const sale = await request(app.getHttpServer())
      .post('/api/sales')
      .set(auth(cashierToken))
      .set('Idempotency-Key', `loy-ret-${Date.now()}`)
      .send({
        lines: [{ productId, unitLabel: 'dona', qtyInUnit: 10 }],
        tenders: [{ type: 'CASH', amount: 100000 }],
        customerId,
      })
      .expect(201);
    expect(sale.body.loyaltyPointsEarned).toBe(100); // 100000 / 1000

    const pin = await request(app.getHttpServer())
      .post('/api/auth/confirm-pin')
      .set(auth(cashierToken))
      .send({ pin: '1234' });

    await request(app.getHttpServer())
      .post('/api/returns')
      .set(auth(cashierToken))
      .set('X-Pin-Confirmation', pin.body.confirmationToken)
      .send({
        saleId: sale.body.id,
        lines: [{ saleLineId: sale.body.lines[0].id, qtyBase: 3 }],
        refundTender: 'CASH',
      })
      .expect(201);

    const loyalty = await request(app.getHttpServer())
      .get(`/api/customers/${customerId}/loyalty`)
      .set(auth(adminToken))
      .expect(200);
    // refund = 30000 of 100000 total -> 30% of 100 points = 30 reversed
    expect(loyalty.body.pointsBalance).toBe(70);
    expect(loyalty.body.entries[0].type).toBe('RETURN_REVERSAL');
    expect(loyalty.body.entries[0].points).toBe(-30);
  });

  it('generates a unique EAN-13 card code starting with the loyalty prefix, resolvable by GET /customers/by-card/:code', async () => {
    const customerId = await createCustomer();
    const card = await request(app.getHttpServer())
      .post(`/api/customers/${customerId}/loyalty/card`)
      .set(auth(adminToken))
      .expect(201);

    expect(card.body.cardCode).toMatch(/^28\d{11}$/);

    const lookup = await request(app.getHttpServer())
      .get(`/api/customers/by-card/${card.body.cardCode}`)
      .set(auth(adminToken))
      .expect(200);
    expect(lookup.body.id).toBe(customerId);

    // Calling it again is idempotent — same card, not a new one.
    const again = await request(app.getHttpServer())
      .post(`/api/customers/${customerId}/loyalty/card`)
      .set(auth(adminToken))
      .expect(201);
    expect(again.body.cardCode).toBe(card.body.cardCode);
  });
});
