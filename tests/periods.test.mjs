import test from 'node:test';
import assert from 'node:assert/strict';
import { groupDay, minuteOf } from '../src/periods.mjs';
import { createWorker, viewSchedule } from '../src/worker.mjs';
import { Script } from 'node:vm';

const outages=[
  {start:'00:00',end:'02:00'}, {start:'04:00',end:'08:00'},
  {start:'10:00',end:'14:00'}, {start:'16:00',end:'20:00'},
  {start:'22:00',end:'24:00'}
];

test('groups a full day into nine exact alternating intervals',()=>{
  const actual=groupDay(outages);
  assert.deepEqual(actual.map(p=>[p.start,p.end,p.state]),[
    ['00:00','02:00','scheduled_off'],
    ['02:00','04:00','scheduled_on'],
    ['04:00','08:00','scheduled_off'],
    ['08:00','10:00','scheduled_on'],
    ['10:00','14:00','scheduled_off'],
    ['14:00','16:00','scheduled_on'],
    ['16:00','20:00','scheduled_off'],
    ['20:00','22:00','scheduled_on'],
    ['22:00','24:00','scheduled_off']
  ]);
  assert.equal(actual.reduce((n,p)=>n+p.durationMinutes,0),1440);
  assert.equal(actual.filter(p=>p.state==='scheduled_off').reduce((n,p)=>n+p.durationMinutes,0),960);
});

test('merges touching outage intervals and handles half-hour boundaries',()=>{
  const periods=groupDay([
    {start:'06:30',end:'07:30'}, {start:'07:30',end:'08:00'},
    {start:'20:00',end:'21:15'}
  ]);
  assert.deepEqual(periods.map(p=>[p.start,p.end,p.state]),[
    ['00:00','06:30','scheduled_on'],
    ['06:30','08:00','scheduled_off'],
    ['08:00','20:00','scheduled_on'],
    ['20:00','21:15','scheduled_off'],
    ['21:15','24:00','scheduled_on']
  ]);
});

test('does not create fake gaps or permit invalid hours and overlaps',()=>{
  for(const bad of [
    [{start:'10:00',end:'09:30'}],
    [{start:'08:00',end:'25:00'}],
    [{start:'08:00',end:'09:00'},{start:'08:30',end:'10:00'}]
  ]) assert.throws(()=>groupDay(bad));
  assert.throws(()=>groupDay(null));
  assert.equal(minuteOf('24:00',{allowEndOfDay:true}),1440);
  assert.throws(()=>minuteOf('24:00'));
});

test('published empty outage schedule covers day as scheduled_on only',()=>{
  assert.deepEqual(groupDay([]),[
    {start:'00:00',end:'24:00',state:'scheduled_on',durationMinutes:1440}
  ]);
});

test('API returns periods without changing verified outage data',()=>{
  const record={region:'cherkasy',queue:'1.1',date:'2026-11-10',kind:'schedule',
    checkedAt:'2026-11-10T12:01:00.000Z',sourceUrl:'https://www.cherkasyoblenergo.com/media/example',
    outages};
  const response=viewSchedule(record,'2026-11-10',new Date('2026-11-10T12:05:00.000Z'));
  assert.equal(response.state,'scheduled_on');
  assert.equal(response.nextChangeLocal,'16:00');
  assert.equal(response.outages.length,5);
  assert.equal(response.periods.length,9);
  assert.equal(response.totalOutageMinutes,960);
  const stale=viewSchedule(record,'2026-11-10',new Date('2026-11-10T12:45:00.000Z'));
  assert.equal(stale.kind,'unknown');
  assert.equal(stale.periods,null);
  assert.equal(stale.outages,null);
});

test('homepage contains grouped view and valid inline script',async()=>{
  const worker=createWorker();
  const response=await worker.fetch(new Request('https://example.test/'),{});
  const html=await response.text();
  assert.match(html, /Графік електропостачання на сьогодні/);
  assert.match(html, /Точні години відключення/);
  assert.match(html, /data\.periods/);
  assert.match(html, /Сайт працює онлайн/);
  const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  assert.doesNotThrow(()=>new Script(script));
});
