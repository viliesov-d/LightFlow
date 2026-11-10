import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Android widgets use RemoteViews: not every normal Android XML view is supported.
// A <Space/> compiles, but cannot be inflated by the home-screen launcher.
const ALLOWED=new Set([
  'AdapterViewFlipper','FrameLayout','GridLayout','GridView',
  'LinearLayout','ListView','RelativeLayout','StackView','ViewFlipper',
  'AnalogClock','Button','Chronometer','ImageButton','ImageView',
  'ProgressBar','TextClock','TextView'
]);
const ROOT='widgets/android/app/src/main/res/layout/';

for(const [name,views] of [
  ['widget_small.xml',['smallRoot','smallStatus','smallInfo']],
  ['widget_large.xml',['largeRoot','largeStatus','largeInfo',
    ...Array.from({length:10},(_,i)=>'period'+(i+1))]
]) {
  test(name+' contains only RemoteViews-supported XML classes',()=>{
    const xml=readFileSync(ROOT+name,'utf8');
    const tags=[...xml.matchAll(/<([A-Z][a-zA-Z0-9._]*)\b/g)].map(m=>m[1]);
    assert.ok(tags.length>0);
    for(const tag of tags) assert.ok(ALLOWED.has(tag),
      tag+' is not supported by Android RemoteViews in '+name);
    for(const id of views) assert.match(xml,new RegExp('android:id="@\\+id/'+id+'"'));
  });
}

test('widget providers have safe initial layouts, no unsupported Space tags',()=>{
  const base='widgets/android/app/src/main/res/';
  const small=readFileSync(base+'xml/widget_small_info.xml','utf8');
  const large=readFileSync(base+'xml/widget_large_info.xml','utf8');
  assert.match(small,/android:initialLayout="@layout\/widget_small"/);
  assert.match(large,/android:initialLayout="@layout\/widget_large"/);
  const manifest=readFileSync('widgets/android/app/src/main/AndroidManifest.xml','utf8');
  assert.match(manifest,/android:name="\.SmallWidgetProvider"/);
  assert.match(manifest,/android:name="\.LargeWidgetProvider"/);
});
