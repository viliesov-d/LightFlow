import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorker, kyivClock, tomorrowOf, viewSchedule, syncSchedules} from '../src/worker.mjs';

class FakeKV {
  constructor() { this.values = new Map(); this.writes = []; }
  async get(key, type) {
    const value = this.values.get(key);
    return value === undefined ? null : type === 'json' ? JSON.parse(value) : value;
  }
  async put(key, value) {
    this.writes.push(key);
    this.values.set(key, value);
  }
}
const initial = '<a href="/media/hrafik-pohodynnykh-vidklyuchen-hpv-na-10-lystopada">Графік погодинних відключень (ГПВ) на 10 листопада</a><p>09.11.2026 20:58</p>';
const updated = '<a href="/media/onovleno-hrafik-pohodynnykh-vidklyuchen-hpv-na-10-lystopada">Оновлено графік погодинних відключень (ГПВ) на 10 листопада</a><p>09.11.2026 23:06</p>';
const originalArticle = '<h1>Графік погодинних відключень (ГПВ) на 10 листопада</h1><p>Години відсутності електропостачання:</p><p>1.1 04:00 - 08:00, 10:00 - 14:00</p>';
const updatedArticle = '<h1>Оновлено графік погодинних відключень (ГПВ) на 10 листопада</h1><p>Години відсутності електропостачання:</p><p>1.1 00:00 - 02:00, 04:00 - 08:00, 10:00 - 14:00, 16:00 - 20:00, 22:00 - 24:00</p>';
const instant = () => new Date('2026-11-10T09:30:00.000Z'); // 11:30 in Kyiv
const makeFetcher = (index, article = updatedArticle) => async url => ({
  ok: true, status: 200,
  text: async () => url.endsWith('/media') ? index : article
});

test('Kyiv calendar handles midnight, DST and month/year rollover', () => {
  assert.deepEqual(kyivClock(new Date('2026-11-09T22:30:00Z')), {date:'2026-11-10', minutes:30});
  assert.equal(tomorrowOf('2026-12-31'), '2027-01-01');
  assert.equal(kyivClock(new Date('2026-06-01T07:15:00Z')).minutes, 615);
});

test('scheduled collection stores verified timetable and does not equate missing tomorrow to power on', async () => {
  const env={SCHEDULES:new FakeKV()};
  const result=await syncSchedules(env,{at:instant(),fetcher:makeFetcher(updated + initial)});
  assert.deepEqual(result.map(x=>x.outcome),['verified','not_found']);
  const today=await env.SCHEDULES.get('schedule:cherkasy:1.1:2026-11-10','json');
  const tomorrow=await env.SCHEDULES.get('schedule:cherkasy:1.1:2026-11-11','json');
  assert.equal(today.sourceUrl.endsWith('/onovleno-hrafik-pohodynnykh-vidklyuchen-hpv-na-10-lystopada'),true);
  assert.equal(today.outages.length,5);
  assert.equal(tomorrow.kind,'unknown');
  assert.ok(env.SCHEDULES.writes.some(key=>key.startsWith('version:')));
});

test('API returns planned power state, not physical power confirmation', async () => {
  const env={SCHEDULES:new FakeKV()};
  await syncSchedules(env,{at:instant(),fetcher:makeFetcher(updated+initial)});
  const worker=createWorker({now:instant});
  const response=await worker.fetch(new Request('https://local.test/api/v1/schedule'),env);
  assert.equal(response.status,200);
  assert.equal(response.headers.get('access-control-allow-origin'),'*');
  const body=await response.json();
  assert.equal(body.state,'scheduled_off');
  assert.equal(body.nextChangeLocal,'14:00');
  assert.equal(body.totalOutageMinutes,960);
  assert.equal(body.queue,'1.1');
  const missing=await worker.fetch(new Request('https://local.test/api/v1/schedule?date=2026-11-11'),env);
  assert.equal((await missing.json()).state,'unknown');
});

test('API returns unknown instead of showing outdated source as valid', async () => {
  const env={SCHEDULES:new FakeKV()};
  await syncSchedules(env,{at:instant(),fetcher:makeFetcher(updated + initial)});
  const worker=createWorker({now:()=>new Date('2026-11-10T10:00:00Z')});
  const result=await worker.fetch(new Request('https://local.test/api/v1/schedule'),env);
  assert.deepEqual((await result.json()).reason,'stale');
});

test('new revised publication that cannot be parsed invalidates the older schedule', async () => {
  const env={SCHEDULES:new FakeKV()};
  await syncSchedules(env,{at:instant(),fetcher:makeFetcher(initial,originalArticle)});
  const result=await syncSchedules(env,{at:new Date('2026-11-10T09:35:00Z'),fetcher:makeFetcher(updated+initial,'<h1>Invalid article</h1>')});
  assert.equal(result[0].outcome,'source_error');
  const worker=createWorker({now:()=>new Date('2026-11-10T09:36:00Z')});
  const response=await worker.fetch(new Request('https://local.test/api/v1/schedule'),env);
  const json=await response.json();
  assert.equal(json.kind,'unknown');
  assert.equal(json.reason,'new_revision_not_verified');
  assert.equal(json.outages,null);
});

test('preserves latest schedule if it falls out of recent media listing, but eventually marks stale', async () => {
  const env={SCHEDULES:new FakeKV()};
  await syncSchedules(env,{at:instant(),fetcher:makeFetcher(updated+initial)});
  const another='<a href="/media/hrafik-pohodynnykh-vidklyuchen-hpv-na-12-lystopada">Графік погодинних відключень (ГПВ) на 12 листопада</a><p>11.11.2026 21:00</p>';
  const result=await syncSchedules(env,{at:new Date('2026-11-10T09:35:00Z'),fetcher:makeFetcher(another)});
  assert.equal(result[0].outcome,'retained_previous_until_stale');
  const record=await env.SCHEDULES.get('schedule:cherkasy:1.1:2026-11-10','json');
  assert.equal(record.kind,'schedule');
  assert.equal(viewSchedule(record,'2026-11-10',new Date('2026-11-10T10:00:00Z')).state,'unknown');
});

test('rejects invalid date, inaccessible storage, unknown routes and write methods', async () => {
  const worker=createWorker({now:instant});
  const env={SCHEDULES:new FakeKV()};
  assert.equal((await worker.fetch(new Request('https://local.test/api/v1/schedule?date=2026-10-01'),env)).status,400);
  assert.equal((await worker.fetch(new Request('https://local.test/api/v1/schedule?date=bad'),env)).status,400);
  assert.equal((await worker.fetch(new Request('https://local.test/incorrect'),env)).status,404);
  assert.equal((await worker.fetch(new Request('https://local.test/api/v1/schedule',{method:'POST'}),env)).status,405);
  assert.equal((await worker.fetch(new Request('https://local.test/api/v1/schedule'),{})).status,503);
  assert.equal((await worker.fetch(new Request('https://local.test/health'),env)).status,200);
});

test('scheduled handler triggers sync in waitUntil', async () => {
  const env={SCHEDULES:new FakeKV()};
  const worker=createWorker({now:instant,fetcher:makeFetcher(updated+initial)});
  let task;
  await worker.scheduled({},env,{waitUntil(promise){task=promise;}});
  await task;
  assert.ok(await env.SCHEDULES.get('schedule:cherkasy:1.1:2026-11-10','json'));
});

test('homepage provides a readable online view while retaining JSON API routes', async () => {
  const worker=createWorker({now:()=>new Date('2026-11-10T11:00:00Z')});
  const response=await worker.fetch(new Request('https://lightflow.example/'),{});
  assert.equal(response.status,200);
  assert.match(response.headers.get('content-type'),/text\/html/);
  const html=await response.text();
  assert.match(html, /LightFlow/);
  assert.match(html, /Статус невідомий/);
  assert.match(html, /api\/v1\/schedule/);
  const unknown=await worker.fetch(new Request('https://lightflow.example/does-not-exist'),{});
  assert.equal(unknown.status,404);
});
