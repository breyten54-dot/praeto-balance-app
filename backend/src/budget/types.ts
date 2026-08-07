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
