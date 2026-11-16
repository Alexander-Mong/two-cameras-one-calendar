# Written with AI coding assistants (Anthropic Claude), directed and reviewed by the team, Spark Squad. See AI_USE.md.
"""Build round_SAT/volunteer/data/places.json from the 2020 world hot-spot cut.



Source: work/app_hot_spot_search/data/World2020/2020-MM.bin + .idx (NASA FIRMS archive rows,
re-cut; 28-byte records; see that folder's NOTES_FOR_CARDS.md). Every row carries NASA's type label
(0 presumed vegetation fire, 1 active volcano, 2 other static land source, 3 offshore).

Pass 1: every row goes into a 0.02 degree square (about 2 km). Per square and camera family
(MODIS = Terra+Aqua, VIIRS = S-NPP+NOAA-20) and month: detections, night detections, label counts,
days. Cached in tools/_cache/pass1.npz (delete it to recompute).
Pass 2: pick places (rules below, written before looking at which places come out), then re-read
their rows for exact numbers, including the median fire power.

Rules:
  steady  = VIIRS hot in >= 10 of 12 months AND >= 60% of all its detections labeled 1, 2 or 3.
            Kind = the most common non-zero label. Want about 14 type 2, 5 type 1, 6 type 3.
  fire    = >= 98% labeled 0, >= 25 VIIRS detections, all VIIRS detections inside <= 3 consecutive
            months (a burst inside one season), and no not-fire-labeled detection within 5 squares
            (about 10 km), not 75%+ at night, and not hot on 45+ VIIRS days mostly at night (added after the first lists:
            three desert squares with those shapes looked like new steady sources NASA's label still calls
            fire, so they would make a doubtful answer key). 8 of the 25 have the farm-burning shape (<= 20% at night, VIIRS hot on 8+ days).
  Spread: the world is cut into eight regions; inside each kind, places are taken round-robin over
  regions, strongest first (most detections), and never two within 1 degree of each other.
Usage: python -I tools/build_places.py   (from round_SAT/volunteer)
"""
import json, os, sys, zlib, datetime
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
VOL = os.path.dirname(HERE)
SRC = os.path.normpath(os.path.join(VOL, '..', '..', 'work', 'app_hot_spot_search', 'data', 'World2020'))
CACHE = os.path.join(HERE, '_cache')
OUT = os.path.join(VOL, 'data', 'places.json')
DATES = os.path.join(VOL, 'data', 'picture_dates.json')   # optional: per-place best picture date from the probe

REC = np.dtype([('lon', '<i4'), ('lat', '<i4'), ('date', '<u2'), ('minute', '<u2'), ('frp', '<u4'), ('b1', '<u2'), ('b2', '<u2'),
                ('scan', '<u2'), ('track', '<u2'), ('conf', 'u1'), ('sat', 'u1'), ('flags', 'u1'), ('ver', 'u1')])
EPOCH = datetime.date(2000, 1, 1)
G = 0.02
NX = int(360 / G)


def month_rows(m):
    idx = np.fromfile(os.path.join(SRC, f'2020-{m:02d}.idx'), dtype='<u4').reshape(-1, 4)
    raw = open(os.path.join(SRC, f'2020-{m:02d}.bin'), 'rb').read()
    parts = [zlib.decompress(raw[o:o + n], 31) for _, o, n, _ in idx]
    return np.frombuffer(b''.join(parts), dtype=REC)


def cell_key(r):
    iy = np.floor(r['lat'] / 1e5 / G).astype(np.int64) + int(90 / G)
    ix = np.floor(r['lon'] / 1e5 / G).astype(np.int64) + int(180 / G)
    return iy * NX + ix


def key_center(k):
    iy, ix = divmod(int(k), NX)
    return (iy - int(90 / G) + 0.5) * G, (ix - int(180 / G) + 0.5) * G


def pass1():
    os.makedirs(CACHE, exist_ok=True)
    f = os.path.join(CACHE, 'pass1.npz')
    if os.path.exists(f):
        return dict(np.load(f))
    tabs = []
    for m in range(1, 13):
        r = month_rows(m)
        k = cell_key(r)
        fam = (r['sat'] >= 2).astype(np.int64)
        typ = ((r['flags'] >> 1) & 7).astype(np.int64)
        night = ((r['flags'] & 1) == 0).astype(np.int64)
        kk = k * 2 + fam
        u, inv = np.unique(kk, return_inverse=True)
        n = np.bincount(inv)
        nn = np.bincount(inv, weights=night)
        tc = [np.bincount(inv, weights=(typ == t)) for t in range(4)]
        ud = np.unique(kk * 10000 + r['date'].astype(np.int64))
        days = np.bincount(np.searchsorted(u, ud // 10000), minlength=len(u))
        tabs.append(np.stack([u, np.full(len(u), m), n, nn, *tc, days], 1).astype(np.int64))
        print('month', m, len(r), 'rows', len(u), 'square-cameras', flush=True)
    t = np.concatenate(tabs)
    np.savez_compressed(f, t=t)
    return {'t': t}


REGIONS = [  # (name, test) on the square's center; names are continents for spreading only, never shown
    ('N America', lambda la, lo: la > 12 and lo < -30),
    ('S America', lambda la, lo: la <= 12 and lo < -30),
    ('Europe', lambda la, lo: la > 35 and -30 <= lo < 45),
    ('Africa', lambda la, lo: la <= 35 and -30 <= lo < 45 and not (la > 12 and lo > 34)),
    ('Middle East and C Asia', lambda la, lo: 12 < la <= 50 and 34 <= lo < 75),
    ('N Asia', lambda la, lo: la > 50 and lo >= 45),
    ('S and E Asia', lambda la, lo: la <= 50 and lo >= 75 and not (la < -10)),
    ('Oceania', lambda la, lo: la < -10 and lo >= 75),
]


def region(la, lo):
    for i, (_, f) in enumerate(REGIONS):
        if f(la, lo):
            return i
    return 4


def summarize(t):
    allk, inv = np.unique(t[:, 0] // 2, return_inverse=True)
    tot = np.bincount(inv, weights=t[:, 2])
    keep = tot[inv] >= 25                      # squares with fewer than 25 detections in the year can't qualify
    t = t[keep]
    keys, inv = np.unique(t[:, 0] // 2, return_inverse=True)
    S = np.zeros((len(keys), 2, 12, 7), dtype=np.int32)  # fam, month, [n, night, t0..t3, days]
    S[inv, t[:, 0] % 2, t[:, 1] - 1] = t[:, 2:9]
    print('squares with 25+ detections:', len(keys))
    return keys, S


def pick(keys, S):
    tot = S[:, :, :, 0].sum((1, 2))
    lab = S[:, :, :, 2:6].sum((1, 2))  # t0..t3 over both families
    vmon = (S[:, 1, :, 0] > 0).sum(1)
    vn = S[:, 1, :, 0].sum(1)
    notfire = lab[:, 1:].sum(1)
    share_nf = notfire / np.maximum(tot, 1)
    steady = np.where((vmon >= 10) & (share_nf >= 0.6))[0]
    vmask = S[:, 1, :, 0] > 0
    # burst: VIIRS months form one run of <= 3 consecutive months
    first = np.argmax(vmask, 1)
    last = 11 - np.argmax(vmask[:, ::-1], 1)
    fire = np.where((lab[:, 0] >= 0.98 * tot) & (vn >= 25) & (vmon >= 1) & (last - first <= 2))[0]
    print('candidates: steady', len(steady), 'fire', len(fire))
    want_steady = {2: 14, 1: 5, 3: 6}
    chosen = []
    fireset = set()
    night = S[:, :, :, 1].sum((1, 2)) / np.maximum(tot, 1)
    dayn = S[:, 1, :, 6].sum(1)

    nf = set(int(k) for k in keys[notfire > 0])

    def near_steady(i):   # any not-fire-labeled detection within 5 squares (about 10 km)
        iy, ix = divmod(int(keys[i]), NX)
        return any((iy + a) * NX + ix + b in nf for a in range(-5, 6) for b in range(-5, 6))

    def far(i):
        if i in fireset and (near_steady(i) or night[i] >= 0.75 or (dayn[i] >= 45 and night[i] >= 0.6)):
            return False
        la, lo = key_center(keys[i])
        for j in chosen:
            lb, lp = key_center(keys[j])
            if abs(la - lb) < 1 and abs(lo - lp) < 1:
                return False
        return True

    def roundrobin(cands, n):
        byreg = {}
        for i in sorted(cands, key=lambda i: -tot[i]):
            la, lo = key_center(keys[i])
            byreg.setdefault(region(la, lo), []).append(i)
        got = []
        while len(got) < n and any(byreg.values()):
            for r in sorted(byreg):
                L = byreg[r]
                while L:
                    i = L.pop(0)
                    if far(i):
                        got.append(i); chosen.append(i); break
                if len(got) >= n:
                    break
        return got

    out = []
    for kind, n in want_steady.items():
        c = [i for i in steady if int(np.argmax(lab[i, 1:])) + 1 == kind]
        out += [(i, 'steady') for i in roundrobin(c, n)]
    fireset = set(int(i) for i in fire)
    daytime = [i for i in fire if night[i] <= 0.2 and dayn[i] >= 8]   # many short daytime burns: the farm-burning shape
    out += [(i, 'fire') for i in roundrobin(daytime, 8)]
    out += [(i, 'fire') for i in roundrobin([i for i in fire if i not in chosen], 17)]
    return out


def exact(keys, S, sel):
    want = {int(keys[i]): j for j, (i, _) in enumerate(sel)}
    rows = {k: [] for k in want}
    for m in range(1, 13):
        r = month_rows(m)
        k = cell_key(r)
        hit = np.isin(k, np.fromiter(want, dtype=np.int64))
        for kk in np.unique(k[hit]):
            rows[int(kk)].append(r[hit][k[hit] == kk])
    res = []
    for kk, j in sorted(want.items(), key=lambda a: a[1]):
        r = np.concatenate(rows[kk])
        fam = (r['sat'] >= 2)
        month = np.array([(EPOCH + datetime.timedelta(days=int(d))).month for d in r['date']])
        typ = (r['flags'] >> 1) & 7
        night = (r['flags'] & 1) == 0
        frp = r['frp'] / 100.0
        la = float(np.mean(r['lat'][fam] if fam.any() else r['lat'])) / 1e5
        lo = float(np.mean(r['lon'][fam] if fam.any() else r['lon'])) / 1e5
        modis = [int(((~fam) & (month == mm)).sum()) for mm in range(1, 13)]
        viirs = [int((fam & (month == mm)).sum()) for mm in range(1, 13)]
        days = sorted(set(int(d) for d in r['date']))
        # brightness temperature of the hot channel (MODIS 4 um 'brightness', VIIRS I4 'bright_ti4'), kelvin
        b1 = r['b1'] / 100.0
        temp = {}
        for fname, fm in (('modis', ~fam), ('viirs', fam)):
            for tname, tm in (('day', ~night), ('night', night)):
                v = b1[fm & tm]
                v = v[v > 0]
                temp[f'{fname}_{tname}'] = {'n': int(len(v)), 'median_k': round(float(np.median(v)), 1) if len(v) else None,
                                            'p10_k': round(float(np.percentile(v, 10)), 1) if len(v) else None,
                                            'p90_k': round(float(np.percentile(v, 90)), 1) if len(v) else None}
        res.append({
            'temp': temp,
            'lat': round(la, 2), 'lon': round(lo, 2),
            'months_modis': modis, 'months_viirs': viirs,
            'months_night': [int((night & (month == mm)).sum()) for mm in range(1, 13)],
            'detections': int(len(r)),
            'days': len(days),
            'night_share': round(float(night.mean()), 2),
            'frp_median_mw': round(float(np.median(frp)), 1),
            'frp_max_mw': round(float(frp.max()), 1),
            'nasa_label': {'vegetation_fire': int((typ == 0).sum()), 'volcano': int((typ == 1).sum()),
                           'other_static_land': int((typ == 2).sum()), 'offshore': int((typ == 3).sum())},
            'first_day': (EPOCH + datetime.timedelta(days=days[0])).isoformat(),
            'last_day': (EPOCH + datetime.timedelta(days=days[-1])).isoformat(),
            'busiest_day': (EPOCH + datetime.timedelta(days=int(np.bincount(r['date'] - days[0]).argmax() + days[0]))).isoformat(),
        })
    return res


def answer_of(p):
    lab = p['nasa_label']
    top = max(lab, key=lab.get)
    return {'vegetation_fire': 'fire', 'volcano': 'volcano', 'other_static_land': 'industry', 'offshore': 'offshore'}[top]


PRACTICE = ['P05', 'P35', 'P17']   # set after the probe: one steady source, one fire, one volcano


def picture_dates(p):
    """Dates the page tries in turn for the daytime pictures (30 m color has gaps and cloud)."""
    if p['kind_rule'] == 'fire':
        b = datetime.date.fromisoformat(p['busiest_day'])
        ds = [b + datetime.timedelta(days=k) for k in (20, 35, 50, 5)]
        return [min(d, datetime.date(2020, 12, 28)).isoformat() for d in ds]
    return ['2020-07-15', '2020-01-20', '2020-04-15', '2020-10-15'] if p['lat'] > 30 else ['2020-01-20', '2020-07-15', '2020-10-15', '2020-04-15']


def main():
    t = pass1()['t']
    keys, S = summarize(t)
    sel = pick(keys, S)
    ex = exact(keys, S, sel)
    dates = json.load(open(DATES)) if os.path.exists(DATES) else {}
    sj = os.path.join(VOL, 'data', 'sentinel.json')
    sentinel = json.load(open(sj)) if os.path.exists(sj) else {}
    fj = os.path.join(VOL, 'data', 'first_view.json')
    first_view = {k: v for k, v in json.load(open(fj)).items() if not k.startswith('_')} if os.path.exists(fj) else {}
    places = []
    for n, ((i, rule), p) in enumerate(zip(sel, ex)):
        p = {'id': f'P{n + 1:02d}', 'kind_rule': rule, **p}
        p['nasa_answer'] = answer_of(p)
        p['picture_dates'] = picture_dates(p)
        if p['id'] in dates:              # what a live check found first (tools/check_pictures.cjs)
            p['picture_found'] = dates[p['id']]
        p['practice'] = p['id'] in PRACTICE
        if p['id'] in sentinel and sentinel[p['id']]['kept']:   # stored 10 m and heat pictures (tools/build_sentinel.py)
            p['sharp'] = [{'date': k['date'], 'close': k['close'], 'heat': k['heat'], 'scene_cloud': k['scene_cloud']} for k in sentinel[p['id']]['kept']]
        if p['id'] in first_view:                               # which picture a visitor sees first (set by looking)
            p['first_view'] = first_view[p['id']]
        places.append(p)
    meta = {
        'about': ' Placed by coordinates only: no place names.',
        'source': 'NASA FIRMS archive hot spots, calendar year 2020 (MODIS C6.1 and VIIRS 375 m), every row with NASA\'s type label',
        'square': '0.02 degree square (about 2 km); lat/lon = mean position of its VIIRS detections, rounded to 0.01',
        'counts': 'satellite detections, not fires',
        'nasa_answer': 'the label most of the place\'s 2020 detections carry: fire (0), volcano (1), industry (2: other static land source), offshore (3)',
        'built': datetime.datetime.now().isoformat(timespec='minutes'),
        'rules': __doc__.split('Rules:')[1].split('Usage:')[0].strip(),
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump({'meta': meta, 'places': places}, open(OUT, 'w', encoding='utf-8'), indent=1)
    site = os.path.join(VOL, 'site', 'data', 'places.json')    # the page reads its own copy
    os.makedirs(os.path.dirname(site), exist_ok=True)
    json.dump({'meta': meta, 'places': places}, open(site, 'w', encoding='utf-8'), separators=(',', ':'))
    from collections import Counter
    print('wrote', OUT, len(places), Counter(p['nasa_answer'] for p in places))


if __name__ == '__main__':
    main()
