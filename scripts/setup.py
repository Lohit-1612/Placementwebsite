#!/usr/bin/env python3
"""Repeatable local/cloud installation. Never resets a database or deletes volumes."""
from pathlib import Path
import os,subprocess,sys,shutil
root=Path(__file__).resolve().parents[1]
os.chdir(root)
def run(*args,env=None):subprocess.run(args,check=True,env=env)
run('docker','info','--format','{{.ServerVersion}}')
run(sys.executable,'scripts/init-dev.py')
images=['eclipse-temurin:21.0.8_9-jdk','python:3.12.12-slim','gcc:14.3.0','node:24.11.0-bookworm-slim']
for image in images:
    if subprocess.run(['docker','image','inspect',image],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode:
        run('docker','pull',image)
run(sys.executable,'scripts/enable-local-judge.py')
environment=os.environ.copy()
jdk=root/'.tools/jdk-21'
if not (jdk/'lib/ct.sym').is_file():
    jdk.parent.mkdir(exist_ok=True)
    container=subprocess.check_output(['docker','create',images[0]],text=True).strip()
    try:run('docker','cp',container+':/opt/java/openjdk',str(jdk))
    finally:run('docker','rm',container)
environment['JAVA_HOME']=str(jdk)
# Preserve the cloud machine's installed trust roots when using its TLS egress proxy.
# Verification is never disabled. This alters only the task-owned JDK copy.
trust=Path('/etc/ssl/certs/java/cacerts')
if environment.get('HTTPS_PROXY') and trust.is_file():shutil.copy2(trust,jdk/'lib/security/cacerts')
run(sys.executable,'scripts/with-env.py',sys.executable,'scripts/mvn.py','-B','-f','backend/pom.xml','package','-DskipTests',env=environment)
run('npm','--cache',str(root/'.tools/npm'),'ci','--prefix','frontend')
run('npm','--cache',str(root/'.tools/npm'),'run','build','--prefix','frontend')
venv=root/'.tools/ai-venv'
if not (venv/'bin/python').exists():run(sys.executable,'-m','venv',str(venv))
run(str(venv/'bin/pip'),'--cache-dir',str(root/'.tools/pip'),'install','-r','ai-service/requirements.lock')
run('docker','compose','up','-d','postgres','keycloak','rabbitmq','redis')
run(sys.executable,'scripts/wait.py','http://localhost:8081/realms/placeprep/.well-known/openid-configuration')
print('Dependencies and infrastructure prepared. Run python3 scripts/dev.py to start the application services.')
