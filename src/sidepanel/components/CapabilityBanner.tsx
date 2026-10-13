import { useCallback } from 'react';
import type { Capabilities, CapabilityId, CapabilityStatus } from '../../ai/types';

export interface BannerDownload {
  id: CapabilityId;
  /** 0–1 fraction, or null while Chrome hasn't reported progress yet. */
  progress: number | null;
}

export interface BannerDownloadError {
  id: CapabilityId;
  message: string;
}

interface CapabilityBannerProps {
  capabilities: Capabilities | null;
  download: BannerDownload | null;
  downloadError: BannerDownloadError | null;
  onDownload: (id: CapabilityId) => void;
}

function DownloadButton({
  id,
  onDownload,
}: {
  id: CapabilityId;
  onDownload: (id: CapabilityId) => void;
}) {
  const handleClick = useCallback(() => onDownload(id), [id, onDownload]);
  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded border border-amber-700/60 px-1.5 py-0.5 font-medium text-amber-200 hover:bg-amber-900/40"
    >
      Download
    </button>
  );
}

export function CapabilityBanner({
  capabilities,
  download,
  downloadError,
  onDownload,
}: CapabilityBannerProps) {
  if (!capabilities) return null;

  const entries = Object.entries(capabilities) as [CapabilityId, CapabilityStatus][];
  const downloading = entries.filter(([, status]) => status === 'downloading').map(([id]) => id);
  // The in-flight download is listed on its own line; drop it from the pending list.
  const downloadable = entries
    .filter(([id, status]) => status === 'downloadable' && id !== download?.id)
    .map(([id]) => id);
  const unavailable = entries.filter(([, status]) => status === 'unavailable').map(([id]) => id);

  const active = download
    ? [download.id, ...downloading.filter((id) => id !== download.id)]
    : downloading;
  if (
    active.length === 0 &&
    downloadable.length === 0 &&
    unavailable.length === 0 &&
    !downloadError
  ) {
    return null;
  }

  return (
    <div className="text-xs">
      {active.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-amber-900/50 bg-amber-950/40 px-3 py-1.5 text-amber-300">
          <span>Downloading models: {active.join(', ')}…</span>
          {download && download.progress !== null ? (
            <span className="tabular-nums text-amber-400/80">
              {Math.round(download.progress * 100)}%
            </span>
          ) : null}
        </div>
      ) : null}
      {downloadable.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-amber-900/50 bg-amber-950/40 px-3 py-1.5 text-amber-300">
          <span>Not downloaded yet: {downloadable.join(', ')}</span>
          {downloadable.map((id) => (
            <DownloadButton key={id} id={id} onDownload={onDownload} />
          ))}
        </div>
      ) : null}
      {unavailable.length > 0 ? (
        <div className="border-b border-zinc-800 bg-zinc-800/50 px-3 py-1.5 text-zinc-400">
          Unavailable here: {unavailable.join(', ')}. Enable the matching chrome://flags.
        </div>
      ) : null}
      {downloadError ? (
        <div className="border-b border-red-900/50 bg-red-950/40 px-3 py-1.5 text-red-300">
          Download failed for {downloadError.id}: {downloadError.message}
        </div>
      ) : null}
    </div>
  );
}
