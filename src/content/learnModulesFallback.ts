import type { LearnModule } from '../api/types';
import raw from './learnModulesFallback.json';

export const LEARN_MODULES_FALLBACK: LearnModule[] = raw.map((m) => ({
  id: m.id,
  title: m.title,
  bodyMarkdown: m.bodyMarkdown,
  videoUrl: null,
  videoStatus: 'not_produced',
}));
