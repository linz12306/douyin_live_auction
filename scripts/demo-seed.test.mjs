import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertExpectedRole, demoImagePath, demoLiveMediaFilename } from './demo-seed.mjs';

test('demo seed uses a backend-served product image fixture', () => {
  assert.match(demoImagePath, /^\/static\/images\/.+/);
});

test('demo seed uploads a supported live room image file', () => {
  assert.match(demoLiveMediaFilename, /\.(png|jpe?g|webp)$/);
});

test('demo seed rejects existing accounts with the wrong role', () => {
  assert.throws(
    () => assertExpectedRole({ username: 'demo_merchant', role: 'user' }, { username: 'demo_merchant', role: 'merchant' }),
    /demo_merchant.*expected role merchant.*got user/,
  );
});
