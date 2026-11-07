/* 同页实验入口、匿名会话、可恢复运行器、本地数据管理。 */
(function () {
  'use strict';
  const C=window.LabCore, $=s=>document.querySelector(s), E=C.esc;
  const STORAGE_VERSION=2, STORAGE_KEY='attention-lab:study-v'+STORAGE_VERSION;
  const SESSION_KEY=STORAGE_KEY+':login';
  const CONSENT_VERSION='20261107-v4';
  const configuredProject=String(window.LAB_COLLECTION?.project||'').trim().toUpperCase();
  const DEFAULT_SETTINGS={project:/^[A-Z0-9]{6}$/.test(configuredProject)?configuredProject:'',autoUpload:/^[A-Z0-9]{6}$/.test(configuredProject)&&window.LAB_COLLECTION?.autoUpload===true};
  const LAB='https://attention-lab-production.up.railway.app';
  const ICONS={
    arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',back:'<path d="M19 12H5m6-6-6 6 6 6"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',check:'<path d="m5 12 4 4 10-10"/>',pause:'<path d="M8 5v14M16 5v14"/>',play:'<path d="m9 5 10 7-10 7Z"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5"/>',clock:'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',keyboard:'<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M6 10h1m3 0h1m3 0h1m3 0h1M7 14h10"/>',chart:'<path d="M4 3v17h17M8 15V9m5 6V5m5 10v-4"/>',dots:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6Z"/><path d="m8 12 3 3 5-6"/>',monitor:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>',upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>'
  };
  const icon=(name,size=19)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]||ICONS.info}</svg>`;
  const mark=()=>`<svg class="brand-mark" viewBox="0 0 42 42" aria-hidden="true"><circle cx="21" cy="21" r="16" fill="none" stroke="currentColor" stroke-width="4" stroke-dasharray="73 28" transform="rotate(42 21 21)"/><circle cx="21" cy="21" r="5" fill="var(--orange)"/></svg>`;
  const brand=()=>`<div class="brand">${mark()}<span>注意实验室</span></div>`;
  const btn=(label,action,kind='primary',attrs='')=>`<button type="button" class="btn btn-${kind}" data-action="${action}" ${attrs}>${label}</button>`;
  const titleOf=e=>e==='search'?'搜索':'比例判断';
  const isComplete=r=>r?.status==='complete'&&C.inspectRun(r).ok;
  const fmt=(x,d=0)=>Number.isFinite(x)?x.toFixed(d):'—';
  const dateOf=x=>x?new Date(x).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}):'—';
  let toastTimer, modalFocus;
  function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3500);}
  const Store={
    available:true,storageWarning:false,readOnly:false,recoveryRaw:null,
    data:{schema:'attention-lab/store-v1',profiles:{},runs:[],imports:[],settings:{...DEFAULT_SETTINGS}},
    load(){
      let raw;
      try{raw=localStorage.getItem(STORAGE_KEY);}catch{this.available=false;this.readOnly=true;return;}
      if(raw){
        try{
          const d=JSON.parse(raw),object=x=>x&&typeof x==='object'&&!Array.isArray(x);
          if(d.schema!=='attention-lab/store-v1'||!Array.isArray(d.runs)||!d.runs.every(object)||!object(d.profiles)||d.imports!=null&&(!Array.isArray(d.imports)||!d.imports.every(object))||d.settings!=null&&!object(d.settings))throw Error('存储结构不完整');
          const next={...this.data,...d,imports:d.imports||[],settings:{...DEFAULT_SETTINGS,...d.settings}};
          if(DEFAULT_SETTINGS.project&&!next.settings.project)next.settings={...next.settings,...DEFAULT_SETTINGS};
          for(const r of [...next.runs,...next.imports]){
            if(r.upload!=null&&!object(r.upload)||r.upload_history!=null&&(!object(r.upload_history)||!Object.values(r.upload_history).every(object)))throw Error('提交记录结构不完整');
            if(r.upload?.status==='sending')r.upload={...r.upload,status:'uncertain'};
            for(const value of Object.values(r.upload_history||{}))if(value.status==='sending')value.status='uncertain';
          }
          this.data=next;
        }catch{this.recoveryRaw=raw;this.available=false;this.readOnly=true;return;}
      }
      try{localStorage.setItem(STORAGE_KEY+':probe','1');localStorage.removeItem(STORAGE_KEY+':probe');}catch{this.available=false;}
    },
    save(){try{if(this.readOnly)throw Error('原记录保留');localStorage.setItem(STORAGE_KEY,JSON.stringify(this.data));return true;}catch(e){this.available=false;if(!this.storageWarning){this.storageWarning=true;toast('数据保留在当前页面，请导出一份备份。');setTimeout(()=>App.runner?.pause('storage'),0);}return false;}},
    run(id){return this.data.runs.find(r=>r.id===id);},
    upsert(run){const i=this.data.runs.findIndex(r=>r.id===run.id);if(i<0)this.data.runs.push(run);else this.data.runs[i]=run;return this.save();},
    all(){const m=new Map();for(const r of [...this.data.imports,...this.data.runs])m.set(r.id,r);return [...m.values()];},
    bundle(runs){return {schema:'attention-lab/export-v1',version:C.VERSION,protocol:C.PROTOCOL,exported_at:new Date().toISOString(),runs};}
  };
  // 历史会话保留；清空仅由研究者主动确认触发。
  function clearStudyStorage(includeCurrent=false){
    for(const storage of [localStorage,sessionStorage]){
      const keys=[];for(let i=0;i<storage.length;i++)keys.push(storage.key(i));
      for(const key of keys){const match=/^attention-lab:(?:study|qa)-v(\d+)(?::login|:probe)?$/.exec(key||'');if(match&&(Number(match[1])<STORAGE_VERSION||includeCurrent&&Number(match[1])===STORAGE_VERSION))storage.removeItem(key);}
    }
  }
  function clearLocalRecords(confirmed=false){
    if(!App.researcher)return;
    if(!confirmed){openModal('清空本机记录','<p>清除当前浏览器中的全部作答、导入记录和参与编号。课程项目设置保留，后续参与重新记录。</p>',btn('返回','close-modal','secondary')+btn('确认清空','confirm-clear-local','primary'));return;}
    const settings={...Store.data.settings},fresh={schema:'attention-lab/store-v1',profiles:{},runs:[],imports:[],settings};
    try{clearStudyStorage(true);localStorage.setItem(STORAGE_KEY,JSON.stringify(fresh));}catch{toast('清理尚待完成，请重试。');return;}
    App.runner?.destroy();App.runner=null;Store.data=fresh;Store.available=true;Store.readOnly=false;Store.recoveryRaw=null;Store.storageWarning=false;App.participant=null;App.researcher=false;App.pending=null;closeModal();App.login();toast('本机作答记录已清空。');
  }
  function download(name,text,type='application/json;charset=utf-8'){
    const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  function exportJSON(runs){download(`注意实验室_${runs.length===1?runs[0].participant+'_'+runs[0].experiment:'全部记录'}_${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(Store.bundle(runs),null,2));}
  const CSV_FIELDS=['run_id','participant','experiment','mode','protocol','status','created_at','completed_at','consent_version','consent_at','withdrawn','withdrawn_at','experiment_order','key_mapping','trial_id','attempt_id','attempt_number','variation_index','stimulus_seed','runtime_version','condition','target_present','position_seed','target_zone','green_x','brown_t','separation','reference_height','axis_max','shorter_position','shorter_response','case_index','background_values','rendered_width','rendered_height','phase','section','block_index','trial_index','search_type','set_size','policy','reliability','potential_valid','cue_shown','cue_side','target_side','gap','chart_type','support','true_ratio','estimate','absolute_error','signed_error','log_absolute_error','response','correct','rt_ms','timeout','technical_invalid','excluded_reason','seed','values','labels','rotation','onset_ms','trial_elapsed_ms'];
  function exportCSV(runs){
    const quote=v=>{let text=String(Array.isArray(v)?JSON.stringify(v):v??'');if(typeof v==='string'&&/^[\s]*[=+\-@]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';};
    const rows=[CSV_FIELDS.map(quote).join(',')];
    for(const r of runs)for(const t of r.trials||[]){const record={run_id:r.id,participant:r.participant,experiment:r.experiment,mode:r.mode,protocol:r.protocol,status:r.status,created_at:r.created_at,completed_at:r.completed_at,consent_version:r.consent_version,consent_at:r.consent_at,withdrawn:!!r.withdrawn,withdrawn_at:r.withdrawn_at,experiment_order:r.experiment_order,key_mapping:JSON.stringify(r.mapping),...t};rows.push(CSV_FIELDS.map(f=>quote(record[f])).join(','));}
    download(`注意实验室_${runs.length===1?runs[0].participant+'_'+runs[0].experiment:'全部试次'}.csv`,'\ufeff'+rows.join('\r\n'),'text/csv;charset=utf-8');
  }
  function csvParse(text){
    const rows=[];let row=[],field='',inside=false;text=text.replace(/^\ufeff/,'');
    for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(inside&&text[i+1]==='"'){field+='"';i++;}else inside=!inside;}else if(c===','&&!inside){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!inside){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(Boolean))rows.push(row);row=[];field='';}else field+=c;}
    if(field||row.length){row.push(field);rows.push(row);}if(inside)throw Error('请使用完整的CSV文件。');
    const headers=rows.shift()||[],required=['run_id','participant','experiment','mode','protocol','phase','trial_id'];if(required.some(k=>!headers.includes(k)))throw Error('请选择本实验导出的CSV或JSON。');
    const runs=new Map(),numbers=new Set(['rendered_width','rendered_height','position_seed','target_zone','green_x','brown_t','separation','reference_height','axis_max','case_index','block_index','trial_index','set_size','true_ratio','estimate','absolute_error','signed_error','log_absolute_error','rt_ms','seed','rotation','onset_ms','trial_elapsed_ms','attempt_number','variation_index','stimulus_seed']);
    const booleans=new Set(['target_present','potential_valid','cue_shown','correct','timeout','technical_invalid','withdrawn']);
    for(const cells of rows){const rec={};headers.forEach((k,i)=>{let v=cells[i]??'';if(v!==''&&numbers.has(k))v=Number(v);if(booleans.has(k)&&v!==''){v=v.trim().toLowerCase();if(!['true','false','1','0'].includes(v))throw Error('请检查布尔字段');v=v==='true'||v==='1';}if(['values','labels','background_values'].includes(k)&&v){try{v=JSON.parse(v);}catch{v=k==='labels'?v.split(','):[];}}rec[k]=v;});
      for(const k of CSV_FIELDS)if(rec['trial.'+k]!=null&&rec['trial.'+k]!==''){
        let value=rec['trial.'+k];if(numbers.has(k))value=Number(value);else if(booleans.has(k)){const v=String(value).trim().toLowerCase();if(!['true','false','1','0'].includes(v))throw Error('请核对布尔字段');value=v==='true'||v==='1';}else if(['values','background_values','labels'].includes(k)&&typeof value==='string'){try{value=JSON.parse(value);}catch{value=k==='labels'?value.split(','):[];}}rec[k]=value;
      }
      if(!rec.condition&&rec.cond)rec.condition=rec.cond;
      if(['visual_search',C.EXPERIMENT_IDS.search].includes(rec.experiment))rec.experiment='search';if(['graphical_ratio',C.EXPERIMENT_IDS.ratio].includes(rec.experiment))rec.experiment='ratio';
      if(rec.timeout===true&&rec.rt_ms===-1)rec.rt_ms='';
      if(!runs.has(rec.run_id))runs.set(rec.run_id,{id:rec.run_id,participant:rec.participant,experiment:rec.experiment,mode:rec.mode,protocol:rec.protocol,status:rec.status,created_at:rec.created_at,completed_at:rec.completed_at,consent_version:rec.consent_version,consent_at:rec.consent_at,withdrawn:!!rec.withdrawn,withdrawn_at:rec.withdrawn_at,experiment_order:rec.experiment_order,mapping:rec.key_mapping?JSON.parse(rec.key_mapping):undefined,trials:[]});
      const t={};for(const k of CSV_FIELDS)if(!['run_id','participant','experiment','mode','protocol','status','created_at','completed_at','consent_version','consent_at','withdrawn','withdrawn_at','experiment_order','key_mapping'].includes(k)&&rec[k]!=='')t[k]=rec[k];runs.get(rec.run_id).trials.push(t);
    }return [...runs.values()];
  }
  function runFingerprint(run){
    const keys=['condition','target_present','position_seed','target_zone','green_x','brown_t','separation','reference_height','axis_max','shorter_position','shorter_response','case_index','background_values','trial_id','attempt_id','attempt_number','variation_index','phase','section','block_index','trial_index','seed','stimulus_seed','search_type','set_size','policy','reliability','potential_valid','cue_shown','cue_side','target_side','gap','chart_type','support','values','labels','rotation','true_ratio','estimate','response','rt_ms','timeout','technical_invalid','excluded_reason'];
    const rows=run.trials.map(t=>keys.map(k=>k==='response'&&run.experiment==='ratio'&&t[k]!=null?String(t[k]):t[k]??null));
    return JSON.stringify([run.participant,run.experiment,run.mode,run.protocol,run.status,run.completed_at||null,run.mapping?.f||null,run.mapping?.j||null,rows]);
  }
  async function importFiles(files){
    const staged=[],existing=new Map(Store.all().map(r=>[r.id,r])),withdrawals=[];let skipped=0;
    for(const file of files){
      if(file.size>10*1024*1024)throw Error('请选择10 MB以内的数据文件。');
      const text=await file.text();let runs;
      if(file.name.toLowerCase().endsWith('.csv'))runs=csvParse(text);
      else{const d=JSON.parse(text);if(d.schema!=='attention-lab/export-v1'||!Array.isArray(d.runs))throw Error('请选择本实验导出的JSON。');runs=d.runs;}
      for(const run of runs){
        if(run.protocol!==C.PROTOCOL){skipped++;continue;}
        const check=C.inspectRun(run);if(!check.ok)throw Error('导入待核对：'+check.message);
        const prior=existing.get(run.id);
        if(prior){
          if(runFingerprint(prior)!==runFingerprint(run))throw Error('同一会话存在不同原始记录，请核对后导入。');
          if(run.withdrawn&&!prior.withdrawn)withdrawals.push({prior,at:run.withdrawn_at||new Date().toISOString()});
        }else{staged.push(run);existing.set(run.id,run);}
      }
    }
    // 整批文件通过后再修改存储，错误不会留下部分导入。
    Store.data.imports.push(...staged);
    withdrawals.forEach(({prior,at})=>{prior.withdrawn=true;prior.withdrawn_at=at;});
    Store.save();toast('已导入'+staged.length+'份新记录'+(skipped?'，已略过早期版本'+skipped+'份':''));App.results();
  }
  function openModal(title,body,footer='',wide=false){
    if(!$('#modal-root .modal'))modalFocus=document.activeElement;
    $('#modal-root').innerHTML=`<div class="modal-backdrop"><section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-heading"><h2 id="modal-title">${title}</h2><button type="button" class="icon-btn" data-action="close-modal" aria-label="关闭">${icon('close')}</button></div><div class="modal-body">${body}</div>${footer?`<div class="modal-footer">${footer}</div>`:''}</section></div>`;
    $('#modal-root button')?.focus();
  }
  function closeModal(){$('#modal-root').innerHTML='';if(modalFocus?.isConnected)modalFocus.focus();}
  function consent(){openModal('参与说明',`<p>你将完成搜索40次、比例判断20次，约7—10分钟。</p><p>实验记录匿名编号、作答、反应时和浏览器信息，用于课程分析与匿名结果展示。数据保存在当前浏览器，正式实验完成后上传课程项目 ${E(Store.data.settings.project)}。</p><p>参与自愿。你可以随时暂停或退出，并凭匿名编号联系研究者撤回数据。</p>`,btn('已了解','close-modal'));}
  function loginArt(){return `<svg viewBox="0 0 580 430" aria-hidden="true"><defs><radialGradient id="login-glow"><stop stop-color="#45647b" stop-opacity=".45"/><stop offset="1" stop-color="#152c42" stop-opacity="0"/></radialGradient></defs><circle cx="290" cy="215" r="235" fill="url(#login-glow)"/><g stroke="#7692a5" fill="none" opacity=".25"><circle cx="290" cy="215" r="181"/><circle cx="290" cy="215" r="125" stroke-dasharray="3 12"/><path d="M46 215H534M290 2v426" stroke-dasharray="3 9"/></g><g class="orbit" style="transform-origin:290px 215px"><circle cx="290" cy="34" r="5" fill="#a7bac6"/><circle cx="471" cy="215" r="3" fill="#a7bac6"/></g><g class="orbit reverse" style="transform-origin:290px 215px"><path d="M157 92A181 181 0 0 1 422 90" fill="none" stroke="#7494aa" stroke-width="2"/></g><g stroke="#738fa3" fill="none" stroke-width="2.5" opacity=".7"><circle cx="188" cy="132" r="13"/><circle cx="392" cy="132" r="13"/><circle cx="188" cy="298" r="13"/><circle cx="392" cy="298" r="13"/><circle cx="116" cy="215" r="13"/><circle cx="464" cy="215" r="13"/></g><circle cx="290" cy="215" r="62" fill="#254158" stroke="#a7b9c6" stroke-opacity=".15"/><path d="M316 192A35 35 0 1 0 316 238" fill="none" stroke="#e2ad7d" stroke-width="8" stroke-linecap="round"/><circle cx="290" cy="215" r="85" fill="none" stroke="#d3a377" stroke-opacity=".3" stroke-dasharray="2 9"/></svg>`;}
  function searchCardArt(){let shapes='';for(let r=0;r<3;r++)for(let c=0;c<6;c++){const target=r===1&&c===3;shapes+=C.letter(92+c*64,55+r*66,target?'T':(r+c)%2?'X':'T',target||(r+c)%2?C.COLOR.green:C.COLOR.brown,26);}return `<svg viewBox="0 0 500 240" aria-hidden="true">${shapes}</svg>`;}
  function ratioCardArt(){return `<svg viewBox="0 0 500 240" aria-hidden="true"><g fill="white" stroke="#435562" stroke-width="1.7"><path d="M151 191V45h59v146Zm0-119h59m-59 48h59m-59 33h59M286 191V61h59v130Zm0-98h59m-59 34h59m-59 32h59"/></g><g fill="#243846"><circle cx="180" cy="58" r="3"/><circle cx="180" cy="96" r="3"/></g><path d="M124 28v163h250" stroke="#a7b2ba" fill="none"/></svg>`;}

  function storageBanner(){
  if(Store.available)return '';
  const recovery=Store.recoveryRaw?btn('保存原始记录','export-recovery','secondary'):'';
  return `<div class="storage-banner">当前页面保存着你的记录。完成后请下载一份备份。${recovery}</div>`;
}
  function withdraw(runId,confirmed=false){
  const run=Store.run(runId);if(!run)return;
  if(!confirmed){openModal('撤回这项实验',`<p>这项实验的本地记录将转为撤回存档，后续分析和提交排除。</p><p>已上传的记录可凭匿名编号联系邀请你的研究者，完成平台撤回。</p>`,btn('保留记录','close-modal','secondary')+btn('确认撤回','confirm-withdraw','primary',`data-run="${E(run.id)}"`));return;}
  const at=new Date().toISOString();
  for(const record of Store.all())if(record.participant===run.participant&&record.experiment===run.experiment&&record.protocol===run.protocol){record.withdrawn=true;record.withdrawn_at=at;}
  Store.save();closeModal();App.records();toast('本地记录已撤回并保留存档');
}
  const App={
    participant:null,runner:null,view:'login',pending:null,researcher:false,
    canViewResults(){return this.researcher||['search','ratio'].every(e=>Store.data.runs.some(r=>r.participant===this.participant&&r.experiment===e&&r.mode==='formal'&&!r.withdrawn&&r.protocol===C.PROTOCOL&&isComplete(r)));},
    header(){return `<header class="app-header">${brand()}<div class="header-right">${this.canViewResults()?'<button class="btn btn-quiet btn-small" data-action="results">'+icon('chart',16)+'数据与结果</button>':''}<span class="header-divider"></span><span class="profile-pill"><span class="avatar">ID</span><span class="mono">${E(this.participant||'研究者')}</span></span><button class="icon-btn" data-action="menu" aria-label="更多选项">${icon('dots')}</button></div></header>`;},
    login(){this.view='login';$('#app').innerHTML=`<main id="main" class="login-shell"><section class="login-visual">${brand()}<div class="login-art">${loginArt()}</div></section><section class="login-content"><form class="login-form" id="login-form"><div class="login-mobile-brand">${brand()}</div><h1>参与实验</h1><label class="field"><span class="field-label">参与编号</span><input class="text-input participant-input mono" id="participant" name="participant" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="12" placeholder="P01" required aria-describedby="id-hint"><span class="field-hint" id="id-hint"></span></label><label class="check-line"><input id="consent" type="checkbox" required><span>我已阅读<button type="button" class="link-button" data-action="consent">参与说明</button>，并自愿参加。</span></label><button class="btn btn-primary" type="submit">进入实验 ${icon('arrow')}</button></form></section></main>`;
      $('#login-form').addEventListener('submit',e=>{e.preventDefault();const id=$('#participant').value.trim().toUpperCase();if(!/^[A-Z][A-Z0-9_-]{1,11}$/.test(id)){$('#id-hint').textContent='使用2—12位编号，以英文字母开头';$('#participant').focus();return;}if(!$('#consent').checked){$('#consent').focus();return;}this.participant=id;this.researcher=false;Store.data.profiles[id]={...Store.data.profiles[id],id,consent_version:CONSENT_VERSION,consent_at:new Date().toISOString()};Store.save();try{sessionStorage.setItem(SESSION_KEY,id);}catch{}this.dashboard();});
      $('#participant').focus({preventScroll:true});
    },
    dashboard(){
      this.runner?.destroy();this.runner=null;this.view='dashboard';this.pending=null;
      const own=Store.data.runs.filter(r=>r.participant===this.participant&&r.mode==='formal'&&!r.withdrawn&&r.protocol===C.PROTOCOL),completed=new Set(own.filter(isComplete).map(r=>r.experiment)).size;
      const cards=['search','ratio'].map((experiment,i)=>{const existing=own.findLast?.(r=>r.experiment===experiment)||own.filter(r=>r.experiment===experiment).slice(-1)[0];const done=isComplete(existing),active=existing&&!done;return `<article class="experiment-card"><div class="card-art ${experiment}">${done?'<span class="card-tag pill pill-green">已完成</span>':active?'<span class="card-tag pill pill-warm">已保存进度</span>':''}${experiment==='search'?searchCardArt():ratioCardArt()}</div><div class="card-body"><div class="card-title-row"><h2>${titleOf(experiment)}</h2>${icon('arrow',22)}</div><div class="card-meta"><span>${icon('clock',15)}${experiment==='search'?'40 次':'20 次'}</span><span>${icon('keyboard',15)}${experiment==='search'?'F / J':'数字输入'}</span></div><div class="card-footer"><button class="btn btn-quiet btn-small" data-action="start-demo" data-experiment="${experiment}">体验 ${icon('play',14)}</button><button class="btn btn-primary" data-action="choose" data-experiment="${experiment}">${done?'查看记录':active?'继续实验':'开始实验'} ${icon('arrow',17)}</button></div></div></article>`;}).join('');
      $('#app').innerHTML=`${this.header()}<main id="main" class="dashboard">${storageBanner()}<div class="page-heading"><div><h1>选择实验</h1></div><div class="total-progress"><svg class="progress-ring" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="18" fill="none" stroke="#e2e7e8" stroke-width="3"/><circle cx="22" cy="22" r="18" fill="none" stroke="#cc6b32" stroke-width="3" stroke-dasharray="${completed/2*113.1} 113.1" transform="rotate(-90 22 22)"/></svg><span>${completed} / 2 已完成</span></div></div><div class="cards">${cards}</div><div class="dashboard-foot"><button class="link-button" data-action="consent">参与说明</button></div></main>`;
      window.scrollTo(0,0);
    },
    choose(experiment,mode='formal'){
      if(!this.participant){this.login();return;}
      if(mode==='formal'){const r=Store.data.runs.filter(r=>r.participant===this.participant&&r.experiment===experiment&&r.mode==='formal'&&!r.withdrawn&&r.protocol===C.PROTOCOL).slice(-1)[0];if(isComplete(r)){this.finish(r);return;}if(r){this.launch(r,true);return;}}
      this.pending={experiment,mode};this.view='instructions';
      const mapping=`<div class="key-example"><svg viewBox="0 0 56 56" aria-hidden="true">${C.letter(28,28,'T',C.COLOR.green,32)}</svg><span class="keycap">F</span><span>出现目标</span></div><div class="key-example"><span class="keycap">J</span><span>其余画面</span></div>`;
      const sample=experiment==='ratio'?C.practiceTrials(C.makeRun('ratio',this.participant,'demo'),'ratio')[0]:null;
      const demo=experiment==='search'?mapping:`<div class="ratio-guide-chart">${C.chartSVG(sample)}</div>`;
      $('#app').innerHTML=`${this.header()}<main id="main" class="instruction-page"><button class="btn btn-quiet btn-small back-btn" data-action="home">${icon('back',16)}实验选择</button><section class="instruction-panel"><div class="instruction-top"><span class="pill">${mode==='formal'?'正式参与':'体验'}</span></div><h1>${experiment==='search'?'寻找绿色 T':'比例判断'}</h1>${experiment==='ratio'?'<p class="lead">比较两个圆点所在分段，先选较短段，再输入短段占长段的百分数。</p>':''}<div class="instruction-demo">${demo}</div><div class="instruction-bottom"><span class="muted">4 次练习</span>${btn('开始练习 '+icon('arrow'),'begin')}</div></section></main>`;window.scrollTo(0,0);
    },
    begin(){if(!this.pending)return;const {experiment,mode}=this.pending,run=C.makeRun(experiment,this.participant,mode);
      const own=Store.data.runs.filter(r=>r.participant===this.participant&&r.mode===mode&&r.protocol===C.PROTOCOL);run.experiment_order=[...new Set([...own.map(r=>r.experiment),experiment])].join('→');run.consent_version=CONSENT_VERSION;run.consent_at=Store.data.profiles[this.participant]?.consent_at;run.environment={width:innerWidth,height:innerHeight,ua:navigator.userAgent.slice(0,80),devicePixelRatio};Store.upsert(run);this.pending=null;this.launch(run,false);
    },
    launch(run,resume){
      let schedule=Array.isArray(run.blocks)&&run.blocks.length>0&&run.blocks.every(b=>b&&typeof b.section==='string'&&Array.isArray(b.trials)&&b.trials.length>0);
      try{if(schedule)for(const b of run.blocks)for(const t of b.trials)C.normalizeTrial({...t,timeout:true},run);}catch{schedule=false;}
      const check=C.inspectRun(run),cursor=run.cursor&&Number.isInteger(run.cursor.block)&&run.cursor.block>=0&&Number.isInteger(run.cursor.trial)&&run.cursor.trial>=0&&(run.cursor.block<run.blocks?.length&&run.cursor.trial<=run.blocks?.[run.cursor.block]?.trials?.length||run.cursor.block===run.blocks?.length&&run.cursor.trial===0),practice=run.practice_done&&typeof run.practice_done==='object'&&run.practice_rounds&&typeof run.practice_rounds==='object';
      if(!check.ok||!schedule||!cursor||!practice){openModal('记录待核对','<p>原始记录已保留。下载备份后，可交由研究者核对。</p>',btn('下载备份','export-run','primary',`data-run="${E(run.id)}"`)+btn('返回','close-modal','secondary'));return;}
      this.runner?.destroy();this.view='trial';this.runner=new Runner(run);this.runner.mount(resume);
    },
    finish(run){
      this.runner?.destroy();this.runner=null;this.view='finish';const rows=C.analysisRows(run),isSearch=run.experiment==='search',valid=rows.filter(t=>!t.timeout&&Number.isFinite(t.estimate)),accuracy=C.mean(rows.map(t=>t.correct?1:0));
      const remaining=run.mode==='formal'?['search','ratio'].find(e=>e!==run.experiment&&!Store.data.runs.some(r=>r.participant===this.participant&&r.experiment===e&&r.mode==='formal'&&!r.withdrawn&&r.protocol===C.PROTOCOL&&isComplete(r))):null;
      $('#app').innerHTML=`${this.header()}<main id="main"><section class="finish-panel"><div class="finish-check">${icon('check',34)}</div><h1>${titleOf(run.experiment)}已完成</h1><div class="finish-stats"><div class="finish-stat"><strong>${rows.length}</strong><small>${run.mode==='formal'?'正式试次':'体验试次'}</small></div><div class="finish-stat"><strong>${fmt(accuracy*100)}%</strong><small>${isSearch?'正确率':'较短段选择正确率'}</small></div>${isSearch?'':`<div class="finish-stat"><strong>${fmt(C.mean(valid.map(t=>t.absolute_error)),1)}</strong><small>平均误差 · 百分点</small></div>`}</div><div class="save-state">${icon('check',15)}<span id="finish-save-label" data-run="${E(run.id)}">${Store.available?'已保存':'请下载备份'}</span></div><div class="actions center">${remaining?`<button class="btn btn-primary" data-action="choose" data-experiment="${remaining}">继续${titleOf(remaining)} ${icon('arrow',17)}</button>`:btn('实验选择','home')}${btn('下载 JSON','export-run','secondary',`data-run="${E(run.id)}"`)}</div><div class="download-row"><button class="link-button" data-action="export-run-csv" data-run="${E(run.id)}">下载 CSV</button></div></section></main>`;
      if(Store.data.settings.autoUpload&&Store.data.settings.project&&run.mode==='formal'&&uploadState(run).status!=='confirmed'){
        $('#finish-save-label').textContent='已保存 · 正在上传';
        submitRun(run).then(()=>{const label=$('#finish-save-label');if(label?.dataset.run===run.id){const status=uploadState(run).status;label.textContent=status==='confirmed'?'已上传至课程平台':status==='uncertain'?'已保存 · 上传待核对':'已保存 · 上传待重试';}});
      }else if(uploadState(run).status==='confirmed')$('#finish-save-label').textContent='已上传至课程平台';window.scrollTo(0,0);
    },
    menu(){openModal('选项',`<div class="record-list"><button class="btn btn-secondary" data-action="consent">参与说明</button><button class="btn btn-secondary" data-action="records">我的记录</button>${this.researcher?'<button class="btn btn-secondary" data-action="results">数据与结果</button><button class="btn btn-secondary" data-action="settings">课程项目</button><button class="btn btn-secondary" data-action="clear-local">清空本机记录</button><button class="btn btn-secondary" data-action="participant-view">参与者视图</button>':'<button class="btn btn-secondary" data-action="researcher">研究者视图</button>'}<button class="btn btn-quiet" data-action="logout">退出登录</button></div>`);},
    records(){
  const runs=Store.data.runs.filter(r=>r.participant===this.participant);
  const content=runs.length?`<div class="record-list">${runs.map(r=>`<div class="record-item"><div><strong>${titleOf(r.experiment)} · ${r.mode==='formal'?'正式':r.mode==='test'?'调试体验':'体验'}</strong><small>${dateOf(r.created_at)} · ${r.withdrawn?'本地已撤回':r.status==='complete'?'已完成':r.status==='review'?'待核对':'已保存进度'}${r.protocol!==C.PROTOCOL?' · 早期版本':''}</small></div><div class="actions"><button class="btn btn-secondary btn-small" data-action="export-run" data-run="${E(r.id)}">下载JSON</button>${r.withdrawn?'':`<button class="btn btn-quiet btn-small" data-action="withdraw" data-run="${E(r.id)}">撤回</button>`}</div></div>`).join('')}</div>`:'<p>完成一组任务后，记录会显示在这里。</p>';
  openModal('我的记录',content,btn('完成','close-modal'));
},
    settings(){openModal('课程项目',`<p>填写课程收数平台生成的6位项目码。</p><div class="upload-box"><label class="field-label" for="project-code">项目码</label><div class="config-row"><input class="text-input mono" id="project-code" maxlength="6" autocomplete="off" value="${E(Store.data.settings.project)}" placeholder="ABC234">${btn('保存','save-project','primary')}</div><label class="check-line"><input type="checkbox" id="auto-upload" ${Store.data.settings.autoUpload?'checked':''}><span>正式实验完成后自动提交</span></label></div><p class="smallprint">项目码保存在当前浏览器。课程平台使用<a href="${LAB}/hw2" target="_blank" rel="noopener">项目管理页面</a>提供下载密钥。</p>`,btn('完成','close-modal'));},
    results(){
      if(this.runner){this.runner.pause('查看数据');this.runner.destroy();this.runner=null;}
      this.view='results';closeModal();const local=C.analyze(Store.all()),fromSnapshot=local.completed_runs===0&&window.LAB_SNAPSHOT?.analysis?.protocol===C.PROTOCOL&&window.LAB_SNAPSHOT.analysis.analysis_policy===C.ANALYSIS_POLICY&&window.LAB_SNAPSHOT.analysis;const report=fromSnapshot?window.LAB_SNAPSHOT.analysis:local;this.report=report;
      const search=report.groups.search,ratio=report.groups.ratio,has=report.completed_runs>0;
      const effect=(g,unit)=>effectHTML(g,unit);
      const table=[search,ratio].flatMap(g=>g.subjects.map(s=>`<tr><td class="mono">${E(s.participant)}</td><td>${titleOf(s.experiment)}</td><td>${s.raw_count}</td><td>${C.CONDITIONS[s.experiment].map(c=>s.cells[s.experiment+':'+c].valid).join(' / ')}</td><td>${fmt(s.accuracy*100)}%</td><td>${Number.isFinite(s.effects.primary)?'已计算':'暂无作答'}</td><td>${fmt(s.effects.primary,2)}</td></tr>`)).join('');
      $('#app').innerHTML=`${this.header()}<main id="main" class="results-page"><div class="results-top"><div><h1>数据与结果</h1></div><div class="actions"><button class="btn btn-secondary btn-small" data-action="import">${icon('upload',15)}导入记录</button><button class="btn btn-primary btn-small" data-action="export-all">${icon('download',15)}导出JSON</button>${btn('实验选择','home','quiet')}</div></div><input class="hidden" type="file" id="import-files" accept=".json,.csv" multiple><div class="metric-grid"><div class="metric-card"><small>匿名参与者</small><strong>${report.participants}<em>人</em></strong></div><div class="metric-card"><small>搜索 · 配对人数</small><strong>${search.analyzable_n??search.effects.primary?.n??0}<em>/ 5 人</em></strong></div><div class="metric-card"><small>比例 · 配对人数</small><strong>${ratio.analyzable_n??ratio.effects.primary?.n??0}<em>/ 5 人</em></strong></div></div>${has?`<div class="result-grid"><section class="result-card"><h2>视觉搜索</h2><div class="result-plot">${linePlot(search)}</div>${effect(search,'ms')}</section><section class="result-card"><h2>比例判断</h2><div class="result-plot">${barPlot(ratio)}</div>${effect(ratio,'百分点')}</section></div><details class="details-card"><summary>作答汇总</summary><div class="table-scroll"><table class="data-table"><thead><tr><th>编号</th><th>实验</th><th>正式试次</th><th>基线 / 改进有效数</th><th>正确率</th><th>计算状态</th><th>主要配对差</th></tr></thead><tbody>${table}</tbody></table></div></details><details class="details-card"><summary>条件明细</summary><div class="table-scroll">${conditionTable(report)}</div></details>${pairedHTML(report)}`:`<div class="empty-results"><div><div class="empty-graphic">${icon('chart',90)}</div><p>等待正式记录</p></div></div>`}${diagnosticsHTML(report)}<div class="data-actions">${btn('下载CSV','export-all-csv','secondary')}${has?btn('导出离线结果','snapshot','secondary'):''}${btn('提交记录','upload-list','quiet')}</div></main>`;
      $('#import-files').addEventListener('change',async e=>{try{await importFiles(e.target.files);}catch(err){toast(err.message||'请选择可读取的实验数据。');}});window.scrollTo(0,0);
    },
    dispatch(action,el){
      if(action==='close-modal'){closeModal();return;}if(action==='consent'){consent();return;}
      if(action.startsWith('runner-')){this.runner?.action(action);return;}
      if(action==='home'){closeModal();if(this.runner){this.runner.pause('返回实验选择');this.runner.destroy();this.runner=null;}this.participant?this.dashboard():this.login();}
      else if(action==='choose'){closeModal();this.choose(el.dataset.experiment);}
      else if(action==='start-demo')this.choose(el.dataset.experiment,'demo');
      else if(action==='begin')this.begin();
      else if(action==='researcher'){this.researcher=true;closeModal();this.results();}
      else if(action==='participant-view'){this.researcher=false;closeModal();this.dashboard();}
      else if(action==='menu')this.menu();
      else if(action==='records')this.records();
      else if(action==='settings')this.settings();
      else if(action==='clear-local')clearLocalRecords();
      else if(action==='confirm-clear-local')clearLocalRecords(true);
      else if(action==='results')this.results();
      else if(action==='logout'){closeModal();if(this.runner){this.runner.pause('退出');this.runner.destroy();this.runner=null;}this.participant=null;this.researcher=false;try{sessionStorage.removeItem(SESSION_KEY);}catch{}this.login();}
      else if(action==='export-run')exportJSON([Store.run(el.dataset.run)].filter(Boolean));
      else if(action==='export-run-csv')exportCSV([Store.run(el.dataset.run)].filter(Boolean));
      else if(action==='withdraw')withdraw(el.dataset.run);
      else if(action==='confirm-withdraw')withdraw(el.dataset.run,true);
      else if(action==='export-recovery')download('注意实验室_原始浏览器记录.txt',Store.recoveryRaw||'','text/plain;charset=utf-8');
      else if(action==='export-all')exportJSON(Store.all());
      else if(action==='export-all-csv')exportCSV(Store.all());
      else if(action==='import')$('#import-files')?.click();
      else if(action==='snapshot'){download('results-data.js',`/* 真实匿名汇总快照；${new Date().toISOString()} */\nwindow.LAB_SNAPSHOT = ${JSON.stringify({schema:'attention-lab/snapshot-v1',analysis:this.report},null,2)};\n`,'text/javascript;charset=utf-8');toast('结果快照已导出');}
      else if(action==='save-project'){const code=$('#project-code').value.trim().toUpperCase();if(code&&!/^[A-Z0-9]{6}$/.test(code)){toast('填写6位字母或数字项目码');return;}Store.data.settings.project=code;Store.data.settings.autoUpload=$('#auto-upload').checked;Store.save();toast('课程项目已保存');}
      else if(action==='upload-list')uploadList();
      else if(action==='upload-run'){const run=Store.all().find(r=>r.id===el.dataset.run);if(run)submitRun(run).then(uploadList);}
      else if(action==='retry-upload'){const run=Store.all().find(r=>r.id===el.dataset.run);if(run)submitRun(run,true).then(uploadList);}
    }
  };

  function effectHTML(group,unit){
    const p=group.effects.primary;if(!p?.n)return '<div class="effect-caption">等待两条件作答</div>';
    return `<div class="effect-row"><span>基线 − 改进 · n=${p.n}</span><strong>${fmt(p.mean,unit==='ms'?0:2)} ${unit}</strong></div>${unit==='ms'?'':`<div class="effect-row"><span>作答时间差 · 改进 − 基线</span><strong>${fmt(group.effects.time_cost?.mean)} ms</strong></div>`}`;
  }
  function diagnosticsHTML(report){
  if(!report.diagnostics?.length)return '';
  return `<details class="details-card"><summary>存档与待核对记录 · ${report.diagnostics.length}</summary><div class="table-scroll"><table class="data-table"><thead><tr><th>编号</th><th>实验</th><th>说明</th></tr></thead><tbody>${report.diagnostics.map(d=>`<tr><td>${E(d.participant)}</td><td>${E(titleOf(d.experiment))}</td><td>${E(d.reason)}</td></tr>`).join('')}</tbody></table></div></details>`;
}
  function comparisonPlot(group,experiment){
    const field=experiment==='search'?'rt':'ae',unit=experiment==='search'?'ms':'百分点',conditions=C.CONDITIONS[experiment],values=conditions.map(c=>group.cells[experiment+':'+c]?.[field]).filter(Number.isFinite);
    if(!values.length)return '<div class="plot-empty">等待作答记录</div>';
    const max=Math.max(experiment==='search'?300:3,...values)*1.2,y=v=>174-v/max*140;
    let content='<path d="M50 25v149h332" stroke="#d4dde2" fill="none"/>';
    for(let i=0;i<4;i++){const v=max*i/3;content+=`<path d="M50 ${y(v)}H382" stroke="#edf1f3"/><text x="42" y="${y(v)+4}" text-anchor="end" fill="#708594" font-size="10">${fmt(v,experiment==='search'?0:1)}</text>`;}
    conditions.forEach((c,i)=>{const v=group.cells[experiment+':'+c]?.[field];if(Number.isFinite(v))content+=`<rect x="${110+i*155}" y="${y(v)}" width="62" height="${174-y(v)}" rx="3" fill="${i?C.COLOR.orange:C.COLOR.blue}"/>`;content+=`<text x="${141+i*155}" y="198" text-anchor="middle" fill="#526e81" font-size="12">${C.CONDITION_NAMES[c]}</text>`;});
    return `<svg viewBox="0 0 425 230" role="img" aria-label="${experiment==='search'?'两条件反应时':'两条件平均绝对误差'}"><text x="16" y="15" fill="#708594" font-size="10">${unit}</text>${content}</svg>`;
  }
  const linePlot=group=>comparisonPlot(group,'search'),barPlot=group=>comparisonPlot(group,'ratio');
  function pairedPlot(group,unit){
    const rows=group.subjects.filter(s=>Number.isFinite(s.effects.primary)),effect=group.effects.primary;
    if(!rows.length)return '<p class="effect-caption">完成两条件后显示配对差。</p>';
    const extent=Math.max(1,...rows.map(s=>Math.abs(s.effects.primary)))*1.2,height=85+rows.length*25,x=v=>230+v/extent*140;
    let svg=`<path d="M230 15V${height-30}" stroke="#c8d3da" stroke-dasharray="3 4"/>`;
    rows.forEach((s,i)=>{const y=30+i*25;svg+=`<text x="22" y="${y+4}" fill="#6e8392" font-size="11">${E(s.participant)}</text><path d="M230 ${y}H${x(s.effects.primary)}" stroke="#d9e2e7"/><circle cx="${x(s.effects.primary)}" cy="${y}" r="4" fill="#cc6b32"/>`;});
    const y=38+rows.length*25;
    if(effect?.ci)svg+=`<path d="M${x(effect.ci[0])} ${y}H${x(effect.ci[1])}" stroke="#28649f" stroke-width="3"/>`;
    svg+=`<text x="22" y="${y+4}" fill="#28649f" font-size="11">均值</text><circle cx="${x(effect.mean)}" cy="${y}" r="5" fill="#28649f"/><text x="230" y="${height-4}" text-anchor="middle" fill="#8a9ba6" font-size="10">0 · ${unit}</text>`;
    return `<svg viewBox="0 0 425 ${height}" role="img" aria-label="每名参与者的主要配对差">${svg}</svg>`;
  }
  function pairedHTML(report){return `<details class="details-card"><summary>个体配对差</summary><div class="result-grid" style="padding:24px"><section><h3 style="font-size:14px;margin-bottom:15px">搜索 · 基线−改进</h3>${pairedPlot(report.groups.search,'ms')}</section><section><h3 style="font-size:14px;margin-bottom:15px">比例 · 基线−改进</h3>${pairedPlot(report.groups.ratio,'百分点')}</section></div></details>`;}

  function conditionTable(report){let rows='';for(const experiment of ['search','ratio'])for(const cell of Object.values(report.groups[experiment].cells)){const c=cell.key.split(':')[1];rows+=`<tr><td>${titleOf(experiment)} · ${C.CONDITION_NAMES[c]}</td><td>${cell.n}</td><td>${cell.valid}${experiment==='search'?`（${cell.present_valid} / ${cell.absent_valid}）`:''}</td><td>${fmt(cell.rt)}</td><td>${fmt(cell.ae,2)}</td><td>${fmt(cell.error==null?null:cell.error*100,1)}${cell.error!=null?'%':''}</td><td>${fmt(cell.lae,2)}</td><td>${fmt(cell.correct_only_ae,2)}</td></tr>`;}return `<table class="data-table"><thead><tr><th>条件</th><th>人数</th><th>作答数（出现 / 缺席）</th><th>时间 ms</th><th>AE 百分点</th><th>错误率</th><th>LAE</th><th>选对后AE</th></tr></thead><tbody>${rows}</tbody></table>`;}
  function uploadState(run,project=Store.data.settings.project){return run.upload_history?.[project]||(run.upload?.project===project?run.upload:{status:'local',project});}
  function saveUpload(run,project,state){const value={project,...state};run.upload_history=run.upload_history||{};run.upload_history[project]=value;run.upload=value;Store.save();}
  async function submitRun(run,retry=false){
  const project=Store.data.settings.project;if(!project){App.settings();return;}
  if(run.mode!=='formal'||run.status!=='complete'||run.withdrawn||run.protocol!==C.PROTOCOL){toast('课程平台接收已完成的正式记录');return;}
  const integrity=C.inspectRun(run);if(!integrity.ok){toast('记录待核对：'+integrity.message);return;}
  const current=uploadState(run,project);
  if(current.status==='confirmed'){toast('这份记录已提交至当前项目');return;}if(current.status==='sending')return;
  if(current.status==='uncertain'&&!retry){toast('核对课程记录后，选择确认重试。');return;}
  const body=JSON.stringify(C.payload(run,project));if(new TextEncoder().encode(body).length>256*1024){toast('请先下载记录，再核对提交。');return;}
  saveUpload(run,project,{status:'sending',time:new Date().toISOString()});
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),15000);
  try{
    const res=await fetch(LAB+'/api/hw2/submit',{method:'POST',headers:{'Content-Type':'application/json'},body,signal:abort.signal});
    let data;try{data=await res.json();}catch{throw Error('回执待核对');}
    if(res.ok&&data.ok===true){saveUpload(run,project,{status:'confirmed',time:new Date().toISOString(),warnings:Array.isArray(data.warnings)?data.warnings:[],warning_details:Array.isArray(data.warning_details)?data.warning_details:[]});toast(data.warnings?.length?'平台已接收，请核对字段提示。':'课程平台已确认接收');}
    else if(data.ok===false){saveUpload(run,project,{status:'error',message:String(data.msg||'请核对项目码与数据字段').slice(0,200)});toast(uploadState(run,project).message);}
    else throw Error('回执待核对');
  }catch{saveUpload(run,project,{status:'uncertain',time:new Date().toISOString()});toast('记录已保存在本地，平台接收情况待核对。');}
  finally{clearTimeout(timer);}
}
  function uploadList(){
  const runs=Store.all().filter(r=>r.mode==='formal'&&r.protocol===C.PROTOCOL&&r.status==='complete'&&!r.withdrawn);
  const stateLabel={local:'本地已保存',sending:'提交中',confirmed:'平台已确认',uncertain:'平台接收待核对',error:'请核对项目配置'};
  const content=runs.length?runs.map(r=>{const current=uploadState(r);return `<div class="record-item"><div><strong>${E(r.participant)} · ${titleOf(r.experiment)}</strong><small>${current.warnings?.length?'平台已接收 · 字段需核对':stateLabel[current.status]||'待核对'}</small></div>${current.status==='confirmed'?(current.warnings?.length?'<span class="pill pill-warm">核对字段</span>':'<span class="pill pill-green">已提交</span>'):`<button class="btn btn-secondary btn-small" data-action="${current.status==='uncertain'?'retry-upload':'upload-run'}" data-run="${E(r.id)}" ${current.status==='sending'?'disabled':''}>${current.status==='uncertain'?'已核对，重试':current.status==='sending'?'提交中':'提交'}</button>`}</div>`;}).join(''):'<p>完整正式记录会显示在这里。</p>';
  openModal('提交记录',`<p>${Store.data.settings.project?'课程项目 '+E(Store.data.settings.project):'先在课程项目中填写6位项目码。'}</p><div class="record-list">${content}</div>`,btn('课程项目','settings','secondary')+btn('完成','close-modal'));
}

  class Runner {
    constructor(run){this.run=run;this.state='idle';this.timer=null;this.frame=null;this.token=0;this.current=null;this.practice=[];this.practiceIndex=0;this.isPractice=false;this.section=null;this.attempt=0;this.destroyed=false;this.overlayState=null;this.pausedOverlay=null;this.dimensions=[innerWidth,innerHeight];}
    mount(resume){
      $('#app').innerHTML=`<main id="main" class="trial-shell"><header class="trial-header"><div class="trial-title">${mark()}<h1>${titleOf(this.run.experiment)}<small>${E(this.run.participant)}</small></h1><span class="pill ${this.run.mode!=='formal'?'pill-warm':''}" id="phase-label">准备</span></div><div class="trial-header-right"><span class="trial-counter mono" id="trial-counter"></span><button class="icon-btn" data-action="runner-fullscreen" aria-label="全屏">${icon('expand',18)}</button><button class="icon-btn" data-action="runner-pause" aria-label="暂停">${icon('pause',18)}</button></div></header><div class="trial-progress" role="progressbar" aria-label="正式试次进度" aria-valuemin="0" aria-valuemax="100"><span id="trial-progress-fill"></span></div><div class="trial-workspace"><div class="stage-top"><span id="stage-label"></span><span id="block-label"></span></div><div class="trial-stage" id="trial-stage"></div><div class="response-bar" id="response-bar"></div></div></main>`;
      if(resume){const block=this.run.cursor.block;const pending=this.run.pending_trial?.spec;if(pending&&!this.run.trials.some(t=>t.attempt_id===pending.attempt_id))this.run.trials.push({...pending,response:null,rt_ms:null,timeout:false,technical_invalid:true,excluded_reason:'interrupted_session'});this.run.block_restarts=this.run.block_restarts||{};if(this.run.trials.some(t=>t.block_index===block))this.run.block_restarts[block]=(this.run.block_restarts[block]||0)+1;for(const t of this.run.trials)if(t.phase==='formal'&&t.block_index===block&&!t.excluded_reason)t.excluded_reason='restarted_block';this.run.cursor.trial=0;this.run.pending_trial=null;Store.upsert(this.run);}
      this.run.runtime_versions=[...new Set([...(this.run.runtime_versions||[this.run.version]),C.VERSION])];this.updateHUD();this.renderResponse();this.intro(resume);this.checkSize();
    }
    clear(){this.token++;clearTimeout(this.timer);if(this.frame)cancelAnimationFrame(this.frame);this.timer=null;this.frame=null;}
    later(ms,fn){const token=this.token;this.timer=setTimeout(()=>{if(!this.destroyed&&token===this.token)fn();},ms);}
    paint(html,fn){const token=this.token;$('#trial-stage').innerHTML=html;if(fn)this.frame=requestAnimationFrame(()=>{if(!this.destroyed&&token===this.token)fn(performance.now());});}
    updateHUD(){const done=this.run.blocks.slice(0,this.run.cursor.block).reduce((n,b)=>n+b.trials.length,0)+this.run.cursor.trial,total=this.run.blocks.reduce((n,b)=>n+b.trials.length,0);$('#trial-counter').textContent=this.isPractice?`${this.practiceIndex+1} / ${this.practice.length}`:`${done} / ${total}`;$('#phase-label').textContent=this.isPractice?'练习':this.run.mode==='formal'?'正式':'体验';$('#trial-progress-fill').style.width=`${done/total*100}%`;$('.trial-progress').setAttribute('aria-valuenow',String(Math.round(done/total*100)));$('#stage-label').textContent=this.run.experiment==='search'?'寻找绿色 T':'比较标记段';$('#block-label').textContent=`第 ${Math.min(this.run.cursor.block+1,this.run.blocks.length)} / ${this.run.blocks.length} 组`;}
    renderResponse(feedback=''){
      if(feedback){$('#response-bar').innerHTML=`<div class="practice-feedback ${this.lastCorrect===false?'hint':''}" role="status">${feedback}</div>`;return;}
      if(this.run.experiment==='search'){$('#response-bar').innerHTML='<div class="response-key"><span class="keycap">F</span><span>出现目标</span></div><div class="response-key"><span class="keycap">J</span><span>其余画面</span></div>';}
      else{
        $('#response-bar').innerHTML=`<form id="ratio-form" class="ratio-response"><fieldset class="segment-choice" disabled><legend class="sr-only">较短的标记段</legend><label><input type="radio" name="shorter" value="upper" required><span>上段</span></label><label><input type="radio" name="shorter" value="lower" required><span>下段</span></label></fieldset><label class="ratio-question" for="estimate">短段占长段</label><span class="number-wrap"><input id="estimate" aria-label="估计百分数" type="number" min="0" max="100" step="0.1" inputmode="decimal" autocomplete="off" required disabled><span>%</span></span><button class="btn btn-primary" id="ratio-submit" type="submit" disabled>确认</button></form>`;
        $('#ratio-form').addEventListener('submit',e=>{e.preventDefault();if(this.state!=='stimulus')return;const value=$('#estimate').value.trim(),n=Number(value);if(value===''||!Number.isFinite(n)||n<0||n>100){toast('输入0—100的估计值');return;}if(!$('input[name="shorter"]:checked')){toast('选择较短段');return;}this.respond(n);});
      }
    }
    overlay(title,text,buttons){this.overlayState={title,text,buttons};this.paint(`<div class="stage-overlay"><div class="block-dots">${this.run.blocks.map((b,i)=>`<i class="${i<this.run.cursor.block?'done':''}"></i>`).join('')}</div><h2>${title}</h2><p>${text}</p><div class="actions center">${buttons}</div></div>`);this.state='overlay';}
    intro(resume=false){const block=this.run.blocks[this.run.cursor.block];if(!block){this.complete();return;}this.section=block.section;
      if(!this.run.practice_done[block.section]){this.overlay(resume?'从本组继续':'先做一组练习',this.run.experiment==='search'?'出现绿色T按F，其余画面按J。':'比较两个圆点所在分段，先选较短段，再输入百分数。',btn('开始练习 '+icon('arrow'),'runner-practice'));}
      else this.blockIntro();
    }
    blockIntro(){const block=this.run.blocks[this.run.cursor.block];this.isPractice=false;this.updateHUD();this.renderResponse();this.overlay(`第 ${this.run.cursor.block+1} 组`,`${block.trials.length} 次`,btn('开始 '+icon('arrow'),'runner-block')+btn('返回','runner-home','quiet'));this.checkSize();}
    startPractice(){this.clear();this.isPractice=true;this.practice=C.practiceTrials(this.run,this.section);this.practiceIndex=0;this.practiceStart=this.run.trials.length;this.run.practice_rounds[this.section]=(this.run.practice_rounds[this.section]||0)+1;Store.upsert(this.run);this.next();}
    startBlock(){this.clear();this.isPractice=false;this.current=null;this.attempt=0;this.next();}
    next(){
      this.clear();if(!this.checkSize())return;
      if(this.isPractice&&this.practiceIndex>=this.practice.length){this.practiceEnd();return;}
      const block=this.run.blocks[this.run.cursor.block];if(!this.isPractice&&this.run.cursor.trial>=block.trials.length){this.run.cursor.block++;this.run.cursor.trial=0;Store.upsert(this.run);if(this.run.cursor.block>=this.run.blocks.length){this.complete();return;}this.isPractice=false;this.updateHUD();this.overlay('本组已完成','按自己的节奏休息，准备好后继续。',btn('继续下一组 '+icon('arrow'),'runner-next-block')+btn('保存并返回','runner-home','quiet'));return;}
      let spec=this.isPractice?this.practice[this.practiceIndex]:block.trials[this.run.cursor.trial];const variation=(this.run.block_restarts?.[this.run.cursor.block]||0)*1000+this.attempt;spec=C.replacementTrial(spec,variation);
      const index=this.isPractice?this.practiceIndex:this.run.cursor.trial,phase=this.isPractice?'practice':'formal';
      const trialId=`${this.run.id}:${phase}:${this.isPractice?this.section+'-r'+this.run.practice_rounds[this.section]:this.run.cursor.block}:${index}`;
      this.current={...spec,phase,block_index:this.run.cursor.block,trial_index:index,trial_id:trialId,attempt_id:C.uid(),attempt_number:this.attempt,variation_index:variation,runtime_version:C.VERSION};this.run.pending_trial={trial_id:trialId,block:this.run.cursor.block,spec:{...this.current}};Store.upsert(this.run);
      this.updateHUD();this.renderResponse();this.state='fixation';this.trialStarted=performance.now();this.paint('<div class="fixation" aria-hidden="true">+</div>');
      this.later(this.run.experiment==='search'?1000:500,()=>this.stimulus());
    }
    stimulus(){const t=this.current,html=this.run.experiment==='search'?C.searchSVG(t,t.variation_index):`<div class="single-chart-stage">${C.chartSVG(t)}</div>`;
      this.state='painting';this.paint(html,onset=>{this.onset=onset;this.current.onset_ms=onset;const svg=$('#trial-stage svg');if(svg){const rect=svg.getBoundingClientRect();this.current.rendered_width=rect.width;this.current.rendered_height=rect.height;}this.state='stimulus';if(this.run.experiment==='ratio'){$('#estimate').disabled=false;$('.segment-choice').disabled=false;$('#ratio-submit').disabled=false;}this.later(this.run.experiment==='search'?5000:30000,()=>this.respond(null,true));});
    }
    respond(response,timeout=false){
      if(this.state!=='stimulus')return;const rt=timeout?null:performance.now()-this.onset;
      const t={...this.current,response,rt_ms:rt,timeout,technical_invalid:false,trial_elapsed_ms:performance.now()-this.trialStarted};
      if(this.run.experiment==='ratio'){t.estimate=timeout?null:Number(response);t.shorter_response=$('input[name="shorter"]:checked')?.value||null;}
      let record;try{record=C.normalizeTrial(t,this.run);}catch(e){this.pause('record');toast(e.message);return;}
      this.clear();this.lastCorrect=record.correct;this.run.trials.push(record);this.run.pending_trial=null;if(this.isPractice)this.practiceIndex++;else this.run.cursor.trial++;this.attempt=0;this.current=null;Store.upsert(this.run);this.state='feedback';this.paint('');
      if(this.isPractice){const message=this.run.experiment==='search'?(record.correct?'正确':record.target_present?'绿色T · F':'其余画面 · J'):`${record.shorter_position==='upper'?'上段':'下段'} · ${fmt(record.true_ratio,1)}%`;this.renderResponse(message);}
      else if(this.run.experiment==='ratio'){$('#estimate').disabled=true;$('.segment-choice').disabled=true;$('#ratio-submit').disabled=true;}
      this.later(this.isPractice?900:300,()=>this.next());
    }
    practiceEnd(){this.clear();const records=this.run.trials.slice(this.practiceStart).filter(t=>t.phase==='practice'&&!t.technical_invalid&&!t.excluded_reason),correct=records.filter(t=>t.correct).length,pass=correct>=Math.ceil(this.practice.length*.75)||this.run.mode==='test';this.isPractice=false;
      if(pass){this.run.practice_done[this.section]=true;Store.upsert(this.run);this.updateHUD();this.renderResponse();this.overlay('练习已完成','准备好后进入本组任务。',btn('进入本组 '+icon('arrow'),'runner-ready'));}
      else{this.renderResponse();this.overlay('再熟悉一组',`本组答对 ${correct} / ${this.practice.length} 次。继续熟悉按键与标记。`,btn('继续练习','runner-practice'));}
    }
    pause(reason='已暂停'){
      if(this.destroyed||this.state==='paused'&&reason!=='storage')return;if(this.state==='overlay')this.pausedOverlay=this.overlayState;else if(this.state!=='paused')this.pausedOverlay=null;const active=['fixation','cue','blank','painting','stimulus'].includes(this.state);this.clear();
      if(active&&this.current){this.run.trials.push({...this.current,response:null,rt_ms:this.onset!=null&&this.state==='stimulus'?performance.now()-this.onset:null,timeout:false,technical_invalid:true,excluded_reason:reason,trial_elapsed_ms:performance.now()-this.trialStarted});this.attempt++;}
      this.current=null;this.run.pending_trial=null;Store.upsert(this.run);this.state='paused';this.renderResponse();this.paint(`<div class="stage-overlay"><div class="overlay-symbol">${icon('pause',28)}</div><h2>${reason==='storage'?'保存一份备份':'已暂停'}</h2><p>${reason==='storage'?'记录保留在当前页面，下载备份后继续。':'准备好后，从当前任务继续。'}</p><div class="actions center">${reason==='storage'?btn('下载备份','export-run','primary','data-run="'+E(this.run.id)+'"'):''}${btn('继续 '+icon('play',16),'runner-resume')}${btn('保存并返回','runner-home','secondary')}</div></div>`);
    }
    checkSize(){const okay=innerWidth>=1000&&innerHeight>=620;if(!okay){if(['fixation','cue','blank','painting','stimulus','feedback'].includes(this.state))this.pause('window_size');if(!$('.device-cover'))$('.trial-shell').insertAdjacentHTML('beforeend',`<div class="device-cover"><div class="overlay-symbol">${icon('monitor',30)}</div><h2>在电脑上继续</h2><p>使用横向窗口，让刺激画面清晰呈现。</p>${btn('实验选择','runner-home','secondary')}</div>`);return false;}$('.device-cover')?.remove();return true;}
    action(action){
      if(action==='runner-practice')this.startPractice();
      else if(action==='runner-ready')this.blockIntro();
      else if(action==='runner-block')this.startBlock();
      else if(action==='runner-next-block')this.intro();
      else if(action==='runner-pause')this.pause();
      else if(action==='runner-resume'){if(this.checkSize()){if(this.pausedOverlay){const overlay=this.pausedOverlay;this.pausedOverlay=null;this.overlay(overlay.title,overlay.text,overlay.buttons);}else if(this.practice.length&&this.isPractice)this.next();else if(this.run.practice_done[this.run.blocks[this.run.cursor.block]?.section])this.next();else this.intro();}}
      else if(action==='runner-home'){this.clear();this.pause('返回实验选择');this.destroy();App.runner=null;App.dashboard();}
      else if(action==='runner-fullscreen'){if(['fixation','cue','blank','painting','stimulus','feedback'].includes(this.state))this.pause('fullscreen');if(!document.fullscreenElement)document.documentElement.requestFullscreen?.().catch(()=>toast('可使用浏览器全屏功能'));else document.exitFullscreen?.();}
    }
    complete(){this.clear();this.run.status='complete';this.run.completed_at=new Date().toISOString();this.run.pending_trial=null;const integrity=C.inspectRun(this.run);if(!integrity.ok){this.run.status='review';this.run.integrity_issues=integrity.message;Store.upsert(this.run);this.overlay('记录已保存','请下载备份，交由研究者核对。',btn('下载JSON','export-run','primary','data-run="'+E(this.run.id)+'"')+btn('保存并返回','runner-home','secondary'));return;}this.run.schedule_summary=this.run.blocks.map(b=>({id:b.id,section:b.section,condition:b.condition,planned_trials:b.trials.length}));delete this.run.blocks;Store.upsert(this.run);App.finish(this.run);}
    destroy(){this.clear();this.destroyed=true;}
  }

  document.addEventListener('click',event=>{const el=event.target.closest('[data-action]');if(el){event.preventDefault();App.dispatch(el.dataset.action,el);}});
  document.addEventListener('keydown',event=>{
    if($('#modal-root .modal')){if(event.key==='Escape'){event.preventDefault();closeModal();return;}if(event.key==='Tab'){const list=[...$('#modal-root .modal').querySelectorAll('button,a,input,select,[tabindex="0"]')].filter(el=>!el.disabled),first=list[0],last=list[list.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}return;}
    const runner=App.runner;if(!runner)return;if(event.key==='Escape'){event.preventDefault();runner.pause();return;}if(event.repeat)return;const key=event.code==='KeyF'?'f':event.code==='KeyJ'?'j':event.key.toLowerCase();if(runner.run.experiment==='search'&&['f','j'].includes(key)){event.preventDefault();runner.respond(key);}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&App.runner&&['fixation','cue','blank','painting','stimulus','feedback'].includes(App.runner.state))App.runner.pause('visibility');});
  window.addEventListener('blur',()=>{if(App.runner&&['fixation','cue','blank','painting','stimulus','feedback'].includes(App.runner.state))App.runner.pause('focus');});
  window.addEventListener('resize',()=>{const r=App.runner;if(r&&!r.destroyed){const changed=r.dimensions[0]!==innerWidth||r.dimensions[1]!==innerHeight;r.dimensions=[innerWidth,innerHeight];if(changed&&['fixation','cue','blank','painting','stimulus','feedback'].includes(r.state))r.pause('resize');r.checkSize();}});
  window.addEventListener('beforeunload',()=>{if(App.runner){if(['fixation','cue','blank','painting','stimulus'].includes(App.runner.state))App.runner.pause('reload');Store.upsert(App.runner.run);}});
  Store.load();try{const id=sessionStorage.getItem(SESSION_KEY);if(id&&Store.data.profiles[id]?.consent_version===CONSENT_VERSION)App.participant=id;}catch{}
  if(App.participant)App.dashboard();else App.login();
})();
