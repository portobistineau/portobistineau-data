import ephem
from datetime import datetime, timedelta, time
import json

# --- Configuration (Set your time and location) ---
# NOTE: The date calculation here needs to handle your local timezone correctly!
LATITUDE = '32.4619'  
LONGITUDE = '-93.3486'
OUTPUT_FILE = 'solunar_data.json'
DAYS_TO_CALCULATE = 3

def calculate_data():
    full_data = {}
    
    # 1. Start the calculation one day prior to ensure we catch all transits/rises
    start_date = datetime.now().date() - timedelta(days=1)

    for i in range(DAYS_TO_CALCULATE + 2): # Calculate for a 4 day window to handle boundary conditions
        target_date = start_date + timedelta(days=i)
        
        # --- Define Observer and Celestial Bodies ---
        location = ephem.Observer()
        location.lat = LATITUDE
        location.lon = LONGITUDE
        location.date = target_date # Set starting point for search

        moon = ephem.Moon()
        sun = ephem.Sun()
        
        # --- Calculate Moon Phase and Illumination (Once Per Day) ---
        # Note: PyEphem gives the phase *relative to* the date set on the observer.
        moon.compute(location)
        illum = moon.moon_phase * 100 # moon_phase is the fraction illuminated
        # For a full phase name, you'd need external logic/lookup table

        # --- Major Periods (Transit/Anti-transit) ---
        majors = []
        
        # Search forward for the next two Upper Transits (Meridian Crossing)
        # and the next two Lower Transits (Anti-Meridian) from the start of the day
        t1 = location.next_transit(moon)
        t2 = location.next_antitransit(moon)
        
        # Find the next two transits/anti-transits, sort them, and filter to the target date
        # This requires more complex root finding or iterative search over the 48-hour period
        
        # For now, let's keep the simple approach and fix the date filtering:
        
        # A simple method: calculate 4 major events starting from the day before
        start_search = target_date - timedelta(hours=12) # Search from midday before
        location.date = start_search
        
        major_events = []
        for _ in range(4):
            # Calculate next transit (Upper)
            t = location.next_transit(moon, start=location.date)
            major_events.append(t.datetime())
            location.date = t + ephem.minute # Advance search by one minute
            
            # Calculate next anti-transit (Lower)
            a = location.next_antitransit(moon, start=location.date)
            major_events.append(a.datetime())
            location.date = a + ephem.minute
            
        # Filter and sort to events that fall on the target date (00:00:00 to 23:59:59)
        major_events = sorted([
            dt for dt in major_events if dt.date() == target_date
        ])
        
        # --- Minor Periods (Moonrise/Moonset) ---
        minors = []
        
        # PyEphem sometimes struggles with the exact time of rise/set if it's near the pole/horizon
        try:
            r = location.next_rising(moon)
            minors.append(r.datetime())
        except ephem.AlwaysUpError: pass
        except ephem.NeverUpError: pass
        
        try:
            s = location.next_setting(moon)
            minors.append(s.datetime())
        except ephem.AlwaysUpError: pass
        except ephem.NeverUpError: pass
        
        # Filter and sort minor events for the target date
        minor_events = sorted([
            dt for dt in minors if dt.date() == target_date
        ])
        
        # --- Final Data Collation (Only for the target date) ---
        data_key = target_date.strftime("%Y-%m-%d")
        if target_date.date() == datetime.now().date(): # Only store data for today and tomorrow, etc.
            full_data[data_key] = {
                "date": data_key,
                # Format to ISO 8601 UTC string for easy JS handling
                "major_1_utc": major_events[0].isoformat() + "Z" if len(major_events) > 0 else None,
                "major_2_utc": major_events[1].isoformat() + "Z" if len(major_events) > 1 else None,
                "minor_1_utc": minor_events[0].isoformat() + "Z" if len(minor_events) > 0 else None,
                "minor_2_utc": minor_events[1].isoformat() + "Z" if len(minor_events) > 1 else None,
                "moon_illum": round(illum, 1),
                "moon_age": round(moon.moon_phase * 29.53), # Age in days (0-30)
            }

    # Write the data to a JSON file (Filtered data will be stored)
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(full_data, f, indent=4)
        
    print(f"Successfully calculated and saved data to {OUTPUT_FILE}")

if __name__ == "__main__":
    calculate_data()
