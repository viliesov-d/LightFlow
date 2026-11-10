import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMediaIndex, newestPublicationForDate, parseArticle, parseQueueIntervals, fetchLatestSchedule, targetDateFromTitle} from '../src/cherkasy.mjs';

const original = `
<a href="/media/hrafik-pohodynnykh-vidklyuchen-hpv-na-10-lystopada"><span>Графік погодинних відключень (ГПВ) на 10 листопада</span></a>
<p>09.11.2026 20:58</p>`;
const updated = `
<a href="/media/onovleno-hrafik-pohodynnykh-vidklyuchen-hpv-na-10-lystopada">Оновлено графік погодинних відключень (ГПВ) на 10 листопада</a>
<div>09.11.2026 23:06</div>`;
const indexHtml = `<html><body>${updated}${original}<a href="/media/gop-10">ГОП для промисловості</a><p>09.11.2026 23:59</p></body></html>`;
const article = `<html><body><h1>Оновлено графік погодинних відключень (ГПВ) на 10 листопада</h1>
  <p>Години відсутності електропостачання:</p>
  <p><strong>1.1</strong>&nbsp;00:00 - 02:00, 04:00 - 08:00, 10:00 - 14:00, 16:00 - 20:00, 22:00 - 24:00</p>
  <p>1.2&nbsp;01:00 - 03:00</p></body></html>`;

test('reads latest official publication rather than the original', () => {
  const publications = parseMediaIndex(indexHtml);
  assert.equal(publications.length, 2);
  const picked = newestPublicationForDate(publications, '2026-11-10');
  assert.match(picked.url, /onovleno-hrafik/);
  assert.equal(picked.publishedAt, '2026-11-09T23:06:00');
  assert.equal(picked.date, '2026-11-10');
});

test('extracts official updated 1.1 schedule and handles 24:00', () => {
  const pub = newestPublicationForDate(parseMediaIndex(indexHtml), '2026-11-10');
  const schedule = parseArticle(article, pub);
  assert.deepEqual(schedule.outages, [
    {start:'00:00',end:'02:00'}, {start:'04:00',end:'08:00'},
    {start:'10:00',end:'14:00'}, {start:'16:00',end:'20:00'},
    {start:'22:00',end:'24:00'}
  ]);
});

test('parses half-hour outages', () => {
  assert.deepEqual(parseQueueIntervals('1.1 07:00 - 10:00, 11:30 – 16:00'), [
    {start:'07:00',end:'10:00'}, {start:'11:30',end:'16:00'}
  ]);
});

test('rejects invalid ranges, overlap and unrecognized schedule rather than guessing', () => {
  assert.throws(() => parseQueueIntervals('1.1 23:00 - 24:30'), /Неприпустимий/);
  assert.throws(() => parseQueueIntervals('1.1 11:00 - 12:00, 11:30 - 13:00'), /перетинаються/);
  assert.throws(() => parseQueueIntervals('1.1 08:00 - 07:00'), /Некоректний/);
  assert.throws(() => parseQueueIntervals('1.1 невідомий графік'), /Нерозпізнаний/);
});

test('handles year rollover in article title', () => {
  assert.equal(targetDateFromTitle('Графік погодинних відключень (ГПВ) на 1 січня', '2026-12-31T20:00:00'), '2027-01-01');
});

test('network pipeline returns null for unpublished day, never an empty schedule', async () => {
  const fetcher = async url => ({ok: true, text: async () => indexHtml});
  assert.equal(await fetchLatestSchedule({date: '2026-11-11', fetcher}), null);
});

test('network pipeline loads updated article', async () => {
  const fetched = [];
  const fetcher = async url => {fetched.push(url); return {ok:true,text:async()=>url.endsWith('/media')?indexHtml:article};};
  const result = await fetchLatestSchedule({date:'2026-11-10',fetcher});
  assert.equal(fetched.length,2);
  assert.equal(result.outages.length,5);
});
