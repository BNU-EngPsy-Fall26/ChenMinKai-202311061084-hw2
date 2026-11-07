import json, math, statistics, itertools, hashlib
from pathlib import Path
from datetime import datetime
root=Path(__file__).resolve().parents[2]
source=root/'注意实验室_全部记录_2026-11-07.json'
raw=source.read_bytes(); data=json.loads(raw.decode('utf-8-sig'))
report=json.loads((root/'04_分析与报告/分析结果.json').read_text(encoding='utf-8'))
selected={s['run_id'] for g in report['groups'].values() for s in g['subjects']}
runs=[r for r in data['runs'] if r['id'] in selected]
assert len(runs)==10 and len({r['participant'] for r in runs})==5
assert len({r['id'] for r in runs})==10
expected={'search':('baseline','improved'),'ratio':('adjacent','separated')}
checks=[]; details=[]; attempt_ids=[]; fingerprints=[]
for r in runs:
 rows=[t for t in r['trials'] if t['phase']=='formal' and not t.get('technical_invalid') and not t.get('excluded_reason')]
 assert len(rows)==(40 if r['experiment']=='search' else 20)
 assert len({t['trial_id'] for t in rows})==len(rows)
 attempt_ids += [t['attempt_id'] for t in rows]
 fingerprints.append(hashlib.sha256(json.dumps([(t.get('response'),t.get('rt_ms')) for t in rows]).encode()).hexdigest())
 js=next(s for s in report['groups'][r['experiment']]['subjects'] if s['run_id']==r['id'])
 cells={}
 for c in expected[r['experiment']]:
  rr=[t for t in rows if t['condition']==c]; vals=[]
  assert len(rr)==(20 if r['experiment']=='search' else 10)
  if r['experiment']=='search':
   assert sum(t['target_present'] for t in rr)==10
   for t in rr:
    correct=not t.get('timeout') and ((str(t.get('response')).lower()=='f')==t['target_present'])
    assert correct==t['correct']
    if correct: vals.append(t['rt_ms'])
   medians=[statistics.median([t['rt_ms'] for t in rr if not t.get('timeout') and t['correct'] and t['target_present']==present]) for present in [True,False]]
   cells[c]=statistics.mean(medians)
   assert abs(cells[c]-js['cells']['search:'+c]['rt'])<1e-7
  else:
   for t in rr:
    short=t['values'][t['labels'].index('A')];long=t['values'][t['labels'].index('B')]
    truth=short/long*100;assert abs(truth-t['true_ratio'])<1e-7
    ae=abs(t['estimate']-truth);assert abs(ae-t['absolute_error'])<1e-7
    correct=t['shorter_response']==('upper' if t['labels'].index('A')>t['labels'].index('B') else 'lower')
    assert correct==t['correct']; vals.append(ae)
   cells[c]=statistics.mean(vals)
   assert abs(cells[c]-js['cells']['ratio:'+c]['ae'])<1e-7
  assert len(vals)==js['cells'][r['experiment']+':'+c]['valid']
 a,b=expected[r['experiment']];assert abs(cells[a]-cells[b]-js['effects']['primary'])<1e-7
 elapsed=(datetime.fromisoformat(r['completed_at'].replace('Z','+00:00'))-datetime.fromisoformat(r['created_at'].replace('Z','+00:00'))).total_seconds()
 details.append({'participant':r['participant'],'experiment':r['experiment'],'formal':len(rows),'practice':sum(t['phase']=='practice' for t in r['trials']),'seconds':elapsed,'first_condition':rows[0]['condition'],'consent_at':r.get('consent_at'),'upload':r.get('upload',{}).get('status')})
assert len(attempt_ids)==len(set(attempt_ids))==300
assert len(fingerprints)==len(set(fingerprints))==10
for e,g in report['groups'].items():
 diffs=[s['effects']['primary'] for s in g['subjects']];obs=abs(statistics.mean(diffs))
 p=sum(abs(statistics.mean([d*s for d,s in zip(diffs,signs)]))>=obs-1e-10 for signs in itertools.product([-1,1],repeat=len(diffs)))/(2**len(diffs))
 assert abs(p-g['effects']['primary']['p'])<1e-10
 assert abs(statistics.mean(diffs)-g['effects']['primary']['mean'])<1e-7
 assert abs(statistics.stdev(diffs)-g['effects']['primary']['sd'])<1e-7
assert hashlib.sha256(source.read_bytes()).hexdigest()==report['source']['sha256']
result={'checks':'通过','duplicate_attempts':0,'duplicate_response_sequences':0,'source_sha256':report['source']['sha256'],'sessions':sorted(details,key=lambda d:(d['participant'],d['experiment']))}
(root/'04_分析与报告/数据核验.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
