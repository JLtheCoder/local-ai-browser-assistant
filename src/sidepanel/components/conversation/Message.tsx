import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { searchWeb } from '../../../search';
import type { ChatMessage } from '../../lib/threads';

function modeLabel(mode: string): string {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

export function Message({ message }: { message: ChatMessage }) {
  const label = (
    <div className="mb-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
      {modeLabel(message.mode)}
    </div>
  );

  if (message.role === 'user') {
    return (
      <div className="flex flex-col items-end">
        {label}
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-lg rounded-br-sm bg-indigo-600 px-3 py-2 text-sm text-white">
          {message.content === '' ? <em>Using the last result</em> : message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start">
      {label}
      <div className="min-w-0 max-w-[95%]">
        {message.content === '' ? (
          <div className="px-1 py-1 text-sm text-zinc-500">Thinking…</div>
        ) : (
          <div
            className={`prose prose-sm prose-invert max-w-none break-words rounded-lg rounded-bl-sm border border-zinc-800 bg-zinc-800/60 px-3 py-2 text-sm ${
              message.error ? 'text-red-300' : ''
            }`}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        )}
        {message.searchQuery && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void searchWeb(message.searchQuery!)}
              className="flex items-center gap-1 rounded-md bg-zinc-700 px-2 py-1 text-xs text-indigo-200 hover:bg-zinc-600 hover:text-indigo-100"
              title="Search the web for this query"
            >
              🔍 Search the web for <em>«{message.searchQuery}»</em>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
