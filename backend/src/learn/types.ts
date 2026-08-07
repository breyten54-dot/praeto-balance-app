export interface LearnModuleResponse {
  id: string;
  pillar: number;
  title: string;
  subtitle: string;
  bodyMarkdown: string;
  videoUrl: string | null;
  videoStatus: string;
  status: 'locked' | 'available' | 'completed';
  pointsAwarded: number;
  estimatedMinutes: number;
}

export interface CompleteModuleResponse {
  id: string;
  status: 'completed';
  pointsAwarded: number;
}
