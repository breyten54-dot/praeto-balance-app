import {
  PrismaClient,
  Prisma,
  LsmBand,
  SubscriptionTier,
  KycStatus,
} from '@prisma/client';
import * as argon2 from 'argon2';
import { computeScore } from '../src/score/score.formula';
import { BUDGET_CATEGORIES } from '../src/budget/budget-categories';

const prisma = new PrismaClient();

const MERCHANT_MAP: Record<string, string> = {
  Checkers: 'groceries',
  Shoprite: 'groceries',
  'Woolworths Food': 'groceries',
  Uber: 'transport',
  Bolt: 'transport',
  Engen: 'transport',
  'Vodacom Airtime': 'airtime_data',
  'Telkom Data': 'airtime_data',
  'Eskom Prepaid': 'utilities',
  'City of Durban Water': 'utilities',
  KFC: 'eating_out',
  "Nando's": 'eating_out',
  Steers: 'eating_out',
  Showmax: 'entertainment',
  Netflix: 'entertainment',
  'Ster-Kinekor': 'entertainment',
  Hollywoodbets: 'gambling',
  Betway: 'gambling',
  Lottostar: 'gambling',
  Takealot: 'other',
  Clicks: 'other',
};

interface SeedTx {
  id: string;
  merchant: string;
  category: string;
  amountCents: number;
  day: number;
}

function currentAndPreviousMonthDates(now = new Date()) {
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();
  const previous = currentMonth === 0 ? { year: currentYear - 1, month: 11 } : { year: currentYear, month: currentMonth - 1 };
  return {
    current: { year: currentYear, month: currentMonth },
    previous,
  };
}

function buildOccurredAt(year: number, month: number, day: number, hour: number, minute: number) {
  return new Date(Date.UTC(year, month, day, hour, minute));
}

function generateCoachingSlots() {
  // SAST is UTC+2 (no DST). Generate 14 future weekday slots at 09:00, 11:00, 14:00.
  const slots: { id: string; startsAt: Date; endsAt: Date }[] = [];
  const now = new Date();
  const sastOffsetHours = -2;
  let dayCursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  dayCursor.setUTCDate(dayCursor.getUTCDate() + 1);

  while (slots.length < 14 * 3) {
    const dayOfWeek = dayCursor.getUTCDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      for (const hour of [9, 11, 14]) {
        const startsAt = new Date(dayCursor);
        startsAt.setUTCHours(hour + sastOffsetHours, 0, 0, 0);
        const endsAt = new Date(startsAt.getTime() + 45 * 60 * 1000);
        const dateLabel = startsAt.toISOString().slice(0, 10);
        slots.push({
          id: `slot-${dateLabel}-${String(hour).padStart(2, '0')}-00`,
          startsAt,
          endsAt,
        });
      }
    }
    dayCursor.setUTCDate(dayCursor.getUTCDate() + 1);
  }

  return slots;
}

async function main() {
  const passwordHash = await argon2.hash('Demo1234!');

  await prisma.user.upsert({
    where: { id: 'seed-user-demo' },
    update: {
      email: 'demo@praetobalance.co.za',
      passwordHash,
      firstName: 'Thandi',
      lastName: 'Mokoena',
      lsmBand: LsmBand.lsm_4_6,
      subscriptionTier: SubscriptionTier.free,
      kycStatus: KycStatus.verified,
      monthlyIncomeCents: 1850000,
    },
    create: {
      id: 'seed-user-demo',
      email: 'demo@praetobalance.co.za',
      passwordHash,
      firstName: 'Thandi',
      lastName: 'Mokoena',
      lsmBand: LsmBand.lsm_4_6,
      subscriptionTier: SubscriptionTier.free,
      kycStatus: KycStatus.verified,
      monthlyIncomeCents: 1850000,
    },
  });

  // Reset per-user state that tests mutate, so a fresh seed is deterministic.
  await prisma.$transaction([
    prisma.pointsLedger.deleteMany({ where: { userId: 'seed-user-demo' } }),
    prisma.learnCompletion.deleteMany({ where: { userId: 'seed-user-demo' } }),
    prisma.redemption.deleteMany({ where: { userId: 'seed-user-demo' } }),
    prisma.partnerLink.deleteMany({ where: { userId: 'seed-user-demo' } }),
    prisma.riskProfileSubmission.deleteMany({ where: { userId: 'seed-user-demo' } }),
  ]);

  // Idempotent transaction seed: delete all seed-source rows, then recreate.
  await prisma.transaction.deleteMany({ where: { source: 'seed' } });

  const { current, previous } = currentAndPreviousMonthDates();

  const currentMonthTxs: SeedTx[] = [
    { id: 'seed-tx-001', merchant: 'Checkers', category: 'groceries', amountCents: 18500, day: 2 },
    { id: 'seed-tx-002', merchant: 'Shoprite', category: 'groceries', amountCents: 22400, day: 5 },
    { id: 'seed-tx-003', merchant: 'Woolworths Food', category: 'groceries', amountCents: 45100, day: 8 },
    { id: 'seed-tx-004', merchant: 'Checkers', category: 'groceries', amountCents: 12300, day: 12 },
    { id: 'seed-tx-005', merchant: 'Shoprite', category: 'groceries', amountCents: 28900, day: 15 },
    { id: 'seed-tx-006', merchant: 'Woolworths Food', category: 'groceries', amountCents: 67200, day: 19 },
    { id: 'seed-tx-007', merchant: 'Uber', category: 'transport', amountCents: 7200, day: 3 },
    { id: 'seed-tx-008', merchant: 'Bolt', category: 'transport', amountCents: 5800, day: 6 },
    { id: 'seed-tx-009', merchant: 'Engen', category: 'transport', amountCents: 18500, day: 10 },
    { id: 'seed-tx-010', merchant: 'Uber', category: 'transport', amountCents: 9500, day: 14 },
    { id: 'seed-tx-011', merchant: 'Bolt', category: 'transport', amountCents: 6200, day: 18 },
    { id: 'seed-tx-012', merchant: 'Vodacom Airtime', category: 'airtime_data', amountCents: 15000, day: 1 },
    { id: 'seed-tx-013', merchant: 'Telkom Data', category: 'airtime_data', amountCents: 22000, day: 11 },
    { id: 'seed-tx-014', merchant: 'Eskom Prepaid', category: 'utilities', amountCents: 45000, day: 4 },
    { id: 'seed-tx-015', merchant: 'City of Durban Water', category: 'utilities', amountCents: 32000, day: 9 },
    { id: 'seed-tx-016', merchant: 'KFC', category: 'eating_out', amountCents: 18500, day: 7 },
    { id: 'seed-tx-017', merchant: "Nando's", category: 'eating_out', amountCents: 24500, day: 13 },
    { id: 'seed-tx-018', merchant: 'Steers', category: 'eating_out', amountCents: 16800, day: 17 },
    { id: 'seed-tx-019', merchant: 'KFC', category: 'eating_out', amountCents: 11200, day: 21 },
    { id: 'seed-tx-020', merchant: 'Showmax', category: 'entertainment', amountCents: 12000, day: 2 },
    { id: 'seed-tx-021', merchant: 'Netflix', category: 'entertainment', amountCents: 22000, day: 6 },
    { id: 'seed-tx-022', merchant: 'Ster-Kinekor', category: 'entertainment', amountCents: 18500, day: 16 },
    { id: 'seed-tx-023', merchant: 'Hollywoodbets', category: 'gambling', amountCents: 12000, day: 5 },
    { id: 'seed-tx-024', merchant: 'Betway', category: 'gambling', amountCents: 11000, day: 8 },
    { id: 'seed-tx-025', merchant: 'Lottostar', category: 'gambling', amountCents: 10000, day: 12 },
    { id: 'seed-tx-026', merchant: 'Hollywoodbets', category: 'gambling', amountCents: 9500, day: 15 },
    { id: 'seed-tx-027', merchant: 'Betway', category: 'gambling', amountCents: 9000, day: 19 },
    { id: 'seed-tx-028', merchant: 'Lottostar', category: 'gambling', amountCents: 8500, day: 22 },
    { id: 'seed-tx-029', merchant: 'Takealot', category: 'other', amountCents: 45000, day: 4 },
    { id: 'seed-tx-030', merchant: 'Clicks', category: 'other', amountCents: 18500, day: 10 },
    { id: 'seed-tx-031', merchant: 'Takealot', category: 'other', amountCents: 22000, day: 14 },
    { id: 'seed-tx-032', merchant: 'Clicks', category: 'other', amountCents: 12500, day: 20 },
    { id: 'seed-tx-033', merchant: 'Checkers', category: 'groceries', amountCents: 31200, day: 23 },
    { id: 'seed-tx-034', merchant: 'Uber', category: 'transport', amountCents: 7800, day: 25 },
    { id: 'seed-tx-035', merchant: 'KFC', category: 'eating_out', amountCents: 9500, day: 27 },
    { id: 'seed-tx-036', merchant: 'Netflix', category: 'entertainment', amountCents: 22000, day: 28 },
    { id: 'seed-tx-037', merchant: 'Woolworths Food', category: 'groceries', amountCents: 54000, day: 29 },
    { id: 'seed-tx-038', merchant: 'Vodacom Airtime', category: 'airtime_data', amountCents: 12000, day: 30 },
  ];

  const previousMonthTxs: SeedTx[] = [
    { id: 'seed-tx-101', merchant: 'Checkers', category: 'groceries', amountCents: 21000, day: 2 },
    { id: 'seed-tx-102', merchant: 'Shoprite', category: 'groceries', amountCents: 18500, day: 5 },
    { id: 'seed-tx-103', merchant: 'Woolworths Food', category: 'groceries', amountCents: 39000, day: 8 },
    { id: 'seed-tx-104', merchant: 'Checkers', category: 'groceries', amountCents: 14200, day: 12 },
    { id: 'seed-tx-105', merchant: 'Uber', category: 'transport', amountCents: 6500, day: 3 },
    { id: 'seed-tx-106', merchant: 'Bolt', category: 'transport', amountCents: 5200, day: 6 },
    { id: 'seed-tx-107', merchant: 'Engen', category: 'transport', amountCents: 21000, day: 10 },
    { id: 'seed-tx-108', merchant: 'Uber', category: 'transport', amountCents: 8800, day: 14 },
    { id: 'seed-tx-109', merchant: 'Vodacom Airtime', category: 'airtime_data', amountCents: 14000, day: 1 },
    { id: 'seed-tx-110', merchant: 'Telkom Data', category: 'airtime_data', amountCents: 18000, day: 11 },
    { id: 'seed-tx-111', merchant: 'Eskom Prepaid', category: 'utilities', amountCents: 42000, day: 4 },
    { id: 'seed-tx-112', merchant: 'City of Durban Water', category: 'utilities', amountCents: 29500, day: 9 },
    { id: 'seed-tx-113', merchant: 'KFC', category: 'eating_out', amountCents: 16500, day: 7 },
    { id: 'seed-tx-114', merchant: "Nando's", category: 'eating_out', amountCents: 23000, day: 13 },
    { id: 'seed-tx-115', merchant: 'Steers', category: 'eating_out', amountCents: 15200, day: 17 },
    { id: 'seed-tx-116', merchant: 'Showmax', category: 'entertainment', amountCents: 12000, day: 2 },
    { id: 'seed-tx-117', merchant: 'Netflix', category: 'entertainment', amountCents: 22000, day: 6 },
    { id: 'seed-tx-118', merchant: 'Ster-Kinekor', category: 'entertainment', amountCents: 17000, day: 16 },
    { id: 'seed-tx-119', merchant: 'Hollywoodbets', category: 'gambling', amountCents: 9500, day: 5 },
    { id: 'seed-tx-120', merchant: 'Betway', category: 'gambling', amountCents: 8500, day: 8 },
    { id: 'seed-tx-121', merchant: 'Lottostar', category: 'gambling', amountCents: 11000, day: 12 },
    { id: 'seed-tx-122', merchant: 'Hollywoodbets', category: 'gambling', amountCents: 7500, day: 15 },
    { id: 'seed-tx-123', merchant: 'Betway', category: 'gambling', amountCents: 9000, day: 19 },
    { id: 'seed-tx-124', merchant: 'Takealot', category: 'other', amountCents: 38000, day: 4 },
    { id: 'seed-tx-125', merchant: 'Clicks', category: 'other', amountCents: 16500, day: 10 },
    { id: 'seed-tx-126', merchant: 'Takealot', category: 'other', amountCents: 19500, day: 14 },
    { id: 'seed-tx-127', merchant: 'Clicks', category: 'other', amountCents: 11200, day: 20 },
    { id: 'seed-tx-128', merchant: 'Shoprite', category: 'groceries', amountCents: 26500, day: 22 },
    { id: 'seed-tx-129', merchant: 'Bolt', category: 'transport', amountCents: 6800, day: 24 },
    { id: 'seed-tx-130', merchant: 'KFC', category: 'eating_out', amountCents: 10500, day: 26 },
    { id: 'seed-tx-131', merchant: 'Woolworths Food', category: 'groceries', amountCents: 48500, day: 28 },
    { id: 'seed-tx-132', merchant: 'Vodacom Airtime', category: 'airtime_data', amountCents: 13500, day: 30 },
    { id: 'seed-tx-133', merchant: 'Eskom Prepaid', category: 'utilities', amountCents: 39000, day: 18 },
    { id: 'seed-tx-134', merchant: 'Nando\'s', category: 'eating_out', amountCents: 19800, day: 21 },
    { id: 'seed-tx-135', merchant: 'Netflix', category: 'entertainment', amountCents: 22000, day: 29 },
  ];

  const allTxs = [
    ...currentMonthTxs.map((tx) => ({ ...tx, ...current })),
    ...previousMonthTxs.map((tx) => ({ ...tx, ...previous })),
  ];

  for (const tx of allTxs) {
    await prisma.transaction.create({
      data: {
        id: tx.id,
        userId: 'seed-user-demo',
        merchant: tx.merchant,
        category: tx.category,
        amountCents: tx.amountCents,
        occurredAt: buildOccurredAt(tx.year, tx.month, tx.day, 10, 0),
        source: 'seed',
      },
    });
  }

  // Seed default category limits (idempotent upsert). Real user overrides survive re-seed.
  const defaultLimits = [
    { category: 'groceries', limitCents: 450000 },
    { category: 'transport', limitCents: 180000 },
    { category: 'airtime_data', limitCents: 60000 },
    { category: 'utilities', limitCents: 150000 },
    { category: 'eating_out', limitCents: 120000 },
    { category: 'entertainment', limitCents: 80000 },
    { category: 'gambling', limitCents: 50000 },
    { category: 'other', limitCents: 100000 },
  ];

  for (const lim of defaultLimits) {
    await prisma.budgetCategoryLimit.upsert({
      where: { userId_category: { userId: 'seed-user-demo', category: lim.category } },
      update: { limitCents: lim.limitCents },
      create: { userId: 'seed-user-demo', category: lim.category, limitCents: lim.limitCents },
    });
  }

  await prisma.gamblingSettings.upsert({
    where: { userId: 'seed-user-demo' },
    update: { monthlyLimitCents: 50000, dailyAlertEnabled: false, dailyAlertThresholdCents: null },
    create: {
      userId: 'seed-user-demo',
      monthlyLimitCents: 50000,
      dailyAlertEnabled: false,
      dailyAlertThresholdCents: null,
    },
  });

  const learnModules = [
    {
      id: 'seed-learn-01',
      pillar: 1,
      orderIndex: 1,
      title: 'Where does your money go?',
      subtitle: 'Track a month of real spending',
      bodyMarkdown: `Most people believe they know where their money goes, yet the small, repeated purchases usually disappear faster than the large ones. A daily coffee, a quick app download, a few bets on a weekend match and an impulse takeaway can together add up to hundreds of rands in a single month. In this module you will look at one full month of real spending and sort every transaction into clear categories such as groceries, transport, airtime and data, eating out, entertainment and gambling. The exercise is not meant to shame you; it is meant to reveal the pattern that your memory alone cannot see. Once you can see where your money is actually going, you can begin deciding where you want it to go instead. Many people find that simply writing down every spend for thirty days changes their behaviour automatically, because awareness comes before control. You do not need a fancy spreadsheet; a notebook or the notes app on your phone is enough. A clear, honest picture of your cash flow is the first step toward any lasting financial change.`,
      videoUrl: null,
      videoStatus: 'not_produced',
      pointsAwarded: 50,
      estimatedMinutes: 6,
    },
    {
      id: 'seed-learn-02',
      pillar: 1,
      orderIndex: 2,
      title: 'Needs, wants and leaks',
      subtitle: 'Spot the spending that adds no value',
      bodyMarkdown: `Every rand you spend falls into one of three categories: needs, wants and leaks. Needs are the bills that keep your life stable, such as rent or bond payments, groceries, transport, school fees, electricity and debt instalments. Wants are the things that make life enjoyable, such as streaming services, eating out, new clothes and entertainment, but they can be delayed or reduced when money is tight. Leaks are the most dangerous category because they slip through unnoticed, such as unused gym memberships, app subscriptions you forgot about, daily convenience-store snacks and impulse online purchases. In this module you will learn to sort your own spending honestly and spot the leaks that quietly drain your budget. A leak is not the same as a want; a want gives you something you value, while a leak gives you almost nothing. The goal is not to cut out every pleasure; it is to make sure your money is going where you actually want it to go. Closing even one or two leaks can free up surprising room for the things that matter more to you.`,
      videoUrl: null,
      videoStatus: 'not_produced',
      pointsAwarded: 50,
      estimatedMinutes: 7,
    },
    {
      id: 'seed-learn-03',
      pillar: 1,
      orderIndex: 3,
      title: 'Your first budget',
      subtitle: 'Build a simple monthly plan that sticks',
      bodyMarkdown: `A budget is simply a plan for your money before the month begins, not a punishment for past spending. Start with the income that actually lands in your account after tax and deductions, then list every need and commit money to each one before the month starts. Next, set a realistic amount for savings, even if it is only a few hundred rand. Whatever remains can be split between wants, extra debt repayment and a small buffer for surprises. The trick is to keep the budget simple enough to update in five minutes and to review it once a week. If a category runs out, you adjust the next week rather than abandoning the whole plan. Many budgets fail because they are too complicated or too strict; a budget that lives in your head is easily forgotten. A budget written down and checked regularly becomes a tool that helps you say yes to the things you truly care about, because it makes the trade-offs visible before you spend.`,
      videoUrl: null,
      videoStatus: 'not_produced',
      pointsAwarded: 75,
      estimatedMinutes: 10,
    },
    {
      id: 'seed-learn-04',
      pillar: 2,
      orderIndex: 1,
      title: 'The debt spiral',
      subtitle: 'How short-term credit gets expensive',
      bodyMarkdown: `Short-term credit can feel like a lifeline in an emergency, but it can quickly become a cycle that is hard to escape. When you borrow to pay for everyday living, you add interest and fees to bills that were already difficult to cover. If the next month is also tight, you may borrow again to repay the first loan. That is the debt spiral: each new loan makes the hole deeper and the interest heavier, and the fees keep the cycle turning. In this module you will see how interest rates, initiation fees and late charges work together to keep you stuck. You will also learn why the first step out is to stop digging, even if that means having a hard but honest conversation with creditors. Breaking the spiral is not about blame; it is about changing the pattern before it grows. Once you stop adding new short-term debt, you can start rearranging what you already owe into a manageable plan.`,
      videoUrl: null,
      videoStatus: 'not_produced',
      pointsAwarded: 50,
      estimatedMinutes: 8,
    },
    {
      id: 'seed-learn-05',
      pillar: 2,
      orderIndex: 2,
      title: 'Good debt, bad debt',
      subtitle: 'When borrowing builds vs breaks you',
      bodyMarkdown: `Debt is not automatically bad, but it is not automatically good either. The difference depends on what the debt does for you over time. Good debt helps you acquire something that grows in value or increases your income, such as a home loan on a well-chosen property or a student loan for a qualification that lifts your earnings. Bad debt is borrowing for things that lose value quickly or for pure consumption, such as clothes, gadgets, holidays and gambling. The difference is not about shame or status; it is about whether the debt leaves you better off five years from now. In this module you will learn to judge each debt by its purpose, its interest rate and whether it moves you toward or away from your long-term goals. You will also see why a low-interest loan for education can be sensible, while a high-interest loan for a night out can quietly cost far more than the original price.`,
      videoUrl: null,
      videoStatus: 'not_produced',
      pointsAwarded: 50,
      estimatedMinutes: 8,
    },
    {
      id: 'seed-learn-06',
      pillar: 2,
      orderIndex: 3,
      title: 'Getting out of arrears',
      subtitle: 'A step-by-step catch-up plan',
      bodyMarkdown: `Falling behind on bills is stressful, but the situation is usually fixable if you face it directly rather than avoiding calls and letters. Start by listing every account you owe, the amount in arrears, the interest rate and any penalties. Pay the debts that keep life running first, such as rent, electricity, transport and food. Then contact the other creditors honestly and ask for a realistic payment arrangement. Most creditors prefer a steady, smaller payment plan over silence, because silence gives them no information about when they will be paid. In this module you will build a catch-up schedule that protects your essentials, stops penalties from growing and rebuilds trust one payment at a time. The goal is progress, not perfection. Even a small, consistent payment shows good faith and often prevents further legal action, while hiding only makes the problem harder to solve. Communication does not remove the debt, but it does remove the uncertainty that makes arrears feel overwhelming.`,

      videoUrl: null,
      videoStatus: 'not_produced',
      pointsAwarded: 75,
      estimatedMinutes: 10,
    },
    {
      id: 'seed-learn-07',
      pillar: 3,
      orderIndex: 1,
      title: 'Why save at all?',
      subtitle: 'Emergencies cost less when you\'re ready',
      bodyMarkdown: `Saving is not about having a lot of money; it is about giving yourself room to breathe when life goes wrong. An emergency fund turns a broken geyser, a car repair or a sudden loss of income from a crisis into an inconvenience. Without savings, the same event can push you straight into expensive short-term credit or force you to skip essential bills. In this module you will set a realistic first target, usually one month of essential expenses, and choose a safe place to keep the money separate from your day-to-day account. The most important habit is to start small and start now. Small, regular deposits beat occasional big ones because they become automatic, and automatic savings are the ones that actually grow. You do not need to fully fund your emergency savings today; you only need to start, and then keep going one deposit at a time. Having even a small cushion changes how you feel about the future and the choices you make under pressure.`,

      videoUrl: null,
      videoStatus: 'not_produced',
      pointsAwarded: 50,
      estimatedMinutes: 6,
    },
    {
      id: 'seed-learn-08',
      pillar: 3,
      orderIndex: 2,
      title: 'The 30-day rule',
      subtitle: 'Beat impulse buying with one habit',
      bodyMarkdown: `Impulse buys feel urgent in the moment but often look unnecessary a month later. The 30-day rule is simple: when you want something that is not essential, write it down and wait 30 days before you buy it. If you still want the item and it still fits your budget, go ahead. Most of the time the urge will pass and you will keep the money for something more important. This habit protects your budget without making life feel restricted, because you are not saying no forever; you are just saying not now. It also trains you to separate real needs from marketing excitement. In this module you will practice the rule with one real purchase you have been considering, and you will learn how to keep a simple wish list. You may be surprised how many items lose their appeal once the advertising has faded from your mind. The wish list becomes a filter, not a prison, and it leaves more money for the purchases that still matter after the wait.`,

      videoUrl: null,
      videoStatus: 'not_produced',
      pointsAwarded: 50,
      estimatedMinutes: 5,
    },
    {
      id: 'seed-learn-09',
      pillar: 3,
      orderIndex: 3,
      title: 'Saving on an irregular income',
      subtitle: 'Strategies when pay is unpredictable',
      bodyMarkdown: `When your income changes from week to week, budgeting feels harder because you cannot predict the exact amount coming in. The solution is to budget from your lowest likely month, not from your best month. During good months, deliberately build a buffer that covers the slower ones. Pay your essential bills first, keep a separate emergency fund, and treat savings as a non-negotiable expense rather than something leftover at the end. In this module you will learn how to smooth out an irregular cash flow so that your plans survive the quiet months without panic. This approach means you stop chasing the highest earnings and start planning around the lowest ones, which removes much of the anxiety. The goal is to turn unpredictable income into predictable financial habits, so that one quiet week does not derail your entire month. With a buffer in place, you can accept variable work without feeling like your finances are always one step away from crisis.`,

      videoUrl: null,
      videoStatus: 'not_produced',
      pointsAwarded: 75,
      estimatedMinutes: 9,
    },
    {
      id: 'seed-learn-10',
      pillar: 4,
      orderIndex: 1,
      title: 'Gambling: the real odds',
      subtitle: 'What the numbers actually say',
      bodyMarkdown: `Gambling products are designed so that, over time, the operator keeps more money than they pay out to players. This is not a secret; it is simply how the business model works. The odds are stacked against the player in the long run, and no system, lucky charm, hot streak or superstition changes the underlying mathematics. In this module you will look at how house edge, random outcomes and near-misses keep people playing longer than they planned. You will also see why a small win early on can create a false sense of skill, and why the next bet is never "due" to pay out. Understanding the real odds does not mean you can never enjoy a bet; it means you can make informed choices about how much time and money you are willing to spend. If gambling is no longer fun or is affecting your money, relationships or mood, free help is available from the National Responsible Gambling Programme on 0800 006 008 or by WhatsApp or SMS to 076 675 0710. You can also visit responsiblegambling.org.za.`,
      videoUrl: null,
      videoStatus: 'not_produced',
      pointsAwarded: 75,
      estimatedMinutes: 8,
    },
    {
      id: 'seed-learn-11',
      pillar: 4,
      orderIndex: 2,
      title: 'Chasing losses',
      subtitle: 'Recognising the pattern before it grows',
      bodyMarkdown: `Chasing losses means trying to win back money you have already lost by betting more, betting longer or increasing the stakes. It is one of the most common ways a gambling session turns from entertainment into harm. The money you lost is already gone, and the next bet is independent of the last one; the odds do not owe you a win. In this module you will learn to spot the warning signs early, including borrowing to gamble, hiding losses from people close to you, feeling irritable when you are not betting and spending more time or money than you planned. You will also see why chasing often feels logical in the moment but almost always leaves you further behind. If you recognise these patterns, speak to someone you trust rather than waiting until the situation feels unbearable. The National Responsible Gambling Programme offers confidential support on 0800 006 008 or by WhatsApp and SMS to 076 675 0710.`,

      videoUrl: null,
      videoStatus: 'not_produced',
      pointsAwarded: 75,
      estimatedMinutes: 8,
    },
    {
      id: 'seed-learn-12',
      pillar: 4,
      orderIndex: 3,
      title: 'Betting within a budget',
      subtitle: 'Hard limits and cooling-off tools',
      bodyMarkdown: `If you choose to gamble, the safest way to do it is to treat it as an entertainment expense with a hard limit, the same way you would allocate money for a movie or a meal out. Decide the amount before you start, leave cards at home if needed, and stop the moment the limit is reached. Cooling-off tools, such as self-exclusion, session timers and spending limits, can help you stick to the plan when willpower alone is not enough. In this module you will set a personal betting limit and a cooling-off rule that works for your own life. You will also learn why using cash or a separate wallet can make the limit feel real, and why a short walk or a set alarm can break the momentum of a long session. If gambling ever feels hard to control, reach out to the National Responsible Gambling Programme on 0800 006 008 or by WhatsApp or SMS to 076 675 0710. You can also visit responsiblegambling.org.za.`,
      videoUrl: null,
      videoStatus: 'not_produced',
      pointsAwarded: 100,
      estimatedMinutes: 10,
    },
  ];

  for (const m of learnModules) {
    await prisma.learnModuleDef.upsert({
      where: { id: m.id },
      update: {
        bodyMarkdown: m.bodyMarkdown,
        videoUrl: m.videoUrl,
        videoStatus: m.videoStatus,
      },
      create: m,
    });
  }

  const rewardOffers = [
    { id: 'seed-offer-1', title: 'R50 Airtime Voucher', partner: 'momentum_multiply', pointsCost: 500, category: 'cash' },
    { id: 'seed-offer-2', title: 'R100 Checkers Voucher', partner: 'momentum_multiply', pointsCost: 1000, category: 'cash' },
    { id: 'seed-offer-3', title: 'Clicks Wellness Voucher', partner: 'discovery_vitality', pointsCost: 750, category: 'wellness' },
    { id: 'seed-offer-4', title: 'Gym Day Pass', partner: 'discovery_vitality', pointsCost: 600, category: 'wellness' },
    { id: 'seed-offer-5', title: 'Funeral Cover Premium Discount', partner: 'momentum_multiply', pointsCost: 1200, category: 'insurance' },
    { id: 'seed-offer-6', title: 'Pharmacy Basket Discount', partner: 'discovery_vitality', pointsCost: 900, category: 'medical' },
  ];

  for (const offer of rewardOffers) {
    await prisma.rewardOffer.upsert({
      where: { id: offer.id },
      update: {},
      create: offer,
    });
  }

  const riskProducts = [
    { id: 'seed-rp-conservative-1', category: 'conservative', name: 'Praeto Stable Income Fund', description: 'A portfolio weighted toward capital stability with modest growth exposure.' },
    { id: 'seed-rp-conservative-2', category: 'conservative', name: 'Money Market Plus', description: 'A short-term, low-volatility option focused on preserving capital.' },
    { id: 'seed-rp-moderately_conservative-1', category: 'moderately_conservative', name: 'Balanced Defensive Portfolio', description: 'A cautious mix of income and growth assets with limited equity exposure.' },
    { id: 'seed-rp-moderately_conservative-2', category: 'moderately_conservative', name: 'Capital Preserver', description: 'Designed to limit drawdowns while seeking inflation-aware returns.' },
    { id: 'seed-rp-moderate-1', category: 'moderate', name: 'Praeto Balanced Fund', description: 'A medium-risk blend of local and global equities, bonds and cash.' },
    { id: 'seed-rp-moderate-2', category: 'moderate', name: 'Diversified Growth 60/40', description: 'A balanced allocation targeting steady growth over the medium term.' },
    { id: 'seed-rp-moderately_aggressive-1', category: 'moderately_aggressive', name: 'Growth Equity Portfolio', description: 'A growth-oriented portfolio with higher equity and offshore exposure.' },
    { id: 'seed-rp-moderately_aggressive-2', category: 'moderately_aggressive', name: 'SA + Offshore Flexible', description: 'A flexible allocation that can tilt between local and global growth assets.' },
    { id: 'seed-rp-aggressive-1', category: 'aggressive', name: 'High Growth Equity Fund', description: 'A high-equity portfolio seeking long-term capital appreciation.' },
    { id: 'seed-rp-aggressive-2', category: 'aggressive', name: 'Offshore Momentum Portfolio', description: 'A globally focused strategy with concentrated growth exposure.' },
  ];

  for (const product of riskProducts) {
    await prisma.riskProduct.upsert({
      where: { id: product.id },
      update: {},
      create: product,
    });
  }

  // Reset mocked partner-bank state for the demo user.
  await prisma.savingsAccountModel.deleteMany({ where: { userId: 'seed-user-demo' } });

  await prisma.savingsAccountModel.create({
    data: {
      id: 'seed-savings-demo',
      userId: 'seed-user-demo',
      provider: 'partner_bank',
      balanceCents: 245000,
      interestRateAnnual: 5.5,
      withdrawalsAllowedPerYear: 4,
      goals: {
        create: {
          id: 'seed-goal-emergency',
          name: 'Emergency fund',
          targetCents: 1000000,
          currentCents: 245000,
        },
      },
    },
  });

  // Reset and regenerate coaching slots for the next 14 weekdays.
  await prisma.coachingSlot.deleteMany({});
  const slotInserts = generateCoachingSlots();
  for (const slot of slotInserts) {
    await prisma.coachingSlot.create({ data: slot });
  }

  await backfillPreviousMonthScoreSnapshot();

  console.log('Seeded demo user, budget category limits, gambling settings, learn modules, transactions, reward offers, coaching slots, and score snapshots.');
}

async function backfillPreviousMonthScoreSnapshot() {
  const now = new Date();
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const prevLabel = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`;
  const start = new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth(), 1));
  const end = new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth() + 1, 1));

  const userId = 'seed-user-demo';

  const [user, transactions, limits, completions, gamblingSettings] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { monthlyIncomeCents: true } }),
    prisma.transaction.findMany({ where: { userId, occurredAt: { gte: start, lt: end } } }),
    prisma.budgetCategoryLimit.findMany({ where: { userId } }),
    prisma.learnCompletion.count({ where: { userId } }),
    prisma.gamblingSettings.findUnique({ where: { userId } }),
  ]);

  if (!user) return;

  const limitMap = new Map(limits.map((l) => [l.category, l.limitCents]));
  const totalSpentCents = transactions.reduce((sum, t) => sum + t.amountCents, 0);

  const categoriesOverLimit = BUDGET_CATEGORIES.reduce((count, cfg) => {
    const spent = transactions
      .filter((t) => t.category === cfg.category)
      .reduce((sum, t) => sum + t.amountCents, 0);
    const limit = limitMap.get(cfg.category) ?? cfg.defaultLimitCents;
    return spent > limit ? count + 1 : count;
  }, 0);

  const gamblingSpentCents = transactions
    .filter((t) => t.category === 'gambling')
    .reduce((sum, t) => sum + t.amountCents, 0);
  const gamblingLimitCents = gamblingSettings?.monthlyLimitCents ?? 50000;

  const result = computeScore({
    incomeCents: user.monthlyIncomeCents,
    totalSpentCents,
    categoriesOverLimit,
    gamblingSpentCents,
    gamblingLimitCents,
    completedLearnModules: completions,
  });

  await prisma.scoreSnapshot.upsert({
    where: { userId_month: { userId, month: prevLabel } },
    update: {
      score: result.score,
      dimensions: result.dimensions as unknown as Prisma.InputJsonValue,
      computedAt: new Date(),
    },
    create: {
      userId,
      month: prevLabel,
      score: result.score,
      dimensions: result.dimensions as unknown as Prisma.InputJsonValue,
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
