import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage } from './threads';

export function Message({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-lg rounded-br-sm bg-indigo-600 px-3 py-2 text-sm text-white">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
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
      </div>
    </div>
  );
}
