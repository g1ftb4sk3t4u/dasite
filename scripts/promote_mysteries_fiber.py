from pathlib import Path

path = Path('labs.html')
text = path.read_text()

old_mysteries = '''        <article class="lab-card" data-tags="learning science networking biology space disasters invisible ai">
          <div class="lab-preview lab-preview--mysteries"><div class="preview-fallback"></div><div class="preview-ui"><strong>MYSTERIES OF KNOWLEDGE</strong><div class="mini-line"></div><div class="mini-line short"></div><div class="mini-grid"><div class="mini-cell"></div><div class="mini-cell"></div><div class="mini-cell"></div></div></div></div>
          <div class="lab-card-top"><span class="lab-icon">⌬</span><span class="lab-status status-building">Site link pending</span></div>
          <div class="lab-card-content"><h2>Mysteries of Knowledge</h2><p>An interactive science museum covering hidden everyday systems: packets, GPS, storms, black holes, biology, radio, fiber and more.</p><div class="lab-tags"><span>30 exhibits</span><span>Simulations</span><span>Sources</span></div><span class="lab-action muted-action">Cataloged — full site link next</span></div>
        </article>'''

new_mysteries = '''        <article class="lab-card" data-tags="learning science networking biology space disasters invisible ai">
          <div class="lab-preview lab-preview--mysteries"><div class="preview-fallback"></div><div class="preview-ui"><strong>MYSTERIES OF KNOWLEDGE</strong><div class="mini-line"></div><div class="mini-line short"></div><div class="mini-grid"><div class="mini-cell"></div><div class="mini-cell"></div><div class="mini-cell"></div></div></div></div>
          <div class="lab-card-top"><span class="lab-icon">⌬</span><span class="lab-status status-live">Cloudflare live</span></div>
          <div class="lab-card-content"><h2>Mysteries of Knowledge</h2><p>An interactive science museum covering hidden everyday systems: packets, GPS, storms, black holes, biology, radio, fiber and more.</p><div class="lab-tags"><span>30 exhibits</span><span>Simulations</span><span>Sources</span></div><a class="lab-action" href="/mysteries/">Explore Mysteries →</a></div>
          <a class="lab-card-link" href="/mysteries/" aria-label="Open Mysteries of Knowledge">Open Mysteries of Knowledge</a>
        </article>'''

old_fiber = '''        <article class="lab-card" data-tags="networking learning fiber otdr optics engineering">
          <div class="lab-preview lab-preview--fiber"><div class="preview-fallback"></div><div class="preview-ui"><strong>FIBER FIELD LAB</strong><div class="mini-line"></div><div class="mini-line short"></div></div></div>
          <div class="lab-card-top"><span class="lab-icon">↝</span><span class="lab-status status-building">Site link pending</span></div>
          <div class="lab-card-content"><h2>Fiber Field Lab</h2><p>Hands-on fiber training with link budgets, OTDR traces, splices, reflections, SFP DOM diagnosis and field-engineering scenarios.</p><div class="lab-tags"><span>Fiber</span><span>OTDR</span><span>Optics</span></div><span class="lab-action muted-action">Cataloged — full site link next</span></div>
        </article>'''

new_fiber = '''        <article class="lab-card" data-tags="networking learning fiber otdr optics engineering">
          <div class="lab-preview lab-preview--fiber"><div class="preview-fallback"></div><div class="preview-ui"><strong>FIBER FIELD LAB</strong><div class="mini-line"></div><div class="mini-line short"></div></div></div>
          <div class="lab-card-top"><span class="lab-icon">↝</span><span class="lab-status status-live">Cloudflare live</span></div>
          <div class="lab-card-content"><h2>Fiber Field Lab</h2><p>Hands-on fiber training with link budgets, OTDR traces, splices, reflections, SFP DOM diagnosis and field-engineering scenarios.</p><div class="lab-tags"><span>Fiber</span><span>OTDR</span><span>Optics</span></div><a class="lab-action" href="/fiberlab/">Launch Fiber Field Lab →</a></div>
          <a class="lab-card-link" href="/fiberlab/" aria-label="Open Fiber Field Lab">Open Fiber Field Lab</a>
        </article>'''

if old_mysteries in text:
    text = text.replace(old_mysteries, new_mysteries)
if old_fiber in text:
    text = text.replace(old_fiber, new_fiber)

if 'href="/mysteries/"' not in text or 'href="/fiberlab/"' not in text:
    raise SystemExit('Expected promoted project links were not written')

path.write_text(text)
