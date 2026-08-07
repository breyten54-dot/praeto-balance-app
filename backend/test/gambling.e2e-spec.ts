import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Gambling (e2e)', () => {
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

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'demo@praetobalance.co.za', password: 'Demo1234!' })
      .expect(200);

    accessToken = login.body.accessToken as string;

    // Clear any cooling-off periods so tests are deterministic.
    await prisma.coolingOffPeriod.deleteMany({
      where: { userId: 'seed-user-demo' },
    });
  });

  afterAll(async () => {
    // Restore default gambling limits so later budget tests see the seeded over-limit state.
    await prisma.gamblingSettings.update({
      where: { userId: 'seed-user-demo' },
      data: { monthlyLimitCents: 50000 },
    });
    await prisma.budgetCategoryLimit.update({
      where: { userId_category: { userId: 'seed-user-demo', category: 'gambling' } },
      data: { limitCents: 50000 },
    });
    await app.close();
  });

  it('GET /api/v1/gambling/summary without auth → 401', () => {
    return request(app.getHttpServer())
      .get('/api/v1/gambling/summary')
      .expect(401);
  });

  it('GET /api/v1/gambling/summary returns seeded gambling data', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/gambling/summary')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('month');
    expect(res.body).toHaveProperty('limitCents');
    expect(res.body).toHaveProperty('spentCents');
    expect(res.body).toHaveProperty('isOverLimit');
    expect(res.body).toHaveProperty('transactions');
    expect(res.body).toHaveProperty('dailyAlertEnabled');
    expect(res.body).toHaveProperty('dailyAlertThresholdCents');

    const expectedSpent = res.body.transactions.reduce(
      (sum: number, tx: { amountCents: number }) => sum + tx.amountCents,
      0,
    );
    expect(res.body.spentCents).toBe(expectedSpent);
    expect(res.body.isOverLimit).toBe(true);
    expect(res.body.transactions.length).toBeGreaterThanOrEqual(6);

    for (const tx of res.body.transactions) {
      expect(tx).toHaveProperty('id');
      expect(tx).toHaveProperty('merchant');
      expect(tx).toHaveProperty('date');
      expect(tx.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(tx).toHaveProperty('category');
      expect(tx.category).toBe('gambling');
      expect(tx).toHaveProperty('amountCents');
    }
  });

  it('PUT /api/v1/gambling/limit flips isOverLimit and updates budget', async () => {
    const summaryBefore = await request(app.getHttpServer())
      .get('/api/v1/gambling/summary')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(summaryBefore.body.isOverLimit).toBe(true);

    const setRes = await request(app.getHttpServer())
      .put('/api/v1/gambling/limit')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ limitCents: 150000 })
      .expect(200);

    expect(setRes.body.isOverLimit).toBe(false);
    expect(setRes.body.limitCents).toBe(150000);

    const budgetSummary = await request(app.getHttpServer())
      .get('/api/v1/budget/summary')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const gamblingBudget = budgetSummary.body.categories.find(
      (c: { category: string }) => c.category === 'gambling',
    );
    expect(gamblingBudget.limitCents).toBe(150000);
  });

  it('POST /api/v1/gambling/cooling-off creates and blocks duplicate', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/gambling/cooling-off')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ days: 30 })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('startsAt');
    expect(res.body).toHaveProperty('endsAt');

    const duplicate = await request(app.getHttpServer())
      .post('/api/v1/gambling/cooling-off')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ days: 30 })
      .expect(409);

    expect(duplicate.body.code).toBe('COOLING_OFF_ACTIVE');
  });

  it('POST /api/v1/gambling/cooling-off with invalid days → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/gambling/cooling-off')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ days: 365 })
      .expect(400);

    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('PUT /api/v1/gambling/daily-alert enables with default threshold', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/v1/gambling/daily-alert')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ enabled: true })
      .expect(200);

    expect(res.body.dailyAlertEnabled).toBe(true);
    expect(res.body.dailyAlertThresholdCents).toBe(10000);
  });
});
