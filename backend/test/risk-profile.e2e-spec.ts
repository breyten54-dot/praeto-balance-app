import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

const TEST_USER_ID = 'seed-user-risk-profile-test';
const TEST_EMAIL = 'risk-profile-test@praetobalance.co.za';
const TEST_PASSWORD = 'RiskProfileTest123!';

const VECTOR_C = {
  time_horizon: '5to10',
  market_reaction: 'wait_a_year',
  risk_association: 'opportunity',
  underperformance_reaction: 'uneasy_but_ok',
};

const DISCLAIMER =
  'This Risk Portrait is a guide only and does not constitute financial advice as defined in the Financial Advisory and Intermediary Services (FAIS) Act. Praeto Balance is not a licensed financial services provider. Please consult a licensed financial adviser before making any investment decision.';

describe('Risk Profile (e2e)', () => {
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
        firstName: 'Risk',
        lastName: 'ProfileTest',
      },
    });

    await prisma.riskProfileSubmission.deleteMany({ where: { userId: TEST_USER_ID } });

    process.env.FEATURE_RISK_PROFILE_ENABLED = 'true';

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
      .expect(200);

    accessToken = login.body.accessToken as string;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
    process.env.FEATURE_RISK_PROFILE_ENABLED = 'true';
    await app.close();
  });

  it('GET /api/v1/risk-profile/latest without auth → 401', () => {
    return request(app.getHttpServer()).get('/api/v1/risk-profile/latest').expect(401);
  });

  it('POST /api/v1/risk-profile/submit without auth → 401', () => {
    return request(app.getHttpServer())
      .post('/api/v1/risk-profile/submit')
      .send({ answers: VECTOR_C })
      .expect(401);
  });

  it('GET /api/v1/risk-profile/latest with no submissions → 200 null', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/risk-profile/latest')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body).toBeNull();
  });

  it('POST /api/v1/risk-profile/submit vector C → moderately aggressive with 2 products', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/risk-profile/submit')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ answers: VECTOR_C })
      .expect(200);

    expect(res.body.riskCapacityScore).toBe(50);
    expect(res.body.riskAttitudeScore).toBe(75);
    expect(res.body.totalScore).toBe(65);
    expect(res.body.category).toBe('moderately_aggressive');
    expect(res.body.disclaimer).toBe(DISCLAIMER);
    expect(res.body.recommendedProducts).toHaveLength(2);
    expect(res.body.recommendedProducts[0].name).toBe('Growth Equity Portfolio');
    expect(res.body.recommendedProducts[1].name).toBe('SA + Offshore Flexible');
    expect(res.body).toHaveProperty('completedAt');
    expect(res.body).toHaveProperty('id');
  });

  it('GET /api/v1/risk-profile/latest returns the same submission', async () => {
    const submit = await request(app.getHttpServer())
      .post('/api/v1/risk-profile/submit')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ answers: VECTOR_C })
      .expect(200);

    const latest = await request(app.getHttpServer())
      .get('/api/v1/risk-profile/latest')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(latest.body.id).toBe(submit.body.id);
    expect(latest.body.category).toBe('moderately_aggressive');
  });

  it('missing answer → 400 VALIDATION_ERROR', async () => {
    const { time_horizon: _, ...answers } = VECTOR_C;
    const res = await request(app.getHttpServer())
      .post('/api/v1/risk-profile/submit')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ answers })
      .expect(400);

    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('invalid option value → 400 VALIDATION_ERROR', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/risk-profile/submit')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ answers: { ...VECTOR_C, time_horizon: 'forever' } })
      .expect(400);

    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('extra answer key → 400 VALIDATION_ERROR', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/risk-profile/submit')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ answers: { ...VECTOR_C, extra_question: 'extra' } })
      .expect(400);

    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('when FEATURE_RISK_PROFILE_ENABLED=false, both routes → 403 FEATURE_DISABLED', async () => {
    process.env.FEATURE_RISK_PROFILE_ENABLED = 'false';

    const getRes = await request(app.getHttpServer())
      .get('/api/v1/risk-profile/latest')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);

    expect(getRes.body.code).toBe('FEATURE_DISABLED');

    const postRes = await request(app.getHttpServer())
      .post('/api/v1/risk-profile/submit')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ answers: VECTOR_C })
      .expect(403);

    expect(postRes.body.code).toBe('FEATURE_DISABLED');

    process.env.FEATURE_RISK_PROFILE_ENABLED = 'true';
  });
});
