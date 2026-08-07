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

export interface CoolingOffResult {
  id: string;
  startsAt: string;
  endsAt: string;
}

export interface DailyAlertResult {
  dailyAlertEnabled: boolean;
  dailyAlertThresholdCents: number | null;
}
