import { landingResponse } from './landing.mjs';
import { manifestResponse, touchIconResponse } from './app-assets.mjs';
import { groupDay, minuteOf } from './periods.mjs';
import {OFFICIAL_TELEGRAM,parseTelegramChannel,newestTelegramForDate} from './telegram.mjs';

import {
  SOURCE_BASE,
  QUEUE,
  parseMediaIndex,
  newestPublicationForDate,
  parseArticle
} from './cherkasy.mjs';

const REGION = 'cherkasy';
const MONITOR_KEY = 'monitor:cherkasy:1.1';
const MONITOR_INTERVAL_MS = 20 * 60 * 1000;
const FRESH_FOR_MS = 20 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const pad = value => String(value).padStart(2, '0');

export function kyivClock(at = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
  const parts = Object.fromEntries(formatter.formatToParts(at).map(part => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute)
  };
}

export function tomorrowOf(date) {
  const tomorrow = new Date(`${date}T12:00:00Z`);
  tomorrow.setTime(tomorrow.getTime() + DAY_MS);
  return tomorrow.toISOString().slice(0, 10);
}

const keyFor = date => `schedule:${REGION}:${QUEUE}:${date}`;
const minutesOf = time => {
  return minuteOf(time, {allowEndOfDay: true});
};

export function viewSchedule(record, date, at = new Date()) {
  const baseline = {
    region: REGION, queue: QUEUE, date, timezone: 'Europe/Kyiv',
    kind: 'unknown', state: 'unknown', sourceUrl: null, periods: null,
    checkedAt: null, publishedAtLocal: null, sourceKind: null, outages: null,
    nextChangeLocal: null, reason: 'not_checked'
  };
  if (!record || record.date !== date) return baseline;

  const checkedMs = Date.parse(record.checkedAt);
  const ageMs = at.getTime() - checkedMs;
  const base = {
    ...baseline,
    checkedAt: record.checkedAt,
    sourceUrl: record.sourceUrl ?? null,
    sourceKind: record.sourceKind ?? 'official_media',
    publishedAtLocal: record.publishedAtLocal ?? null
  };
  if (!Number.isFinite(checkedMs) || ageMs < -60_000 || ageMs > FRESH_FOR_MS) {
    return {...base, reason: 'stale'};
  }
  if (record.kind !== 'schedule') {
    return {...base, reason: record.reason ?? 'not_published'};
  }
  if (!Array.isArray(record.outages)) return {...base, reason: 'invalid_data'};
  const outages = record.outages;
  let periods;
  try {
    periods = groupDay(outages);
  } catch {
    return {...base, reason: 'invalid_data'};
  }
  const totalOutageMinutes = periods.filter(p => p.state === 'scheduled_off')
    .reduce((sum, period) => sum + period.durationMinutes, 0);
  const clock = kyivClock(at);
  if (date !== clock.date) {
    return {
      ...base, kind: 'schedule', state: 'future_schedule', reason: null,
      outages, periods, totalOutageMinutes
    };
  }
  const period = periods.find(item =>
    clock.minutes >= minutesOf(item.start) && clock.minutes < minutesOf(item.end)
  );
  const nextChangeLocal = periods.find(item => minutesOf(item.end) > clock.minutes)?.end ?? null;
  return {
    ...base, kind: 'schedule', state: period?.state ?? 'unknown',
    reason: null, outages, periods, totalOutageMinutes, nextChangeLocal
  };
}

async function fetchText(fetcher, url) {
  const response = await fetcher(url, {
    headers: { Accept: 'text/html; charset=utf-8' }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.text();
}

/**
 * Runs only in a scheduled Worker; never in a public GET request.
 * Only confirmed new content may replace a verified schedule.
 */
/**
 * Resolve today's and tomorrow's 1.1 schedules from TWO verified first-party sources.
 *
 * Priority: exact official media article first; if unavailable or missing,
 * fall back to the company's public Telegram channel (not its phone-verified bot).
 * A failed newer media revision is never replaced by an older Telegram post.
 * Both paths enforce the same queue/date/interval validation.
 */
export async function syncSchedules(env,{at=new Date(),fetcher=fetch}={}) {
  if(!env?.SCHEDULES)throw new Error('Missing Cloudflare KV binding SCHEDULES');

  let index=[], mediaError=null;
  try{
    index=parseMediaIndex(await fetchText(fetcher,SOURCE_BASE+'/media'));
  }catch(error){
    mediaError=error;
    console.error('LightFlow media index unavailable:',String(error));
  }
  let telegramRequest=null;
  async function telegramPosts(){
    if(!telegramRequest){
      telegramRequest=fetchText(fetcher,OFFICIAL_TELEGRAM)
        .then(html=>parseTelegramChannel(html,{at}))
        .catch(error=>{
          console.error('LightFlow official Telegram fallback unavailable:',String(error));
          return [];
        });
    }
    return telegramRequest;
  }
  const dates=[kyivClock(at).date,tomorrowOf(kyivClock(at).date)];
  const report=[];
  for(const date of dates){
    const key=keyFor(date);
    const previous=await env.SCHEDULES.get(key,'json');
    const latest=newestPublicationForDate(index,date);
    const checkedAt=at.toISOString();
    let mediaSchedule=null, articleError=null;
    if(latest){
      try{
        mediaSchedule=parseArticle(await fetchText(fetcher,latest.url),latest,QUEUE);
        mediaSchedule.sourceKind='official_media';
      }catch(error){
        articleError=error;
        console.error('LightFlow official article invalid:',latest.url,String(error));
      }
    }
    // A publication that is present and parseable remains the preferred source.
    // We never treat an absent media-index entry as proof that the day is outage-free.
    let selected=mediaSchedule,origin='media';
    if(!selected){
      const messages=await telegramPosts();
      const alternate=newestTelegramForDate(messages,date);
      // If the site references a newer (but unparseable) revision, don't show
      // an older Telegram schedule as if it superseded that revision.
      if(alternate && (!latest || alternate.publishedAtLocal>=latest.publishedAt)){
        selected=alternate;origin='telegram';
      }
    }
    if(selected){
      const changed=previous?.sourceUrl!==selected.sourceUrl ||
        JSON.stringify(previous?.outages)!==JSON.stringify(selected.outages);
      const revision=(previous?.revision??0)+(changed?1:0);
      const record={...selected,kind:'schedule',revision:Math.max(1,revision),checkedAt};
      await env.SCHEDULES.put(key,JSON.stringify(record),{expirationTtl:604800});
      if(changed){
        const historyKey='version:'+REGION+':'+QUEUE+':'+date+':'+
          encodeURIComponent(selected.publishedAtLocal);
        await env.SCHEDULES.put(historyKey,JSON.stringify(record),{expirationTtl:2592000});
      }
      report.push({date,outcome:origin==='telegram'?'verified_telegram':'verified',revision:record.revision});
      continue;
    }

    const newRevisionUnverified=latest && articleError &&
      previous?.sourceUrl!==latest.url;
    if(newRevisionUnverified){
      await env.SCHEDULES.put(key,JSON.stringify({
        kind:'unknown',region:REGION,queue:QUEUE,date,checkedAt,
        sourceUrl:latest.url,sourceKind:'official_media',
        publishedAtLocal:latest.publishedAt,
        reason:'new_revision_not_verified',revision:previous?.revision??0
      }),{expirationTtl:604800});
      report.push({date,outcome:'source_error'});
    }else if(previous?.kind==='schedule'){
      // Keep the old record for historical continuity but DO NOT update checkedAt:
      // viewSchedule automatically makes it unknown after 20 minutes.
      report.push({date,outcome:'retained_previous_until_stale'});
    }else{
      const reason=mediaError?'source_unavailable':
        articleError?'source_error':'not_found_in_recent_publications';
      await env.SCHEDULES.put(key,JSON.stringify({
        kind:'unknown',reason,region:REGION,queue:QUEUE,date,checkedAt
      }),{expirationTtl:604800});
      report.push({date,outcome:reason==='not_found_in_recent_publications'?'not_found':'source_error',
        ...(mediaError?{reason:classifySyncError(mediaError)}:{})});
    }
  }
  return report;
}

// Persist only a sparse heartbeat, to stay within Cloudflare KV Free write limits.
async function recordMonitor(env, at, report) {
  if (!env?.SCHEDULES) return;
  try {
    const previous = await env.SCHEDULES.get(MONITOR_KEY, 'json');
    const ageMs = at.getTime() - Date.parse(previous?.checkedAt);
    const changed = previous?.status !== report.status ||
      previous?.reason !== (report.reason ?? null);
    if (changed || !Number.isFinite(ageMs) || ageMs >= MONITOR_INTERVAL_MS) {
      await env.SCHEDULES.put(MONITOR_KEY, JSON.stringify({
        checkedAt: at.toISOString(), status: report.status,
        reason: report.reason ?? null,
        outcomes: report.outcomes ?? null
      }), {expirationTtl: 604800});
    }
  } catch (error) {
    console.error('LightFlow monitor storage failed:', String(error));
  }
}

function classifySyncError(error) {
  const message = String(error ?? '').toLowerCase();
  if (/http\s*(?:401|403|429|5\d\d)/.test(message)) return 'source_http_error';
  if (message.includes('fetch') || message.includes('network') || message.includes('connect')) return 'source_network_error';
  if (message.includes('no timetable')) return 'source_index_unrecognized';
  return 'sync_failed';
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

export function createWorker({now = () => new Date(), fetcher = fetch} = {}) {
  return {
    async fetch(request, env) {
      if (request.method === 'OPTIONS') {
        return new Response(null, {status: 204, headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400'
        }});
      }
      if (request.method !== 'GET') return jsonResponse({error: 'method_not_allowed'}, 405);

      const url = new URL(request.url);
      if (url.pathname === '/') return landingResponse();
      if (url.pathname === '/manifest.webmanifest') return manifestResponse();
      if (url.pathname === '/apple-touch-icon.png') return touchIconResponse();
      const at = now();
      if (url.pathname === '/health') {
        if (!env?.SCHEDULES) return jsonResponse({
          service: 'lightflow', status: 'not_configured', serverTime: at.toISOString()
        }, 503);
        try {
          const monitor = await env.SCHEDULES.get(MONITOR_KEY, 'json');
          return jsonResponse({
            service: 'lightflow', status: 'configured', serverTime: at.toISOString(),
            sync: monitor ?? {status: 'not_seen'}
          });
        } catch (error) {
          console.error('LightFlow health KV read failed:', String(error));
          return jsonResponse({service: 'lightflow', status: 'storage_unavailable'}, 503);
        }
      }
      if (url.pathname !== '/api/v1/schedule') return jsonResponse({error: 'not_found'}, 404);

      if (!env?.SCHEDULES) return jsonResponse({error: 'storage_not_configured'}, 503);

      const today = kyivClock(at).date;
      const date = url.searchParams.get('date') ?? today;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return jsonResponse({error: 'invalid_date'}, 400);
      }
      if (![today, tomorrowOf(today)].includes(date)) {
        return jsonResponse({error: 'date_out_of_window', allowed: [today, tomorrowOf(today)]}, 400);
      }

      try {
        const record = await env.SCHEDULES.get(keyFor(date), 'json');
        return jsonResponse(viewSchedule(record, date, at));
      } catch (error) {
        console.error('LightFlow KV read failed', String(error));
        return jsonResponse({error: 'storage_unavailable'}, 503);
      }
    },
    async scheduled(_controller, env, ctx) {
      const at = now();
      ctx.waitUntil((async () => {
        try {
          const outcomes = await syncSchedules(env, {at, fetcher});
          const failed=outcomes.length>0 && outcomes.every(item=>item.outcome==='source_error');
          await recordMonitor(env,at,{
            status:failed?'error':'ok',
            reason:failed?(outcomes[0].reason??'source_unavailable'):null,
            outcomes
          });
        } catch (error) {
          console.error('LightFlow cron sync failed:', String(error));
          await recordMonitor(env, at, {
            status: 'error', reason: classifySyncError(error)
          });
        }
      })());
    }
  };
}

export default createWorker();
