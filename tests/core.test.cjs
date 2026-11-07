const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
require('../dist/js/core.js');const C=globalThis.LabCore;
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function complete(experiment,id='T01',offset=0){
 const run=C.makeRun(experiment,id);let n=0;
 for(const [block,b]of run.blocks.entries())for(const [index,t]of b.trials.entries()){
  const row={...t,trial_id:run.id+':'+n++,attempt_id:C.uid(),block_index:block,trial_index:index,timeout:false,technical_invalid:false,rt_ms:(experiment==='search'?t.condition==='baseline'?1000:700:1400)+offset};
  if(experiment==='search')row.response=t.target_present?'f':'j';else{row.response=t.true_ratio+(t.condition==='adjacent'?4:1);row.estimate=row.response;row.shorter_response=t.shorter_position;}
  run.trials.push(C.normalizeTrial(row,run));
 }
 run.status='complete';run.completed_at=new Date().toISOString();return run;
}
for(let n=0;n<100;n++){
 const search=C.makeRun('search','T'+String(n+1).padStart(2,'0'));
 assert.equal(search.blocks.length,2);assert.equal(C.practiceTrials(search,'search').length,4);
 for(const block of search.blocks){assert.equal(block.trials.length,20);assert.equal(block.trials.filter(t=>t.target_present).length,10);assert.equal(new Set(block.trials.filter(t=>t.target_present).map(t=>t.target_zone)).size,8);
  for(const t of block.trials)for(const variation of [0,1,1000]){
   const items=C.searchItems(t,variation);assert.equal(items.length,30);assert.equal(items.filter(d=>d.target).length,Number(t.target_present));assert.equal(items.filter(d=>!d.target&&d.color===C.COLOR.green&&d.shape==='X').length,t.green_x);assert.equal(items.filter(d=>d.color===C.COLOR.brown&&d.shape==='T').length,t.brown_t);if(t.target_present)assert.equal(items.find(d=>d.target).zone,t.target_zone);
   assert.deepEqual(items,C.searchItems(t,variation));
  }
 }
 for(const t of search.blocks[0].trials){const matched=search.blocks[1].trials.find(x=>x.case_index===t.case_index);const a=C.searchItems(t),b=C.searchItems(matched);assert.deepEqual(a.map(x=>[x.x,x.y]),b.map(x=>[x.x,x.y]));assert.deepEqual(a.filter(x=>x.target).map(x=>[x.x,x.y]),b.filter(x=>x.target).map(x=>[x.x,x.y]));}
 const ratio=C.makeRun('ratio','T'+String(n+1).padStart(2,'0')),trials=ratio.blocks.flatMap(b=>b.trials);
 assert.equal(trials.length,20);assert.equal(C.practiceTrials(ratio,'ratio').length,4);
 for(const c of C.CONDITIONS.ratio){const rows=trials.filter(t=>t.condition===c);assert.equal(rows.length,10);assert.equal(rows.filter(t=>t.shorter_position==='upper').length,5);assert.equal(rows.filter(t=>t.reference_height===125).length,5);assert.deepEqual(rows.map(t=>t.true_ratio).sort((a,b)=>a-b),C.RATIOS);for(const h of [125,250])for(const p of ['upper','lower'])assert.ok([2,3].includes(rows.filter(t=>t.reference_height===h&&t.shorter_position===p).length));}
 for(let i=0;i<20;i+=2){assert.equal(new Set(trials.slice(i,i+2).map(t=>t.condition)).size,2);assert.notEqual(trials[i].case_index,trials[i+1].case_index);}
 for(const c of C.CONDITIONS.ratio)assert.equal(trials.slice(0,10).filter(t=>t.condition===c).length,5);
 assert.equal(new Set(trials.slice(0,10).map(t=>t.case_index)).size,10);assert.equal(new Set(trials.slice(10).map(t=>t.case_index)).size,10);
 assert.ok(trials.every((t,i)=>i===0||t.true_ratio!==trials[i-1].true_ratio));
 for(let i=0;i<10;i++){
  const [a,b]=C.CONDITIONS.ratio.map(c=>trials.find(t=>t.condition===c&&t.case_index===i));
  assert.deepEqual(a.values.slice().sort((x,y)=>x-y),b.values.slice().sort((x,y)=>x-y));assert.deepEqual(a.background_values,b.background_values);assert.equal(a.values.length,4);assert.equal(a.background_values.length,4);assert.equal(a.axis_max,600);assert.ok(a.values.reduce((s,v)=>s+v,0)<=600);assert.ok(a.background_values.reduce((s,v)=>s+v,0)<=600);
  for(const t of [a,b,C.replacementTrial(a,1),C.replacementTrial(b,1000)]){close(t.values[t.labels.indexOf('A')]/t.values[t.labels.indexOf('B')]*100,t.true_ratio);assert.equal(t.shorter_position,t.labels.indexOf('A')>t.labels.indexOf('B')?'upper':'lower');assert.equal(Math.abs(t.labels.indexOf('A')-t.labels.indexOf('B')),t.separation+1);C.normalizeTrial({...t,timeout:true},ratio);const html=C.chartSVG(t);assert.equal((html.match(/<circle /g)||[]).length,2);for(const rect of html.matchAll(/<rect x="\d+" y="([\d.e-]+)" width="80" height="([\d.e-]+)"/g)){assert.ok(Number(rect[1])>=0);assert.ok(Number(rect[1])+Number(rect[2])<=520.00001);}}
 }
}
for(const experiment of ['search','ratio']){
 const run=complete(experiment);assert.ok(C.inspectRun(run).ok,C.inspectRun(run).message);const expected=experiment==='search'?300:3;close(C.subjectSummary(run).effects.primary,expected);
 const body=C.payload(run,'XYVTBN');assert.equal(body.experiment,C.EXPERIMENT_IDS[experiment]);assert.equal(body.trials.length,experiment==='search'?40:20);assert.deepEqual([...new Set(body.trials.map(t=>t.cond))].sort(),C.CONDITIONS[experiment].slice().sort());assert.ok(Buffer.byteLength(JSON.stringify(body))<256*1024);
 const tampered=structuredClone(run);tampered.trials[1].trial_id=tampered.trials[0].trial_id;assert.equal(C.inspectRun(tampered).ok,false);
 const wrong=structuredClone(run.trials[0]);wrong.correct=false;wrong.absolute_error=999;const recalculated=C.normalizeTrial(wrong,run);assert.equal(recalculated.correct,true);if(experiment==='ratio')close(recalculated.absolute_error,wrong.condition==='adjacent'?4:1);
 const timeout=C.normalizeTrial({...run.trials[0],timeout:true,response:null,estimate:null,rt_ms:null},run);assert.equal(timeout.correct,false);
 const old={...run,protocol:'attention-v2.2-short-20261101'};assert.equal(C.analyze([old]).completed_runs,0);assert.equal(C.analyze([{...run,mode:'demo'}]).completed_runs,0);
 const newer={...run,id:C.uid(),withdrawn:true,completed_at:new Date(Date.parse(run.completed_at)+1000).toISOString()};assert.equal(C.analyze([run,newer]).completed_runs,0);
}
const search=complete('search');for(const t of search.trials.filter(t=>t.condition==='baseline'&&t.target_present).slice(0,3))t.rt_ms=150;assert.equal(C.subjectSummary(search).effects.primary,null);
const badRatio=complete('ratio');badRatio.trials[0].shorter_position=badRatio.trials[0].shorter_position==='upper'?'lower':'upper';assert.equal(C.inspectRun(badRatio).ok,false);
const wrongChoices=complete('ratio');for(const t of wrongChoices.trials)t.shorter_response=t.shorter_position==='upper'?'lower':'upper';const allNumeric=C.subjectSummary(wrongChoices);assert.ok(C.inspectRun(wrongChoices).ok);close(allNumeric.effects.primary,3);assert.equal(allNumeric.valid_count,20);assert.equal(allNumeric.accuracy,0);assert.equal(allNumeric.effects.correct_only_primary,null);
for(const t of wrongChoices.trials.filter(t=>t.condition==='adjacent').slice(0,9)){t.timeout=true;t.estimate=null;t.response=null;t.rt_ms=null;}const partial=C.subjectSummary(wrongChoices);assert.equal(partial.cells['ratio:adjacent'].valid,1);close(partial.effects.primary,3);
const last=wrongChoices.trials.find(t=>t.condition==='adjacent'&&!t.timeout);last.timeout=true;last.estimate=null;last.response=null;last.rt_ms=null;assert.equal(C.subjectSummary(wrongChoices).effects.primary,null);
const firstCounts=Array(10).fill(0);for(let i=1;i<=5;i++){const t=C.makeRun('ratio','P0'+i).blocks[0].trials;for(let j=0;j<10;j++)if(t.find(x=>x.case_index===j).condition==='adjacent')firstCounts[j]++;}assert.ok(firstCounts.every(n=>n===2||n===3));
const backgroundRelations=new Set();for(let i=0;i<50;i++)for(const t of C.makeRun('ratio','B'+i).blocks[0].trials)backgroundRelations.add(t.background_values.reduce((a,b)=>a+b,0)>t.values.reduce((a,b)=>a+b,0));assert.equal(backgroundRelations.size,2);
close(C.paired([1,1,1,1,1]).p,.0625);assert.equal(C.paired([1,2,3,4]).p,null);
const report=C.analyze(Array.from({length:5},(_,i)=>['search','ratio'].map(e=>complete(e,'T0'+(i+1),i))).flat());assert.equal(report.participants,5);assert.equal(report.groups.search.analyzable_n,5);assert.equal(report.groups.ratio.analyzable_n,5);close(report.groups.search.effects.primary.p_holm,.125);
const window={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/js/build-info.js'),'utf8'),{window});
const text=fs.readFileSync(path.join(__dirname,'..',window.LAB_BUILD.predictions_file),'utf8').replace(/\r\n/g,'\n');assert.equal(crypto.createHash('sha256').update(text).digest('hex'),window.LAB_BUILD.predictions_sha256_lf);assert.equal(window.LAB_BUILD.protocol,C.PROTOCOL);
console.log('PASS: 100 stimulus schedules, key/scoring integrity, paired analysis, payloads, legacy isolation and prediction hash');
