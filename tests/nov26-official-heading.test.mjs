import test from 'node:test';
import assert from 'node:assert/strict';
import {parseArticle,parseMediaIndex,newestPublicationForDate} from '../src/cherkasy.mjs';
import {syncSchedules,viewSchedule} from '../src/worker.mjs';

const date='2026-11-26';
const indexHtml='<a href="/media/onovleno-hrafik-pohodynnykh-vidklyuchen-hpv-na-26-lystopada">'+
  'Оновлено графік погодинних відключень (ГПВ) на 26 листопада</a><p>26.11.2026 00:20</p>'+
  '<a href="/media/hrafik-pohodynnykh-vidklyuchen-hpv-na-26-lystopada">'+
  'Графік погодинних відключень (ГПВ) на 26 листопада</a><p>25.11.2026 22:25</p>';
const updatedHtml='<h1>Оновлено графік погодинних відключень (ГПВ) на 26 листопада</h1>'+
  '<p>Оновлення графіка погодинних відключень (ГПВ) на 26 листопада</p>'+
  '<p>Години відсутності електропостачання для всіх споживачів Черкаської області:</p>'+
  '<p>1.1&nbsp;00:00 - 02:00, 06:00 - 09:00, 13:00 - 16:00, 19:00 - 21:00</p>'+
  '<p>1.2&nbsp;08:00 - 11:00, 13:00 - 16:00, 19:00 - 21:00</p>';
const expected=[
  {start:'00:00',end:'02:00'},
  {start:'06:00',end:'09:00'},
  {start:'13:00',end:'16:00'},
  {start:'19:00',end:'21:00'}
];

test('2026-11-26: latest revised official schedule for all Cherkasy consumers is parsed',()=>{
  const items=parseMediaIndex(indexHtml);
  const latest=newestPublicationForDate(items,date);
  assert.match(latest.url,/onovleno-hrafik/);
  assert.equal(latest.publishedAt,'2026-11-26T00:20:00');
  assert.deepEqual(parseArticle(updatedHtml,latest).outages,expected);
});

test('2026-11-26: official heading variations with spacing are accepted, arbitrary headings rejected',()=>{
  const publication=newestPublicationForDate(parseMediaIndex(indexHtml),date);
  const variant=updatedHtml.replace('для всіх споживачів Черкаської області:',
    'для всіх  споживачів Черкаської області :');
  assert.deepEqual(parseArticle(variant,publication).outages,expected);
  const unrelated=updatedHtml.replace('Години відсутності електропостачання для всіх споживачів Черкаської області:',
    'Години обмеження потужності для промисловості:');
  assert.throws(()=>parseArticle(unrelated,publication),/Не знайдено офіційний перелік годин/);
});

class KV {
  constructor(){this.values=new Map();}
  async get(key,fmt){const v=this.values.get(key);return v?fmt==='json'?JSON.parse(v):v:null;}
  async put(key,v){this.values.set(key,v);}
}
test('cron -> KV -> API uses November 26 updated publication and no incorrect unknown',async()=>{
  const at=new Date('2026-11-26T04:18:00Z'); // Kyiv 06:18
  const kv=new KV();
  const fetcher=async url=>{
    if(url.endsWith('/media'))return {ok:true,text:async()=>indexHtml};
    if(url.includes('onovleno-hrafik'))return {ok:true,text:async()=>updatedHtml};
    if(url.includes('t.me'))return {ok:true,text:async()=>'<html></html>'};
    return {ok:true,text:async()=>'<html></html>'};
  };
  const report=await syncSchedules({SCHEDULES:kv},{at,fetcher});
  assert.equal(report[0].outcome,'verified');
  const record=await kv.get('schedule:cherkasy:1.1:2026-11-26','json');
  assert.equal(record.kind,'schedule');
  assert.deepEqual(record.outages,expected);
  assert.equal(record.sourceKind,'official_media');
  assert.match(record.sourceUrl,/onovleno-hrafik/);
  const api=viewSchedule(record,date,at);
  assert.equal(api.kind,'schedule');
  assert.equal(api.state,'scheduled_off');
  assert.equal(api.periods.at(-1).end,'24:00');
});
