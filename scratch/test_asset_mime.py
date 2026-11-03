import urllib.request
import re

try:
    req = urllib.request.Request('http://localhost:3000/', headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=15) as res:
        html = res.read().decode('utf-8')
        print('Home status:', res.status)
        css_matches = re.findall(r'href=[\'"](/_next/static/css/[^\'"]+)[\'"]', html)
        print('CSS links found:', css_matches)
        js_matches = re.findall(r'src=[\'"](/_next/static/chunks/[^\'"]+)[\'"]', html)
        print('JS links found (first 3):', js_matches[:3])

        if css_matches:
            css_url = 'http://localhost:3000' + css_matches[0]
            with urllib.request.urlopen(css_url, timeout=5) as css_res:
                print('CSS fetch status:', css_res.status)
                print('CSS Content-Type:', css_res.headers.get('Content-Type'))
                print('CSS length:', len(css_res.read()))

        if js_matches:
            js_url = 'http://localhost:3000' + js_matches[0]
            with urllib.request.urlopen(js_url, timeout=5) as js_res:
                print('JS fetch status:', js_res.status)
                print('JS Content-Type:', js_res.headers.get('Content-Type'))
                print('JS length:', len(js_res.read()))
except Exception as e:
    print('Error:', e)
