import { computeScore } from './score.formula';

describe('computeScore', () => {
  it('vector A: moderate spending, no over-limit, no gambling over, no learn', () => {
    const result = computeScore({
      incomeCents: 1850000,
      totalSpentCents: 925000,
      categoriesOverLimit: 0,
      gamblingSpentCents: 0,
      gamblingLimitCents: 50000,
      completedLearnModules: 0,
    });

    expect(result.score).toBe(75);
    expect(result.dimensions).toEqual({
      moneyManagement: 100,
      spendingControl: 100,
      savingBehaviour: 100,
      financialKnowledge: 0,
      debtResilience: 50,
    });
  });

  it('vector B: high spending, 3 over-limit categories, gambling over, 6 learn modules', () => {
    const result = computeScore({
      incomeCents: 1850000,
      totalSpentCents: 2035000,
      categoriesOverLimit: 3,
      gamblingSpentCents: 60000,
      gamblingLimitCents: 50000,
      completedLearnModules: 6,
    });

    expect(result.score).toBe(37);
    expect(result.dimensions).toEqual({
      moneyManagement: 40,
      spendingControl: 30,
      savingBehaviour: 0,
      financialKnowledge: 72,
      debtResilience: 50,
    });
  });

  it('vector C: zero income, zero spend, no over-limit, no gambling over, all 12 modules', () => {
    const result = computeScore({
      incomeCents: 0,
      totalSpentCents: 0,
      categoriesOverLimit: 0,
      gamblingSpentCents: 0,
      gamblingLimitCents: 50000,
      completedLearnModules: 12,
    });

    expect(result.score).toBe(63);
    expect(result.dimensions).toEqual({
      moneyManagement: 50,
      spendingControl: 100,
      savingBehaviour: 0,
      financialKnowledge: 100,
      debtResilience: 50,
    });
  });
});
