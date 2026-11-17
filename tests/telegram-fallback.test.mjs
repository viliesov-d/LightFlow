import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTelegramChannel, newestTelegramForDate} from '../src/telegram.mjs';
import {syncSchedules, viewSchedule} from '../src/worker.mjs';

const makePost=(id,date,text)=>`
<div class="tgme_widget_message_wrap js-widget_message_wrap">
  <div class="tgme_widget_message js-widget_message" data-post="pat_cherkasyoblenergo/${id}">
    <div class="tgme_widget_message_text js-message_text" dir="auto">${text}</div>
    <a class="tgme_widget_message_date"><time datetime="${date}"></time></a>
  </div>
</div>`;
const ordinary=(date,queue='1.1 01:00 - 03:00, 08:00 - 10:00, 13:00 - 15:00, 18:00 - 20:00')=>
  `Через ворожі обстріли за розпорядженням НЕК «Укренерго» ${date} з 00:00 до 24:00 у Черкаській області будуть застосовані графіки погодинних відключень (ГПВ).<br>Години відсутності електропостачання:<br>${queue}<br>1.2 03:00 - 05:00`;
const feed=[
  makePost(510,'2026-11-16T18:00:00+00:00','17 листопада з 00:00 до 24:00 для бізнесу будуть застосовані графіки обмеження потужності (ГОП).<br>1.1 00:00 - 24:00'),
  makePost(511,'2026-11-16T21:45:00+00:00',ordinary('17 листопада')),
  makePost(512,'2026-11-16T22:00:00+00:00','Оновлення графіка погодинних відключень (ГПВ) на 17 листопада<br>Години відсутності електропостачання:<br>1.1 07:00 - 09:30, 15:00 - 17:00<br>1.2 08:00 - 10:00'),
  makePost(513,'2026-11-16T22:05:00+00:00','Промисловість: 17 листопада буде застосовано ГОП'),
  makePost(514,'2026-11-16T22:10:00+00:00',ordinary('18 листопада','1.1 06:00 - 08:00'))
].join('\n');
const at=new Date('2026-11-17T05:49:00.000Z');

class KV {
  constructor(){this.map=new Map(); this.writes=[];}
  async get(key,type){const value=this.map.get(key);return !value?null:type==='json'?JSON.parse(value):value;}
  async put(key,value){this.map.set(key,value);this.writes.push(key);}
}
const fetched=(site,telegram)=>async (url)=>{
  if(url==='https://www.cherkasyoblenergo.com/media'){
    if(site===null)throw new Error('HTTP 502 official site');
    return {ok:true,text:async()=>site};
  }
  if(url==='https://t.me/s/pat_cherkasyoblenergo'){
    if(telegram===null)throw new Error('Telegram unavailable');
    return {ok:true,text:async()=>telegram};
  }
  throw Error('Unexpected URL '+url);
};

test('parse official public Telegram channel, select newest verified update for 17th',()=>{
  const publications=parseTelegramChannel(feed,{at});
  assert.equal(publications.length,3);
  const candidate=newestTelegramForDate(publications,'2026-11-17');
  assert.equal(candidate.sourceUrl,'https://t.me/pat_cherkasyoblenergo/512');
  assert.deepEqual(candidate.outages,[{start:'07:00',end:'09:30'},{start:'15:00',end:'17:00'}]);
  assert.equal(candidate.sourceKind,'official_telegram');
  assert.equal(candidate.publishedAtLocal.slice(0,10),'2026-11-17');
});

test('fall back if media index has no publication; still expose validated state via same API',async()=>{
  const kv=new KV();
  const out=await syncSchedules({SCHEDULES:kv},{
    at,fetcher:fetched('<a href="/media/other">Не ГПВ</a>',feed)
  });
  assert.equal(out[0].outcome,'verified_telegram');
  const record=await kv.get('schedule:cherkasy:1.1:2026-11-17','json');
  assert.equal(record.sourceKind,'official_telegram');
  assert.deepEqual(record.outages,[{start:'07:00',end:'09:30'},{start:'15:00',end:'17:00'}]);
  const view=viewSchedule(record,'2026-11-17',at);
  assert.equal(view.state,'scheduled_off'); // 07:49 Kyiv falls inside 07:00–09:30
  assert.equal(view.sourceKind,'official_telegram');
  assert.equal(view.sourceUrl,'https://t.me/pat_cherkasyoblenergo/512');
});

test('fall back when official media index is unreachable',async()=>{
  const kv=new KV();
  const result=await syncSchedules({SCHEDULES:kv},{at,fetcher:fetched(null,feed)});
  assert.equal(result[0].outcome,'verified_telegram');
  assert.equal((await kv.get('schedule:cherkasy:1.1:2026-11-17','json')).kind,'schedule');
});

test('never use group-of-power (ГОП), another date or wrong queue as a schedule',async()=>{
  const wrong=makePost(550,'2026-11-16T21:30:00Z',
    '17 листопада з 00:00 до 24:00 у Черкаській області будуть застосовані графіки обмеження потужності (ГОП).<br>1.1 00:00 - 24:00');
  assert.equal(parseTelegramChannel(wrong,{at}).length,0);
  const unrelated=makePost(555,'2026-11-16T21:30:00Z',ordinary('17 листопада','2.1 08:00 - 09:00'));
  assert.equal(parseTelegramChannel(unrelated,{at}).length,0);
  const older=makePost(556,'2026-11-14T21:30:00Z',ordinary('17 листопада'));
  assert.equal(parseTelegramChannel(older,{at}).length,0);
});

test('if both sources unavailable, keep valid old schedule but do not refresh its checkedAt',async()=>{
  const kv=new KV();
  const previous={kind:'schedule',date:'2026-11-17',queue:'1.1',outages:[{start:'03:00',end:'04:00'}],
    checkedAt:'2026-11-17T04:00:00.000Z'};
  await kv.put('schedule:cherkasy:1.1:2026-11-17',JSON.stringify(previous));
  const result=await syncSchedules({SCHEDULES:kv},{at,fetcher:fetched(null,null)});
  assert.equal(result[0].outcome,'retained_previous_until_stale');
  assert.equal((await kv.get('schedule:cherkasy:1.1:2026-11-17','json')).checkedAt,previous.checkedAt);
  assert.equal(viewSchedule(previous,'2026-11-17',at).kind,'unknown');
});

test('new unparseable official revision is not replaced by an older telegram publication',async()=>{
  const kv=new KV();
  const site=`<a href="/media/onovleno-hrafik-pohodynnykh-vidklyuchen-hpv-na-17-lystopada">Оновлено графік погодинних відключень (ГПВ) на 17 листопада</a><p>17.11.2026 07:40</p>`;
  const result=await syncSchedules({SCHEDULES:kv},{at,fetcher:async url=>{
    if(url.endsWith('/media'))return {ok:true,text:async()=>site};
    if(url.includes('t.me'))return {ok:true,text:async()=>feed};
    return {ok:true,text:async()=>'<h1>Пошкоджений графік</h1>'};
  }});
  assert.equal(result[0].outcome,'source_error');
  assert.equal((await kv.get('schedule:cherkasy:1.1:2026-11-17','json')).kind,'unknown');
});


test('website labels verified Telegram provenance without accepting arbitrary URLs',async()=>{
  const {landingResponse}=await import('../src/landing.mjs');
  const html=await (await landingResponse()).text();
  assert.match(html,/Джерело: офіційний Telegram/);
  assert.match(html,/pat_cherkasyoblenergo/);
  assert.match(html,/Джерело: сайт обленерго/);
  assert.match(html,/source-link/);
});

test('malformed or forged Telegram HTML never creates an outage schedule',()=>{
  const forged=feed.replaceAll('pat_cherkasyoblenergo/','unofficial_cherkasy/');
  assert.equal(parseTelegramChannel(forged,{at}).length,0);
  const withoutTime=feed.replace(/<time datetime="[^"]+"><\/time>/g,'<time></time>');
  assert.equal(parseTelegramChannel(withoutTime,{at}).length,0);
  const invalid=makePost(600,'2026-11-16T22:00:00Z',
    ordinary('17 листопада','1.1 08:00 - 11:00, 10:00 - 12:00'));
  assert.equal(parseTelegramChannel(invalid,{at}).length,0);
});
