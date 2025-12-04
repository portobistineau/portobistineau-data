// scripts/solunar.js (Final Content - All JS from your inline block)

/* --- UTILITY: TIME FORMATTER --- */
function formatLocalTime(dateObj) {
    if (!dateObj) return '—';
    var d = (typeof dateObj === 'string') ? new Date(dateObj) : dateObj;
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

/* --- NASA MOON IMAGE FETCH FROM LOCAL JSON (LOCAL DATE FIX) --- */
function fetchMoonImageFromLocalJson(date) {
    const moonImage = document.getElementById('moon-img');
    
    // CRITICAL FIX: Construct the key using LOCAL date components
    const year = date.getFullYear();
    // Month is 0-indexed, so we add 1 and pad with 0
    const month = String(date.getMonth() + 1).padStart(2, '0');
    // Day is padded with 0
    const day = String(date.getDate()).padStart(2, '0');
    
    // The key should now accurately reflect YYYY-MM-DD local time (e.g., "2025-11-20")
    const todayKey = `${year}-${month}-${day}`; 
    
    if (!moonImage) return;

    // Fetch the local JSON file
    fetch('moon_urls.json?t=' + new Date().getTime()) 
        .then(response => {
            if (!response.ok) throw new Error("Could not fetch moon_urls.json.");
            return response.json();
        })
        .then(data => {
            const nasaUrl = data[todayKey];
            
            if (nasaUrl) {
                // 3. Set the image source directly 
                moonImage.src = nasaUrl;
            } else {
                console.error(`Moon URL not found in JSON for date: ${todayKey}. Data not generated yet.`);
            }
        })
        .catch(error => {
            console.error("Error loading Moon image from local JSON:", error);
        });
}
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        var lat = 32.4619;
        var lng = -93.3486;
        var now = new Date();
        var todayKey = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 10);

        /* 1. HEADERS & NASA IMAGE */
        document.getElementById('header-date').textContent = now.toLocaleDateString('en-US',{month:'long',day:'numeric'});
        document.getElementById('header-year').textContent = now.getFullYear();
        document.getElementById('date').textContent = now.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
        
        fetchMoonImageFromLocalJson(now);

        /* 2. SUN DATA (SUNCALC) */
        if (typeof SunCalc !== 'undefined') {
            var times = SunCalc.getTimes(now, lat, lng);
            if(document.getElementById('first')) document.getElementById('first').textContent = formatLocalTime(times.dawn);
            if(document.getElementById('rise')) document.getElementById('rise').textContent  = formatLocalTime(times.sunrise);
            if(document.getElementById('set')) document.getElementById('set').textContent   = formatLocalTime(times.sunset);
            if(document.getElementById('last')) document.getElementById('last').textContent  = formatLocalTime(times.dusk);
        } else {
            console.error("SunCalc library failed to load.");
        }

        /* 3. SOLUNAR DATA (JSON) */
        var timestamp = new Date().getTime();
        fetch(`/solunar_data.json?t=${timestamp}`)
            .then(function(res) {
                if (!res.ok) throw new Error("Could not fetch solunar data.");
                return res.json();
            })
            .then(function(fullData) {
                var dayData = fullData[todayKey];
                if (!dayData) throw new Error("Data missing for today.");
                
                /* Moon Times */
                if(document.getElementById('moon-rise')) document.getElementById('moon-rise').textContent = formatLocalTime(dayData.moon_rise_utc);
                if(document.getElementById('moon-set')) document.getElementById('moon-set').textContent = formatLocalTime(dayData.moon_set_utc);
                if(document.getElementById('moon-overhead')) document.getElementById('moon-overhead').textContent = formatLocalTime(dayData.moon_overhead_utc);
                if(document.getElementById('moon-underfoot')) document.getElementById('moon-underfoot').textContent = formatLocalTime(dayData.moon_underfoot_utc);

                /* Periods */
                function mkRange(center, minutes) {
                    if (!center) return '—';
                    var c = new Date(center);
                    var s = new Date(c.getTime() - minutes*60000);
                    var e = new Date(c.getTime() + minutes*60000);
                    return `${formatLocalTime(s)}–${formatLocalTime(e)}`;
                }

                if(document.getElementById('maj1')) document.getElementById('maj1').textContent = mkRange(dayData.major_1_utc, 60);
                if(document.getElementById('maj2')) document.getElementById('maj2').textContent = mkRange(dayData.major_2_utc, 60);
                if(document.getElementById('min1')) document.getElementById('min1').textContent = mkRange(dayData.minor_1_utc, 30);
                if(document.getElementById('min2')) document.getElementById('min2').textContent = dayData.minor_2_utc ? mkRange(dayData.minor_2_utc, 30) : '—';

                /* Rating */
                var illum = dayData.moon_illum;
                var score = 1;
                if (illum >= 99 || illum <= 1) score = 4;
                else if (illum >= 95 || illum <= 5) score = 3;
                else if (illum >= 90 || illum <= 10) score = 2;

                var labels = ['Average', 'Good', 'Better', 'Best'];
                var stars = '★'.repeat(score);

                if(document.getElementById('rating')) {
                    document.getElementById('rating').innerHTML = `
                        <div style="font-size:36px;color:#ffffff;">${stars}</div>
                        <div style="font-size:24px;color:#ffffff;">${labels[score-1]}</div>
                    `;
                }

               /* Phase Logic (FINAL REVISION) */
var illum = dayData.moon_illum; 
var actualIllum = Math.round(illum); 
var phaseName = '—';
var isWaxing = dayData.moon_age < 14.7; 

// 1. Check for the definitive primary phases first (Full, New, Quarter)
if (illum >= 99.5) { // Full Moon Check (e.g., 99.5% to 100.0%)
    phaseName = 'Full Moon';
} else if (illum <= 0.4) { // New Moon Check (e.g., 0.0% to 0.4%)
    phaseName = 'New Moon';
} else if (actualIllum === 50) { // Quarter Moon Check (exactly 50%)
    phaseName = isWaxing ? 'First Quarter' : 'Last Quarter';
} 
// 2. Only if none of the primary phases matched, use the intermediate Gibbous/Crescent logic
else {
    if (isWaxing) {
        // Waxing Gibbous: growing and > 50%
        // Waxing Crescent: growing and < 50%
        phaseName = (actualIllum > 50) ? 'Waxing Gibbous' : 'Waxing Crescent';
    } else {
        // Waning Gibbous: shrinking and > 50%
        // Waning Crescent: shrinking and < 50%
        phaseName = (actualIllum > 50) ? 'Waning Gibbous' : 'Waning Crescent';
    }
}

                if(document.getElementById('phase')) document.getElementById('phase').textContent = phaseName;
                if(document.getElementById('illum')) document.getElementById('illum').textContent = actualIllum + '% Illuminated';
            })
            .catch(function(e) { console.error("Error:", e); });
    }, 500);
});
