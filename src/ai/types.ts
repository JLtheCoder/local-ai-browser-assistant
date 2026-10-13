export type CapabilityStatus = 'available' | 'downloadable' | 'downloading' | 'unavailable';

export type ModeId = 'prompt' | 'translate' | 'summarize' | 'write' | 'rewrite' | 'proofread';

export interface Capabilities {
  prompt: CapabilityStatus;
  translate: CapabilityStatus;
  summarize: CapabilityStatus;
  write: CapabilityStatus;
  rewrite: CapabilityStatus;
  proofread: CapabilityStatus;
}

export type CapabilityId = keyof Capabilities;

export interface DownloadRequest {
  capability: CapabilityId;
  /** Required for `translate`: its model is per language pair. */
  targetLanguage?: string;
  /** Fraction of the download completed, 0–1 (not every API reports progress). */
  onProgress?: (progress: number) => void;
}

export interface StreamOptions {
  signal?: AbortSignal;
  onStream?: (chunk: string) => void;
}

export type TurnRole = 'user' | 'assistant' | 'system';

export const TurnRole = {
  user: 'user' as TurnRole,
  assistant: 'assistant' as TurnRole,
  system: 'system' as TurnRole,
} as const;

export interface ConversationTurn {
  role: TurnRole;
  content: string;
}

export interface PromptRequest extends StreamOptions {
  prompt: string;
  /** Prior conversation turns, fed to the model as context for multi-turn chats. */
  history?: ConversationTurn[];
  /** Optional page-level context (e.g., current page text), inserted as a leading system turn. */
  context?: string;
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
  /** Fetches the model behind a capability (a no-op when it is already ready). */
  download(request: DownloadRequest): Promise<void>;
  prompt(request: PromptRequest): Promise<string>;
  translate(request: TranslateRequest): Promise<string>;
  summarize(request: SummarizeRequest): Promise<string>;
  write(request: WriteRequest): Promise<string>;
  rewrite(request: RewriteRequest): Promise<string>;
  proofread(request: ProofreadRequest): Promise<string>;
}
