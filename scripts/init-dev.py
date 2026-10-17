#!/usr/bin/env python3
"""Generate local credentials without overwriting an existing environment file."""
from pathlib import Path
import secrets
import json
root=Path(__file__).resolve().parents[1]
env=root/'.env'
if not env.exists():
    env.write_text('\n'.join([
        'DB_USER=placeprep','DB_PASSWORD='+secrets.token_hex(24),
        'RABBIT_USER=placeprep','RABBIT_PASSWORD='+secrets.token_hex(24),
        'KC_ADMIN=operator','KC_PASSWORD='+secrets.token_hex(24),
        'OIDC_ISSUER=http://localhost:8081/realms/placeprep',
        'OIDC_JWKS=http://localhost:8081/realms/placeprep/protocol/openid-connect/certs',
        'JUDGE_ENABLED=false','JUDGE_URL=','JUDGE_API_KEY=',
        'JUDGE_JAVA_ID=0','JUDGE_PYTHON_ID=0','JUDGE_CPP_ID=0','JUDGE_JAVASCRIPT_ID=0',
        'AI_PROVIDER_KEY=','AI_MODEL=','AI_URL=http://localhost:8000',
        'NEXT_PUBLIC_OIDC_URL=http://localhost:8081','NEXT_PUBLIC_OIDC_REALM=placeprep',
        ''
    ]))
    env.chmod(0o600)
    print('Created .env with random local credentials. Values were not printed.')
else:
    print('Preserved existing .env.')
realm={
 'realm':'placeprep','enabled':True,'displayName':'PlacePrep AI',
 'registrationAllowed':True,'resetPasswordAllowed':False,'rememberMe':True,
 'loginWithEmailAllowed':True,'duplicateEmailsAllowed':False,
 'sslRequired':'external','accessTokenLifespan':300,
 'passwordPolicy':'length(12) and notUsername',
 'roles':{'realm':[{'name':r} for r in ['STUDENT','FACULTY','HOD','ADMIN','RECRUITER','PLATFORM_ADMIN']]},
 'defaultRoles':['STUDENT'],
 'clients':[{'clientId':'placeprep-web','name':'PlacePrep web','enabled':True,'publicClient':True,'standardFlowEnabled':True,'directAccessGrantsEnabled':False,
    'redirectUris':['http://localhost:3000/*'],'webOrigins':['http://localhost:3000'],
    'attributes':{'pkce.code.challenge.method':'S256','post.logout.redirect.uris':'http://localhost:3000/*'},
    'protocolMappers':[
      {'name':'college','protocol':'openid-connect','protocolMapper':'oidc-hardcoded-claim-mapper','config':{'claim.name':'tenant_id','claim.value':'11111111-1111-4111-8111-111111111111','jsonType.label':'String','access.token.claim':'true','id.token.claim':'true','userinfo.token.claim':'true'}},
      {'name':'api-audience','protocol':'openid-connect','protocolMapper':'oidc-audience-mapper','config':{'included.custom.audience':'placeprep-api','access.token.claim':'true','id.token.claim':'false'}}
    ]}]
}
generated=root/'infra/generated'
generated.mkdir(exist_ok=True)
(generated/'realm.json').write_text(json.dumps(realm,indent=2))
print('Generated local OIDC realm. This trusted local college binding is development-only.')
