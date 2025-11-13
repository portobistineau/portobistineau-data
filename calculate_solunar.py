import ephem
from datetime import datetime, timedelta, time
import json
import pytz # Import pytz for proper timezone handling if needed later

# --- Configuration ---
# Your location for Minden, Louisiana:
LATITUDE = '32.4619'  
LONGITUDE = '-93.3486'
OUTPUT_FILE = 'solunar_data.json'
# We calculate for 3 days starting from today to ensure future data is available
DAYS_TO_CALCULATE = 3 

def calculate_data():
    full_data = {}
    
    # Start the calculation from the current date
    start_date = datetime.now().date() 

    for i in range(DAYS_TO_CALCULATE):
        target_date = start_date + timedelta(days=i)
        
        # Set the observer time to the START of the target day (00:00:00 UTC)
        # Note: PyEphem uses UTC implicitly for its date/time calculations.
        start_of_day = datetime.combine(target_date, time(0, 0, 0))
        
        location = ephem.Observer()
        location.lat = LATITUDE
        location.lon = LONGITUDE
        location.date = start_of_day
        
        moon = ephem.Moon()
        
        # --- Moon Phase and Illumination ---
        # Compute the moon for the start of the day
        moon.compute(location)
        illum = moon.moon_phase * 100 
        moon_age = round(moon.moon_phase * 29.53) 
        
        # --- Major Periods (Transit/Anti-transit) ---
        major_events = []
        
        # 1. Find the FIRST event (Transit or Anti-transit) after 00:00 UTC
        try:
            e1_t = location.next_transit(moon, start=start_of_day)
            e1_a = location.next_antitransit(moon, start=start_of_day)
            
            first_event = min(e1_t, e1_a)
            if first_event.datetime().date() == target_date:
                major_events.append(first_event.datetime())
            else:
                # If the first event is tomorrow, skip to the next event
                location.date = first_event + ephem.minute
        except Exception:
            pass # Handle case where an event might be missed
            
        # 2. Find the SECOND event (Transit or Anti-transit) after the first one
        if major_events:
            location.date = major_events[-1] + timedelta(minutes=1)
            
            try:
                e2_t = location.next_transit(moon, start=location.date)
                e2_a = location.next_antitransit(moon, start=location.date)
                
                second_event = min(e2_t, e2_a)
                if second_event.datetime().date() == target_date:
                    major_events.append(second_event.datetime())
            except Exception:
                pass

        major_events.sort()
        
        # --- Minor Periods (Moonrise/Moonset) ---
        minor_events = []
        
        # 1. Find the FIRST Moonrise/Moonset after 00:00 UTC
        try:
            r1 = location.next_rising(moon, start=start_of_day)
            minor_events.append(r1.datetime())
        except ephem.AlwaysUpError: pass
        except ephem.NeverUpError: pass
        
        try:
            s1 = location.next_setting(moon, start=start_of_day)
            minor_events.append(s1.datetime())
        except ephem.AlwaysUpError: pass
        except ephem.NeverUpError: pass
        
        # 2. Find the SECOND Moonrise/Moonset after the first one
        if minor_events:
            next_start = max(minor_events) + timedelta(minutes=1)
            location.date = next_start 
            
            try:
                r2 = location.next_rising(moon, start=location.date)
                if r2.datetime().date() == target_date:
                    minor_events.append(r2.datetime())
            except ephem.AlwaysUpError: pass
            except ephem.NeverUpError: pass
            
            try:
                s2 = location.next_setting(moon, start=location.date)
                if s2.datetime().date() == target_date:
                    minor_events.append(s2.datetime())
            except ephem.AlwaysUpError: pass
            except ephem.NeverUpError: pass

        minor_events.sort()

        # --- Final Data Collation ---
        data_key = target_date.strftime("%Y-%m-%d")
        
        # Only store data if we found at least one major event on the target day
        if len(major_events) > 0 and major_events[0].date() == target_date:
            full_data[data_key] = {
                "date": data_key,
                # Format to ISO 8601 UTC string for easy JS handling
                "major_1_utc": major_events[0].isoformat() + "Z",
                "major_2_utc": major_events[1].isoformat() + "Z" if len(major_events) > 1 else None,
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
