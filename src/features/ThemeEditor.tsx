import { useEffect, useState } from 'react';
import type { DashboardData } from '../domain/model';
import type { Commit } from '../data/useDashboard';
import { COLOR_FIELDS, PRESETS, PRESET_NAMES, defaultTheme, validColor } from '../domain/theme';
import type { ColorKey, PresetName, Theme } from '../domain/theme';

function ColorField({
  name,
  label,
  value,
  onChange,
}: {
  name: ColorKey;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const invalid = !validColor(draft);
  return (
    <div className="color-field">
      <label htmlFor={'color-' + name}>{label}</label>
      <div className="color-inputs">
        <input
          id={'color-' + name}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          aria-label={label + ' hex'}
          value={draft}
          maxLength={7}
          spellCheck={false}
          autoCapitalize="off"
          aria-invalid={invalid}
          onChange={(e) => {
            setDraft(e.target.value);
            if (validColor(e.target.value)) onChange(e.target.value.toLowerCase());
          }}
          onBlur={() => setDraft(value)}
        />
      </div>
      {invalid && <small className="helper">Use six hex digits, e.g. #112233.</small>}
    </div>
  );
}
export function ThemeEditor({ data, commit }: { data: DashboardData; commit: Commit }) {
  const theme = data.settings.theme;
  const save = (next: Theme) => commit((d) => ({ ...d, settings: { ...d.settings, theme: next } }));
  return (
    <>
      <p className="helper">
        Colors apply immediately and save on this device. Your dashboard data stays in place.
      </p>
      <label className="field-label" htmlFor="theme-preset">
        Theme preset
      </label>
      <select
        id="theme-preset"
        value={theme.preset}
        onChange={(e) => {
          const preset = e.target.value as Theme['preset'];
          save({
            preset,
            colors:
              preset === 'Custom' ? { ...theme.colors } : { ...PRESETS[preset as PresetName] },
          });
        }}
      >
        {[...PRESET_NAMES, 'Custom'].map((name) => (
          <option key={name}>{name}</option>
        ))}
      </select>
      <div className="theme-colors">
        {COLOR_FIELDS.map(([name, label]) => (
          <ColorField
            key={name}
            name={name}
            label={label}
            value={theme.colors[name]}
            onChange={(value) =>
              save({ preset: 'Custom', colors: { ...theme.colors, [name]: value } })
            }
          />
        ))}
      </div>
      <button onClick={() => save(defaultTheme())}>RESET TO DEFAULT</button>
      <p className="helper theme-note">
        Reset restores the original green terminal palette. Changes to colors do not reset your
        tasks, counters, or other settings.
      </p>
    </>
  );
}
