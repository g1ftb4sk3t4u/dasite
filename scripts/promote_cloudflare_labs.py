from pathlib import Path

replacements = {
    "index.html": [
        ('href="labs/rabbit-hole/"', 'href="/rabbit-hole/"'),
        ('href="labs/worthwise/"', 'href="/worthwise/"'),
    ],
    "labs.html": [
        ('iframe src="labs/rabbit-hole/"', 'iframe src="/rabbit-hole/"'),
        ('href="labs/rabbit-hole/"', 'href="/rabbit-hole/"'),
        ('iframe src="labs/worthwise/"', 'iframe src="/worthwise/"'),
        ('href="labs/worthwise/"', 'href="/worthwise/"'),
        ('<span class="lab-status status-building">Flagship</span>', '<span class="lab-status status-live">Cloudflare live</span>'),
        ('<span class="lab-status status-live">GitHub preview</span>', '<span class="lab-status status-live">Cloudflare live</span>'),
    ],
}

for filename, changes in replacements.items():
    path = Path(filename)
    text = path.read_text()
    original = text
    for old, new in changes:
        text = text.replace(old, new)
    if text != original:
        path.write_text(text)
