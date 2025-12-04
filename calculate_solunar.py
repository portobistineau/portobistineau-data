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
        target_end_utc = target_start_utc + timedelta(days=1)
        
        # --- Define Observer and Celestial Bodies ---
        location = ephem.Observer()
        location.lat = LATITUDE
        location.lon = LONGITUDE
        
        # Search window is wider than the target day to catch events that cross midnight
        search_start = target_start_utc - timedelta(hours=12)
        
        # Lists for Solunar Periods
        all_major_events = [] 
        all_minor_events = [] 
        
        # Variables for Moon Data Display
        moon_rise_utc = None
        moon_set_utc = None
        moon_overhead_utc = None
        moon_underfoot_utc = None
        
        # Exact Phase Moment Variables (New Addition)
        phase_moment_utc = None
        phase_type = None
        
        # Set initial search date for all searches
        location.date = search_start

        # --- 1. Find Transits and Rise/Set (Omitted detailed transit search for brevity, assuming existing correct logic) ---
        # ... (Your existing Transit and Rise/Set logic goes here, which populates all_major_events, all_minor_events, etc.)
        
        # NOTE: For the purpose of providing the full, runnable file, the transit/rise/set search 
        # loops have been condensed but must remain in your file to calculate solunar times.
        # We will assume your existing loops populate these lists correctly:

        # Example replacement for Transit Search:
        location.date = search_start
        for _ in range(6): # Find Upper Transit
            try:
                t = location.next_transit(moon)
                if t.datetime() < target_end_utc:
                    all_major_events.append(t.datetime())
                    if t.datetime() >= target_start_utc and not moon_overhead_utc:
                        moon_overhead_utc = t.datetime()
                location.date = t + ephem.minute
            except StopIteration: break
        
        # Example replacement for Antitransit Search:
        location.date = search_start
        for _ in range(6): # Find Lower Transit
            try:
                a = location.next_antitransit(moon)
                if a.datetime() < target_end_utc:
                    all_major_events.append(a.datetime())
                    if a.datetime() >= target_start_utc and not moon_underfoot_utc:
                        moon_underfoot_utc = a.datetime()
                location.date = a + ephem.minute
            except StopIteration: break

        # Example replacement for Rise/Set Search (simplified):
        # ... (Your detailed rise/set loops should remain here)
        
        # Filter Major/Minor Events for the Period Centers 
        major_events_filtered = sorted([
            dt for dt in all_major_events 
            if dt >= target_start_utc and dt < target_end_utc
        ])
        minor_events_filtered = sorted([
            dt for dt in all_minor_events 
            if dt >= target_start_utc and dt < target_end_utc
        ])
        
        # --- 2. Find Exact Primary Phase Moment (NEW ADDITION) ---
        
        # Search for the next phase starting 12 hours before the start of the day
        search_start_time = target_start_utc - timedelta(hours=12)
        
        # ephem.next_phase() returns the precise time of the next phase change (0, 90, 180, 270 deg)
        # We search four times to find the next primary phase (New, First Q, Full, Last Q)
        for j in range(4):
            try:
                # ephem.Moon() is the body, search_start_time is where to begin, j * ephem.half_moon sets the angle
                p = ephem.next_phase(moon, search_start_time, j * ephem.half_moon)
                p_dt = p.datetime()
                
                # If the phase occurs within the target 24-hour UTC window
                if p_dt >= target_start_utc and p_dt < target_end_utc:
                    phase_moment_utc = p_dt
                    
                    # Determine the type of phase based on which iteration (j) found it
                    if j == 0: phase_type = "New Moon"
                    elif j == 1: phase_type = "First Quarter"
                    elif j == 2: phase_type = "Full Moon"
                    elif j == 3: phase_type = "Last Quarter"
                    
                    # We found a phase for today, stop searching
                    break 
            except Exception:
                continue

        # Helper to format datetime objects or return None
        def format_utc(dt):
            if isinstance(dt, datetime):
                # Ensure it's timezone-aware UTC before formatting
                return dt.isoformat() + "Z"
            return None

        # --- 3. Moon Phase, Illumination, and Age Calculation (FIXED AT NOON UTC and HIGH PRECISION) ---
        illum_calc_time_utc = datetime.combine(target_start_utc.date(), time(12, 0, 0))
        
        location.date = illum_calc_time_utc
        moon.compute(location)
        illum = moon.moon_phase * 100
        
        time_elapsed = illum_calc_time_utc - last_new_moon_utc
        moon_age_calculated = time_elapsed.total_seconds() / 86400.0
        
        # INCREASE PRECISION TO 3 DECIMAL PLACES for both
        moon_age = round(moon_age_calculated % LUNAR_CYCLE_DAYS, 3) 
        illum_precise = round(illum, 3)

        # --- Final Data Collation ---
        data_key = target_date_cst.strftime("%Y-%m-%d")

        full_data[data_key] = {
            "date": data_key,
            
            # Solunar Period Centers
            "major_1_utc": format_utc(major_events_filtered[0]) if len(major_events_filtered) > 0 else None,
            "major_2_utc": format_utc(major_events_filtered[1]) if len(major_events_filtered) > 1 else None,
            "minor_1_utc": format_utc(minor_events_filtered[0]) if len(minor_events_filtered) > 0 else None,
            "minor_2_utc": format_utc(minor_events_filtered[1]) if len(minor_events_filtered) > 1 else None,
            
            # Specific Moon Event Times
            "moon_rise_utc": format_utc(moon_rise_utc),
            "moon_set_utc": format_utc(moon_set_utc),
            "moon_overhead_utc": format_utc(moon_overhead_utc),
            "moon_underfoot_utc": format_utc(moon_underfoot_utc),
            
            # Moon data (High Precision)
            "moon_illum": illum_precise, # 3 decimal places
            "moon_age": moon_age,       # 3 decimal places
            
            # Exact Phase Moment (NEW ADDITION)
            "phase_moment_utc": format_utc(phase_moment_utc),
            "phase_type": phase_type,
        }

    # Write the data to a JSON file
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(full_data, f, indent=4)
        
    print(f"Successfully calculated and saved {len(full_data)} days of data to {OUTPUT_FILE}")

if __name__ == "__main__":
    calculate_data()
