import json, ephem
from datetime import datetime, timedelta
from suntime import Sun

lat, lon = 32.4619, -93.34883
today = datetime.now().date()
sun = Sun(lat, lon)

# Light times
first = sun.get_sunrise_time(today) - timedelta(minutes=34)
last  = sun.get_sunset_time(today)  + timedelta(minutes=34)

def fmt(t): return t.strftime("%I:%M %p")

# Moon
m = ephem.Moon(); m.compute(today)
illum = int(m.phase)
phase_names = ["New","Waxing Crescent","First Quarter","Waxing Gibbous",
               "Full","Waning Gibbous","Last Quarter","Waning Crescent"]
phase = phase_names[int(illum/12.5)%8]

# 2 Majors (2 hr), 1 Minor (1 hr) — moon-based
rise = ephem.Moon(); rise.compute(today); rise = rise.rise_time
set_ = ephem.Moon(); set_.compute(today); set_ = set_.set_time
if not rise: rise = datetime(today.year,today.month,today.day,12)
if not set_: set_ = rise + timedelta(hours=12)

def window(t, hrs): 
    return fmt(t-timedelta(hours=hrs/2)), fmt(t+timedelta(hours=hrs/2))

major1_start, major1_end = window(rise, 2)
major2_start, major2_end = window(set_, 2)
minor_start, minor_end   = window(rise + (set_-rise)/2, 1)

# Star rating
stars = "★" * (4 if 40<illum<95 else 3 if 20<illum<120 else 2 if illum>5 else 1)
rating = ["","Fair","Good","Better","Best"][len(stars)]

data = {
  "date": today.strftime("%b %d, %Y"),
  "first_light": fmt(first),
  "sunrise": fmt(sun.get_sunrise_time(today)),
  "sunset":  fmt(sun.get_sunset_time(today)),
  "last_light": fmt(last),
  "major1": f"{major1_start}–{major1_end}",
  "major2": f"{major2_start}–{major2_end}",
  "minor":  f"{minor_start}–{minor_end}",
  "moon_phase": phase,
  "illum": f"{illum}%",
  "stars": stars,
  "rating": rating
}

with open("data.json","w") as f: json.dump(data,f,indent=2)
print("UPDATED:", data)
