/** Read-only fallback for the publicly viewable official Черкасиобленерго Telegram channel.
 * This is NOT the private phone-verified Telegram chatbot. No account, bot token
 * or Telegram user data are needed. Reject messages without an attributable
 * post, timestamp, target day and exact 1.1 outages.
 */
import {QUEUE, htmlToText, parseQueueIntervals, targetDateFromTitle} from './cherkasy.mjs';

export const OFFICIAL_TELEGRAM = 'https://t.me/s/pat_cherkasyoblenergo';
const MAX_POST_DISTANCE_MS = 48 * 60 * 60 * 1000;

function kyivDateTime(date) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
  });
  const p=Object.fromEntries(fmt.formatToParts(date)
    .filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
  return p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute+':'+p.second;
}

function targetDate(text,publishedAtLocal) {
  // Updates and normal titled posts.
  const title=text.match(/(?:оновлено\s+|оновлення\s+)?графік[а]?\s+погодинних\s+відключень\s*\(гпв\)\s*на\s+(\d{1,2}\s+[а-яіїєґ]+)/iu);
  if(title)return targetDateFromTitle(
    'Графік погодинних відключень (ГПВ) на '+title[1],publishedAtLocal);
  // Typical posts start with "17 листопада з 00:00 до 24:00 у Черкаській
  // області будуть застосовані графіки погодинних відключень (ГПВ)".
  const intro=text.match(/(\d{1,2}\s+[а-яіїєґ]+)\s+з\s+\d{2}:\d{2}\s+до\s+\d{2}:\d{2}\s+у\s+Черкаській\s+області\s+будуть\s+застосовані\s+графіки\s+погодинних\s+відключень\s*\(гпв\)/iu);
  return intro?targetDateFromTitle(
    'Графік погодинних відключень (ГПВ) на '+intro[1],publishedAtLocal):null;
}

/** Read separate posts from the channel's public /s/ HTML page. */
export function parseTelegramChannel(html,{at=new Date(),queue=QUEUE}={}) {
  const source=String(html);
  const wrap=/<div\b(?=[^>]*\bclass=["'][^"']*\btgme_widget_message_wrap\b)[^>]*>/gi;
  const starts=[...source.matchAll(wrap)].map(m=>m.index);
  const results=[];
  for(let i=0;i<starts.length;i++){
    const chunk=source.slice(starts[i],starts[i+1]??source.length);
    const post=chunk.match(/\bdata-post=["'](pat_cherkasyoblenergo\/\d+)["']/i)?.[1];
    if(!post)continue;
    const rawTime=chunk.match(/<time\b[^>]*\bdatetime=["']([^"']+)["']/i)?.[1];
    const millis=Date.parse(rawTime??'');
    if(!Number.isFinite(millis)||millis>at.getTime()+60_000)continue;
    const match=chunk.match(/<div\b(?=[^>]*\bclass=["'][^"']*\btgme_widget_message_text\b)[^>]*>([\s\S]*?)<\/div>/i);
    if(!match)continue;
    const text=htmlToText(match[1]);
    if(!/Години\s+відсутності\s+електропостачання\s*:/iu.test(text))continue;
    const publishedAtLocal=kyivDateTime(new Date(millis));
    const date=targetDate(text,publishedAtLocal);
    if(!date||Math.abs(millis-Date.parse(date+'T12:00:00Z'))>MAX_POST_DISTANCE_MS)continue;
    const anchor=text.search(/Години\s+відсутності\s+електропостачання\s*:/iu);
    const rows=text.slice(anchor).split('\n');
    const row=rows.find(line=>new RegExp('^\\s*'+queue.replace('.','\\.')+'\\s+').test(line));
    if(!row)continue;
    try{
      results.push({
        region:'cherkasy',queue,date,timezone:'Europe/Kyiv',
        publishedAtLocal,sourceUrl:'https://t.me/'+post,
        sourceKind:'official_telegram',
        outages:parseQueueIntervals(row,queue)
      });
    }catch{
      // Invalid or overlapping intervals must never be treated as valid data.
    }
  }
  return results;
}

export function newestTelegramForDate(items,date) {
  return items.filter(item=>item.date===date)
    .sort((a,b)=>b.publishedAtLocal.localeCompare(a.publishedAtLocal)
      ||b.sourceUrl.localeCompare(a.sourceUrl))[0]??null;
}
