"""Local-only trusted judge control plane. Student code runs ONLY in disposable Docker containers.
Do not expose this service or its Docker access publicly. See docs/SECURITY.md.
"""
import asyncio
import base64
import hmac
import json
import os
import time
import uuid
from typing import Annotated
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title='PlacePrep isolated local judge', version='1.0.0')
slots = asyncio.Semaphore(2)
LANGUAGES = {
    1: {'name': 'Java 21', 'image': 'eclipse-temurin:21.0.8_9-jdk', 'file': 'Main.java',
        'compile': 'javac -J-Xmx128m -J-XX:ActiveProcessorCount=1 Main.java',
        'run': 'java -Xms16m -Xmx64m -XX:ActiveProcessorCount=1 -XX:+UseSerialGC Main'},
    2: {'name': 'Python 3.12', 'image': 'python:3.12.12-slim', 'file': 'main.py', 'compile': ':', 'run': 'python3 -I -B main.py'},
    3: {'name': 'C++17', 'image': 'gcc:14.3.0', 'file': 'main.cpp', 'compile': 'g++ -std=c++17 -O2 -o /sandbox/main main.cpp', 'run': '/sandbox/main'},
    4: {'name': 'JavaScript / Node 24', 'image': 'node:24.11.0-bookworm-slim', 'file': 'main.js', 'compile': ':', 'run': 'node --max-old-space-size=64 main.js'},
}
class Execution(BaseModel):
    language_id: int
    source_code: str = Field(min_length=1, max_length=50000)
    stdin: str = Field(default='', max_length=50000)
    expected_output: str = Field(default='', max_length=50000)
    enable_network: bool = False

async def command(*args):
    process = await asyncio.create_subprocess_exec(*args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=10)
    return process.returncode, stdout, stderr

def verdict(code, description, stdout='', stderr='', compile_output='', elapsed=0):
    return {'status': {'id': code, 'description': description}, 'stdout': stdout, 'stderr': stderr,
            'compile_output': compile_output, 'time': round(elapsed, 3)}

@app.get('/health')
async def health():
    return {'status': 'ok', 'configured': bool(os.getenv('JUDGE_API_KEY'))}

@app.get('/languages')
async def languages():
    return [{'id': key, 'name': value['name']} for key, value in LANGUAGES.items()]

@app.post('/submissions')
async def execute(data: Execution, key: Annotated[str | None, Header(alias='X-Auth-Token')] = None):
    required = os.getenv('JUDGE_API_KEY', '')
    if not required or not key or not hmac.compare_digest(required, key):
        raise HTTPException(401, 'Judge authentication required')
    if data.language_id not in LANGUAGES or data.enable_network:
        raise HTTPException(400, 'Unsupported language or execution options')
    if slots.locked():
        raise HTTPException(429, 'Judge is busy; retry later')
    async with slots:
        lang = LANGUAGES[data.language_id]
        name = 'placeprep-exec-' + uuid.uuid4().hex
        # This script contains only trusted constants. Source and stdin arrive as base64 DATA,
        # never as shell commands. No host filesystem or Docker socket is mounted.
        script = ('IFS= read -r source_data; IFS= read -r input_data; '
                  'printf "%s" "$source_data" | base64 -d > ' + lang['file'] + '; '
                  'printf "%s" "$input_data" | base64 -d > /sandbox/input; '
                  'if ! (' + lang['compile'] + ') > /sandbox/compile 2>&1; then '
                  'head -c 16000 /sandbox/compile >&2; exit 42; fi; '
                  'timeout -s KILL 2s ' + lang['run'] + ' < /sandbox/input')
        payload = base64.b64encode(data.source_code.encode()) + b'\n' + base64.b64encode(data.stdin.encode()) + b'\n'
        process = None
        tasks = []
        output = bytearray()
        errors = bytearray()
        limit_hit = False
        started = time.monotonic()
        async def drain(stream, target):
            nonlocal limit_hit
            while True:
                chunk = await stream.read(4096)
                if not chunk:
                    return
                target.extend(chunk)
                if len(output) + len(errors) > 32768:
                    limit_hit = True
                    raise OverflowError('Output limit')
        try:
            process = await asyncio.create_subprocess_exec(
                'docker', 'run', '--name', name, '--pull=never', '--label', 'app=placeprep-sandbox',
                '--network=none', '--user=65534:65534', '--cap-drop=ALL',
                '--security-opt=no-new-privileges:true', '--read-only', '--pids-limit=64',
                '--cpus=1', '--memory=512m', '--memory-swap=512m',
                '--ulimit', 'nofile=64:64', '--ulimit', 'fsize=16777216:16777216',
                '--tmpfs', '/sandbox:rw,exec,nosuid,size=64m,uid=65534,gid=65534,mode=700',
                '--tmpfs', '/tmp:rw,noexec,nosuid,size=32m,uid=65534,gid=65534,mode=700',
                '--workdir=/sandbox', '--log-driver=none', '-i', lang['image'], 'sh', '-c', script,
                stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            )
            process.stdin.write(payload)
            await process.stdin.drain()
            process.stdin.close()
            tasks = [asyncio.create_task(drain(process.stdout, output)), asyncio.create_task(drain(process.stderr, errors)), asyncio.create_task(process.wait())]
            await asyncio.wait_for(asyncio.gather(*tasks), timeout=23)
            elapsed = time.monotonic() - started
            stdout = output.decode(errors='replace')[:16000]
            stderr = errors.decode(errors='replace')[:16000]
            if process.returncode == 42:
                return verdict(6, 'Compilation Error', compile_output=stderr, elapsed=elapsed)
            if process.returncode == 137:
                _, inspected, _ = await command('docker', 'inspect', '--format', '{{.State.OOMKilled}}', name)
                return verdict(14 if inspected.strip() == b'true' else 5,
                               'Memory Limit Exceeded' if inspected.strip() == b'true' else 'Time Limit Exceeded', elapsed=elapsed)
            if process.returncode == 125:
                return verdict(13, 'Internal Judge Error')
            if process.returncode != 0:
                return verdict(11, 'Runtime Error', stdout, stderr, elapsed=elapsed)
            accepted = stdout.strip() == data.expected_output.strip()
            return verdict(3 if accepted else 4, 'Accepted' if accepted else 'Wrong Answer', stdout, stderr, elapsed=elapsed)
        except OverflowError:
            return verdict(15, 'Output Limit Exceeded')
        except asyncio.TimeoutError:
            return verdict(13, 'Internal Judge Error', stderr='Judge infrastructure deadline exceeded')
        except (OSError, BrokenPipeError):
            return verdict(13, 'Internal Judge Error')
        finally:
            for task in tasks:
                if not task.done():
                    task.cancel()
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)
            # Cleanup targets only the random container name created for this request.
            try:
                await command('docker', 'rm', '-f', name)
            except (OSError, asyncio.TimeoutError):
                pass
            if process and process.returncode is None:
                process.kill()
                try:
                    await asyncio.wait_for(process.communicate(), timeout=5)
                except asyncio.TimeoutError:
                    pass
