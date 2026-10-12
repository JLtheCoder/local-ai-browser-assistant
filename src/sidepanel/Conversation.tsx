import { useEffect, useRef } from 'react';
import type { Thread } from './threads';
import { Message } from './Message';

export function Conversation({ thread }: { thread: Thread | null }) {
  const endRef = useRef<HTMLDivElement>(null);
  const last = thread?.messages[thread.messages.length - 1];
  const lastContentLength = last?.content.length ?? 0;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [thread?.messages.length, lastContentLength]);

  if (!thread || thread.messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-zinc-500">
        Start a conversation below.
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-3 overflow-y-auto p-3">
      {thread.messages.map((m) => (
        <Message key={m.id} message={m} />
      ))}
      <div ref={endRef} />
    </div>
  );
}
