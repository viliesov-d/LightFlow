/** LightFlow online homepage with grouped electricity intervals. */
const HTML = String.raw`<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0c1422">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="LightFlow">
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
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
    .dial-shell { display:flex; justify-content:center; align-items:center; margin:5px auto 12px; }
    .dial-stage { width:min(100%,470px); aspect-ratio:1; position:relative; }
    .dial-svg { width:100%; height:100%; overflow:visible; display:block; }
    .ring-track { fill:none; stroke:#344557; stroke-width:45; }
    .dial-segment { fill:none; stroke-width:45; stroke-linecap:butt; }
    .dial-divider { stroke:#152538; stroke-width:2; }
    .dial-hour { fill:#f8faff; font:500 13px system-ui,-apple-system,"Segoe UI",sans-serif; text-anchor:middle; dominant-baseline:central; }
    .dial-center-date { fill:#bed1e2; font:500 21px system-ui,-apple-system,"Segoe UI",sans-serif; text-anchor:middle; }
    .dial-center-queue { fill:#f9fbff; font:700 67px system-ui,-apple-system,"Segoe UI",sans-serif; letter-spacing:-3px; text-anchor:middle; }
    .dial-center-caption { fill:#b9cbe0; font:500 14px system-ui,-apple-system,"Segoe UI",sans-serif; text-anchor:middle; letter-spacing:.7px; }
    .dial-center-status { fill:#b4c5d8; font:600 19px system-ui,-apple-system,"Segoe UI",sans-serif; text-anchor:middle; }
    .dial-center-status.on { fill:#6ce7ba; }
    .dial-center-status.off { fill:#ff8997; }
    .dial-inner-separator { stroke:#5e7487; stroke-width:1; opacity:.55; }
    .dial-pointer { stroke:#fff; stroke-width:3; stroke-linecap:round; }
    .dial-pointer-dot { fill:#fff; }
    .dial-stage::before { content:""; position:absolute; inset:7%; border-radius:50%; box-shadow:0 0 33px #0e1d2e55; pointer-events:none; }
    @media(max-width:430px) {
      .dial-stage { width:100%; }
      .dial-shell { margin-inline:-11px; }
    }
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
      body {padding-inline:11px}.panel {padding:14px}.outage-time {font-size:16px}
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
      <div class="dial-shell">
        <div class="dial-stage">
          <svg class="dial-svg" id="dial" viewBox="0 0 480 480" role="img"
               aria-label="Круговий графік на 24 години. М'ятний — світло за графіком, кораловий — відключення; стрілка показує поточний час Києва.">
            <defs>
              <linearGradient id="dial-on" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#86f4cb"/>
                <stop offset="1" stop-color="#3acb99"/>
              </linearGradient>
              <linearGradient id="dial-off" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#ff919d"/>
                <stop offset="1" stop-color="#df677b"/>
              </linearGradient>
            </defs>
            <circle class="ring-track" cx="240" cy="240" r="163"/>
            <g id="dial-segments"></g>
            <g id="dial-dividers"></g>
            <g id="dial-hours"></g>
            <text id="dial-date" class="dial-center-date" x="240" y="206">—</text>
            <text id="dial-queue" class="dial-center-queue" x="240" y="263">1.1</text>
            <text class="dial-center-caption" x="240" y="286">ПІДЧЕРГА</text>
            <line class="dial-inner-separator" x1="175" x2="305" y1="302" y2="302"/>
            <text id="dial-current" class="dial-center-status" x="240" y="329">Статус невідомий</text>
            <g id="dial-hand">
              <line id="dial-hand-line" class="dial-pointer" x1="240" y1="120" x2="240" y2="68"/>
              <circle id="dial-hand-dot" class="dial-pointer-dot" cx="240" cy="68" r="5.5"/>
            </g>
          </svg>
        </div>
      </div>
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
    activeSchedule=null;
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
  const SVG_NS='http://www.w3.org/2000/svg';
  const kyivTimeFormat=new Intl.DateTimeFormat('en-GB',{
    timeZone:'Europe/Kyiv',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
  });
  let activeSchedule=null;
  function kyivSeconds() {
    const parts=Object.fromEntries(kyivTimeFormat.formatToParts(new Date())
      .filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
    return parts.hour*3600+parts.minute*60+parts.second;
  }
  function positionAt(mins,radius) {
    const a=(mins/1440*2*Math.PI)-Math.PI/2;
    return {x:240+Math.cos(a)*radius,y:240+Math.sin(a)*radius};
  }
  function svgElement(tag,attrs,text) {
    const node=document.createElementNS(SVG_NS,tag);
    for(const [key,value] of Object.entries(attrs||{}))node.setAttribute(key,String(value));
    if(text!==undefined)node.textContent=text;
    return node;
  }
  function intervalArc(start,end) {
    // A full-day period needs two arcs because SVG start and end coincide at 24h.
    const r=163,steps=Math.ceil((end-start)/720);
    const p0=positionAt(start,r);
    let d='M '+p0.x+' '+p0.y;
    for(let i=1;i<=steps;i++){
      const p=positionAt(start+(end-start)*i/steps,r);
      d+=' A '+r+' '+r+' 0 0 1 '+p.x+' '+p.y;
    }
    return d;
  }
  function drawDial(data) {
    activeSchedule=data;
    const arcs=el('dial-segments'),dividers=el('dial-dividers'),hours=el('dial-hours');
    arcs.replaceChildren();dividers.replaceChildren();hours.replaceChildren();
    data.periods.forEach(span=>{
      const off=span.state==='scheduled_off';
      arcs.append(svgElement('path',{
        d:intervalArc(minute(span.start),minute(span.end)),
        class:'dial-segment',stroke:'url(#dial-'+(off?'off':'on')+')'
      }));
    });
    for(let h=0;h<24;h++){
      const p0=positionAt(h*60,139),p1=positionAt(h*60,187),label=positionAt(h*60,211);
      dividers.append(svgElement('line',{
        x1:p0.x,y1:p0.y,x2:p1.x,y2:p1.y,class:'dial-divider'
      }));
      hours.append(svgElement('text',{
        x:label.x,y:label.y,class:'dial-hour'
      },String(h)));
    }
    el('dial-date').textContent=new Intl.DateTimeFormat('uk-UA',{
      day:'numeric',month:'long',timeZone:'Europe/Kyiv'
    }).format(new Date(data.date+'T12:00:00Z'));
    el('dial-queue').textContent=data.queue;
    updateDialClock();
  }
  function updateDialClock() {
    if(!activeSchedule || document.hidden)return;
    const seconds=kyivSeconds();
    const minuteNow=seconds/60;
    const interval=activeSchedule.periods.find(p=>
      minute(p.start)<=minuteNow && minuteNow<minute(p.end));
    const isOff=interval?.state==='scheduled_off';
    const line=el('dial-current');
    line.textContent=!interval?'Статус невідомий':
      isOff?'Відключення':'Світло за графіком';
    line.setAttribute('class','dial-center-status '+(!interval?'':isOff?'off':'on'));
    // On the web the hand genuinely tracks every second, unlike RemoteViews.
    const start=positionAt(minuteNow,139),end=positionAt(minuteNow,179);
    const hand=el('dial-hand-line'),dot=el('dial-hand-dot');
    hand.setAttribute('x1',start.x);hand.setAttribute('y1',start.y);
    hand.setAttribute('x2',end.x);hand.setAttribute('y2',end.y);
    dot.setAttribute('cx',end.x);dot.setAttribute('cy',end.y);
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
    drawDial(data);
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
  setInterval(updateDialClock,1000);
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
