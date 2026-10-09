interface Props {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}

export function Toggle({ label, checked, disabled, onChange }: Props) {
  return (
    <label className={`row ${disabled ? 'row-disabled' : ''}`}>
      <span>{label}</span>
        <input
          className="switch"
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
    </label>
  );
}
