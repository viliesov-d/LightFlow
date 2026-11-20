import test from 'node:test';
import assert from 'node:assert/strict';
import {parseQueueIntervals,parseArticle,parseMediaIndex,newestPublicationForDate} from '../src/cherkasy.mjs';
import {parseTelegramChannel,newestTelegramForDate} from '../src/telegram.mjs';
import {syncSchedules,viewSchedule} from '../src/worker.mjs';

// Official 20.11.2026 page splits an hour as "1 6:00".
// Do not assume this means 01:00 or 06:00: it is a broken "16:00".
const date='2026-11-20';
const stamp='2026-11-19T20:14:00';
const pageUrl='https://www.cherkasyoblenergo.com/media/hrafik-pohodynnykh-vidklyuchen-hpv-na-20-lystopada';
const media='<a href="/media/hrafik-pohodynnykh-vidklyuchen-hpv-na-20-lystopada">Графік погодинних відключень (ГПВ) на 20 листопада</a><p>19.11.2026 20:14</p>';
const article='<h1>Графік погодинних відключень (ГПВ) на 20 листопада</h1>'+
  '<p>Години відсутності електропостачання по області (крім ВСП «Уманські енергетичні мережі», Жашківської, Монастирищенської та Христинівської філій):</p>'+
  '<p>1.1 1 6:00 - 18:00, 22:00 - 24:00</p><p>1.2 12:00 - 14:00</p>';
const outages=[{start:'16:00',end:'18:00'},{start:'22:00',end:'24:00'}];
const at=new Date('2026-11-20T05:44:00.000Z');

test('real Nov 20 official source recovers split 16:00 without changing other hours',()=>{
  const publication=newestPublicationForDate(parseMediaIndex(media),date);
  assert.equal(publication.publishedAt,stamp);
  const result=parseArticle(article,publication);
  assert.deepEqual(result.outages,outages);
});
test('only a single break in a two-digit hour is repaired, invalid digits remain rejected',()=>{
  assert.deepEqual(parseQueueIntervals('1.1 1 6:00 - 18:00, 22:00 - 24:00'),outages);
  assert.deepEqual(parseQueueIntervals('1.1 0 8:00 - 09:30'),[
    {start:'08:00',end:'09:30'}
  ]);
  assert.throws(()=>parseQueueIntervals('1.1 2 9:00 - 23:00'));
  assert.throws(()=>parseQueueIntervals('1.1 12 3:00 - 18:00'));
  assert.throws(()=>parseQueueIntervals('1.1 16:00 - 18:00, 17:00 - 20:00'),/перетинаються/);
});
test('Telegram 00:00 endpoint means next midnight, not invalid same-day start',()=>{
  assert.deepEqual(parseQueueIntervals('1.1 21:00 - 00:00',{queue:'1.1',allowMidnightEnd:true}),[
    {start:'21:00',end:'24:00'}
  ]);
  assert.throws(()=>parseQueueIntervals('1.1 00:00 - 00:00',{queue:'1.1',allowMidnightEnd:true}));
  assert.throws(()=>parseQueueIntervals('1.1 21:00 - 00:00'),/Некоректний/);
});
const tg='<div class="tgme_widget_message_wrap"><div class="tgme_widget_message" data-post="pat_cherkasyoblenergo/1030">'+
  '<div class="tgme_widget_message_text">Оновлений графік погодинних вимкнень на 20 листопада за командою НЕК «Укренерго».<br>'+
  'Години відсутності електропостачання:<br>1.1 21:00 - 00:00<br>1.2 20:00 - 22:00</div>'+
  '<time datetime="2026-11-19T21:00:00+00:00"></time></div>';
test('Telegram fallback accepts official end-of-day 00:00, normalizes to 24:00',()=>{
  const posts=parseTelegramChannel(tg,{at});
  const rec=newestTelegramForDate(posts,date);
  assert.ok(rec);
  assert.deepEqual(rec.outages,[{start:'21:00',end:'24:00'}]);
});
class MemoryKV {
  constructor(){this.map=new Map();}
  async get(key,type){const x=this.map.get(key);return x===undefined?null:type==='json'?JSON.parse(x):x;}
  async put(key,value){this.map.set(key,value);}
}
test('scheduled cron stores valid official 20 Nov plan and API reports correct state',async()=>{
  const kv=new MemoryKV();
  const fetcher=async url=>({ok:true,text:async()=>url.endsWith('/media')?media:url===pageUrl?article:'<div></div>'});
  const result=await syncSchedules({SCHEDULES:kv},{at,fetcher});
  assert.equal(result[0].outcome,'verified');
  const rec=await kv.get('schedule:cherkasy:1.1:2026-11-20','json');
  assert.deepEqual(rec.outages,outages);
  assert.equal(viewSchedule(rec,date,at).state,'scheduled_on');
  assert.equal(viewSchedule(rec,date,at).sourceKind,'official_media');
});
