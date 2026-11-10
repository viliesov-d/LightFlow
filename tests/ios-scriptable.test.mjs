import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

test('Scriptable widget syntax and basic security contract', () => {
  const path = 'widgets/ios/LightFlow.js';
  const check = spawnSync(process.execPath,['--check',path],{encoding:'utf8'});
  assert.equal(check.status,0,check.stderr);
  const source=readFileSync(path,'utf8');
  assert.match(source,/config\.widgetFamily/);
  assert.match(source,/Script\.setWidget/);
  assert.match(source,/api\/v1\/schedule/);
  assert.match(source,/checkedAt/);
  assert.match(source,/data\.periods/);
  assert.doesNotMatch(source,/FileManager|Keychain|localStorage|cacheDirectory/i);
});
