import json
from datetime import datetime, timedelta, timezone

def build_moon_urls(days_ahead=40):
    """
    Calculates the NASA MVG URL for each day starting today
    and saves them to moon_urls.json.
    """
    
    # --- Configuration ---
    # The necessary hour correction found through debugging: 
    # MVG index = Total Hours Elapsed since Jan 1 UTC - 12
    MVG_CORRECTION_HOURS = -12
    
    urls = {}
    
    # Find the start of the year in UTC
    year = datetime.now(timezone.utc).year
    start_of_year_utc = datetime(year, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    
    # Iterate through the desired date range (e.g., today + 40 days)
    for i in range(days_ahead):
        # We target 12:00 PM UTC for the day's image index 
        # (A stable time that ensures we are past the daily update threshold)
        target_date_utc = datetime.now(timezone.utc).replace(hour=12, minute=0, second=0, microsecond=0) + timedelta(days=i)
        
        # Calculate total hours elapsed since Jan 1, 00:00 UTC
        # This gives us the total number of full hours elapsed.
        time_difference = target_date_utc - start_of_year_utc
        
        # Convert difference to total hours
        hours_elapsed = int(time_difference.total_seconds() / 3600)
        
        # Calculate the MVG Frame Number: (Hours Elapsed + 1) + Correction
        frame_num = hours_elapsed + 1 + MVG_CORRECTION_HOURS
        
        # Format for URL construction
        frame_str = str(frame_num).zfill(4)
        date_key = target_date_utc.strftime('%Y-%m-%d')
        
        # Construct the final NASA MVG URL
        nasa_url = f"https://moon.nasa.gov/mvg.{year}/{frame_str}.jpg"
        
        urls[date_key] = nasa_url

    # --- Save to JSON ---
    with open('moon_urls.json', 'w') as f:
        json.dump(urls, f, indent=4)
        
    print(f"Successfully generated {len(urls)} Moon URLs into moon_urls.json.")

if __name__ == '__main__':
    # Generate URLs for the next 40 days
    build_moon_urls(days_ahead=40)
