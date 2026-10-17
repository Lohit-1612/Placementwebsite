#!/usr/bin/env python3
"""Load ignored local .env and run a command without exposing credential values."""
import os
import sys
from pathlib import Path
import subprocess
root=Path(__file__).resolve().parents[1]
values=os.environ.copy()
file=root/'.env'
if file.exists():
    for line in file.read_text().splitlines():
        if line and not line.startswith('#') and '=' in line:
            key,value=line.split('=',1)
            values.setdefault(key,value)
if len(sys.argv)<2:
    raise SystemExit('Usage: python3 scripts/with-env.py <command> [arguments]')
raise SystemExit(subprocess.call(sys.argv[1:],cwd=root,env=values))
