// scripts/water_level_v2.js

const DATUM_MSL = 129.84;
const NORMAL_POOL = 141;
const SITE_ID = '07349250';

const currentDiv = document.getElementById('current-level');
const canvas = document.getElementById('water-chart');

function createTickCallback(lastTimeMs) {
    const INTERVAL_MS = 12 * 60 * 60 * 1000;
    const TOLERANCE_MS = 15 * 60 * 1000;

    return function(value, index, ticks) {
        const labelTime = new Date(this.getLabelForValue(value)).getTime();
        const isLastTick = index === ticks.length - 1;

        if (isLastTick) {
            return new Date(labelTime).toLocaleString('en-US', {
                timeZone: 'America/Chicago',
                month: 'short', day: 'numeric', hour: 'numeric', hour12: true
            });
        }

        const diff = lastTimeMs - labelTime;
        const numIntervals = Math.round(diff / INTERVAL_MS);
        const deviation = Math.abs(diff - (numIntervals * INTERVAL_MS));

        if (deviation < TOLERANCE_MS) {
            return new Date(labelTime).toLocaleString('en-US', {
                timeZone: 'America/Chicago',
                month: 'short', day: 'numeric', hour: 'numeric', hour12: true
            });
        }

        return null;
    };
}

async function loadWaterGraph() {
    canvas.style.display = 'block';
    currentDiv.innerHTML = '<p>Loading current level...</p>';

    try {
        const usgsUrl = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${SITE_ID}&parameterCd=00065&period=P7D&siteStatus=active`;
        const noaaUrl = `https://api.water.noaa.gov/nwps/v1/gauges/${SITE_ID}/stageflow`;

        const [usgsRes, noaaRes] = await Promise.all([
            fetch(usgsUrl),
            fetch(noaaUrl)
        ]);

        const usgsData = await usgsRes.json();

        let noaaData = null;
        try {
            noaaData = await noaaRes.json();
        } catch (e) {
            console.warn('NOAA forecast unavailable or invalid JSON:', e);
        }

        if (!usgsData.value?.timeSeries?.[0]) throw new Error('No time series data from USGS');

        const ts = usgsData.value.timeSeries[0];
        const labels = [];
        const observedLevels = [];

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
                observedLevels.push(mslElevation);

                lastDate = tsDate;
                currentMSL = mslElevation;
                lastTimeMs = tsDate.getTime();
            }
        });

        if (observedLevels.length === 0) throw new Error('No valid data points found in USGS feed');

        // --- NOAA forecast points ---
        const forecastPoints = noaaData?.forecast?.data || [];
        const forecastLabels = [];
        const forecastLevels = [];

        forecastPoints.forEach(point => {
            if (point.validTime && typeof point.primary === 'number') {
                forecastLabels.push(point.validTime);
                forecastLevels.push(point.primary);
            }
        });

        // Add forecast labels to the chart labels, but only future points after latest USGS reading
        forecastLabels.forEach(label => {
            const t = new Date(label).getTime();
            if (t > lastTimeMs) labels.push(label);
        });

        // Build aligned forecast data array
        const forecastData = labels.map(label => {
            const idx = forecastLabels.indexOf(label);
            return idx >= 0 ? forecastLevels[idx] : null;
        });

        // Connect forecast line visually from latest observed reading
        const lastObservedIndex = observedLevels.length - 1;
        forecastData[lastObservedIndex] = currentMSL;

        const forecastPeak = forecastLevels.length ? Math.max(...forecastLevels) : null;
        const forecastPeakIndex = forecastLevels.indexOf(forecastPeak);
        const forecastPeakTime = forecastPeakIndex >= 0 ? new Date(forecastLabels[forecastPeakIndex]) : null;

        let forecastSummary = '';
        if (forecastPeak != null && forecastPeakTime) {
            const change = forecastPeak - currentMSL;
            const changeText = change >= 0 ? `+${change.toFixed(2)}` : change.toFixed(2);

            forecastSummary = `
                <br>
                <span style="font-weight: normal; color: #6f42c1; font-size: 13px;">
                    Forecast peak: ${forecastPeak.toFixed(2)} ft MSL (${changeText} ft)
                    ${forecastPeakTime.toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', hour12: true })}
                </span>
            `;
        }

        currentDiv.innerHTML = `
            <span>Current Level: <strong>${currentMSL.toFixed(2)} ft MSL</strong></span><br>
            <span style="font-weight: normal; color: #666; font-size: 13px;">
                Last reading: ${lastDate.toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true })}
            </span>
            ${forecastSummary}
        `;

        if (window.waterChart) window.waterChart.destroy();

        window.waterChart = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Observed Elevation (ft MSL)',
                        data: [
                            ...observedLevels,
                            ...Array(labels.length - observedLevels.length).fill(null)
                        ],
                        borderColor: '#1e90ff',
                        backgroundColor: 'rgba(30, 144, 255, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.1,
                        pointRadius: 0,
                        pointHoverRadius: 5
                    },
                    {
                        label: 'Forecast Elevation (ft MSL)',
                        data: forecastData,
                        borderColor: '#6f42c1',
                        backgroundColor: 'rgba(111, 66, 193, 0.08)',
                        borderWidth: 2,
                        borderDash: [6, 6],
                        fill: false,
                        tension: 0.1,
                        pointRadius: 3,
                        pointHoverRadius: 5,
                        spanGaps: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: false,
                        suggestedMin: 135,
                        suggestedMax: 145,
                        title: { display: true, text: 'Elevation (ft above MSL)' },
                        grid: { color: 'rgba(0,0,0,0.1)' }
                    },
                    x: {
                        type: 'category',
                        title: { display: true, text: 'Date / Time (CST)' },
                        grid: { color: 'rgba(0,0,0,0.1)' },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                            autoSkip: false,
                            callback: createTickCallback(lastTimeMs)
                        }
                    }
                },
                plugins: {
                    legend: { display: true },
                    tooltip: {
                        callbacks: {
                            label: context => ` ${context.dataset.label}: ${context.parsed.y.toFixed(2)} ft MSL`
                        }
                    },
                    annotation: {
                        annotations: {
                            poolLine: {
                                type: 'line',
                                yMin: NORMAL_POOL,
                                yMax: NORMAL_POOL,
                                borderColor: '#28a745',
                                borderWidth: 3,
                                borderDash: [6, 6]
                            }
                        }
                    }
                },
                animation: { duration: 1000 }
            }
        });

        // Highlight latest observed point
        if (observedLevels.length > 0) {
            window.waterChart.data.datasets[0].pointBackgroundColor = Array(labels.length).fill('transparent');
            window.waterChart.data.datasets[0].pointBackgroundColor[lastObservedIndex] = '#ff0000';

            window.waterChart.data.datasets[0].pointRadius = Array(labels.length).fill(0);
            window.waterChart.data.datasets[0].pointRadius[lastObservedIndex] = 6;

            window.waterChart.update();
        }

    } catch (err) {
        console.error('Water Graph Error:', err);
        canvas.style.display = 'none';
        currentDiv.innerHTML = '<p style="color:#d32f2f;">Level unavailable. <a href="https://water.noaa.gov/gauges/07349250" target="_blank">Check NOAA</a></p>';
    }
}

document.addEventListener('DOMContentLoaded', loadWaterGraph);
