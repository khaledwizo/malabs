#!/usr/bin/env python3
"""توليد جمل أهل السوق والمقدّمة بأصوات عراقية (Azure Neural: ar-IQ) — يعمل داخل GitHub Actions.

الاستعمال: AZ_KEY=... AZ_REGION=... python3 gen_voices.py <lines.json> <out_dir>
- لا يعيد توليد ملف موجود (التوليد تدريجي بين البنايات).
- يحترم حدّ الطبقة المجانية (طلبات قليلة بالدقيقة) ويعيد المحاولة عند 429.
- يكتب out_dir/manifest.js = { معرّف: مدّة بالثواني } للملفات الموجودة فقط.
"""
import json, os, sys, time, struct, urllib.request, urllib.error
from xml.sax.saxutils import escape

lines = json.load(open(sys.argv[1], encoding='utf-8'))
out = sys.argv[2]
os.makedirs(out, exist_ok=True)
key = os.environ.get('AZ_KEY', '').strip()
region = (os.environ.get('AZ_REGION', '') or 'westeurope').strip()
budget = float(os.environ.get('AZ_BUDGET_MIN', '40')) * 60
url = f'https://{region}.tts.speech.microsoft.com/cognitiveservices/v1'


def ssml(l):
    return ('<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ar-IQ">'
            f'<voice name="{l["voice"]}"><prosody pitch="{l["pitch"]}" rate="{l["rate"]}" volume="{l["volume"]}">'
            f'{escape(l["text"])}</prosody></voice></speak>').encode('utf-8')


def ogg_duration(path):
    """مدّة ملف Ogg Opus: آخر granule ناقص pre-skip ÷ 48000"""
    b = open(path, 'rb').read()
    i = b.find(b'OpusHead')
    pre = struct.unpack_from('<H', b, i + 10)[0] if i >= 0 else 312
    j = b.rfind(b'OggS')
    if j < 0: return 0
    g = struct.unpack_from('<q', b, j + 6)[0]
    return max(0.2, (g - pre) / 48000.0)


def synth(l):
    req = urllib.request.Request(url, data=ssml(l), method='POST', headers={
        'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'ogg-24khz-16bit-mono-opus', 'User-Agent': 'rafidain-voices'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


made = skipped = failed = 0
t0 = time.time()
if not key:
    print('AZ_KEY missing — skipping generation')
else:
    for n, l in enumerate(lines):
        path = os.path.join(out, l['id'] + '.ogg')
        if os.path.exists(path) and os.path.getsize(path) > 200:
            skipped += 1; continue
        if time.time() - t0 > budget:
            print('time budget reached; the rest will be generated in the next build'); break
        for attempt in range(6):
            try:
                data = synth(l)
                if len(data) < 200: raise RuntimeError('empty audio')
                open(path, 'wb').write(data); made += 1
                print(f'[{n + 1}/{len(lines)}] {l["id"]} {l["tag"]} ok ({len(data)} B)')
                break
            except urllib.error.HTTPError as e:
                if e.code in (401, 403):
                    print(f'AUTH ERROR {e.code}: check AZURE_SPEECH_KEY / AZURE_SPEECH_REGION secrets'); sys.exit(0)
                wait = float(e.headers.get('Retry-After', '0') or 0) or (8 * (attempt + 1))
                print(f'HTTP {e.code} on {l["id"]}, retry in {wait:.0f}s'); time.sleep(wait)
            except Exception as e:
                print(f'error on {l["id"]}: {e}; retry'); time.sleep(5 * (attempt + 1))
        else:
            failed += 1
        time.sleep(3.2)  # الطبقة المجانية: ~20 طلب بالدقيقة

ids = {l['id'] for l in lines}
man = {}
for f in sorted(os.listdir(out)):
    if f.endswith('.ogg') and f[:-4] in ids:
        try: man[f[:-4]] = round(ogg_duration(os.path.join(out, f)), 2)
        except Exception: pass
open(os.path.join(out, 'manifest.js'), 'w', encoding='utf-8').write('window.RAFIDAIN_VOICES=' + json.dumps(man, separators=(',', ':')) + ';\n')
print(f'made {made}, kept {skipped}, failed {failed}, manifest {len(man)}/{len(lines)}')
