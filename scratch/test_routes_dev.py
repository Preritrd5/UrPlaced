import urllib.request
import re

routes = ['/dashboard/billing', '/preritrd/dashboard', '/preritrd/login']

for r in routes:
    try:
        url = 'http://localhost:3000' + r
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as res:
            print(f'{r} -> Status {res.status}, Length {len(res.read())}')
    except Exception as e:
        print(f'{r} -> Error: {e}')
