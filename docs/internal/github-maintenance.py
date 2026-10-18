"""Use the existing Git credential helper for authorized repository maintenance.
Credentials stay in memory and are never printed or saved by this script.
"""
import json,subprocess,sys,urllib.request,urllib.error
from pathlib import Path
raw=subprocess.run(['git','credential','fill'],input='protocol=https\nhost=github.com\n\n',capture_output=True,text=True,check=True).stdout
credentials=dict(line.split('=',1) for line in raw.splitlines() if '=' in line)
token=credentials.get('password')
if not token:raise SystemExit('No existing GitHub Git credential is available')
base='https://api.github.com/repos/touhid404/furniture-commerce'
def call(method,path='',body=None):
 req=urllib.request.Request(base+path,method=method,data=None if body is None else json.dumps(body).encode(),headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json','User-Agent':'furniture-commerce-maintenance'})
 try:
  with urllib.request.urlopen(req,timeout=40) as response:return json.load(response) if response.status!=204 else {}
 except urllib.error.HTTPError as error:
  try:details=json.load(error)
  except Exception:details={}
  raise SystemExit(f'GitHub {method} {path}: HTTP {error.code}: {details.get("message","request failed")}')
 except (TimeoutError, urllib.error.URLError):
  raise SystemExit(f'GitHub {method} {path}: network timeout or connection failure; inspect remote state before retrying mutations')
mode=sys.argv[1]
if mode=='inspect':
 repo=call('GET');print(json.dumps({k:repo[k] for k in ['full_name','private','default_branch','html_url']}))
elif mode=='pr':
 body=Path(sys.argv[2]).read_text()
 pr=call('POST','/pulls',{'title':'Document the commerce platform and verify its Neon foundation','body':body,'head':'feat/documentation-and-neon-foundation','base':'main','draft':True})
 print(json.dumps({'number':pr['number'],'url':pr['html_url'],'state':pr['state'],'draft':pr['draft']}))
elif mode=='milestone-pr':
 body=Path(sys.argv[2]).read_text()
 head='feat/commerce-platform'
 existing=call('GET','/pulls?state=open&head=touhid404:'+head)
 if existing:pr=existing[0]
 else:pr=call('POST','/pulls',{'title':'Implement the commerce platform in frontend and backend workspaces','body':body,'head':head,'base':'main','draft':True})
 print(json.dumps({'number':pr['number'],'url':pr['html_url'],'state':pr['state'],'draft':pr['draft']}))
elif mode=='open-state':
 items=call('GET','/issues?state=all&per_page=100')
 print(json.dumps([{'number':i['number'],'title':i['title'],'state':i['state'],'pull_request':'pull_request' in i} for i in items]))
elif mode=='pr-state':
 number=sys.argv[2]
 pr=call('GET','/pulls/'+number)
 reviews=call('GET','/pulls/'+number+'/reviews')
 comments=call('GET','/issues/'+number+'/comments')
 inline=call('GET','/pulls/'+number+'/comments')
 checks=call('GET','/commits/'+pr['head']['sha']+'/check-runs')
 print(json.dumps({'number':pr['number'],'state':pr['state'],'draft':pr['draft'],'mergeable':pr['mergeable'],'mergeable_state':pr['mergeable_state'],'sha':pr['head']['sha'],'reviews':[{'state':r['state'],'body':r['body']} for r in reviews],'comments':[{'id':c['id'],'body':c['body']} for c in comments],'inline':[{'id':c['id'],'path':c['path'],'body':c['body']} for c in inline],'checks':[{'name':c['name'],'conclusion':c['conclusion']} for c in checks['check_runs']]}))
elif mode=='update-pr':
 body=Path(sys.argv[3]).read_text()
 pr=call('PATCH','/pulls/'+sys.argv[2],{'title':'Complete the reference commerce storefront, admin and Neon services','body':body})
 print(json.dumps({'number':pr['number'],'url':pr['html_url']}))
elif mode=='update-issue':
 body=Path(sys.argv[3]).read_text()
 data={'body':body}
 if len(sys.argv)>4:data['title']=sys.argv[4]
 issue=call('PATCH','/issues/'+sys.argv[2],data)
 print(json.dumps({'number':issue['number'],'state':issue['state']}))
elif mode=='runs':
 from urllib.parse import quote
 branch=sys.argv[2] if len(sys.argv)>2 else 'feat/documentation-and-neon-foundation'
 runs=call('GET','/actions/runs?branch='+quote(branch,safe='')+'&per_page=3')
 print(json.dumps([{'id':r['id'],'url':r['html_url'],'status':r['status'],'conclusion':r['conclusion'],'sha':r['head_sha']} for r in runs['workflow_runs']]))
elif mode=='jobs':
 data=call('GET',f'/actions/runs/{sys.argv[2]}/jobs')
 print(json.dumps([{'name':j['name'],'conclusion':j['conclusion'],'steps':[{'name':s['name'],'conclusion':s['conclusion']} for s in j['steps']]} for j in data['jobs']]))
elif mode=='failed-checks':
 pr=call('GET','/pulls/'+sys.argv[2])
 checks=call('GET','/commits/'+pr['head']['sha']+'/check-runs')
 for check in checks['check_runs']:
  if check['conclusion']=='failure':print(json.dumps(call('GET','/check-runs/'+str(check['id'])+'/annotations?per_page=20')))
elif mode=='ready':
 pr=call('GET','/pulls/'+sys.argv[2])
 payload={'query':'mutation($id:ID!){markPullRequestReadyForReview(input:{pullRequestId:$id}){pullRequest{isDraft}}}','variables':{'id':pr['node_id']}}
 req=urllib.request.Request('https://api.github.com/graphql',method='POST',data=json.dumps(payload).encode(),headers={'Authorization':'Bearer '+token,'Content-Type':'application/json','User-Agent':'furniture-commerce-maintenance'})
 with urllib.request.urlopen(req,timeout=40) as response:result=json.load(response)
 if result.get('errors'):raise SystemExit('GitHub refused ready-for-review transition: '+result['errors'][0]['message'])
 print(json.dumps(result['data']))
elif mode=='merge':
 result=call('PUT','/pulls/'+sys.argv[2]+'/merge',{'sha':sys.argv[3],'merge_method':'merge','commit_title':'Merge pull request #'+sys.argv[2]+': complete commerce storefront and admin'})
 print(json.dumps(result))
elif mode=='close-pr':
 result=call('PATCH','/pulls/'+sys.argv[2],{'state':'closed','body':Path(sys.argv[3]).read_text()})
 print(json.dumps({'number':result['number'],'state':result['state']}))
elif mode=='issues':
 existing=call('GET','/issues?state=all&per_page=100')
 titles={i['title'] for i in existing}
 work=[
 ('Implement reference storefront and sign in','Requirements R01 and R02. Build the reference header, home bento layout, lighting catalog, bag feedback and sign-in geometry. Add secure server authentication, original assets and local visual comparisons. Acceptance A01 to A04. Depends on owner assets and confirmed identity implementation.'),
 ('Implement catalog inventory and admin operations','Implement documented product/category CRUD, market price books, inventory ledger and ADMIN authorization. Preserve the reference sidebar. Add role, concurrency and version-conflict checks. Requirements R02 R03 R05; acceptance A08 A17.'),
 ('Implement card and COD checkout safely','Choose supported card provider, shipping/tax rules and delivery policy. Implement quotes, reservations, idempotent order submission, verified webhooks, COD collection and real-data dashboard metrics. Requirements R05 R06; acceptance A07 to A15.'),
 ('Implement fulfillment returns refunds and production release','Implement shipping, guest order access, cancellation, returns, partial refunds, transactional email and operational monitoring. Complete release accessibility/performance checks and restore rehearsal. Requirements R07; acceptance A16 to A20.')]
 for title,body in work:
  if title in titles:continue
  issue=call('POST','/issues',{'title':title,'body':body+'\n\nSee docs/09-delivery-and-acceptance.md for the full dependency plan. No completion date is promised.'})
  print(json.dumps({'number':issue['number'],'url':issue['html_url'],'title':issue['title']}))
elif mode=='protection':
 req={'required_status_checks':{'strict':True,'contexts':['validate']},'enforce_admins':True,'required_pull_request_reviews':{'dismiss_stale_reviews':True,'required_approving_review_count':0},'restrictions':None,'allow_force_pushes':False,'allow_deletions':False}
 result=call('PUT','/branches/main/protection',req)
 print(json.dumps({'url':result.get('url'),'status':'configured','checks':['validate'],'force_pushes':False}))
else:raise SystemExit('Unknown mode')
