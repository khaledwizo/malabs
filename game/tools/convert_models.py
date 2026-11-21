# تحويل نماذج glTF مرخّصة (CC0 / CC-BY) إلى صيغة مضغوطة مدمجة في اللعبة
# الاستعمال: python3 tools/convert_models.py <glTF-Sample-Assets/Models> src/gfx/modeldata.js
import json, os, sys, struct, base64, io, math
from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
# name: (folder, target height in m or None, texture size)
SPEC = {
  'lantern': ('Lantern', 3.9, 256),
  'fish': ('BarramundiFish', 0.2, 128),
}
CT = {5120: 'b', 5121: 'B', 5122: 'h', 5123: 'H', 5125: 'I', 5126: 'f'}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

def mat4_mul(a, b):
    return [sum(a[r + 4 * k] * b[k + 4 * c] for k in range(4)) for c in range(4) for r in range(4)]
def trs(n):
    if 'matrix' in n: return n['matrix']
    t = n.get('translation', [0, 0, 0]); r = n.get('rotation', [0, 0, 0, 1]); s = n.get('scale', [1, 1, 1])
    x, y, z, w = r
    m = [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
         2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
         2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0,
         t[0], t[1], t[2], 1]
    for c in range(3):
        for rr in range(3): m[c * 4 + rr] *= s[c]
    return m

def tex_uri(path, size, kind):
    im = Image.open(path)
    if kind == 'orm': im = im.convert('RGB')
    elif kind == 'color' and im.mode == 'RGBA':
        a = im.getchannel('A')
        if a.getextrema()[0] < 250:
            im = im.resize((size, size), Image.LANCZOS); b = io.BytesIO(); im.save(b, 'PNG', optimize=True); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
        im = im.convert('RGB')
    else: im = im.convert('RGB')
    im = im.resize((size, size), Image.LANCZOS); b = io.BytesIO(); im.save(b, 'JPEG', quality=82, optimize=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()

out = {}
for name, (folder, height, tsize) in SPEC.items():
    d = os.path.join(SRC, folder, 'glTF'); gl = [f for f in os.listdir(d) if f.endswith('.gltf')][0]
    J = json.load(open(os.path.join(d, gl))); bins = [open(os.path.join(d, b['uri']), 'rb').read() for b in J['buffers']]
    def acc(i):
        a = J['accessors'][i]; v = J['bufferViews'][a['bufferView']]; buf = bins[v['buffer']]
        n, c = a['count'], NC[a['type']]; fmt = CT[a['componentType']]; sz = struct.calcsize(fmt)
        stride = v.get('byteStride') or sz * c; off = v.get('byteOffset', 0) + a.get('byteOffset', 0)
        res = [struct.unpack_from('<' + fmt * c, buf, off + k * stride) for k in range(n)]
        if a.get('normalized') and fmt in 'BbHh':
            mx = {'B': 255, 'b': 127, 'H': 65535, 'h': 32767}[fmt]; res = [tuple(max(-1, x / mx) for x in t) for t in res]
        return res
    parts = {}
    def visit(ni, M):
        n = J['nodes'][ni]; M2 = mat4_mul(M, trs(n))
        if 'mesh' in n:
            for pr in J['meshes'][n['mesh']]['primitives']:
                at = pr['attributes']; P = acc(at['POSITION']); N = acc(at['NORMAL']) if 'NORMAL' in at else [(0, 1, 0)] * len(P)
                U = acc(at['TEXCOORD_0']) if 'TEXCOORD_0' in at else [(0, 0)] * len(P)
                I = [t[0] for t in acc(pr['indices'])] if 'indices' in pr else list(range(len(P)))
                L = parts.setdefault(pr.get('material', -1), {'p': [], 'n': [], 'u': [], 'i': []}); base = len(L['p'])
                for (x, y, z) in P: L['p'].append((M2[0] * x + M2[4] * y + M2[8] * z + M2[12], M2[1] * x + M2[5] * y + M2[9] * z + M2[13], M2[2] * x + M2[6] * y + M2[10] * z + M2[14]))
                for (x, y, z) in N:
                    a, b, c = M2[0] * x + M2[4] * y + M2[8] * z, M2[1] * x + M2[5] * y + M2[9] * z, M2[2] * x + M2[6] * y + M2[10] * z; l = math.sqrt(a * a + b * b + c * c) or 1
                    L['n'].append((a / l, b / l, c / l))
                L['u'] += [tuple(u[:2]) for u in U]; L['i'] += [base + k for k in I]
        for c in n.get('children', []): visit(c, M2)
    ident = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    for r in J['scenes'][J.get('scene', 0)]['nodes']: visit(r, ident)
    allp = [p for L in parts.values() for p in L['p']]
    mn = [min(p[k] for p in allp) for k in range(3)]; mx = [max(p[k] for p in allp) for k in range(3)]
    s = height / (mx[1] - mn[1])
    # المركز: قاعدة الجسم (أدنى 8% من الارتفاع) كي يقف العمود على نقطة الوضع
    low = [p for p in allp if p[1] < mn[1] + (mx[1] - mn[1]) * 0.08] or allp
    cx, cz = (min(p[0] for p in low) + max(p[0] for p in low)) / 2, (min(p[2] for p in low) + max(p[2] for p in low)) / 2
    print(name, 'extent after centering x', round((mn[0] - cx) * s, 3), round((mx[0] - cx) * s, 3), 'z', round((mn[2] - cz) * s, 3), round((mx[2] - cz) * s, 3), file=sys.stderr)
    res = []
    for mi, L in parts.items():
        P = [((x - cx) * s, (y - mn[1]) * s, (z - cz) * s) for (x, y, z) in L['p']]
        lo = [min(p[k] for p in P) for k in range(3)]; hi = [max(p[k] for p in P) for k in range(3)]
        q = lambda v, k: int(round((v - lo[k]) / max(1e-6, hi[k] - lo[k]) * 65535)) - 32768
        pb = b''.join(struct.pack('<hhh', q(x, 0), q(y, 1), q(z, 2)) for (x, y, z) in P)
        nb = b''.join(struct.pack('<bbb', *[max(-127, min(127, int(round(c * 127)))) for c in n]) for n in L['n'])
        ulo = [min(u[k] for u in L['u']) for k in range(2)]; uhi = [max(u[k] for u in L['u']) for k in range(2)]
        uq = lambda v, k: int(round((v - ulo[k]) / max(1e-6, uhi[k] - ulo[k]) * 65535)) - 32768
        ub = b''.join(struct.pack('<hh', uq(u[0], 0), uq(u[1], 1)) for u in L['u'])
        ib = struct.pack('<' + 'H' * len(L['i']), *L['i']) if len(L['p']) < 65536 else struct.pack('<' + 'I' * len(L['i']), *L['i'])
        m = J['materials'][mi] if mi >= 0 else {}; pbr = m.get('pbrMetallicRoughness', {}); img = lambda t: os.path.join(d, J['images'][J['textures'][t['index']]['source']]['uri'])
        mat = {'color': pbr.get('baseColorFactor', [1, 1, 1, 1]), 'rough': pbr.get('roughnessFactor', 1), 'metal': pbr.get('metallicFactor', 1), 'emissive': m.get('emissiveFactor', [0, 0, 0]), 'alpha': m.get('alphaMode', 'OPAQUE'), 'double': m.get('doubleSided', False)}
        if 'baseColorTexture' in pbr: mat['map'] = tex_uri(img(pbr['baseColorTexture']), tsize, 'color')
        if 'metallicRoughnessTexture' in pbr: mat['orm'] = tex_uri(img(pbr['metallicRoughnessTexture']), tsize // 2, 'orm')
        if 'normalTexture' in m: mat['normalMap'] = tex_uri(img(m['normalTexture']), tsize, 'normal')
        if 'emissiveTexture' in m: mat['emissiveMap'] = tex_uri(img(m['emissiveTexture']), tsize // 2, 'color')
        res.append({'lo': [round(v, 5) for v in lo], 'hi': [round(v, 5) for v in hi], 'ulo': ulo, 'uhi': uhi, 'p': base64.b64encode(pb).decode(), 'n': base64.b64encode(nb).decode(), 'u': base64.b64encode(ub).decode(), 'i': base64.b64encode(ib).decode(), 'i32': len(L['p']) >= 65536, 'mat': mat})
        print(name, 'part', mi, 'verts', len(P), 'tris', len(L['i']) // 3, file=sys.stderr)
    out[name] = res
js = '// نماذج مرخّصة مضغوطة (مولّد آلياً بـ tools/convert_models.py — لا تعدّل يدوياً)\n// Lantern (Microsoft) و BarramundiFish: CC0 1.0 — من مستودع Khronos glTF-Sample-Assets\nexport const MODEL_DATA = ' + json.dumps(out, separators=(',', ':')) + ';\n'
open(OUT, 'w').write(js)
print('bytes', len(js), file=sys.stderr)
