export interface SavingsGoalResponse {
  id: string;
  name: string;
  targetCents: number;
  currentCents: number;
  targetDate: string | null;
}

export interface SavingsAccountResponse {
  id: string;
  provider: 'partner_bank';
  balanceCents: number;
  interestRateAnnual: number;
  withdrawalsUsedThisYear: number;
  withdrawalsAllowedPerYear: number;
  goals: SavingsGoalResponse[];
}

export interface SavingsWithdrawalResponse {
  id: string;
  amountCents: number;
  newBalanceCents: number;
  createdAt: string;
}
