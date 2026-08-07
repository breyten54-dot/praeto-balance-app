import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Learn (e2e)', () => {
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

    // Reset learn state for deterministic tests.
    await prisma.learnCompletion.deleteMany({ where: { userId: 'seed-user-demo' } });
    await prisma.pointsLedger.deleteMany({ where: { userId: 'seed-user-demo', reason: 'learn_module' } });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/learn/modules?lsmBand=lsm_4_6 without auth → 401', () => {
    return request(app.getHttpServer())
      .get('/api/v1/learn/modules?lsmBand=lsm_4_6')
      .expect(401);
  });

  it('GET /api/v1/learn/modules returns 12 modules with 4 available (one per pillar)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/learn/modules?lsmBand=lsm_4_6')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body).toHaveLength(12);

    const available = res.body.filter(
      (m: { status: string }) => m.status === 'available',
    );
    expect(available).toHaveLength(4);
    expect(available.map((m: { pillar: number }) => m.pillar).sort()).toEqual([
      1, 2, 3, 4,
    ]);

    const locked = res.body.filter(
      (m: { status: string }) => m.status === 'locked',
    );
    expect(locked).toHaveLength(8);

    // Verify ordering by pillar then orderIndex.
    const ids = res.body.map((m: { id: string }) => m.id);
    expect(ids[0]).toBe('seed-learn-01');
    expect(ids[1]).toBe('seed-learn-02');
    expect(ids[2]).toBe('seed-learn-03');
  });

  it('POST /api/v1/learn/modules/seed-learn-01/complete awards points', async () => {
    const complete = await request(app.getHttpServer())
      .post('/api/v1/learn/modules/seed-learn-01/complete')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(complete.body).toEqual({
      id: 'seed-learn-01',
      status: 'completed',
      pointsAwarded: 50,
    });

    const ledger = await prisma.pointsLedger.findMany({
      where: { userId: 'seed-user-demo', reason: 'learn_module' },
    });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].delta).toBe(50);

    const modules = await request(app.getHttpServer())
      .get('/api/v1/learn/modules?lsmBand=lsm_4_6')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const m1 = modules.body.find(
      (m: { id: string }) => m.id === 'seed-learn-01',
    );
    const m2 = modules.body.find(
      (m: { id: string }) => m.id === 'seed-learn-02',
    );
    expect(m1.status).toBe('completed');
    expect(m2.status).toBe('available');
  });

  it('POST complete on already-completed module is idempotent', async () => {
    const complete = await request(app.getHttpServer())
      .post('/api/v1/learn/modules/seed-learn-01/complete')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(complete.body).toEqual({
      id: 'seed-learn-01',
      status: 'completed',
      pointsAwarded: 50,
    });

    const ledger = await prisma.pointsLedger.findMany({
      where: { userId: 'seed-user-demo', reason: 'learn_module' },
    });
    expect(ledger).toHaveLength(1);
  });

  it('POST complete on locked module → 403 FORBIDDEN', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/learn/modules/seed-learn-03/complete')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);

    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('POST complete on unknown module → 404', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/learn/modules/not-real/complete')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);

    expect(res.body.code).toBe('NOT_FOUND');
  });
});
