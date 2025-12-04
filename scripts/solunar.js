// scripts/solunar.js (Updated with High-Precision and Exact Phase Moment)

/* --- UTILITY: TIME FORMATTER (For solunar times) --- */
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

/* --- NEW UTILITY: PHASE TIME FORMATTER (Includes date and conditional logic) --- */
function formatPhaseTime(utcString, phaseType) {
    // 1. Define the phases that should trigger the display
    const requiredPhases = [
        "New Moon",
        "First Quarter",
        "Full Moon",
        "Last Quarter"
    ];

    // If the phase type is not one of the required ones, return an empty string to hide the element.
    if (!utcString || !requiredPhases.includes(phaseType)) {
        return '';
    }

    try {
        const d = new Date(utcString);
        if (isNaN(d.getTime())) return ''; // Return empty string on invalid date

        // Format: XX:XX AM/PM (Local Time)
        const time = d.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit', 
            hour12: true 
        });

        // Format: MM/DD/YYYY (Local Date)
        const date = d.toLocaleDateString('en-US', { 
            month: 'numeric', 
            day: 'numeric', 
            year: 'numeric' 
        });

        // Construct the final message exactly as requested
        return `The moon reached **${phaseType}** at precisely **${time} on ${date}**.`;
    } catch (e) {
        console.error("Error formatting phase time:", e);
        return ''; // Return empty string on error
    }
}

/* --- NASA MOON IMAGE FETCH FROM LOCAL JSON (LOCAL DATE FIX) --- */
function fetchMoonImageFromLocalJson(date) {
    const moonImage = document.getElementById('moon-img');
    
    // CRITICAL FIX: Construct the key using LOCAL date components
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const todayKey = `${year}-${month}-${day}`;
    
    if (!moonImage) return;

    // Fetch the local JSON file
    fetch('moon_urls.json?t=' + new Date().getTime())
        .then(response => {
            if (!response.ok) throw new new Error("Could not fetch moon_urls.json.");
            return response.json();
        })
        .then(data => {
            const nasaUrl = data[todayKey];
            
            if (nasaUrl) {
                // Set the image source directly 
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
                
                /* Moon Times (Same as before) */
                if(document.getElementById('moon-rise')) document.getElementById('moon-rise').textContent = formatLocalTime(dayData.moon_rise_utc);
                if(document.getElementById('moon-set')) document.getElementById('moon-set').textContent = formatLocalTime(dayData.moon_set_utc);
                if(document.getElementById('moon-overhead')) document.getElementById('moon-overhead').textContent = formatLocalTime(dayData.moon_overhead_utc);
                if(document.getElementById('moon-underfoot')) document.getElementById('moon-underfoot').textContent = formatLocalTime(dayData.moon_underfoot_utc);

                /* Periods (Same as before) */
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

                /* Phase Logic (Updated to use High-Precision Data for display) */
                var illum = dayData.moon_illum;
                var moonAge = dayData.moon_age;
                var actualIllum = Math.round(illum); // Still used for rating/simple phase check

                // --- 1. SET HIGH PRECISION DISPLAY ---
                // Assuming you have an element for displaying the highly precise age and illumination
                if(document.getElementById('moon-age')) document.getElementById('moon-age').textContent = `${moonAge.toFixed(3)} days`;
                if(document.getElementById('moon-illum-precise')) document.getElementById('moon-illum-precise').textContent = `${illum.toFixed(3)}%`;

                /* Rating (Same as before, still based on rounded/simpler illumination checks) */
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

                /* Phase Name Assignment (Robust Logic) */
                var phaseName = '—';
                var isWaxing = moonAge < 14.7;

                // --- 1. FULL MOON ---
                if (illum >= 99.0 && (moonAge >= 13.7 && moonAge <= 15.7)) {
                    phaseName = 'Full Moon';
                } 
                // --- 2. NEW MOON ---
                else if (illum <= 1.0) {
                    phaseName = 'New Moon';
                }
                // --- 3. QUARTER MOONS ---
                else if (actualIllum === 50) { 
                    phaseName = isWaxing ? 'First Quarter' : 'Last Quarter';
                } 
                // --- 4. INTERMEDIATE PHASES ---
                else {
                    if (isWaxing) {
                        phaseName = (actualIllum > 50) ? 'Waxing Gibbous' : 'Waxing Crescent';
                    } else {
                        phaseName = (actualIllum > 50) ? 'Waning Gibbous' : 'Waning Crescent';
                    }
                }

                if(document.getElementById('phase')) document.getElementById('phase').textContent = phaseName;
                if(document.getElementById('illum')) document.getElementById('illum').textContent = actualIllum + '% Illuminated';
                
                // --- NEW FEATURE: EXACT PHASE MOMENT DISPLAY ---
                const phaseMomentUtc = dayData.phase_moment_utc;
                const phaseMomentType = dayData.phase_moment_type;
                
                // Use the correct ID and call the updated function
                if (document.getElementById('phase-moment-text')) { 
                    const phaseText = formatPhaseTime(phaseMomentUtc, phaseMomentType);
                    
                    // Display the text if it's a major/quarter phase, otherwise hide the element
                    document.getElementById('phase-moment-text').innerHTML = phaseText;
                    document.getElementById('phase-moment-text').style.display = phaseText ? 'block' : 'none';
                }
            })
            .catch(function(e) { console.error("Error:", e); });
    }, 500);
});
