#!/usr/bin/env python3
"""Pinned Maven launcher. Uses HTTPS verification and a pinned artifact SHA-512."""
import os, sys, hashlib, tarfile, urllib.request, urllib.parse, subprocess
from pathlib import Path
from xml.sax.saxutils import escape
root=Path(__file__).resolve().parents[1]
cache=root/'.tools'
cache.mkdir(exist_ok=True)
version='3.9.11'
executable=cache/f'apache-maven-{version}/bin/mvn'
if not executable.exists():
    url=f'https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/{version}/apache-maven-{version}-bin.tar.gz'
    data=urllib.request.urlopen(url, timeout=60).read()
    if hashlib.sha512(data).hexdigest() != 'bcfe4fe305c962ace56ac7b5fc7a08b87d5abd8b7e89027ab251069faebee516b0ded8961445d6d91ec1985dfe30f8153268843c89aa392733d1a3ec956c9978':
        raise SystemExit('Maven artifact checksum mismatch')
    archive=cache/'maven.tar.gz'
    archive.write_bytes(data)
    with tarfile.open(archive) as bundle:
        bundle.extractall(cache, filter='data')
    archive.unlink()
args=[str(executable),'-Dmaven.repo.local='+str(cache/'m2')]
proxy=urllib.parse.urlparse(os.getenv('HTTPS_PROXY',''))
if proxy.hostname:
    settings=cache/'proxy-settings.xml'
    settings.write_text('<settings><proxies><proxy><id>environment</id><active>true</active><protocol>http</protocol><host>'+escape(proxy.hostname)+'</host><port>'+str(proxy.port or 80)+'</port><nonProxyHosts>localhost|127.0.0.1</nonProxyHosts></proxy></proxies></settings>')
    args+=['-s',str(settings)]
environment=os.environ.copy()
installed_jdk=root/'.tools/jdk-21'
if (installed_jdk/'lib/ct.sym').is_file() and not environment.get('JAVA_HOME'):
    environment['JAVA_HOME']=str(installed_jdk)
raise SystemExit(subprocess.call(args+sys.argv[1:],cwd=root,env=environment))
