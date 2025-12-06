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
    // NOTE: Caching mechanisms should ideally be implemented here, but for simplicity, 
    // we rely on fresh fetches. The NWS service is generally reliable.
    localStorage.removeItem('nwsCache'); 
    
    // Coordinates for Port O' Bistineau (used for NWS and Map center)
    const lat = 32.4066, lon = -93.3906;
    const now = new Date();
    
    // Only show "Fetching" if this is the initial load, otherwise, wait for render
    if(!document.getElementById('radar-map')) {
        document.getElementById('bistineauWeather').innerHTML = '<div style="padding:20px;text-align:center;font-size:18px;color:#003366;">Fetching fresh NWS data...</div>';
    }
    
    let grid;
    
    // --- 1. Fetch Grid Points (Handles initial NWS connection failure) ---
    try {
      const pointRes = await fetch(`https://api.weather.gov/points/${lat},${lon}`, {
        // MANDATORY: User-Agent header for NWS API compliance
        headers: { 'User-Agent': 'PortOBistineauWeather/1.0 (portobistineau@gmail.com)' }
      });
      
      if (!pointRes.ok) {
          throw new Error(`NWS Points API returned status: ${pointRes.status}`);
      }
      
      const point = await pointRes.json();
      grid = point.properties;
      
    } catch(e) {
      console.error("Error fetching NWS points:", e);
      document.getElementById('bistineauWeather').innerHTML = '<div style="padding:20px;color:red;text-align:center;">NWS API failed to respond. Please try again later.</div>';
      return;
    }
    
    // --- 2. Fetch All Data (Comprehensive Try/Catch for all subsequent failures) ---
    try {
        // Corrected Fetching: Use await response.json() AFTER checking response.ok
        const stationsRes = await fetch(grid.observationStations);
        const dailyRes = await fetch(grid.forecast);
        const hourlyRes = await fetch(grid.forecastHourly);
        
        if (!stationsRes.ok || !dailyRes.ok || !hourlyRes.ok) {
             throw new Error("One or more NWS forecast/station endpoints returned an error.");
        }

        const [stations, daily, hourly] = await Promise.all([
             stationsRes.json(),
             dailyRes.json(),
             hourlyRes.json()
        ]);
        
        // Fetch latest observation from the first station
        const stationUrl = stations.observationStations[0];
        const obsRes = await fetch(`${stationUrl}/observations/latest?require_qc=false`);
        if (!obsRes.ok) {
             throw new Error("NWS observation fetch failed.");
        }
        const obs = await obsRes.json();

        const data = {
          grid,
          obs: obs.properties,
          daily: daily.properties,
          hourly: hourly.properties
        };
        
        window.lastWeatherData = data;
        
        // --- RENDER CURRENT ---
        const p = data.obs;
        // Convert C to F
        const currentTemp = Math.round(p.temperature.value * 1.8 + 32); 
        const feels = Math.round(p.apparentTemperature?.value * 1.8 + 32) || currentTemp;
        const pressure = (p.barometricPressure.value / 3386.39).toFixed(2);
        
        let trend = '';
        const change = p.pressureChange?.value;
        if (change !== null && change !== undefined) {
          const inches = change / 3386.39;
          if (Math.abs(inches) < 0.02) trend = '(steady)';
          else if (inches > 0) trend = '(rising)';
          else trend = '(falling)';
        }
        
        const timeStr = new Date(p.timestamp).toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'});
        const nowDate = now.getTime();
        
        // Find the closest hourly forecast for the icon and short forecast
        const closestHourly = data.hourly.periods.reduce((a,b) =>
          Math.abs(new Date(b.startTime) - nowDate) < Math.abs(new Date(a.startTime) - nowDate) ? b : a
        );
        
        const currentIcon = closestHourly?.icon?.replace('large','medium') || '';
        const currentForecast = closestHourly?.shortForecast || '';
        
        let windSpeedAvg = 0;
        if (closestHourly?.windSpeed) {
          const nums = closestHourly.windSpeed.match(/\d+/g)?.map(Number) || [];
          if (nums.length === 1) windSpeedAvg = nums[0];
          else if (nums.length === 2) windSpeedAvg = Math.round((nums[0] + nums[1]) / 2);
        }
        const windDir = closestHourly?.windDirection || '';
        
        // --- HTML GENERATION (CURRENT WEATHER) ---
        const currentHTML = `
          <div style="background:#fff;padding:15px;border-radius:12px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.1);height:100%;">
            <div style="font-size:28px;font-weight:bold;color:#003366;">${currentTemp}°F</div>
            <div style="margin:8px 0;">
              <img src="${currentIcon}" width="85" height="85" style="vertical-align:middle;margin:0 auto;display:block;">
              <div style="font-size:14px;color:#666;margin-top:4px;">${currentForecast}</div>
            </div>
            <div style="color:#666;margin-bottom:8px;">Feels ${feels}°F • As of ${timeStr}</div>
            <div style="font-size:14px;line-height:1.6;">
              Wind ${windSpeedAvg} mph ${windDir}<br>
              Pressure ${pressure} inHg ${trend}<br>
              Humidity ${p.relativeHumidity?.value !== null && p.relativeHumidity?.value !== undefined ? Math.round(p.relativeHumidity.value) : '—'}%<br>
              Dew Point ${p.dewpoint?.value !== null && p.dewpoint?.value !== undefined ? Math.round(p.dewpoint.value * 1.8 + 32) : '—'}°F<br>
            </div>
          </div>`;

        // --- RADAR HTML WITH COMPACT LEGEND AND BOTTOM CONTROLS ---
        const radarHTML = `
            <div id="radar-widget-wrapper" style="border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);height: 400px; position: relative;">
                
                <div id="radar-legend" style="position:absolute; top:8px; left:8px; z-index:900; background:rgba(255,255,255,0.8); padding:5px; border-radius:6px; display:flex; gap:10px; font-family:Arial, sans-serif;">
                    <div class="legend-bar-wrapper" style="display:flex; align-items:center; font-size:10px;">
                        <div class="legend-label" style="font-weight:bold; color:#333;">RAIN</div>
                        <div class="gradient-bar rain-gradient" style="width:30px; height:6px; background:linear-gradient(to right, #00A632, #68B41D, #FFCC00, #FF6600, #FF0000); margin-left:4px; border-radius:3px;"></div>
                    </div>
                    <div class="legend-bar-wrapper" style="display:flex; align-items:center; font-size:10px;">
                        <div class="legend-label" style="font-weight:bold; color:#333;">ICE</div>
                        <div class="gradient-bar ice-gradient" style="width:30px; height:6px; background:linear-gradient(to right, #0099FF, #33CCFF, #99CCFF); margin-left:4px; border-radius:3px;"></div>
                    </div>
                    <div class="legend-bar-wrapper" style="display:flex; align-items:center; font-size:10px;">
                        <div class="legend-label" style="font-weight:bold; color:#333;">SNOW</div>
                        <div class="gradient-bar snow-gradient" style="width:30px; height:6px; background:linear-gradient(to right, #E0FFFF, #ADD8E6, #87CEEB, #4682B4); margin-left:4px; border-radius:3px;"></div>
                    </div>
                </div>

                <div id="radar-container" style="width:100%; height:100%; position:relative;">
                    <div id="radar-map" style="width:100%; height:100%; background: #000;"></div>
                    
                    <div style="position:absolute; bottom:5px; right:5px; background:rgba(0,0,0,0.7); color:white; padding:4px 10px; border-radius:4px; font-family:Arial; font-size:12px; z-index:950; pointer-events:none;">
                        <span id="radar-status" style="font-weight:bold; color:#00ff00;">LIVE</span> 
                        <span id="radar-time">Loading...</span>
                    </div>
                    <div style="position:absolute; bottom:35px; left:5px; font-family:Arial; font-size:10px; color:rgba(255,255,255,0.7); z-index:900; pointer-events:none; text-shadow:1px 1px 2px black;">
                        Data: RainViewer / Esri
                    </div>
                </div>

                <div id="radar-controls" style="position:absolute; bottom:8px; left:50%; transform:translateX(-50%); z-index:900; display:flex; gap:10px;">
                    <button id="radar-rewind" title="Previous Frame" style="background:rgba(0,0,0,0.7); color:white; border:none; border-radius:4px; padding:6px 12px; cursor:pointer; font-weight:bold;"><<</button>
                    <button id="radar-play-pause" title="Pause/Play" style="background:rgba(0,0,0,0.7); color:white; border:none; border-radius:4px; padding:6px 12px; cursor:pointer; font-weight:bold;">▮▮</button>
                    <button id="radar-forward" title="Next Frame" style="background:rgba(0,0,0,0.7); color:white; border:none; border-radius:4px; padding:6px 12px; cursor:pointer; font-weight:bold;">>>
                    </button>
                    
                    <select id="radar-speed-select" title="Animation Speed" style="background:rgba(0,0,0,0.7); color:white; border:none; border-radius:4px; padding:6px 8px; cursor:pointer; font-size:14px;">
                        <option value="1200">Slow</option>
                        <option value="800">Medium</option>
                        <option value="400" selected>Fast</option>
                    </select>
                </div>

            </div>
        `;

        // --- HTML GENERATION (7-DAY FORECAST) ---
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
          
          // Calculate Hi/Lo from hourly data for more accuracy
          const hi = dayHours.length ? Math.max(...dayHours.map(p=>p.temperature)) : day.temperature;
          const lo = dayHours.length ? Math.min(...dayHours.map(p=>p.temperature)) : night.temperature;
          
          forecastHTML += `
            <div onclick="showDetail(${i})" style="cursor:pointer;width:100px;height:170px;background:#fff;padding:8px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.1);text-align:center;display:flex;flex-direction:column;justify-content:space-between;transition:transform 0.1s;font-family:'Inter', sans-serif;" onmouseover="this.style.transform='translateY(-3px)'" onmouseout="this.style.transform='translateY(0)'">
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
        
        // --- TOP SECTION (Combines Current Weather and New Radar Widget) ---
        const topSection = `
            <div style="display:flex; flex-wrap:wrap; gap:20px; justify-content:center; align-items:flex-start;">
                
                <div style="flex: 1 1 300px; max-width: 400px;">
                    ${currentHTML}
                </div>
                
                <div style="flex: 0 0 400px; max-width: 100%;">
                    ${radarHTML}
                </div>
            </div>
        `;

        document.getElementById('bistineauWeather').innerHTML = topSection + forecastHTML;

        // --- Initialize Leaflet Map and Radar ---
        initRadarWidget();
        
    } catch(e) {
        // GLOBAL CATCH for all processing and data parsing errors
        console.error("NWS Data Processing/Rendering Error:", e);
        document.getElementById('bistineauWeather').innerHTML = '<div style="padding:20px;color:red;text-align:center;">Error processing weather data. Details logged to console.</div>';
        return;
    }
 }

 // --- RADAR INITIALIZATION (UPDATED) ---
function initRadarWidget() {
    if (window.radarMapInstance) {
        window.radarMapInstance.remove();
        window.radarMapInstance = null;
    }
    if (window.radarAnimationTimer) {
        clearInterval(window.radarAnimationTimer);
        window.radarAnimationTimer = null;
    }
    window.currentFrameIndex = 0; // Reset index on new init

    var centerLat = 32.42; 
    var centerLng = -93.40;
    // FINAL ZOOM: Fractional Zoom 9.5
    var zoomLevel = 9.5; 

    var map = L.map('radar-map', {
        center: [centerLat, centerLng],
        zoom: zoomLevel,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false, 
        dragging: !L.Browser.mobile,
        zoomSnap: 0.1 
    });
    window.radarMapInstance = map;

    // 1. Base Satellite Layer (z-index 0)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        zIndex: 0
    }).addTo(map);

    // 2. FINAL, CORRECT DOTD NHD GeoJSON Layer (z-index 40)
    const dotdGeoJsonUrl = "https://maps.dotd.la.gov/topo/rest/services/OpenData/NHD/FeatureServer/3/query?where=GNIS_Name%3D'Lake%20Bistineau'&outFields=*&f=geojson&returnGeometry=true";
    
    const lakeStyle = {
        fillColor: "#0084FF", 
        weight: 0,           
        fillOpacity: 0.35    
    };

    fetch(dotdGeoJsonUrl)
      .then(response => {
          if (!response.ok) {
              throw new Error(`Failed to fetch DOTD NHD data: ${response.status}`);
          }
          return response.json();
      })
      .then(data => {
          if (data.features && data.features.length > 0) {
              L.geoJson(data, {
                  style: lakeStyle
              }).addTo(map);
          } else {
              console.warn('Lake Bistineau GeoJSON data not found in DOTD NHD layer.');
          }
      })
      .catch(error => console.error('Error loading DOTD NHD GeoJSON data:', error));


    // 3. Reference Overlay (Roads/Labels) (z-index 50) - Remains on top
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        zIndex: 50
    }).addTo(map);

    // --- FINAL MARINA MARKER AND LABEL ---
    
    var marinaLat = 32.4619;
    var marinaLng = -93.34883;

    // 1. STAR ICON MARKER
    var redStarIcon = L.divIcon({
        className: 'marina-star-icon', 
        html: '<i class="fa-solid fa-star fa-lg" style="color: red; opacity: 0.9;"></i>',
        iconSize: [20, 20], 
        iconAnchor: [10, 10]
    });

    L.marker([marinaLat, marinaLng], { icon: redStarIcon }).addTo(map);


    // 2. TEXT LABEL MARKER
    var textLabelIcon = L.divIcon({
        className: 'marina-text-label', 
        html: '<span style="color: white; font-weight: bold; font-size: 10px; text-shadow: 1px 1px 3px rgba(0,0,0,0.8);">Port O Bistineau</span>',
        iconSize: [120, 20], 
        iconAnchor: [0, 10] 
    });
    
    var labelLat = marinaLat + 0.01;
    var labelLng = marinaLng - 0.01;

    L.marker([labelLat, labelLng], { icon: textLabelIcon }).addTo(map);

    // ------------------------------------
    
    // --- NEW: CONTROL EVENT LISTENERS ---
    const controlsExist = document.getElementById('radar-play-pause');
    if (controlsExist) {
        document.getElementById('radar-play-pause').onclick = toggleAnimation;
        document.getElementById('radar-rewind').onclick = function() { scrubFrame(-1); };
        document.getElementById('radar-forward').onclick = function() { scrubFrame(1); };
        document.getElementById('radar-speed-select').onchange = changeSpeed;
    }

    // --- Fetch RainViewer Data ---
    fetch('https://api.rainviewer.com/public/weather-maps.json')
        .then(res => res.json())
        .then(data => {
            processRadarFrames(map, data);
        })
        .catch(e => {
            console.error("RainViewer Radar Error:", e);
            // Update status text on the radar widget itself
            const statusElement = document.getElementById('radar-status');
            if (statusElement) {
                statusElement.textContent = 'Error';
                statusElement.style.color = '#ff4444';
            }
        });
}
 function processRadarFrames(map, apiData) {
    window.radarLayers = [];
    // Set the global variable
    var past = apiData.radar.past || [];
    var future = apiData.radar.nowcast || [];
    var maxPastFrames = 24; 
    var pastSlice = past.slice(-maxPastFrames); 
    
    var futureSlice = future.slice(0, 12); 
    
    var frames = pastSlice.concat(futureSlice);
    frames.forEach(function(frameObj, index) {
        var layer = L.tileLayer(apiData.host + frameObj.path + '/256/{z}/{x}/{y}/2/1_1.png', {
            opacity: 0,
            zIndex: 100 
        });
        layer.isFuture = (index >= pastSlice.length); 
        layer.timestamp = frameObj.time;
        layer.addTo(map);
        window.radarLayers.push(layer); // Populate the global array
    });
    // Start immediately after loading
    startAnimationLoop(); 
 }

// ------------------------------------
// --- NEW CONTROL FUNCTIONS ---
// ------------------------------------

function formatTime(ts) {
    var d = new Date(ts * 1000);
    return d.toLocaleTimeString('en-US', {hour: 'numeric', minute:'2-digit'});
}

function updateRadarDisplay() {
    if (window.radarLayers.length === 0) return;
    // Fade out previous frame
    const prevIndex = (window.currentFrameIndex - 1 + window.radarLayers.length) % window.radarLayers.length;
    window.radarLayers[prevIndex].setOpacity(0);
    // Display current frame
    const currentLayer = window.radarLayers[window.currentFrameIndex];
    currentLayer.setOpacity(0.7);
    // Update time/status label
    const timeLabel = document.getElementById('radar-time');
    const statusLabel = document.getElementById('radar-status');
    if (timeLabel && statusLabel) { 
        timeLabel.textContent = formatTime(currentLayer.timestamp);
        statusLabel.textContent = currentLayer.isFuture ?
    "FUTURE" : "PAST";
        statusLabel.style.color = currentLayer.isFuture ? "#00ccff" : "#00ff00";
    }
}

function startAnimationLoop() {
    if (window.radarLayers.length === 0) return;
    // Get speed from the select box, default to 400ms (fast)
    const speedSelect = document.getElementById('radar-speed-select');
    const interval = speedSelect ? parseInt(speedSelect.value) : 400;

    // Clear any existing timer
    if (window.radarAnimationTimer) clearInterval(window.radarAnimationTimer);
    // Start the new timer
    window.radarAnimationTimer = setInterval(function() {
        // Increment frame index
        window.currentFrameIndex = (window.currentFrameIndex + 1) % window.radarLayers.length;
        updateRadarDisplay();
    }, interval);
    //
