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
        # target_start_utc is roughly 05:00 UTC (12:00 AM CST)
        target_start_utc = CST_TZ.localize(datetime.combine(target_date_cst, time(0, 0, 0))).astimezone(pytz.utc).replace(tzinfo=None)
        target_end_utc = target_start_utc + timedelta(days=1)
        
        # --- Define Observer and Celestial Bodies ---
        location = ephem.Observer()
        location.lat = LATITUDE
        location.lon = LONGITUDE
        
        # Search window is wider than the target day to catch events that cross midnight
        search_start = target_start_utc - timedelta(hours=12)
        
        # Lists for Solunar Periods (combined Transit/Antitransit and Rise/Set)
        all_major_events = [] 
        all_minor_events = [] 
        
        # Variables for Moon Data Display (specific events)
        moon_rise_utc = None
        moon_set_utc = None
        moon_overhead_utc = None
        moon_underfoot_utc = None
        
        # Set initial search date for all searches
        location.date = search_start

        # --- 1. Find Transits (Major Period Basis & Overhead/Underfoot) ---
        
        # Search for the first two transits/antitransits that fall within or near the day
        for _ in range(6): # Loop to find up to 6 events
            
            # Find next Upper Transit (Overhead)
            try:
                t = location.next_transit(moon)
                if t.datetime() < target_end_utc:
                    all_major_events.append(t.datetime())
                    if t.datetime() >= target_start_utc and not moon_overhead_utc:
                        # Only assign for display if it occurs within the target UTC day window
                        moon_overhead_utc = t.datetime()
                location.date = t + ephem.minute
            except StopIteration: break
            
            # Find next Lower Transit (Underfoot)
            try:
                a = location.next_antitransit(moon)
                if a.datetime() < target_end_utc:
                    all_major_events.append(a.datetime())
                    if a.datetime() >= target_start_utc and not moon_underfoot_utc:
                        # Only assign for display if it occurs within the target UTC day window
                        moon_underfoot_utc = a.datetime()
                location.date = a + ephem.minute
            except StopIteration: break
            
        # --- 2. Find Rise and Set (Minor Period Basis & Display FIX) ---
        
        # We search a 48-hour window (from 12h before start to 36h after start) to ensure we capture all potential events.
        search_start_dt = target_start_utc - timedelta(hours=12)
        search_end_dt = target_end_utc + timedelta(hours=24) 

        current_date = search_start_dt
        rises_list = []
        sets_list = []

        # Collect up to 3 Rising events within the extended window
        for _ in range(3):
            try:
                r = location.next_rising(moon, start=current_date)
                r_dt = r.datetime()
                
                if r_dt < search_end_dt:
                    rises_list.append(r_dt)
                    all_minor_events.append(r_dt)
                    current_date = r_dt + timedelta(minutes=1)
                else:
                    break
            except StopIteration: break
            except Exception: break
            
        # Reset and collect up to 3 Setting events within the extended window
        current_date = search_start_dt
        for _ in range(3):
            try:
                s = location.next_setting(moon, start=current_date)
                s_dt = s.datetime()
                
                if s_dt < search_end_dt:
                    sets_list.append(s_dt)
                    all_minor_events.append(s_dt)
                    current_date = s_dt + timedelta(minutes=1)
                else:
                    break
            except StopIteration: break
            except Exception: break
            
        # Filter Major/Minor Events for the Period Centers 
        major_events_filtered = sorted([
            dt for dt in all_major_events 
            if dt >= target_start_utc and dt < target_end_utc
        ])
        
        # Minor Period Centers MUST fall within the target 24h UTC window
        minor_events_filtered = sorted([
            dt for dt in all_minor_events 
            if dt >= target_start_utc and dt < target_end_utc
        ])
        
        # Assign Display Variables (First rise/set that occurs ON OR AFTER the target CST day starts)
        
        # Moon Rise Display: Find the first rise event *on or after* the target CST day start
        for dt in sorted(rises_list):
            if dt >= target_start_utc:
                moon_rise_utc = dt
                break
                
        # Moon Set Display: Find the first set event *on or after* the target CST day start
        for dt in sorted(sets_list):
            if dt >= target_start_utc:
                moon_set_utc = dt
                break


        # Helper to format datetime objects or return None
        def format_utc(dt):
            if isinstance(dt, datetime):
                # Ensure it's timezone-aware UTC before formatting
                return dt.isoformat() + "Z"
            return None

        # --- Moon Phase, Illumination, and Age Calculation ---
        location.date = target_start_utc
        moon.compute(location)
        illum = moon.moon_phase * 100
        
        # CRITICAL FIX: CALCULATE AGE RELATIVE TO NEW MOON EPOCH
        time_elapsed = target_start_utc - last_new_moon_utc
        moon_age_calculated = time_elapsed.total_seconds() / 86400.0
        moon_age = round(moon_age_calculated % LUNAR_CYCLE_DAYS, 1)

        # --- Final Data Collation ---
        data_key = target_date_cst.strftime("%Y-%m-%d")

        full_data[data_key] = {
            "date": data_key,
            
            # Major/Minor period centers (as before, based on chronological order of transits/rise/set)
            "major_1_utc": format_utc(major_events_filtered[0]) if len(major_events_filtered) > 0 else None,
            "major_2_utc": format_utc(major_events_filtered[1]) if len(major_events_filtered) > 1 else None,
            
            "minor_1_utc": format_utc(minor_events_filtered[0]) if len(minor_events_filtered) > 0 else None,
            "minor_2_utc": format_utc(minor_events_filtered[1]) if len(minor_events_filtered) > 1 else None,
            
            # NEW: Specific Moon Event Times for display (Now fixed to capture cross-day events)
            "moon_rise_utc": format_utc(moon_rise_utc),
            "moon_set_utc": format_utc(moon_set_utc),
            "moon_overhead_utc": format_utc(moon_overhead_utc),
            "moon_underfoot_utc": format_utc(moon_underfoot_utc),
            
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
