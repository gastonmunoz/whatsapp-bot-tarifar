import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('TarifAR e2e', () => {
  let app: INestApplication;

  beforeAll(async () => {
    delete process.env.KAPSO_WEBHOOK_SECRET;
    delete process.env.ANTHROPIC_API_KEY;
    const moduleRef: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET / health returns ok', async () => {
    const res = await request(app.getHttpServer()).get('/').expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.slug).toBe('tarifar');
  });

  it('POST /api/test returns bot_response', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/test')
      .send({ phone: '+5491150000000', message: 'hola' })
      .expect(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.bot_response).toBe('string');
    expect(res.body.bot_response.length).toBeGreaterThan(0);
    expect(typeof res.body.intent_detected).toBe('string');
  });

  it('POST /api/webhook accepts valid kapso payload', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/webhook')
      .send({ event: 'message.received', message: { message_id: 'm1', from: '+5491150000000', type: 'text', text: { body: 'hola' } } })
      .expect(200);
    expect(res.body.ok).toBe(true);
  });

  it('POST /api/webhook rejects invalid signature when secret is set', async () => {
    process.env.KAPSO_WEBHOOK_SECRET = 'test-secret';
    await request(app.getHttpServer())
      .post('/api/webhook')
      .set('x-kapso-signature', 'bogus')
      .send({ event: 'message.received', message: { message_id: 'm2', from: '+5491150000001', type: 'text', text: { body: 'hola' } } })
      .expect(401);
    delete process.env.KAPSO_WEBHOOK_SECRET;
  });
});
