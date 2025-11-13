import ephem
from datetime import datetime, timedelta, time
import json
import pytz 

# --- Configuration (Lake Bistineau, LA) ---
LATITUDE = '32.4619' 
LONGITUDE = '-93.3486'
OUTPUT_FILE = 'solunar_data.json'
DAYS_TO_CALCULATE = 180 # Set to 180 days

# Define the local time zone (America/Chicago)
CST_TZ = pytz.timezone('America/Chicago')
LUNAR_CYCLE_DAYS = 29.530588 # Precise synodic period

# --- FUNCTION TO FIND LAST NEW MOON (Reference Point) ---
def get_last_new_moon_utc(location):
    # Start searching backwards from the current moment
    location.date = datetime.now(pytz.utc).replace(tzinfo=None)
    
    # Use ephem.previous_new_moon to find the exact moment
    last_new_moon_moment = ephem.previous_new_moon(location.date).datetime()
    return last_new_moon_moment
# ----------------------------------------


def calculate_data():
    full_data = {}
    
    # DETERMINE TODAY'S DATE IN LOCAL TIME (CST)
    now_cst = datetime.now(CST_TZ)
    start_date_cst = now_cst.date()

    # Define a temporary location object for finding the New Moon
    temp_location = ephem.Observer()
    temp_location.lat = LATITUDE
    temp_location.lon = LONGITUDE
    
    # Find the precise UTC time of the last New Moon - THIS IS OUR EPOCH
    last_new_moon_utc = get_last_new_moon_utc(temp_location)
    
    # Define Moon object globally for the loop
    moon = ephem.Moon()

    for i in range(DAYS_TO_CALCULATE):
        target_date_cst = start_date_cst + timedelta(days=i)
        
        # --- Define the UTC 24-hour window corresponding to the target CST day ---
        target_start_utc = CST_TZ.localize(datetime.combine(target_date_cst, time(0, 0, 0))).astimezone(pytz.utc).replace(tzinfo=None)
        target_end_utc = target_start_utc + timedelta(days=1) - timedelta(seconds=1)
        
        # --- Define Observer and Celestial Bodies ---
        location = ephem.Observer()
        location.lat = LATITUDE
        location.lon = LONGITUDE
        
        # --- Search Events (Major/Minor) ---
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
        
        # --- Moon Phase, Illumination, and Age Calculation (FIXED) ---
        location.date = target_start_utc
        moon.compute(location)
        illum = moon.moon_phase * 100 
        
        # CRITICAL FIX: CALCULATE AGE RELATIVE TO NEW MOON EPOCH
        time_elapsed = target_start_utc - last_new_moon_utc
        # Convert total elapsed seconds to total days
        moon_age_calculated = time_elapsed.total_seconds() / 86400.0 
        
        # Use modulus to ensure the age cycles between 0.0 and 29.53
        # Store with 1 decimal place for precision
        moon_age = round(moon_age_calculated % LUNAR_CYCLE_DAYS, 1) 

        # --- Final Data Collation (FIXED: Includes every day and uses None for missing events) ---
        data_key = target_date_cst.strftime("%Y-%m-%d")

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
            "moon_age": moon_age, # Now calculated relative to the true New Moon
        }

    # Write the data to a JSON file
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(full_data, f, indent=4)
        
    print(f"Successfully calculated and saved {len(full_data)} days of data to {OUTPUT_FILE}")

if __name__ == "__main__":
    calculate_data()
