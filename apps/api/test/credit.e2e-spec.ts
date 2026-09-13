import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

describe('Credit customers (e2e)', () => {
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

  it('books a credit sale to the customer debt and a cash payment reduces it and the open shift picks it up', async () => {
    const customer = await request(app.getHttpServer())
      .post('/api/customers')
      .set(auth(adminToken))
      .send({ name: 'Karim aka', phone: '+998901112233' });
    const customerId = customer.body.id;

    const sku = `SKU-CREDIT-${Date.now()}`;
    const product = await request(app.getHttpServer())
      .post('/api/products')
      .set(auth(adminToken))
      .send({
        sku,
        name: 'Nasiya tovari',
        units: [{ label: 'dona', factor: 1, price: 20000, isBase: true }],
      });
    const productId = product.body.id;

    const receipt = await request(app.getHttpServer())
      .post('/api/receipts')
      .set(auth(adminToken))
      .send({
        lines: [
          { productId, unitLabel: 'dona', qtyInUnit: 10, unitCostPack: 8000 },
        ],
      });
    await request(app.getHttpServer())
      .post(`/api/receipts/${receipt.body.id}/post`)
      .set(auth(adminToken));

    const sale = await request(app.getHttpServer())
      .post('/api/sales')
      .set(auth(cashierToken))
      .set('Idempotency-Key', `credit-sale-${Date.now()}`)
      .send({
        customerId,
        lines: [{ productId, unitLabel: 'dona', qtyInUnit: 3 }],
        tenders: [{ type: 'CREDIT', amount: 60000 }],
      })
      .expect(201);
    expect(Number(sale.body.total)).toBe(60000);

    const afterSale = await request(app.getHttpServer())
      .get(`/api/customers/${customerId}`)
      .set(auth(adminToken));
    expect(Number(afterSale.body.debtBalance)).toBe(60000);
    expect(afterSale.body.entries[0].type).toBe('CREDIT_SALE');
    expect(Number(afterSale.body.entries[0].balanceAfter)).toBe(60000);

    const payment1 = await request(app.getHttpServer())
      .post(`/api/customers/${customerId}/payments`)
      .set(auth(cashierToken))
      .send({ amount: 25000, tender: 'CASH' })
      .expect(201);
    expect(Number(payment1.body.balanceAfter)).toBe(35000);

    const payment2 = await request(app.getHttpServer())
      .post(`/api/customers/${customerId}/payments`)
      .set(auth(cashierToken))
      .send({ amount: 15000, tender: 'CASH' })
      .expect(201);
    expect(Number(payment2.body.balanceAfter)).toBe(20000);

    const finalCustomer = await request(app.getHttpServer())
      .get(`/api/customers/${customerId}`)
      .set(auth(adminToken));
    expect(Number(finalCustomer.body.debtBalance)).toBe(20000);

    // Both CASH payments were booked against the cashier's open shift, so
    // they must show up in expectedCash even though no SaleTender exists for
    // this sale's CASH (it was pure CREDIT).
    const shift = await request(app.getHttpServer())
      .get('/api/shifts/current')
      .set(auth(cashierToken));
    expect(Number(shift.body.expectedCash)).toBe(40000); // 0 opening + 25000 + 15000
  });

  it('rejects a CREDIT tender with no customer selected', async () => {
    const sku = `SKU-CREDIT-NOCUST-${Date.now()}`;
    const product = await request(app.getHttpServer())
      .post('/api/products')
      .set(auth(adminToken))
      .send({
        sku,
        name: 'Mijozsiz nasiya',
        units: [{ label: 'dona', factor: 1, price: 10000, isBase: true }],
      });
    const productId = product.body.id;
    const receipt = await request(app.getHttpServer())
      .post('/api/receipts')
      .set(auth(adminToken))
      .send({
        lines: [
          { productId, unitLabel: 'dona', qtyInUnit: 5, unitCostPack: 4000 },
        ],
      });
    await request(app.getHttpServer())
      .post(`/api/receipts/${receipt.body.id}/post`)
      .set(auth(adminToken));

    await request(app.getHttpServer())
      .post('/api/sales')
      .set(auth(cashierToken))
      .set('Idempotency-Key', `credit-sale-nocust-${Date.now()}`)
      .send({
        lines: [{ productId, unitLabel: 'dona', qtyInUnit: 1 }],
        tenders: [{ type: 'CREDIT', amount: 10000 }],
      })
      .expect(400);
  });
});
