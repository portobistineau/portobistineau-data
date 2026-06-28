// scripts/water_level_v2.js

const DATUM_MSL = 129.84;
const NORMAL_POOL = 141;
const SITE_ID = '07349250';

const currentDiv = document.getElementById('current-level');
const canvas = document.getElementById('water-chart');

function formatTime(dt, includeMinute = false) {
    const opts = {
        timeZone: 'America/Chicago',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        hour12: true
    };

    if (includeMinute) {
        opts.minute = 'numeric';
    }

    return new Date(dt).toLocaleString('en-US', opts);
}

function createTickCallback() {
    const DESIRED_TICKS = 12;

    return function(value, index, ticks) {
        if (!ticks || ticks.length === 0) return null;

        const spacing = Math.max(1, Math.round(ticks.length / DESIRED_TICKS));

        const isFirst = index === 0;
        const isRegularTick = index % spacing === 0;
        const isLast = index === ticks.length - 1;

        // Show regular ticks and first tick
        if (isFirst || isRegularTick) {
            return formatAxisLabel(this.getLabelForValue(value));
        }

        // Only show last tick if it is not too close to the previous regular tick
        if (isLast) {
            const previousRegularIndex = Math.floor(index / spacing) * spacing;
            const distanceFromPreviousRegular = index - previousRegularIndex;

            if (distanceFromPreviousRegular >= Math.ceil(spacing * 0.75)) {
                return formatAxisLabel(this.getLabelForValue(value));
            }
        }

        return null;
    };
}

function formatAxisLabel(labelValue) {
    const labelTime = new Date(labelValue);

    return labelTime.toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        hour12: true
    });
}

async function loadWaterGraph() {
    canvas.style.display = 'block';
    currentDiv.innerHTML = '<p>Loading current level...</p>';

    try {
        await loadNoaaGraph();
    } catch (noaaErr) {
        console.warn('NOAA graph unavailable, falling back to USGS:', noaaErr);
        await loadUsgsGraph();
    }
}

async function loadNoaaGraph() {
    const noaaUrl = `https://api.water.noaa.gov/nwps/v1/gauges/${SITE_ID}/stageflow`;
    const res = await fetch(noaaUrl);
    const data = await res.json();

    const observedRaw = data?.observed?.data || [];
    const forecastRaw = data?.forecast?.data || [];

    // NOAA returns much more history than we want.
// Keep only the last 5 days so forecast takes up more of the graph.
let observed = observedRaw
    .filter(p => p.validTime && typeof p.primary === 'number')
    .map(p => ({ time: p.validTime, level: p.primary }));

const forecast = forecastRaw
    .filter(p => p.validTime && typeof p.primary === 'number')
    .map(p => ({ time: p.validTime, level: p.primary }));

// Keep graph visually balanced: about 2/3 observed, 1/3 forecast
if (forecast.length > 0) {
    const observedPointsToShow = Math.max(forecast.length * 2, 48);
    observed = observed.slice(-observedPointsToShow);
}

    if (!observed.length) throw new Error('No valid NOAA observed data');

    const lastObserved = observed[observed.length - 1];
    const currentMSL = lastObserved.level;
    const lastTimeMs = new Date(lastObserved.time).getTime();

    const labels = observed.map(p => p.time);

    forecast.forEach(p => {
        if (new Date(p.time).getTime() > lastTimeMs) {
            labels.push(p.time);
        }
    });

    const observedData = labels.map(label => {
        const p = observed.find(x => x.time === label);
        return p ? p.level : null;
    });

    const forecastData = labels.map(label => {
        const p = forecast.find(x => x.time === label);
        return p ? p.level : null;
    });

    // Connect forecast visually from the latest observed point
    forecastData[observed.length - 1] = currentMSL;

    const forecastLevels = forecast.map(p => p.level);
    const forecastPeak = forecastLevels.length ? Math.max(...forecastLevels) : null;
    const forecastPeakPoint = forecastPeak != null
        ? forecast.find(p => p.level === forecastPeak)
        : null;

    let forecastSummary = '';
    if (forecastPeakPoint) {
        const change = forecastPeakPoint.level - currentMSL;
        const changeText = change >= 0 ? `+${change.toFixed(2)}` : change.toFixed(2);

        const arrow = change >= 0 ? "▲" : "▼";

forecastSummary = `
    <br>
    <span style="font-weight:600; color:#6f42c1;">
        Forecast Crest:
    </span>
    <span style="color:#6f42c1;">
        ${forecastPeakPoint.level.toFixed(2)} ft MSL
    </span>
    <br>
    <span style="font-size:13px; color:#6f42c1;">
        ${arrow} ${changeText} ft by ${formatTime(forecastPeakPoint.time)}
    </span>
`;
    }

    currentDiv.innerHTML = `
        <span>Current Lake Level: <strong>${currentMSL.toFixed(2)} ft MSL</strong></span><br>
        <span style="font-weight: normal; color: #666; font-size: 13px;">
            Last reading: ${formatTime(lastObserved.time, true)}
        </span>
        ${forecastSummary}
    `;

    renderChart(labels, observedData, forecastData, lastTimeMs, observed.length - 1);
}

function renderChart(labels, observedData, forecastData, lastTimeMs, lastObservedIndex) {
    const dividerLabel = labels[lastObservedIndex];

    if (window.waterChart) window.waterChart.destroy();

    window.waterChart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Observed Elevation (ft MSL)',
                    data: observedData,
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
                    borderDash: [4, 3],
                    fill: false,
                    tension: 0.1,
                    pointRadius: 0,
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
                        callback: createTickCallback()
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: context => ` ${context.dataset.label}: ${context.parsed.y.toFixed(2)} ft MSL`
                    }
                },
                annotation: {
                    annotations: {
                        majorBand: {
                            type: 'box',
                            yMin: 145,
                            yMax: 150,
                            backgroundColor: 'rgba(220, 38, 38, 0.08)',
                            borderWidth: 0
                        },
                        moderateBand: {
                            type: 'box',
                            yMin: 144,
                            yMax: 145,
                            backgroundColor: 'rgba(249, 115, 22, 0.08)',
                            borderWidth: 0
                        },
                        minorBand: {
                            type: 'box',
                            yMin: 142.5,
                            yMax: 144,
                            backgroundColor: 'rgba(251, 146, 60, 0.07)',
                            borderWidth: 0
                        },
                        actionBand: {
                            type: 'box',
                            yMin: 142,
                            yMax: 142.5,
                            backgroundColor: 'rgba(250, 204, 21, 0.10)',
                            borderWidth: 0
                        },
                        normalBand: {
                            type: 'box',
                            yMin: 141,
                            yMax: 142,
                            backgroundColor: 'rgba(34, 197, 94, 0.04)',
                            borderWidth: 0
                        },
                        forecastDivider: {
                            type: 'line',
                            xMin: dividerLabel,
                            xMax: dividerLabel,
                            borderColor: 'rgba(0, 0, 0, 0.25)',
                            borderWidth: 1,
                            borderDash: [4, 4]
                        },
                        poolLine: {
                            type: 'line',
                            yMin: NORMAL_POOL,
                            yMax: NORMAL_POOL,
                            borderColor: '#16a34a',
                            borderWidth: 1.5
                        }
                    }
                }
            },
            animation: { duration: 1000 }
        }
    });

    window.waterChart.data.datasets[0].pointBackgroundColor = Array(labels.length).fill('transparent');
    window.waterChart.data.datasets[0].pointBackgroundColor[lastObservedIndex] = '#ff0000';

    window.waterChart.data.datasets[0].pointRadius = Array(labels.length).fill(0);
    window.waterChart.data.datasets[0].pointRadius[lastObservedIndex] = 6;

    window.waterChart.update();
}

async function loadUsgsGraph() {
    const res = await fetch(`https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${SITE_ID}&parameterCd=00065&period=P7D&siteStatus=active`);
    const data = await res.json();

    if (!data.value?.timeSeries?.[0]) throw new Error('No time series data from USGS');

    const ts = data.value.timeSeries[0];
    const labels = [];
    const observedData = [];

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
            observedData.push(mslElevation);

            lastDate = tsDate;
            currentMSL = mslElevation;
            lastTimeMs = tsDate.getTime();
        }
    });

    if (!observedData.length) throw new Error('No valid data points found in USGS feed');

    currentDiv.innerHTML = `
        <span>Current Level: <strong>${currentMSL.toFixed(2)} ft MSL</strong></span><br>
        <span style="font-weight: normal; color: #666; font-size: 13px;">
            Last reading: ${formatTime(lastDate, true)}
        </span><br>
        <span style="font-weight: normal; color: #999; font-size: 12px;">
            Forecast unavailable — showing USGS observed data only
        </span>
    `;

    renderChart(
        labels,
        observedData,
        Array(labels.length).fill(null),
        lastTimeMs,
        observedData.length - 1
    );
}

document.addEventListener('DOMContentLoaded', loadWaterGraph);
