interface EditorToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  activeColor?: string;
  disabled?: boolean;
}

export function EditorToggle({ checked, onChange, label, description, activeColor = '#5c7e10', disabled }: EditorToggleProps) {
  return (
    <div className="flex items-center gap-3">
      <label className="relative inline-flex items-center cursor-pointer shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only peer"
        />
        <div
          className="w-11 h-6 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"
          style={{ backgroundColor: checked ? activeColor : 'var(--theme-item-selected)' }}
        />
      </label>
      <div>
        <span className="text-sm" style={{ color: 'var(--theme-text-primary)' }}>{label}</span>
        {description && (
          <span className="text-xs ml-2" style={{ color: 'var(--theme-text-muted)' }}>{description}</span>
        )}
      </div>
    </div>
  );
}
