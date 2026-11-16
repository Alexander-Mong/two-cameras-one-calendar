# Written with AI coding assistants (Anthropic Claude), directed and reviewed by the team, Spark Squad. See AI_USE.md.
"""Stored sharp pictures from open Sentinel-2 L2A (Copernicus, on AWS open data, no login).


For each place: search the Earth Search catalog for 2020 passes (fire places: from just before their first hot day
to 45 days after the last; steady places: all of 2020), clearest first by the catalog's cloud number; read only the
small window around the place from the cloud-optimized files; keep up to three dates whose window is not cut off
(no-data) and not mostly cloud. For each kept date save:
  <id>_<n>_close.webp  10 m true color (the 'visual' asset), 3 km across, 300 px
  <id>_<n>_heat.webp   short-wave infrared heat picture, 3 km across: red = B12 (2.2 um), green = B11 (1.6 um),
                       blue = B8A (0.86 um), the wiki's recipe (pages 13 and 38): a flare, furnace or live fire glows
                       red to yellow; fresh burns look dark red-brown; plants look green; bare ground tan.
Credit: "Contains modified Copernicus Sentinel data 2020".
usage (from round_SAT/volunteer): python -I tools/build_sentinel.py [--only P05,P35] [--force]
Writes data/sentinel.json and site/img/places/. Polite: one place at a time, a pause between places,
stops at the first refusal from the catalog or the file host.
"""
import os, sys, json, time, math, datetime, urllib.request, io
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '_pylib'))
os.environ.update({'GDAL_DISABLE_READDIR_ON_OPEN': 'EMPTY_DIR', 'CPL_VSIL_CURL_ALLOWED_EXTENSIONS': '.tif',
                   'GDAL_HTTP_MULTIRANGE': 'YES', 'GDAL_HTTP_MERGE_CONSECUTIVE_RANGES': 'YES', 'AWS_NO_SIGN_REQUEST': 'YES',
                   'GDAL_HTTP_MAX_RETRY': '2', 'GDAL_HTTP_RETRY_DELAY': '2',
                   'GDAL_INGESTED_BYTES_AT_OPEN': '65536', 'GDAL_HTTP_VERSION': '2', 'VSI_CACHE': 'TRUE'})
import numpy as np
import rasterio
from rasterio.warp import transform
from rasterio.windows import from_bounds
from rasterio.enums import Resampling
from PIL import Image

VOL = os.path.dirname(HERE)
OUTIMG = os.path.join(VOL, 'site', 'img', 'places')
OUTJ = os.path.join(VOL, 'data', 'sentinel.json')
STAC = 'https://earth-search.aws.element84.com/v1/search'
HALF = 1500      # meters: 3 km across
PX = 300
PAUSE = 0.6


class Refused(Exception):
    pass


def search(p):
    if p['kind_rule'] == 'fire':
        a = datetime.date.fromisoformat(p['first_day']) - datetime.timedelta(days=3)
        b = min(datetime.date.fromisoformat(p['last_day']) + datetime.timedelta(days=45), datetime.date(2021, 1, 31))
    else:
        a, b = datetime.date(2020, 1, 1), datetime.date(2020, 12, 31)
    body = {'collections': ['sentinel-2-l2a'], 'intersects': {'type': 'Point', 'coordinates': [p['lon'], p['lat']]},
            'datetime': f'{a}T00:00:00Z/{b}T23:59:59Z', 'query': {'eo:cloud_cover': {'lt': 40}}, 'limit': 100,
            'sortby': [{'field': 'properties.eo:cloud_cover', 'direction': 'asc'}]}
    rq = urllib.request.Request(STAC, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json', 'User-Agent': 'spaceapps-family-volunteer/0.1'})
    try:
        with urllib.request.urlopen(rq, timeout=60) as r:
            j = json.load(r)
    except urllib.error.HTTPError as e:
        raise Refused(f'catalog answered {e.code}')
    items = j.get('features', [])
    items.sort(key=lambda it: (it['properties'].get('eo:cloud_cover', 100), it['properties']['datetime']))
    return items, len(items)


def read(href, lon, lat, out=PX):
    with rasterio.open(href) as ds:
        (x,), (y,) = transform('EPSG:4326', ds.crs, [lon], [lat])
        w = from_bounds(x - HALF, y - HALF, x + HALF, y + HALF, ds.transform)
        return ds.read(window=w, out_shape=(ds.count, out, out), boundless=True, fill_value=0, resampling=Resampling.bilinear)


def heat_rgb(b12, b11, b8a):
    def sc(v):
        r = np.clip(v.astype(np.float32) / 10000.0 / 0.55, 0, 1)
        return (np.power(r, 1 / 1.4) * 255).astype(np.uint8)
    return np.dstack([sc(b12), sc(b11), sc(b8a)])


def glow_score(b12):
    """B12 reflectance at the center 600 m against the median of the whole 3 km view (a hot source reads high)."""
    v = b12.astype(np.float32) / 10000.0
    c = v[PX // 2 - 30:PX // 2 + 30, PX // 2 - 30:PX // 2 + 30]
    return round(float(np.percentile(c, 99.5) / max(np.median(v), 0.01)), 2)


def do_place(p, kept_dir):
    items, n = search(p)
    kept, tried = [], 0
    dates = set()
    for it in items:
        d = it['properties']['datetime'][:10]
        if d in dates:
            continue
        if tried >= 9 or len(kept) >= 3:
            break
        tried += 1
        a = it['assets']
        try:
            vis = read(a['visual']['href'], p['lon'], p['lat'])
        except Exception as e:
            if '403' in str(e) or '429' in str(e):
                raise Refused(f'file host refused: {e}')
            continue
        rgb = np.transpose(vis[:3], (1, 2, 0))
        nod = float((rgb.sum(2) == 0).mean())
        cloud = float((rgb.min(2) > 200).mean())
        if nod > 0.05 or cloud > 0.25:
            continue
        try:
            b12 = read(a['swir22']['href'], p['lon'], p['lat'])[0]
            b11 = read(a['swir16']['href'], p['lon'], p['lat'])[0]
            b8a = read(a['nir08']['href'], p['lon'], p['lat'])[0]
        except Exception as e:
            if '403' in str(e) or '429' in str(e):
                raise Refused(f'file host refused: {e}')
            continue
        k = len(kept) + 1
        fc, fh = f"{p['id']}_{k}_close.webp", f"{p['id']}_{k}_heat.webp"
        Image.fromarray(rgb).save(os.path.join(kept_dir, fc), 'WEBP', quality=78)
        Image.fromarray(heat_rgb(b12, b11, b8a)).save(os.path.join(kept_dir, fh), 'WEBP', quality=78)
        dates.add(d)
        kept.append({'date': d, 'item': it['id'], 'scene_cloud': round(it['properties'].get('eo:cloud_cover', -1), 1),
                     'window_cloud': round(cloud, 2), 'close': fc, 'heat': fh, 'glow': glow_score(b12),
                     'credit': 'Contains modified Copernicus Sentinel data 2020'})
    return {'found_in_catalog': n, 'tried': tried, 'kept': sorted(kept, key=lambda r: r['date'])}


def main():
    args = sys.argv[1:]
    only = set(args[args.index('--only') + 1].split(',')) if '--only' in args else None
    force = '--force' in args
    os.makedirs(OUTIMG, exist_ok=True)
    places = json.load(open(os.path.join(VOL, 'data', 'places.json'), encoding='utf-8'))['places']
    res = json.load(open(OUTJ)) if os.path.exists(OUTJ) else {}
    todo = [p for p in places if (not only or p['id'] in only) and (force or p['id'] not in res)]
    from concurrent.futures import ThreadPoolExecutor
    stop = []

    def one(p):          # five places at a time, a pause after each
        if stop:
            return
        t = time.time()
        try:
            r = do_place(p, OUTIMG)
        except Refused as e:
            stop.append(f"{p['id']}: {e}"); print('STOP:', p['id'], e, flush=True); return
        r['seconds'] = round(time.time() - t, 1)
        res[p['id']] = r
        json.dump(res, open(OUTJ, 'w'), indent=1)
        print(p['id'], p['nasa_answer'], 'catalog', r['found_in_catalog'], 'tried', r['tried'], 'kept', [k['date'] + ' g' + str(k['glow']) for k in r['kept']], r['seconds'], 's', flush=True)
        time.sleep(PAUSE)
    with ThreadPoolExecutor(5) as ex:
        list(ex.map(one, todo))
    tot = sum(os.path.getsize(os.path.join(OUTIMG, f)) for f in os.listdir(OUTIMG))
    print('stored pictures', len(os.listdir(OUTIMG)), 'files', round(tot / 1e6, 2), 'MB')


if __name__ == '__main__':
    main()
