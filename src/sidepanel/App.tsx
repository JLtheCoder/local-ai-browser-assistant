import { useEffect, useState } from 'react';
import { getDefaultProvider } from '../ai/provider';
import type { Capabilities, ModeId } from '../ai/types';
import { PromptMode } from './modes/PromptMode';
import { TranslateMode } from './modes/TranslateMode';
import { SummarizeMode } from './modes/SummarizeMode';
import { WriteMode } from './modes/WriteMode';
import { RewriteMode } from './modes/RewriteMode';
import { ProofreadMode } from './modes/ProofreadMode';

const MODES: { id: ModeId; label: string }[] = [
  { id: 'prompt', label: 'Prompt' },
  { id: 'translate', label: 'Translate' },
  { id: 'summarize', label: 'Summarize' },
  { id: 'write', label: 'Write' },
  { id: 'rewrite', label: 'Rewrite' },
  { id: 'proofread', label: 'Proofread' },
];

export default function App() {
  const provider = getDefaultProvider();
  const [active, setActive] = useState<ModeId>('prompt');
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [draftText, setDraftText] = useState('');

  useEffect(() => {
    let cancelled = false;
    provider
      .capabilities()
      .then((c) => {
        if (!cancelled) setCapabilities(c);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [provider]);

  // Pick up a pending context-menu selection and route it into the right mode.
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
    void chrome.storage.local.get(['pendingSelection', 'pendingMode']).then((v) => {
      const text = typeof v.pendingSelection === 'string' ? v.pendingSelection : '';
      const mode = typeof v.pendingMode === 'string' ? (v.pendingMode as ModeId) : 'summarize';
      if (text) {
        setActive(mode);
        setDraftText(text);
      }
      if (v.pendingSelection !== undefined) {
        void chrome.storage.local.remove(['pendingSelection', 'pendingMode']);
      }
    });
  }, []);

  // A pending context-menu draft fills only the mode it was routed to. Clear it
  // on manual tab switches so it doesn't leak into other modes.
  const selectMode = (id: ModeId) => {
    setActive(id);
    setDraftText('');
  };

  const panel = (() => {
    switch (active) {
      case 'prompt':
        return <PromptMode provider={provider} initialText={draftText} />;
      case 'translate':
        return <TranslateMode provider={provider} initialText={draftText} />;
      case 'summarize':
        return <SummarizeMode provider={provider} initialText={draftText} />;
      case 'write':
        return <WriteMode provider={provider} initialText={draftText} />;
      case 'rewrite':
        return <RewriteMode provider={provider} initialText={draftText} />;
      case 'proofread':
        return <ProofreadMode provider={provider} initialText={draftText} />;
    }
  })();

  return (
    <div className="flex h-screen flex-col bg-zinc-900 text-zinc-100">
      <header className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold">Local AI Assistant</h1>
        <p className="text-xs text-zinc-500">{provider.label}</p>
      </header>

      <CapabilityBanner capabilities={capabilities} />

      <nav className="flex flex-wrap gap-1 border-b border-zinc-800 px-2 py-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => selectMode(m.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              active === m.id
                ? 'bg-indigo-600 text-white'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
          >
            {m.label}
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-y-auto p-4">{panel}</main>
    </div>
  );
}

function CapabilityBanner({ capabilities }: { capabilities: Capabilities | null }) {
  if (!capabilities) return null;

  const downloading = Object.entries(capabilities)
    .filter(([, status]) => status === 'downloading')
    .map(([id]) => id);
  const unavailable = Object.entries(capabilities)
    .filter(([, status]) => status === 'unavailable')
    .map(([id]) => id);

  if (downloading.length > 0) {
    return (
      <div className="border-b border-amber-900/50 bg-amber-950/40 px-4 py-2 text-xs text-amber-300">
        Downloading models: {downloading.join(', ')}…
      </div>
    );
  }
  if (unavailable.length > 0) {
    return (
      <div className="border-b border-zinc-800 bg-zinc-800/50 px-4 py-2 text-xs text-zinc-400">
        Unavailable here: {unavailable.join(', ')}. Enable the matching chrome://flags or join the
        origin trial.
      </div>
    );
  }
  return null;
}
