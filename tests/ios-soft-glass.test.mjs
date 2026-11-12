import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const path='widgets/ios/LightFlow.js';
const script=readFileSync(path,'utf8');

test('Soft Glass draws a translucent rounded surface behind each of three designs',()=>{
  assert.match(script,/function roundedPath\(x,y,w,h,r\)/);
  assert.match(script,/function glassSurface\(dc,size,large=false\)/);
  assert.match(script,/const inset=size\*\(large\?0\.028:0\.038\)/);
  assert.match(script,/GLASS\.base/);
  assert.match(script,/GLASS\.topEdge/);
  assert.match(script,/GLASS\.bottomEdge/);
  assert.match(script,/GLASS\.sheen/);
  assert.match(script,/pathStroke\(dc,roundedPath/);
  assert.match(script,/glassSurface\(dc,size\);/);
  assert.match(script,/glassSurface\(dc,size,!compact\);/);
  assert.match(script,/base: new Color\("#12243A", 0\.85\)/);
  assert.doesNotMatch(script,/Photos\.fromLibrary|transparent-widget\.png/);
});

test('Retina rendering and subtle glyph shadows remain enabled',()=>{
  assert.match(script,/dc\.respectScreenScale = true/);
  assert.match(script,/dc\.opaque = false/);
  assert.match(script,/GLASS\.textShadow/);
  assert.match(script,/dc\.setTextColor\(GLASS\.textShadow\)/);
  assert.match(script,/dc\.setTextColor\(PAL\.white\)/);
  assert.match(script,/new Color\("#FFD383", span \? 0\.040 : 0\.015\)/);
  const check=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});
  assert.equal(check.status,0,check.stderr);
});

test('glass UI does not change Cloudflare validation, widget parameters, or clock logic',()=>{
  assert.match(script,/verified\(data,now\)/);
  assert.match(script,/age > 20 \* 60 \* 1000/);
  assert.match(script,/cursor === 1440/);
  assert.match(script,/hour%3===0/);
  assert.match(script,/for \(let hour = 0; hour < 24; hour\+\+\)/);
  assert.match(script,/const position=kyivMinutes\(now\)\/4/);
  assert.match(script,/mode==="large"\?dialArt\(data,now,false\)/);
  assert.match(script,/mode==="mini"\?dialArt\(data,now,true\):bulbArt\(data,now\)/);
  assert.match(script,/widget\.refreshAfterDate=/);
  assert.doesNotMatch(script,/FileManager|Keychain|localStorage|cacheDirectory/);
});
