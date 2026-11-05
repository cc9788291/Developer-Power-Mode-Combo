import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('manifest is local-only MV3 with HTTP/HTTPS content scripts', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.deepEqual(manifest.content_scripts[0].matches, ['http://*/*', 'https://*/*']);
  assert.equal('background' in manifest, false);
});

test('content script includes safety limits and page-preserving overlay behavior', () => {
  const content = read('content.js');
  for (const limit of ['MAX_PETS = 3', 'MAX_BLOTS = 24', 'MAX_PARTICLES = 150', 'INACTIVITY_MS = 1500']) assert.match(content, new RegExp(limit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(content, /pointerEvents: 'none'/);
  assert.match(content, /insertFromPaste/);
  assert.match(content, /type !== 'password'/);
  assert.match(content, /visibilitychange/);
});

test('popup exposes every requested pet mode and persists settings', () => {
  const popup = read('popup.js');
  for (const mode of ['all', 'corgis-kitties', 'corgis', 'kitties', 'octopus', 'off']) assert.match(popup, new RegExp(`'${mode}'`));
  assert.match(popup, /chrome\.storage\.local\.set/);
});

test('built-in demo provides ordinary editable fields', () => {
  const demo = read('demo.html');
  assert.match(demo, /<input[^>]+type="text"/);
  assert.match(demo, /<textarea/);
  assert.match(demo, /contenteditable="true"/);
  assert.match(demo, /content\.js/);
});
