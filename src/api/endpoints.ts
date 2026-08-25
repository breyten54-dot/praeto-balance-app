import { apiClient } from './client';
import type {
  AuthLoginResponse,
  BalanceScoreResponse,
  BudgetSummary,
  GamblingSpendSummary,
  LearnModule,
  UserProfile,
} from './types';

export const UserApi = {
  getProfile: () => apiClient.get<UserProfile>('/me').then((r) => r.data),
  updateLsmBand: (lsmBand: string) =>
    apiClient.patch<UserProfile>('/me/lsm-band', { lsmBand }).then((r) => r.data),
};

export const AuthApi = {
  login: (email: string, password: string) =>
    apiClient.post<AuthLoginResponse>('/auth/login', { email, password }).then((r) => r.data),
};

export const BalanceScoreApi = {
  getScore: () => apiClient.get<BalanceScoreResponse>('/score').then((r) => r.data),
  getScoreHistory: (months = 6) =>
    apiClient.get(`/score/history?months=${months}`).then((r) => r.data),
};

export const BudgetApi = {
  getSummary: (month?: string) =>
    apiClient.get<BudgetSummary>('/budget/summary', { params: { month } }).then((r) => r.data),
  setCategoryLimit: (category: string, limitCents: number) =>
    apiClient.put(`/budget/categories/${category}/limit`, { limitCents }).then((r) => r.data),
};

export const GamblingApi = {
  getSpendSummary: () =>
    apiClient.get<GamblingSpendSummary>('/gambling/summary').then((r) => r.data),
  setMonthlyLimit: (limitCents: number) =>
    apiClient.put('/gambling/limit', { limitCents }).then((r) => r.data),
  requestCoolingOffPeriod: (days: number) =>
    apiClient.post('/gambling/cooling-off', { days }).then((r) => r.data),
  toggleDailyAlert: (enabled: boolean, thresholdCents?: number) =>
    apiClient
      .put('/gambling/daily-alert', { enabled, thresholdCents })
      .then((r) => r.data),
};

export const LearnApi = {
  getModules: (lsmBand?: string) =>
    apiClient
      .get<LearnModule[]>('/learn/modules', { params: { lsmBand } })
      .then((r) => r.data),
  markModuleComplete: (id: string) =>
    apiClient.post(`/learn/modules/${id}/complete`).then((r) => r.data),
};

export const RiskProfileApi = {
  submitAnswers: (answers: unknown) =>
    apiClient.post('/risk-profile/submit', { answers }).then((r) => r.data),
  getLatestResult: () => apiClient.get('/risk-profile/latest').then((r) => r.data),
};

export const SavingsApi = {
  getAccount: () => apiClient.get('/savings/account').then((r) => r.data),
  createGoal: (name: string, targetCents: number, targetDate?: string) =>
    apiClient.post('/savings/goals', { name, targetCents, targetDate }).then((r) => r.data),
  requestWithdrawal: (amountCents: number, goalId?: string) =>
    apiClient.post('/savings/withdrawals', { amountCents, goalId }).then((r) => r.data),
};

export const RewardsApi = {
  getSummary: () => apiClient.get('/rewards/summary').then((r) => r.data),
  redeem: (id: string) => apiClient.post(`/rewards/redeem/${id}`).then((r) => r.data),
  linkPartner: (id: string) =>
    apiClient.post(`/rewards/partners/${id}/link`).then((r) => r.data),
};

export const CoachingApi = {
  getAvailability: () => apiClient.get('/coaching/availability').then((r) => r.data),
  createBooking: (tier: string) =>
    apiClient.post('/coaching/bookings', { tier }).then((r) => r.data),
  getBooking: (id: string) => apiClient.get(`/coaching/bookings/${id}`).then((r) => r.data),
};

export const BankLinkApi = {
  getLinkToken: () => apiClient.post('/bank-link/token').then((r) => r.data),
  exchangePublicToken: (publicToken: string, institutionId: string) =>
    apiClient.post('/bank-link/exchange', { publicToken, institutionId }).then((r) => r.data),
  getLinkedAccounts: () => apiClient.get('/bank-link/accounts').then((r) => r.data),
  unlinkAccount: (id: string) =>
    apiClient.delete(`/bank-link/accounts/${id}`).then((r) => r.data),
};
