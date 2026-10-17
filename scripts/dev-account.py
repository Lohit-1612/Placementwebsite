#!/usr/bin/env python3
"""Create disposable local-only browser-test accounts via the development identity provider."""
import json, secrets, urllib.request, urllib.parse
from pathlib import Path
root=Path(__file__).resolve().parents[1]
values=dict(line.split('=',1) for line in (root/'.env').read_text().splitlines() if line and not line.startswith('#') and '=' in line)
base='http://localhost:8081'
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
def call(path, data=None, token=None, method=None):
    headers={'Content-Type':'application/json'}
    if token: headers['Authorization']='Bearer '+token
    req=urllib.request.Request(base+path,data=None if data is None else json.dumps(data).encode(),headers=headers,method=method)
    with opener.open(req,timeout=20) as response:
        raw=response.read()
        return json.loads(raw) if raw else None
req=urllib.request.Request(base+'/realms/master/protocol/openid-connect/token',data=urllib.parse.urlencode({'grant_type':'password','client_id':'admin-cli','username':values['KC_ADMIN'],'password':values['KC_PASSWORD']}).encode())
token=json.loads(opener.open(req,timeout=20).read())['access_token']
file=root/'.tools/local-accounts.json'
accounts=json.loads(file.read_text()) if file.exists() else {}
for name,role in [('student','STUDENT'),('faculty','FACULTY'),('admin','ADMIN')]:
    if name in accounts:continue
    username='e2e-'+name+'-'+secrets.token_hex(3)
    password=secrets.token_urlsafe(24)
    call('/admin/realms/placeprep/users',{'username':username,'email':username+'@test.invalid','emailVerified':True,'firstName':'Test','lastName':name.capitalize(),'enabled':True,'credentials':[{'type':'password','value':password,'temporary':False}]},token)
    user=call('/admin/realms/placeprep/users?username='+username,token=token)[0]
    role_data=call('/admin/realms/placeprep/roles/'+role,token=token)
    call('/admin/realms/placeprep/users/'+user['id']+'/role-mappings/realm',[role_data],token)
    accounts[name]={'username':username,'password':password}
file.write_text(json.dumps(accounts));file.chmod(0o600)
print('Local browser-test accounts provisioned. Credentials retained only in ignored .tools/local-accounts.json.')
