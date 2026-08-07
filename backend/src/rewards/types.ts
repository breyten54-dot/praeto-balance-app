export interface RewardsSummaryResponse {
  pointsBalance: number;
  lifetimePoints: number;
  linkedPartners: Array<{ partner: string; linkedAt: string }>;
  availableOffers: Array<{
    id: string;
    title: string;
    partner: string;
    pointsCost: number;
    category: 'cash' | 'wellness' | 'insurance' | 'medical';
  }>;
}

export interface RedemptionResponse {
  redemptionId: string;
  offerId: string;
  pointsSpent: number;
  newBalance: number;
}

export interface PartnerLinkResponse {
  partner: string;
  linkedAt: string;
}
