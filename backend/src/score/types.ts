export interface BalanceScoreResponse {
  score: number;
  changeFromLastMonth: number;
  dimensions: {
    financialKnowledge: number;
    moneyManagement: number;
    savingBehaviour: number;
    spendingControl: number;
    debtResilience: number;
  };
  computedAt: string;
}

export interface ScoreHistoryResponse {
  months: Array<{ month: string; score: number }>;
}
