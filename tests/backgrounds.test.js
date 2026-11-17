import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BG_EXPORT_LIMIT,
  DEFAULT_VEIL,
  backgroundsFitExport,
  normalizeBgPref,
} from '../js/backgrounds.js';

test('the rose window is the default wallpaper', () => {
  assert.deepEqual(normalizeBgPref(null), { kind: 'rose', uploadId: null, veil: DEFAULT_VEIL });
  assert.deepEqual(normalizeBgPref({ kind: 'nope', veil: 'thick' }), {
    kind: 'rose',
    uploadId: null,
    veil: DEFAULT_VEIL,
  });
});

test('veil stays between clear and fully hazy', () => {
  assert.equal(normalizeBgPref({ kind: 'sakura', veil: 2 }).veil, 1);
  assert.equal(normalizeBgPref({ kind: 'sakura', veil: -0.2 }).veil, 0);
  const custom = normalizeBgPref({ kind: 'upload', uploadId: 'bg-1', veil: 0.5 });
  assert.deepEqual(custom, { kind: 'upload', uploadId: 'bg-1', veil: 0.5 });
  assert.equal(normalizeBgPref({ kind: 'upload', veil: 0.5 }).uploadId, null);
});

test('only a modest set of photos rides along in a backup', () => {
  assert.equal(backgroundsFitExport(0), false);
  assert.equal(backgroundsFitExport(120_000), true);
  assert.equal(backgroundsFitExport(BG_EXPORT_LIMIT), true);
  assert.equal(backgroundsFitExport(BG_EXPORT_LIMIT + 1), false);
});
