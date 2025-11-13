import json
from datetime import datetime, timedelta
import pytz
from pysolunar import Solunar

# --- Configuration ---
LATITUDE = 32.4619
LONGITUDE = -93.3486
TIMEZONE_NAME = 'America/Chicago'  # Central Standard Time (CST/CDT)
CST_TIMEZONE = pytz.timezone(TIMEZONE_NAME)

# Define the number of days to calculate (180 days for ~6 months)
DAYS_TO_CALCULATE = 180  # <-- Increased to 180 days

OUTPUT_FILE = 'solunar_data.json'
# ---------------------

def get_solunar_data():
    """Calculates solunar and moon data for the next 180 days."""
    
    # Start calculation from the current local date (midnight)
    now_cst = datetime.now(CST_TIMEZONE)
    target_date_cst = now_cst.date()
    
    full_data = {}
    
    for i in range(DAYS_TO_CALCULATE):
        current_date = target_date_cst + timedelta(days=i)
        
        # Instantiate Solunar object for the specific day
        s = Solunar(
            latitude=LATITUDE, 
            longitude=LONGITUDE, 
            date=current_date, 
            timezone=TIMEZONE_NAME
        )
        
        # Calculate Major and Minor periods (results are in local time)
        major_periods = s.major_periods()
        minor_periods = s.minor_periods()
        
        # Get Moon Data
        moon_data = s.moon_data()

        # Convert local datetimes to UTC ISO 8601 strings
        def to_utc_iso(dt_local):
            if not dt_local:
                return None
            # Convert local time to UTC then format as ISO 8601 string (with 'Z')
            return dt_local.astimezone(pytz.utc).isoformat()
        
        # Data dictionary for the current day
        data = {
            "date": current_date.isoformat(),
            "major_1_utc": to_utc_iso(major_periods[0][0]) if major_periods and len(major_periods) > 0 else None,
            "major_2_utc": to_utc_iso(major_periods[1][0]) if major_periods and len(major_periods) > 1 else None,
            "minor_1_utc": to_utc_iso(minor_periods[0][0]) if minor_periods and len(minor_periods) > 0 else None,
            "minor_2_utc": to_utc_iso(minor_periods[1][0]) if minor_periods and len(minor_periods) > 1 else None,
            "moon_illum": moon_data['illumination'],
            "moon_age": moon_data['moon_age']
        }
        
        full_data[current_date.isoformat()] = data

    return full_data

def write_json_file(data):
    """Writes the full data dictionary to the JSON file."""
    try:
        with open(OUTPUT_FILE, 'w') as f:
            json.dump(data, f, indent=4)
        print(f"Successfully wrote data for {len(data)} days to {OUTPUT_FILE}")
    except Exception as e:
        print(f"Error writing JSON file: {e}")

if __name__ == "__main__":
    solunar_data = get_solunar_data()
    write_json_file(solunar_data)
