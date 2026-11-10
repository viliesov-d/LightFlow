// LightFlow — Scriptable (iOS): small status and large grouped schedule.
// Вставте цей скрипт у безкоштовний застосунок Scriptable.
// Джерело даних — лише онлайн API; файловий кеш відсутній.
const API = "https://lightflow-api.lightflow-viliesov.workers.dev/api/v1/schedule";
const SITE = "https://lightflow-api.lightflow-viliesov.workers.dev/";
const BLUE = new Color("#152236");
const DARK = new Color("#101b2c");
const PALE = new Color("#b9c9db");
const RED = new Color("#fa8388");
const GREEN = new Color("#55e0a8");
const WHITE = new Color("#f9fbff");

function dateInKyiv(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const item = name => parts.find(part => part.type === name)?.value;
  return item("year") + "-" + item("month") + "-" + item("day");
}
function minutes(value) {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return NaN;
  const [h, m] = value.split(":").map(Number);
  if (m > 59 || h > 24 || (h === 24 && m !== 0)) return NaN;
  return h * 60 + m;
}
function valid(payload) {
  if (!payload || payload.kind !== "schedule" ||
      !["scheduled_on", "scheduled_off"].includes(payload.state) ||
      !Array.isArray(payload.periods) || payload.periods.length < 1 ||
      !Array.isArray(payload.outages) || payload.date !== dateInKyiv(new Date())) return false;

  const checked = Date.parse(payload.checkedAt);
  if (!Number.isFinite(checked) || Date.now() - checked > 20 * 60 * 1000 ||
      checked - Date.now() > 60 * 1000) return false;

  let cursor = 0;
  for (const period of payload.periods) {
    const start = minutes(period.start), end = minutes(period.end);
    if (start !== cursor || end <= start || end > 1440 ||
      !["scheduled_on", "scheduled_off"].includes(period.state)) return false;
    cursor = end;
  }
  return cursor === 1440;
}
function addText(stack, value, color, size, bold = false) {
  const item = stack.addText(value);
  item.textColor = color;
  item.font = bold ? Font.boldSystemFont(size) : Font.systemFont(size);
  item.lineLimit = 1;
  item.minimumScaleFactor = 0.65;
  return item;
}
function decorate(widget) {
  widget.backgroundColor = DARK;
  widget.url = SITE;
  widget.setPadding(13, 13, 13, 13);
  // Scriptable/iOS controls exact refresh timing. This is a request, not a guarantee.
  widget.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
}
function addHeader(widget, large = false) {
  const header = widget.addStack();
  header.layoutHorizontally();
  addText(header, "⚡ LightFlow", WHITE, large ? 18 : 14, true);
  header.addSpacer();
  addText(header, "1.1", PALE, large ? 13 : 11, true);
  widget.addSpacer(large ? 9 : 7);
}
function addUnknown(widget, large, message) {
  addText(widget, "Статус невідомий", WHITE, large ? 18 : 15, true);
  widget.addSpacer(6);
  const row = widget.addText(message);
  row.textColor = PALE;
  row.font = Font.systemFont(large ? 12 : 10);
  row.lineLimit = 3;
  row.minimumScaleFactor = 0.8;
  widget.addSpacer();
  addText(widget, "Лише за графіком", PALE, 10);
}
function addStatus(widget, data, large) {
  const off = data.state === "scheduled_off";
  const status = addText(widget, off ? "● Відключення" : "● Світло має бути",
    off ? RED : GREEN, large ? 20 : 15, true);
  status.lineLimit = 1;
  widget.addSpacer(4);
  const hint = data.nextChangeLocal && data.nextChangeLocal !== "24:00"
    ? "Зміна за графіком о " + data.nextChangeLocal
    : "До кінця доби без змін";
  addText(widget, hint, PALE, large ? 12 : 10);
}
function drawPeriods(widget, periods) {
  widget.addSpacer(14);
  addText(widget, "Графік на сьогодні", WHITE, 14, true);
  widget.addSpacer(8);
  // У великому віджеті кожен інтервал показано окремим кольоровим рядком.
  for (const period of periods) {
    const off = period.state === "scheduled_off";
    const row = widget.addStack();
    row.layoutHorizontally();
    row.centerAlignContent();
    row.backgroundColor = off ? new Color("#552d3a") : new Color("#1c4e40");
    row.cornerRadius = 6;
    row.setPadding(4, 7, 4, 7);
    addText(row, period.start + "–" + period.end, WHITE, 11, true);
    row.addSpacer();
    addText(row, off ? "Без світла" : "Є світло", off ? RED : GREEN, 10);
    widget.addSpacer(3);
  }
}
async function run() {
  const family = config.widgetFamily || "small";
  const large = family === "large";
  const widget = new ListWidget();
  decorate(widget);
  addHeader(widget, large);
  try {
    const req = new Request(API);
    req.timeoutInterval = 12;
    const data = await req.loadJSON();
    if (!valid(data)) {
      addUnknown(widget, large, "Немає актуального перевіреного графіка.");
    } else {
      addStatus(widget, data, large);
      if (large) drawPeriods(widget, data.periods);
      else {
        widget.addSpacer();
        addText(widget, "Черкаська область", PALE, 10);
      }
    }
  } catch (error) {
    addUnknown(widget, large, "Інтернет або сервер недоступний.");
  }
  Script.setWidget(widget);
  if (!config.runsInWidget) {
    if (large) await widget.presentLarge();
    else await widget.presentSmall();
  }
  Script.complete();
}
await run();
