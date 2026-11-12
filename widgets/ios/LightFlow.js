// LightFlow for iPhone — ONE Scriptable script, THREE Home Screen widgets.
// Scriptable widget Parameter: "bulb" (small), "mini" (small), "large" (large).
// Free forever: the script fetches the official schedule from our Cloudflare API.
// No Apple Developer membership, custom IPA signing, local cache or data storage.
const API = "https://lightflow-api.lightflow-viliesov.workers.dev/api/v1/schedule";
const SITE = "https://lightflow-api.lightflow-viliesov.workers.dev/";
const TZ = "Europe/Kyiv";
const PAL = {
  mint: new Color("#6CE7BA"),
  coral: new Color("#F77989"),
  gold: new Color("#FFD383"),
  bolt: new Color("#FFBA39"),
  white: new Color("#F8FAFF"),
  muted: new Color("#B6CADD"),
  unknown: new Color("#889CAE"),
  quiet: new Color("#25394F"),
  shadow: new Color("#091524", 0.7)
};

function kyivParts(date = new Date()) {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  }).formatToParts(date);
  const obj = {};
  for (const item of p) if (item.type !== "literal") obj[item.type] = item.value;
  return obj;
}
function kyivDate(date = new Date()) {
  const p = kyivParts(date);
  return p.year + "-" + p.month + "-" + p.day;
}
function kyivMinutes(date = new Date()) {
  const p = kyivParts(date);
  return Number(p.hour) * 60 + Number(p.minute) + Number(p.second) / 60;
}
function minuteOf(value) {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return NaN;
  const [h, m] = value.split(":").map(Number);
  if (h < 0 || h > 24 || m < 0 || m > 59 || (h === 24 && m !== 0)) return NaN;
  return h * 60 + m;
}
function verified(data, now = new Date()) {
  if (!data || data.queue !== "1.1" || data.kind !== "schedule" ||
      !["scheduled_on", "scheduled_off"].includes(data.state) ||
      data.date !== kyivDate(now) ||
      !Array.isArray(data.periods) || !data.periods.length ||
      !Array.isArray(data.outages)) return false;
  const checked = Date.parse(data.checkedAt);
  const age = now.getTime() - checked;
  if (!Number.isFinite(checked) || age < -60000 || age > 20 * 60 * 1000) return false;
  let cursor = 0;
  for (const p of data.periods) {
    const a = minuteOf(p.start), b = minuteOf(p.end);
    if (a !== cursor || !Number.isFinite(b) || b <= a || b > 1440 ||
        !["scheduled_off", "scheduled_on"].includes(p.state)) return false;
    cursor = b;
  }
  return cursor === 1440;
}
function periodNow(data, now = new Date()) {
  if (!data) return null;
  const t = kyivMinutes(now);
  return data.periods.find(p => minuteOf(p.start) <= t && t < minuteOf(p.end)) || null;
}
function context(size) {
  const dc = new DrawContext();
  dc.size = new Size(size, size);
  dc.opaque = false; // Art has a transparent background, like Android LightFlow.
  dc.respectScreenScale = true; // Render sharp text and hairlines at the iPhone Retina scale.
  return dc;
}

// Soft Glass is intentionally subtle: a dark translucent tint, not a fake wallpaper
// screenshot. iOS/Scriptable cannot sample and live-blur the Home Screen behind a widget.
const GLASS = {
  base: new Color("#12243A", 0.85),
  depth: new Color("#081727", 0.20),
  sheen: new Color("#A9D5EF", 0.075),
  topEdge: new Color("#DDEFFF", 0.33),
  bottomEdge: new Color("#B1CCE1", 0.13),
  sideEdge: new Color("#B5D8F1", 0.14),
  glimmer: new Color("#D7F5FF", 0.075),
  textShadow: new Color("#06111E", 0.54)
};
function roundedPath(x,y,w,h,r) {
  const p=new Path(),k=0.5522847498; // Cubic control factor for rounded corners.
  p.move(new Point(x+r,y));
  p.addLine(new Point(x+w-r,y));
  p.addCurve(new Point(x+w,y+r),
    new Point(x+w-r+k*r,y),new Point(x+w,y+r-k*r));
  p.addLine(new Point(x+w,y+h-r));
  p.addCurve(new Point(x+w-r,y+h),
    new Point(x+w,y+h-r+k*r),new Point(x+w-r+k*r,y+h));
  p.addLine(new Point(x+r,y+h));
  p.addCurve(new Point(x,y+h-r),
    new Point(x+r-k*r,y+h),new Point(x,y+h-r+k*r));
  p.addLine(new Point(x,y+r));
  p.addCurve(new Point(x+r,y),
    new Point(x,y+r-k*r),new Point(x+r-k*r,y));
  p.closeSubpath();
  return p;
}
function glassSurface(dc,size,large=false) {
  // Inset the decoration to keep the rim away from the iOS clipping boundary.
  const inset=size*(large?0.028:0.038),corner=size*(large?0.090:0.125);
  const x=inset,y=inset,w=size-2*inset,h=w;
  pathFill(dc,roundedPath(x,y,w,h,corner),GLASS.base);
  // Soft shade near the bottom and feather-light glints towards the top-left.
  pathFill(dc,roundedPath(x+3,y+h*0.67,w-6,h*0.315,corner*0.5),GLASS.depth);
  pathFill(dc,roundedPath(x+5,y+4,w-10,h*0.22,corner*0.72),GLASS.sheen);
  pathStroke(dc,roundedPath(x+1,y+1,w-2,h-2,corner),GLASS.sideEdge,large?1.75:1.45);
  const glow=new Path();
  glow.move(new Point(x+corner*0.7,y+2));
  glow.addCurve(new Point(x+w*0.74,y+2),
    new Point(x+w*0.25,y+2),new Point(x+w*0.52,y+2));
  pathStroke(dc,glow,GLASS.topEdge,large?2.2:1.65);
  const rim=new Path();
  rim.move(new Point(x+3,y+corner));
  rim.addLine(new Point(x+3,y+h*0.49));
  pathStroke(dc,rim,GLASS.glimmer,large?1.8:1.3);
  const bottom=new Path();
  bottom.move(new Point(x+corner*1.1,y+h-2));
  bottom.addLine(new Point(x+w-corner*1.1,y+h-2));
  pathStroke(dc,bottom,GLASS.bottomEdge,large?1.5:1.2);
}

function point(cx, cy, r, degree) {
  const angle = (degree - 90) * Math.PI / 180;
  return new Point(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
}
function pathStroke(dc, path, color, width) {
  dc.setStrokeColor(color);
  dc.setLineWidth(width);
  dc.addPath(path);
  dc.strokePath();
}
function pathFill(dc, path, color) {
  dc.setFillColor(color);
  dc.addPath(path);
  dc.fillPath();
}
function line(dc, x1, y1, x2, y2, color, width) {
  const path = new Path();
  path.move(new Point(x1, y1));
  path.addLine(new Point(x2, y2));
  pathStroke(dc, path, color, width);
}
function circle(dc, x, y, radius, fill) {
  dc.setFillColor(fill);
  dc.fillEllipse(new Rect(x - radius, y - radius, radius * 2, radius * 2));
}
function centered(dc, message, y, size, fontSize, color = PAL.white, bold = false) {
  dc.setFont(bold ? Font.boldSystemFont(fontSize) : Font.mediumSystemFont(fontSize));
  dc.setTextColor(color);
  dc.setTextAlignedCenter();
  // Shadow is drawn first, then a crisp Retina rasterized foreground glyph.
  dc.setTextColor(GLASS.textShadow);
  dc.drawTextInRect(message, new Rect(0, y+Math.max(0.8,fontSize*0.043), size, fontSize * 1.45));
  dc.setTextColor(color);
  dc.drawTextInRect(message, new Rect(0, y, size, fontSize * 1.45));
}
function circularBand(dc, cx, cy, start, end, outer, inner, color) {
  const steps = Math.max(2, Math.ceil((end - start) / 6));
  const shape = new Path();
  for (let i = 0; i <= steps; i++) {
    const p = point(cx, cy, outer, (start + (end - start) * i / steps) / 4);
    if (i === 0) shape.move(p);
    else shape.addLine(p);
  }
  for (let i = steps; i >= 0; i--) {
    shape.addLine(point(cx, cy, inner, (start + (end - start) * i / steps) / 4));
  }
  shape.closeSubpath();
  pathFill(dc, shape, color);
}
function bulbIcon(dc, cx, cy, scale, tint, boltColor) {
  // Symmetric bezier silhouette; light outline and small warm lightning.
  const shape = new Path();
  const X = n => cx + scale * n, Y = n => cy + scale * n;
  shape.move(new Point(X(-0.32), Y(0.24)));
  shape.addCurve(new Point(X(0), Y(-0.79)),
    new Point(X(-0.82), Y(-0.23)), new Point(X(-0.45), Y(-0.79)));
  shape.addCurve(new Point(X(0.32), Y(0.24)),
    new Point(X(0.45), Y(-0.79)), new Point(X(0.82), Y(-0.23)));
  shape.addCurve(new Point(X(0.20), Y(0.50)),
    new Point(X(0.25), Y(0.31)), new Point(X(0.20), Y(0.40)));
  shape.addLine(new Point(X(-0.20), Y(0.50)));
  shape.addCurve(new Point(X(-0.32), Y(0.24)),
    new Point(X(-0.20), Y(0.40)), new Point(X(-0.25), Y(0.31)));
  shape.closeSubpath();
  pathStroke(dc, shape, tint, scale * 0.060);
  const bolt = new Path();
  const coords = [[0.08,-0.48],[-0.21,0.06],[-0.03,0.06],[-0.11,0.34],
    [0.23,-0.17],[0.04,-0.17]];
  for (let i=0;i<coords.length;i++){
    const p=new Point(X(coords[i][0]), Y(coords[i][1]));
    if(i===0) bolt.move(p); else bolt.addLine(p);
  }
  bolt.closeSubpath();
  pathFill(dc,bolt,boltColor);
  line(dc,X(-0.22),Y(0.64),X(0.22),Y(0.64),tint,scale*0.06);
  line(dc,X(-0.17),Y(0.77),X(0.17),Y(0.77),tint,scale*0.06);
}
function bulbArt(data, now) {
  const size = 360, dc = context(size);
  glassSurface(dc,size);
  const span = periodNow(data, now);
  const tone = !span ? PAL.unknown : span.state === "scheduled_off" ? PAL.coral : PAL.gold;
  // Faint warm halo behind the bulb is controlled to stay inside the glass.
  circle(dc, 180, 130, 79, new Color("#FFD383", span ? 0.040 : 0.015));
  bulbIcon(dc, 180, 137, 108, tone, !span ? PAL.unknown : PAL.bolt);
  const hours = span ? span.start + "–" + span.end : "--:--–--:--";
  centered(dc, hours, 270, size, 29, PAL.white, true);
  return dc.getImage();
}
function dialArt(data, now, compact) {
  const size = compact ? 380 : 620, dc = context(size);
  glassSurface(dc,size,!compact);
  const cx = size/2, cy = size/2;
  const r = size * (compact ? 0.323 : 0.324);
  const thickness = size * (compact ? 0.102 : 0.105);
  const outer = r + thickness/2, inner = r-thickness/2;
  // Muted track improves ring separation without a harsh black disc.
  circularBand(dc,cx,cy,0,1440,outer,inner,new Color("#2C4558",0.69));
  if (data) for (const span of data.periods) {
    circularBand(dc,cx,cy,minuteOf(span.start),minuteOf(span.end),
      outer,inner,span.state==="scheduled_off"?PAL.coral:PAL.mint);
  }
  // Thin separators preserve 24 hour divisions even when only 8 labels fit.
  for (let hour = 0; hour < 24; hour++) {
    const p0=point(cx,cy,inner-1,hour*15);
    const p1=point(cx,cy,outer+1,hour*15);
    line(dc,p0.x,p0.y,p1.x,p1.y,new Color("#122236",0.72),compact?1.75:2.3);
    if (!compact || hour%3===0) {
      const pos=point(cx,cy,outer+(compact?19:28),hour*15);
      const fontsize=compact?14:19;
      dc.setFont(Font.mediumSystemFont(fontsize));
      dc.setTextAlignedCenter();
      dc.setTextColor(GLASS.textShadow);
      dc.drawTextInRect(String(hour),new Rect(pos.x-25,pos.y-fontsize*0.72+1.1,50,fontsize*1.5));
      dc.setTextColor(PAL.white);
      dc.drawTextInRect(String(hour),new Rect(pos.x-25,pos.y-fontsize*0.72,50,fontsize*1.5));
    }
  }
  const span=periodNow(data,now);
  const tone=!span?PAL.unknown:span.state==="scheduled_off"?PAL.coral:PAL.mint;
  const status=!span?"Немає графіка":span.state==="scheduled_off"?"Відключення":"Є світло";
  const dateLabel=new Intl.DateTimeFormat("uk-UA", {
    timeZone:TZ,day:"numeric",month:compact?"short":"long"
  }).format(now);
  if(compact){
    centered(dc,dateLabel,cy-69,size,18,PAL.muted);
    centered(dc,"1.1",cy-37,size,56,PAL.white,true);
    centered(dc,status,cy+26,size,status.length>10?18:20,tone,true);
    centered(dc,"за графіком",cy+53,size,12,PAL.muted);
  } else {
    centered(dc,dateLabel,cy-99,size,31,PAL.muted);
    centered(dc,"1.1",cy-61,size,91,PAL.white,true);
    centered(dc,"ПІДЧЕРГА",cy+40,size,20,PAL.muted);
    line(dc,cx-87,cy+84,cx+87,cy+84,PAL.quiet,2);
    centered(dc,!span?"Статус невідомий":span.state==="scheduled_off"?
      "Відключення":"Світло за графіком",cy+98,size,27,tone,true);
  }
  // The hand is calculated using current Kyiv time when iOS renders the widget.
  // iOS chooses future refreshes; it cannot animate the hand continuously here.
  const position=kyivMinutes(now)/4;
  const from=point(cx,cy,inner-(compact?7:12),position);
  const to=point(cx,cy,r+thickness*0.35,position);
  line(dc,from.x,from.y,to.x,to.y,PAL.white,compact?2.5:3.4);
  circle(dc,to.x,to.y,compact?3.5:5,PAL.white);
  return dc.getImage();
}
async function fetchSchedule(now) {
  try {
    const req = new Request(API);
    req.timeoutInterval = 12;
    const data = await req.loadJSON();
    return verified(data,now) ? data : null;
  } catch (_) {
    return null;
  }
}
async function run() {
  const now=new Date();
  const param=String(args.widgetParameter || "bulb").trim().toLowerCase();
  const family=config.widgetFamily || "small";
  // Set widget Parameter to bulb or mini for two distinct SMALL widgets.
  // For a LARGE widget, use the same script with Parameter "large".
  const mode=family==="large" || param==="large" && family!=="small" ?
    "large" : param==="mini" ? "mini" : "bulb";
  const data=await fetchSchedule(now);
  const widget=new ListWidget();
  widget.setPadding(0,0,0,0);
  widget.backgroundColor=new Color("#000000",0); // iOS may add its own widget backdrop.
  widget.url=SITE; // iOS Scriptable widget taps open the LightFlow web app.
  widget.refreshAfterDate=new Date(now.getTime()+15*60*1000);
  const art=mode==="large"?dialArt(data,now,false):
    mode==="mini"?dialArt(data,now,true):bulbArt(data,now);
  const image=widget.addImage(art);
  image.applyFittingContentMode();
  image.centerAlignImage();
  Script.setWidget(widget);
  if(!config.runsInWidget){
    if(mode==="large")await widget.presentLarge();
    else await widget.presentSmall();
  }
  Script.complete();
}
await run();
