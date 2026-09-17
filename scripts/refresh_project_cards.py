from pathlib import Path

path = Path("labs.html")
text = path.read_text()

if 'href="/deadlink/"' in text and 'href="/countysignal/"' in text:
    raise SystemExit(0)

marker = '        <article class="lab-card" data-tags="creative kindness social community">'
if marker not in text:
    raise SystemExit("Insertion marker not found")

cards = '''        <article class="lab-card" data-tags="creative history internet retro bbs chat culture museum">
          <div class="lab-preview lab-preview--interface"><div class="preview-fallback"></div><div class="preview-ui"><strong>DEADLINK // OLD NET ONLINE</strong><div class="mini-line"></div><div class="mini-line short"></div></div></div>
          <div class="lab-card-top"><span class="lab-icon">56K</span><span class="lab-status status-live">Original live</span></div>
          <div class="lab-card-content"><h2>DeadLink</h2><p>A playable museum of dial-up culture, BBSes, IRC-style chat, old web aesthetics, forgotten software and the social internet before everything became an app.</p><div class="lab-tags"><span>Old Web</span><span>BBS</span><span>Internet History</span></div><a class="lab-action" href="/deadlink/">Enter DeadLink →</a></div>
          <a class="lab-card-link" href="/deadlink/" aria-label="Open DeadLink">Open DeadLink</a>
        </article>

        <article class="lab-card" data-tags="tools public interest rural counties civic alerts sources illinois">
          <div class="lab-preview lab-preview--intel"><div class="preview-fallback"></div><div class="preview-ui"><strong>COUNTYSIGNAL // SOURCE WATCH</strong><div>&gt; counties: WESTERN IL</div><div>&gt; provenance: REQUIRED</div><div>&gt; status: BUILDING</div><div class="mini-line"></div></div></div>
          <div class="lab-card-top"><span class="lab-icon">CS</span><span class="lab-status status-building">Building</span></div>
          <div class="lab-card-content"><h2>CountySignal</h2><p>A source-backed rural public-interest monitor for important local notices, infrastructure changes, alerts and updates that are often difficult to find.</p><div class="lab-tags"><span>Western Illinois</span><span>Public Data</span><span>Sources</span></div><a class="lab-action" href="/countysignal/">View CountySignal →</a></div>
          <a class="lab-card-link" href="/countysignal/" aria-label="Open CountySignal">Open CountySignal</a>
        </article>

'''

path.write_text(text.replace(marker, cards + marker))
