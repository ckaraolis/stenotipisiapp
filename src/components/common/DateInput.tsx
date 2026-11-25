import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
} from 'react';
import { formatDateInputValue, parseDateInputValue } from '../../utils/dateFormat';

type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'defaultValue'> & {
  value?: string;
};

/**
 * Drop-in replacement for `<input type="date" />`.
 * Shows and accepts DD/MM/YYYY while keeping onChange values as ISO YYYY-MM-DD.
 */
export default function DateInput({
  value = '',
  onChange,
  onBlur,
  className,
  id,
  disabled,
  readOnly,
  ...rest
}: DateInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const pickerRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => formatDateInputValue(value));

  useEffect(() => {
    setText(formatDateInputValue(value));
  }, [value]);

  const emitIso = (iso: string, original?: ChangeEvent<HTMLInputElement>) => {
    if (!onChange) return;
    const target = Object.assign(document.createElement('input'), { value: iso });
    onChange({
      ...(original ?? ({} as ChangeEvent<HTMLInputElement>)),
      target,
      currentTarget: target,
    } as ChangeEvent<HTMLInputElement>);
  };

  const commitText = (raw: string, original?: ChangeEvent<HTMLInputElement>) => {
    const parsed = parseDateInputValue(raw);
    if (parsed === null) {
      setText(formatDateInputValue(value));
      return;
    }
    setText(formatDateInputValue(parsed));
    if (parsed !== value) {
      emitIso(parsed, original);
    }
  };

  const openPicker = () => {
    if (disabled || readOnly) return;
    const picker = pickerRef.current;
    if (!picker) return;
    try {
      picker.showPicker?.();
    } catch {
      picker.click();
    }
  };

  return (
    <span className="date-input">
      <input
        {...rest}
        id={inputId}
        type="text"
        inputMode="numeric"
        placeholder="DD/MM/YYYY"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        readOnly={readOnly}
        className={['date-input-text', className].filter(Boolean).join(' ')}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={(event) => {
          commitText(event.target.value, event);
          onBlur?.(event);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commitText((event.target as HTMLInputElement).value);
            (event.target as HTMLInputElement).blur();
          }
          rest.onKeyDown?.(event);
        }}
      />
      <input
        ref={pickerRef}
        type="date"
        className="date-input-native"
        tabIndex={-1}
        aria-hidden
        disabled={disabled || readOnly}
        value={value && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : ''}
        onChange={(event) => {
          const iso = event.target.value;
          setText(formatDateInputValue(iso));
          emitIso(iso, event);
        }}
      />
      <button
        type="button"
        className="date-input-picker-btn"
        tabIndex={-1}
        disabled={disabled || readOnly}
        aria-label="Choose date"
        onClick={openPicker}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
          <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </span>
  );
}
