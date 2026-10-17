"""Real execution tests. Requires the local judge and pinned Docker runtime images."""
import json
import os
from pathlib import Path
import urllib.request
import unittest

root = Path(__file__).resolve().parents[1]
values = dict(line.split('=', 1) for line in (root/'.env').read_text().splitlines() if line and not line.startswith('#') and '=' in line)
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

def execute(language, code, stdin='', expected=''):
    request = urllib.request.Request('http://localhost:2358/submissions',
        data=json.dumps({'language_id': language, 'source_code': code, 'stdin': stdin, 'expected_output': expected}).encode(),
        headers={'Content-Type': 'application/json', 'X-Auth-Token': values['JUDGE_API_KEY']})
    return json.loads(opener.open(request, timeout=30).read())

class RealExecutionTests(unittest.TestCase):
    def test_java21_accepts_real_program(self):
        code='import java.util.*; public class Main { public static void main(String[] args) { Scanner s=new Scanner(System.in); int n=s.nextInt(); long sum=0; for(int i=0;i<n;i++) sum+=s.nextLong(); System.out.println(sum); } }'
        result=execute(1,code,'3\n1000000000 1000000000 1000000000\n','3000000000\n')
        self.assertEqual(result['status']['description'],'Accepted',result)
        self.assertEqual(result['stdout'].strip(),'3000000000')

    def test_wrong_answer(self):
        self.assertEqual(execute(1,'public class Main { public static void main(String[] a) { System.out.println(1); } }',expected='2')['status']['description'],'Wrong Answer')

    def test_compilation_error(self):
        self.assertEqual(execute(1,'public class Main { broken syntax }')['status']['description'],'Compilation Error')

    def test_time_limit(self):
        self.assertEqual(execute(2,'while True: pass')['status']['description'],'Time Limit Exceeded')

    def test_output_limit(self):
        self.assertEqual(execute(2,'while True: print("x" * 4096)')['status']['description'],'Output Limit Exceeded')

    def test_runtime_error(self):
        self.assertEqual(execute(2,'raise RuntimeError("test")')['status']['description'],'Runtime Error')

    def test_python_no_network_or_host_mounts_and_nonroot(self):
        code='import os,socket\ns=socket.socket();s.settimeout(0.1)\nassert os.getuid()==65534\nassert not os.path.exists("/workspace/Placementwebsite/.env")\nassert s.connect_ex(("1.1.1.1",443))!=0\nprint("isolated")'
        self.assertEqual(execute(2,code,expected='isolated')['status']['description'],'Accepted')

    def test_cpp17(self):
        self.assertEqual(execute(3,'#include <iostream>\nint main(){long a,b;std::cin>>a>>b;std::cout<<a+b;}', '20 22','42')['status']['description'],'Accepted')

    def test_javascript(self):
        self.assertEqual(execute(4,'const fs=require("fs");let a=fs.readFileSync(0,"utf8").trim().split(/\\s+/).map(Number);console.log(a[0]+a[1]);', '20 22','42')['status']['description'],'Accepted')

if __name__ == '__main__':
    unittest.main()
