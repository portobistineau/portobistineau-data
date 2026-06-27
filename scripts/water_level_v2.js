// scripts/water_level_v2.js

const DATUM_MSL = 129.84;
const currentDiv = document.getElementById('current-level');
const canvas = document.getElementById('water-chart');

// --- Tick Callback Function Generator ---
function createTickCallback(lastTimeMs) {
    const INTERVAL_MS = 12 * 60 * 60 * 1000;
    // STRICT TOLERANCE (15 minutes) to only allow points exactly on the 12-hour cycle
    const TOLERANCE_MS = 15 * 60 * 1000; 

    return function(value, index, ticks) {
        const labelTime = new Date(this.getLabelForValue(value)).getTime();
        const isLastTick = index === ticks.length - 1;

        // 1. Always show the last tick (the current reading)
        if (isLastTick) {
            return new Date(labelTime).toLocaleString('en-US', { 
                timeZone: 'America/Chicago', 
                month: 'short', day: 'numeric', hour: 'numeric', hour12: true 
            });
        }

        // 2. Check if this label is near one of the ideal 12-hour steps backward from the last reading.
        const diff = lastTimeMs - labelTime;
         
        // Calculate how many 12-hour intervals fit. This handles the last reading at 7 PM, 
        // and seeks the next point closest to 7 AM, 7 PM, 7 AM, etc., working backwards.
        const numIntervals = Math.round(diff / INTERVAL_MS);
         
        // Calculate the time difference from an *ideal* 12-hour mark
        const deviation = Math.abs(diff - (numIntervals * INTERVAL_MS));
         
        // If the deviation is within the strict tolerance (15 min), show the tick
        if (deviation < TOLERANCE_MS) {
            return new Date(labelTime).toLocaleString('en-US', { 
                timeZone: 'America/Chicago', 
                month: 'short', day: 'numeric', hour: 'numeric', hour12: true 
            });
        }

        return null; // Hide the tick
    };
}

// --- Main Graph Loader ---
async function loadWaterGraph() {
    canvas.style.display = 'block'; 
    currentDiv.innerHTML = '<p>Loading current level...</p>';

    try {
        const res = await fetch('https://waterservices.usgs.gov/nwis/iv/?format=json&sites=07349250&parameterCd=00065&period=P7D&siteStatus=active');
        const data = await res.json();
        if (!data.value?.timeSeries?.[0]) throw new Error('No time series data from USGS');

        const ts = data.value.timeSeries[0];
        const labels = [];
        const mslLevels = [];
        let currentMSL = null;
        let lastDate = null;
        let lastTimeMs = null; 

        const values = ts.values[0].value;
        values.forEach(val => { 
            if (val.value !== '-999999') {
                const gageHeight = parseFloat(val.value);
                const mslElevation = gageHeight + DATUM_MSL;
                const tsDate = new Date(val.dateTime);
                 
                labels.push(val.dateTime); 
                mslLevels.push(mslElevation);
                lastDate = tsDate;
                currentMSL = mslElevation;
                lastTimeMs = tsDate.getTime(); 
            }
        });

        if (mslLevels.length === 0) throw new Error('No valid data points found in USGS feed');
         
        currentDiv.innerHTML = `
            <span>Current Level: <strong>${currentMSL.toFixed(2)} ft MSL</strong></span><br>
            <span style="font-weight: normal; color: #666; font-size: 13px;">Last reading: ${lastDate.toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true })}</span>
        `;

        if (window.waterChart) window.waterChart.destroy();

        window.waterChart = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: { labels, datasets: [{ label: 'Elevation (ft MSL)', data: mslLevels, borderColor: '#1e90ff', backgroundColor: 'rgba(30, 144, 255, 0.1)', borderWidth: 2, fill: true, tension: 0.1, pointRadius: 0, pointHoverRadius: 5 }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: false, suggestedMin: 135, suggestedMax: 145, title: { display: true, text: 'Elevation (ft above MSL)' }, grid: { color: 'rgba(0,0,0,0.1)' } },
                    x: { 
                        type: 'category', 
                        title: { display: true, text: 'Date / Time (CST)' }, 
                        grid: { color: 'rgba(0,0,0,0.1)' }, 
                        ticks: { 
                            maxRotation: 45, 
                            minRotation: 45,
                            autoSkip: false, 
                            callback: createTickCallback(lastTimeMs) // Uses the new strict callback
                        } 
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: context => ` ${context.parsed.y.toFixed(2)} ft MSL` } },
                    annotation: { annotations: { poolLine: { type: 'line', yMin: 141, yMax: 141, borderColor: '#28a745', borderWidth: 3, borderDash: [6, 6] } } }
                },
                animation: { duration: 1000 }
            }
        });

        // Highlight the last point
        const lastIdx = mslLevels.length - 1;
        if (mslLevels.length > 0) {
            window.waterChart.data.datasets[0].pointBackgroundColor = Array(mslLevels.length).fill('transparent');
            window.waterChart.data.datasets[0].pointBackgroundColor[lastIdx] = '#ff0000';
            window.waterChart.data.datasets[0].pointRadius = Array(mslLevels.length).fill(0);
            window.waterChart.data.datasets[0].pointRadius[lastIdx] = 6;
            window.waterChart.update();
        }

    } catch (err) {
        console.error('Water Graph Error:', err);
        canvas.style.display = 'none';
        currentDiv.innerHTML = '<p style="color:#d32f2f;">Level unavailable. <a href="https://water.noaa.gov/gauges/07349250" target="_blank">Check NOAA</a></p>';
    }
}
document.addEventListener('DOMContentLoaded', loadWaterGraph);
