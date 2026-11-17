import test from 'node:test';
import assert from 'node:assert/strict';
import {parseArticle,parseMediaIndex,newestPublicationForDate} from '../src/cherkasy.mjs';
import {parseTelegramChannel,newestTelegramForDate} from '../src/telegram.mjs';
import {syncSchedules,viewSchedule} from '../src/worker.mjs';

// Wording and outage hours below are taken from the company's PUBLIC
// 18 November 2026 publication. They reproduce a production source_error.
const date='2026-11-18';
const publishedAt='2026-11-17T21:20:00';
const url='https://www.cherkasyoblenergo.com/media/hrafik-pohodynnykh-vidklyuchen-hpv-na-18-lystopada';
const expected=[
  {start:'00:00',end:'02:00'},
  {start:'06:00',end:'08:00'},
  {start:'12:00',end:'14:00'},
  {start:'17:00',end:'19:00'}
];
const title='Графік погодинних відключень (ГПВ) на 18 листопада';
const media='<a href="/media/hrafik-pohodynnykh-vidklyuchen-hpv-na-18-lystopada">'+title+'</a><p>17.11.2026 21:20</p>';
const article='<html><h1>'+title+'</h1>'+
  '<p>Через обстріли 18 листопада з 00:00 до 24:00 у Черкаській області будуть застосовані графіки погодинних відключень (ГПВ).</p>'+
  '<p>Години відсутності електропостачання по області (крім ВСП «Уманські енергетичні мережі», Жашківської, Монастирищенської та Христинівської філій):</p>'+
  '<p>1.1&nbsp;00:00 - 02:00, 06:00 - 08:00,&nbsp;12:00 - 14:00, 17:00 - 19:00</p>'+
  '<p>1.2&nbsp;02:00 - 04:00</p></html>';

test('Nov 18 official site: accepts longer verified heading with regional exception',()=>{
  const publication=newestPublicationForDate(parseMediaIndex(media),date);
  assert.equal(publication.date,date);
  const result=parseArticle(article,publication);
  assert.deepEqual(result.outages,expected);
  assert.equal(result.sourceUrl,url);
});
test('Nov 18: original shorter official heading is still supported',()=>{
  const publication={date,publishedAt,url};
  const shorter=article.replace(/Години відсутності електропостачання по області \(крім[^)]*\):/,
    'Години відсутності електропостачання:');
  assert.deepEqual(parseArticle(shorter,publication).outages,expected);
});
test('Nov 18: a misleading unrelated block does not create verified schedule',()=>{
  const publication={date,publishedAt,url};
  const changed=article.replace('Години відсутності електропостачання по області (крім ВСП «Уманські енергетичні мережі», Жашківської, Монастирищенської та Христинівської філій):',
    'Години відсутності електропостачання:');
  assert.deepEqual(parseArticle(changed,publication).outages,expected);
});
const post=(id,datetime,text)=>'<div class="tgme_widget_message_wrap js-widget_message_wrap">'+
  '<div class="tgme_widget_message js-widget_message" data-post="pat_cherkasyoblenergo/'+id+'">'+
  '<div class="tgme_widget_message_text js-message_text" dir="auto">'+text+'</div>'+
  '<a class="tgme_widget_message_date"><time datetime="'+datetime+'"></time></a></div></div>';
const telegram=post(1051,'2026-11-17T20:10:00+00:00',
  'За командою НЕК «Укренерго»18 листопада по Черкаській області з 00:00 до 24:00 застосовуватимуться графіки погодинних вимкнень (ГПВ).<br>'+
  'Години відсутності електропостачання:<br>'+
  '1.1 00:00 - 02:00, 06:00 - 08:00, 12:00 - 14:00, 17:00 - 19:00<br>1.2 02:00 - 04:00');
const at=new Date('2026-11-17T22:10:00Z'); // 18 November 00:10 in Kyiv

test('Nov 18 official Telegram real prose with «вимкнень» and no space before date',()=>{
  const posts=parseTelegramChannel(telegram,{at});
  assert.equal(posts.length,1);
  const result=newestTelegramForDate(posts,date);
  assert.equal(result.date,date);
  assert.equal(result.sourceKind,'official_telegram');
  assert.deepEqual(result.outages,expected);
});

class FakeKV{
  constructor(){this.values=new Map();}
  async get(key,type){const raw=this.values.get(key);return raw==null?null:type==='json'?JSON.parse(raw):raw;}
  async put(key,value){this.values.set(key,value);}
}
test('Nov 18: official article populates KV and returns valid API periods',async()=>{
  const kv=new FakeKV();
  const fetcher=async address=>({
    ok:true,text:async()=>address.endsWith('/media')?media:
      address===url?article:telegram
  });
  const report=await syncSchedules({SCHEDULES:kv},{at,fetcher});
  assert.equal(report[0].outcome,'verified');
  const saved=await kv.get('schedule:cherkasy:1.1:2026-11-18','json');
  assert.deepEqual(saved.outages,expected);
  const result=viewSchedule(saved,date,at);
  assert.equal(result.state,'scheduled_off');
  assert.equal(result.sourceKind,'official_media');
});

test('Nov 18: missing media index uses verified official Telegram',async()=>{
  const kv=new FakeKV();
  const fetcher=async address=>({
    ok:true,text:async()=>address.endsWith('/media')?'<p>Інші новини</p>':telegram
  });
  const report=await syncSchedules({SCHEDULES:kv},{at,fetcher});
  assert.equal(report[0].outcome,'verified_telegram');
  const saved=await kv.get('schedule:cherkasy:1.1:2026-11-18','json');
  assert.deepEqual(saved.outages,expected);
  assert.equal(saved.sourceKind,'official_telegram');
});

test('no implicit schedule if wrong edition/queue or no interval anchor',()=>{
  const publication={date,publishedAt,url};
  assert.throws(()=>parseArticle(article.replace('1.1&nbsp;','2.1&nbsp;'),publication),/1.1/);
  assert.throws(()=>parseArticle(article.replace(/Години відсутності електропостачання по області \(крім[^)]*\):/,
    'Графік без уточнення годин'),publication),/перелік годин|години/);
});
