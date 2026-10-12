export type CapabilityStatus = 'available' | 'downloading' | 'unavailable';

export type ModeId = 'prompt' | 'translate' | 'summarize' | 'write' | 'rewrite' | 'proofread';

export interface Capabilities {
  prompt: CapabilityStatus;
  translate: CapabilityStatus;
  summarize: CapabilityStatus;
  write: CapabilityStatus;
  rewrite: CapabilityStatus;
  proofread: CapabilityStatus;
}

export interface StreamOptions {
  signal?: AbortSignal;
  onStream?: (chunk: string) => void;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface PromptRequest extends StreamOptions {
  prompt: string;
  /** Prior conversation turns, fed to the model as context for multi-turn chats. */
  history?: ConversationTurn[];
}

export interface TranslateRequest extends StreamOptions {
  text: string;
  sourceLanguage?: string;
  targetLanguage: string;
}

export interface SummarizeRequest extends StreamOptions {
  text: string;
  type?: string;
  format?: string;
  length?: string;
  sharedContext?: string;
}

export interface WriteRequest extends StreamOptions {
  prompt: string;
  tone?: string;
  format?: string;
  length?: string;
  sharedContext?: string;
}

export interface RewriteRequest extends StreamOptions {
  text: string;
  tone?: string;
  length?: string;
}

export interface ProofreadRequest extends StreamOptions {
  text: string;
}

export interface AIProvider {
  readonly id: string;
  readonly label: string;
  capabilities(): Promise<Capabilities>;
  prompt(request: PromptRequest): Promise<string>;
  translate(request: TranslateRequest): Promise<string>;
  summarize(request: SummarizeRequest): Promise<string>;
  write(request: WriteRequest): Promise<string>;
  rewrite(request: RewriteRequest): Promise<string>;
  proofread(request: ProofreadRequest): Promise<string>;
}
