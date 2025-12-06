// weather.js – FINAL WORKING VERSION (Dec 2025)
// Copy and paste this entire file – nothing else needed

const CACHE_KEY = 'nwsCache_v5';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function updateWeather() {
    const lat = 32.4066, lon = -93.3906;

    const fetchWithTimeout = (url, options = {}, timeout = 30000) => {
        return Promise.race([
            fetch(url, options),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
        ]);
    };

    // Try cache first
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const { data, ts } = JSON.parse(cached);
            if (Date.now() - ts < CACHE_TTL) {
                window.lastWeatherData = data;
                renderWeather(data);
                initRadarWidget();
                return;
            }
        }
    } catch(e) {}

    document.getElementById('bistineauWeather').innerHTML = 'Fetching fresh NWS data...';

    let grid;
    try {
        const pointRes = await fetchWithTimeout(`https://api.weather.gov/points/${lat},${lon}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; PortOBistineauWeather/1.0; +https://portobistineau.com)'
            }
        });
        if (!pointRes.ok) throw new Error(`HTTP ${pointRes.status}`);
        grid = (await pointRes.json()).properties;
    } catch (e) {
        console.error(e);
        document.getElementById('bistineauWeather').innerHTML = '<div style="padding:20px;color:#900;background:#fff0f0;text-align:center;">Weather temporarily unavailable – retrying soon</div>';
        return;
    }

    try {
        const [stationsRes, dailyRes, hourlyRes] = await Promise.all([
            fetchWithTimeout(grid.observationStations),
            fetchWithTimeout(grid.forecast),
            fetchWithTimeout(grid.forecastHourly)
        ]);

        const stations = await stationsRes.json();
        const station = stations.observationStations[0];
        const [obs, daily, hourly] = await Promise.all([
            fetchWithTimeout(`${station}/observations/latest?require_qc=false`).then(r => r.json()),
            dailyRes.json(),
            hourlyRes.json()
        ]);

        const data = {
            grid,
            obs: obs.properties,
            daily: daily.properties,
            hourly: hourly.properties
        };

        localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
        window.lastWeatherData = data;
        renderWeather(data);
        initRadarWidget();

    } catch (e) {
        console.error(e);
        document.getElementById('bistineauWeather').innerHTML = '<div style="padding:20px;color:#900;background:#fff0f0;text-align:center;">Partial data – will retry</div>';
    }
}

function renderWeather(data) {
    const now = new Date();
    const p = data.obs;

    const currentTemp = Math.round(p.temperature.value * 1.8 + 32);
    const feels = Math.round(p.apparentTemperature?.value * 1.8 + 32) || currentTemp;
    const pressure = (p.barometricPressure.value / 3386.39).toFixed(2);
    let trend = '';
    if (p.pressureChange?.value !== null) {
        const inches = p.pressureChange.value / 3386.39;
        if (Math.abs(inches) < 0.02) trend = '(steady)';
        else if (inches > 0) trend = '(rising)';
        else trend = '(falling)';
    }
    const timeStr = new Date(p.timestamp).toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'});

    const closestHourly = data.hourly.periods.reduce((a,b) => 
        Math.abs(new Date(b.startTime) - now) < Math.abs(new Date(a.startTime) - now) ? b : a
    );

    const currentIcon = closestHourly?.icon?.replace('large','medium') || '';
    const currentForecast = closestHourly?.shortForecast || '';
    let windSpeedAvg = 0;
    if (closestHourly?.windSpeed) {
        const nums = closestHourly.windSpeed.match(/\d+/g)?.map(Number) || [];
        windSpeedAvg = nums.length === 1 ? nums[0] : Math.round((nums[0]+nums[1])/2);
    }
    const windDir = closestHourly?.windDirection || '';

    const currentHTML = `
      <div style="background:#fff;padding:15px;border-radius:12px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.1);height:100%;">
        <div style="font-size:28px;font-weight:bold;">${currentTemp}°F</div>
        <div style="margin:8px 0;">
          <img src="${currentIcon}" width="85" height="85" style="display:block;margin:0 auto;">
          <div style="font-size:14px;color:#666;margin-top:4px;">${currentForecast}</div>
        </div>
        <div style="color:#666;margin-bottom:8px;">Feels ${feels}°F • As of ${timeStr}</div>
        <div style="font-size:14px;line-height:1.6;">
          Wind ${windSpeedAvg} mph ${windDir}<br>
          Pressure ${pressure} inHg ${trend}<br>
          Humidity ${p.relativeHumidity.value !== null ? Math.round(p.relativeHumidity.value) : '—'}%<br>
          Dew Point ${p.dewpoint.value !== null ? Math.round(p.dewpoint.value * 1.8 + 32) : '—'}°F<br>
        </div>
      </div>`;

    const radarHTML = `
        <div id="radar-widget-wrapper">
            <div id="radar-legend">
                <div class="legend-bar-wrapper"><div class="legend-label">RAIN</div><div class="gradient-bar rain-gradient"></div></div>
                <div class="legend-bar-wrapper"><div class="legend-label">ICE</div><div class="gradient-bar ice-gradient"></div></div>
                <div class="legend-bar-wrapper"><div class="legend-label">SNOW</div><div class="gradient-bar snow-gradient"></div></div>
            </div>
            <div id="radar-container">
                <div id="radar-map" style="width:100%;height:100%;background:#000;"></div>
                <div style="position:absolute;bottom:5px;right:5px;background:rgba(0,0,0,0.7);color:white;padding:4px 10px;border-radius:4px;font-size:12px;z-index:950;pointer-events:none;">
                    <span id="radar-status" style="font-weight:bold;color:#00ff00;">LIVE</span> <span id="radar-time">Loading...</span>
                </div>
                <div style="position:absolute;bottom:35px;left:5px;font-size:10px;color:rgba(255,255,255,0.7);text-shadow:1px 1px 2px black;z-index:900;pointer-events:none;">
                    Data: RainViewer / Esri
                </div>
            </div>
            <div id="radar-controls">
                <button id="radar-rewind" title="Previous"><<</button>
                <button id="radar-play-pause" title="Play/Pause">Pause</button>
                <button id="radar-forward" title="Next">>></button>
                <select id="radar-speed-select" title="Speed">
                    <option value="1200">Slow</option>
                    <option value="800">Medium</option>
                    <option value="400" selected>Fast</option>
                </select>
            </div>
        </div>`;

    let forecastHTML = '<div style="display:flex;justify-content:center;flex-wrap:wrap;gap:12px;padding:15px;background:#f0f8ff;border-radius:15px;margin-top:15px;">';
    const dailyPeriods = data.daily.periods.slice(0,14);
    for (let i = 0; i < 7; i++) {
        const day = dailyPeriods[i*2];
        const night = dailyPeriods[i*2+1] || day;
        const dayName = i === 0 ? 'Today' : new Date(Date.now() + i*86400000).toLocaleDateString('en-US',{weekday:'short'});
        const icon = day.icon.replace('large','medium');
        const startOfDay = new Date(); startOfDay.setHours(0,0,0,0); startOfDay.setDate(startOfDay.getDate()+i);
        const endOfDay = new Date(startOfDay); endOfDay.setHours(23,59,59,999);
        const dayHours = data.hourly.periods.filter(p => new Date(p.startTime) >= startOfDay && new Date(p.startTime) <= endOfDay);
        const hi = dayHours.length ? Math.max(...dayHours.map(p=>p.temperature)) : day.temperature;
        const lo = dayHours.length ? Math.min(...dayHours.map(p=>p.temperature)) : night.temperature;

        forecastHTML += `
        <div onclick="showDetail(${i})" style="cursor:pointer;width:100px;height:170px;background:#fff;padding:8px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.1);text-align:center;display:flex;flex-direction:column;justify-content:space-between;">
          <div style="font-weight:bold;color:#003366;">${dayName}</div>
          <div style="flex:1;display:flex;align-items:center;justify-content:center;"><img src="${icon}" width="48" height="48"></div>
          <div style="font-size:16px;font-weight:bold;">${hi}°<span style="font-size:12px;color:#666;">/${lo}°</span></div>
          <div style="font-size:11px;line-height:1.25;height:40px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">
            ${day.shortForecast}
          </div>
        </div>`;
    }
    forecastHTML += '</div>';

    const topSection = `<div style="display:flex;flex-wrap:wrap;gap:20px;justify-content:center;align-items:flex-start;">
        <div style="flex:1 1 300px;max-width:400px;">${currentHTML}</div>
        <div style="flex:0 0 400px;max-width:100%;">${radarHTML}</div>
    </div>`;

    document.getElementById('bistineauWeather').innerHTML = topSection + forecastHTML;
}

// ——————— RADAR & POPUP CODE (unchanged, just compacted) ———————
function initRadarWidget() {
    if (window.radarMapInstance) { window.radarMapInstance.remove(); }
    if (window.radarAnimationTimer) { clearInterval(window.radarAnimationTimer); }
    window.currentFrameIndex = 0; window.radarLayers = [];

    const map = L.map('radar-map', {center:[32.42,-93.40], zoom:9.5, zoomControl:false, attributionControl:false, scrollWheelZoom:false, dragging:!L.Browser.mobile, zoomSnap:0.1});
    window.radarMapInstance = map;

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {maxZoom:19,zIndex:0}).addTo(map);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {maxZoom:19,zIndex:50}).addTo(map);

    // lake outline + marina marker (your existing code – left exactly as-is)
    const dotdGeoJsonUrl = "https://maps.dotd.la.gov/topo/rest/services/OpenData/NHD/FeatureServer/3/query?where=GNIS_Name%3D'Lake%20Bistineau'&outFields=*&f=geojson&returnGeometry=true";
    fetch(dotdGeoJsonUrl).then(r=>r.json()).then(d=>L.geoJson(d,{style:{fillColor:"#0084FF",weight:0,fillOpacity:0.35}}).addTo(map)).catch(()=>{});

    const star = L.divIcon({className:'star',html:'<i class="fa-solid fa-star fa-lg" style="color:red;opacity:0.9;"></i>',iconSize:[20,20],iconAnchor:[10,10]});
    L.marker([32.4619,-93.34883],{icon:star}).addTo(map);
    const label = L.divIcon({className:'label',html:'<span style="color:white;font-weight:bold;font-size:10px;text-shadow:1px 1px 3px black;">Port O Bistineau</span>',iconSize:[120,20],iconAnchor:[0,10]});
    L.marker([32.4719,-93.35883],{icon:label}).addTo(map);

    document.getElementById('radar-play-pause')?.addEventListener('click', toggleAnimation);
    document.getElementById('radar-rewind')?.addEventListener('click', () => scrubFrame(-1));
    document.getElementById('radar-forward')?.addEventListener('click', () => scrubFrame(1));
    document.getElementById('radar-speed-select')?.addEventListener('change', changeSpeed);

    fetch('https://api.rainviewer.com/public/weather-maps.json')
        .then(r=>r.json())
        .then(d=>processRadarFrames(map,d))
        .catch(()=>{});
}

function processRadarFrames(map, apiData) {
    const past = apiData.radar.past.slice(-24);
    const future = apiData.radar.nowcast.slice(0,12);
    const frames = past.concat(future);

    frames.forEach((f,i) => {
        const layer = L.tileLayer(apiData.host + f.path + '/256/{z}/{x}/{y}/2/1_1.png', {opacity:0, zIndex:100});
        layer.isFuture = i >= past.length;
        layer.timestamp = f.time;
        layer.addTo(map);
        window.radarLayers.push(layer);
    });
    startAnimationLoop();
}

function startAnimationLoop() {
    if (window.radarAnimationTimer) clearInterval(window.radarAnimationTimer);
    const speed = document.getElementById('radar-speed-select')?.value || 400;
    window.radarAnimationTimer = setInterval(() => {
        window.currentFrameIndex = (window.currentFrameIndex + 1) % window.radarLayers.length;
        updateRadarDisplay();
    }, speed);
    document.getElementById('radar-play-pause')?.innerHTML = 'Pause';
}

function toggleAnimation() {
    if (window.radarAnimationTimer) { clearInterval(window.radarAnimationTimer); window.radarAnimationTimer = null;
        document.getElementById('radar-play-pause').innerHTML = 'Play';
    } else startAnimationLoop();
}

function scrubFrame(dir) { pauseAnimation(); window.currentFrameIndex = (window.currentFrameIndex + dir + window.radarLayers.length) % window.radarLayers.length; updateRadarDisplay(); }
function pauseAnimation() { if (window.radarAnimationTimer) { clearInterval(window.radarAnimationTimer); window.radarAnimationTimer = null; document.getElementById('radar-play-pause').innerHTML = 'Play'; } }
function changeSpeed() { if (window.radarAnimationTimer) startAnimationLoop(); }

function updateRadarDisplay() {
    if (!window.radarLayers.length) return;
    window.radarLayers.forEach((l,i) => l.setOpacity(i === window.currentFrameIndex ? 0.7 : 0));
    const layer = window.radarLayers[window.currentFrameIndex];
    document.getElementById('radar-time').textContent = new Date(layer.timestamp*1000).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
    const status = document.getElementById('radar-status');
    status.textContent = layer.isFuture ? "FUTURE" : "PAST";
    status.style.color = layer.isFuture ? "#00ccff" : "#00ff00";
}

window.showDetail = function(dayIndex) {
    const data = window.lastWeatherData;
    if (!data) return;
    const start = new Date(); start.setHours(0,0,0,0); start.setDate(start.getDate() + dayIndex);
    const end = new Date(start); end.setHours(23,59,59,999);
    const periods = data.hourly.periods.filter(p => new Date(p.startTime) >= start && new Date(p.startTime) <= end);
    let html = `<h3 style="margin-top:0;text-align:center;">${start.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</h3><div style="max-height:60vh;overflow-y:auto;">`;
    periods.forEach(p => {
        const t = new Date(p.startTime).toLocaleTimeString('en-US',{hour:'numeric'});
        const wind = p.windSpeed.replace(' mph','');
        html += `<div style="display:flex;justify-content:space-between;padding:8px;border-bottom:1px solid #eee;font-size:14px;">
            <div style="width:50px;">${t}</div>
            <img src="${p.icon.replace('large','small')}" width="32" height="32">
            <div style="width:60px;text-align:right;font-weight:bold;">${p.temperature}°</div>
            <div style="width:80px;text-align:center;">${wind} ${p.windDirection}</div>
            <div style="width:50px;text-align:right;">${p.probabilityOfPrecipitation.value||0}%</div>
        </div>`;
    });
    html += `</div><div style="text-align:center;margin-top:10px;"><button onclick="document.getElementById('overlay').style.display='none';document.getElementById('dayDetail').style.display='none';" style="padding:8px 16px;background:#003366;color:#fff;border:none;border-radius:6px;cursor:pointer;">Close</button></div>`;
    document.getElementById('dayDetail').innerHTML = html;
    document.getElementById('dayDetail').style.display = 'block';
    document.getElementById('overlay').style.display = 'block';
};

// Start when page loads
document.addEventListener('DOMContentLoaded', updateWeather);
