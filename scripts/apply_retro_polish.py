from pathlib import Path
import os

root = Path('.')
targets = [
    Path('index.html'), Path('labs.html'), Path('blog.html'),
    Path('about.html'), Path('resources.html'), Path('contact.html'),
    Path('deadlink/index.html'), Path('countysignal/index.html'),
]
targets += list(Path('posts').glob('**/*.html'))

for path in targets:
    if not path.exists():
        continue
    text = path.read_text()
    if 'retro-polish.css' in text:
        continue

    rel = Path(os.path.relpath(root / 'retro-polish.css', path.parent)).as_posix()
    tag = f'  <link href="{rel}" rel="stylesheet">\n'

    preferred = ['home-personal.css', 'labs-gallery.css']
    inserted = False
    for name in preferred:
        marker_end = None
        for line in text.splitlines(keepends=True):
            if name in line and 'stylesheet' in line:
                marker_end = line
                break
        if marker_end:
            text = text.replace(marker_end, marker_end + tag, 1)
            inserted = True
            break

    if not inserted:
        style_line = None
        for line in text.splitlines(keepends=True):
            if 'style.css' in line and 'stylesheet' in line:
                style_line = line
                break
        if style_line:
            text = text.replace(style_line, style_line + tag, 1)
            inserted = True

    if inserted:
        path.write_text(text)
        print(f'linked {path} -> {rel}')
