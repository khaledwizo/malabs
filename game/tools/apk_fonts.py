#!/usr/bin/env python3
"""يُشغَّل في GitHub Actions: ينزّل خطوط Google المستخدمة في اللعبة إلى assets/fonts
ويستبدل رابطها في index.html بنسخة محلية، كي تعمل اللعبة بخطوطها دون إنترنت.
إن فشل أي شيء تبقى الصفحة كما هي (تستعمل الرابط الأصلي عند توفر الإنترنت)."""
import re, sys, os, hashlib, urllib.request

assets = sys.argv[1]
page = os.path.join(assets, 'index.html')
html = open(page, encoding='utf-8').read()
m = re.search(r'<link[^>]+href="(https://fonts\.googleapis\.com/css2\?[^"]+)"[^>]*>', html)
if not m:
    print('no google fonts link'); sys.exit(0)
UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36'
def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=30).read()
css = get(m.group(1).replace('&amp;', '&')).decode('utf-8')
os.makedirs(os.path.join(assets, 'fonts'), exist_ok=True)
total = 0
def local(mm):
    global total
    url = mm.group(1)
    name = hashlib.sha1(url.encode()).hexdigest()[:12] + '.woff2'
    path = os.path.join(assets, 'fonts', name)
    if not os.path.exists(path):
        data = get(url); total += len(data)
        open(path, 'wb').write(data)
    return 'url(fonts/' + name + ')'
css = re.sub(r'url\((https://fonts\.gstatic\.com/[^)]+)\)', local, css)
html = html.replace(m.group(0), '<style>\n' + css + '\n</style>')
html = re.sub(r'<link[^>]+href="https://fonts\.(googleapis|gstatic)\.com[^"]*"[^>]*>\s*', '', html)
open(page, 'w', encoding='utf-8').write(html)
print('fonts bundled:', len(os.listdir(os.path.join(assets, 'fonts'))), 'files,', total // 1024, 'KB')
