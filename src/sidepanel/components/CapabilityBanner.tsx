import type { Capabilities } from '../../ai/types';

export function CapabilityBanner({ capabilities }: { capabilities: Capabilities | null }) {
  if (!capabilities) return null;

  const downloading = Object.entries(capabilities)
    .filter(([, status]) => status === 'downloading')
    .map(([id]) => id);
  const unavailable = Object.entries(capabilities)
    .filter(([, status]) => status === 'unavailable')
    .map(([id]) => id);

  if (downloading.length > 0) {
    return (
      <div className="border-b border-amber-900/50 bg-amber-950/40 px-3 py-1.5 text-xs text-amber-300">
        Downloading models: {downloading.join(', ')}…
      </div>
    );
  }
  if (unavailable.length > 0) {
    return (
      <div className="border-b border-zinc-800 bg-zinc-800/50 px-3 py-1.5 text-xs text-zinc-400">
        Unavailable here: {unavailable.join(', ')}. Enable the matching chrome://flags.
      </div>
    );
  }
  return null;
}
