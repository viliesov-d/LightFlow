import { landingResponse } from './landing.mjs';
import { manifestResponse, touchIconResponse } from './app-assets.mjs';
import { groupDay, minuteOf } from './periods.mjs';

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
    checkedAt: null, publishedAtLocal: null, outages: null,
    nextChangeLocal: null, reason: 'not_checked'
  };
  if (!record || record.date !== date) return baseline;

  const checkedMs = Date.parse(record.checkedAt);
  const ageMs = at.getTime() - checkedMs;
  const base = {
    ...baseline,
    checkedAt: record.checkedAt,
    sourceUrl: record.sourceUrl ?? null,
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
export async function syncSchedules(env, {at = new Date(), fetcher = fetch} = {}) {
  if (!env?.SCHEDULES) throw new Error('Missing Cloudflare KV binding SCHEDULES');

  const index = parseMediaIndex(await fetchText(fetcher, `${SOURCE_BASE}/media`));
  if (index.length === 0) throw new Error('No timetable announcements parsed from source index');

  const today = kyivClock(at).date;
  const days = [today, tomorrowOf(today)];
  const result = [];
  for (const date of days) {
    const key = keyFor(date);
    const previous = await env.SCHEDULES.get(key, 'json');
    const latest = newestPublicationForDate(index, date);
    const checkedAt = at.toISOString();

    if (!latest) {
      // If it vanishes from the recent list, never overwrite an earlier verified schedule.
      if (previous?.kind === 'schedule') {
        result.push({date, outcome: 'retained_previous_until_stale'});
      } else {
        await env.SCHEDULES.put(key, JSON.stringify({
          kind: 'unknown', reason: 'not_found_in_recent_publications',
          region: REGION, queue: QUEUE, date, checkedAt
        }), {expirationTtl: 604800});
        result.push({date, outcome: 'not_found'});
      }
      continue;
    }

    try {
      const article = await fetchText(fetcher, latest.url);
      const schedule = parseArticle(article, latest, QUEUE);
      const revision = previous?.sourceUrl === schedule.sourceUrl
        ? (previous.revision ?? 1)
        : (previous?.revision ?? 0) + 1;

      const record = {...schedule, kind: 'schedule', revision, checkedAt};
      await env.SCHEDULES.put(key, JSON.stringify(record), {expirationTtl: 604800});

      if (previous?.sourceUrl !== schedule.sourceUrl) {
        const historicalKey = `version:${REGION}:${QUEUE}:${date}:${encodeURIComponent(schedule.publishedAtLocal)}`;
        await env.SCHEDULES.put(historicalKey, JSON.stringify(record), {expirationTtl: 2592000});
      }
      result.push({date, outcome: 'verified', revision});
    } catch (error) {
      // An announced new revision cannot silently fall back to the old one.
      if (previous?.sourceUrl !== latest.url) {
        await env.SCHEDULES.put(key, JSON.stringify({
          kind: 'unknown', region: REGION, queue: QUEUE, date, checkedAt,
          sourceUrl: latest.url, publishedAtLocal: latest.publishedAt,
          reason: 'new_revision_not_verified', revision: previous?.revision ?? 0
        }), {expirationTtl: 604800});
      }
      result.push({date, outcome: 'source_error'});
      console.error('LightFlow verification failed', date, String(error));
    }
  }
  return result;
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
          await recordMonitor(env, at, {status: 'ok', outcomes});
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
