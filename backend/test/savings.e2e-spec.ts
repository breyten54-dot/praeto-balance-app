import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Savings (e2e)', () => {
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

    process.env.FEATURE_SAVINGS_ENABLED = 'true';

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'demo@praetobalance.co.za', password: 'Demo1234!' })
      .expect(200);

    accessToken = login.body.accessToken as string;
  });

  afterAll(async () => {
    process.env.FEATURE_SAVINGS_ENABLED = 'true';
    await app.close();
  });

  it('GET /api/v1/savings/account without auth → 401', () => {
    return request(app.getHttpServer()).get('/api/v1/savings/account').expect(401);
  });

  it('GET /api/v1/savings/account returns seeded account', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/savings/account')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.provider).toBe('partner_bank');
    expect(res.body.balanceCents).toBe(245000);
    expect(res.body.interestRateAnnual).toBe(5.5);
    expect(res.body.withdrawalsUsedThisYear).toBe(0);
    expect(res.body.withdrawalsAllowedPerYear).toBe(4);
    expect(res.body.goals).toHaveLength(1);

    const emergency = res.body.goals[0];
    expect(emergency.id).toBe('seed-goal-emergency');
    expect(emergency.name).toBe('Emergency fund');
    expect(emergency.targetCents).toBe(1000000);
    expect(emergency.currentCents).toBe(245000);
    expect(emergency.targetDate).toBeNull();
  });

  it('POST /api/v1/savings/goals creates a goal', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/savings/goals')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'December holiday', targetCents: 500000 })
      .expect(200);

    expect(res.body.name).toBe('December holiday');
    expect(res.body.targetCents).toBe(500000);
    expect(res.body.currentCents).toBe(0);
    expect(res.body.targetDate).toBeNull();

    const account = await request(app.getHttpServer())
      .get('/api/v1/savings/account')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(account.body.goals).toHaveLength(2);
  });

  it('POST /api/v1/savings/withdrawals deducts from balance and goal', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/savings/withdrawals')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amountCents: 45000, goalId: 'seed-goal-emergency' })
      .expect(200);

    expect(res.body.amountCents).toBe(45000);
    expect(res.body.newBalanceCents).toBe(200000);

    const account = await request(app.getHttpServer())
      .get('/api/v1/savings/account')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(account.body.balanceCents).toBe(200000);
    const emergency = account.body.goals.find(
      (g: { id: string }) => g.id === 'seed-goal-emergency',
    );
    expect(emergency.currentCents).toBe(200000);
  });

  it('POST /api/v1/savings/withdrawals with unknown goal → 404', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/savings/withdrawals')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amountCents: 1000, goalId: 'unknown-goal' })
      .expect(404);

    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('POST /api/v1/savings/withdrawals with insufficient balance → 400 LIMIT_EXCEEDED', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/savings/withdrawals')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amountCents: 99999999 })
      .expect(400);

    expect(res.body.code).toBe('LIMIT_EXCEEDED');
    expect(res.body.message).toBe('Insufficient savings balance.');
  });

  it('enforces annual withdrawal cap', async () => {
    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/savings/withdrawals')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ amountCents: 100 })
        .expect(200);
    }

    const account = await request(app.getHttpServer())
      .get('/api/v1/savings/account')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(account.body.withdrawalsUsedThisYear).toBe(4);

    const res = await request(app.getHttpServer())
      .post('/api/v1/savings/withdrawals')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amountCents: 100 })
      .expect(400);

    expect(res.body.code).toBe('LIMIT_EXCEEDED');
    expect(res.body.message).toBe('Withdrawal limit reached for this year.');
  });

  it('POST /api/v1/savings/goals validates inputs', async () => {
    const emptyName = await request(app.getHttpServer())
      .post('/api/v1/savings/goals')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '', targetCents: 1000 })
      .expect(400);

    expect(emptyName.body.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/v1/savings/withdrawals validates inputs', async () => {
    const negative = await request(app.getHttpServer())
      .post('/api/v1/savings/withdrawals')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amountCents: -100 })
      .expect(400);

    expect(negative.body.code).toBe('VALIDATION_ERROR');
  });

  it('when FEATURE_SAVINGS_ENABLED=false, all routes → 403 FEATURE_DISABLED', async () => {
    process.env.FEATURE_SAVINGS_ENABLED = 'false';

    const getRes = await request(app.getHttpServer())
      .get('/api/v1/savings/account')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);

    expect(getRes.body.code).toBe('FEATURE_DISABLED');

    const postGoalRes = await request(app.getHttpServer())
      .post('/api/v1/savings/goals')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Test', targetCents: 1000 })
      .expect(403);

    expect(postGoalRes.body.code).toBe('FEATURE_DISABLED');

    const postWithdrawRes = await request(app.getHttpServer())
      .post('/api/v1/savings/withdrawals')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amountCents: 1000 })
      .expect(403);

    expect(postWithdrawRes.body.code).toBe('FEATURE_DISABLED');

    process.env.FEATURE_SAVINGS_ENABLED = 'true';
  });
});
