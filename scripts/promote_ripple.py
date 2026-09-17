from pathlib import Path

path = Path('labs.html')
text = path.read_text()
old = '''        <article class="lab-card" data-tags="creative kindness social community">
          <div class="lab-preview lab-preview--ripple"><div class="preview-fallback"></div><div class="preview-ui"><strong>RIPPLE</strong><div class="mini-line"></div><div class="mini-line short"></div><div class="mini-grid"><div class="mini-cell"></div><div class="mini-cell"></div><div class="mini-cell"></div></div></div></div>
          <div class="lab-card-top"><span class="lab-icon">◎</span><span class="lab-status status-concept">Project</span></div>
          <div class="lab-card-content"><h2>Ripple</h2><p>A kindness engine built around small achievable actions, appreciation notes, pass-it-forward chains and low-pressure community goals.</p><div class="lab-tags"><span>Kindness</span><span>Community</span><span>Local-first</span></div><span class="lab-action muted-action">Project page/link coming</span></div>
        </article>'''
new = '''        <article class="lab-card" data-tags="creative kindness social community">
          <div class="lab-preview lab-preview--ripple"><div class="preview-fallback"></div><div class="preview-ui"><strong>RIPPLE</strong><div class="mini-line"></div><div class="mini-line short"></div><div class="mini-grid"><div class="mini-cell"></div><div class="mini-cell"></div><div class="mini-cell"></div></div></div></div>
          <div class="lab-card-top"><span class="lab-icon">◎</span><span class="lab-status status-live">Cloudflare live</span></div>
          <div class="lab-card-content"><h2>Ripple</h2><p>A kindness engine built around small achievable actions, appreciation notes, pass-it-forward chains and low-pressure community goals.</p><div class="lab-tags"><span>Kindness</span><span>Community</span><span>Local-first</span></div><a class="lab-action" href="/ripple/">Open Ripple →</a></div>
          <a class="lab-card-link" href="/ripple/" aria-label="Open Ripple">Open Ripple</a>
        </article>'''
if old in text:
    text = text.replace(old, new)
if 'href="/ripple/"' not in text:
    raise SystemExit('Ripple card was not promoted')
path.write_text(text)
