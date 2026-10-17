#!/usr/bin/env python3
"""Supervise local application processes; stop only children launched here on exit."""
from pathlib import Path
import subprocess,os,sys,time,signal,fcntl
root=Path(__file__).resolve().parents[1]
os.chdir(root)
(root/'.tools').mkdir(exist_ok=True)
lock=open(root/'.tools/runtime.lock','w')
try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
except BlockingIOError:raise SystemExit('A local application supervisor is already running.')
values=os.environ.copy()
for line in (root/'.env').read_text().splitlines():
    if line and not line.startswith('#') and '=' in line:
        key,value=line.split('=',1);values.setdefault(key,value)
subprocess.run(['docker','compose','up','-d','postgres','keycloak','rabbitmq','redis'],check=True)
subprocess.run([sys.executable,'scripts/wait.py','http://localhost:8081/realms/placeprep/.well-known/openid-configuration'],check=True)
commands=[['java','-jar','backend/target/placeprep-api-1.0.0.jar'],['npm','run','start','--prefix','frontend'],['.tools/ai-venv/bin/uvicorn','--app-dir','ai-service','main:app','--host','127.0.0.1','--port','8000']]
if values.get('JUDGE_ENABLED')=='true' and values.get('JUDGE_URL')=='http://localhost:2358':
    commands.append(['.tools/ai-venv/bin/uvicorn','--app-dir','judge-service','main:app','--host','127.0.0.1','--port','2358'])
children=[]
def stop(*_):raise KeyboardInterrupt
signal.signal(signal.SIGTERM,stop)
signal.signal(signal.SIGINT,stop)
try:
    for command in commands:children.append(subprocess.Popen(command,env=values,start_new_session=True))
    subprocess.run([sys.executable,'scripts/wait.py','http://localhost:8080/actuator/health'],check=True)
    subprocess.run([sys.executable,'scripts/wait.py','http://localhost:3000/dashboard'],check=True)
    print('PlacePrep local services are ready. Create a student account through Sign in → Register.',flush=True)
    while True:
        if any(child.poll() is not None for child in children):raise RuntimeError('An application service exited. Inspect its output above.')
        time.sleep(1)
except KeyboardInterrupt:
    pass
finally:
    for child in children:
        if child.poll() is None:os.killpg(child.pid,signal.SIGTERM)
    for child in children:
        try:child.wait(timeout=10)
        except subprocess.TimeoutExpired:os.killpg(child.pid,signal.SIGKILL)
