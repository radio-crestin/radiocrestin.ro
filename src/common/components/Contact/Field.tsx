import React, { type ReactNode } from "react";
import { CONTACT_COPY } from "./copy";
import { fill, type FieldCopy } from "./copyText";
import type { FieldDef } from "./schema";
import styles from "./styles.module.scss";

export interface StationOption {
  slug: string;
  title: string;
}

interface FieldProps {
  field: FieldDef;
  copy: FieldCopy;
  value: string;
  error?: string;
  required: boolean;
  stations: StationOption[];
  onChange: (value: string) => void;
}

export const inputId = (name: string) => `contact-${name}`;

const today = () => new Date().toISOString().slice(0, 10);

/** Label, hint and error around one control; ids tie them together for screen readers. */
export function FieldShell({
  field,
  copy,
  error,
  required,
  counter,
  children,
}: {
  field: FieldDef;
  copy: FieldCopy;
  error?: string;
  required: boolean;
  counter?: string;
  children: ReactNode;
}) {
  const isGroup = field.type === "choice";
  const Wrapper = isGroup ? "fieldset" : "div";
  const Label = isGroup ? "legend" : "label";
  const id = inputId(field.name);
  return (
    <Wrapper className={styles.field} data-invalid={error ? "" : undefined}>
      {copy.label && (
        <Label className={styles.label} {...(isGroup ? {} : { htmlFor: id })}>
          {copy.label}
          {!required && <span className={styles.optional}> {CONTACT_COPY.common.optional}</span>}
        </Label>
      )}
      {copy.hint && (
        <p className={styles.hint} id={`${id}-hint`}>
          {copy.hint}
        </p>
      )}
      {children}
      <div className={styles.below}>
        {error ? (
          <p className={styles.error} id={`${id}-error`} role="alert">
            {error}
          </p>
        ) : (
          <span />
        )}
        {counter && <span className={styles.counter}>{counter}</span>}
      </div>
    </Wrapper>
  );
}

function describedBy(name: string, copy: FieldCopy, error?: string) {
  const id = inputId(name);
  return [copy.hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
}

const INPUT_TYPES: Partial<Record<FieldDef["type"], string>> = {
  text: "text",
  email: "email",
  url: "url",
  tel: "tel",
  date: "date",
};

const AUTOCOMPLETE: Record<string, string> = { name: "name", email: "email", phone: "tel" };

function Control({ field, copy, value, error, required, stations, onChange }: FieldProps) {
  const common = {
    id: inputId(field.name),
    name: field.name,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy(field.name, copy, error),
    "aria-required": required || undefined,
  };

  switch (field.type) {
    case "textarea":
      return (
        <textarea
          {...common}
          className={styles.input}
          rows={field.rows ?? 4}
          maxLength={field.maxLength}
          placeholder={copy.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "choice":
      return (
        <div className={styles.choices} role="radiogroup" aria-describedby={common["aria-describedby"]}>
          {field.options!.map((option, index) => (
            <label key={option} className={styles.choice}>
              <input
                type="radio"
                name={field.name}
                id={index === 0 ? common.id : undefined}
                value={option}
                checked={value === option}
                onChange={() => onChange(option)}
              />
              <span className={styles.choice_text}>
                {copy.options?.[option] ?? option}
                {copy.optionHints?.[option] && <small>{copy.optionHints[option]}</small>}
              </span>
            </label>
          ))}
        </div>
      );
    case "select":
    case "station": {
      const options =
        field.type === "station"
          ? stations.map((s) => ({ value: s.slug, label: s.title }))
          : field.options!.map((o) => ({ value: o, label: copy.options?.[o] ?? o }));
      return (
        <select {...common} className={styles.input} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{copy.placeholder ?? CONTACT_COPY.common.chooseOption}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }
    case "checkbox":
      return (
        <label className={styles.checkbox}>
          <input
            {...common}
            type="checkbox"
            checked={value === "true"}
            onChange={(e) => onChange(e.target.checked ? "true" : "")}
          />
          <span>{copy.label}</span>
        </label>
      );
    default:
      return (
        <input
          {...common}
          className={styles.input}
          type={INPUT_TYPES[field.type] ?? "text"}
          inputMode={field.type === "url" ? "url" : undefined}
          autoComplete={AUTOCOMPLETE[field.name] ?? "off"}
          maxLength={field.maxLength}
          placeholder={copy.placeholder}
          min={field.type === "date" ? today() : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

export default function Field(props: FieldProps) {
  const { field, copy, value, error, required } = props;
  const counter =
    field.counter && field.maxLength
      ? fill(CONTACT_COPY.common.charCount, { count: value.length, max: field.maxLength })
      : undefined;
  // The checkbox carries its own label next to the box.
  const shellCopy = field.type === "checkbox" ? { label: "" } : copy;
  return (
    <FieldShell field={field} copy={shellCopy} error={error} required={required || field.type === "checkbox"} counter={counter}>
      <Control {...props} />
    </FieldShell>
  );
}
