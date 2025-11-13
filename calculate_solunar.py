import ephem
from datetime import datetime, timedelta, time
import json

# --- Configuration (Minden, LA) ---
LATITUDE = '32.4619'  
LONGITUDE = '-93.3486'
OUTPUT_FILE = 'solunar_data.json'
DAYS_TO_CALCULATE = 3 # Calculate data for today, tomorrow, and the day after

def calculate_data():
    full_data = {}
    
    # Define the local time zone offset (CST = UTC - 6 hours)
    # This is used to determine the local start/end of the day for filtering.
    CST_OFFSET = timedelta(hours=6)

    # Start the calculation from the current date
    start_date = datetime.now().date() 

    for i in range(DAYS_TO_CALCULATE):
        target_date = start_date + timedelta(days=i)
        
        # Define the exact 24-hour window we are targeting in UTC
        # This is the range from 00:00:00 to 23:59:59 on the target date (UTC).
        target_start_utc = datetime.combine(target_date, time(0, 0, 0))
        target_end_utc = target_start_utc + timedelta(days=1) - timedelta(seconds=1)
        
        # --- Define Observer and Celestial Bodies ---
        location = ephem.Observer()
        location.lat = LATITUDE
        location.lon = LONGITUDE
        
        moon = ephem.Moon()
        
        # --- Moon Phase and Illumination (Calculated for the start of the day) ---
        location.date = target_start_utc
        moon.compute(location)
        illum = moon.moon_phase * 100 
        
        # Moon Age in days (0-29.53). This will be used by your JS for the Knight offset.
        moon_age = round(moon.moon_phase * 29.53) 
        
        # --- Major Periods (Transit/Anti-transit) ---
        
        # To ensure we catch the two events that fall within the target day, 
        # we search across a 48-hour period starting 12 hours *before* the target day.
        search_start = target_start_utc - timedelta(hours=12)
        location.date = search_start
        
        all_major_events = []
        for _ in range(4): # Find up to 4 events (2 Transits, 2 Anti-transits)
            
            # Find the next transit (Upper)
            t = location.next_transit(moon)
            all_major_events.append(t.datetime())
            location.date = t + ephem.minute # Advance search
            
            # Find the next anti-transit (Lower)
            a = location.next_antitransit(moon)
            all_major_events.append(a.datetime())
            location.date = a + ephem.minute
        
        # Filter: Keep only the events that fall within the target 24-hour UTC day
        major_events = sorted([
            dt for dt in all_major_events 
            if dt >= target_start_utc and dt <= target_end_utc
        ])
        
        # --- Minor Periods (Moonrise/Moonset) ---
        
        # Reset search start to ensure we catch all rise/set events for the day
        location.date = target_start_utc - timedelta(hours=12) 
        
        all_minor_events = []
        for _ in range(3): # We only need up to 4 events, so searching for 3 is safe
            # Find next rising
            try:
                r = location.next_rising(moon)
                all_minor_events.append(r.datetime())
                location.date = r + ephem.minute
            except Exception: pass
            
            # Find next setting
            try:
                s = location.next_setting(moon)
                all_minor_events.append(s.datetime())
                location.date = s + ephem.minute
            except Exception: pass

        # Filter and sort minor events for the target 24-hour UTC day
        minor_events = sorted([
            dt for dt in all_minor_events 
            if dt >= target_start_utc and dt <= target_end_utc
        ])

        # --- Final Data Collation ---
        data_key = target_date.strftime("%Y-%m-%d")
        
        # Only store data if we found the primary 2 Major events
        if len(major_events) >= 2:
            full_data[data_key] = {
                "date": data_key,
                "major_1_utc": major_events[0].isoformat() + "Z",
                "major_2_utc": major_events[1].isoformat() + "Z",
                
                # We need 2 Minor periods, take the first two available
                "minor_1_utc": minor_events[0].isoformat() + "Z" if len(minor_events) > 0 else None,
                "minor_2_utc": minor_events[1].isoformat() + "Z" if len(minor_events) > 1 else None,
                
                "moon_illum": round(illum, 1),
                "moon_age": moon_age, 
            }

    # Write the data to a JSON file
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(full_data, f, indent=4)
        
    print(f"Successfully calculated and saved {len(full_data)} days of data to {OUTPUT_FILE}")

if __name__ == "__main__":
    calculate_data()
