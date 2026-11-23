#!/usr/bin/env python3
"""يُشغَّل في GitHub Actions: يجلب تسجيل أذان حقيقي بترخيص حر من ويكيميديا كومنز (ملك عام أو CC0 أولاً،
وإلا CC-BY/CC-BY-SA مع ذكر المصدر) ويكتب assets/adhan.js حتى تشغّله اللعبة. إذا فشل: اللعبة تشتغل بلا أذان."""
import json, os, sys, urllib.request, urllib.parse
out = sys.argv[1]
UA = {'User-Agent': 'RafidainBuild/1.0 (github actions; game asset fetch)'}
def get(u, raw=False):
    r = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=40).read()
    return r if raw else json.loads(r)
api = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode({'action': 'query', 'generator': 'search', 'gsrsearch': 'adhan OR azan call to prayer filetype:audio', 'gsrnamespace': 6, 'gsrlimit': 40, 'prop': 'imageinfo', 'iiprop': 'url|size|mime|extmetadata', 'format': 'json'})
try: pages = list(get(api).get('query', {}).get('pages', {}).values())
except Exception as e: print('search failed', e); sys.exit(0)
def lic(p):
    m = p['imageinfo'][0].get('extmetadata', {}); s = (m.get('LicenseShortName', {}).get('value') or '').lower()
    return 0 if ('public domain' in s or s.startswith('pd') or 'cc0' in s) else 1 if s.startswith('cc by') or s.startswith('cc-by') else 9, m
cands = []
for p in pages:
    if 'imageinfo' not in p: continue
    ii = p['imageinfo'][0]; mime = ii.get('mime', '')
    if mime not in ('audio/ogg', 'application/ogg', 'audio/mpeg', 'audio/webm', 'audio/opus') or ii.get('size', 0) > 9_000_000 or ii.get('size', 0) < 150_000: continue
    t = p['title'].lower()
    if 'shia' in t or 'شيعي' in t: continue
    rank, m = lic(p)
    if rank > 1: continue
    cands.append((rank, -ii['size'], p, ii, m))
cands.sort(key=lambda c: (c[0], c[1]))
for rank, _, p, ii, m in cands:
    try:
        data = get(ii['url'], True); ext = os.path.splitext(urllib.parse.urlparse(ii['url']).path)[1] or '.ogg'
        fn = 'adhan' + ext; open(os.path.join(out, fn), 'wb').write(data)
        strip = lambda s: __import__('re').sub('<[^>]+>', '', s or '').strip()
        info = {'file': fn, 'title': p['title'], 'license': strip(m.get('LicenseShortName', {}).get('value')), 'artist': strip(m.get('Artist', {}).get('value'))[:120], 'src': ii.get('descriptionurl', '')}
        open(os.path.join(out, 'adhan.js'), 'w', encoding='utf-8').write('window.__ADHAN=' + json.dumps(info, ensure_ascii=False) + ';')
        print('adhan', info, len(data)); break
    except Exception as e: print('skip', p.get('title'), e)
else: print('no free adhan found')
