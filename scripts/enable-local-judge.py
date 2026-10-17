#!/usr/bin/env python3
from pathlib import Path
import secrets
root=Path(__file__).resolve().parents[1]
p=root/'.env'
if not p.exists():raise SystemExit('Run scripts/init-dev.py first')
lines=p.read_text().splitlines()
values=dict(line.split('=',1) for line in lines if line and not line.startswith('#') and '=' in line)
if values.get('JUDGE_URL') not in ('','http://localhost:2358'):
    raise SystemExit('An external judge is configured. Preserving its settings; no changes made.')
updates={'JUDGE_ENABLED':'true','JUDGE_URL':'http://localhost:2358','JUDGE_API_KEY':values.get('JUDGE_API_KEY') or secrets.token_hex(32),'JUDGE_JAVA_ID':'1','JUDGE_PYTHON_ID':'2','JUDGE_CPP_ID':'3','JUDGE_JAVASCRIPT_ID':'4'}
result=[]
for line in lines:
    name=line.split('=',1)[0]
    result.append(name+'='+updates.pop(name) if name in updates else line)
result.extend(k+'='+v for k,v in updates.items())
p.write_text('\n'.join(result)+'\n');p.chmod(0o600)
print('Local isolated judge configured; credentials preserved or generated without printing.')
