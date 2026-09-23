import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { OPENAI_CLIENT } from '../src/modules/receipt-ocr/openai.provider.js';

// The vision call itself is never exercised in e2e — that's covered by
// receipt-ocr.service.spec.ts with a mocked client. Here we only need a
// fake OPENAI_CLIENT that returns scripted content so the HTTP layer
// (auth, file handling, product matching against a real DB) is exercised
// end-to-end. `responseContent` is reassigned per test; the fake client
// reads it lazily at call time, so one module compile in beforeEach works
// for every test.
let responseContent = '{"lines":[]}';
const fakeOpenAiClient = {
  chat: {
    completions: {
      create: async () => ({ choices: [{ message: { content: responseContent } }] }),
    },
  },
};

describe('Receipt OCR (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let cashierToken: string;

  beforeEach(async () => {
    responseContent = '{"lines":[]}';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(OPENAI_CLIENT)
      .useValue(fakeOpenAiClient)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: 'admin', password: 'admin123' });
    adminToken = adminLogin.body.accessToken;

    const users = await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);
    const cashierId = users.body.find((u: { role: string }) => u.role === 'CASHIER').id;
    const cashierLogin = await request(app.getHttpServer())
      .post('/api/auth/pin-login')
      .send({ userId: cashierId, pin: '1234' });
    cashierToken = cashierLogin.body.accessToken;
  });

  afterEach(async () => {
    await app.close();
  });

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  it("matches a clearly-named OCR line to an existing product", async () => {
    const sku = `SKU-OCR-${Date.now()}`;
    const name = `OCR test tovari ${Date.now()}`;
    await request(app.getHttpServer())
      .post('/api/products')
      .set(auth(adminToken))
      .send({ sku, name, units: [{ label: 'dona', factor: 1, price: 5000, isBase: true }] })
      .expect(201);

    responseContent = JSON.stringify({
      supplierName: null,
      lines: [{ rawName: name, qty: 5, unitLabel: 'dona', unitPrice: 4000, lineTotal: 20000 }],
    });

    const res = await request(app.getHttpServer())
      .post('/api/receipts/ocr')
      .set(auth(adminToken))
      .attach('files', Buffer.from('fake-jpeg-bytes'), { filename: 'invoice.jpg', contentType: 'image/jpeg' })
      .expect(201);

    expect(res.body.lines).toHaveLength(1);
    expect(res.body.lines[0].status).toBe('matched');
    expect(res.body.lines[0].productName).toBe(name);
    expect(res.body.lines[0].unitLabel).toBe('dona');
  });

  it('accepts multiple pages of the same invoice in one request', async () => {
    responseContent = JSON.stringify({ lines: [{ rawName: 'Nomaʼlum tovar', qty: 1, unitPrice: 1000 }] });

    const res = await request(app.getHttpServer())
      .post('/api/receipts/ocr')
      .set(auth(adminToken))
      .attach('files', Buffer.from('page-1'), { filename: 'page1.jpg', contentType: 'image/jpeg' })
      .attach('files', Buffer.from('page-2'), { filename: 'page2.jpg', contentType: 'image/jpeg' })
      .expect(201);

    expect(res.body.lines).toHaveLength(1);
  });

  it('rejects a cashier (admin-only route)', async () => {
    await request(app.getHttpServer())
      .post('/api/receipts/ocr')
      .set(auth(cashierToken))
      .attach('files', Buffer.from('fake-jpeg-bytes'), { filename: 'invoice.jpg', contentType: 'image/jpeg' })
      .expect(403);
  });

  it('rejects a request with no file', async () => {
    await request(app.getHttpServer())
      .post('/api/receipts/ocr')
      .set(auth(adminToken))
      .expect(400);
  });

  it('rejects a non-image file', async () => {
    await request(app.getHttpServer())
      .post('/api/receipts/ocr')
      .set(auth(adminToken))
      .attach('files', Buffer.from('not an image'), { filename: 'invoice.pdf', contentType: 'application/pdf' })
      .expect(400);
  });
});
