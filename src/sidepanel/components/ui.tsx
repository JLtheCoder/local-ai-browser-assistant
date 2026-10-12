import type {
  ButtonHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

export function Label({ children }: { children: ReactNode }) {
  return <div className="mb-1 text-xs font-medium text-zinc-400">{children}</div>;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props;
  return (
    <textarea
      {...rest}
      className={`w-full rounded-lg border border-zinc-700 bg-zinc-800 p-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
        className ?? ''
      }`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, ...rest } = props;
  return (
    <select
      {...rest}
      className={`rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
        className ?? ''
      }`}
    />
  );
}

export function Button(
  props: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' },
) {
  const { className, variant = 'primary', ...rest } = props;
  const styles =
    variant === 'primary'
      ? 'bg-indigo-600 text-white hover:bg-indigo-500 disabled:bg-indigo-800 disabled:text-zinc-400'
      : 'border border-zinc-700 text-zinc-300 hover:bg-zinc-800';
  return (
    <button
      {...rest}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${styles} ${className ?? ''}`}
    />
  );
}
