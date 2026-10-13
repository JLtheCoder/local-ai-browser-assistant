import type { ModeId } from './ai/types';
import { DEFAULT_OPTIONS, type ModeOptions } from './sidepanel/lib/modeOptions';

/** `chrome.storage.local` key holding the persisted user settings. */
export const SETTINGS_KEY = 'assistant_settings_v1';

/** Modes offered by the page selection toolbar (a subset of the chat modes). */
export type SelectionActionId = 'summarize' | 'translate' | 'proofread' | 'rewrite' | 'prompt';

/** Expanded action IDs that include the split Prompt actions. */
export type ExpandedActionId = SelectionActionId | 'prompt-new' | 'prompt-existing';

export interface SelectionActionSpec {
  id: SelectionActionId;
  label: string;
  hint: string;
}

/** Toolbar order: Summarize, Translate, Proofread, Rewrite, Prompt. */
export const SELECTION_ACTIONS: SelectionActionSpec[] = [
  { id: 'summarize', label: 'Summarize', hint: 'Condense the selection to key points.' },
  {
    id: 'translate',
    label: 'Translate',
    hint: 'Translate the selection into the target language.',
  },
  { id: 'proofread', label: 'Proofread', hint: 'Fix spelling and grammar in the selection.' },
  {
    id: 'rewrite',
    label: 'Rewrite',
    hint: 'Rewrite the selection with a different tone or length.',
  },
  {
    id: 'prompt',
    label: 'Prompt',
    hint: 'Send the selection as a prompt (chat).',
  },
];

export interface AppSettings {
  /** Which quick actions appear in the page selection toolbar. */
  actions: Record<SelectionActionId, boolean>;
  /** Default mode options used by page actions (and to seed the composer). */
  options: ModeOptions;
  /** Web search suggestion setting. */
  search: { enabled: 'off' | 'suggest' };
}

export const DEFAULT_SETTINGS: AppSettings = {
  actions: { summarize: true, translate: true, proofread: true, rewrite: true, prompt: true },
  options: DEFAULT_OPTIONS,
  search: { enabled: 'suggest' },
};

const MODE_IDS: ModeId[] = ['prompt', 'translate', 'summarize', 'write', 'rewrite', 'proofread'];

export function isModeId(value: unknown): value is ModeId {
  return typeof value === 'string' && (MODE_IDS as string[]).includes(value);
}

export function isSelectionActionId(value: unknown): value is SelectionActionId {
  return typeof value === 'string' && SELECTION_ACTIONS.some((a) => a.id === value);
}

export function isPromptActionId(value: unknown): value is 'prompt-new' | 'prompt-existing' {
  return value === 'prompt-new' || value === 'prompt-existing';
}

/** Merge stored (untrusted) settings with the defaults; unknown keys are dropped. */
export function normalizeSettings(value: unknown): AppSettings {
  const raw = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const rawActions =
    typeof raw.actions === 'object' && raw.actions !== null
      ? (raw.actions as Record<string, unknown>)
      : {};
  const rawOptions =
    typeof raw.options === 'object' && raw.options !== null
      ? (raw.options as Record<string, unknown>)
      : {};
  const rawSearch =
    typeof raw.search === 'object' && raw.search !== null
      ? (raw.search as Record<string, unknown>)
      : {};

  const actions = { ...DEFAULT_SETTINGS.actions };
  for (const action of SELECTION_ACTIONS) {
    const enabled = rawActions[action.id];
    if (typeof enabled === 'boolean') actions[action.id] = enabled;
  }

  const options: ModeOptions = { ...DEFAULT_OPTIONS };
  for (const key of Object.keys(DEFAULT_OPTIONS) as (keyof ModeOptions)[]) {
    const stored = rawOptions[key];
    if (typeof stored === 'string') options[key] = stored;
  }

  const searchEnabled = rawSearch.enabled;
  const search = {
    enabled: (searchEnabled === 'off' || searchEnabled === 'suggest'
      ? searchEnabled
      : 'suggest') as 'off' | 'suggest',
  };

  return { actions, options, search };
}
