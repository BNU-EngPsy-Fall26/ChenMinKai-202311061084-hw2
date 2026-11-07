const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
require('../dist/js/core.js');
let playwright;try{playwright=require('playwright');}catch{playwright=require(path.join(process.env.LAB_TEST_NODE_MODULES||'C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules','playwright'));}
const root=path.resolve(__dirname,'..'),artifacts=path.resolve(root,'../_验证临时');fs.mkdirSync(artifacts,{recursive:true});
const key='attention-lab:study-v2',base=process.env.LAB_TEST_URL||'http://127.0.0.1:53146/';
const errors=[],posts=[];
async function context(browser){
 const c=await browser.newContext({viewport:{width:1366,height:768},acceptDownloads:true});
 await c.route('https://attention-lab-production.up.railway.app/**',async route=>{
  const request=route.request();if(request.method()==='POST'){posts.push(request.postDataJSON());return route.fulfill({status:200,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'},body:JSON.stringify({ok:true})});}
  if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST,OPTIONS'}});
  return route.abort();
 });
 c.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));return c;
}
async function login(page,id='QA01'){
 await page.locator('#participant').fill(id);await page.locator('#consent').check();await page.locator('#login-form button[type=submit]').click();await page.locator('.cards').waitFor();
}
async function tick(page,ms=1100){await page.clock.runFor(ms);}
async function drive(page,experiment,{pause=true,stopAfterOneFormal=false,oneWrongChoice=false}={}){
 let paused=false,wrongChoiceUsed=false;
 for(let n=0;n<400;n++){
  if(await page.locator('.finish-panel').count())return;
  let acted=false;
  for(const action of ['runner-practice','runner-ready','runner-block','runner-next-block']){
   if(await page.locator(`[data-action="${action}"]`).count()){await page.locator(`[data-action="${action}"]`).click();acted=true;break;}
  }
  if(acted){await tick(page);continue;}
  const visible=await page.locator(experiment==='search'?'.trial-stage .search-array':'.trial-stage .divided-chart').count();
  if(!visible){await tick(page);continue;}
  await tick(page,250);
  const spec=await page.evaluate(key=>{const d=JSON.parse(localStorage.getItem(key));return d.runs.findLast(r=>r.status==='active')?.pending_trial?.spec;},key);
  assert.ok(spec,'stimulus must have a saved pending specification');
  if(pause&&!paused&&spec.phase==='formal'){
   await page.keyboard.press('Escape');await page.locator('[data-action=runner-resume]').waitFor();
   assert.ok(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).runs.some(r=>r.trials.some(t=>t.technical_invalid)),key));
   await page.locator('[data-action=runner-resume]').click();await tick(page);paused=true;continue;
  }
  if(experiment==='search'){
   const tCount=await page.locator('.search-array path').count();assert.equal(tCount,30);
   await page.keyboard.press(spec.target_present?'Shift+F':'Shift+J');
  }else{
   const geometry=await page.locator('.trial-stage .divided-chart').evaluate(svg=>{
    const points=[...svg.querySelectorAll('circle')].map(e=>({x:+e.getAttribute('cx'),y:+e.getAttribute('cy')}));
    const segments=points.map(p=>[...svg.querySelectorAll('rect')].find(e=>p.x>+e.getAttribute('x')&&p.x<+e.getAttribute('x')+ +e.getAttribute('width')&&p.y>+e.getAttribute('y')&&p.y<+e.getAttribute('y')+ +e.getAttribute('height'))).map(e=>({y:+e.getAttribute('y'),height:+e.getAttribute('height')})).sort((a,b)=>a.y-b.y);
    return{shorter:segments[0].height<segments[1].height?'upper':'lower',ratio:Math.min(...segments.map(s=>s.height))/Math.max(...segments.map(s=>s.height))*100};
   });
   assert.equal(geometry.shorter,spec.shorter_position);assert.ok(Math.abs(geometry.ratio-spec.true_ratio)<1e-7);
   const chosen=oneWrongChoice&&!wrongChoiceUsed&&spec.phase==='formal'?(wrongChoiceUsed=true,geometry.shorter==='upper'?'lower':'upper'):geometry.shorter;
   await tick(page,450);await page.locator(`.segment-choice label:has(input[value="${chosen}"])`).click();await page.locator('#estimate').fill(geometry.ratio.toFixed(1));await page.locator('#ratio-submit').click();
  }
  await tick(page);
  if(stopAfterOneFormal&&spec.phase==='formal')return;
 }
 throw Error('runner did not finish within the expected schedule');
}
async function researcher(page){await page.locator('[data-action=menu]').click();await page.locator('[data-action=researcher]').click();}
(async()=>{
 const browser=await playwright.chromium.launch({channel:'msedge',headless:true});
 try{
  const c=await context(browser),page=await c.newPage();
  await page.addInitScript(({key})=>{
   if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({schema:'attention-lab/store-v1',profiles:{},runs:[{id:'legacy-check',participant:'QA01',experiment:'search',mode:'formal',protocol:'attention-v2.2-short-20261101',status:'complete',created_at:'2026-11-01T00:00:00Z',completed_at:'2026-11-01T00:01:00Z',trials:[]}],imports:[],settings:{project:'XYVTBN',autoUpload:true}}));
  },{key});
  await page.goto(base);assert.equal(await page.evaluate(()=>LabCore.VERSION),'2.1.2');await login(page);
  assert.match(await page.locator('.total-progress').innerText(),/0 \/ 2/);assert.equal(await page.locator('.card-body>p,.page-heading p').count(),0);
  await page.screenshot({path:path.join(artifacts,'首页.png'),fullPage:true});
  await page.clock.install();
  await page.locator('[data-action=choose][data-experiment=search]').click();assert.match(await page.locator('.instruction-panel').innerText(),/绿色 T/);assert.equal(await page.locator('.instruction-panel .eyebrow').count(),0);
  await page.locator('[data-action=begin]').click();await drive(page,'search');
  const search=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).runs.find(r=>r.protocol===LabCore.PROTOCOL&&r.experiment==='search'),key);
  assert.equal(search.status,'complete');assert.equal(search.trials.filter(t=>t.phase==='formal'&&!t.technical_invalid&&!t.excluded_reason).length,40);assert.ok(search.trials.filter(t=>t.phase==='formal'&&!t.technical_invalid).every(t=>t.correct));
  await page.locator('[data-action=choose][data-experiment=ratio]').click();await page.screenshot({path:path.join(artifacts,'比例指导.png'),fullPage:true});await page.locator('[data-action=begin]').click();await drive(page,'ratio',{oneWrongChoice:true});
  const stored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
  assert.ok(stored.runs.some(r=>r.id==='legacy-check'),'legacy record must survive update');
  const ratio=stored.runs.find(r=>r.protocol==='attention-v4-two-condition-20261107'&&r.experiment==='ratio');assert.equal(ratio.status,'complete');
  const rows=ratio.trials.filter(t=>t.phase==='formal'&&!t.technical_invalid&&!t.excluded_reason);assert.equal(rows.length,20);assert.equal(rows.filter(t=>t.correct).length,19);assert.ok(rows.every(t=>t.absolute_error<1e-7));
  const numericSummary=await page.evaluate(r=>LabCore.subjectSummary(r),ratio);assert.equal(numericSummary.valid_count,20);assert.equal(numericSummary.effects.primary,0);
  await page.locator('[data-action=home]').click();await page.locator('[data-action=results]').click();
  assert.match(await page.locator('.metric-card').nth(0).innerText(),/1/);assert.equal(await page.locator('.result-card').count(),2);
  await page.screenshot({path:path.join(artifacts,'结果.png'),fullPage:true});
  const report=await page.evaluate(key=>LabCore.analyze(JSON.parse(localStorage.getItem(key)).runs),key);assert.equal(report.completed_runs,2);assert.equal(report.groups.search.analyzable_n,1);assert.equal(report.groups.ratio.analyzable_n,1);
  const csvDownload=page.waitForEvent('download');await page.locator('[data-action=export-all-csv]').click();const csv=await csvDownload;const csvPath=path.join(artifacts,'roundtrip.csv');await csv.saveAs(csvPath);
  const jsonDownload=page.waitForEvent('download');await page.locator('[data-action=export-all]').click();const json=await jsonDownload;const jsonPath=path.join(artifacts,'roundtrip.json');await json.saveAs(jsonPath);
  const data=JSON.parse(fs.readFileSync(jsonPath,'utf8'));assert.equal(data.runs.filter(r=>r.protocol==='attention-v4-two-condition-20261107').length,2);
  for(const source of [csvPath,jsonPath]){
   const importedContext=await context(browser),p=await importedContext.newPage();await p.goto(base);await login(p,'QA02');await researcher(p);await p.locator('#import-files').setInputFiles(source);
   await p.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).imports.length===2,key);
   const summary=await p.evaluate(key=>LabCore.analyze(JSON.parse(localStorage.getItem(key)).imports),key);assert.equal(summary.completed_runs,2);assert.equal(summary.groups.ratio.analyzable_n,1);
   await importedContext.close();
  }
  // Platform fixed columns plus trial-prefixed condition and metadata.
  const network=posts.slice();assert.equal(network.length,2);for(const body of network){assert.equal(body.project,'XYVTBN');assert.ok(['visual_search_ratio_v4','graphical_ratio_spacing_v4'].includes(body.experiment));assert.equal(body.trials.length,body.experiment.startsWith('visual')?40:20);assert.equal(new Set(body.trials.map(t=>t.cond)).size,2);assert.ok(body.trials.every(t=>t.phase==='formal'&&!t.technical_invalid));}
  const headers=['participant','experiment','condition','run_id','mode','protocol','status','created_at','completed_at','key_mapping','consent_at','consent_version',...Object.keys(network[0].trials[0]).filter(k=>!['participant','run_id','mode','protocol','status','created_at','completed_at','key_mapping','consent_at','consent_version','experiment'].includes(k))];
  const quote=v=>'"'+String(Array.isArray(v)?JSON.stringify(v):v??'').replace(/"/g,'""')+'"';
  const allFields=[...new Set([...headers,...network.flatMap(b=>b.trials.flatMap(t=>Object.keys(t)))])];
  const platformHeaders=allFields.map(k=>['condition','experiment','created_at','trial_index'].includes(k)?'trial.'+k:k);
  let platformCSV=['participant,experiment,condition,'+platformHeaders.map(quote).join(',')];
  for(const b of network)for(const t of b.trials){const record={participant:b.participant,...t};platformCSV.push([quote(b.participant),quote(b.experiment),quote(''),...allFields.map(k=>quote(record[k]))].join(','));}
  const platformPath=path.join(artifacts,'platform.csv');fs.writeFileSync(platformPath,platformCSV.join('\r\n'));
  const pc=await context(browser),pp=await pc.newPage();await pp.goto(base);await login(pp,'QA03');await researcher(pp);await pp.locator('#import-files').setInputFiles(platformPath);await pp.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).imports.length===2,key);await pc.close();
  const offline=await context(browser),op=await offline.newPage();const external=[];op.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});await op.goto(pathToFileURL(path.resolve(root,'../打开注意实验室.html')).href);assert.equal(await op.evaluate(()=>LabCore.PROTOCOL),'attention-v4-two-condition-20261107');await login(op,'QA04');assert.equal(external.length,0);await op.clock.install();await op.locator('[data-action=start-demo][data-experiment=search]').click();await op.locator('[data-action=begin]').click();await drive(op,'search',{pause:false});assert.equal(posts.length,2,'experience must not upload');await offline.close();
  const mobile=await context(browser),mp=await mobile.newPage();await mp.setViewportSize({width:390,height:844});await mp.goto(base);await login(mp,'QA05');assert.ok(await mp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await mobile.close();
  const recovery=await context(browser),rp=await recovery.newPage();
  await recovery.route('https://attention-lab-production.up.railway.app/api/hw2/submit',route=>route.abort('internetdisconnected'));
  await rp.goto(base);await login(rp,'QA06');await rp.clock.install();await rp.locator('[data-action=choose][data-experiment=search]').click();await rp.locator('[data-action=begin]').click();await drive(rp,'search',{pause:false,stopAfterOneFormal:true});
  const beforeReload=await rp.evaluate(key=>JSON.parse(localStorage.getItem(key)).runs.find(r=>r.status==='active').id,key);
  await rp.reload();await rp.locator('.cards').waitFor();await rp.locator('[data-action=choose][data-experiment=search]').click();await drive(rp,'search',{pause:false});
  let final;for(let i=0;i<25;i++){final=await rp.evaluate(({key,id})=>JSON.parse(localStorage.getItem(key)).runs.find(r=>r.id===id),{key,id:beforeReload});if(final.upload.status==='uncertain')break;await tick(rp,100);}
  assert.equal(final.status,'complete');assert.ok(final.trials.some(t=>t.excluded_reason==='restarted_block'));assert.equal(final.trials.filter(t=>t.phase==='formal'&&!t.excluded_reason&&!t.technical_invalid).length,40);assert.equal(final.upload.status,'uncertain');assert.match(await rp.locator('#finish-save-label').innerText(),/已保存/);await recovery.close();
  const regression=await context(browser),gp=await regression.newPage(),C=globalThis.LabCore,existing=C.makeRun('search','P01');existing.version='2.1.0';
  for(const [bi,b] of existing.blocks.entries())for(const [ti,t] of b.trials.entries()){
   const wrong=t.target_present&&t.case_index<(t.condition==='baseline'?13:11);
   existing.trials.push(C.normalizeTrial({...t,trial_id:`${existing.id}:${bi}:${ti}`,attempt_id:C.uid(),phase:'formal',block_index:bi,trial_index:ti,timeout:false,technical_invalid:false,rt_ms:t.condition==='baseline'?1000:700,response:wrong?'j':t.target_present?'f':'j'},existing));
  }
  existing.status='complete';existing.completed_at=new Date().toISOString();existing.upload={status:'confirmed'};
  const untouched=JSON.stringify({schema:'attention-lab/store-v1',profiles:{P01:{id:'P01',consent_version:'20261107-v4',consent_at:existing.created_at}},runs:[existing],imports:[],settings:{project:'XYVTBN',autoUpload:true}});
  await gp.addInitScript(({key,raw})=>{if(!localStorage.getItem(key))localStorage.setItem(key,raw);sessionStorage.setItem(key+':login','P01');},{key,raw:untouched});
  await gp.goto(base);await gp.locator('.cards').waitFor();await researcher(gp);await gp.getByText('作答汇总',{exact:true}).click();
  assert.equal(await gp.locator('.result-card').first().locator('.result-plot rect').count(),2);assert.match(await gp.locator('.results-page').innerText(),/17 \/ 19/);assert.match(await gp.locator('.results-page').innerText(),/已计算/);assert.equal(await gp.locator('text=核对有效数').count(),0);
  await gp.screenshot({path:path.join(artifacts,'低有效数对比.png'),fullPage:true});
  assert.equal(await gp.evaluate(key=>localStorage.getItem(key),key),untouched);await gp.reload();await gp.locator('.cards').waitFor();await researcher(gp);assert.equal(await gp.evaluate(key=>localStorage.getItem(key),key),untouched);assert.equal(await gp.locator('.result-card').first().locator('.result-plot rect').count(),2);await regression.close();
  assert.deepEqual(errors,[]);console.log('PASS: Edge tasks, imports, offline HTML, recovery, 17/19 comparison charts and byte-identical existing storage after analysis/reload; real course POST=0');
  await c.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
