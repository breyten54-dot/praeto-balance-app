import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

const TEST_USER_ID = 'seed-user-bank-test';
const TEST_EMAIL = 'bank-test@praetobalance.co.za';
const TEST_PASSWORD = 'BankTest123!';

const OTHER_USER_ID = 'seed-user-bank-other';
const OTHER_EMAIL = 'bank-other@praetobalance.co.za';
const OTHER_PASSWORD = 'BankOther123!';

describe('Bank-link stub (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let otherAccessToken: string;

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
          firstName: 'Bank',
          lastName: 'Test',
        },
      });
    }

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
    await app.close();
  });

  beforeEach(async () => {
    await prisma.bankLinkToken.deleteMany({
      where: { userId: { in: [TEST_USER_ID, OTHER_USER_ID] } },
    });
    await prisma.bankAccount.deleteMany({
      where: { userId: { in: [TEST_USER_ID, OTHER_USER_ID] } },
    });
  });

  it('requires auth on all four routes', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/bank-link/token')
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/bank-link/exchange')
      .send({ publicToken: 'x', institutionId: 'capitec' })
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/bank-link/accounts')
      .expect(401);
    await request(app.getHttpServer())
      .delete('/api/v1/bank-link/accounts/x')
      .expect(401);
  });

  it('creates a link token and exchanges it for a Capitec account', async () => {
    const tokenRes = await request(app.getHttpServer())
      .post('/api/v1/bank-link/token')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(tokenRes.body.linkToken).toBeDefined();
    expect(tokenRes.body.expiresAt).toBeDefined();
    const expiresAt = new Date(tokenRes.body.expiresAt).getTime();
    const now = Date.now();
    expect(expiresAt).toBeGreaterThan(now);
    expect(expiresAt).toBeLessThanOrEqual(now + 15 * 60 * 1000 + 1000);

    const exchangeRes = await request(app.getHttpServer())
      .post('/api/v1/bank-link/exchange')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ publicToken: tokenRes.body.linkToken, institutionId: 'capitec' })
      .expect(200);

    expect(exchangeRes.body.institutionId).toBe('capitec');
    expect(exchangeRes.body.institutionName).toBe('Capitec');
    expect(exchangeRes.body.status).toBe('active');
    expect(exchangeRes.body.maskedAccountNumber).toMatch(/^\*{4}\d{4}$/);
    expect(new Date(exchangeRes.body.linkedAt).toISOString()).toBe(
      exchangeRes.body.linkedAt,
    );

    const listRes = await request(app.getHttpServer())
      .get('/api/v1/bank-link/accounts')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(listRes.body.accounts).toHaveLength(1);
    expect(listRes.body.accounts[0].id).toBe(exchangeRes.body.id);
  });

  it('rejects a reused or expired link token with 401', async () => {
    const tokenRes = await request(app.getHttpServer())
      .post('/api/v1/bank-link/token')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/bank-link/exchange')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ publicToken: tokenRes.body.linkToken, institutionId: 'fnb' })
      .expect(200);

    const reused = await request(app.getHttpServer())
      .post('/api/v1/bank-link/exchange')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ publicToken: tokenRes.body.linkToken, institutionId: 'fnb' })
      .expect(401);
    expect(reused.body.code).toBe('UNAUTHORIZED');

    const expiredToken = await prisma.bankLinkToken.create({
      data: {
        userId: TEST_USER_ID,
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    const expired = await request(app.getHttpServer())
      .post('/api/v1/bank-link/exchange')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ publicToken: expiredToken.id, institutionId: 'fnb' })
      .expect(401);
    expect(expired.body.code).toBe('UNAUTHORIZED');
  });

  it('rejects an unknown institution with VALIDATION_ERROR', async () => {
    const tokenRes = await request(app.getHttpServer())
      .post('/api/v1/bank-link/token')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .post('/api/v1/bank-link/exchange')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ publicToken: tokenRes.body.linkToken, institutionId: 'barclays' })
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('soft-deletes an account and rejects cross-user deletion', async () => {
    const tokenRes = await request(app.getHttpServer())
      .post('/api/v1/bank-link/token')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const exchangeRes = await request(app.getHttpServer())
      .post('/api/v1/bank-link/exchange')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ publicToken: tokenRes.body.linkToken, institutionId: 'absa' })
      .expect(200);

    const otherTokenRes = await request(app.getHttpServer())
      .post('/api/v1/bank-link/token')
      .set('Authorization', `Bearer ${otherAccessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/bank-link/exchange')
      .set('Authorization', `Bearer ${otherAccessToken}`)
      .send({ publicToken: otherTokenRes.body.linkToken, institutionId: 'absa' })
      .expect(200);

    const del = await request(app.getHttpServer())
      .delete(`/api/v1/bank-link/accounts/${exchangeRes.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(del.body).toEqual({ deleted: true });

    const list = await request(app.getHttpServer())
      .get('/api/v1/bank-link/accounts')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(list.body.accounts).toHaveLength(0);

    const cross = await request(app.getHttpServer())
      .get('/api/v1/bank-link/accounts')
      .set('Authorization', `Bearer ${otherAccessToken}`)
      .expect(200);
    expect(cross.body.accounts).toHaveLength(1);

    const crossDel = await request(app.getHttpServer())
      .delete(`/api/v1/bank-link/accounts/${cross.body.accounts[0].id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
    expect(crossDel.body.code).toBe('NOT_FOUND');
  });
});
