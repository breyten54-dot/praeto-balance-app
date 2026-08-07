import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Score (e2e)', () => {
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
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/score without auth → 401', () => {
    return request(app.getHttpServer()).get('/api/v1/score').expect(401);
  });

  it('GET /api/v1/score returns score with all five dimensions', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/score')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('score');
    expect(res.body).toHaveProperty('changeFromLastMonth');
    expect(res.body).toHaveProperty('dimensions');
    expect(res.body).toHaveProperty('computedAt');

    expect(res.body.dimensions).toHaveProperty('financialKnowledge');
    expect(res.body.dimensions).toHaveProperty('moneyManagement');
    expect(res.body.dimensions).toHaveProperty('savingBehaviour');
    expect(res.body.dimensions).toHaveProperty('spendingControl');
    expect(res.body.dimensions).toHaveProperty('debtResilience');

    for (const value of Object.values(res.body.dimensions) as number[]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }

    expect(res.body.changeFromLastMonth).not.toBe(0);
  });

  it('GET /api/v1/score twice does not create duplicate snapshot', async () => {
    const now = new Date();
    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

    await request(app.getHttpServer())
      .get('/api/v1/score')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/score')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const count = await prisma.scoreSnapshot.count({
      where: { userId: 'seed-user-demo', month },
    });

    expect(count).toBe(1);
  });

  it('GET /api/v1/score/history?months=6 returns ascending history', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/score/history?months=6')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('months');
    expect(res.body.months.length).toBeGreaterThanOrEqual(2);

    for (let i = 1; i < res.body.months.length; i++) {
      expect(res.body.months[i].month >= res.body.months[i - 1].month).toBe(true);
    }
  });

  it('GET /api/v1/score/history?months=99 → 400', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/score/history?months=99')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);

    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});
