import { useCallback } from 'react';
import type { ChangeEvent } from 'react';
import type { ModeId } from '../../ai/types';
import { MODE_FIELDS, type ModeOptions } from '../lib/modeOptions';
import { Label, Select } from './ui';

/** The per-mode options row (Translate languages, Summarize type/length/format, …). */
export function ModeFields({
  mode,
  options,
  onChange,
}: {
  mode: ModeId;
  options: ModeOptions;
  onChange: (options: ModeOptions) => void;
}) {
  // The field's ModeOptions key travels in the select's `name`, so one handler
  // covers every option in every mode.
  const handleOptionChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      const key = e.currentTarget.name as keyof ModeOptions;
      onChange({ ...options, [key]: e.currentTarget.value });
    },
    [onChange, options],
  );

  const config = MODE_FIELDS[mode];
  if (!config) return null;

  const colsClass = config.cols === 3 ? 'grid-cols-3' : 'grid-cols-2';

  return (
    <div className={`grid gap-2 ${colsClass}`}>
      {config.fields.map((field) => (
        <div key={field.key}>
          <Label>{field.label}</Label>
          <Select
            name={field.key}
            value={options[field.key]}
            onChange={handleOptionChange}
            className="w-full"
          >
            {field.autoDetect && <option value="">Auto-detect</option>}
            {field.choices.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
      ))}
    </div>
  );
}
