// scripts/solunar.js (Final Content)

/* --- CONFIGURATION --- */
const TIME_ZONE = 'America/Chicago'; 

/* --- UTILITY: TIME FORMATTER --- */
function formatLocalTime(dateObj) {
    // This function formats simple times (Moon Rise, Major/Minor, etc.)
    if (!dateObj) return '—';
    var d = (typeof dateObj === 'string') ? new Date(dateObj) : dateObj;
    if (isNaN(d.getTime())) return '—';
    
    // Ensure the timezone is explicitly handled for consistent display
    return d.toLocaleTimeString('en-US', {
        timeZone: TIME_ZONE,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

/**
 * Helper to check if a date string is valid and not empty.
 * @param {string | null} dtString - The ISO date string.
 * @returns {boolean} True if the string is valid and non-null.
 */
function isValidDate(dtString) {
    return dtString && dtString.length > 0;
}

/**
 * NEW: Formats the Major Phase Moment string with correct tense, date, and time.
 * @param {string | null} dtString - The UTC date string of the phase moment.
 * @param {string | null} phaseType - The type of moon phase (e.g., "Full Moon").
 * @returns {string} The formatted sentence or an empty string.
 */
function formatPhaseTime(dtString, phaseType) {
    if (!isValidDate(dtString) || !phaseType) {
        return '';
    }
    
    try {
        const momentUtc = new Date(dtString);
        const now = new Date();
        
        // 1. Determine the verb: Past or Future?
        const isFuture = momentUtc > now;
        const verb = isFuture ? 'will reach' : 'reached';

        // 2. Format Time (HH:MM AM/PM CST)
        const timeStr = momentUtc.toLocaleTimeString('en-US', {
            timeZone: TIME_ZONE,
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        // 3. Format Date (Month Day, Year CST)
        const dateStr = momentUtc.toLocaleDateString('en-US', {
            timeZone: TIME_ZONE,
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });

        // 4. Extract the timezone abbreviation (e.g., CST or CDT)
        const zoneStr = momentUtc.toLocaleTimeString('en-US', {
            timeZone: TIME_ZONE,
            timeZoneName: 'short'
        }).split(' ').pop(); 

        // 5. Assemble the sentence
        return `The moon ${verb} ${phaseType} at precisely ${timeStr} ${zoneStr} on ${dateStr}.`;

    } catch (e) {
        console.error("Error formatting phase moment:", e);
        return '';
    }
}


/* --- NASA MOON IMAGE FETCH FROM LOCAL JSON (LOCAL DATE FIX) --- */
function fetchMoonImageFromLocalJson(date) {
    const moonImage = document.getElementById('moon-img');
    
    // CRITICAL FIX: Construct the key using LOCAL date components (YYYY-MM-DD)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
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
        
        // --- KEY GENERATION FIX (Ensuring YYYY-MM-DD for JSON lookup) ---
        // Get date components in local time
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayKey = `${year}-${month}-${day}`; 
        
        // Calculate yesterday's key for phase moment lookup
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const yYear = yesterday.getFullYear();
        const yMonth = String(yesterday.getMonth() + 1).padStart(2, '0');
        const yDay = String(yesterday.getDate()).padStart(2, '0');
        const yesterdayKey = `${yYear}-${yMonth}-${yDay}`;
        // -----------------------------------------------------------------


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
                
                // --- Phase Moment Lookup Logic (Today OR Yesterday) ---
                var phaseMomentUtc = null;
                var phaseMomentType = null;

                // A. Check Today's Data
                var dayData = fullData[todayKey];
                if (dayData) {
                    phaseMomentUtc = dayData.phase_moment_utc;
                    phaseMomentType = dayData.phase_moment_type;
                }

                // B. If today has no moment, check Yesterday's Data
                // Use isValidDate() for reliable check
                if (!isValidDate(phaseMomentUtc) && fullData[yesterdayKey]) {
                    var yesterdayData = fullData[yesterdayKey];
                    if (isValidDate(yesterdayData.phase_moment_utc)) {
                        phaseMomentUtc = yesterdayData.phase_moment_utc;
                        phaseMomentType = yesterdayData.phase_moment_type;
                    }
                }

                // C. Set the Phase Moment Text
                if (document.getElementById('phase-moment-text')) {
                    document.getElementById('phase-moment-text').textContent = formatPhaseTime(phaseMomentUtc, phaseMomentType);
                }
                // -----------------------------------------------------

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

               /* Phase Logic (FINAL, ROBUST VERSION - Uses Moment Type or Calculation) */
                var illum = dayData.moon_illum; 
                var actualIllum = Math.round(illum); 
                var moonAge = dayData.moon_age; 
                var phaseName = '—';
                
                // 1. CHECK FOR MOMENT TYPE (Highest Priority)
                var momentPhaseName = dayData.phase_moment_type;

                if (momentPhaseName) {
                    // If the Python script recorded a moment (Full Moon, New Moon, etc.) for today, use it.
                    phaseName = momentPhaseName;
                } else {
                    // 2. FALLBACK TO CALCULATION (If no major moment occurs today)
                    var isWaxing = moonAge < 14.7;

                    // --- FULL MOON (TIGHT AGE CONSTRAINT - only necessary if moment_type fails) ---
                    if (illum >= 98.5 && moonAge >= 14.2 && moonAge < 15.2) { 
                        phaseName = 'Full Moon';
                    } 

                    // --- NEW MOON (Illumination based) ---
                    else if (illum <= 1.5) { 
                        phaseName = 'New Moon';
                    }

                    // --- QUARTER MOONS ---
                    else if (actualIllum === 50) { 
                        phaseName = isWaxing ? 'First Quarter' : 'Last Quarter';
                    } 

                    // --- INTERMEDIATE PHASES (Gibbous/Crescent) ---
                    else {
                        if (isWaxing) { // Moon Age < 14.7 days
                            phaseName = (actualIllum > 50) ? 'Waxing Gibbous' : 'Waxing Crescent';
                        } else { // Moon Age >= 14.7 days (Waning)
                            phaseName = (actualIllum > 50) ? 'Waning Gibbous' : 'Waning Crescent'; 
                        }
                    }
                }

                if(document.getElementById('phase')) document.getElementById('phase').textContent = phaseName;
                if(document.getElementById('illum')) document.getElementById('illum').textContent = actualIllum + '% Illuminated';
            })
            .catch(function(e) { 
                console.error("Error fetching solunar data:", e);
                if(document.getElementById('phase')) document.getElementById('phase').textContent = 'Error loading data';
                if(document.getElementById('illum')) document.getElementById('illum').textContent = 'Check console for details';
            });
    }, 500);
});
