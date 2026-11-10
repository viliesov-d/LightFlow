import {SOURCE_BASE, parseMediaIndex, newestPublicationForDate, parseArticle} from '../src/cherkasy.mjs';
import {kyivClock} from '../src/worker.mjs';

const response = await fetch(`${SOURCE_BASE}/media`, {
  headers: {Accept: 'text/html'}
});
if (!response.ok) throw new Error(`Медіацентр повернув HTTP ${response.status}`);
const items = parseMediaIndex(await response.text());
console.log('Official publications parsed:', items.length);
if (!items.length) throw new Error('Parser did not recognize published announcements');
const today = kyivClock().date;
const latest = newestPublicationForDate(items, today);
console.log('Today (Kyiv):', today);
console.log('Latest publication:', latest?.url ?? 'not listed');
if (latest) {
  const articleResponse = await fetch(latest.url);
  if (!articleResponse.ok) throw new Error(`Публікація повернула HTTP ${articleResponse.status}`);
  const schedule = parseArticle(await articleResponse.text(), latest);
  console.log('Queue 1.1 validated: ', schedule.date, schedule.outages.length, 'intervals');
}
