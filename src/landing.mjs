/** LightFlow online homepage with grouped electricity intervals. */
const HTML = String.raw`<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0c1422">
  <meta name="description" content="LightFlow — онлайн-графік електропостачання для Черкаської області, черга 1.1.">
  <title>LightFlow — години відключень 1.1</title>
  <style>
    :root { color-scheme:dark; font-family:system-ui,-apple-system,"Segoe UI",sans-serif; background:#0c1422; color:#f5f7ff; }
    * { box-sizing:border-box; }
    body { margin:0; min-height:100vh; padding:30px 16px 36px; background:radial-gradient(ellipse at top, #142139 0, #0c1422 60%); }
    [hidden] { display:none !important; }
    main { max-width:680px; margin:0 auto; }
    header { display:flex; align-items:center; gap:14px; margin:12px 2px 26px; }
    .app-icon { display:grid; place-items:center; flex:none; width:55px; height:55px; border-radius:17px; background:linear-gradient(140deg,#263955,#1b2940); font-size:30px; }
    h1 { margin:0; font-size:28px; font-weight:750; letter-spacing:-.045em; }
    .subtitle { margin-top:3px; font-size:13px; color:#b8c5d9; }
    .panel { border:1px solid #364963; background:linear-gradient(150deg,#1b2b40,#152236); border-radius:26px; padding:22px; box-shadow:0 20px 40px #0002; }
    .status { display:flex; align-items:center; gap:14px; padding:20px 18px; border-radius:20px; border:1px solid #657086; background:#273449; }
    .status.off { background:linear-gradient(125deg,#49303a,#33283a); border-color:#cf6873; }
    .status.on { background:linear-gradient(125deg,#1b5248,#213a43); border-color:#3bb88e; }
    .status-icon { display:grid;place-items:center;flex:none;width:48px;height:48px;border-radius:15px;background:#ffffff16;font-size:28px; }
    .status-kicker { font-size:13px;color:#cbd2e0; }
    #status { font-size:clamp(20px,5vw,27px);line-height:1.22;font-weight:780;letter-spacing:-.035em;margin-top:2px; }
    .status.off #status {color:#ff888d}
    .status.on #status {color:#68e7b1}
    #details {font-size:13px;color:#cbd5e5;line-height:1.45;margin-top:7px}
    .section-title {margin:25px 0 14px;font-size:19px;line-height:1.35;letter-spacing:-.025em;font-weight:700}
    .small-title {font-size:14px;font-weight:600;color:#c9d5e7;margin:0 0 12px}
    .periods {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .period {display:flex;flex-direction:column;justify-content:center;align-items:center;min-width:0;min-height:79px;gap:5px;padding:10px 5px;border-radius:13px;text-align:center; border:1px solid transparent}
    .period.off { background:linear-gradient(135deg,#ff7e84,#ea666c); color:#231820; }
    .period.on { background:linear-gradient(135deg,#50e7ad,#27c88d); color:#10261d; }
    .period.current { box-shadow:inset 0 0 0 2px #172236,0 0 0 2px #f5f9ff; }
    .period-time {font-weight:820;font-size:clamp(10px,3vw,15px);white-space:nowrap;letter-spacing:-.04em;font-variant-numeric:tabular-nums;}
    .period-label {font-size:clamp(10px,2.8vw,13px);font-weight:600;line-height:1.25}
    .legend {display:flex;align-items:center;flex-wrap:wrap;gap:9px 20px;margin:16px 1px 0;color:#c2d0e0;font-size:12px;}
    .legend-item {display:inline-flex;gap:7px;align-items:center}
    .swatch {display:inline-block;width:12px;height:12px;border-radius:4px;flex:none}
    .swatch.off {background:#f47a82}.swatch.on {background:#3bd7a1}
    .summary {display:flex;gap:9px;margin-top:15px}
    .metric { flex:1;background:#243449;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:4px }
    .metric span {color:#b5c6dc;font-size:12px}
    .metric strong {font-size:18px;font-variant-numeric:tabular-nums}
    .divider {height:1px;background:#35485f;margin:22px 0}
    .outage-list {display:grid;gap:8px}
    .outage {display:flex;align-items:center;gap:13px;min-height:51px;border:1px solid #364a62;background:#24344b;border-radius:12px;padding:10px 14px}
    .outage-icon {display:grid;place-items:center;width:29px;height:29px;flex:none;background:#f17b8420;color:#ff868d;border-radius:8px;font-size:17px}
    .outage-time {font-size:17px;font-weight:680;font-variant-numeric:tabular-nums}
    .footer {display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-top:19px}
    .meta {font-size:12px;color:#aebcd1;line-height:1.65}
    button {border:1px solid #68809b;background:#30445c;padding:11px 16px;color:#f8fbff;font:inherit;font-size:13px;font-weight:600;border-radius:12px;cursor:pointer;min-height:42px}
    button:disabled {opacity:.5;cursor:default}
    a {color:#a4ccff;text-decoration:none}a:focus-visible,button:focus-visible {outline:2px solid white;outline-offset:3px}
    nav {display:flex;flex-wrap:wrap;gap:14px;margin:20px 6px;font-size:13px}
    .disclaimer {margin:0 6px;color:#a6b4c8;font-size:12px;line-height:1.65}
    .error {color:#d4deec;font-size:13px;line-height:1.7;padding:14px;background:#25344b;border-radius:12px}
    @media(max-width:370px) {
      body {padding-inline:11px}.panel {padding:14px}.periods {gap:5px}.period {min-height:74px;padding:9px 2px}
      .period-time {font-size:10px}.period-label {font-size:10px}.outage-time {font-size:16px}
    }
    @media(prefers-reduced-motion:no-preference){button{transition:background .2s}button:hover{background:#3b5471}}
  </style>
</head>
<body>
<main>
  <header>
    <div class="app-icon" aria-hidden="true">⚡</div>
    <div>
      <h1>LightFlow</h1>
      <div class="subtitle">Черкаська область · черга 1.1</div>
    </div>
  </header>

  <section class="panel">
    <div class="status" id="status-card" role="status" aria-live="polite">
      <span class="status-icon" id="status-icon" aria-hidden="true">○</span>
      <div>
        <div class="status-kicker">За опублікованим графіком зараз:</div>
        <div id="status">Перевіряємо…</div>
        <div id="details">Отримуємо актуальні дані з сервера.</div>
      </div>
    </div>

    <h2 class="section-title">Графік електропостачання на сьогодні</h2>
    <p id="day" class="small-title"></p>

    <div id="available" hidden>
      <div class="periods" id="periods" aria-label="Послідовність групованих інтервалів на всю добу"></div>
      <div class="legend">
        <span class="legend-item"><i class="swatch off"></i>Відключення</span>
        <span class="legend-item"><i class="swatch on"></i>За графіком зі світлом</span>
      </div>
      <div class="summary">
        <div class="metric"><span>Без світла за графіком</span><strong id="off-total">—</strong></div>
        <div class="metric"><span>Зі світлом за графіком</span><strong id="on-total">—</strong></div>
      </div>
      <div class="divider"></div>
      <h2 class="section-title">Точні години відключення</h2>
      <div id="outages" class="outage-list"></div>
    </div>
    <p id="empty" class="error">Перевіряємо графік…</p>
    <div class="footer">
      <div class="meta" id="updated">Час перевірки невідомий</div>
      <button type="button" id="reload">Оновити</button>
    </div>
  </section>
  <nav aria-label="Джерела та API">
    <a href="/api/v1/schedule">Дані API</a>
    <a href="/health">Стан сервера</a>
    <a id="source-link" href="https://www.cherkasyoblenergo.com/media" rel="noopener noreferrer">Офіційне джерело</a>
  </nav>
  <p class="disclaimer">Показано плановий графік, а не фактичну наявність електроенергії. Якщо інформацію неможливо перевірити, ми не показуємо застарілі інтервали як актуальні. Сайт працює онлайн, без збереження графіка на телефоні.</p>
</main>
<script>
(function () {
  'use strict';
  const el = id => document.getElementById(id);
  const minute = clock => Number(clock.slice(0,2))*60 + Number(clock.slice(3,5));
  const formatLength = duration => {
    const hours=Math.floor(duration/60), rest=duration%60;
    return hours+' год'+(rest?' '+rest+' хв':'');
  };
  const isValidTime = value => typeof value==='string' &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(value) || value==='24:00';
  const dates = new Intl.DateTimeFormat('uk-UA',{dateStyle:'long',timeZone:'Europe/Kyiv'});
  const stamp = new Intl.DateTimeFormat('uk-UA',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Kyiv'});

  function clearUnknown(message) {
    el('status-card').className='status';
    el('status-icon').textContent='?';
    el('status').textContent='Статус невідомий';
    el('details').textContent='Немає підтвердженої інформації про поточний стан за графіком.';
    el('available').hidden=true;
    el('empty').hidden=false;
    el('empty').textContent=message;
    el('updated').textContent='Немає актуальної синхронізації';
  }

  function validate(data) {
    if(data.kind!=='schedule' || !['scheduled_off','scheduled_on'].includes(data.state))return false;
    if(!Array.isArray(data.periods) || data.periods.length<1)return false;
    let cursor=0;
    for(const p of data.periods) {
      if(!isValidTime(p.start)||!isValidTime(p.end)||
        !['scheduled_off','scheduled_on'].includes(p.state))return false;
      if(minute(p.start)!==cursor || minute(p.end)<=cursor || minute(p.end)>1440)return false;
      cursor=minute(p.end);
    }
    if(cursor!==1440 || !Array.isArray(data.outages))return false;
    return data.outages.every(p=>isValidTime(p.start)&&isValidTime(p.end)&&minute(p.start)<minute(p.end));
  }

  function makeNode(tag, className, text) {
    const node=document.createElement(tag);
    node.className=className;
    if(text!==undefined)node.textContent=text;
    return node;
  }
  function show(data) {
    const isOff=data.state==='scheduled_off';
    el('status-card').className='status '+(isOff?'off':'on');
    el('status-icon').textContent=isOff?'⏻':'⚡';
    el('status').textContent=isOff?'Відключення':'Світло має бути';
    el('details').textContent=(data.nextChangeLocal && data.nextChangeLocal!=='24:00'
      ? 'Наступна зміна о '+data.nextChangeLocal+'. ':'')+
      'Лише за графіком, не фактичний стан.';

    const day=new Date(data.date+'T12:00:00Z');
    el('day').textContent=dates.format(day)+' · '+data.queue;
    el('periods').replaceChildren();
    const kyivTime=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Kyiv',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
    const currentMinute=minute(kyivTime);
    for(const span of data.periods) {
      const off=span.state==='scheduled_off';
      const active=minute(span.start)<=currentMinute && currentMinute<minute(span.end);
      const card=makeNode('div','period '+(off?'off':'on')+(active?' current':''));
      card.setAttribute('aria-label',span.start+'–'+span.end+': '+(off?'відключення':'за графіком зі світлом'));
      card.append(makeNode('strong','period-time',span.start+'–'+span.end));
      card.append(makeNode('span','period-label',off?'Відключення':'Є світло'));
      el('periods').append(card);
    }
    el('outages').replaceChildren();
    for(const outage of data.outages) {
      const item=makeNode('div','outage');
      item.append(makeNode('span','outage-icon','⏻'));
      item.append(makeNode('span','outage-time',outage.start+'–'+outage.end));
      el('outages').append(item);
    }
    if(!data.outages.length)el('outages').append(makeNode('div','meta','Відключень на цю дату не вказано.'));
    const offMinutes=data.periods.filter(p=>p.state==='scheduled_off')
      .reduce((total,p)=>total+minute(p.end)-minute(p.start),0);
    el('off-total').textContent=formatLength(offMinutes);
    el('on-total').textContent=formatLength(1440-offMinutes);
    el('updated').textContent=data.checkedAt?'Перевірено: '+stamp.format(new Date(data.checkedAt)):'Час перевірки невідомий';
    if(typeof data.sourceUrl==='string' && /^https:\/\/(?:www\.)?cherkasyoblenergo\.com\/media\//.test(data.sourceUrl)) {
      el('source-link').href=data.sourceUrl;
    }
    el('available').hidden=false;
    el('empty').hidden=true;
  }

  let busy=false;
  async function load() {
    if(busy)return;
    busy=true;el('reload').disabled=true;
    try {
      const response=await fetch('/api/v1/schedule',{cache:'no-store'});
      if(!response.ok)throw Error('Сервер недоступний');
      const data=await response.json();
      if(!validate(data)) {
        clearUnknown(data.reason==='stale'
          ? 'Графік застарів. Чекаємо підтвердження з офіційного джерела.'
          : 'Немає перевіреного графіка для цієї дати.');
      } else show(data);
    } catch {
      clearUnknown('Не вдалося завантажити графік. Перевірте підключення до інтернету.');
    } finally {
      busy=false;el('reload').disabled=false;
    }
  }
  el('reload').addEventListener('click',load);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
  setInterval(()=>{if(!document.hidden)load();}, 2*60*1000);
  load();
})();
</script>
</body>
</html>`;

export function landingResponse() {
  return new Response(HTML, {status: 200, headers: {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer'
  }});
}
