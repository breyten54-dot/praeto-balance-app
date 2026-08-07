import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

const WEBHOOK_SECRET = 'test_rc_webhook_secret';
const DEMO_EMAIL = 'demo@praetobalance.co.za';
const DEMO_PASSWORD = 'Demo1234!';
const DEMO_USER_ID = 'seed-user-demo';

function buildPayload(
  eventId: string,
  type: string,
  appUserId: string,
  extra: Record<string, unknown> = {},
) {
  return {
    api_version: '1.0',
    event: {
      id: eventId,
      type,
      app_user_id: appUserId,
      product_id: 'praeto_balance_premium_monthly',
      purchased_at_ms: 1767225600000,
      expiration_at_ms: 1769904000000,
      store: 'PLAY_STORE',
      environment: 'SANDBOX',
      ...extra,
    },
  };
}

describe('RevenueCat webhook (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;

  beforeAll(async () => {
    process.env.REVENUECAT_WEBHOOK_AUTH = WEBHOOK_SECRET;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get(PrismaService);
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
      .expect(200);
    accessToken = login.body.accessToken as string;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.subscriptionEvent.deleteMany({
      where: { eventId: { startsWith: 'test-rc-' } },
    });
    // Reset demo user back to free so each test starts from a known tier.
    await prisma.user.update({
      where: { id: DEMO_USER_ID },
      data: { subscriptionTier: 'free' },
    });
  });

  it('processes INITIAL_PURCHASE and upgrades user to premium', async () => {
    const eventId = 'test-rc-001';
    const res = await request(app.getHttpServer())
      .post('/api/v1/webhooks/revenuecat')
      .set('Authorization', WEBHOOK_SECRET)
      .send(buildPayload(eventId, 'INITIAL_PURCHASE', DEMO_USER_ID))
      .expect(200);

    expect(res.body).toEqual({ received: true });

    const me = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(me.body.subscriptionTier).toBe('premium');

    const event = await prisma.subscriptionEvent.findUnique({
      where: { eventId },
    });
    expect(event).not.toBeNull();
    expect(event?.verdict).toBe('processed');
    expect(event?.appUserId).toBe(DEMO_USER_ID);
    expect(event?.type).toBe('INITIAL_PURCHASE');
  });

  it('returns duplicate: true when the same event id is redelivered', async () => {
    const eventId = 'test-rc-002';
    const payload = buildPayload(eventId, 'INITIAL_PURCHASE', DEMO_USER_ID);

    await request(app.getHttpServer())
      .post('/api/v1/webhooks/revenuecat')
      .set('Authorization', WEBHOOK_SECRET)
      .send(payload)
      .expect(200);

    const res = await request(app.getHttpServer())
      .post('/api/v1/webhooks/revenuecat')
      .set('Authorization', WEBHOOK_SECRET)
      .send(payload)
      .expect(200);

    expect(res.body).toEqual({ received: true, duplicate: true });

    const count = await prisma.subscriptionEvent.count({
      where: { eventId },
    });
    expect(count).toBe(1);
  });

  it('handles concurrent duplicate event ids without 500 and stores exactly one event', async () => {
    const eventId = 'test-rc-002-race';
    const payload = buildPayload(eventId, 'INITIAL_PURCHASE', DEMO_USER_ID);

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/webhooks/revenuecat')
        .set('Authorization', WEBHOOK_SECRET)
        .send(payload),
      request(app.getHttpServer())
        .post('/api/v1/webhooks/revenuecat')
        .set('Authorization', WEBHOOK_SECRET)
        .send(payload),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const bodies = [first.body, second.body];
    expect(bodies).toContainEqual({ received: true });
    expect(bodies).toContainEqual({ received: true, duplicate: true });

    const count = await prisma.subscriptionEvent.count({
      where: { eventId },
    });
    expect(count).toBe(1);

    const me = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(me.body.subscriptionTier).toBe('premium');
  });

  it('downgrades to free on EXPIRATION and records CANCELLATION without changing tier', async () => {
    // Start premium.
    await prisma.user.update({
      where: { id: DEMO_USER_ID },
      data: { subscriptionTier: 'premium' },
    });

    const expirationId = 'test-rc-003-exp';
    await request(app.getHttpServer())
      .post('/api/v1/webhooks/revenuecat')
      .set('Authorization', WEBHOOK_SECRET)
      .send(buildPayload(expirationId, 'EXPIRATION', DEMO_USER_ID))
      .expect(200);

    let me = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(me.body.subscriptionTier).toBe('free');

    const expirationEvent = await prisma.subscriptionEvent.findUnique({
      where: { eventId: expirationId },
    });
    expect(expirationEvent?.verdict).toBe('processed');

    // Back to premium to test cancellation does NOT downgrade.
    await prisma.user.update({
      where: { id: DEMO_USER_ID },
      data: { subscriptionTier: 'premium' },
    });

    const cancellationId = 'test-rc-003-can';
    await request(app.getHttpServer())
      .post('/api/v1/webhooks/revenuecat')
      .set('Authorization', WEBHOOK_SECRET)
      .send(buildPayload(cancellationId, 'CANCELLATION', DEMO_USER_ID))
      .expect(200);

    me = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(me.body.subscriptionTier).toBe('premium');

    const cancellationEvent = await prisma.subscriptionEvent.findUnique({
      where: { eventId: cancellationId },
    });
    expect(cancellationEvent?.verdict).toBe('recorded');
  });

  it('records unknown app_user_id with unknown_user verdict and does not modify any user', async () => {
    const eventId = 'test-rc-004';
    const unknownUserId = 'test-rc-unknown-user';
    const userCountBefore = await prisma.user.count();

    const res = await request(app.getHttpServer())
      .post('/api/v1/webhooks/revenuecat')
      .set('Authorization', WEBHOOK_SECRET)
      .send(buildPayload(eventId, 'INITIAL_PURCHASE', unknownUserId))
      .expect(200);

    expect(res.body).toEqual({ received: true });

    const event = await prisma.subscriptionEvent.findUnique({
      where: { eventId },
    });
    expect(event?.verdict).toBe('unknown_user');

    const userCountAfter = await prisma.user.count();
    expect(userCountAfter).toBe(userCountBefore);
  });

  it('rejects missing or incorrect Authorization with WEBHOOK_INVALID and stores nothing', async () => {
    const eventId = 'test-rc-005';

    const missing = await request(app.getHttpServer())
      .post('/api/v1/webhooks/revenuecat')
      .send(buildPayload(eventId, 'INITIAL_PURCHASE', DEMO_USER_ID))
      .expect(401);
    expect(missing.body.code).toBe('WEBHOOK_INVALID');

    const wrong = await request(app.getHttpServer())
      .post('/api/v1/webhooks/revenuecat')
      .set('Authorization', 'wrong-secret')
      .send(buildPayload(eventId, 'INITIAL_PURCHASE', DEMO_USER_ID))
      .expect(401);
    expect(wrong.body.code).toBe('WEBHOOK_INVALID');

    const event = await prisma.subscriptionEvent.findUnique({
      where: { eventId },
    });
    expect(event).toBeNull();
  });
});
