'use client';

import { type ReactNode, useId } from 'react';

// Small accessible form pieces for the onboarding wizard: every input has a visible label, and
// errors are announced and linked to their input.

const inputClass =
  'mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-base aria-invalid:border-bad';

export function TextField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: ReactNode;
  type?: 'text' | 'tel';
  inputMode?: 'text' | 'tel' | 'numeric';
  autoComplete?: string;
  placeholder?: string;
  optional?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {props.label}
        {props.optional ? <span className="font-normal text-text-muted"> (optional)</span> : null}
      </label>
      {props.hint ? (
        <p id={`${id}-hint`} className="text-sm text-text-muted">
          {props.hint}
        </p>
      ) : null}
      <input
        id={id}
        type={props.type ?? 'text'}
        inputMode={props.inputMode}
        autoComplete={props.autoComplete}
        placeholder={props.placeholder}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={
          [props.hint ? `${id}-hint` : '', props.error ? `${id}-error` : '']
            .filter(Boolean)
            .join(' ') || undefined
        }
        className={inputClass}
      />
      <FieldError id={`${id}-error`} error={props.error} />
    </div>
  );
}

export function SelectField<T extends string>(props: {
  label: string;
  value: T | '';
  options: [T, string][];
  onChange: (value: T) => void;
  error?: string;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {props.label}
      </label>
      <select
        id={id}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value as T)}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={props.error ? `${id}-error` : undefined}
        className={inputClass}
      >
        {props.value === '' ? <option value="">{props.placeholder ?? 'Choose…'}</option> : null}
        {props.options.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <FieldError id={`${id}-error`} error={props.error} />
    </div>
  );
}

/** Large radio buttons with a title and a description, for the main choices. */
export function ChoiceCards<T extends string>(props: {
  legend: string;
  name: string;
  value: T | undefined;
  options: { value: T; title: string; description: string }[];
  onChange: (value: T) => void;
  error?: string;
}) {
  const id = useId();
  return (
    <fieldset aria-describedby={props.error ? `${id}-error` : undefined}>
      <legend className="text-sm font-medium">{props.legend}</legend>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {props.options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer gap-3 rounded-lg border border-border bg-surface p-4 has-[:checked]:border-brand has-[:checked]:ring-2 has-[:checked]:ring-brand/30"
          >
            <input
              type="radio"
              name={props.name}
              value={option.value}
              checked={props.value === option.value}
              onChange={() => props.onChange(option.value)}
              className="mt-1 accent-[var(--brand)]"
            />
            <span>
              <span className="block font-semibold">{option.title}</span>
              <span className="block text-sm text-text-muted">{option.description}</span>
            </span>
          </label>
        ))}
      </div>
      <FieldError id={`${id}-error`} error={props.error} />
    </fieldset>
  );
}

function FieldError({ id, error }: { id: string; error?: string }) {
  return error ? (
    <p id={id} role="alert" className="mt-1 text-sm text-bad">
      {error}
    </p>
  ) : null;
}
