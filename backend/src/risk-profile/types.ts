export interface RiskProfileResultResponse {
  id: string;
  riskCapacityScore: number;
  riskAttitudeScore: number;
  totalScore: number;
  category:
    | 'conservative'
    | 'moderately_conservative'
    | 'moderate'
    | 'moderately_aggressive'
    | 'aggressive';
  recommendedProducts: Array<{ id: string; name: string; description: string }>;
  completedAt: string;
  disclaimer: string;
}
