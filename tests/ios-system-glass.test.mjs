import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const file='widgets/ios/LightFlow.js';
const source=readFileSync(file,'utf8');

test('each Scriptable widget passes a transparent canvas to the native iOS container',()=>{
  assert.match(source,/dc\.opaque = false/);
  assert.match(source,/dc\.respectScreenScale = true/);
  assert.match(source,/widget\.backgroundColor\s*=\s*Color\.clear\(\)/);
  assert.match(source,/Script\.setWidget\(widget\)/);
  assert.doesNotMatch(source,/\bGLASS\b|glassSurface\s*\(|roundedPath\s*\(/);
  assert.doesNotMatch(source,/widget\.backgroundImage\s*=|widget\.backgroundGradient\s*=/);
  assert.doesNotMatch(source,/widget\.addAccessoryWidgetBackground\s*=/);
  assert.doesNotMatch(source,/Photos\.fromLibrary|FileManager|cacheDirectory/i);
});

test('foreground-only artwork does not paint fake glass, wallpaper, rounded borders or halo',()=>{
  assert.match(source,/function bulbArt\(data, now\)/);
  assert.match(source,/function dialArt\(data, now, compact\)/);
  assert.match(source,/bulbIcon\(dc,/);
  assert.match(source,/circularBand\(dc,cx,cy,0,1440/);
  assert.match(source,/centered\(dc,"1\.1"/);
  assert.match(source,/for \(let hour = 0; hour < 24; hour\+\+\)/);
  assert.doesNotMatch(source,/new Color\("#12243A",\s*0\.85\)/);
  assert.doesNotMatch(source,/circle\(dc,\s*180,\s*130,\s*79/);
  assert.doesNotMatch(source,/pathStroke\(dc,\s*roundedPath/);
  assert.match(source,/mode==="large"\?dialArt\(data,now,false\)/);
  assert.match(source,/mode==="mini"\?dialArt\(data,now,true\):bulbArt\(data,now\)/);
});

test('only widget presentation changes; schedule and update logic remain intact',()=>{
  assert.match(source,/verified\(data,now\)/);
  assert.match(source,/age > 20 \* 60 \* 1000/);
  assert.match(source,/cursor === 1440/);
  assert.match(source,/const position=kyivMinutes\(now\)\/4/);
  assert.match(source,/widget\.refreshAfterDate=/);
  assert.match(source,/widget\.url=widgetLaunchURL\(\)/);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  assert.equal(check.status,0,check.stderr);
});
