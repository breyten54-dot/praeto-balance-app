import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

const TEST_USER_ID = 'seed-user-rewards-test';
const TEST_EMAIL = 'rewards-test@praetobalance.co.za';
const TEST_PASSWORD = 'RewardTest123!';

const COMPLETE_MODULES = [
  'seed-learn-01',
  'seed-learn-02',
  'seed-learn-03',
  'seed-learn-04',
  'seed-learn-05',
  'seed-learn-06',
  'seed-learn-07',
];

describe('Rewards (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;

  beforeAll(async () => {
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

    const passwordHash = await argon2.hash(TEST_PASSWORD);

    await prisma.user.upsert({
      where: { id: TEST_USER_ID },
      update: { email: TEST_EMAIL, passwordHash },
      create: {
        id: TEST_USER_ID,
        email: TEST_EMAIL,
        passwordHash,
        firstName: 'Rewards',
        lastName: 'Test',
      },
    });

    // Clean any state from a previous run.
    await prisma.$transaction([
      prisma.pointsLedger.deleteMany({ where: { userId: TEST_USER_ID } }),
      prisma.redemption.deleteMany({ where: { userId: TEST_USER_ID } }),
      prisma.partnerLink.deleteMany({ where: { userId: TEST_USER_ID } }),
      prisma.learnCompletion.deleteMany({ where: { userId: TEST_USER_ID } }),
    ]);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
      .expect(200);

    accessToken = login.body.accessToken as string;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
    await app.close();
  });

  it('GET /api/v1/rewards/summary without auth → 401', () => {
    return request(app.getHttpServer()).get('/api/v1/rewards/summary').expect(401);
  });

  it('GET /api/v1/rewards/summary → zero balance, 6 offers ascending by cost, no partners', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/rewards/summary')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body).toEqual({
      pointsBalance: 0,
      lifetimePoints: 0,
      linkedPartners: [],
      availableOffers: expect.any(Array),
    });

    expect(res.body.availableOffers).toHaveLength(6);
    for (let i = 1; i < res.body.availableOffers.length; i++) {
      expect(res.body.availableOffers[i].pointsCost).toBeGreaterThanOrEqual(
        res.body.availableOffers[i - 1].pointsCost,
      );
    }
  });

  it('POST /api/v1/rewards/partners/:partner/link is idempotent and awards a 100-point bonus', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/v1/rewards/partners/momentum_multiply/link')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(first.body).toHaveProperty('partner', 'momentum_multiply');
    expect(first.body).toHaveProperty('linkedAt');

    const second = await request(app.getHttpServer())
      .post('/api/v1/rewards/partners/momentum_multiply/link')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(second.body.linkedAt).toBe(first.body.linkedAt);

    const summary = await request(app.getHttpServer())
      .get('/api/v1/rewards/summary')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(summary.body.pointsBalance).toBe(100);
    expect(summary.body.linkedPartners).toHaveLength(1);
    expect(summary.body.linkedPartners[0].partner).toBe('momentum_multiply');
  });

  it('POST /api/v1/rewards/partners/fake_partner/link → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/rewards/partners/fake_partner/link')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);

    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/v1/rewards/redeem/:offerId with insufficient points → 400 INSUFFICIENT_POINTS', async () => {
    for (const moduleId of ['seed-learn-01', 'seed-learn-02']) {
      await request(app.getHttpServer())
        .post(`/api/v1/learn/modules/${moduleId}/complete`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    }

    const res = await request(app.getHttpServer())
      .post('/api/v1/rewards/redeem/seed-offer-1')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);

    expect(res.body.code).toBe('INSUFFICIENT_POINTS');
    expect(res.body.message).toMatch(/need \d+ more points/);
  });

  it('completes more modules and redeems successfully', async () => {
    for (const moduleId of COMPLETE_MODULES.slice(2)) {
      await request(app.getHttpServer())
        .post(`/api/v1/learn/modules/${moduleId}/complete`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    }

    const before = await request(app.getHttpServer())
      .get('/api/v1/rewards/summary')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(before.body.pointsBalance).toBeGreaterThanOrEqual(500);

    const res = await request(app.getHttpServer())
      .post('/api/v1/rewards/redeem/seed-offer-1')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('redemptionId');
    expect(res.body.offerId).toBe('seed-offer-1');
    expect(res.body.pointsSpent).toBe(500);
    expect(res.body.newBalance).toBe(before.body.pointsBalance - 500);

    const ledgerSum = await prisma.pointsLedger.aggregate({
      where: { userId: TEST_USER_ID },
      _sum: { delta: true },
    });

    expect(ledgerSum._sum.delta).toBe(res.body.newBalance);

    const redemption = await prisma.redemption.findFirst({
      where: { userId: TEST_USER_ID, offerId: 'seed-offer-1' },
    });

    expect(redemption).not.toBeNull();
    expect(redemption?.pointsSpent).toBe(500);
  });

  it('POST /api/v1/rewards/redeem/unknown-offer → 404', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/rewards/redeem/unknown-offer')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);

    expect(res.body.code).toBe('NOT_FOUND');
  });
});
