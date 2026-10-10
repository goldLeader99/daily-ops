import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialData, createItem } from '../src/domain/model.ts';
import { defaultTheme, PRESETS, themeVariables, validTheme } from '../src/domain/theme.ts';
import { createRepository, parseData } from '../src/data/repository.ts';

test('old v1 backups acquire the original palette without resetting existing data', () => {
  const data = createInitialData();
  data.tasks.push(createItem('Keep this task'));
  data.counters.cigarettes = '2026-09-15';
  const old = { ...data, settings: { crt: false } };
  const restored = parseData(JSON.stringify(old));
  assert.deepEqual(restored.tasks, data.tasks);
  assert.deepEqual(restored.counters, data.counters);
  assert.equal(restored.settings.crt, false);
  assert.deepEqual(restored.settings.theme, defaultTheme());
});
test('custom colors survive repository restart and backup restore', () => {
  let raw: string | null = null;
  const storage = {
    getItem: () => raw,
    setItem: (_: string, value: string) => {
      raw = value;
    },
  };
  const repo = createRepository(storage);
  const data = repo.load();
  data.settings.theme = { preset: 'Custom', colors: { ...PRESETS.Dark, clock: '#f0a123' } };
  repo.save(data);
  assert.deepEqual(createRepository(storage).load().settings.theme, data.settings.theme);
  const exported = repo.exportRaw();
  repo.save(createInitialData());
  assert.deepEqual(repo.restore(exported).settings.theme, data.settings.theme);
});
test('theme validator rejects malformed and injectable CSS colors without resetting storage', () => {
  for (const value of [
    null,
    {},
    { preset: 'Fake', colors: PRESETS.Dark },
    {
      preset: 'Custom',
      colors: { ...PRESETS.Dark, text: 'red; background:url(https://example.com)' },
    },
  ]) {
    assert.equal(validTheme(value), false);
    assert.throws(() =>
      parseData(JSON.stringify({ ...createInitialData(), settings: { crt: true, theme: value } })),
    );
  }
  for (const colors of Object.values(PRESETS))
    assert.equal(validTheme({ preset: 'Custom', colors }), true);
});
test('light and dark palettes choose readable filled-button ink and native input color schemes', () => {
  assert.equal(themeVariables(PRESETS.Dark)['--button-ink'], '#111811');
  assert.equal(themeVariables(PRESETS.Light)['--button-ink'], '#ffffff');
  assert.equal(themeVariables(PRESETS.Light)['color-scheme'], 'light');
  assert.equal(themeVariables(PRESETS.Dark)['color-scheme'], 'dark');
});
