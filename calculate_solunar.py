import ephem
from datetime import datetime, timedelta, time
import json
from pytz import timezone # Import timezone for robust date handling

# --- Configuration (Lake Bistineau, LA) ---
LATITUDE = '32.4619'  
LONGITUDE = '-93.3486'
OUTPUT_FILE = 'solunar_data.json'
DAYS_TO_CALCULATE = 3 

# Define the local time zone offset (CST is 6 hours behind UTC)
CST_TZ = timezone('America/Chicago')
CST_OFFSET = timedelta(hours=6)

def calculate_data():
    full_data = {}
    
    # DETERMINE TODAY'S DATE IN LOCAL TIME (CST)
    # This is the crucial fix: we determine the current date in CST, not UTC.
    now_cst = datetime.now(CST_TZ)
    start_date_cst = now_cst.date()

    for i in range(DAYS_TO_CALCULATE):
        target_date_cst = start_date_cst + timedelta(days=i)
        
        # --- Define the UTC 24-hour window corresponding to the target CST day ---
        
        # The start of the target CST day is 00:00:00 CST.
        # 00:00:00 CST is 06:00:00 UTC (during standard time).
        target_start_utc = datetime.combine(target_date_cst, time(0, 0, 0)) + CST_OFFSET
        target_end_utc = target_start_utc + timedelta(days=1) - timedelta(seconds=1)
        
        # --- Define Observer and Celestial Bodies ---
        location = ephem.Observer()
        location.lat = LATITUDE
        location.lon = LONGITUDE
        
        moon = ephem.Moon()
        
        # --- Moon Phase, Illumination, and Age ---
        location.date = target_start_utc
        moon.compute(location)
        illum = moon.moon_phase * 100 
        moon_age = round(moon.moon_phase * 29.53) 
        
        # --- Major Periods (Transit/Anti-transit) ---
        
        # Search a 48-hour window centered on the target CST day (24 hours in UTC).
        search_start = target_start_utc - timedelta(hours=12)
        location.date = search_start
        
        all_major_events = []
        for _ in range(6): # Find up to 6 events (3 Transits, 3 Anti-transits)
            
            t = location.next_transit(moon)
            all_major_events.append(t.datetime())
            location.date = t + ephem.minute
            
            a = location.next_antitransit(moon)
            all_major_events.append(a.datetime())
            location.date = a + ephem.minute
        
        # Filter: Keep only the events that fall within the UTC boundaries of the CST day
        major_events = sorted([
            dt for dt in all_major_events 
            if dt >= target_start_utc and dt <= target_end_utc
        ])
        
        # --- Minor Periods (Moonrise/Moonset) ---
        # Logic to find two moonrise/moonset events within the UTC window remains the same...
        # (This is already set up in the previous script version and should work now)
        location.date = target_start_utc - timedelta(hours=12) 
        all_minor_events = []
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

        minor_events = sorted([
            dt for dt in all_minor_events 
            if dt >= target_start_utc and dt <= target_end_utc
        ])

        # --- Final Data Collation ---
        data_key = target_date_cst.strftime("%Y-%m-%d")
        
        # Only store data if we found the primary 2 Major events
        if len(major_events) >= 2:
            full_data[data_key] = {
                "date": data_key,
                "major_1_utc": major_events[0].isoformat() + "Z",
                "major_2_utc": major_events[1].isoformat() + "Z",
                
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
