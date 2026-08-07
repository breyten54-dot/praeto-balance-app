import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Auth & Users (e2e)', () => {
  let app: INestApplication;

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
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health returns ok', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
        expect(typeof res.body.uptimeSeconds).toBe('number');
      });
  });

  it('POST /api/v1/auth/login returns tokens and user profile', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'demo@praetobalance.co.za', password: 'Demo1234!' })
      .expect(200);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.user).toEqual({
      id: 'seed-user-demo',
      firstName: 'Thandi',
      lastName: 'Mokoena',
      email: 'demo@praetobalance.co.za',
      lsmBand: 'lsm_4_6',
      memberSince: expect.any(String),
      subscriptionTier: 'free',
      kycStatus: 'verified',
    });
  });

  it('POST /api/v1/auth/login with wrong password returns 401 INVALID_CREDENTIALS', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'demo@praetobalance.co.za', password: 'wrong' })
      .expect(401);

    expect(res.body.code).toBe('INVALID_CREDENTIALS');
    expect(res.body.message).toBeDefined();
  });

  it('POST /api/v1/auth/refresh rotates the refresh token', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'demo@praetobalance.co.za', password: 'Demo1234!' })
      .expect(200);

    const firstRefresh = login.body.refreshToken as string;

    const refresh = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: firstRefresh })
      .expect(200);

    expect(refresh.body).toHaveProperty('accessToken');
    expect(refresh.body).toHaveProperty('refreshToken');
    expect(refresh.body.refreshToken).not.toBe(firstRefresh);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: firstRefresh })
      .expect(401);
  });

  it('POST /api/v1/auth/refresh with concurrent reuse returns 401, not 500', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'demo@praetobalance.co.za', password: 'Demo1234!' })
      .expect(200);

    const refreshToken = login.body.refreshToken as string;

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken }),
      request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken }),
    ]);

    const statuses = [first.status, second.status];
    expect(statuses).not.toContain(500);
    expect(statuses).toContain(200);
    expect(statuses).toContain(401);
  });

  it('GET /api/v1/me requires authentication', async () => {
    await request(app.getHttpServer()).get('/api/v1/me').expect(401);
  });

  it('GET /api/v1/me returns user profile with valid token', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'demo@praetobalance.co.za', password: 'Demo1234!' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);

    expect(res.body.id).toBe('seed-user-demo');
    expect(res.body.email).toBe('demo@praetobalance.co.za');
  });

  it('PATCH /api/v1/me/lsm-band updates the band', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'demo@praetobalance.co.za', password: 'Demo1234!' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .patch('/api/v1/me/lsm-band')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ lsmBand: 'lsm_7_8' })
      .expect(200);

    expect(res.body.lsmBand).toBe('lsm_7_8');
  });

  it('PATCH /api/v1/me/lsm-band rejects invalid enum value', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'demo@praetobalance.co.za', password: 'Demo1234!' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .patch('/api/v1/me/lsm-band')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ lsmBand: 'lsm_99' })
      .expect(400);

    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});
