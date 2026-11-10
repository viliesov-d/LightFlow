/** LightFlow: Черкасиобленерго publication adapter (no dependencies). */
export const SOURCE_BASE = 'https://www.cherkasyoblenergo.com';
export const QUEUE = '1.1';

const MONTHS = new Map([
  ['січня', 1], ['лютого', 2], ['березня', 3], ['квітня', 4],
  ['травня', 5], ['червня', 6], ['липня', 7], ['серпня', 8],
  ['вересня', 9], ['жовтня', 10], ['листопада', 11], ['грудня', 12]
]);

const pad = n => String(n).padStart(2, '0');

export function htmlToText(html) {
  return String(html)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<\s*br\b[^>]*\/?\s*>/gi, '\n')
    .replace(/<\/?(?:p|div|h[1-6]|li|section|article|tr|ul|ol)\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:nbsp|#160|#xa0);/gi, ' ')
    .replace(/&(?:amp|quot|apos|lt|gt);/gi, entity => ({'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>'})[entity.toLowerCase()] ?? entity)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/[\t\r\f\v ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function parsePublicationTime(input) {
  const match = input.match(/(\d{2})\.(\d{2})\.(\d{4})\s+([01]?\d|2[0-3]):([0-5]\d)/);
  if (!match) return null;
  const [, day, month, year, hour, minute] = match;
  const date = `${year}-${month}-${day}`;
  if (new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date) return null;
  return `${date}T${pad(hour)}:${minute}:00`;
}

export function targetDateFromTitle(title, publishedAt) {
  const match = String(title).toLowerCase().match(/(?:^|\s)на\s+(\d{1,2})\s+([а-яіїєґ]+)/u);
  if (!match || !MONTHS.has(match[2]) || !publishedAt) return null;
  const day = Number(match[1]);
  const month = MONTHS.get(match[2]);
  const pubYear = Number(publishedAt.slice(0, 4));
  const pubMonth = Number(publishedAt.slice(5, 7));
  let year = pubYear;
  if (pubMonth === 12 && month === 1) year++;
  if (pubMonth === 1 && month === 12) year--;
  const date = `${year}-${pad(month)}-${pad(day)}`;
  return new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date ? date : null;
}

export function parseMediaIndex(html) {
  const items = [];
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a\s*>/gi;
  for (const match of String(html).matchAll(re)) {
    let link;
    try { link = new URL(match[1].replace(/&amp;/gi, '&'), SOURCE_BASE); }
    catch { continue; }
    if (!['www.cherkasyoblenergo.com', 'cherkasyoblenergo.com'].includes(link.hostname)) continue;
    if (!/^\/media\/[^/]+/.test(link.pathname)) continue;
    const title = htmlToText(match[2]).replace(/\s+/g, ' ');
    if (!/графік погодинних відключень\s*\(гпв\)\s*на\s+\d{1,2}\s+[а-яіїєґ]+/iu.test(title)) continue;
    const pos = match.index + match[0].length;
    const nearby = htmlToText(html.slice(pos, pos + 600));
    const publishedAt = parsePublicationTime(nearby);
    const date = targetDateFromTitle(title, publishedAt);
    if (date && publishedAt) items.push({date, title, publishedAt, url: link.origin + link.pathname});
  }
  return [...new Map(items.map(item => [item.url, item])).values()];
}

export function newestPublicationForDate(items, date) {
  return items.filter(item => item.date === date)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0] ?? null;
}

function timeToMinutes(time, allow24 = false) {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) throw new Error('Неправильний формат години');
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute > 59 || hour > 24 || (hour === 24 && (!allow24 || minute !== 0))) {
    throw new Error(`Неприпустимий час: ${time}`);
  }
  return hour * 60 + minute;
}

export function parseQueueIntervals(line, queue = QUEUE) {
  const match = String(line).trim().match(/^([1-6]\.[12])\s+(.+)$/u);
  if (!match || match[1] !== queue) throw new Error(`Не знайдено чергу ${queue}`);
  const parts = match[2].split(',').map(x => x.trim());
  if (!parts.length || parts.some(x => !x)) throw new Error('Порожній інтервал');
  const outages = parts.map(part => {
    const range = part.match(/^(\d{2}:\d{2})\s*[-–—]\s*(\d{2}:\d{2})$/u);
    if (!range) throw new Error(`Нерозпізнаний інтервал: ${part}`);
    const startMinute = timeToMinutes(range[1]);
    const endMinute = timeToMinutes(range[2], true);
    if (startMinute >= endMinute) throw new Error(`Некоректний інтервал: ${part}`);
    return {start: range[1], end: range[2], startMinute, endMinute};
  });
  outages.sort((a, b) => a.startMinute - b.startMinute);
  if (outages.some((interval, i) => i > 0 && outages[i - 1].endMinute > interval.startMinute)) {
    throw new Error('Інтервали перетинаються');
  }
  return outages.map(({start, end}) => ({start, end}));
}

export function parseArticle(html, publication, queue = QUEUE) {
  const text = htmlToText(html);
  const heading = text.match(/(?:Оновлено\s+)?Графік погодинних відключень\s*\(ГПВ\)\s*на\s+\d{1,2}\s+[а-яіїєґ]+/iu)?.[0] ?? '';
  const articleDate = targetDateFromTitle(heading, publication.publishedAt);
  if (!articleDate || articleDate !== publication.date) throw new Error('Дата статті не відповідає даті публікації');
  const anchor = text.toLowerCase().indexOf('години відсутності електропостачання:');
  if (anchor < 0) throw new Error('Не знайдено офіційний перелік годин');
  const rows = text.slice(anchor).split('\n');
  const row = rows.find(line => new RegExp(`^\\s*${queue.replace('.', '\\.')}\\s+`).test(line));
  if (!row) throw new Error(`Чергу ${queue} не знайдено в статті`);
  return {
    region: 'cherkasy', queue, date: publication.date, timezone: 'Europe/Kyiv',
    publishedAtLocal: publication.publishedAt, sourceUrl: publication.url,
    outages: parseQueueIntervals(row, queue)
  };
}

export async function fetchLatestSchedule({date, fetcher = fetch, queue = QUEUE} = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) throw new Error('Потрібна дата YYYY-MM-DD');
  const response = await fetcher(`${SOURCE_BASE}/media`);
  if (!response.ok) throw new Error(`Медіацентр повернув HTTP ${response.status}`);
  const publication = newestPublicationForDate(parseMediaIndex(await response.text()), date);
  if (!publication) return null; // Не вважати відсутність публікації відсутністю відключень
  const articleResponse = await fetcher(publication.url);
  if (!articleResponse.ok) throw new Error(`Стаття повернула HTTP ${articleResponse.status}`);
  return parseArticle(await articleResponse.text(), publication, queue);
}
