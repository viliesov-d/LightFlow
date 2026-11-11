import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app='widgets/android/app/src/main/';
const art=readFileSync(app+'java/com/lightflow/widgets/WidgetArt.kt','utf8');
const widgets=readFileSync(app+'java/com/lightflow/widgets/LightFlowWidgets.kt','utf8');

function section(start,end) {
  const from=art.indexOf(start), to=art.indexOf(end,from);
  assert.ok(from>=0 && to>from, 'Missing WidgetArt section '+start);
  return art.slice(from,to);
}

test('three widget faces are still bounded Canvas bitmaps on existing RemoteViews',()=>{
  for(const name of ['Kind.BULB','Kind.CAROUSEL','Kind.DIAL']) {
    assert.ok(art.includes(name));
  }
  assert.match(art,/Bitmap\.createBitmap\(size\.first,size\.second,Bitmap\.Config\.ARGB_8888\)/);
  assert.match(art,/340 to 340/);
  assert.match(art,/840 to 260/);
  assert.match(art,/630 to 630/);
  assert.match(widgets,/setImageViewBitmap\(config\.artwork, bitmap\)/);
  assert.doesNotMatch(widgets,/R\.id\.period\d+|R\.id\.smallStatus|R\.id\.largeStatus/);
});

test('small widget is just a symmetric warm lightbulb and time interval',()=>{
  const small=section('    private fun bulb(', '    private fun strip(');
  assert.match(small,/r=side\*\.166f/);
  assert.match(small,/val accent=when\(state\?\.off\)/);
  assert.match(small,/false->gold/);
  assert.match(small,/true->red/);
  assert.match(small,/setShadowLayer\(side\*\.022f/);
  assert.match(small,/c\.drawPath\(bolt,paint\(boltColor\)\)/);
  assert.match(small,/state\.start\+"–"\+state\.end/);
  assert.doesNotMatch(small,/LightFlow|Черкаська|Відключення|Світло за графіком/);
});

test('slender carousel prioritizes a 66%-wide active capsule and a fixed arrow',()=>{
  const medium=section('    private fun strip(', '    private fun dial(');
  assert.match(medium,/val segmentWidth=w\*\.66f/);
  assert.match(medium,/val top=h\*\.391f/);
  assert.match(medium,/val bottom=h\*\.707f/);
  assert.match(medium,/c\.drawText\(status,w\*\.099f,h\*\.287f/);
  assert.match(medium,/false->"Є світло"/);
  assert.match(medium,/true->"Відключення"/);
  assert.match(medium,/now\.hour\*60f\+now\.minute\+now\.second\/60f/);
  assert.match(medium,/val activeLeft=\(w-segmentWidth\)\*\.5f\+/);
  assert.match(medium,/\.5f-progress\)\*w\*\.25f/);
  assert.match(medium,/val x=activeLeft\+\(i-index\)\*\(segmentWidth\+gap\)/);
  assert.match(medium,/write\(c,segment\.start\+"–"\+segment\.end/);
  assert.match(medium,/moveTo\(center,h\*\.757f\)/);
  assert.doesNotMatch(medium,/Є СВІТЛО ЗА ГРАФІКОМ|ВІДКЛЮЧЕННЯ/);
});

test('24h clock has accurate time, soft minute-accurate sectors and white dot pointer',()=>{
  const large=section('    private fun dial(', '    fun draw(');
  assert.match(large,/val radius=side\*\.344f;val thickness=side\*\.101f/);
  assert.match(large,/c\.drawArc\(bounds,-90f\+start\/4f,\(end-start\)\/4f/);
  assert.match(large,/for\(hour in 0\.\.23\)/);
  assert.match(large,/val elapsed=now\.hour\*3600\+now\.minute\*60\+now\.second/);
  assert.match(large,/elapsed\/86400\.0\*360\.0/);
  assert.match(large,/c\.drawCircle\(px,py,side\*\.011f,paint\(text\)\)/);
  assert.doesNotMatch(large,/val tip=Path|lineTo\(px-ux/);
  assert.match(large,/DateTimeFormatter\.ofPattern\("d MMMM",Locale\("uk"\)\)/);
  assert.match(large,/write\(c,"1\.1"/);
  assert.match(large,/when\(current\?\.off\)/);
});

test('soft-minimal palette matches the selected reference',()=>{
  assert.match(art,/bg=Color\.rgb\(15,27,42\)/);
  assert.match(art,/bgHighlight=Color\.rgb\(26,45,64\)/);
  assert.match(art,/green=Color\.rgb\(108,231,186\)/);
  assert.match(art,/red=Color\.rgb\(242,118,131\)/);
  assert.match(art,/amber=Color\.rgb\(255,186,57\)/);
  assert.match(art,/gold=Color\.rgb\(255,211,131\)/);
});

test('clock remains best effort without exact alarm permissions',()=>{
  const manifest=readFileSync(app+'AndroidManifest.xml','utf8');
  assert.match(widgets,/setAndAllowWhileIdle\(/);
  assert.match(widgets,/5 \* 60 \* 1000L/);
  assert.doesNotMatch(manifest,/SCHEDULE_EXACT_ALARM|USE_EXACT_ALARM/);
  assert.doesNotMatch(widgets,/SharedPreferences|DataStore|FileManager|SQLiteDatabase/);
});

test('release version 0.4.1 is a new installable build',()=>{
  const gradle=readFileSync('widgets/android/app/build.gradle.kts','utf8');
  assert.match(gradle,/versionName = "0\.4\.1"/);
  assert.match(gradle,/versionCode = 7/);
});

test('widget artwork canvas starts transparent and never paints a full card',()=>{
  assert.match(art,/Bitmap\.createBitmap\(size\.first,size\.second,Bitmap\.Config\.ARGB_8888\)/);
  assert.match(art,/val canvas=Canvas\(cBitmap\)/);
  assert.doesNotMatch(art,/\bbase\(canvas/);
  assert.doesNotMatch(art,/private fun base\(/);
  assert.doesNotMatch(art,/c\.drawRoundRect\(rect,radius,radius,paint\(bg\)/);
  // Draw only the bulb, carousel capsules, or circular schedule over the wallpaper.
  assert.match(art,/No card fill or frame/);
  assert.match(art,/setShadowLayer\(size\*\.14f/);
  assert.match(art,/Paint\.Style\.STROKE/);
});
