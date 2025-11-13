import ephem
from datetime import datetime, timedelta, time
import json
import pytz # Correct import

# --- Configuration (Lake Bistineau, LA) ---
LATITUDE = '32.4619' 
LONGITUDE = '-93.3486'
OUTPUT_FILE = 'solunar_data.json'
DAYS_TO_CALCULATE = 180 # Set to 180 days

# Define the local time zone (America/Chicago)
CST_TZ = pytz.timezone('America/Chicago')

def calculate_data():
    full_data = {}
    
    # DETERMINE TODAY'S DATE IN LOCAL TIME (CST)
    now_cst = datetime.now(CST_TZ)
    start_date_cst = now_cst.date()

    for i in range(DAYS_TO_CALCULATE):
        target_date_cst = start_date_cst + timedelta(days=i)
        
        # --- Define the UTC 24-hour window corresponding to the target CST day ---
        
        # Localize the start of the CST day (00:00:00 CST) and convert to naive UTC datetime
        # This handles DST transitions correctly.
        target_start_utc = CST_TZ.localize(datetime.combine(target_date_cst, time(0, 0, 0))).astimezone(pytz.utc).replace(tzinfo=None)
        target_end_utc = target_start_utc + timedelta(days=1) - timedelta(seconds=1)
        
        # --- Define Observer and Celestial Bodies ---
        location = ephem.Observer()
        location.lat = LATITUDE
        location.lon = LONGITUDE
        
        moon = ephem.Moon()
        
        # --- Search Events (Major/Minor) ---
        
        # Search a 48-hour window centered on the target time to capture all events
        search_start = target_start_utc - timedelta(hours=12)
        
        all_major_events = []
        all_minor_events = []
        
        # 1. Find Major Events (Transit/Anti-transit)
        location.date = search_start
        for _ in range(6): 
            try:
                t = location.next_transit(moon)
                all_major_events.append(t.datetime())
                location.date = t + ephem.minute
            except StopIteration: break
            
            try:
                a = location.next_antitransit(moon)
                all_major_events.append(a.datetime())
                location.date = a + ephem.minute
            except StopIteration: break
            
        # 2. Find Minor Events (Rise/Set)
        location.date = search_start
        for _ in range(3): 
            try:
                r = location.next_rising(moon)
                all_minor_events.append(r.datetime())
                location.date = r + ephem.minute
            except Exception: pass
            
            try:
                s = location.next_setting(moon)
                all_minor_events.append(s.datetime())
                location.date = s + ephem.minute
            except Exception: pass

        # Filter: Keep only the events that fall within the UTC boundaries of the CST day
        major_events = sorted([
            dt for dt in all_major_events 
            if dt >= target_start_utc and dt <= target_end_utc
        ])
        
        minor_events = sorted([
            dt for dt in all_minor_events 
            if dt >= target_start_utc and dt <= target_end_utc
        ])
        
        # --- Moon Phase, Illumination, and Age Calculation ---
        location.date = target_start_utc
        moon.compute(location)
        illum = moon.moon_phase * 100 
        
        # CRITICAL FIX: Moon Age stored with 1 decimal place for precision
        moon_age = round(moon.moon_phase * 29.53, 1) 

        # --- Final Data Collation (FIXED: Includes every day and uses None for missing events) ---
        data_key = target_date_cst.strftime("%Y-%m-%d")

        # Always write the date, filling in missing events with None
        full_data[data_key] = {
            "date": data_key,
            
            # Major events (Use None if not found.)
            "major_1_utc": major_events[0].isoformat() + "Z" if len(major_events) > 0 else None,
            "major_2_utc": major_events[1].isoformat() + "Z" if len(major_events) > 1 else None,
            
            # Minor events (Use None if not found.)
            "minor_1_utc": minor_events[0].isoformat() + "Z" if len(minor_events) > 0 else None,
            "minor_2_utc": minor_events[1].isoformat() + "Z" if len(minor_events) > 1 else None,
            
            # Moon data
            "moon_illum": round(illum, 1),
            "moon_age": moon_age, # Now a decimal value
        }

    # Write the data to a JSON file
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(full_data, f, indent=4)
        
    print(f"Successfully calculated and saved {len(full_data)} days of data to {OUTPUT_FILE}")

if __name__ == "__main__":
    calculate_data()
