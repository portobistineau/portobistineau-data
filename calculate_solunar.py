import ephem
import json
from datetime import datetime, timedelta

# --- Configuration ---
LATITUDE = '32.4066'  # Replace with your target latitude
LONGITUDE = '-93.3906' # Replace with your target longitude
OUTPUT_FILE = 'solunar_data.json'
DAYS_TO_CALCULATE = 3

def calculate_data():
    """Calculates moon transits for the next few days."""
    data = []
    
    # Set up the observer (your location)
    location = ephem.Observer()
    location.lat = LATITUDE
    location.lon = LONGITUDE
    
    # Start date for calculation
    start_date = datetime.now().date()

    for i in range(DAYS_TO_CALCULATE):
        date = start_date + timedelta(days=i)
        location.date = date

        # Calculate Moon Transit (a Major Period) - FIX IS HERE
        moon = ephem.Moon() # Define the Moon object
        location.next_transit(moon) # Calculate and set the time
        
        # Now use the Moon object's datetime property for the time
        next_transit_dt = ephem.date(moon.transit_time).datetime().strftime("%Y-%m-%d %H:%M:%S UTC")

        data.append({
            "date": date.strftime("%Y-%m-%d"),
            "major_time_utc": next_transit_dt,
            "info": "This is a placeholder for a full solunar calculation."
        })
    
    # Write the data to a JSON file
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(data, f, indent=4)
        
    print(f"Successfully calculated and saved {len(data)} days of data to {OUTPUT_FILE}")

if __name__ == "__main__":
    calculate_data()
