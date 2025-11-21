import json
from datetime import datetime, timedelta, timezone

def build_moon_urls(days_ahead=90):
    """
    Calculates the NASA MVG URL for each day starting today
    and saves them to moon_urls.json.
    
    The calculation is based on the total hours elapsed since Jan 1, 00:00 UTC,
    plus a fixed offset that aligns the formula with the NASA MVG sequence index.
    """
    
    # --- Configuration ---
    # The final, correct offset. A value of 0 means the base calculation 
    # (Hours Elapsed + 1) already aligns perfectly with the NASA index.
    MVG_CORRECTION_HOURS = 0
    
    urls = {}
    
    # --- CALCULATE BASE START DATE ---
    # We use the current date at a stable time (12:00 PM UTC) to start the indexing.
    # This prevents timezone issues in the calculation.
    base_start_date = datetime.now(timezone.utc).replace(hour=12, minute=0, second=0, microsecond=0)

    year = base_start_date.year
    start_of_year_utc = datetime(year, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    
    # Iterate through the desired date range (starting with today's date)
    for i in range(days_ahead):
        
        # Advance the date from the base start.
        target_date_utc = base_start_date + timedelta(days=i)
        
        # Calculate total hours elapsed since Jan 1, 00:00 UTC
        time_difference = target_date_utc - start_of_year_utc
        hours_elapsed = int(time_difference.total_seconds() / 3600)
        
        # Calculate the MVG Frame Number: (Hours Elapsed + 1) + Correction
        frame_num = hours_elapsed + 1 + MVG_CORRECTION_HOURS
        
        # Format for URL construction
        frame_str = str(frame_num).zfill(4)
        
        # Format the date key to YYYY-MM-DD
        # We target the date key based on the local date the user sees. 
        # Since the calculation uses a stable 12:00 PM UTC time, simply formatting 
        # the date key from the base time provides the correct date string.
        date_key = target_date_utc.strftime('%Y-%m-%d')
        
        nasa_url = f"https://moon.nasa.gov/mvg.{year}/{frame_str}.jpg"
        
        urls[date_key] = nasa_url

    # --- Save to JSON ---
    with open('moon_urls.json', 'w') as f:
        json.dump(urls, f, indent=4)
        
    print(f"Successfully generated {len(urls)} Moon URLs into moon_urls.json.")

if __name__ == '__main__':
    # Generating URLs for the next 90 days (approx. 3 months)
    build_moon_urls(days_ahead=90)
