import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as argon2 from 'argon2';
import * as querystring from 'querystring';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { CoachingService } from '../src/coaching/coaching.service';
import { generatePayfastSignature } from '../src/coaching/payfast.signature';

const TEST_USER_ID = 'seed-user-coaching-test';
const TEST_EMAIL = 'coaching-test@praetobalance.co.za';
const TEST_PASSWORD = 'CoachingTest123!';

const OTHER_USER_ID = 'seed-user-coaching-other';
const OTHER_EMAIL = 'coaching-other@praetobalance.co.za';
const OTHER_PASSWORD = 'CoachingOther123!';

function buildItnPayload(
  fields: Record<string, string>,
): { body: string; signature: string } {
  const signature = generatePayfastSignature(fields);
  const withSig = { ...fields, signature };
  return { body: querystring.stringify(withSig), signature };
}

describe('Coaching + PayFast (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let coachingService: CoachingService;
  let accessToken: string;
  let otherAccessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // rawBody must be enabled for the PayFast ITN handler to receive the exact
    // postback bytes (mirrors the production bootstrap in src/main.ts).
    app = moduleFixture.createNestApplication({ rawBody: true });
    prisma = app.get(PrismaService);
    coachingService = app.get(CoachingService);
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

    for (const { id, email, password } of [
      { id: TEST_USER_ID, email: TEST_EMAIL, password: TEST_PASSWORD },
      { id: OTHER_USER_ID, email: OTHER_EMAIL, password: OTHER_PASSWORD },
    ]) {
      const passwordHash = await argon2.hash(password);
      await prisma.user.upsert({
        where: { id },
        update: { email, passwordHash },
        create: {
          id,
          email,
          passwordHash,
          firstName: 'Coaching',
          lastName: 'Test',
        },
      });
    }

    await prisma.coachingBooking.deleteMany({
      where: { userId: { in: [TEST_USER_ID, OTHER_USER_ID] } },
    });

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
      .expect(200);
    accessToken = login.body.accessToken as string;

    const otherLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: OTHER_EMAIL, password: OTHER_PASSWORD })
      .expect(200);
    otherAccessToken = otherLogin.body.accessToken as string;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [TEST_USER_ID, OTHER_USER_ID] } } });
    await app.close();
  });

  it('GET /api/v1/coaching/availability without auth → 401', () => {
    return request(app.getHttpServer()).get('/api/v1/coaching/availability').expect(401);
  });

  it('GET /api/v1/coaching/availability returns future slots', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/coaching/availability')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('slots');
    expect(res.body.slots.length).toBeGreaterThanOrEqual(14 * 3);
    for (const slot of res.body.slots) {
      expect(slot).toHaveProperty('id');
      expect(slot).toHaveProperty('startsAt');
      expect(slot).toHaveProperty('endsAt');
    }
  });

  it('POST /api/v1/coaching/bookings discovery → confirmed, no checkout', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/coaching/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ tier: 'discovery' })
      .expect(200);

    expect(res.body.tier).toBe('discovery');
    expect(res.body.status).toBe('confirmed');
    expect(res.body.checkoutUrl).toBeNull();
  });

  it('POST /api/v1/coaching/bookings starter → awaiting_payment with PayFast URL', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/coaching/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ tier: 'starter' })
      .expect(200);

    expect(res.body.tier).toBe('starter');
    expect(res.body.status).toBe('awaiting_payment');
    expect(res.body.checkoutUrl).toMatch(/^https:\/\/sandbox\.payfast\.co\.za\/eng\/process\?/);
    expect(res.body.checkoutUrl).toContain(`m_payment_id=${res.body.id}`);
    expect(res.body.checkoutUrl).toContain('amount=1900.00');
    expect(res.body.checkoutUrl).toMatch(/signature=[a-f0-9]{32}/);
  });

  it('GET /api/v1/coaching/bookings/:id returns awaiting_payment; other user sees 404', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/coaching/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ tier: 'starter' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/coaching/bookings/${created.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.status).toBe('awaiting_payment');
    expect(res.body.priceCents).toBe(190000);

    const other = await request(app.getHttpServer())
      .get(`/api/v1/coaching/bookings/${created.body.id}`)
      .set('Authorization', `Bearer ${otherAccessToken}`)
      .expect(404);

    expect(other.body.code).toBe('NOT_FOUND');
  });

  it('GET /api/v1/payments/coaching-return returns HTML redirect', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/payments/coaching-return?bookingId=abc123')
      .expect(200);

    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain("praetobalance://payments/coaching-return");
  });

  it('POST /api/v1/coaching/bookings invalid tier → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/coaching/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ tier: 'platinum' })
      .expect(400);

    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/v1/coaching/bookings without auth → 401', () => {
    return request(app.getHttpServer())
      .post('/api/v1/coaching/bookings')
      .send({ tier: 'starter' })
      .expect(401);
  });

  describe('PayFast ITN webhook', () => {
    let bookingId: string;

    beforeAll(async () => {
      jest.spyOn(coachingService, 'verifyPostback').mockResolvedValue('VALID');

      const created = await request(app.getHttpServer())
        .post('/api/v1/coaching/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ tier: 'starter' })
        .expect(200);

      bookingId = created.body.id as string;
    });

    afterAll(() => {
      jest.restoreAllMocks();
    });

    it('COMPLETE ITN confirms the booking', async () => {
      const { body } = buildItnPayload({
        merchant_id: process.env.PAYFAST_MERCHANT_ID ?? '',
        payment_status: 'COMPLETE',
        m_payment_id: bookingId,
        pf_payment_id: 'PF123456',
        amount_gross: '1900.00',
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/webhooks/payfast/itn')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(body)
        .expect(200);

      expect(res.text).toBe('OK');

      const booking = await request(app.getHttpServer())
        .get(`/api/v1/coaching/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(booking.body.status).toBe('confirmed');

      const notification = await prisma.paymentNotification.findFirst({
        where: { bookingId, verdict: 'valid' },
        orderBy: { createdAt: 'desc' },
      });
      expect(notification).not.toBeNull();
    });

    it('tampered-amount ITN leaves booking unchanged and records amount_mismatch', async () => {
      // Use a fresh booking so it is not already confirmed.
      const created = await request(app.getHttpServer())
        .post('/api/v1/coaching/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ tier: 'starter' })
        .expect(200);
      const id = created.body.id as string;

      const { body } = buildItnPayload({
        merchant_id: process.env.PAYFAST_MERCHANT_ID ?? '',
        payment_status: 'COMPLETE',
        m_payment_id: id,
        pf_payment_id: 'PF999',
        amount_gross: '1800.00',
      });

      await request(app.getHttpServer())
        .post('/api/v1/webhooks/payfast/itn')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(body)
        .expect(200);

      const booking = await request(app.getHttpServer())
        .get(`/api/v1/coaching/bookings/${id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(booking.body.status).toBe('awaiting_payment');

      const notification = await prisma.paymentNotification.findFirst({
        where: { bookingId: id, verdict: 'amount_mismatch' },
      });
      expect(notification).not.toBeNull();
    });

    it('bad-signature ITN leaves booking unchanged and records bad_signature', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/coaching/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ tier: 'starter' })
        .expect(200);
      const id = created.body.id as string;

      const { body } = buildItnPayload({
        merchant_id: process.env.PAYFAST_MERCHANT_ID ?? '',
        payment_status: 'COMPLETE',
        m_payment_id: id,
        pf_payment_id: 'PF000',
        amount_gross: '1900.00',
      });
      const tampered = body.replace(/signature=[a-f0-9]{32}/, 'signature=deadbeefdeadbeefdeadbeefdeadbeef');

      await request(app.getHttpServer())
        .post('/api/v1/webhooks/payfast/itn')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(tampered)
        .expect(200);

      const booking = await request(app.getHttpServer())
        .get(`/api/v1/coaching/bookings/${id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(booking.body.status).toBe('awaiting_payment');

      const notification = await prisma.paymentNotification.findFirst({
        where: { bookingId: id, verdict: 'bad_signature' },
      });
      expect(notification).not.toBeNull();
    });
  });
});
