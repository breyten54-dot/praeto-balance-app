export interface ScoreDimensions {
  [key: string]: number;
  financialKnowledge: number;
  moneyManagement: number;
  savingBehaviour: number;
  spendingControl: number;
  debtResilience: number;
}

export interface ScoreFormulaInputs {
  incomeCents: number;
  totalSpentCents: number;
  categoriesOverLimit: number;
  gamblingSpentCents: number;
  gamblingLimitCents: number;
  completedLearnModules: number;
}

export interface ScoreFormulaResult {
  score: number;
  dimensions: ScoreDimensions;
}

function clamp(x: number): number {
  return Math.max(0, Math.min(100, Math.round(x)));
}

export function computeScore(inputs: ScoreFormulaInputs): ScoreFormulaResult {
  const {
    incomeCents,
    totalSpentCents,
    categoriesOverLimit,
    gamblingSpentCents,
    gamblingLimitCents,
    completedLearnModules,
  } = inputs;

  const spendRatio = incomeCents === 0 ? 1 : totalSpentCents / incomeCents;
  const moneyManagement = clamp(150 - 100 * spendRatio);

  const spendingControl = clamp(
    100 - 20 * categoriesOverLimit - (gamblingSpentCents > gamblingLimitCents ? 10 : 0),
  );

  const savingBehaviour = clamp(
    ((Math.max(0, incomeCents - totalSpentCents)) / (incomeCents || 1)) * 400,
  );

  const financialKnowledge = clamp(completedLearnModules * 12);

  const debtResilience = 50;

  const score = clamp(
    0.25 * moneyManagement +
      0.25 * spendingControl +
      0.2 * savingBehaviour +
      0.2 * financialKnowledge +
      0.1 * debtResilience,
  );

  return {
    score,
    dimensions: {
      financialKnowledge,
      moneyManagement,
      savingBehaviour,
      spendingControl,
      debtResilience,
    },
  };
}
