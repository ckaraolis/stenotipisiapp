import { useEffect, useState } from 'react';
import '../../../styles/profile.css';

interface TimeDigitsInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hideLabel?: boolean;
}

export default function TimeDigitsInput({
  id,
  label,
  value,
  onChange,
  hideLabel = false,
}: TimeDigitsInputProps) {
  const digitsFromValue = value.replace(':', '').slice(0, 4);
  const [digits, setDigits] = useState(digitsFromValue);

  useEffect(() => {
    setDigits(digitsFromValue);
  }, [digitsFromValue]);

  const handleDigitsChange = (raw: string) => {
    const nextDigits = raw.replace(/\D/g, '').slice(0, 4);
    setDigits(nextDigits);
    if (nextDigits.length === 4) {
      onChange(`${nextDigits.slice(0, 2)}:${nextDigits.slice(2, 4)}`);
      return;
    }
    onChange('');
  };

  return (
    <div style={{ display: 'contents' }}>
      {hideLabel ? null : (
        <label className="profile-label" htmlFor={id}>
          {label}
        </label>
      )}
      <input
        id={id}
        type="text"
        className="profile-input"
        inputMode="numeric"
        maxLength={4}
        placeholder="HHMM"
        value={digits}
        onChange={(event) => handleDigitsChange(event.target.value)}
      />
    </div>
  );
}
