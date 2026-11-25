'use strict';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const byId = id => $(id).value;
const get = (key,fallback)=>{try{return JSON.parse(localStorage.getItem('pw.'+key))??fallback;}catch{return fallback;}};
const save = (key,value)=>{try{localStorage.setItem('pw.'+key,JSON.stringify(value));}catch{}};
const units = unit => String(unit ?? '').replace(/m3\b/g,'m³');
const amount = number => number==null ? '—' : Number(number.toFixed(2)).toString();
const isNum = x => typeof x==='number' && Number.isFinite(x);
const ctTime = new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
const clockFormat = tz => new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',second:'2-digit'});
const ctClock=clockFormat('America/Chicago'), utcClock=clockFormat('UTC');
const tick=()=>{const t=new Date();$('ct').textContent=ctClock.format(t);$('utc').textContent=utcClock.format(t);};
const dateText = value => !value ? '—' : /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : Number.isFinite(Date.parse(value)) ? ctTime.format(new Date(value)) : '—';
const coord = x=>x.slice(1);
const rad = deg=>deg*Math.PI/180;
const direction = value=>value==null?'—':['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'][Math.round(((value%360)+360)%360/22.5)%16];
function distance(a,b) {
  const x=Math.sin(rad(b[0]-a[0])/2)**2+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(rad(b[1]-a[1])/2)**2;
  return 3958.76*2*Math.asin(Math.sqrt(Math.min(x,1)));
}
function bearing(a,b) {
  const d=rad(b[1]-a[1]),a1=rad(a[0]),b1=rad(b[0]);
  return (360+Math.atan2(Math.sin(d)*Math.cos(b1),Math.cos(a1)*Math.sin(b1)-Math.sin(a1)*Math.cos(b1)*Math.cos(d))*180/Math.PI)%360;
}
const watch = [...PW.cities,...get('custom',[])];
let locationName=get('location','Macon, MO');
if(!watch.some(x=>x[0]===locationName)) locationName='Macon, MO';
const selected=()=>watch.find(a=>a[0]===locationName);
function weatherWatch() {
  const point=coord(selected());
  return PW.cities.reduce((closest,city)=>distance(point,coord(city))<distance(point,coord(closest))?city:closest);
}
const watchKey=()=>coord(weatherWatch()).map(x=>x.toFixed(4)).join(',');
const weatherPlace=()=>weatherWatch()[0];
const moduleNames={map:'Map',watch:'Community',updates:'Updates',diagnostics:'Source health'};
const layout=get('layout',Object.keys(moduleNames).map(id=>({id})));
const statusData={epa:null,army:null,aircraft:null,weather:null};
let archive=[], map, base, mapLayers={}, baseStyle=get('style','dark'), mapPrefs=get('layers',{incident:true,cities:true,stations:true});
let countiesPromise, active, weatherFor, loadingWeather;

const link = (name,url)=>'<a target="_blank" rel="noopener noreferrer" href="'+esc(url)+'">'+esc(name)+'</a>';
const cards = rows=>rows.map(([name,,desc,url])=>'<a class="source-card" target="_blank" rel="noopener noreferrer" href="'+esc(url)+'">'+esc(name)+'<small>'+esc(desc)+'</small></a>').join('');
const category = name=>PW.sources.filter(s=>s[1]===name);
const badge=(label,tone='')=>'<span class="badge '+tone+'">'+esc(label)+'</span>';
const note=text=>'<p class="muted">'+esc(text)+'</p>';
const termList=rows=>'<dl class="kv">'+rows.map(([label,value])=>'<dt>'+esc(label)+'</dt><dd>'+esc(value)+'</dd>').join('')+'</dl>';
const staleness = (t,minutes)=>t && Date.now()-Date.parse(t)>minutes*60000;
function sourceStatus(value,limit=20) {
  if(!value) return ['Awaiting refresh','amber'];
  if(value.error) return [value.succeeded?'Cached / stale':'Unavailable','amber'];
  if(!value.succeeded) return ['Unavailable','amber'];
  if(staleness(value.succeeded,limit)) return ['Stale','amber'];
  return ['Retrieved',''];
}
function localStorageWrite() {
  save('custom',watch.slice(PW.cities.length));
  save('location',locationName);
}
function fillSelects() {
  const options=watch.map(x=>'<option>'+esc(x[0])+'</option>').join('');
  for(const id of ['location','community-select']){$(id).innerHTML=options;$(id).value=locationName;}
  $('remove-watch').hidden=PW.cities.some(x=>x[0]===locationName);
}
function setLocation(name, pan=false, redraw=true) {
  if(!watch.some(x=>x[0]===name)) return;
  locationName=name;
  localStorageWrite();
  fillSelects();
  statusData.weather=weatherFor===watchKey()?statusData.weather:null;
  renderLocal();
  if(redraw)drawMapOverlays();
  if(pan && map) map.panTo(coord(selected()));
  refreshWeather();
}
function layoutView() {
  for(const item of layout) {
    const node=document.querySelector('[data-module="'+item.id+'"]');
    if(!node)continue;
    $('dashboard').append(node);
    node.hidden=!!item.hidden;
    node.classList.toggle('wide',!!item.wide);
    node.classList.toggle('collapsed',!!item.collapsed);
  }
  $('layout-controls').innerHTML=layout.map((item,index)=>'<div class="layout-row"><span>'+moduleNames[item.id]+'</span>'+
    [['previous','Earlier',index===0],['next','Later',index===layout.length-1],['wide',item.wide?'Normal width':'Full width'],['collapsed',item.collapsed?'Expand':'Minimize'],['hidden',item.hidden?'Show':'Hide']].map(([action,label,disabled])=>'<button data-action="'+action+'" data-module-id="'+item.id+'" '+(disabled?'disabled':'')+'>'+label+'</button>').join('')+'</div>').join('');
  setTimeout(()=>map?.invalidateSize(),80);
}
function route() {
  const requested=location.hash.slice(1);
  active=document.querySelector('.page[id="'+(requested.match(/^[a-z]+$/)?.[0]??'command')+'"]')?.id || 'command';
  document.querySelectorAll('.page').forEach(p=>p.hidden=p.id!==active);
  document.querySelectorAll('nav a').forEach(a=>{if(a.hash==='#'+active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  window.scrollTo(0,0);
  if(active==='command') {initMap();setTimeout(()=>map?.invalidateSize(),80);}
  if(active==='archive') renderReport();
  if(active==='visuals'&&!statusData.aircraft) refreshSource('aircraft');
}

function formats() {
  const rows=statusData.epa?.data?.samples??[];
  return [...rows].sort((a,b)=>Date.parse(b.at??0)-Date.parse(a.at??0));
}
function joinedStations() {
  const markers=new Map();
  for(const s of statusData.epa?.data?.stations??[]) if(s.key)markers.set(s.key,{...s});
  for(const a of formats()) {
    const key=a.stationKey || a.station;
    if(!markers.has(key))markers.set(key,{id:a.station,key,lat:a.lat,lon:a.lon,instruments:'Xact'});
    const s=markers.get(key);
    if(!s.latest)s.latest=a;
    if(s.lat==null){s.lat=a.lat;s.lon=a.lon;}
  }
  return [...markers.values()].map(s=>({...s,miles:isNum(s.lat)&&isNum(s.lon)?distance(PW.incident,[s.lat,s.lon]):null}));
}
function sampleText(a) {
  if(!a || a.value==null)return '—';
  return String(a.value)+(a.unit?' '+units(a.unit):' (unit unavailable)');
}
function sampleState(a) {
  if(!a)return 'No sample published';
  if(a.value==null)return 'Missing result';
  if(a.value===0)return 'Zero reported';
  if(a.value>0)return 'Positive reported value';
  return 'Negative reported value';
}
function renderLead() {
  const data=statusData.epa;
  const stations=joinedStations();
  const rows=formats();
  const latest=rows.find(x=>x.at);
  const positive=rows.find(x=>x.value>0);
  const currentRows=stations.filter(s=>s.latest?.at&&!staleness(s.latest.at,90));
  $('m-sample').textContent=latest?sampleText(latest):data?'Unavailable':'Loading';
  $('m-sample-note').textContent=latest?latest.station+' · '+dateText(latest.at)+(staleness(latest.at,90)?' · Stale':'')+(positive?' · Positive values in history':''):'Xact monitor layer';
  $('m-stations').textContent=data?.data?currentRows.length+' / '+stations.length:'—';
  $('m-stations-note').textContent=data?.data?'Sample in last 90 minutes / listed':'EPA station layer';
  $('lead-status').textContent=data?.data?rows.length+' Xact samples · '+stations.length+' stations · '+sourceStatus(data)[0]+(data.data.partial?' · Partial upstream result':''):(data?.error||'Awaiting EPA response');
  const search=byId('station-search').toLowerCase();
  const order=byId('station-sort');
  const compare={latest:(a,b)=>(b.latest?.at??'').localeCompare(a.latest?.at??''),highest:(a,b)=>(b.latest?.value??-Infinity)-(a.latest?.value??-Infinity),name:(a,b)=>a.id.localeCompare(b.id),near:(a,b)=>(a.miles??Infinity)-(b.miles??Infinity)};
  const shown=stations.filter(s=>(s.id+' '+(s.instruments??'')).toLowerCase().includes(search)).sort(compare[order]);
  $('station-table').innerHTML=shown.map(s=>'<tr><td><button data-trend="'+esc(s.key)+'">'+esc(s.id)+'</button></td><td>'+esc(dateText(s.latest?.at))+'</td><td>'+esc(sampleText(s.latest))+'</td><td>'+esc(sampleState(s.latest))+(staleness(s.latest?.at,90)?' · Stale':'')+'</td><td>'+(s.miles==null?'—':s.miles.toFixed(1)+' mi')+'</td><td>'+esc(s.instruments??'—')+'</td></tr>').join('')||'<tr><td colspan="6">No matching stations.</td></tr>';
  const previous=byId('trend-station');
  const trendStations=[...new Map(rows.map(x=>[x.stationKey || x.station,x.station])).entries()].sort();
  $('trend-station').innerHTML=trendStations.map(([id,name])=>'<option value="'+esc(id)+'">'+esc(name)+'</option>').join('');
  if(trendStations.some(([id])=>id===previous))$('trend-station').value=previous;
  renderTrend();
}
function chart(rows,label) {
  if(!rows.some(x=>isNum(x.value)))return note('No numeric readings for this series.');
  const max=Math.max(0,...rows.map(r=>r.value??0));
  const min=Math.min(0,...rows.map(r=>r.value??0));
  const bars=rows.map(r=>{
    const hint=dateText(r.at)+' · '+(r.value==null?'Missing':amount(r.value)+' '+label)+(r.forecast?' · forecast':'');
    const height=isNum(r.value)?Math.max(2,(r.value-min)/(max-min||1)*100):0;
    return '<i class="'+(r.forecast?'forecast ':'')+(r.value==null?'gap':'')+'" style="height:'+height.toFixed(2)+'%" title="'+esc(hint)+'"></i>';
  }).join('');
  return '<div class="chart" role="img" aria-label="'+esc(label+' history, range '+amount(min)+' to '+amount(max))+'">'+bars+'</div>'+
    '<p class="muted">'+esc(dateText(rows[0].at))+' to '+esc(dateText(rows.at(-1).at))+' · '+amount(min)+' to '+amount(max)+' '+esc(label)+'</p>';
}
function renderTrend() {
  const rows=formats().filter(x=>(x.stationKey||x.station)===byId('trend-station')).reverse();
  const unitSet=new Set(rows.filter(r=>r.value!==null).map(r=>r.unit));
  $('lead-trend').innerHTML=(unitSet.size<=1?chart(rows,units(rows.find(x=>x.unit)?.unit)||'unit unavailable'):note('Multiple reported units. Review values in the table.'))+
    (rows.length?'<details><summary>Show sample timestamps and values</summary><ul class="stack">'+rows.slice().reverse().map(r=>'<li>'+esc(dateText(r.at))+' · '+esc(sampleText(r))+' <small>'+esc(sampleState(r)+' · '+r.quality)+'</small></li>').join('')+'</ul></details>':'');
}
const selectedStationList=()=>joinedStations().filter(s=>s.miles!=null).map(s=>({...s,localMiles:distance(coord(selected()),[s.lat,s.lon])})).sort((a,b)=>a.localMiles-b.localMiles);
function nearby(list,count){
  return list.length?'<ul class="stack">'+list.slice(0,count).map(s=>'<li><strong>'+esc(s.id)+' · '+s.localMiles.toFixed(1)+' mi</strong><small>'+esc(sampleText(s.latest)+' · '+sampleState(s.latest)+' · '+dateText(s.latest?.at)+(staleness(s.latest?.at,90)?' · Stale':''))+'</small></li>').join('')+'</ul>':note('EPA station data awaiting retrieval.');
}
function weatherLine(r) {
  if(!r)return 'Awaiting NWS';
  if(r.mph==null)return 'Wind unavailable';
  if(r.mph===0)return 'Calm';
  return direction(r.windFrom)+' '+amount(r.mph)+' mph';
}
function renderLocal() {
  const point=coord(selected());
  const miles=distance(PW.incident,point).toFixed(1);
  const relative=miles==='0.0'?'At reference':direction(bearing(PW.incident,point))+' of Middletown';
  const info=statusData.weather?.data;
  const watchSource=weatherPlace()===locationName?'':' · Weather point: '+weatherPlace();
  const wx=info?.history?.[0];
  const weatherAge=wx&&staleness(wx.at,90)?' · Stale observation':'';
  const rows=[['Reference distance',miles+' mi'],['Location bearing',relative],['Observed wind from',weatherLine(wx)],['Temperature',wx?.temp!=null?amount(wx.temp)+' °F':'—'],['NWS station',(wx?.station||'—')+watchSource],['Observed at',dateText(wx?.at)+(weatherAge||'')]];
  $('watch-title').textContent=locationName;
  $('community-title').textContent=locationName;
  $('weather-title').textContent=locationName+' · NWS observations and hourly forecast'+watchSource;
  $('m-wind').textContent=wx?weatherLine(wx):'—';
  $('m-weather-note').textContent=wx?wx.station+' · '+dateText(wx.at)+(weatherAge||''):locationName+' · NWS station observation';
  const stations=selectedStationList();
  $('watch-brief').innerHTML=termList(rows)+ '<h3>Closest EPA stations</h3>'+nearby(stations,3);
  $('community-body').innerHTML=termList(rows)+note('Distances and bearings use a Middletown reference point. Observed wind describes conditions at the station.') ;
  $('community-stations').innerHTML=nearby(stations,7);
  const state=locationName.slice(-2);
  const first=state==='MO'?'Missouri DNR':state==='IL'?'Illinois EPA':'Iowa HHS';
  const best=PW.sources.find(s=>s[0]===first);
  $('community-advice').innerHTML=note('Open official guidance and the latest available Army model products. Nearby readings apply to the listed monitors and sample times.')+'<div class="cards">'+cards([best,...PW.sources.filter(s=>['Army notifications','Army dispersion advisory','EPA response'].includes(s[0]))])+'</div>';
  $('weather-now').innerHTML=wx?termList([...rows,['Conditions',wx.summary||'—'],['Relative humidity',wx.humidity!=null?amount(wx.humidity)+'%':'—'],['Gust',wx.gust!=null?amount(wx.gust)+' mph':'—'],['Last-hour precipitation',wx.precip!=null?amount(wx.precip)+' mm':'—']]):note(statusData.weather?.error||'Loading NWS observations…');
  $('wx-alerts').innerHTML=info?.alerts?info.alerts.length?'<ul class="stack">'+info.alerts.map(a=>'<li><strong>'+esc(a.event)+'</strong><small>'+esc(a.headline)+' · '+esc(dateText(a.at))+'</small></li>').join('')+'</ul>':note('NWS returned no active weather alerts for this point.') : note('Weather alert feed awaiting retrieval.');
  const history=(info?.history??[]).slice().reverse().map(r=>({...r,value:r.mph}));
  const forecast=(info?.forecast??[]).map(r=>({at:r.startTime,value:/^\d+(?:\.\d+)? mph$/.test(r.windSpeed)?Number.parseFloat(r.windSpeed):null,forecast:true}));
  $('wx-chart').innerHTML=chart([...history,...forecast],'mph')+(history.length?note('Observed winds in cyan. Hourly forecasts in blue. Forecast wind ranges are listed below.'): '');
  $('wx-forecast').innerHTML=info?.forecast?.length?'<table><thead><tr><th>Forecast hour</th><th>Wind from</th><th>Speed</th><th>Temperature</th><th>Precipitation probability</th></tr></thead><tbody>'+info.forecast.map(p=>'<tr><td>'+esc(dateText(p.startTime))+'</td><td>'+esc(p.windDirection)+'</td><td>'+esc(p.windSpeed)+'</td><td>'+esc(p.temperature+' °'+p.temperatureUnit)+'</td><td>'+esc(p.probabilityOfPrecipitation?.value==null?'—':p.probabilityOfPrecipitation.value+'%')+'</td></tr>').join('')+'</tbody></table>':'';
  if(active==='archive')renderReport();
}
const canonical = value => {try{const u=new URL(value);return u.hostname+u.pathname.replace(/\/$/,'').replace(/(\/article\/\d+)\/.*$/,'$1');}catch{return value;}};
function allUpdates() {
  return [...new Map([...(statusData.army?.data??[]),...PW.updates].map(x=>[canonical(x.url),x])).values()].sort((a,b)=>b.date.localeCompare(a.date));
}
function renderUpdates() {
  const all=allUpdates();
  const filter=byId('news-kind');
  const kinds=[...new Set(all.map(x=>x.kind))].sort();
  $('news-kind').innerHTML='<option value="">All categories</option><option value="@official">Official only</option><option value="@media">Media only</option>'+kinds.map(k=>'<option>'+esc(k)+'</option>').join('');
  $('news-kind').value=filter&&([...kinds,'@official','@media'].includes(filter))?filter:'';
  const filterWord=byId('news-search').toLowerCase();
  const selectedKind=byId('news-kind');
  const shown=all.filter(x=>(!selectedKind||x.kind===selectedKind||selectedKind==='@official'&&x.official||selectedKind==='@media'&&!x.official) && [x.title,x.source,x.summary,x.area,x.kind].join(' ').toLowerCase().includes(filterWord));
  $('feed-status').textContent='Army index · '+sourceStatus(statusData.army)[0];
  $('feed').innerHTML=shown.map(x=>'<article class="news">'+badge(x.kind,x.kind==='Advisory'?'amber':'')+' <span class="meta">'+esc(x.source+' · '+dateText(x.date)+' · '+x.area+' · '+(x.official?'Official':'Media'))+'</span><h3>'+link(x.title,x.url)+'</h3>'+(x.summary?'<p>'+esc(x.summary)+'</p>':'')+(x.event?'<small>Scheduled event: '+esc(dateText(x.event))+'</small>':'')+'</article>').join('')||note('No updates match your filters.');
  $('brief-updates').innerHTML='<ul class="stack">'+all.filter(x=>x.official).slice(0,4).map(x=>'<li><strong>'+link(x.title,x.url)+'</strong><small>'+esc(x.source+' · '+dateText(x.date))+'</small></li>').join('')+'</ul>';
  const statusNotice=all.find(x=>x.source==='U.S. Army'&&/all.clear|(?:detonations?|operation).{0,30}(?:complete|occurred|conducted)|(?:complete|conducted).{0,30}detonations?/i.test(x.title)&&x.date.slice(0,10)>='2026-11-25');
  if(statusNotice){
    $('status-badge').textContent='Army notice';
    $('incident-status').innerHTML='<strong>'+link(statusNotice.title,statusNotice.url)+'</strong> · '+esc(dateText(statusNotice.date));
  }
}
function activeAircraft() {
  const search=byId('flight-search').toLowerCase(), min=byId('min-alt');
  return (statusData.aircraft?.data?.aircraft??[]).filter(a=>[a.id,a.flight,a.category,a.type].join(' ').toLowerCase().includes(search) && (min===''||isNum(a.alt)&&a.alt>=Number(min)));
}
function renderAircraft() {
  const state=statusData.aircraft,data=state?.data;
  const stale=staleness(data?.at,8)||!!state?.error;
  $('air-status').textContent=(state?.error||sourceStatus(state,8)[0])+(data?.at?' · Positions '+dateText(data.at):'')+(stale&&data?' · Stale positions':'');
  $('m-air').textContent=data?data.aircraft.length.toString():state?'Unavailable':'—';
  $('m-air-note').textContent=data?(stale?'Stale · ':'')+dateText(data.at):'Open public aviation sources';
  $('flight-table').innerHTML=activeAircraft().map(a=>'<tr><td>'+esc(a.flight||a.id)+'</td><td>'+esc([a.category,a.type].filter(Boolean).join(' / ')||'—')+'</td><td>'+esc(isNum(a.alt)?a.alt.toLocaleString()+' ft':a.alt??'—')+'</td><td>'+esc(a.heading==null?'—':amount(a.heading)+'°')+'</td><td>'+esc(a.knots==null?'—':amount(a.knots)+' kt')+'</td><td>'+a.lat.toFixed(3)+', '+a.lon.toFixed(3)+'</td></tr>').join('')||'<tr><td colspan="6">'+(data?'No positions match.':'Aircraft feed unavailable or awaiting retrieval. Use a public viewer below.')+'</td></tr>';
}
function renderDiagnostics() {
  const labels={epa:'EPA ArcGIS',weather:'NWS · '+locationName,army:'Army incident index',aircraft:'adsb.lol'};
  $('health').innerHTML=Object.entries(labels).map(([key,label])=>{
    const r=statusData[key],s=sourceStatus(r,key==='aircraft'?8:20);
    return '<div class="health-row"><div>'+esc(label)+'<small>'+esc(r?.succeeded?'Last success '+dateText(r.succeeded):r?.error||'Awaiting retrieval')+'</small></div>'+badge(...s)+'</div>';
  }).join('');
  const filter=byId('source-search').toLowerCase();
  $('source-table').innerHTML=PW.sources.filter(x=>x.join(' ').toLowerCase().includes(filter)).map(([name,cat,method,url,key])=>{
    const r=statusData[key], s=key?sourceStatus(r,key==='aircraft'?8:20):['External link',''];
    return '<tr><td>'+link(name,url)+'</td><td>'+esc(cat)+'</td><td>'+esc(method)+'</td><td>'+badge(...s)+(r?.error?'<br><small>'+esc(r.error)+'</small>':'')+(r?.persistence?'<br><small>Archive: '+esc(r.persistence)+'</small>':'')+'</td><td>'+esc(dateText(r?.attempted))+'</td><td>'+esc(dateText(r?.succeeded))+'</td></tr>';
  }).join('')||'<tr><td colspan="6">No matching sources.</td></tr>';
}
function renderReport() {
  const latest=selectedStationList();
  const wx=statusData.weather?.data?.history?.[0];
  $('report-body').innerHTML='<h3>'+esc(locationName)+' · Iowa Army Ammunition Plant</h3>'+
    note('Generated '+dateText(new Date().toISOString())+' · Watch profile and retrieved data')+
    '<h3>Measured EPA lead samples</h3>'+nearby(latest,5)+
    '<h3>Observed weather</h3>'+termList([['Station',wx?.station||'—'],['Wind from',weatherLine(wx)],['Observed at',dateText(wx?.at)]])+
    '<h3>Modeled dispersion and uncertainty</h3>'+note('The Army advisory includes modeled air dispersion for the planned operation. The model is a separate product from measurements. Xact data do not include validation flags or detection limits in the public layer.')+
    '<h3>Official guidance and source records</h3><ul class="stack"><li>'+link('EPA monitoring viewer',PW.epa)+'</li><li>'+link('Army public notifications',PW.army)+'</li><li>'+link('Army dispersion advisory',PW.pdf)+'</li><li>'+link('Missouri DNR incident page','https://dnr.mo.gov/iowa-lead-azide-detonation')+'</li><li>'+link('Illinois EPA incident page','https://epa.illinois.gov/iowa-plant-updates.html')+'</li></ul>';
}
function drawMapOverlays() {
  if(!map)return;
  for(const name of ['cities','stations','wind','aircraft'])mapLayers[name].clearLayers();
  for(const w of watch) {
    const chosen=w[0]===locationName;
    const marker=L.circleMarker(coord(w),{radius:chosen?7:4,color:chosen?'#ecffff':'#7de0df',weight:chosen?2:1.5,fillColor:'#7de0df',fillOpacity:.8}).addTo(mapLayers.cities);
    marker.bindPopup('<strong>'+esc(w[0])+'</strong><br>'+distance(PW.incident,coord(w)).toFixed(1)+' mi from Middletown reference<br><a href="#community">Open community profile</a>').on('click',()=>setLocation(w[0],false,false));
    if(chosen)marker.bindTooltip(esc(w[0]),{permanent:true,direction:'right',offset:[8,0]});
  }
  for(const s of joinedStations().filter(s=>isNum(s.lat)&&isNum(s.lon))) {
    L.circleMarker([s.lat,s.lon],{radius:5,color:'#91baff',weight:1,fillColor:'#3875d4',fillOpacity:.7}).bindPopup('<strong>'+esc(s.id)+'</strong><br>'+esc(sampleState(s.latest)+' · '+sampleText(s.latest))+'<br>'+esc(dateText(s.latest?.at))+'<br>'+esc(s.instruments||'')+'<br><a href="#monitoring">Lead monitoring table</a>').addTo(mapLayers.stations);
  }
  const wx=statusData.weather?.data,o=wx?.history?.[0];
  if(o&&wx.point?.every(isNum)) {
    const icon=L.divIcon({className:'wind-anchor',html:'<span style="display:block;color:#a8f6f2;font-size:23px;transform:rotate('+((o.windFrom??0)+180)+'deg)">↑</span>',iconSize:[24,24],iconAnchor:[12,12]});
    L.marker(wx.point,{icon}).bindPopup(esc(o.station+' · Wind from '+weatherLine(o)+' · '+dateText(o.at))).addTo(mapLayers.wind);
  }
  for(const a of activeAircraft())L.circleMarker([a.lat,a.lon],{radius:4,color:'#f8d08d',weight:1,fillOpacity:.8}).bindPopup(esc((a.flight||a.id)+' · '+(a.alt??'—')+' '+(isNum(a.alt)?'ft':'')+' · '+dateText(statusData.aircraft?.data?.at))).addTo(mapLayers.aircraft);
}
const fitMap=()=>map?.fitBounds([[39.52,-92.95],[41.06,-90.83]],{padding:[18,18]});
function setBase(value) {
  const tiles={
    dark:['https://tile.openstreetmap.org/{z}/{x}/{y}.png','<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>'],
    street:['https://tile.openstreetmap.org/{z}/{x}/{y}.png','<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>'],
    terrain:['https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png','© OpenStreetMap contributors · OpenTopoMap'],
    satellite:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}','Tiles © Esri']
  };
  if(!Object.hasOwn(tiles,value))value='dark';
  if(base)base.remove();
  const [url,attribution]=tiles[value];
  base=L.tileLayer(url,{attribution,className:value==='dark'?'dark-base':'',maxNativeZoom:value==='terrain'?14:17,maxZoom:19}).addTo(map);
  base.bringToBack();
  baseStyle=value;
  save('style',value);
}
async function setLayer(name,on) {
  mapPrefs[name]=on;save('layers',mapPrefs);
  if(!map)return;
  const g=mapLayers[name];
  if(on){
    g.addTo(map);
    if(name==='aircraft'&&!statusData.aircraft)refreshSource('aircraft');
    if(name==='counties') {
      try {
        if(!countiesPromise)countiesPromise=(async()=>{
          const response=await fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json');
          if(!response.ok)throw Error('County boundaries unavailable');
          const data=await response.json();
          const geo=topojson.feature(data,data.objects.counties);
          const regional=geo.features.filter(f=>['17','19','29'].includes(String(f.id).slice(0,2)));
          L.geoJSON({type:'FeatureCollection',features:regional},{style:{color:'#a1b3b7',weight:.7,fill:false}}).addTo(g);
        })();
        await countiesPromise;
      } catch {
        countiesPromise=null;
        const checkbox=document.querySelector('[data-layer="counties"]');
        checkbox.checked=false;
        mapPrefs.counties=false;save('layers',mapPrefs);
        g.remove();
        checkbox.parentElement.title='County boundaries could not be loaded.';
      }
    }
  } else g.remove();
}
function initMap() {
  if(map)return;
  if(!window.L){$('map').innerHTML=note('Map library unavailable. Open Lead monitoring for station data.');return;}
  map=L.map('map',{scrollWheelZoom:false});
  fitMap();
  setBase(baseStyle);
  document.querySelectorAll('[data-layer]').forEach(i=>{if(i.dataset.layer in mapPrefs)i.checked=mapPrefs[i.dataset.layer];});
  $('base-map').value=baseStyle;
  for(const name of ['incident','cities','stations','counties','wind','aircraft','radar'])mapLayers[name]=L.layerGroup();
  L.circleMarker(PW.incident,{radius:8,color:'#ffd2a1',weight:2,fillColor:'#ff9959',fillOpacity:.85}).bindPopup('Middletown, IA · approximate incident reference point').addTo(mapLayers.incident);
  L.tileLayer('https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png',{opacity:.48,attribution:'Iowa Environmental Mesonet'}).addTo(mapLayers.radar);
  document.querySelectorAll('[data-layer]').forEach(i=>setLayer(i.dataset.layer,i.checked));
  drawMapOverlays();
}
async function request(path) {
  try {
    const apiOrigin=document.querySelector('meta[name="plumewatch-api-origin"]')?.content || location.origin;
    const response=await fetch(new URL(path,apiOrigin),{credentials:'same-origin',signal:AbortSignal.timeout(24000)});
    const result=await response.json();
    if(!response.ok)return {...result,attempted:new Date().toISOString()};
    return result;
  } catch {return {error:'Site request timed out or was unavailable',attempted:new Date().toISOString()};}
}
function withPrevious(result,previous) {
  if(result.error&&!result.data&&previous?.data)return {...result,data:previous.data,succeeded:previous.succeeded};
  return result;
}
const loading=new Map();
async function refreshSource(name) {
  if(loading.has(name))return loading.get(name);
  const operation=(async()=>{
    statusData[name]=withPrevious(await request('/api/'+name),statusData[name]);
    if(name==='epa'){renderLead();renderLocal();}
    if(name==='army')renderUpdates();
    if(name==='aircraft')renderAircraft();
    renderDiagnostics();
    drawMapOverlays();
  })();
  loading.set(name,operation);
  try{await operation;}finally{loading.delete(name);}
}
async function refreshWeather() {
  const key=watchKey();
  if(loadingWeather===key)return;
  loadingWeather=key;
  const [lat,lon]=key.split(',');
  const result=await request('/api/weather?lat='+lat+'&lon='+lon);
  if(loadingWeather===key)loadingWeather=null;
  if(key!==watchKey())return;
  statusData.weather=withPrevious(result,weatherFor===key?statusData.weather:null);
  weatherFor=key;
  renderLocal();renderDiagnostics();drawMapOverlays();
}
async function refreshAll() {
  $('refresh').disabled=true;
  $('refresh').textContent='Refreshing…';
  try {await Promise.allSettled([refreshSource('epa'),refreshSource('army'),refreshSource('aircraft'),refreshWeather()]);}
  finally {$('refresh').disabled=false;$('refresh').textContent='Refresh';}
}
function download(rows,ext,baseName) {
  if(!rows.length)return;
  const cols=[...new Set(rows.flatMap(x=>Object.keys(x)))];
  function field(value) {
    let str=String(value??'');
    if(typeof value==='string'&&/^[=+\-@\t\r]/.test(str))str="'"+str;
    return '"'+str.replaceAll('"','""')+'"';
  }
  const body=ext==='csv'?[cols.map(field).join(','),...rows.map(row=>cols.map(c=>field(row[c])).join(','))].join('\r\n'):JSON.stringify(rows,null,2);
  const url=URL.createObjectURL(new Blob([body],{type:ext==='csv'?'text/csv;charset=utf-8':'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=baseName+'.'+ext;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function loadArchive(event) {
  event.preventDefault();
  const data=new FormData(event.currentTarget);
  const from=data.get('from'),through=data.get('through');
  const start=from?from:'0000',end=through?through+'T23:59:59.999Z':'9999';
  if(from&&through&&from>through){$('archive-status').textContent='Choose an end date on or after the start date.';return;}
  const source=data.get('dataset')==='weather'?'weather:'+watchKey():data.get('dataset');
  $('archive-status').textContent='Loading…';
  const result=await request('/api/history?'+new URLSearchParams({source,start,end}));
  archive=result.records??[];
  $('archive-status').textContent=result.error||archive.length+' records'+(result.limited?' · result limit reached':'');
  $('archive-results').innerHTML=archive.length?'<ul class="stack">'+archive.slice(0,12).map(r=>'<li>'+esc(dateText(r.at||r.date)+' · '+(r.title||r.station||'Observation')+(r.unit?' · '+sampleText(r):r.mph!=null?' · '+weatherLine(r):''))+'</li>').join('')+'</ul>':'';
  $('archive-csv').disabled=$('archive-json').disabled=!archive.length;
}
$('layout-toggle').onclick=()=>{$('layout-controls').hidden=!$('layout-controls').hidden;};
$('layout-controls').onclick=e=>{
  const button=e.target.closest('button[data-action]');if(!button)return;
  const index=layout.findIndex(item=>item.id===button.dataset.moduleId);
  const action=button.dataset.action;
  if(action==='previous'||action==='next'){
    const j=index+(action==='previous'?-1:1);
    if(j<0||j>=layout.length)return;
    [layout[index],layout[j]]=[layout[j],layout[index]];
  }else layout[index][action]=!layout[index][action];
  save('layout',layout);layoutView();
};
$('theme').onclick=()=>{const root=document.documentElement;root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';save('theme',root.dataset.theme);};
$('theater').onclick=()=>{if(active!=='command')location.hash='command';document.body.classList.toggle('theater');setTimeout(()=>map?.invalidateSize(),80);};
$('map-full').onclick=()=>{document.querySelector('.map-panel').classList.toggle('map-full');setTimeout(()=>map?.invalidateSize(),80);};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.body.classList.remove('theater');document.querySelector('.map-panel').classList.remove('map-full');setTimeout(()=>map?.invalidateSize(),80);}});
$('fit-map').onclick=fitMap;
$('base-map').onchange=e=>{if(map)setBase(e.target.value);};
document.querySelectorAll('[data-layer]').forEach(i=>i.onchange=()=>setLayer(i.dataset.layer,i.checked));
$('air-layer').onclick=()=>{location.hash='command';const i=document.querySelector('[data-layer="aircraft"]');i.checked=true;setLayer('aircraft',true);};
$('location').onchange=e=>setLocation(e.target.value,true);
$('community-select').onchange=e=>setLocation(e.target.value);
$('add-watch').onsubmit=e=>{
  e.preventDefault();
  const data=new FormData(e.currentTarget);
  const name=data.get('name').trim(),lat=Number(data.get('lat')),lon=Number(data.get('lon'));
  if(!name||watch.some(x=>x[0].toLowerCase()===name.toLowerCase())||watch.length>=50){
    const input=e.currentTarget.elements.name;
    input.setCustomValidity('Enter a unique watch name. Up to 50 locations are supported.');
    input.reportValidity();return;
  }
  watch.push([name,lat,lon]);setLocation(name);e.currentTarget.reset();
};
$('add-watch').elements.name.oninput=e=>e.target.setCustomValidity('');
$('remove-watch').onclick=()=>{const i=watch.findIndex(x=>x[0]===locationName);if(i>=PW.cities.length){watch.splice(i,1);setLocation('Macon, MO');}};
$('show-epa').onclick=()=>{const node=$('epa-embed');node.hidden=!node.hidden;if(!node.hidden&&!node.firstChild){const iframe=document.createElement('iframe');iframe.src=PW.epa;iframe.className='embed';iframe.title='EPA public incident dashboard';node.append(iframe);} $('show-epa').textContent=node.hidden?'Open embedded viewer':'Close embedded viewer';};
$('station-search').oninput=renderLead;$('station-sort').onchange=renderLead;$('trend-station').onchange=renderTrend;
$('station-table').onclick=e=>{const b=e.target.closest('[data-trend]');if(b){$('trend-station').value=b.dataset.trend;renderTrend();$('lead-trend').scrollIntoView({behavior:'smooth',block:'center'});}};
$('dl-live').onclick=()=>download(formats(),'csv','plumewatch-epa-samples');
$('transport').onsubmit=e=>{e.preventDefault();const d=new FormData(e.currentTarget);const mins=Math.round(60*Number(d.get('distance'))/Number(d.get('speed')));$('travel-result').textContent=Math.floor(mins/60)+' h '+mins%60+' min at the entered constant speed.';};
$('news-search').oninput=renderUpdates;$('news-kind').onchange=renderUpdates;
$('flight-search').oninput=()=>{renderAircraft();drawMapOverlays();};$('min-alt').oninput=$('flight-search').oninput;
$('source-search').oninput=renderDiagnostics;
$('archive-form').onsubmit=loadArchive;
$('archive-csv').onclick=()=>download(archive,'csv','plumewatch-archive');$('archive-json').onclick=()=>download(archive,'json','plumewatch-archive');
$('print').onclick=()=>{renderReport();window.print();};
$('refresh').onclick=refreshAll;
window.addEventListener('hashchange',route);
for(const [id,cat] of [['model-links','Plume models'],['wx-links','Weather'],['air-links','Aviation'],['sat-links','Satellite'],['camera-links','Cameras'],['env-links','Environment']])$(id).innerHTML=cards(category(cat));
document.documentElement.dataset.theme=get('theme','dark');
fillSelects();layoutView();renderUpdates();renderLocal();renderLead();renderAircraft();renderDiagnostics();route();
tick();setInterval(tick,1000);
refreshAll();
setInterval(()=>{if(!document.hidden){refreshSource('epa');refreshWeather();}},300000);
setInterval(()=>{if(!document.hidden)refreshSource('army');},600000);
setInterval(()=>{if(!document.hidden&&(active==='command'||active==='visuals'))refreshSource('aircraft');},300000);
$('model-version').innerHTML=PW.models.map(([label],i)=>'<option value="'+i+'">'+esc(label)+'</option>').join('');
function showModel(){
  const [label,url]=PW.models[Number(byId('model-version'))];
  $('model-image').src=url;
  $('model-image').alt=label;
  $('model-image-link').href=url;
}
$('model-version').onchange=showModel;
showModel();
