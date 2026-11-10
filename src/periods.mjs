/** Convert verified outage intervals into an exact, gap-free, grouped 24-hour day. */
export function minuteOf(value, {allowEndOfDay = false} = {}) {
  if (!/^\d{2}:\d{2}$/.test(value)) throw new Error('Неправильний формат часу');
  const [hour, minute] = value.split(':').map(Number);
  if (minute > 59 || hour > 24 || (hour === 24 && (minute !== 0 || !allowEndOfDay))) {
    throw new Error('Неприпустимий час');
  }
  return hour * 60 + minute;
}

function clockOf(total) {
  return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
}

export function groupDay(outages) {
  if (!Array.isArray(outages)) throw new Error('Немає перевіреного списку відключень');
  const intervals = outages.map(interval => {
    const start = minuteOf(interval.start);
    const end = minuteOf(interval.end, {allowEndOfDay: true});
    if (start >= end) throw new Error('Неправильний інтервал відключення');
    return {start, end};
  }).sort((a, b) => a.start - b.start);
  for (let i = 1; i < intervals.length; i++) {
    if (intervals[i].start < intervals[i - 1].end) {
      throw new Error('Перетин інтервалів відключення');
    }
  }

  const spans = [];
  const add = (start, end, state) => {
    if (start >= end) return;
    const last = spans.at(-1);
    if (last && last.state === state && last.end === start) {
      last.end = end;
    } else {
      spans.push({start, end, state});
    }
  };
  let cursor = 0;
  for (const interval of intervals) {
    add(cursor, interval.start, 'scheduled_on');
    add(interval.start, interval.end, 'scheduled_off');
    cursor = interval.end;
  }
  add(cursor, 1440, 'scheduled_on');
  return spans.map(item => ({
    start: clockOf(item.start),
    end: clockOf(item.end),
    state: item.state,
    durationMinutes: item.end - item.start
  }));
}
