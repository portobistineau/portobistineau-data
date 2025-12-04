// --- CONFIGURATION ---
const LATITUDE = 32.4619; // Lake Bistineau, LA
const LONGITUDE = -93.3486;
const TIME_ZONE = 'America/Chicago';
const DATA_URL = 'solunar_data.json';

let solunarData = {}; // Global store for loaded JSON data

/**
 * Helper to check if a date string is valid and not empty.
 * @param {string | null} dtString - The ISO date string (e.g., "2025-12-04T05:01:00Z").
 * @returns {boolean} True if the string is valid and non-null.
 */
function isValidDate(dtString) {
    return dtString && dtString.length > 0;
}

/**
 * Formats a date string (Moon Rise/Set, Major/Minor) into local time (HH:MM AM/PM CST).
 * @param {string | null} dtString - The UTC date string from the JSON.
 * @returns {string} Formatted local time string, or '—'.
 */
function formatTime(dtString) {
    if (!isValidDate(dtString)) {
        return '—';
    }
    try {
        const utcDate = new Date(dtString);
        // Convert to CST date/time string
        return utcDate.toLocaleTimeString('en-US', {
            timeZone: TIME_ZONE,
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    } catch (e) {
        console.error("Error formatting time:", e);
        return '—';
    }
}

/**
 * CRITICAL FUNCTION: Formats the Major Phase Moment string with correct tense.
 * It checks if the phase time has already passed today, and adjusts the text ("will reach" vs "reached").
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
        // Note: momentUtc is in the past if it is less than 'now'.
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


/**
 * Determines the current phase string based on illumination and age.
 * @param {number} illumination - Moon illumination percentage (0-100).
 * @param {number} age - Moon age in days since New Moon (0-29.53).
 * @returns {string} The name of the moon phase.
 */
function determinePhase(illumination, age) {
    const isWaxing = age < 14.765; // Half of the lunar cycle
    const illum = illumination;

    if (illum < 1) return "New Moon";
    
    if (illum < 50) {
        return isWaxing ? "Waxing Crescent" : "Waning Crescent";
    } else if (illum >= 99) {
        return "Full Moon";
    } else if (illum < 99) {
        return isWaxing ? "Waxing Gibbous" : "Waning Gibbous";
    }

    // Default catch-all (should not be reached if logic is perfect)
    if (age <= 7.38) return "Waxing Crescent";
    if (age <= 14.76) return "First Quarter";
    if (age <= 22.14) return "Waxing Gibbous";
    return "Waning Gibbous"; // Approx. Last Quarter/Waning Crescent
}

/**
 * Updates the Solunar/Moon data display.
 */
function updateSolunarDisplay() {
    // Get today's date in the local timezone (CST) and format to YYYY-MM-DD
    const today = new Date();
    const todayKey = today.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TIME_ZONE }).replace(/\//g, '-');
    
    // --- Determine yesterday's key for phase moment lookup ---
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayKey = yesterday.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TIME_ZONE }).replace(/\//g, '-');


    // 1. Get Today's Data
    let data = solunarData[todayKey];
    
    if (!data) {
        document.getElementById('phase').textContent = 'Loading...';
        document.getElementById('illum').textContent = '';
        return;
    }

    // 2. Handle Phase Moment Display Logic (Check Today, then Yesterday)
    let phaseMomentText = '';
    let phaseMomentUtc = data.phase_moment_utc;
    let phaseMomentType = data.phase_moment_type;

    // A. Check today's data first
    if (!isValidDate(phaseMomentUtc) && solunarData[yesterdayKey]) {
        // B. If no moment today, check yesterday's data
        // This is crucial for phases that occur just after midnight local time.
        const yesterdayData = solunarData[yesterdayKey];
        const yesterdayMoment = yesterdayData.phase_moment_utc;
        
        if (isValidDate(yesterdayMoment)) {
             // If yesterday has a phase, use it, as it's the most recent major phase moment
             phaseMomentUtc = yesterdayMoment;
             phaseMomentType = yesterdayData.phase_moment_type;
        }
    }
    
    // Set the phase moment text (uses the new, smaller font class via the HTML)
    document.getElementById('phase-moment-text').textContent = formatPhaseTime(phaseMomentUtc, phaseMomentType);
    

    // 3. Update Moon Image, Phase, and Illumination
    
    // Get Illumination and Moon Age
    const illum = data.moon_illum;
    const moonAge = data.moon_age;

    // Update Phase and Illumination text
    const phaseName = determinePhase(illum, moonAge);
    document.getElementById('phase').textContent = phaseName;
    document.getElementById('illum').textContent = `Illumination: ${illum.toFixed(1)}%`;

    // Update Moon Image (Placeholder)
    const moonImageNumber = Math.max(1, Math.min(30, Math.floor(moonAge) + 1));
    const moonImageUrl = `https://placehold.co/160x160/000000/FFFFFF?text=Moon+Day+${moonImageNumber}`;
    document.getElementById('moon-img').src = moonImageUrl;
    document.getElementById('moon-img').onerror = () => document.getElementById('moon-img').src = 'https://placehold.co/160x160/000000/FFFFFF?text=Moon';

    // 4. Update Other Solunar Times
    document.getElementById('moon-rise').textContent = formatTime(data.moon_rise_utc);
    document.getElementById('moon-set').textContent = formatTime(data.moon_set_utc);
    document.getElementById('major-1').textContent = formatTime(data.major_1_utc);
    document.getElementById('major-2').textContent = formatTime(data.major_2_utc);
    document.getElementById('minor-1').textContent = formatTime(data.minor_1_utc);
    document.getElementById('minor-2').textContent = formatTime(data.minor_2_utc);
    document.getElementById('moon-overhead').textContent = formatTime(data.moon_overhead_utc);
    document.getElementById('moon-underfoot').textContent = formatTime(data.moon_underfoot_utc);
}

/**
 * Main function to fetch data and start the display cycle.
 */
async function fetchSolunarData() {
    try {
        const response = await fetch(DATA_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        solunarData = await response.json();
        
        // Initial display update
        updateSolunarDisplay();
        
        // Update display every minute to ensure 'will reach' vs 'reached' is accurate
        setInterval(updateSolunarDisplay, 60000); 
    } catch (e) {
        console.error("Failed to load solunar data:", e);
        document.getElementById('phase').textContent = 'Error Loading Data';
        document.getElementById('illum').textContent = '';
    }
}

// Start the data fetching process when the window loads
window.onload = fetchSolunarData;
