import json
import requests
from datetime import datetime, timedelta
import feedparser  # For YouTube RSS
from suntime import Sun  # pip install suntime (for sunrise/sunset)
import ephem
from ephem import Moon
observer = ephem.Moon()
observer.compute(TODAY)
moon_illum = observer.phase  # 0 to 100
moon_phases = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous',
               'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent']
moon_idx = int((moon_illum / 100) * 8) % 8
moon_name = moon_phases[moon_idx]

# Config
LAT = float(os.environ.get('LAT', '32.4619'))
LNG = float(os.environ.get('LNG', '-93.34883'))
CHANNEL_ID = os.environ.get('CHANNEL_ID', 'UCa3ac3e31957eebb61f0a38db32b5f80b160a9c88')
TODAY = datetime.now().date()

# Solunar Calculation (Using suntime for sun, simple moon)
sun = Sun(LAT, LNG)
sunrise = sun.get_local_sunrise_time(TODAY)
sunset = sun.get_local_sunset_time(TODAY)

# Format times
def format_time(dt):
    return dt.strftime('%I:%M %p')

sunrise_str = format_time(sunrise)
sunset_str = format_time(sunset)

# Moon Phase (Simple calc - % illum, phase name)
moon_phases = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent']
moon_name = moon_phases[moon_idx]

# Majors/Minors (Approx: Major ~ moon overhead, Minor ~ 3h offset)
noon = datetime.combine(TODAY, datetime.time(12))
major_start = noon - timedelta(hours=1.5)
major_end = noon + timedelta(hours=1.5)
minor_start = major_start + timedelta(hours=3)
minor_end = major_end + timedelta(hours=3)
major = f"{format_time(major_start)} – {format_time(major_end)}"
minor = f"{format_time(minor_start)} – {format_time(minor_end)}"

# Water Temp (Static regional avg - could API if needed)
water_temp = "~71°F"

# Latest YouTube Video (RSS, non-live)
rss_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={CHANNEL_ID}"
feed = feedparser.parse(rss_url)
latest_id = None
for entry in feed.entries:
    title_lower = entry.title.lower()
    if 'live' not in title_lower and 'stream' not in title_lower and 'cam' not in title_lower:
        latest_id = entry.id.split('v=')[-1].split('&')[0]
        break
if not latest_id:
    latest_id = '79hxzuJ0r70'  # Fallback

# Build JSON
data = {
    "date": TODAY.strftime("%b %d, %Y"),
    "sunrise": sunrise_str,
    "sunset": sunset_str,
    "major": major,
    "minor": minor,
    "moon": moon_name,
    "illum": f"{int(moon_illum)}%",
    "temp": water_temp,
    "latest_video": latest_id
}

# Write to file
with open('data.json', 'w') as f:
    json.dump(data, f, indent=2)

print("Updated data.json:", data)
