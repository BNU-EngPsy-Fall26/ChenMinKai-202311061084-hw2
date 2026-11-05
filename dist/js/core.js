/* 实验协议、确定性随机化、刺激绘制和被试层面分析。无网络与界面状态依赖。 */
(function (root) {
  'use strict';
  const VERSION = '1.2.0';
  const PROTOCOL = 'attention-v2.2-short-20261101';
  const POLICIES = ['always', 'gated'];
  const POLICY_NAMES = { none: '自主搜索', always: '持续提示', gated: '择机提示' };
  const SUPPORT_NAMES = { none: '主图', aligned: '对齐比较窗' };
  const COLOR = { orange: '#cc6b32', blue: '#28649f', ink: '#193347', muted: '#c9d0d5' };
  const RATIOS = [20,28,36,44,52,60,68,76,82,88];
  const hash = s => { let x=2166136261; for (const c of String(s)) { x^=c.charCodeAt(0); x=Math.imul(x,16777619); } return x>>>0; };
  function random(seed) { let a=typeof seed==='number'?seed:hash(seed); return () => { a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  function shuffle(arr, rng) { const a=arr.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
  function assignment(participant) { const m=String(participant).match(/(\d+)$/); return m?Math.max(0,Number(m[1])-1):hash(participant)%120; }
  const uid = () => root.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,12)}`;
  const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function classicTrials(type, seed, practice=false) {
    const rng=random(seed), trials=[];
    for(let i=0;i<(practice?2:10);i++) trials.push({
      phase:practice?'practice':'formal',section:'classic',search_type:type,set_size:24,
      target_side:i%2?'right':'left',gap:(Math.floor(i/2)+i%2)%2?'right':'left',seed:Math.floor(rng()*4294967296)
    });
    return shuffle(trials,rng);
  }
  function aidTrials(policy, seed, practice=false) {
    const rng=random(seed),trials=[];
    // 每个“策略×可靠状态”10次；正确/错误提示是受控概率的实现，不另立少量试次推断。
    const cells=practice?[['high',true,1],['low',false,1]]:[['high',true,8],['high',false,2],['low',true,5],['low',false,5]];
    cells.forEach(([reliability,valid,n],ci)=>{for(let i=0;i<n;i++){
      const target_side=(i+ci%2)%2?'right':'left';
      trials.push({phase:practice?'practice':'formal',section:'aid',search_type:'conjunction',set_size:24,
        policy,reliability,potential_valid:valid,cue_shown:policy==='always'||policy==='gated'&&reliability==='high',
        target_side,cue_side:valid?target_side:(target_side==='left'?'right':'left'),
        gap:(Math.floor(i/2)+i%2+ci%2)%2?'right':'left',seed:Math.floor(rng()*4294967296)});
    }});
    return shuffle(trials,rng);
  }
  function ratioTrials(chart,support,seed,practice=false){
    const rng=random(seed);
    return shuffle((practice?[chart==='bar'?32:68]:RATIOS).map(r=>{
      const b=32+rng()*12,a=b*r/100,remain=100-a-b;
      const weights=[.75+rng()*.5,.75+rng()*.5,.75+rng()*.5],sum=weights.reduce((a,b)=>a+b,0);
      const items=shuffle([{label:'A',value:a},{label:'B',value:b},...weights.map((w,i)=>({label:String.fromCharCode(67+i),value:remain*w/sum}))],rng);
      return {phase:practice?'practice':'formal',section:'ratio',chart_type:chart,support,true_ratio:r,
        values:items.map(d=>d.value),labels:items.map(d=>d.label),rotation:rng()*360,seed:Math.floor(rng()*4294967296)};
    }),rng);
  }
  function makeRun(experiment,participant,mode='formal'){
    const id=uid(),seed=hash(id),index=assignment(participant),blocks=[];
    if(experiment==='search'){
      const types=index%2?['conjunction','feature']:['feature','conjunction'];
      types.forEach((type,i)=>blocks.push({id:'classic-'+type,section:'classic',search_type:type,title:'目标搜索',trials:classicTrials(type,seed+i)}));
      const policies=Math.floor(index/2)%2?['gated','always']:['always','gated'];
      policies.forEach((policy,i)=>blocks.push({id:'aid-'+policy,section:'aid',policy,title:POLICY_NAMES[policy],trials:aidTrials(policy,seed+100+i)}));
    }else{
      const cells=[['bar','none'],['bar','aligned'],['pie','none'],['pie','aligned']];
      [0,1,3,2].map(v=>(v+index%4)%4).forEach((v,i)=>{const [chart,support]=cells[v];blocks.push({id:chart+'-'+support,section:'ratio',chart_type:chart,support,title:'比例判断',trials:ratioTrials(chart,support,seed+i)});});
    }
    if(mode!=='formal')blocks.forEach(b=>b.trials=b.trials.slice(0,mode==='test'?3:4));
    return {schema:'attention-lab/run-v1',id,version:VERSION,protocol:PROTOCOL,preregistration:root.LAB_BUILD?{...root.LAB_BUILD}:null,
      experiment,participant,mode,assignment:index,seed,created_at:new Date().toISOString(),status:'active',
      mapping:index%2?{f:'right',j:'left'}:{f:'left',j:'right'},blocks,cursor:{block:0,trial:0},trials:[],practice_done:{},practice_rounds:{},upload:{status:'local'}};
  }
  function practiceTrials(run,section){
    const seed=run.seed+500+(run.practice_rounds[section]||0)*47;
    let trials;
    if(run.experiment==='ratio')trials=['bar','pie'].flatMap((c,i)=>['none','aligned'].flatMap((s,j)=>ratioTrials(c,s,seed+i*8+j,true)));
    else if(section==='classic')trials=[...classicTrials('feature',seed,true),...classicTrials('conjunction',seed+1,true)];
    else trials=[...aidTrials('always',seed,true),...aidTrials('gated',seed+1,true)];
    trials=shuffle(trials,random(seed+29));
    return run.mode==='formal'?trials:trials.slice(0,run.mode==='test'?2:4);
  }

  // 技术替代保留正式条件及真实比例，重新生成非关键数值和布局。
  function replacementTrial(trial,attempt){
    if(!attempt||trial.section!=='ratio')return {...trial};
    const stimulus_seed=hash('ratio-replacement:'+trial.seed+':'+attempt),rng=random(stimulus_seed);
    const b=32+rng()*12,a=b*trial.true_ratio/100,remaining=100-a-b;
    const weights=[.75+rng()*.5,.75+rng()*.5,.75+rng()*.5],sum=weights.reduce((a,b)=>a+b,0);
    const items=shuffle([{label:'A',value:a},{label:'B',value:b},...weights.map((w,i)=>({label:String.fromCharCode(67+i),value:remaining*w/sum}))],rng);
    return {...trial,values:items.map(d=>d.value),labels:items.map(d=>d.label),rotation:rng()*360,stimulus_seed};
  }
  function normalizeTrial(t,run){
    const row={...t};
    if(!Number.isInteger(t.seed)||t.seed<0||t.seed>4294967295)throw Error('刺激种子不完整');
    if(t.section==='classic'||t.section==='aid'){
      if(t.set_size!==24||!['feature','conjunction'].includes(t.search_type)||!['left','right'].includes(t.gap)||!['left','right'].includes(t.target_side))throw Error('搜索刺激字段不完整');
      if(!run.mapping||new Set([run.mapping.f,run.mapping.j]).size!==2||!['left','right'].includes(run.mapping.f)||!['left','right'].includes(run.mapping.j))throw Error('按键映射不完整');
      if(t.section==='aid'){
        if(t.search_type!=='conjunction'||!POLICIES.includes(t.policy)||!['high','low'].includes(t.reliability)||typeof t.potential_valid!=='boolean'||typeof t.cue_shown!=='boolean'||!['left','right'].includes(t.cue_side))throw Error('提示条件字段不完整');
        if(t.potential_valid!==(t.cue_side===t.target_side)||t.cue_shown!==(t.policy==='always'||t.policy==='gated'&&t.reliability==='high'))throw Error('提示记录与策略不一致');
      }
      if(!t.timeout&&!['f','j'].includes(String(t.response).toLowerCase()))throw Error('搜索按键记录不完整');
      row.correct=!t.timeout&&run.mapping[String(t.response).toLowerCase()]===t.gap;
    }else if(t.section==='ratio'){
      if(!['bar','pie'].includes(t.chart_type)||!['none','aligned'].includes(t.support))throw Error('比例条件字段不完整');
      if(!Number.isFinite(t.rotation)||t.rotation<0||t.rotation>=360)throw Error('图形方向不完整');
      if(!Array.isArray(t.values)||t.values.length!==5||!t.values.every(v=>Number.isFinite(v)&&v>0)||Math.abs(t.values.reduce((a,b)=>a+b,0)-100)>1e-5||!Array.isArray(t.labels)||t.labels.length!==5||new Set(t.labels).size!==5||!['A','B','C','D','E'].every(v=>t.labels.includes(v)))throw Error('图形数值不完整');
      const valueA=t.values[t.labels.indexOf('A')],valueB=t.values[t.labels.indexOf('B')],actual=valueA/valueB*100;
      if(!(valueA<valueB)||!Number.isFinite(t.true_ratio)||Math.abs(actual-t.true_ratio)>1e-5)throw Error('真实比例与图形不一致');
      row.true_ratio=t.true_ratio;
      if(!t.timeout){if(!Number.isFinite(t.estimate))throw Error('比例回答不完整');row.signed_error=t.estimate-row.true_ratio;row.absolute_error=Math.abs(row.signed_error);row.log_absolute_error=Math.log2(row.absolute_error+1/8);}
      else{row.estimate=null;row.signed_error=null;row.absolute_error=null;row.log_absolute_error=null;}
    }else throw Error('实验阶段不完整');
    if(!t.timeout&&!Number.isFinite(t.rt_ms))throw Error('作答时长不完整');
    return row;
  }
  // 原始尝试始终保留，派生正误与误差只在分析副本中重算。
  function analysisRows(run){return formalRows(run).map(t=>normalizeTrial(t,run));}
  function inspectRun(run){
    const fail=message=>({ok:false,message});
    if(!run||typeof run.id!=='string'||!run.id||run.id.length>120||!/^[A-Z][A-Z0-9_-]{1,11}$/.test(run.participant)||!['search','ratio'].includes(run.experiment)||!['formal','demo','test'].includes(run.mode)||!['active','complete','review'].includes(run.status)||!Array.isArray(run.trials)||run.trials.length>10000)return fail('会话结构不完整');
    if(run.protocol!==PROTOCOL)return fail('协议版本不一致');
    const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
    if(run.upload!=null&&!object(run.upload)||run.upload_history!=null&&(!object(run.upload_history)||!Object.values(run.upload_history).every(object)))return fail('提交回执结构不完整');
    if(run.runtime_versions!=null&&(!Array.isArray(run.runtime_versions)||!run.runtime_versions.every(v=>typeof v==='string')))return fail('运行版本结构不完整');
    if(run.withdrawn!=null&&typeof run.withdrawn!=='boolean')return fail('撤回状态格式不一致');
    for(const t of run.trials){if(t&&['timeout','technical_invalid'].some(k=>t[k]!=null&&typeof t[k]!=='boolean'))return fail('技术标记格式不一致');if(!t||typeof t.trial_id!=='string'||!t.trial_id||!['formal','practice'].includes(t.phase)||t.rt_ms!=null&&!Number.isFinite(t.rt_ms))return fail('试次编号或时长字段不完整');}
    let rows;try{rows=analysisRows(run);}catch(e){return fail(e.message);}
    if(new Set(rows.map(t=>t.trial_id)).size!==rows.length)return fail('同一正式试次存在重复有效记录');
    if(rows.some(t=>run.experiment==='search'?!['classic','aid'].includes(t.section):t.section!=='ratio'))return fail('试次与实验类型不一致');
    if(run.status==='complete'){
      if(!Number.isFinite(Date.parse(run.completed_at)))return fail('完成时刻不完整');
      if(run.mode==='formal'){
        const counts=new Map();for(const t of rows){const key=t.section==='classic'?'classic:'+t.search_type:t.section==='aid'?'aid:'+t.policy+':'+t.reliability:'ratio:'+t.chart_type+':'+t.support;counts.set(key,(counts.get(key)||0)+1);}
        const expected=run.experiment==='search'?['classic:feature','classic:conjunction',...POLICIES.flatMap(p=>['high','low'].map(r=>'aid:'+p+':'+r))]:['bar','pie'].flatMap(c=>['none','aligned'].map(p=>'ratio:'+c+':'+p));
        if(rows.length!==(run.experiment==='search'?60:40)||counts.size!==expected.length||!expected.every(key=>counts.get(key)===10))return fail('正式条件应各有10个完整试次');
        if(run.experiment==='search'){
          for(const p of POLICIES)for(const r of ['high','low'])if(rows.filter(t=>t.section==='aid'&&t.policy===p&&t.reliability===r&&t.potential_valid).length!==(r==='high'?8:5))return fail('提示正确率与协议不一致');
        }else{
          for(const c of ['bar','pie'])for(const a of ['none','aligned']){const actual=rows.filter(t=>t.chart_type===c&&t.support===a).map(t=>t.true_ratio).sort((x,y)=>x-y);if(!actual.every((v,i)=>Math.abs(v-RATIOS[i])<1e-5))return fail('正式比例分布与协议不一致');}
        }
      }else{
        if(run.blocks!=null&&(!Array.isArray(run.blocks)||!run.blocks.every(b=>b&&Array.isArray(b.trials)))||run.schedule_summary!=null&&(!Array.isArray(run.schedule_summary)||!run.schedule_summary.every(b=>b&&Number.isInteger(b.planned_trials)&&b.planned_trials>0)))return fail('体验计划结构不完整');
        const expected=run.blocks?.reduce((n,b)=>n+b.trials.length,0)??run.schedule_summary?.reduce((n,b)=>n+b.planned_trials,0);
        if(expected!=null&&rows.length!==expected)return fail('体验试次尚未完整');
      }
    }
    return {ok:true,rows};
  }

  function searchItems(trial, attempt=0) {
    const rng=random(trial.seed+attempt*7919), slots=[];
    for(let row=0;row<4;row++)for(let col=0;col<6;col++)slots.push({x:125+col*146,y:83+row*114,side:col<3?'left':'right'});
    const half=trial.set_size/2;
    const chosen=[...shuffle(slots.filter(d=>d.side==='left'),rng).slice(0,half),...shuffle(slots.filter(d=>d.side==='right'),rng).slice(0,half)];
    const candidates=chosen.map((d,i)=>d.side===trial.target_side?i:-1).filter(i=>i>=0);
    const targetIndex=candidates[Math.floor(rng()*candidates.length)];
    const oranges=new Set([targetIndex]);
    if(trial.search_type==='conjunction') for(const i of shuffle(chosen.map((d,i)=>i).filter(i=>i!==targetIndex),rng).slice(0,half-1))oranges.add(i);
    return chosen.map((d,i)=>({x:d.x+(rng()-.5)*16,y:d.y+(rng()-.5)*16,color:oranges.has(i)?COLOR.orange:COLOR.blue,shape:i===targetIndex||!oranges.has(i)?'C':'O',gap:i===targetIndex?trial.gap:(rng()<.5?'left':'right'),target:i===targetIndex}));
  }
  function glyph(x,y,shape,gap,color,r=16,width=4.5) {
    if(shape==='O')return `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${color}" stroke-width="${width}"/>`;
    const angle=gap==='right'?0:Math.PI, a=angle+.64,b=angle+Math.PI*2-.64;
    return `<path d="M ${x+r*Math.cos(a)} ${y+r*Math.sin(a)} A ${r} ${r} 0 1 1 ${x+r*Math.cos(b)} ${y+r*Math.sin(b)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
  }
  function searchSVG(trial, attempt=0) {return `<svg class="search-array" viewBox="0 0 980 510" role="img" aria-label="寻找橙色C并判断缺口方向">${searchItems(trial,attempt).map(d=>glyph(d.x,d.y,d.shape,d.gap,d.color)).join('')}</svg>`;}
  function barSVG(trial, aligned=false) {
    let items=trial.values.map((value,i)=>({value,label:trial.labels[i]}));
    if(aligned)items=['A','B'].map(label=>items.find(d=>d.label===label));
    const count=items.length, gap=aligned?66:30, width=aligned?66:43, total=count*width+(count-1)*gap, start=(390-total)/2;
    return `<svg class="data-chart" viewBox="0 0 390 310" role="img" aria-label="${aligned?'A与B的共同基线比较图':'包含A与B的条形图'}"><path d="M22 271 H368" stroke="#c9d0d5" stroke-width="1.5"/>${items.map((d,i)=>{
      const x=start+i*(width+gap), h=d.value*2.44, color=d.label==='A'?COLOR.orange:d.label==='B'?COLOR.blue:COLOR.muted;
      return `<rect x="${x}" y="${271-h}" width="${width}" height="${h}" rx="2" fill="${color}"/>${['A','B'].includes(d.label)?`<text x="${x+width/2}" y="294" text-anchor="middle" fill="${COLOR.ink}" font-size="17" font-family="Arial,sans-serif" font-weight="600">${d.label}</text>`:''}`;
    }).join('')}</svg>`;
  }
  function pieSVG(trial) {
    const cx=195,cy=151,r=105; let angle=trial.rotation*Math.PI/180;
    const arcs=[],labels=[];
    trial.values.forEach((value,i)=>{
      const next=angle+value/100*Math.PI*2, label=trial.labels[i],color=label==='A'?COLOR.orange:label==='B'?COLOR.blue:COLOR.muted;
      arcs.push(`<path d="M${cx} ${cy} L${cx+r*Math.cos(angle)} ${cy+r*Math.sin(angle)} A${r} ${r} 0 ${value>50?1:0} 1 ${cx+r*Math.cos(next)} ${cy+r*Math.sin(next)} Z" fill="${color}" stroke="#fff" stroke-width="2"/>`);
      if(label==='A'||label==='B'){const mid=(angle+next)/2;labels.push({label,x:cx+139*Math.cos(mid),y:cy+139*Math.sin(mid),ax:cx+108*Math.cos(mid),ay:cy+108*Math.sin(mid)});}
      angle=next;
    });
    if(labels.length===2&&Math.abs(labels[0].x-labels[1].x)<45&&Math.abs(labels[0].y-labels[1].y)<28){labels[0].y-=16;labels[1].y+=16;}
    return `<svg class="data-chart" viewBox="0 0 390 310" role="img" aria-label="包含A与B的饼图">${arcs.join('')}${labels.map(d=>`<path d="M${d.ax} ${d.ay} L${d.x} ${d.y}" stroke="#a5afb7" stroke-width="1"/><text x="${d.x}" y="${d.y+6}" text-anchor="middle" fill="${COLOR.ink}" font-size="18" font-family="Arial,sans-serif" font-weight="600">${d.label}</text>`).join('')}</svg>`;
  }
  const chartSVG=(trial,aligned=false)=>aligned||trial.chart_type==='bar'?barSVG(trial,aligned):pieSVG(trial);
  const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
  const median=a=>{if(!a.length)return null;const s=a.slice().sort((a,b)=>a-b),i=Math.floor(s.length/2);return s.length%2?s[i]:(s[i-1]+s[i])/2;};
  const round=(n,d=2)=>n==null?null:Number(n.toFixed(d));
  function paired(values) {
    const a=values.filter(Number.isFinite),n=a.length, estimate=mean(a); if(!n)return {n:0,mean:null,ci:null,p:null,values:[]};
    let ci=null,p=null;
    if(n>=5){const rng=random('paired:'+a.join(',')),boot=[];for(let i=0;i<2000;i++){let sum=0;for(let j=0;j<n;j++)sum+=a[Math.floor(rng()*n)];boot.push(sum/n);}boot.sort((a,b)=>a-b);ci=[boot[49],boot[1949]];
      const observed=Math.abs(estimate)-1e-10,total=n<=16?2**n:20000;let extreme=0;
      for(let i=0;i<total;i++){let sum=0;for(let j=0;j<n;j++)sum+=a[j]*(n<=16?(i&(1<<j)?1:-1):(rng()<.5?1:-1));if(Math.abs(sum/n)>=observed)extreme++;}p=n<=16?extreme/total:(extreme+1)/(total+1);
    }
    return {n,mean:estimate,ci,p,values:a};
  }
  function formalRows(run){return (run.trials||[]).filter(t=>t.phase==='formal'&&!t.technical_invalid&&!t.excluded_reason);}
  function subjectSummary(run){
    const rows=analysisRows(run),isSearch=run.experiment==='search';
    const accuracy=isSearch?mean(rows.map(t=>t.correct?1:0)):null,quality=isSearch?accuracy>=.75:true;
    const valid=rows.filter(t=>!t.timeout&&Number.isFinite(t.rt_ms)&&(isSearch?t.correct&&t.rt_ms>=150&&t.rt_ms<=5000:Number.isFinite(t.estimate)&&t.estimate>=0&&t.estimate<=100&&t.rt_ms>=500&&t.rt_ms<=30000));
    const cells={};
    function cell(key,raw,min=8){
      const ids=new Set(raw.map(t=>t.trial_id)),v=valid.filter(t=>ids.has(t.trial_id));
      cells[key]={key,total:raw.length,valid:v.length,rt:mean(v.map(t=>t.rt_ms)),ae:mean(v.map(t=>t.absolute_error)),
        median:median(v.map(t=>t.rt_ms)),error:isSearch?mean(raw.map(t=>t.correct?0:1)):null,timeout:mean(raw.map(t=>t.timeout?1:0)),
        bias:mean(v.map(t=>t.signed_error).filter(Number.isFinite)),lae:mean(v.map(t=>t.log_absolute_error).filter(Number.isFinite)),eligible:quality&&v.length>=min};
      return cells[key];
    }
    const effects={},difference=(a,b,field='rt')=>a?.eligible&&b?.eligible?a[field]-b[field]:null;
    if(isSearch){
      for(const type of ['feature','conjunction'])cell('classic:'+type+':24',rows.filter(t=>t.section==='classic'&&t.search_type===type));
      effects.classic=difference(cells['classic:conjunction:24'],cells['classic:feature:24']);
      for(const policy of POLICIES)for(const rel of ['high','low'])cell('aid:'+policy+':'+rel,rows.filter(t=>t.section==='aid'&&t.policy===policy&&t.reliability===rel));
      const c=(p,r)=>cells['aid:'+p+':'+r];
      effects.primary=difference(c('always','low'),c('gated','low'));
      effects.high_difference=difference(c('always','high'),c('gated','high'));
      effects.low_error=effects.primary!=null?c('always','low').error-c('gated','low').error:null;
      effects.overall=POLICIES.every(p=>['high','low'].every(r=>c(p,r).eligible))?
        ((c('always','high').rt+c('always','low').rt)-(c('gated','high').rt+c('gated','low').rt))/2:null;
    }else{
      for(const chart of ['bar','pie'])for(const support of ['none','aligned'])cell('ratio:'+chart+':'+support,rows.filter(t=>t.chart_type===chart&&t.support===support));
      const c=(a,b)=>cells['ratio:'+a+':'+b];
      effects.primary=difference(c('pie','none'),c('pie','aligned'),'ae');
      effects.classic=difference(c('pie','none'),c('bar','none'),'ae');
      effects.time_cost=difference(c('pie','aligned'),c('pie','none'),'rt');
    }
    return {participant:run.participant,run_id:run.id,experiment:run.experiment,quality,accuracy,raw_count:rows.length,valid_count:valid.length,cells,effects,completed_at:run.completed_at,experiment_order:run.experiment_order};
  }
  function analyze(runs){
    const unique=new Map(),diagnostics=[];
    for(const run of runs.filter(r=>r&&r.mode==='formal'&&r.status==='complete'&&r.protocol===PROTOCOL)){
      if(!Number.isFinite(Date.parse(run.completed_at))){diagnostics.push({run_id:run.id,participant:run.participant,experiment:run.experiment,reason:'完成时刻不完整'});continue;}
      const key=run.participant+'|'+run.experiment,prev=unique.get(key);
      if(!prev||Date.parse(run.completed_at)>Date.parse(prev.completed_at))unique.set(key,run);
    }
    const subjects=[];
    for(const run of unique.values()){
      if(run.withdrawn){diagnostics.push({run_id:run.id,participant:run.participant,experiment:run.experiment,reason:'已撤回'});continue;}
      const check=inspectRun(run);
      if(!check.ok){diagnostics.push({run_id:run.id,participant:run.participant,experiment:run.experiment,reason:check.message});continue;}
      subjects.push(subjectSummary(run));
    }
    const groups={};
    for(const experiment of ['search','ratio']){
      const ss=subjects.filter(s=>s.experiment===experiment),keys=[...new Set(ss.flatMap(s=>Object.keys(s.cells)))],cells={};
      for(const key of keys){const eligible=ss.map(s=>s.cells[key]).filter(c=>c?.eligible);cells[key]={key,n:eligible.length,rt:mean(eligible.map(c=>c.rt)),ae:mean(eligible.map(c=>c.ae).filter(Number.isFinite)),error:mean(eligible.map(c=>c.error).filter(Number.isFinite)),lae:mean(eligible.map(c=>c.lae).filter(Number.isFinite)),timeout:mean(eligible.map(c=>c.timeout))};}
      const effects={};for(const key of [...new Set(ss.flatMap(s=>Object.keys(s.effects)))])effects[key]=paired(ss.map(s=>s.effects[key]));
      groups[experiment]={n:ss.length,analyzable_n:effects.primary?.n||0,subjects:ss,cells,effects};
    }
    const tests=['search','ratio'].map(experiment=>({experiment,p:groups[experiment].effects.primary?.p})).filter(t=>Number.isFinite(t.p)).sort((a,b)=>a.p-b.p);
    if(tests.length===2){let prev=0;tests.forEach((t,i)=>{prev=Math.max(prev,Math.min(1,t.p*(tests.length-i)));groups[t.experiment].effects.primary.p_holm=prev;});}
    return {protocol:PROTOCOL,created_at:new Date().toISOString(),participants:new Set(subjects.map(s=>s.participant)).size,completed_runs:subjects.length,diagnostics,groups};
  }
  function payload(run, project) {
    const check=inspectRun(run);if(!check.ok||run.status!=='complete'||run.withdrawn)throw Error(check.message||'请选择完整有效记录');
    return {project,experiment:run.experiment==='search'?'visual_search':'graphical_ratio',participant:run.participant,condition:'',trials:analysisRows(run).map(t=>{
      const row={cond:t.section==='classic'?`${t.search_type}_${t.set_size}`:t.section==='aid'?`${t.policy}_${t.reliability}`:`${t.chart_type}_${t.support}`,trial_id:t.trial_id,run_id:run.id,protocol:PROTOCOL,seed:t.seed,rt:t.rt_ms??-1,rt_ms:t.rt_ms??-1,timeout:!!t.timeout,block:t.block_index,block_index:t.block_index,trial_index:t.trial_index,mode:run.mode,phase:'formal',status:'complete',experiment:run.experiment,created_at:run.created_at,completed_at:run.completed_at,consent_version:run.consent_version||'',consent_at:run.consent_at||'',key_mapping:JSON.stringify(run.mapping),experiment_order:run.experiment_order||''};
      for(const k of ['attempt_id','attempt_number','variation_index','stimulus_seed','runtime_version','section','set_size','search_type','policy','reliability','potential_valid','cue_shown','cue_side','target_side','gap','response','correct','estimate','true_ratio','absolute_error','signed_error','log_absolute_error','chart_type','support','values','rotation','trial_elapsed_ms'])if(t[k]!=null)row[k]=t[k];
      if(t.labels)row.labels=t.labels.join(",");
      return row;
    }),meta:{version:VERSION,protocol:PROTOCOL,run_id:run.id,consent_version:run.consent_version||'',consent_at:run.consent_at||'',prereg_commit:run.preregistration?.preregistration_commit||'',predictions_sha256_lf:run.preregistration?.predictions_sha256_lf||'',key_mapping:JSON.stringify(run.mapping),experiment_order:run.experiment_order||'',width:run.environment?.width||0,height:run.environment?.height||0,ua:run.environment?.ua||''}};
  }
  root.LabCore={VERSION,PROTOCOL,POLICIES,POLICY_NAMES,SUPPORT_NAMES,COLOR,RATIOS,hash,random,shuffle,assignment,uid,esc,makeRun,practiceTrials,replacementTrial,normalizeTrial,analysisRows,inspectRun,searchItems,glyph,searchSVG,chartSVG,mean,median,round,paired,formalRows,subjectSummary,analyze,payload};
})(typeof window!=='undefined'?window:globalThis);
