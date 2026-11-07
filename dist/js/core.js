/* 确定性刺激、记录校验与被试内分析。 */
(function (root) {
  'use strict';
  const VERSION='2.1.2', PROTOCOL='attention-v4-two-condition-20261107', ANALYSIS_POLICY='all-available-v1';
  const EXPERIMENT_IDS={search:'visual_search_ratio_v4',ratio:'graphical_ratio_spacing_v4'};
  const CONDITIONS={search:['baseline','improved'],ratio:['adjacent','separated']};
  const CONDITION_NAMES={baseline:'等量干扰',improved:'偏置比例',adjacent:'相邻',separated:'间隔一段'};
  const COLOR={green:'#28734d',brown:'#8b5837',orange:'#cc6b32',blue:'#28649f',ink:'#193347',muted:'#c9d0d5'};
  const RATIOS=[17.8,26.1,38.3,46.4,46.4,56.2,68.1,68.1,82.5,82.5];
  const hash=s=>{let x=2166136261;for(const c of String(s)){x^=c.charCodeAt(0);x=Math.imul(x,16777619);}return x>>>0;};
  function random(seed){let a=typeof seed==='number'?seed:hash(seed);return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  function shuffle(arr,rng=random(0)){const a=arr.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  function assignment(id){const m=String(id).match(/(\d+)$/);return m?Math.max(0,Number(m[1])-1):hash(id)%120;}
  const uid=()=>root.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,12)}`;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
  const median=a=>{if(!a.length)return null;const s=a.slice().sort((a,b)=>a-b),i=Math.floor(s.length/2);return s.length%2?s[i]:(s[i-1]+s[i])/2;};
  const round=(n,d=2)=>n==null?null:Number(n.toFixed(d));
  function searchTrials(condition,seed,index,practice=false,layoutSeed=seed){
    const rng=random(seed),out=[];
    for(let present=0;present<2;present++)for(let i=0;i<(practice?1:10);i++)out.push({
      phase:practice?'practice':'formal',section:'search',condition,search_type:'conjunction',set_size:30,
      target_present:!!present,target_zone:present?(i+2*index)%8:null,case_index:present*10+i,position_seed:hash(`${layoutSeed}:position:${present}:${i}`),
      green_x:condition==='baseline'?15:27,brown_t:(condition==='baseline'?15:3)-present,
      seed:Math.floor(rng()*4294967296)
    });
    let trials;
    for(let n=0;n<100;n++){trials=shuffle(out,rng);if(trials.every((t,i)=>i<3||![1,2,3].every(j=>trials[i-j].target_present===t.target_present)))break;}
    return trials;
  }
  function ratioSpec(condition,true_ratio,reference_height,shorter_position,seed,case_index,phase='formal'){
    const axis_max=600,short=reference_height*true_ratio/100,long=reference_height;
    const contextRng=random(hash(`${seed}:context`)),backgroundRng=random(hash(`${seed}:background`));
    const contextTotal=24+contextRng()*(axis_max-short-long-24),first=12+contextRng()*(contextTotal-24),context=[first,contextTotal-first];
    const upper=shorter_position==='upper'?short:long,lower=shorter_position==='upper'?long:short;
    const values=condition==='adjacent'?[...context,lower,upper]:[context[0],lower,context[1],upper];
    const lowIndex=condition==='adjacent'?2:1;
    const labels=values.map((v,i)=>i===3?(shorter_position==='upper'?'A':'B'):i===lowIndex?(shorter_position==='upper'?'B':'A'):null);
    let letter=67;for(let i=0;i<labels.length;i++)if(labels[i]==null)labels[i]=String.fromCharCode(letter++);
    const backgroundTotal=axis_max*(.35+.6*backgroundRng()),weights=Array.from({length:4},()=>.2+backgroundRng()),weightSum=weights.reduce((a,b)=>a+b,0);
    const background_values=weights.map(w=>12+(backgroundTotal-48)*w/weightSum);
    return{phase,section:'ratio',condition,chart_type:'divided_bar',separation:condition==='adjacent'?0:1,
      true_ratio,reference_height,shorter_position,case_index,axis_max,values,labels,background_values,seed};
  }
  function ratioTrials(seed,practice=false,index=0){
    const source=practice?[32,68]:RATIOS,rng=random(hash(`${seed}:schedule`)),half=source.length/2;
    const heights=shuffle([...Array(half).fill(125),...Array(half).fill(250)],random(hash(`${seed}:heights`)));
    let positions;
    for(let n=0;n<1000;n++){
      positions=shuffle([...Array(half).fill('upper'),...Array(half).fill('lower')],rng);
      if(practice||[125,250].every(h=>['upper','lower'].every(p=>heights.filter((v,i)=>v===h&&positions[i]===p).length>=2)))break;
    }
    const cases=source.map((ratio,i)=>({i,first:(i+index)%2===0?'adjacent':'separated',trials:Object.fromEntries(CONDITIONS.ratio.map(c=>[c,ratioSpec(c,ratio,heights[i],positions[i],hash(`${seed}:case:${i}`),i,practice?'practice':'formal')]))}));
    for(let n=0;n<2000;n++){
      const out=[];
      for(const second of [false,true]){
        const a=shuffle(cases.filter(c=>c.first==='adjacent'),rng),b=shuffle(cases.filter(c=>c.first==='separated'),rng);
        for(let i=0;i<half;i++)out.push(...shuffle([a[i].trials[second?'separated':'adjacent'],b[i].trials[second?'adjacent':'separated']],rng));
      }
      if(out.every((t,i)=>i===0||t.true_ratio!==out[i-1].true_ratio))return out;
    }
    throw Error('材料顺序生成待核对');
  }
  function makeRun(experiment,participant,mode='formal'){
    if(!CONDITIONS[experiment])throw Error('请选择实验');
    const id=uid(),seed=hash(id),index=assignment(participant);let blocks;
    if(experiment==='search'){
      const order=[false,true,true,false,false][index%5]?['improved','baseline']:['baseline','improved'];
      blocks=order.map((condition,i)=>({id:'search-'+condition,section:'search',condition,title:'搜索',trials:searchTrials(condition,seed+i*101,index,false,seed)}));
      if(mode!=='formal')blocks.forEach(b=>b.trials=[b.trials.find(t=>t.target_present),b.trials.find(t=>!t.target_present)]);
    }else{
      let trials=ratioTrials(seed,false,index);if(mode!=='formal')trials=ratioTrials(seed,true,index);
      blocks=[{id:'ratio-mixed',section:'ratio',title:'比例判断',trials}];
    }
    return{schema:'attention-lab/run-v2',id,version:VERSION,protocol:PROTOCOL,preregistration:root.LAB_BUILD?{...root.LAB_BUILD}:null,
      experiment,participant,mode,assignment:index,seed,created_at:new Date().toISOString(),status:'active',
      mapping:{f:'present',j:'absent'},blocks,cursor:{block:0,trial:0},trials:[],practice_done:{},practice_rounds:{},upload:{status:'local'}};
  }
  function practiceTrials(run,section){
    const seed=run.seed+500+(run.practice_rounds[section]||0)*47;
    if(run.experiment==='ratio')return ratioTrials(seed,true,run.assignment);
    return shuffle(CONDITIONS.search.flatMap((c,i)=>searchTrials(c,seed+i,run.assignment,true)),random(seed+29));
  }
  function replacementTrial(t,attempt){
    if(!attempt||t.section!=='ratio')return{...t};
    const stimulus_seed=hash(`replacement:${t.seed}:${attempt}`);
    return{...t,...ratioSpec(t.condition,t.true_ratio,t.reference_height,t.shorter_position,stimulus_seed,t.case_index,t.phase),seed:t.seed,stimulus_seed};
  }
  function zone(x,y){const nx=(x-490)/490,ny=(y-255)/255;const direction=Math.abs(nx)>Math.abs(ny)?(nx>0?1:3):(ny>0?2:0);const inner=((x-490)/297.5)**2+((y-255)/175.3)**2<=1;return direction*2+(inner?0:1);}
  function searchItems(t,attempt=0){
    const rng=random(t.seed+attempt*7919),positions=random(t.position_seed+attempt*7919),slots=[];
    for(let row=0;row<5;row++)for(let col=0;col<6;col++){const x=90+col*160+(positions()-.5)*14,y=55+row*100+(positions()-.5)*14;slots.push({x,y,zone:zone(x,y)});}
    let targetIndex=-1;
    if(t.target_present){const candidates=slots.map((d,i)=>d.zone===t.target_zone?i:-1).filter(i=>i>=0);if(!candidates.length)throw Error('目标位置生成待核对');targetIndex=candidates[Math.floor(positions()*candidates.length)];}
    const other=shuffle(slots.map((d,i)=>i).filter(i=>i!==targetIndex),rng),green=new Set(other.slice(0,t.green_x));
    return slots.map((d,i)=>({...d,shape:i===targetIndex?'T':green.has(i)?'X':'T',color:i===targetIndex||green.has(i)?COLOR.green:COLOR.brown,target:i===targetIndex}));
  }
  function letter(x,y,shape,color,size=30){const h=size/2,w=size*.34;return `<path d="${shape==='T'?`M${x-w} ${y-h}H${x+w}M${x} ${y-h}V${y+h}`:`M${x-w} ${y-h}L${x+w} ${y+h}M${x+w} ${y-h}L${x-w} ${y+h}`}" fill="none" stroke="${color}" stroke-width="3.4" stroke-linecap="square"/>`;}
  function searchSVG(t,attempt=0){return `<svg class="search-array" viewBox="0 0 980 510" role="img" aria-label="搜索绿色T">${searchItems(t,attempt).map(d=>letter(d.x,d.y,d.shape,d.color)).join('')}</svg>`;}
  function chartSVG(t){
    const height=580,scale=.8,base=520,width=80;
    let content=`<path d="M120 40V${base}H520" fill="none" stroke="#adb5bc" stroke-width="1.2"/><g fill="#52636e" font-family="Arial,sans-serif" font-size="17"><text x="109" y="${base+6}" text-anchor="end">0</text><text x="109" y="46" text-anchor="end">100</text><text x="260" y="552" text-anchor="middle">A</text><text x="440" y="552" text-anchor="middle">B</text></g>`;
    [[t.values,220,true],[t.background_values,400,false]].forEach(([values,x,mark])=>{let y=base;values.forEach((v,i)=>{const h=v*scale;y-=h;content+=`<rect x="${x}" y="${y}" width="${width}" height="${h}" fill="white" stroke="#344653" stroke-width="1.8"/>`;if(mark&&['A','B'].includes(t.labels[i]))content+=`<circle cx="${x+width/2}" cy="${y+h/2}" r="3.3" fill="#243846"/>`;});});
    return `<svg class="divided-chart" viewBox="0 0 640 ${height}" role="img" aria-label="比较同柱中两个圆点标记的分段">${content}</svg>`;
  }
  function normalizeTrial(t,run){
    if(!Number.isInteger(t.seed)||t.seed<0||t.seed>4294967295)throw Error('刺激种子待核对');
    const row={...t};
    if(t.section==='search'){
      if(!Number.isInteger(t.position_seed)||t.position_seed<0||t.position_seed>4294967295||!Number.isInteger(t.case_index)||!CONDITIONS.search.includes(t.condition)||t.search_type!=='conjunction'||t.set_size!==30||typeof t.target_present!=='boolean'||t.green_x!==(t.condition==='baseline'?15:27)||t.brown_t!==(t.condition==='baseline'?15:3)-Number(t.target_present)||t.target_present&&(!Number.isInteger(t.target_zone)||t.target_zone<0||t.target_zone>7))throw Error('搜索刺激待核对');
      if(run.mapping?.f!=='present'||run.mapping?.j!=='absent')throw Error('按键映射待核对');
      if(!t.timeout&&!['f','j'].includes(String(t.response).toLowerCase()))throw Error('搜索作答待核对');
      row.correct=!t.timeout&&(run.mapping[String(t.response).toLowerCase()]===(t.target_present?'present':'absent'));
    }else if(t.section==='ratio'){
      if(!CONDITIONS.ratio.includes(t.condition)||t.chart_type!=='divided_bar'||t.separation!==(t.condition==='adjacent'?0:1))throw Error('比例布局待核对');
      if(!Array.isArray(t.values)||t.values.length!==4||!t.values.every(v=>Number.isFinite(v)&&v>0)||!Array.isArray(t.labels)||t.labels.length!==4||new Set(t.labels).size!==4||!['A','B','C','D'].every(v=>t.labels.includes(v))||!Array.isArray(t.background_values)||t.background_values.length!==4||!t.background_values.every(v=>Number.isFinite(v)&&v>0))throw Error('分段数值待核对');
      const a=t.labels.indexOf('A'),b=t.labels.indexOf('B'),ratio=t.values[a]/t.values[b]*100;
      const indices=[a,b].sort((x,y)=>x-y),expected=t.condition==='adjacent'?[2,3]:[1,3];
      if(t.axis_max!==600||t.values.reduce((a,b)=>a+b,0)>600||t.background_values.reduce((a,b)=>a+b,0)>600||!indices.every((v,i)=>v===expected[i])||!(ratio>0&&ratio<100)||Math.abs(ratio-t.true_ratio)>1e-7||![125,250].includes(t.reference_height)||Math.abs(t.values[b]-t.reference_height)>1e-7||t.shorter_position!==(a>b?'upper':'lower')||!Number.isInteger(t.case_index))throw Error('真实比例或标记位置待核对');
      row.true_ratio=ratio;
      if(!t.timeout){
        if(!Number.isFinite(t.estimate)||t.estimate<0||t.estimate>100||!['upper','lower'].includes(t.shorter_response))throw Error('比例作答待核对');
        row.correct=t.shorter_response===t.shorter_position;
        row.signed_error=t.estimate-ratio;row.absolute_error=Math.abs(row.signed_error);row.log_absolute_error=Math.log2(row.absolute_error+1/8);
      }else{row.correct=false;row.estimate=null;row.signed_error=null;row.absolute_error=null;row.log_absolute_error=null;}
    }else throw Error('实验阶段待核对');
    if(!t.timeout&&(!Number.isFinite(t.rt_ms)||t.rt_ms<0))throw Error('作答时长待核对');
    return row;
  }
  function formalRows(run){return(run.trials||[]).filter(t=>t.phase==='formal'&&!t.technical_invalid&&!t.excluded_reason);}
  function analysisRows(run){return formalRows(run).map(t=>normalizeTrial(t,run));}
  function inspectRun(run){
    const fail=message=>({ok:false,message}),object=x=>x&&typeof x==='object'&&!Array.isArray(x);
    if(!run||typeof run.id!=='string'||!run.id||run.id.length>120||!/^[A-Z][A-Z0-9_-]{1,11}$/.test(run.participant)||!CONDITIONS[run.experiment]||!['formal','demo','test'].includes(run.mode)||!['active','complete','review'].includes(run.status)||!Array.isArray(run.trials)||run.trials.length>10000)return fail('会话结构待核对');
    if(run.protocol!==PROTOCOL)return fail('历史协议记录');
    if(run.upload!=null&&!object(run.upload)||run.upload_history!=null&&(!object(run.upload_history)||!Object.values(run.upload_history).every(object)))return fail('回执结构待核对');
    if(run.withdrawn!=null&&typeof run.withdrawn!=='boolean')return fail('撤回标记待核对');
    for(const t of run.trials)if(!object(t)||typeof t.trial_id!=='string'||!t.trial_id||!['formal','practice'].includes(t.phase)||['timeout','technical_invalid'].some(k=>t[k]!=null&&typeof t[k]!=='boolean'))return fail('试次结构待核对');
    let rows;try{rows=analysisRows(run);}catch(e){return fail(e.message);}
    if(new Set(rows.map(t=>t.trial_id)).size!==rows.length)return fail('有效试次编号待核对');
    if(rows.some(t=>t.section!==(run.experiment==='search'?'search':'ratio')))return fail('实验类型待核对');
    if(run.status==='complete'){
      if(!Number.isFinite(Date.parse(run.completed_at)))return fail('完成时刻待核对');
      if(run.mode==='formal'){
        if(rows.length!==(run.experiment==='search'?40:20))return fail('正式试次数待核对');
        for(const condition of CONDITIONS[run.experiment]){
          const cell=rows.filter(t=>t.condition===condition);
          if(cell.length!==(run.experiment==='search'?20:10))return fail('条件试次数待核对');
          if(run.experiment==='search'){if(cell.filter(t=>t.target_present).length!==10)return fail('目标比例待核对');}
          else{const ratios=cell.map(t=>t.true_ratio).sort((a,b)=>a-b);if(!ratios.every((v,i)=>Math.abs(v-RATIOS[i])<1e-7)||cell.filter(t=>t.reference_height===125).length!==5||cell.filter(t=>t.shorter_position==='upper').length!==5)return fail('比例材料分布待核对');}
        }
      }else{
        const expected=run.blocks?.reduce((n,b)=>n+b.trials.length,0)??run.schedule_summary?.reduce((n,b)=>n+b.planned_trials,0);
        if(!Number.isInteger(expected)||rows.length!==expected)return fail('体验计划待核对');
      }
    }
    return{ok:true,rows};
  }
  function paired(values){
    const a=values.filter(Number.isFinite),n=a.length,estimate=mean(a);if(!n)return{n:0,mean:null,median:null,ci:null,p:null,values:[]};let p=null;
    {const observed=Math.abs(estimate)-1e-10,total=n<=16?2**n:20000,rng=random('sign:'+a.join(','));let extreme=0;for(let i=0;i<total;i++){let sum=0;for(let j=0;j<n;j++)sum+=a[j]*(n<=16?(i&(1<<j)?1:-1):(rng()<.5?1:-1));if(Math.abs(sum/n)>=observed)extreme++;}p=n<=16?extreme/total:(extreme+1)/(total+1);}
    return{n,mean:estimate,median:median(a),ci:null,p,values:a};
  }
  function subjectSummary(run){
    const rows=analysisRows(run),isSearch=run.experiment==='search',cells={},effects={};
    const valid=rows.filter(t=>!t.timeout&&Number.isFinite(t.rt_ms)&&(isSearch?t.correct:Number.isFinite(t.estimate)));
    for(const condition of CONDITIONS[run.experiment]){
      const raw=rows.filter(t=>t.condition===condition),v=valid.filter(t=>t.condition===condition),correct=v.filter(t=>t.correct);
      const cell={key:run.experiment+':'+condition,total:raw.length,valid:v.length,rt:mean(v.map(t=>t.rt_ms)),median:median(v.map(t=>t.rt_ms)),ae:mean(v.map(t=>t.absolute_error).filter(Number.isFinite)),bias:mean(v.map(t=>t.signed_error).filter(Number.isFinite)),lae:mean(v.map(t=>t.log_absolute_error).filter(Number.isFinite)),error:mean(raw.map(t=>t.correct?0:1)),timeout:mean(raw.map(t=>t.timeout?1:0)),eligible:false};
      if(isSearch){cell.present=median(v.filter(t=>t.target_present).map(t=>t.rt_ms));cell.absent=median(v.filter(t=>!t.target_present).map(t=>t.rt_ms));cell.present_valid=v.filter(t=>t.target_present).length;cell.absent_valid=v.filter(t=>!t.target_present).length;cell.rt=mean([cell.present,cell.absent].filter(Number.isFinite));cell.eligible=cell.rt!=null;cell.miss=mean(raw.filter(t=>t.target_present).map(t=>t.correct?0:1));cell.false_alarm=mean(raw.filter(t=>!t.target_present).map(t=>t.correct?0:1));}
      else{cell.eligible=v.length>0;cell.correct_only_valid=correct.length;cell.correct_only_ae=mean(correct.map(t=>t.absolute_error));}
      cells[cell.key]=cell;
    }
    const[a,b]=CONDITIONS[run.experiment].map(c=>cells[run.experiment+':'+c]);
    effects.primary=a.eligible&&b.eligible?(isSearch?a.rt-b.rt:a.ae-b.ae):null;
    effects.error_difference=a.error!=null&&b.error!=null?a.error-b.error:null;
    if(!isSearch){effects.time_cost=a.eligible&&b.eligible?b.rt-a.rt:null;effects.bias_change=a.eligible&&b.eligible?b.bias-a.bias:null;effects.correct_only_primary=a.correct_only_ae!=null&&b.correct_only_ae!=null?a.correct_only_ae-b.correct_only_ae:null;}
    return{participant:run.participant,run_id:run.id,experiment:run.experiment,quality:effects.primary!=null,accuracy:mean(rows.map(t=>t.correct?1:0)),raw_count:rows.length,valid_count:valid.length,cells,effects,completed_at:run.completed_at,experiment_order:run.experiment_order};
  }
  function analyze(runs){
    const unique=new Map(),diagnostics=[];
    for(const r of runs.filter(r=>r&&r.mode==='formal'&&r.status==='complete'&&r.protocol===PROTOCOL)){
      if(!Number.isFinite(Date.parse(r.completed_at))){diagnostics.push({participant:r.participant,experiment:r.experiment,reason:'完成时刻待核对'});continue;}
      const key=r.participant+'|'+r.experiment,prev=unique.get(key);if(!prev||Date.parse(r.completed_at)>Date.parse(prev.completed_at))unique.set(key,r);
    }
    const subjects=[];
    for(const r of unique.values()){if(r.withdrawn){diagnostics.push({participant:r.participant,experiment:r.experiment,reason:'已撤回'});continue;}const check=inspectRun(r);if(!check.ok){diagnostics.push({participant:r.participant,experiment:r.experiment,reason:check.message});continue;}subjects.push(subjectSummary(r));}
    const groups={};
    for(const experiment of ['search','ratio']){
      const ss=subjects.filter(s=>s.experiment===experiment),cells={};
      for(const condition of CONDITIONS[experiment]){const key=experiment+':'+condition,cs=ss.map(s=>s.cells[key]);cells[key]={key,n:cs.length,valid:cs.reduce((n,c)=>n+c.valid,0),present_valid:experiment==='search'?cs.reduce((n,c)=>n+c.present_valid,0):null,absent_valid:experiment==='search'?cs.reduce((n,c)=>n+c.absent_valid,0):null};for(const field of ['rt','ae','error','lae','timeout','bias','correct_only_ae'])cells[key][field]=mean(cs.map(c=>c[field]).filter(Number.isFinite));}
      const effects={};for(const key of ['primary','error_difference',...(experiment==='ratio'?['time_cost','bias_change','correct_only_primary']:[])])effects[key]=paired(ss.map(s=>s.effects[key]));
      groups[experiment]={n:ss.length,analyzable_n:effects.primary.n,subjects:ss,cells,effects};
    }
    const tests=['search','ratio'].map(experiment=>({experiment,p:groups[experiment].effects.primary.p})).filter(t=>Number.isFinite(t.p)).sort((a,b)=>a.p-b.p);
    if(tests.length===2){let previous=0;tests.forEach((t,i)=>{previous=Math.max(previous,Math.min(1,t.p*(2-i)));groups[t.experiment].effects.primary.p_holm=previous;});}
    return{protocol:PROTOCOL,analysis_policy:ANALYSIS_POLICY,created_at:new Date().toISOString(),participants:new Set(subjects.map(s=>s.participant)).size,completed_runs:subjects.length,diagnostics,groups};
  }
  function payload(run,project){
    const check=inspectRun(run);if(!check.ok||run.status!=='complete'||run.withdrawn||run.mode!=='formal')throw Error(check.message||'请选择完整正式记录');
    return{project,experiment:EXPERIMENT_IDS[run.experiment],participant:run.participant,condition:'',trials:analysisRows(run).map(t=>{
      const row={...t,cond:t.condition,run_id:run.id,protocol:PROTOCOL,rt:t.rt_ms??-1,rt_ms:t.rt_ms??-1,mode:'formal',phase:'formal',status:'complete',experiment:run.experiment,created_at:run.created_at,completed_at:run.completed_at,consent_version:run.consent_version||'',consent_at:run.consent_at||'',key_mapping:JSON.stringify(run.mapping),experiment_order:run.experiment_order||''};
      if(t.labels)row.labels=t.labels.join(',');return row;
    }),meta:{version:VERSION,protocol:PROTOCOL,run_id:run.id,consent_version:run.consent_version||'',consent_at:run.consent_at||'',prereg_commit:run.preregistration?.preregistration_commit||'',predictions_sha256_lf:run.preregistration?.predictions_sha256_lf||'',key_mapping:JSON.stringify(run.mapping),experiment_order:run.experiment_order||'',width:run.environment?.width||0,height:run.environment?.height||0,ua:run.environment?.ua||''}};
  }
  root.LabCore={VERSION,PROTOCOL,ANALYSIS_POLICY,EXPERIMENT_IDS,CONDITIONS,CONDITION_NAMES,COLOR,RATIOS,hash,random,shuffle,assignment,uid,esc,makeRun,practiceTrials,replacementTrial,normalizeTrial,analysisRows,inspectRun,searchItems,letter,searchSVG,chartSVG,mean,median,round,paired,formalRows,subjectSummary,analyze,payload};
})(typeof window!=='undefined'?window:globalThis);
