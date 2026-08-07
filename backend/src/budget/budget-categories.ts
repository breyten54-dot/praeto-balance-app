export interface CategoryConfig {
  category: string;
  label: string;
  icon: string;
  defaultLimitCents: number;
}

export const BUDGET_CATEGORIES: CategoryConfig[] = [
  { category: 'groceries', label: 'Groceries', icon: '🛒', defaultLimitCents: 450000 },
  { category: 'transport', label: 'Transport', icon: '🚕', defaultLimitCents: 180000 },
  { category: 'airtime_data', label: 'Airtime & Data', icon: '📱', defaultLimitCents: 60000 },
  { category: 'utilities', label: 'Utilities', icon: '💡', defaultLimitCents: 150000 },
  { category: 'eating_out', label: 'Eating Out', icon: '🍔', defaultLimitCents: 120000 },
  { category: 'entertainment', label: 'Entertainment', icon: '🎬', defaultLimitCents: 80000 },
  { category: 'gambling', label: 'Gambling', icon: '🎰', defaultLimitCents: 50000 },
  { category: 'other', label: 'Other', icon: '📦', defaultLimitCents: 100000 },
];

export const CATEGORY_SLUGS = BUDGET_CATEGORIES.map((c) => c.category);
