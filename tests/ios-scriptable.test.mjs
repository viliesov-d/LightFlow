import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';

const file='widgets/ios/LightFlow.js';
const source=readFileSync(file,'utf8');

test('one Scriptable script supports all three true iPhone widget designs',()=>{
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  assert.equal(check.status,0,check.stderr);
  for(const required of [
    'args.widgetParameter','config.widgetFamily','Script.setWidget',
    'Script.complete','api/v1/schedule','DrawContext','Path',
    'Kind'
  ]) {
    // Scriptable is not Android; no arbitrary platform-specific storage APIs.
    if(required!=='Kind')assert.ok(source.includes(required),required+' absent');
  }
  assert.match(source,/mode==="mini"\?dialArt\(data,now,true\):bulbArt\(data,now\)/);
  assert.match(source,/mode==="large"\?dialArt\(data,now,false\)/);
  assert.match(source,/widget\.refreshAfterDate=/);
  assert.match(source,/widget\.url=SITE/);
  assert.doesNotMatch(source,/FileManager|Keychain|localStorage|cacheDirectory|writeString|downloadFile/i);
});

test('the 24h circular schedule is minute-accurate; mini keeps readable hour labels',()=>{
  assert.match(source,/for \(let hour = 0; hour < 24; hour\+\+\)/);
  assert.match(source,/hour%3===0/);
  assert.match(source,/minuteOf\(span\.start\),minuteOf\(span\.end\)/);
  assert.match(source,/circularBand\(dc,cx,cy,0,1440/);
  assert.match(source,/const position=kyivMinutes\(now\)\/4/);
  assert.match(source,/const span=periodNow\(data,now\)/);
  assert.match(source,/dc\.opaque = false/);
});

function makeSchedule(){
  const parts=new Intl.DateTimeFormat('en-CA',{
    timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(new Date());
  const p=Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  return {
    queue:'1.1',kind:'schedule',state:'scheduled_on',
    date:p.year+'-'+p.month+'-'+p.day,checkedAt:new Date().toISOString(),
    outages:[{start:'06:00',end:'10:00'},{start:'15:00',end:'18:00'}],
    periods:[
      {start:'00:00',end:'06:00',state:'scheduled_on'},
      {start:'06:00',end:'10:00',state:'scheduled_off'},
      {start:'10:00',end:'15:00',state:'scheduled_on'},
      {start:'15:00',end:'18:00',state:'scheduled_off'},
      {start:'18:00',end:'24:00',state:'scheduled_on'}
    ]
  };
}

async function simulate({parameter='bulb',family='small',response=makeSchedule()}) {
  const operations=[];
  class FakeColor { constructor(hex,alpha){this.hex=hex;this.alpha=alpha;} }
  class FakeSize { constructor(width,height){this.width=width;this.height=height;} }
  class FakePoint { constructor(x,y){this.x=x;this.y=y;} }
  class FakeRect { constructor(x,y,width,height){Object.assign(this,{x,y,width,height});} }
  class FakePath {
    move(){} addLine(){} addCurve(){} closeSubpath(){}
  }
  class FakeContext {
    constructor(){this.size=new FakeSize(0,0);this.opaque=true;operations.push('newContext');}
    setStrokeColor(){} setLineWidth(){} addPath(){} strokePath(){}
    setFillColor(){} fillPath(){} fillEllipse(){}
    setFont(){} setTextColor(){} setTextAlignedCenter(){}
    drawTextInRect() {}
    getImage(){return {size:this.size};}
  }
  class FakeWidget {
    constructor(){this.art=null;}
    setPadding() {}
    addImage(art){this.art=art;return {applyFittingContentMode(){},centerAlignImage(){}};}
    async presentSmall(){}
    async presentLarge(){}
  }
  const model={};
  const sandbox={
    Date,Intl,Math,Number,Object,String,Array,Promise,
    Color:FakeColor,Size:FakeSize,Point:FakePoint,Rect:FakeRect,
    Path:FakePath,DrawContext:FakeContext,
    Font:{boldSystemFont:n=>n,mediumSystemFont:n=>n},
    ListWidget:FakeWidget,
    Request:class {async loadJSON(){return response;} },
    args:{widgetParameter:parameter},
    config:{widgetFamily:family,runsInWidget:true},
    Script:{setWidget(w){model.widget=w;},complete(){model.completed=true;}},
  };
  const runnable=source.replace(/\bawait run\(\);\s*$/, 'globalThis.__done=run();');
  vm.runInNewContext(runnable,sandbox,{timeout:2000});
  await sandbox.__done;
  return {model,operations};
}

test('Scriptable executes all modes and creates correctly sized widget art',async()=>{
  const examples=[
    {parameter:'bulb',family:'small',size:360},
    {parameter:'mini',family:'small',size:380},
    {parameter:'large',family:'large',size:620}
  ];
  for(const item of examples){
    const result=await simulate(item);
    assert.equal(result.model.completed,true);
    assert.equal(result.model.widget.art.size.width,item.size);
    assert.equal(result.model.widget.url,'https://lightflow-api.lightflow-viliesov.workers.dev/');
    assert.ok(result.operations.length>0);
  }
});

test('invalid or stale API never produces made-up active periods',async()=>{
  const stale={...makeSchedule(),checkedAt:'2020-01-01T00:00:00.000Z'};
  const r=await simulate({parameter:'mini',family:'small',response:stale});
  assert.ok(r.model.widget.art);
  const wrong={...makeSchedule(),periods:[{start:'00:00',end:'23:00',state:'scheduled_on'}]};
  const r2=await simulate({parameter:'bulb',family:'small',response:wrong});
  assert.equal(r2.model.completed,true);
});
