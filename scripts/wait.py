#!/usr/bin/env python3
import time,sys,urllib.request
url=sys.argv[1]
deadline=time.monotonic()+120
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
while time.monotonic()<deadline:
    try:
        with opener.open(url,timeout=3) as response:
            if response.status==200:
                print('Service readiness check passed.')
                break
    except Exception:
        time.sleep(1)
else:
    raise SystemExit('Service did not become ready within 120 seconds: '+url)
