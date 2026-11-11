import test from 'node:test';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { landingResponse } from '../src/landing.mjs';

test('homepage renders round 24-hour graph instead of old interval cards',async()=>{
  const html=await (await landingResponse()).text();
  assert.match(html,/id="dial-segments"/);
  assert.match(html,/id="dial-dividers"/);
  assert.match(html,/id="dial-hours"/);
  assert.match(html,/id="dial-hand-line"/);
  assert.match(html,/id="dial-hand-dot"/);
  assert.match(html,/id="dial-current"/);
  assert.match(html,/class="ring-track"/);
  assert.doesNotMatch(html,/class="periods" id="periods"/);
  assert.match(html,/Точні години відключення/);
  assert.match(html,/id="outages"/);
  assert.match(html,/id="off-total"/);
  assert.match(html,/id="on-total"/);
});

test('24h dial respects minute-level schedule sectors and handles full-day arcs',async()=>{
  const html=await (await landingResponse()).text();
  const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  assert.doesNotThrow(()=>new Script(script));
  assert.match(script,/function intervalArc\(start,end\)/);
  assert.match(script,/Math\.ceil\(\(end-start\)\/720\)/);
  assert.match(script,/minute\(span\.start\),minute\(span\.end\)/);
  assert.match(script,/for\(let h=0;h<24;h\+\+\)/);
  assert.match(script,/minute\(p\.start\)<=minuteNow && minuteNow<minute\(p\.end\)/);
  assert.match(script,/el\('dial-current'\)/);
  assert.match(script,/function updateDialClock\(\)/);
  assert.match(script,/kyivSeconds\(\)/);
  assert.match(script,/setInterval\(updateDialClock,1000\)/);
  assert.match(script,/timeZone:'Europe\/Kyiv'/);
});

test('no verified data still hides current schedule and does not claim power is on',async()=>{
  const html=await (await landingResponse()).text();
  assert.match(html,/el\('available'\)\.hidden=true/);
  assert.match(html,/activeSchedule=null/);
  assert.match(html,/Статус невідомий/);
  assert.match(html,/if\(!validate\(data\)\)/);
  assert.match(html,/el\('available'\)\.hidden=false/);
  assert.match(html,/fetch\('\/api\/v1\/schedule',\{cache:'no-store'\}\)/);
});
