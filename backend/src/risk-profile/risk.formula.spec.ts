import { scoreRiskProfile } from './risk.formula';

describe('scoreRiskProfile', () => {
  it('vector A — conservative', () => {
    const result = scoreRiskProfile({
      time_horizon: 'lt5',
      market_reaction: 'sell_immediately',
      risk_association: 'danger',
      underperformance_reaction: 'very_upset',
    });

    expect(result.riskCapacityScore).toBe(25);
    expect(result.riskAttitudeScore).toBe(25);
    expect(result.totalScore).toBe(25);
    expect(result.category).toBe('conservative');
  });

  it('vector B — aggressive', () => {
    const result = scoreRiskProfile({
      time_horizon: 'gt15',
      market_reaction: 'stay_the_course',
      risk_association: 'thrill',
      underperformance_reaction: 'not_concerned',
    });

    expect(result.riskCapacityScore).toBe(100);
    expect(result.riskAttitudeScore).toBe(100);
    expect(result.totalScore).toBe(100);
    expect(result.category).toBe('aggressive');
  });

  it('vector C — moderately aggressive', () => {
    const result = scoreRiskProfile({
      time_horizon: '5to10',
      market_reaction: 'wait_a_year',
      risk_association: 'opportunity',
      underperformance_reaction: 'uneasy_but_ok',
    });

    expect(result.riskCapacityScore).toBe(50);
    expect(result.riskAttitudeScore).toBe(75);
    expect(result.totalScore).toBe(65);
    expect(result.category).toBe('moderately_aggressive');
  });
});
