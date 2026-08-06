import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PayoutFieldsModule } from '../src/modules/payout-fields/payout-fields.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';

// Требует поднятой БД из DATABASE_URL (см. README запуска e2e).
const TOKEN = process.env.PAYOUT_FIELDS_TOKEN || 'super-secret-token-123';
const auth = { 'x-api-token': TOKEN };

describe('payout-fields (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PayoutFieldsModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.payoutFieldPreset.deleteMany({});
  });

  afterAll(async () => {
    await prisma.payoutFieldPreset.deleteMany({});
    await app.close();
  });

  const srv = () => request(app.getHttpServer());

  it('без токена — 401', async () => {
    const r = await srv().get('/api/payout-fields/CORPUAH');
    expect(r.status).toBe(401);
    console.log('GET /CORPUAH без токена ->', r.status, JSON.stringify(r.body));
  });

  it('с чужим токеном — 401', async () => {
    const r = await srv()
      .get('/api/payout-fields')
      .set({ 'x-api-token': 'wrong' });
    expect(r.status).toBe(401);
    console.log('GET / с чужим токеном ->', r.status, JSON.stringify(r.body));
  });

  it('PUT создаёт пресет', async () => {
    const r = await srv()
      .put('/api/payout-fields/corpuah')
      .set(auth)
      .send({ fields: ['iban', 'recipient_name', 'inn', 'payment_note'], note: 'ФОП/ТОВ' });
    expect(r.status).toBe(200);
    console.log('PUT /corpuah ->', r.status, JSON.stringify(r.body));
  });

  it('GET отдаёт пресет плагину', async () => {
    const r = await srv().get('/api/payout-fields/CORPUAH').set(auth);
    expect(r.status).toBe(200);
    expect(r.body.fields).toEqual(['iban', 'recipient_name', 'inn', 'payment_note']);
    console.log('GET /CORPUAH ->', r.status, JSON.stringify(r.body));
  });

  it('префиксный матч: CORPUAH2 берёт пресет CORPUAH', async () => {
    const r = await srv().get('/api/payout-fields/CORPUAH2').set(auth);
    expect(r.status).toBe(200);
    expect(r.body.xml).toBe('CORPUAH');
    console.log('GET /CORPUAH2 ->', r.status, JSON.stringify(r.body));
  });

  it('мусорный ключ — 400', async () => {
    const r = await srv()
      .put('/api/payout-fields/WIREUAH')
      .set(auth)
      .send({ fields: ['iban', 'kP9X31710759953331'] });
    expect(r.status).toBe(400);
    console.log('PUT /WIREUAH мусор ->', r.status, JSON.stringify(r.body.message).slice(0, 120));
  });

  it('переключение набора на лету', async () => {
    await srv()
      .put('/api/payout-fields/corpuah')
      .set(auth)
      .send({ fields: ['iban', 'full_name'] });
    const r = await srv().get('/api/payout-fields/CORPUAH').set(auth);
    expect(r.body.fields).toEqual(['iban', 'full_name']);
    console.log('после переключения GET /CORPUAH ->', r.status, JSON.stringify(r.body));
  });

  it('неизвестный xml — 404', async () => {
    const r = await srv().get('/api/payout-fields/CARDKZT').set(auth);
    expect(r.status).toBe(404);
    console.log('GET /CARDKZT ->', r.status, JSON.stringify(r.body));
  });
});
