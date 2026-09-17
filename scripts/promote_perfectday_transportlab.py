from pathlib import Path

# Homepage: canonical project paths should be the public launch addresses.
index = Path('index.html')
text = index.read_text()
text = text.replace('href="projects/perfectday-atlas.html" class="project-card pulse"', 'href="/perfectday/" class="project-card pulse"')
text = text.replace('href="projects/transportlab.html" class="project-card pulse"', 'href="/transportlab/" class="project-card pulse"')
text = text.replace('<p><strong>Next:</strong> route them as <code>/signalsafe</code> and <code>/skydex</code> under G1ftB0x.</p>', '<p><strong>PerfectDay Atlas</strong> — full published build migrated to Cloudflare.</p><p><strong>TransportLab</strong> — canonical path ready; full source migration waiting on Site access.</p>')
index.write_text(text)

labs = Path('labs.html')
text = labs.read_text()

# PerfectDay: full Cloudflare migration is verified.
text = text.replace('iframe src="projects/perfectday-atlas.html"', 'iframe src="/perfectday/"')
text = text.replace('<span class="lab-icon">P°</span><span class="lab-status status-external">Full GPT Site</span>', '<span class="lab-icon">P°</span><span class="lab-status status-live">Cloudflare live</span>')
text = text.replace('<a class="lab-action" href="https://perfectday-atlas.g1ft.chatgpt.site" target="_blank" rel="noopener">Launch full site ↗</a>', '<a class="lab-action" href="/perfectday/">Launch PerfectDay →</a>')
text = text.replace('<a class="lab-card-link" href="projects/perfectday-atlas.html" aria-label="View PerfectDay Atlas project page">View PerfectDay Atlas</a>', '<a class="lab-card-link" href="/perfectday/" aria-label="Open PerfectDay Atlas">Open PerfectDay Atlas</a>')

# TransportLab: canonical gateway is ready, but the locked Site remains the full app source.
text = text.replace('iframe src="projects/transportlab.html"', 'iframe src="/transportlab/"')
text = text.replace('<span class="lab-icon">#</span><span class="lab-status status-external">Full GPT Site</span>', '<span class="lab-icon">#</span><span class="lab-status status-external">Original live</span>')
text = text.replace('<a class="lab-action" href="https://transportlab.g1ft.chatgpt.site" target="_blank" rel="noopener">Launch full site ↗</a>', '<a class="lab-action" href="/transportlab/">Open TransportLab →</a>')
text = text.replace('<a class="lab-card-link" href="projects/transportlab.html" aria-label="View TransportLab project page">View TransportLab</a>', '<a class="lab-card-link" href="/transportlab/" aria-label="Open TransportLab">Open TransportLab</a>')

labs.write_text(text)
