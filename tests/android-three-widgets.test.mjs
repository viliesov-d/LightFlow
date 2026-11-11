import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const base='widgets/android/app/src/main/';
const art=readFileSync(base+'java/com/lightflow/widgets/WidgetArt.kt','utf8');
const widgets=readFileSync(base+'java/com/lightflow/widgets/LightFlowWidgets.kt','utf8');

test('all three branded widgets stay bounded Canvas bitmaps',()=>{
  for(const feature of ['Kind.BULB','Kind.CAROUSEL','Kind.DIAL'])
    assert.ok(art.includes(feature));
  assert.match(art,/Bitmap\.createBitmap\(size\.first,size\.second,Bitmap\.Config\.ARGB_8888\)/);
  assert.match(art,/340 to 340/);
  assert.match(art,/840 to 260/);
  assert.match(art,/630 to 630/);
  assert.match(widgets,/setImageViewBitmap\(config\.artwork, bitmap\)/);
  assert.doesNotMatch(widgets,/R\.id\.period\d+|R\.id\.smallStatus|R\.id\.largeStatus/);
});

test('small bulb is 19% smaller and visibly balanced, with the interval only',()=>{
  const small=art.split('private fun bulb(')[1].split('private fun strip(')[0];
  assert.match(small,/r=side\*\.166f/);
  assert.match(small,/y=h\*\.385f/);
  assert.match(small,/paint\(accent,side\*\.012f,Paint\.Style\.STROKE\)/);
  assert.match(small,/setShadowLayer\(side\*\.019f/);
  assert.match(small,/c\.drawPath\(lightning,paint\(amber\)\)/);
  assert.match(small,/state\.start\+"–"\+state\.end/);
  assert.doesNotMatch(small,/LightFlow|Черкаська|Відключення|Світло за графіком/);
});

test('carousel is slim, with status above and only time inside each 66%-wide block',()=>{
  const medium=art.split('private fun strip(')[1].split('private fun dial(')[0];
  assert.match(medium,/val segmentWidth=w\*\.66f/);
  assert.match(medium,/val top=h\*\.375f/);
  assert.match(medium,/val bottom=h\*\.725f/);
  assert.match(medium,/val status=when\(current\?\.off\)/);
  assert.match(medium,/c\.drawText\(status,w\*\.093f,h\*\.273f/);
  assert.match(medium,/write\(c,period\.start\+"–"\+period\.end/);
  assert.doesNotMatch(medium,/ВІДКЛЮЧЕННЯ|Є СВІТЛО ЗА ГРАФІКОМ/);
  assert.match(medium,/now\.hour\*60f\+now\.minute\+now\.second\/60f/);
  assert.match(medium,/left=center-progress\*segmentWidth/);
  assert.match(medium,/val x=left\+\(index-i\)\*\(segmentWidth\+gap\)/);
  assert.match(medium,/moveTo\(center,h\*\.783f\)/);
});

test('24-hour dial keeps hour markers and moves pointer around ring without blocking centre',()=>{
  const large=art.split('private fun dial(')[1].split('fun draw(')[0];
  assert.match(large,/for\(hour in 0\.\.23\)/);
  assert.match(large,/val radius=side\*\.346f;val thickness=side\*\.104f/);
  assert.match(large,/val elapsed=now\.hour\*3600\+now\.minute\*60\+now\.second/);
  assert.match(large,/elapsed\/86400\.0\*360\.0/);
  assert.match(large,/polarX\(cx,radius-thickness\*\.82f,angle\)/);
  assert.doesNotMatch(large,/c\.drawCircle\(cx,cy,side\*\.009f/);
  assert.match(large,/DateTimeFormatter\.ofPattern\("d MMMM",Locale\("uk"\)\)/);
  assert.match(large,/"1\.1"/);
  assert.match(large,/when\(current\?\.off\)/);
});

test('color palette is soft navy, vivid mint and coral, warm yellow bolt',()=>{
  assert.match(art,/bg=Color\.rgb\(14,25,40\)/);
  assert.match(art,/green=Color\.rgb\(98,229,179\)/);
  assert.match(art,/red=Color\.rgb\(255,130,140\)/);
  assert.match(art,/amber=Color\.rgb\(249,211,112\)/);
});

test('clock updates remain best-effort, no exact alarm permissions',()=>{
  const manifest=readFileSync(base+'AndroidManifest.xml','utf8');
  assert.match(widgets,/setAndAllowWhileIdle\(/);
  assert.match(widgets,/5 \* 60 \* 1000L/);
  assert.match(widgets,/WidgetClock\.cancel\(context\)/);
  assert.doesNotMatch(manifest,/SCHEDULE_EXACT_ALARM|USE_EXACT_ALARM/);
  assert.doesNotMatch(widgets,/SharedPreferences|DataStore|FileManager|SQLiteDatabase/);
});

test('Android patch version is 0.3.1',()=>{
  const gradle=readFileSync('widgets/android/app/build.gradle.kts','utf8');
  assert.match(gradle,/versionName = "0\.3\.1"/);
  assert.match(gradle,/versionCode = 5/);
});
