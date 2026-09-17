from pathlib import Path
from urllib.parse import urljoin, urlparse, unquote
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from collections import deque
import hashlib
import re
import sys

origin, out_dir, manifest_path, marker, min_bytes = sys.argv[1:]
min_bytes = int(min_bytes)
origin = origin.rstrip('/')
origin_host = urlparse(origin).netloc
out = Path(out_dir)
manifest = Path(manifest_path)
queue = deque([origin + '/'])
seen = set()
saved = []
missing = []
ua = 'Mozilla/5.0 G1ftB0x-Migration'


def local_path(url):
    p = urlparse(url).path
    if p == '/':
        return out / 'index.html'
    return out / unquote(p.lstrip('/'))


def enqueue(ref, base):
    if not ref or ref.startswith(('data:', 'mailto:', 'javascript:', '#')) or re.search(r'\s', ref):
        return
    # Compiled bundles sometimes contain source-code fragments that look like
    # asset paths to a regex but are not real URLs. Do not mirror those.
    if any(token in ref for token in ('`', '${', "'+", '"+')) or ref.endswith(('\\', '`')):
        return
    absolute = urljoin(base, ref)
    parsed = urlparse(absolute)
    if parsed.netloc != origin_host:
        return
    path = parsed.path
    if any(token in path for token in ('`', '${', '\\')):
        return
    if path == '/' or path == '/favicon.svg' or path.startswith('/assets/'):
        clean = origin + path
        if clean not in seen:
            queue.append(clean)


while queue:
    url = queue.popleft()
    if url in seen:
        continue
    seen.add(url)
    req = Request(url, headers={'User-Agent': ua, 'Accept': '*/*'})
    try:
        with urlopen(req, timeout=45) as response:
            data = response.read()
            ctype = response.headers.get('Content-Type', '')
    except HTTPError as exc:
        if exc.code == 404:
            missing.append(urlparse(url).path)
            print(f'Optional asset missing upstream (404): {urlparse(url).path}')
            continue
        raise

    path = local_path(url)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    saved.append((str(path.relative_to(out)), len(data), hashlib.sha256(data).hexdigest(), ctype))

    if any(x in ctype for x in ('text/', 'javascript', 'json', 'svg')) or path.suffix in {'.html', '.js', '.css', '.svg'}:
        text = data.decode('utf-8', errors='ignore')
        refs = set()
        refs.update(re.findall(r'''(?:href|src)=["']([^"']+)["']''', text))
        refs.update(re.findall(r'''url\((?:["']?)([^)"']+)(?:["']?)\)''', text))
        refs.update(re.findall(r'''(?:import\s*\(|from\s+)["']([^"']+)["']''', text))
        refs.update(re.findall(r'''["'](/assets/[^"']+)["']''', text))
        for ref in refs:
            enqueue(ref, url)

rows = [f'{size}\t{sha}\t{name}' for name, size, sha, _ in saved]
rows += [f'MISSING\t-\t{path}' for path in missing]
manifest.write_text('\n'.join(rows) + '\n')

total = sum(size for _, size, _, _ in saved)
print(f'Mirrored {len(saved)} same-origin files, {total} bytes; {len(missing)} optional 404s')
for name, size, sha, _ in saved:
    print(f'{size:>9} {sha[:12]} {name}')

if not (out / 'index.html').exists():
    raise SystemExit('No root index.html mirrored')
if total < min_bytes:
    raise SystemExit(f'Mirrored build unexpectedly small: {total} < {min_bytes}')

searchable = []
for name, _, _, ctype in saved:
    path = out / name
    if any(x in ctype for x in ('text/', 'javascript', 'json', 'svg')) or path.suffix in {'.html', '.js', '.css', '.svg'}:
        searchable.append(path.read_text(errors='ignore'))
combined = '\n'.join(searchable)
if marker.lower() not in combined.lower():
    raise SystemExit(f'Expected app marker not found: {marker}')
print(f'Verified marker: {marker}')
