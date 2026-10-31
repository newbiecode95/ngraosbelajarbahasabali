#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-}" != '--check' && "${1:-}" != '--provision' ]]; then
  echo 'Usage: bash scripts/deploy-hostname.sh --check|--provision' >&2
  exit 2
fi
python3 - "$1" <<'PY'
import json, pathlib, sys, urllib.error, urllib.parse, urllib.request
HOST='ngraos.docker.anatera.app'
ORIGIN='origin.anatera.app'
config=json.loads(pathlib.Path('/opt/kelana-panel/infrastructure/hosting.json').read_text())
base='https://api.cloudflare.com/client/v4/zones/'+config['zoneId']
def request(path, method='GET', data=None):
    body=None if data is None else json.dumps(data).encode()
    req=urllib.request.Request(base+path, data=body, method=method, headers={
        'Authorization':'Bearer '+config['cloudflareToken'], 'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req,timeout=35) as response: result=json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError('Cloudflare request rejected with HTTP '+str(error.code)) from None
    if not result.get('success'): raise RuntimeError('Cloudflare request failed; verify account permissions privately.')
    return result
def ensure_record(name, kind, value, proxied=False):
    records=request('/dns_records?name='+urllib.parse.quote(name))['result']
    if any(r['type']==kind and r['content'].rstrip('.')==value.rstrip('.') and (kind!='CNAME' or bool(r.get('proxied'))==proxied) for r in records): return
    if records and not (kind=='TXT' and all(r['type']=='TXT' for r in records)):
        raise RuntimeError('Conflicting DNS record preserved: '+name)
    request('/dns_records','POST',{'name':name,'type':kind,'content':value,'proxied':proxied,'ttl':1,'comment':'Ngraos learning application'})
try:
    matches=request('/custom_hostnames?hostname='+urllib.parse.quote(HOST))['result']
    host=next((h for h in matches if h['hostname']==HOST),None)
    if sys.argv[1]=='--provision':
        if not host:
            inventory=request('/custom_hostnames?per_page=1')
            if inventory.get('result_info',{}).get('total_count',100)>=100:
                raise RuntimeError('Included hostname allowance reached; no paid hostname created.')
            host=request('/custom_hostnames','POST',{'hostname':HOST,'ssl':{'type':'dv','method':'txt','settings':{'min_tls_version':'1.2'}}})['result']
        ownership=host.get('ownership_verification') or {}
        if ownership.get('name'): ensure_record(ownership['name'],ownership.get('type','TXT').upper(),ownership['value'])
        for record in host.get('ssl',{}).get('validation_records') or []:
            if record.get('txt_name'): ensure_record(record['txt_name'],'TXT',record['txt_value'])
            elif record.get('cname'): ensure_record(record['cname'],'CNAME',record['cname_target'])
        ensure_record(HOST,'CNAME',ORIGIN,True)
    if host: host=request('/custom_hostnames/'+host['id'])['result']
    dns=request('/dns_records?name='+urllib.parse.quote(HOST))['result']
    print(json.dumps({'hostname':HOST,'status':host['status'] if host else 'not provisioned','ssl_status':host.get('ssl',{}).get('status') if host else None,'dns_present':bool(dns)}))
except Exception as error:
    print(str(error),file=sys.stderr)
    sys.exit(1)
PY
