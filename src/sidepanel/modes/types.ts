import type { AIProvider } from '../../ai/types';

export interface ModeProps {
  provider: AIProvider;
  initialText?: string;
}
