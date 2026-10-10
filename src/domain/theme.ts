export const COLOR_FIELDS = [
  ['background', 'Dashboard background'],
  ['panel', 'Panel background'],
  ['accent', 'Accent'],
  ['text', 'Primary text'],
  ['secondary', 'Secondary text'],
  ['clock', 'Clock'],
  ['border', 'Borders'],
  ['button', 'Button color'],
] as const;
export type ColorKey = (typeof COLOR_FIELDS)[number][0];
export type Colors = Record<ColorKey, string>;
export const PRESET_NAMES = [
  'Dark',
  'AMOLED',
  'Midnight Blue',
  'Samsung Blue',
  'Dark Red',
  'Light',
] as const;
export type PresetName = (typeof PRESET_NAMES)[number];
export type Theme = { preset: PresetName | 'Custom'; colors: Colors };
const palette = (
  background: string,
  panel: string,
  accent: string,
  text: string,
  secondary: string,
  border: string,
): Colors => ({ background, panel, accent, text, secondary, clock: text, border, button: accent });
export const PRESETS: Record<PresetName, Colors> = {
  Dark: palette('#0b100e', '#101712', '#c2e8a7', '#dce9d5', '#8fa18e', '#344335'),
  AMOLED: palette('#000000', '#000000', '#bbefab', '#e4eddf', '#98aa94', '#344330'),
  'Midnight Blue': palette('#080e1b', '#101a2d', '#99c8ff', '#e1eaff', '#9eafcc', '#354a6c'),
  'Samsung Blue': palette('#07112b', '#0c1d42', '#7db6ff', '#edf4ff', '#a5b9db', '#375c92'),
  'Dark Red': {
    ...palette('#090707', '#140c0e', '#b86868', '#e3d5d5', '#a68d8f', '#48262a'),
    clock: '#b86868',
    button: '#722b34',
  },
  Light: palette('#edf0e8', '#f9faf5', '#365a28', '#1b2918', '#56654e', '#a2b099'),
};
export const defaultTheme = (): Theme => ({ preset: 'Dark', colors: { ...PRESETS.Dark } });
export const validColor = (value: unknown): value is string =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
export function validTheme(value: unknown): value is Theme {
  if (!value || typeof value !== 'object') return false;
  const t = value as Theme;
  return (
    [...PRESET_NAMES, 'Custom'].includes(t.preset) &&
    !!t.colors &&
    COLOR_FIELDS.every(([key]) => validColor(t.colors[key]))
  );
}
function mix(a: string, b: string, amount: number) {
  return (
    '#' +
    [1, 3, 5]
      .map((offset) =>
        Math.round(
          parseInt(a.slice(offset, offset + 2), 16) * (1 - amount) +
            parseInt(b.slice(offset, offset + 2), 16) * amount,
        )
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
function luminance(hex: string) {
  const rgb = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
const ink = (color: string) => (luminance(color) > 0.179 ? '#111811' : '#ffffff');
/** Derived shades keep every existing control in the selected palette. No CSS color-mix needed. */
export function themeVariables(c: Colors): Record<string, string> {
  const light = luminance(c.background) > 0.4;
  return {
    '--background': c.background,
    '--surface': c.panel,
    '--accent': c.accent,
    '--text': c.text,
    '--muted': c.secondary,
    '--clock': c.clock,
    '--line': c.border,
    '--button': c.button,
    '--button-ink': ink(c.button),
    '--accent-ink': ink(c.accent),
    '--hover': mix(c.panel, c.accent, 0.1),
    '--active': mix(c.panel, c.accent, 0.18),
    '--panel-hover': mix(c.panel, c.accent, 0.025),
    '--dim': mix(c.panel, c.accent, 0.07),
    '--input-line': mix(c.border, c.text, 0.2),
    '--faint': mix(c.secondary, c.panel, 0.2),
    '--divider': mix(c.border, c.panel, 0.35),
    '--button-hover': mix(c.button, c.text, 0.2),
    '--glow': c.accent + '22',
    '--dot-glow': c.accent + '44',
    '--error-bg': light ? '#fae5dc' : '#30221c',
    '--error-text': light ? '#85351e' : '#f0c5ac',
    'color-scheme': light ? 'light' : 'dark',
  };
}
