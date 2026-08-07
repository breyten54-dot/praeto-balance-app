import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

function formatMonth(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function previousMonth(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return formatMonth(d);
}

describe('Budget (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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

  it('GET /api/v1/budget/summary without auth → 401', () => {
    return request(app.getHttpServer())
      .get('/api/v1/budget/summary')
      .expect(401);
  });

  it('GET /api/v1/budget/summary returns current month shape with 8 categories', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/budget/summary')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('month');
    expect(res.body).toHaveProperty('incomeCents');
    expect(res.body).toHaveProperty('totalSpentCents');
    expect(res.body).toHaveProperty('availableCents');
    expect(res.body).toHaveProperty('categories');
    expect(res.body.categories).toHaveLength(8);

    const sum = res.body.categories.reduce(
      (acc: number, c: { spentCents: number }) => acc + c.spentCents,
      0,
    );
    expect(res.body.totalSpentCents).toBe(sum);
    expect(res.body.availableCents).toBe(res.body.incomeCents - sum);

    const gambling = res.body.categories.find(
      (c: { category: string }) => c.category === 'gambling',
    );
    expect(gambling).toBeDefined();
    expect(gambling.spentCents).toBeGreaterThan(gambling.limitCents);

    for (const cat of res.body.categories) {
      expect(cat).toHaveProperty('category');
      expect(cat).toHaveProperty('label');
      expect(cat).toHaveProperty('icon');
      expect(cat).toHaveProperty('limitCents');
      expect(cat).toHaveProperty('spentCents');
    }
  });

  it('GET /api/v1/budget/summary?month=<previous> returns previous month data', async () => {
    const month = previousMonth(new Date());
    const res = await request(app.getHttpServer())
      .get(`/api/v1/budget/summary?month=${month}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.month).toBe(month);
    expect(res.body.totalSpentCents).toBeGreaterThan(0);
    expect(res.body.categories).toHaveLength(8);
  });

  it('PUT /api/v1/budget/categories/groceries/limit updates limit and summary reflects it', async () => {
    const setRes = await request(app.getHttpServer())
      .put('/api/v1/budget/categories/groceries/limit')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ limitCents: 500000 })
      .expect(200);

    expect(setRes.body.category).toBe('groceries');
    expect(setRes.body.limitCents).toBe(500000);

    const summary = await request(app.getHttpServer())
      .get('/api/v1/budget/summary')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const groceries = summary.body.categories.find(
      (c: { category: string }) => c.category === 'groceries',
    );
    expect(groceries.limitCents).toBe(500000);
  });

  it('PUT /api/v1/budget/categories/not_a_category/limit → 404', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/v1/budget/categories/not_a_category/limit')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ limitCents: 500000 })
      .expect(404);

    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('PUT /api/v1/budget/categories/groceries/limit with negative limit → 400', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/v1/budget/categories/groceries/limit')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ limitCents: -5 })
      .expect(400);

    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});
