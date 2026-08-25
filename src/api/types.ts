export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  lsmBand: string;
  subscriptionTier?: string;
}

export interface AuthLoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
}

export interface GamblingTransaction {
  id: string;
  merchant: string;
  date: string;
  category: string;
  amountCents: number;
}

export interface GamblingSpendSummary {
  month: string;
  limitCents: number;
  spentCents: number;
  isOverLimit: boolean;
  transactions: GamblingTransaction[];
  dailyAlertEnabled: boolean;
  dailyAlertThresholdCents: number | null;
}

export interface BudgetCategory {
  category: string;
  label: string;
  icon: string;
  limitCents: number;
  spentCents: number;
}

export interface BudgetSummary {
  month: string;
  incomeCents: number;
  totalSpentCents: number;
  availableCents: number;
  categories: BudgetCategory[];
}

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

export interface LearnModule {
  id: string;
  title: string;
  bodyMarkdown?: string;
  videoUrl?: string | null;
  videoStatus?: string;
  completed?: boolean;
}

export interface ApiErrorBody {
  code?: string;
  message?: string;
}
