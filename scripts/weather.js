// weather.js (to be placed in the 'scripts' folder)

// Global for popup
window.lastWeatherData = null;

// Global for Map instance (to handle clean reloads)
window.radarMapInstance = null; 
window.radarAnimationTimer = null;
    
// Globals for Radar Control
window.currentFrameIndex = 0; 
window.radarLayers = [];
    
async function updateWeather() {
    
    // ALWAYS CLEAR CACHE ON LOAD
    localStorage.removeItem('nwsCache');
    const lat = 32.4066, lon = -93.3906;
    const now = new Date();
    // Only show "Fetching" if this is the initial load
    if(!document.getElementById('radar-map')) {
        document.getElementById('bistineauWeather').innerHTML = 'Fetching fresh NWS data...';
    }
    let grid;
    try {
      const point = await fetch(`https://api.weather.gov/points/${lat},${lon}`, {
        headers: { 'User-Agent': 'PortOBistineauWeather/1.0 (portobistineau.com, portobistineau@gmail.com)' }
      }).then(r => r.json());
      grid = point.properties;
    } catch(e) {
      document.getElementById('bistineauWeather').innerHTML = '<div style="padding:20px;color:red;">NWS down – try later</div>';
      return;
    }
    const [stationsRes, dailyRes, hourlyRes] = await Promise.all([
      fetch(grid.observationStations),
      fetch(grid.forecast),
      fetch(grid.forecastHourly)
    ]);
    const stations = await stationsRes.json();
    const station = 'https://api.weather.gov/stations/KSHV';
    const obs = await fetch(`${station}/observations/latest?require_qc=false`).then(r => r.json());
    const daily = await dailyRes.json();
    const hourly = await hourlyRes.json();
    const data = {
      grid,
      obs: obs.properties,
      daily: daily.properties,
      hourly: hourly.properties
    };
    window.lastWeatherData = data;
    // --- RENDER CURRENT ---
    const p = data.obs;
    const currentTempC = p.temperature.value;
    const currentTemp = Math.round(currentTempC * 1.8 + 32);

    // Determine Feels Like: use windChill if available, then heatIndex, otherwise actual temp
    let feelsLikeC = currentTempC;
    if (p.windChill?.value !== null) {
        feelsLikeC = p.windChill.value;
    } else if (p.heatIndex?.value !== null) {
        feelsLikeC = p.heatIndex.value;
    }
    const feels = Math.round(feelsLikeC * 1.8 + 32);
    const pressure = (p.barometricPressure.value / 3386.39).toFixed(2);
    let trend = '';
    const change = p.pressureChange?.value;
    if (change !== null) {
      const inches = change / 3386.39;
      if (Math.abs(inches) < 0.02) trend = '(steady)';
      else if (inches > 0) trend = '(rising)';
      else trend = '(falling)';
    }
    const timeStr = new Date(p.timestamp).toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'});
    const nowDate = now.getTime();
    const closestHourly = data.hourly.periods.reduce((a,b) =>
      Math.abs(new Date(b.startTime) - nowDate) < Math.abs(new Date(a.startTime) - nowDate) ? b : a
    );
    const currentIcon = closestHourly?.icon?.replace('large','medium') || '';
    const currentForecast = closestHourly?.shortForecast || '';
        // Use actual observed wind from KSHV station
    let windSpeedAvg = 0;
    let windDir = '';

    const obsWindSpeedKmH = p.windSpeed?.value;       // in km/h, can be null
    const obsWindDirDeg = p.windDirection?.value;     // in degrees (true), 0=north, can be null

    if (obsWindSpeedKmH !== null && obsWindSpeedKmH !== undefined) {
      windSpeedAvg = Math.round(obsWindSpeedKmH * 0.621371);  // convert km/h to mph
    }

    if (obsWindDirDeg !== null && obsWindDirDeg !== undefined) {
      // Convert degrees to 16-point cardinal direction (N, NNE, NE, etc.)
      const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
                    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
      const index = Math.round(obsWindDirDeg / 22.5) % 16;
      windDir = dirs[index];
    }

    // Special case: if observed speed is very low (< 3 mph) and direction is missing/variable,
    // or if the original forecast said something like "Light and Variable", fall back to that text
    if (windSpeedAvg < 3 || !windDir) {
      const forecastWind = closestHourly?.windSpeed || '';
      const forecastDir = closestHourly?.windDirection || '';
      if (forecastWind.includes('Light') || forecastDir.toLowerCase().includes('variable')) {
        windSpeedAvg = 0;  // or keep low number if you prefer
        windDir = 'Light and Variable';
      } else if (!windDir) {
        windDir = 'Calm';
      }
    }
    
    // --- HTML GENERATION ---
    
    const currentHTML = `
      <div id="weather-details-box" style="background:#fff;padding:15px;border-radius:12px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.1);height:auto;">
        <div style="font-size:28px;font-weight:bold;">${currentTemp}°F</div>
        <div style="margin:8px 0;">
          <img src="${currentIcon}" width="85" height="85" style="vertical-align:middle;margin:0 auto;display:block;">
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
    
    // Placeholder for the NWS Alert Card
    // Note: The onclick="event.preventDefault();" prevents the <a> tag from navigating away when empty
    const alertPlaceholder = '<a id="nws-alert-card" href="#" onclick="event.preventDefault();"></a>';

    // --- NEW: RADAR HTML WITH COMPACT LEGEND AND BOTTOM CONTROLS ---
    const radarHTML = `
        <div id="radar-widget-wrapper">
            
            <div id="radar-legend">
    <div class="legend-bar-wrapper">
        <div class="legend-label">RAIN</div>
        <div class="gradient-bar rain-gradient"></div>
    </div>
    <div class="legend-bar-wrapper">
        <div class="legend-label">ICE</div>
        <div class="gradient-bar ice-gradient"></div>
    </div>
    <div class="legend-bar-wrapper">
        <div class="legend-label">SNOW</div>
        <div class="gradient-bar snow-gradient"></div>
    </div>
</div>

            <div id="radar-container">
                <div id="radar-map" style="width:100%; height:100%; background: #000;"></div>
                
                <div style="position:absolute; bottom:5px; right:5px; background:rgba(0,0,0,0.7); color:white; padding:4px 10px; border-radius:4px; font-family:Arial; font-size:12px; z-index:950; pointer-events:none;">
                    <span id="radar-status" style="font-weight:bold; color:#00ff00;">LIVE</span> 
                    <span id="radar-time">Loading...</span>
                </div>
                <div style="position:absolute; bottom:35px; left:5px; font-family:Arial; font-size:10px; color:rgba(255,255,255,0.7); z-index:900; pointer-events:none; text-shadow:1px 1px 2px black;">
                    Radar data provided by Rainviewer
                </div>
            </div>

            <div id="radar-controls">
                <button id="radar-rewind" title="Previous Frame"><<</button>
                <button id="radar-play-pause" title="Pause/Play">▮▮</button>
                <button id="radar-forward" title="Next Frame">>></button>
                
                <select id="radar-speed-select" title="Animation Speed">
                    <option value="1200">Slow</option>
                    <option value="800">Medium</option>
                    <option value="400" selected>Fast</option>
                </select>
            </div>

        </div>
    `;

    let forecastHTML = '<div style="display:flex;justify-content:center;flex-wrap:wrap;gap:12px;padding:15px;background:#f0f8ff;border-radius:15px;margin-top:15px;">';
    const dailyPeriods = data.daily.periods.slice(0, 14);
    for (let i = 0; i < 7; i++) {
      const day = dailyPeriods[i*2];
      const night = dailyPeriods[i*2 + 1] || day;
      const dayDate = new Date();
      dayDate.setDate(dayDate.getDate() + i);
      const dayName = i===0 ? 'Today' : dayDate.toLocaleDateString('en-US', { weekday:'short' });
      const icon = day.icon.replace('large','medium');
      const startOfDay = new Date();
      startOfDay.setHours(0,0,0,0); startOfDay.setDate(startOfDay.getDate() + i);
      const endOfDay = new Date(startOfDay); endOfDay.setHours(23,59,59,999);
      const dayHours = data.hourly.periods.filter(p => {
        const t = new Date(p.startTime);
        return t >= startOfDay && t <= endOfDay;
      });
      const hi = dayHours.length ? Math.max(...dayHours.map(p=>p.temperature)) : day.temperature;
      const lo = dayHours.length ? Math.min(...dayHours.map(p=>p.temperature)) : night.temperature;
      forecastHTML += `
        <div onclick="showDetail(${i})" style="cursor:pointer;width:100px;height:170px;background:#fff;padding:8px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.1);text-align:center;display:flex;flex-direction:column;justify-content:space-between;">
          <div style="font-weight:bold;color:#003366;">${dayName}</div>
          <div style="flex:1;display:flex;align-items:center;justify-content:center;">
            <img src="${icon}" width="48" height="48">
          </div>
          
          <div style="font-size:16px;font-weight:bold;">${hi}°<span style="font-size:12px;color:#666;">/${lo}°</span></div>
          <div style="font-size:11px;line-height:1.25;height:40px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">
            ${day.shortForecast}
          </div>
        </div>`;
    }
    forecastHTML += '</div>';
    // --- TOP SECTION (Combines Current Weather, New Alert Card, and New Radar Widget) ---
    const topSection = `
        <div style="display:flex; flex-wrap:wrap; gap:20px; justify-content:center; align-items:flex-start;">
            
            <div style="flex: 1 1 300px; max-width: 400px;">
                ${currentHTML}
                ${alertPlaceholder} </div>
            
            <div style="flex: 0 0 400px; max-width: 100%;">
                ${radarHTML}
            </div>
        </div>
    `;

    document.getElementById('bistineauWeather').innerHTML = topSection + forecastHTML;

    initRadarWidget();
    checkNWSAlerts(); // NEW: Call the alert check function
  }


// ------------------------------------
// --- NEW NWS ALERT LOGIC ---
// ------------------------------------

// --- NWS ALERT LOGIC (FINAL LIVE VERSION) ---
async function checkNWSAlerts() {
    const alertCard = document.getElementById('nws-alert-card');
    
    // Use the central point of the area
    const lakeCenterLat = 32.4066;
    const lakeCenterLon = -93.3906;
    const pointQuery = `${lakeCenterLat},${lakeCenterLon}`;
    
    // NEW: Use the 'point' parameter for maximum precision, covering all 3 parishes
    const nwsApiUrl = `https://api.weather.gov/alerts/active?point=${pointQuery}`; 

    try {
        // Fetch without custom headers to avoid the 400 error
        const response = await fetch(nwsApiUrl); 
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const alerts = data.features;
        
        if (alerts.length > 0) {
            // Find the highest priority alert based on type
            let alert = alerts[0].properties;
            let type = '';

            // Prioritize: Warning > Watch > Special Statement
            for (const a of alerts) {
                const event = a.properties.event;
                const description = a.properties.description;
                
                // 1. WARNING (Highest Priority)
                if (event.includes('Warning')) {
                    alert = a.properties;
                    type = 'warning';
                    break; 
                } 
                
                // 2. WATCH (If no Warning found yet)
                if (event.includes('Watch') && type !== 'warning') {
                    alert = a.properties;
                    type = 'watch';
                } 
                
                // 3. STATEMENT (Lowest Priority, only if no Warning or Watch found yet)
                if (type !== 'warning' && type !== 'watch') {
                     if (event.includes('Special Weather Statement') || description.includes('SPECIAL WEATHER STATEMENT')) {
                         alert = a.properties;
                         type = 'statement';
                     }
                }
                
                // 4. NEW ADVISORY CHECK (If no Warning, Watch, or Statement found yet)
                if (type !== 'warning' && type !== 'watch' && type !== 'statement') {
                     if (event.includes('Advisory')) {
                         alert = a.properties;
                         type = 'advisory'; // <--- NEW TYPE DEFINITION
                     }
                }
            }

            let headlineText = '';
            let alertClass = '';
            
            if (type === 'warning') {
                headlineText = 'WEATHER WARNING ISSUED!';
                alertClass = 'nws-warning-active';
            } else if (type === 'watch') {
                headlineText = 'WEATHER WATCH ISSUED!';
                alertClass = 'nws-watch-active';
            } else if (type === 'statement') {
                headlineText = 'SPECIAL WEATHER STATEMENT!';
                alertClass = 'nws-statement-active';
            } else if (type === 'advisory') { // <--- NEW RENDERING CHECK
                headlineText = 'WEATHER ADVISORY ISSUED!';
                alertClass = 'nws-advisory-active'; // <--- NEW CLASS
            } else {
                 // No relevant alert found after filtering
                 alertCard.className = '';
                 alertCard.innerHTML = '';
                 return;
            }
            
            // Set the appearance and content
            alertCard.className = alertClass;
            alertCard.innerHTML = `
                <div style="font-size:1.4em; color:inherit;">${headlineText}</div>
                <div style="font-size:1em; line-height:1.4; color:inherit;">IMPORTANT ALERT FROM THE NATIONAL WEATHER SERVICE! PLEASE CLICK TO READ!</div>
                <div style="font-size:1.4em; color:inherit;">${headlineText}</div>
            `;
            
            // Re-attach the click handler (clone-replace prevents duplicate listeners)
            const oldCard = alertCard.cloneNode(true);
            alertCard.parentNode.replaceChild(oldCard, alertCard);
            const newCard = document.getElementById('nws-alert-card');

            newCard.addEventListener('click', function(e) {
                e.preventDefault();
                showNWSAlertPopup(alert.event, alert.description, alert.url);
            });

        } else {
            // No active alerts, reset the card to empty white state
            alertCard.className = '';
            alertCard.innerHTML = '';
        }

    } catch (error) {
        console.error('Error fetching NWS alerts:', error);
        alertCard.className = '';
        // Display user-friendly error if the connection fails
        if (error.message && error.message.includes('HTTP error')) {
            alertCard.innerHTML = '<p style="color:red; font-size:12px;">Alert service unavailable (API error).</p>';
        }
    }
}


window.showNWSAlertPopup = function(headline, description, fullUrl) {
    // Determine header color for the popup
    let headerColor = '#333';
    if (headline.includes('Warning')) {
        headerColor = '#dc3545';
    } else if (headline.includes('Watch')) {
        headerColor = '#ffc107';
    } else if (headline.includes('Statement')) {
        headerColor = '#28a745';
    }

    const popupHTML = `
        <div class="nws-popup-overlay" id="nws-popup-overlay">
            <div class="nws-popup-content">
                <span class="nws-close-btn" onclick="document.getElementById('nws-popup-overlay').style.display='none';">&times;</span>
                <h3 style="color: ${headerColor};">${headline}</h3>
                <p style="white-space: pre-wrap; font-size: 14px;">${description}</p>
                <p style="text-align: center; margin-top: 20px;">
                    <a href="${fullUrl}" target="_blank" style="color: blue; font-weight: bold;">View Official NWS Details</a>
                </p>
                <div style="text-align:center;margin-top:10px;"><button onclick="document.getElementById('nws-popup-overlay').style.display='none';" style="padding:8px 16px;background:#003366;color:#fff;border:none;border-radius:6px;cursor:pointer;">Close</button></div>
            </div>
        </div>
    `;

    // Add or update the popup element
    let popup = document.getElementById('nws-popup-overlay');
    if (!popup) {
        document.body.insertAdjacentHTML('beforeend', popupHTML);
        popup = document.getElementById('nws-popup-overlay');
    } else {
         // Update content of existing popup
         document.querySelector('.nws-popup-content').innerHTML = `
            <span class="nws-close-btn" onclick="document.getElementById('nws-popup-overlay').style.display='none';">&times;</span>
            <h3 style="color: ${headerColor};">${headline}</h3>
            <p style="white-space: pre-wrap; font-size: 14px;">${description}</p>
            <p style="text-align: center; margin-top: 20px;">
                <a href="${fullUrl}" target="_blank" style="color: blue; font-weight: bold;">View Official NWS Details</a>
            </p>
            <div style="text-align:center;margin-top:10px;"><button onclick="document.getElementById('nws-popup-overlay').style.display='none';" style="padding:8px 16px;background:#003366;color:#fff;border:none;border-radius:6px;cursor:pointer;">Close</button></div>
         `;
    }

    // Display the popup
    popup.style.display = 'flex';
}

// HELPER: Generates UTC timestamps rounded to the nearest 5 mins for IEM Radar
// --- 1. FIXED TIMESTAMP MATH (Starts at 15m ago to avoid 404s) ---
function getIEMTimestamp(offsetMinutes) {
    let d = new Date();
    // We add a 15-minute buffer because Iowa State needs time to process the tiles
    d.setMinutes(d.getMinutes() - offsetMinutes - 15); 
    
    let minutes = Math.floor(d.getUTCMinutes() / 5) * 5;
    const pad = (n) => n.toString().padStart(2, '0');
    
    return d.getUTCFullYear().toString() + 
           pad(d.getUTCMonth() + 1) + 
           pad(d.getUTCDate()) + 
           pad(d.getUTCHours()) + 
           pad(minutes);
}

// --- 1. CONFIGURATION & STORAGE ---
const RAINVIEWER_BASE = 'https://tilecache.rainviewer.com';
const MARINA_COORDS = [32.4619, -93.34883];
window.radarBuffer = []; 
window.currentFrameIndex = 0;
window.radarAnimationTimer = null;

// --- 2. INITIALIZE RADAR ---
function initRadarWidget() {
    if (window.radarMapInstance) window.radarMapInstance.remove();

    var map = L.map('radar-map', {
        center: [32.42, -93.37],
        zoom: 10,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
        dragging: !L.Browser.mobile
    });
    window.radarMapInstance = map;

    // A. Base Layers
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { zIndex: 0 }).addTo(map);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { zIndex: 50 }).addTo(map);

    // B. Lake Overlay
    const dotdGeoJsonUrl = "https://maps.dotd.la.gov/topo/rest/services/OpenData/NHD/FeatureServer/3/query?where=GNIS_Name%3D'Lake%20Bistineau'&outFields=*&f=geojson&returnGeometry=true";
    fetch(dotdGeoJsonUrl).then(res => res.json()).then(data => {
        if (data.features) L.geoJson(data, { style: { fillColor: "#0084FF", weight: 0, fillOpacity: 0.35 } }).addTo(map);
    });

    // C. ⭐ MARINA STAR & LABEL (Always on Top)
    var redStarIcon = L.divIcon({
        className: 'marina-star-icon',
        html: '<i class="fa-solid fa-star fa-lg" style="color: red; opacity: 0.9; text-shadow: 0 0 5px white;"></i>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
    L.marker(MARINA_COORDS, { icon: redStarIcon, zIndexOffset: 2000 }).addTo(map);

    var textLabelIcon = L.divIcon({
        className: 'marina-text-label',
        html: '<span style="color: white; font-weight: bold; font-size: 11px; text-shadow: 1px 1px 3px rgba(0,0,0,0.8);">Port O Bistineau</span>',
        iconSize: [120, 20],
        iconAnchor: [-5, 10]
    });
    L.marker(MARINA_COORDS, { icon: textLabelIcon, zIndexOffset: 2001 }).addTo(map);

    // D. Start the Engine
    refreshRadarBuffer(); 
}

// --- 3. THE RAINVIEWER ENGINE (Updated 2026) ---
async function refreshRadarBuffer() {
    const CACHE_KEY = 'radar_json_cache';
    const CACHE_TIME = 10 * 60 * 1000; // 10 minutes
    const now = Date.now();
    
    let data;
    const cached = localStorage.getItem(CACHE_KEY);
    const cacheTs = localStorage.getItem(CACHE_KEY + '_ts');

    if (cached && cacheTs && (now - cacheTs < CACHE_TIME)) {
        // Use the saved data instead of hitting the API
        data = JSON.parse(cached);
    } else {
        // Only fetch if the cache is old or missing
        const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
        data = await response.json();
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        localStorage.setItem(CACHE_KEY + '_ts', now);
    }
    
    const host = data.host;
    const timestamps = data.radar.past; // Specifically grab the 'past' array

        // Clear existing buffer and layers
        if (window.radarBuffer) {
            window.radarBuffer.forEach(layer => window.radarMapInstance.removeLayer(layer));
        }
        window.radarBuffer = [];

        // Build the new buffer (Last 12 frames)
        timestamps.slice(-12).forEach((frame) => {
            const ts = frame.time;
            // Palette 2 is high-contrast; '1_1' = smoothed + snow display
            const layer = L.tileLayer(`${host}${frame.path}/512/{z}/{x}/{y}/2/1_1.png`, {
                opacity: 0,
                zIndex: 40,
                attribution: 'RainViewer'
            });
            
            const dateObj = new Date(ts * 1000);
            layer.timestampLabel = dateObj.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            
            layer.addTo(window.radarMapInstance);
            window.radarBuffer.push(layer);
        });

        // Show the latest frame
        window.currentFrameIndex = window.radarBuffer.length - 1;
        updateRadarDisplay();
        
        // Auto-start animation if it's not already running
        if (!window.radarAnimationTimer) {
            startAnimationLoop();
        }           

   // } catch (err) {
   //     console.error("RainViewer Radar Error:", err);
   // }
}

// --- 4. DISPLAY & ANIMATION CONTROLS ---
function updateRadarDisplay() {
    if (!window.radarBuffer || window.radarBuffer.length === 0) return;
    
    // Smooth transition: get reference to old layer before changing index
    const oldLayer = window.radarBuffer.find(l => l.options.opacity > 0);
    const newLayer = window.radarBuffer[window.currentFrameIndex];

    if (newLayer) {
        newLayer.setOpacity(0.8);
        if (oldLayer && oldLayer !== newLayer) {
            oldLayer.setOpacity(0);
        }
        
        const timeLabel = document.getElementById('radar-time');
        if (timeLabel) timeLabel.textContent = newLayer.timestampLabel;
    }
}

function startAnimationLoop() {
    if (window.radarAnimationTimer) clearInterval(window.radarAnimationTimer);
    
    // Default to 500ms if select is missing
    const speed = parseInt(document.getElementById('radar-speed-select')?.value || 500);
    
    window.radarAnimationTimer = setInterval(() => {
        if (window.radarBuffer.length > 1) {
            window.currentFrameIndex = (window.currentFrameIndex + 1) % window.radarBuffer.length;
            updateRadarDisplay();
        }
    }, speed);
    
    const btn = document.getElementById('radar-play-pause');
    if (btn) btn.innerHTML = '▮▮';
}

function toggleAnimation() {
    if (window.radarAnimationTimer) {
        clearInterval(window.radarAnimationTimer);
        window.radarAnimationTimer = null;
        const btn = document.getElementById('radar-play-pause');
        if (btn) btn.innerHTML = '►';
    } else {
        startAnimationLoop();
    }
}

function scrubFrame(direction) {
    if (window.radarAnimationTimer) toggleAnimation();
    if (window.radarBuffer.length > 0) {
        const total = window.radarBuffer.length;
        window.currentFrameIndex = (window.currentFrameIndex + direction + total) % total;
        updateRadarDisplay();
    }
}

function changeSpeed() {
    if (window.radarAnimationTimer) startAnimationLoop();
}

// --- 5. THE AUTO-REFRESH TIMER ---
// Grabs the freshest 12 frames every 5 minutes
setInterval(() => {
    if (window.radarMapInstance) {
        refreshRadarBuffer();
    }
}, 300000);


// --- POPUP DETAIL FUNCTION (FINAL WITH INCREASED ICON SPACING) ---
// MUST be a window function because it is called directly from the onclick attribute in the HTML string
window.showDetail = function(dayIndex) {
    const data = window.lastWeatherData;
    if (!data) return;
    
    const startOfDay = new Date();
    startOfDay.setHours(0,0,0,0); 
    startOfDay.setDate(startOfDay.getDate() + dayIndex);
    
    const endOfDay = new Date(startOfDay); 
    endOfDay.setHours(23,59,59,999);
    
    const periods = data.hourly.periods.filter(p => {
        const t = new Date(p.startTime);
        return t >= startOfDay && t <= endOfDay;
    });
    
    // detailHTML now begins directly with the date header and the scroll container.
    let detailHTML = `<h3 style="margin-top:0;text-align:center;">${startOfDay.toLocaleDateString('en-US',{weekday:'long', month:'long', day:'numeric'})}</h3><div style="max-height:60vh;overflow-y:auto;">`;
    
    periods.forEach(p => {
      const time = new Date(p.startTime).toLocaleTimeString('en-US', {hour:'numeric'});
      const temp = p.temperature;
      const windStr = p.windSpeed.replace(' mph','');
      const dir = p.windDirection;
      // Use the probabilityOfPrecipitation.value, defaulting to 0 if null
      const pop = p.probabilityOfPrecipitation?.value || 0; 
      
      detailHTML += `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px;border-bottom:1px solid #eee;font-size:14px;">
          
          <div style="width:50px;">${time}</div>
          
          <img src="${p.icon.replace('large','small')}" width="30" height="30" style="vertical-align:middle; margin-right: 12px;">
          
          <div style="width:118px;text-align:left;">${p.shortForecast}</div> 
          
          <div style="font-weight:bold;width:50px;text-align:right;">${temp}°F</div>
          <div style="width:50px;text-align:right;">${windStr} ${dir}</div>
          <div style="width:50px;text-align:right;">${pop}%</div>
          
        </div>`;
    });
    
    detailHTML += '</div>';

    // Show the popup (using your existing closing logic for consistency)
    document.getElementById('dayDetail').innerHTML = detailHTML;
    document.getElementById('overlay').style.display = 'block';
    document.getElementById('dayDetail').style.display = 'block';

    // --- AUTO-REFRESH RADAR EVERY 10 MINUTES ---
setInterval(() => {
    console.log("Auto-refreshing radar data...");
    initRadarWidget();
}, 600000); // 600,000ms = 10 minutes
};
