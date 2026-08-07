export type RiskProfileAnswers = Record<string, string>;

export interface RiskProfileScore {
  riskCapacityScore: number;
  riskAttitudeScore: number;
  totalScore: number;
  category:
    | 'conservative'
    | 'moderately_conservative'
    | 'moderate'
    | 'moderately_aggressive'
    | 'aggressive';
}

const TIME_HORIZON_OPTIONS = ['lt5', '5to10', '11to15', 'gt15'] as const;
const MARKET_REACTION_OPTIONS = ['sell_immediately', 'sell_on_5pct', 'wait_a_year', 'stay_the_course'] as const;
const RISK_ASSOCIATION_OPTIONS = ['danger', 'uncertainty', 'opportunity', 'thrill'] as const;
const UNDERPERFORMANCE_OPTIONS = ['very_upset', 'somewhat_upset', 'uneasy_but_ok', 'not_concerned'] as const;

function optionIndex<T extends readonly string[]>(options: T, value: string): number {
  const idx = options.indexOf(value as T[number]);
  if (idx === -1) {
    throw new Error(`Invalid option value '${value}'.`);
  }
  return idx + 1; // 1-based points
}

export function scoreRiskProfile(answers: RiskProfileAnswers): RiskProfileScore {
  const timeHorizonPoints = optionIndex(TIME_HORIZON_OPTIONS, answers.time_horizon);
  const marketReactionPoints = optionIndex(MARKET_REACTION_OPTIONS, answers.market_reaction);
  const riskAssociationPoints = optionIndex(RISK_ASSOCIATION_OPTIONS, answers.risk_association);
  const underperformancePoints = optionIndex(UNDERPERFORMANCE_OPTIONS, answers.underperformance_reaction);

  const riskCapacityScore = timeHorizonPoints * 25;
  const riskAttitudeScore = Math.round(
    ((marketReactionPoints + riskAssociationPoints + underperformancePoints) / 12) * 100,
  );
  const totalScore = Math.round(0.4 * riskCapacityScore + 0.6 * riskAttitudeScore);

  let category: RiskProfileScore['category'];
  if (totalScore <= 34) {
    category = 'conservative';
  } else if (totalScore <= 49) {
    category = 'moderately_conservative';
  } else if (totalScore <= 64) {
    category = 'moderate';
  } else if (totalScore <= 79) {
    category = 'moderately_aggressive';
  } else {
    category = 'aggressive';
  }

  return { riskCapacityScore, riskAttitudeScore, totalScore, category };
}
