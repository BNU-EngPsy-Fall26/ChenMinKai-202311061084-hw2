/* 实验协议、确定性随机化、刺激绘制和被试层面分析。无网络与界面状态依赖。 */
(function (root) {
  'use strict';
  const VERSION = '1.0.0';
  const PROTOCOL = 'attention-v2.1-20261101';
  const POLICIES = ['none', 'always', 'gated'];
  const POLICY_NAMES = { none: '自主搜索', always: '持续提示', gated: '择机提示' };
  const SUPPORT_NAMES = { none: '主图', copy: '原图复制窗', aligned: '对齐比较窗' };
  const COLOR = { orange: '#cc6b32', blue: '#28649f', ink: '#193347', muted: '#c9d0d5' };
  const PERMS = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
  const RATIOS = [20,26,32,38,44,50,56,62,68,74,80,86];
  const hash = s => { let x=2166136261; for (const c of String(s)) { x^=c.charCodeAt(0); x=Math.imul(x,16777619); } return x>>>0; };
  function random(seed) { let a=typeof seed==='number'?seed:hash(seed); return () => { a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  function shuffle(arr, rng) { const a=arr.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
  function assignment(participant) { const m=String(participant).match(/(\d+)$/); return m?Math.max(0,Number(m[1])-1):hash(participant)%120; }
  const uid = () => root.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,12)}`;
  const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function classicTrials(type, seed, practice=false) {
    const rng=random(seed), trials=[];
    for(const n of [8,16,24]) for(let i=0;i<(practice?3:12);i++) trials.push({phase:practice?'practice':'formal', section:'classic', search_type:type, set_size:n, target_side:i%2?'right':'left', gap:Math.floor(i/2)%2?'right':'left', seed:Math.floor(rng()*4294967296)});
    return shuffle(trials,rng);
  }
  function aidTrials(policy, seed, practice=false) {
    const rng=random(seed), trials=[];
    const cells=practice?[['high',true,3],['high',false,1],['low',true,1],['low',false,1]]:[['high',true,30],['high',false,10],['low',true,10],['low',false,10]];
    cells.forEach(([reliability,valid,n],ci)=>{for(let i=0;i<n;i++){
      const target_side=i%2?'right':'left';
      trials.push({phase:practice?'practice':'formal',section:'aid',search_type:'conjunction',set_size:24,policy,reliability,potential_valid:valid,cue_shown:policy==='always'||policy==='gated'&&reliability==='high',target_side,cue_side:valid?target_side:(target_side==='left'?'right':'left'),gap:(Math.floor(i/2)+ci%2)%2?'right':'left',seed:Math.floor(rng()*4294967296)});
    }});
    return shuffle(trials,rng);
  }
  function ratioTrials(chart, support, seed, practice=false) {
    const rng=random(seed);
    return shuffle((practice?[32,68]:RATIOS).map(r=>{
      const b=32+rng()*12, a=b*r/100, remain=100-a-b;
      const weights=[.75+rng()*.5,.75+rng()*.5,.75+rng()*.5], sum=weights.reduce((a,b)=>a+b,0);
      const items=shuffle([{label:'A',value:a},{label:'B',value:b},...weights.map((w,i)=>({label:String.fromCharCode(67+i),value:remain*w/sum}))],rng);
      return {phase:practice?'practice':'formal',section:'ratio',chart_type:chart,support,true_ratio:r,values:items.map(d=>d.value),labels:items.map(d=>d.label),rotation:rng()*360,seed:Math.floor(rng()*4294967296)};
    }),rng);
  }
  function makeRun(experiment, participant, mode='formal') {
    const id=uid(), seed=hash(id), index=assignment(participant), blocks=[];
    if(experiment==='search') {
      const types=index%2?['conjunction','feature']:['feature','conjunction'];
      types.forEach((type,i)=>blocks.push({id:`classic-${type}`,section:'classic',search_type:type,title:'目标搜索',trials:classicTrials(type,seed+i)}));
      PERMS[index%6].forEach((p,i)=>blocks.push({id:`aid-${POLICIES[p]}`,section:'aid',policy:POLICIES[p],title:POLICY_NAMES[POLICIES[p]],trials:aidTrials(POLICIES[p],seed+100+i)}));
    } else {
      const cells=[['bar','none'],['bar','copy'],['bar','aligned'],['pie','none'],['pie','copy'],['pie','aligned']];
      const order=[0,1,5,2,4,3].map(v=>(v+index%6)%6);
      order.forEach((v,i)=>{const [chart,support]=cells[v];blocks.push({id:`${chart}-${support}`,section:'ratio',chart_type:chart,support,title:'比例判断',trials:ratioTrials(chart,support,seed+i)});});
    }
    if(mode!=='formal') blocks.forEach(b=>b.trials=b.trials.slice(0,mode==='test'?3:4));
    return {schema:'attention-lab/run-v1',id,version:VERSION,protocol:PROTOCOL,preregistration:root.LAB_BUILD?{...root.LAB_BUILD}:null,experiment,participant,mode,assignment:index,seed,created_at:new Date().toISOString(),status:'active',mapping:index%2?{f:'right',j:'left'}:{f:'left',j:'right'},blocks,cursor:{block:0,trial:0},trials:[],practice_done:{},practice_rounds:{},upload:{status:'local'}};
  }
  function practiceTrials(run, section) {
    const seed=run.seed+500+(run.practice_rounds[section]||0)*47;
    let trials;
    if(run.experiment==='ratio') trials=['bar','pie'].flatMap((c,i)=>['none','copy','aligned'].flatMap((s,j)=>ratioTrials(c,s,seed+i*8+j,true)));
    else if(section==='classic') trials=[...classicTrials('feature',seed,true),...classicTrials('conjunction',seed+1,true)];
    else trials=[...aidTrials('always',seed,true),...aidTrials('gated',seed+1,true)];
    trials=shuffle(trials,random(seed+29));
    return run.mode==='formal'?trials:trials.slice(0,run.mode==='test'?2:4);
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
  function slope(points){const x=mean(points.map(d=>d[0])), y=mean(points.map(d=>d[1]));return points.reduce((s,d)=>s+(d[0]-x)*(d[1]-y),0)/points.reduce((s,d)=>s+(d[0]-x)**2,0);}
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
  function subjectSummary(run) {
    const rows=formalRows(run),isSearch=run.experiment==='search';
    const accuracy=isSearch?mean(rows.map(t=>t.correct?1:0)):null;
    const quality=isSearch?accuracy>=.75:true;
    const valid=rows.filter(t=>!t.timeout&&Number.isFinite(t.rt_ms)&&(isSearch?t.correct&&t.rt_ms>=150&&t.rt_ms<=5000:Number.isFinite(t.estimate)&&t.estimate>=0&&t.estimate<=100&&t.rt_ms>=500&&t.rt_ms<=30000));
    const cells={};
    function cell(key,raw,min=0){const ids=new Set(raw.map(t=>t.trial_id));const v=valid.filter(t=>ids.has(t.trial_id));const rt=mean(v.map(t=>t.rt_ms)), ae=mean(v.map(t=>t.absolute_error));cells[key]={key,total:raw.length,valid:v.length,rt,ae,median:median(v.map(t=>t.rt_ms)),error:isSearch?mean(raw.map(t=>t.correct?0:1)):null,timeout:mean(raw.map(t=>t.timeout?1:0)),bias:mean(v.map(t=>t.signed_error).filter(Number.isFinite)),lae:mean(v.map(t=>t.log_absolute_error).filter(Number.isFinite)),eligible:quality&&v.length>=min};return cells[key];}
    const effects={};
    if(isSearch){
      const slopes={};for(const type of ['feature','conjunction']){const cs=[8,16,24].map(n=>cell(`classic:${type}:${n}`,rows.filter(t=>t.section==='classic'&&t.search_type===type&&t.set_size===n),10));slopes[type]=cs.every(c=>c.eligible)?slope(cs.map((c,i)=>[[8,16,24][i],c.rt])):null;}
      effects.classic=slopes.feature!=null&&slopes.conjunction!=null?slopes.conjunction-slopes.feature:null;
      for(const policy of POLICIES)for(const rel of ['high','low'])cell(`aid:${policy}:${rel}`,rows.filter(t=>t.section==='aid'&&t.policy===policy&&t.reliability===rel),rel==='high'?32:16);
      const c=(p,r)=>cells[`aid:${p}:${r}`],difference=(a,b,field='rt')=>a?.eligible&&b?.eligible?a[field]-b[field]:null;
      effects.primary=difference(c('always','low'),c('gated','low'));
      effects.high_benefit=difference(c('none','high'),c('gated','high'));
      effects.low_error=c('always','low')?.total&&c('gated','low')?.total?c('always','low').error-c('gated','low').error:null;
      effects.overall=['always','gated'].every(p=>['high','low'].every(r=>c(p,r).eligible))?((c('always','high').rt*2+c('always','low').rt)-(c('gated','high').rt*2+c('gated','low').rt))/3:null;
      for(const rel of ['high','low'])for(const validity of [true,false])cell(`detail:always:${rel}:${validity}`,rows.filter(t=>t.section==='aid'&&t.policy==='always'&&t.reliability===rel&&t.potential_valid===validity),validity&&rel==='high'?24:8);
      effects.feature_slope=slopes.feature;effects.conjunction_slope=slopes.conjunction;
    }else{
      for(const chart of ['bar','pie'])for(const support of ['none','copy','aligned'])cell(`ratio:${chart}:${support}`,rows.filter(t=>t.chart_type===chart&&t.support===support),10);
      const c=(a,b)=>cells[`ratio:${a}:${b}`],diff=(a,b,field='ae')=>a.eligible&&b.eligible?a[field]-b[field]:null;
      effects.primary=diff(c('pie','copy'),c('pie','aligned'));
      effects.practical=diff(c('pie','none'),c('pie','aligned'));
      effects.classic=diff(c('pie','none'),c('bar','none'));
      effects.time_cost=diff(c('pie','aligned'),c('pie','copy'),'rt');
    }
    return {participant:run.participant,run_id:run.id,experiment:run.experiment,quality,accuracy,raw_count:rows.length,valid_count:valid.length,cells,effects,completed_at:run.completed_at,experiment_order:run.experiment_order};
  }
  function analyze(runs) {
    const unique=new Map();
    for(const run of runs.filter(r=>r.mode==='formal'&&r.status==='complete'&&r.protocol===PROTOCOL)){
      const key=run.participant+'|'+run.experiment,prev=unique.get(key);if(!prev||String(run.completed_at)>String(prev.completed_at))unique.set(key,run);
    }
    const subjects=[...unique.values()].map(subjectSummary),groups={};
    for(const experiment of ['search','ratio']){
      const ss=subjects.filter(s=>s.experiment===experiment),keys=[...new Set(ss.flatMap(s=>Object.keys(s.cells)))],cells={};
      for(const key of keys){const eligible=ss.map(s=>s.cells[key]).filter(c=>c?.eligible);cells[key]={key,n:eligible.length,rt:mean(eligible.map(c=>c.rt)),ae:mean(eligible.map(c=>c.ae).filter(Number.isFinite)),error:mean(eligible.map(c=>c.error).filter(Number.isFinite)),lae:mean(eligible.map(c=>c.lae).filter(Number.isFinite)),timeout:mean(eligible.map(c=>c.timeout))};}
      const effects={};for(const key of [...new Set(ss.flatMap(s=>Object.keys(s.effects)))])effects[key]=paired(ss.map(s=>s.effects[key]));
      groups[experiment]={n:ss.length,subjects:ss,cells,effects};
    }
    const tests=['search','ratio'].map(experiment=>({experiment,p:groups[experiment].effects.primary?.p})).filter(t=>Number.isFinite(t.p)).sort((a,b)=>a.p-b.p);
    // 只有两个主要检验都可计算时，才报告完整预注册检验族的Holm结果。
    if(tests.length===2){let prev=0;tests.forEach((t,i)=>{prev=Math.max(prev,Math.min(1,t.p*(tests.length-i)));groups[t.experiment].effects.primary.p_holm=prev;});}
    return {protocol:PROTOCOL,created_at:new Date().toISOString(),participants:new Set(subjects.map(s=>s.participant)).size,completed_runs:subjects.length,groups};
  }
  function payload(run, project) {
    return {project,experiment:run.experiment==='search'?'visual_search':'graphical_ratio',participant:run.participant,condition:'',trials:formalRows(run).map(t=>{
      const row={cond:t.section==='classic'?`${t.search_type}_${t.set_size}`:t.section==='aid'?`${t.policy}_${t.reliability}`:`${t.chart_type}_${t.support}`,trial_id:t.trial_id,run_id:run.id,protocol:PROTOCOL,seed:t.seed,rt:t.rt_ms??-1,timeout:!!t.timeout,block:t.block_index,mode:run.mode};
      for(const k of ['attempt_id','attempt_number','section','set_size','search_type','policy','reliability','potential_valid','cue_shown','cue_side','target_side','gap','response','correct','estimate','true_ratio','absolute_error','signed_error','log_absolute_error','chart_type','support','values','rotation','trial_elapsed_ms'])if(t[k]!=null)row[k]=t[k];
      if(t.labels)row.labels=t.labels.join(",");
      return row;
    }),meta:{version:VERSION,protocol:PROTOCOL,run_id:run.id,consent_version:run.consent_version||'',prereg_commit:run.preregistration?.preregistration_commit||'',predictions_sha256_lf:run.preregistration?.predictions_sha256_lf||'',key_mapping:JSON.stringify(run.mapping),experiment_order:run.experiment_order||'',width:run.environment?.width||0,height:run.environment?.height||0,ua:run.environment?.ua||''}};
  }
  root.LabCore={VERSION,PROTOCOL,POLICIES,POLICY_NAMES,SUPPORT_NAMES,COLOR,RATIOS,hash,random,shuffle,assignment,uid,esc,makeRun,practiceTrials,searchItems,glyph,searchSVG,chartSVG,mean,median,round,slope,paired,formalRows,subjectSummary,analyze,payload};
})(typeof window!=='undefined'?window:globalThis);
