import json
from datetime import datetime, timedelta, timezone

def build_moon_urls(days_ahead=90):
    """
    Calculates the NASA MVG URL for each day starting today
    and saves them to moon_urls.json.
    
    The script dynamically handles the year rollover and uses the final 
    MVG offset correction (0) to align the calculation with the observed NASA indices.
    """
    
    # --- Configuration ---
    # The final, correct offset. A value of 0 means the base calculation 
    # (Total Hours Elapsed + 1) already aligns perfectly with the NASA MVG sequence.
    MVG_CORRECTION_HOURS = 0
    
    urls = {}
    
    # --- CALCULATE BASE START DATE ---
    # We use the current date at a stable time (12:00 PM UTC) to start the indexing.
    # This prevents timezone issues in the calculation.
    base_start_date = datetime.now(timezone.utc).replace(hour=12, minute=0, second=0, microsecond=0)

    # Initialize the start of the year based on the current year
    start_of_year_utc = datetime(base_start_date.year, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    
    # Iterate through the desired date range
    for i in range(days_ahead):
        
        # Advance the date from the base start.
        target_date_utc = base_start_date + timedelta(days=i)
        
        # --- YEAR ROLLOVER LOGIC ---
        current_year = target_date_utc.year 
        
        # If the year changes in the loop (e.g., from 2025 to 2026), 
        # reset the start_of_year_utc to the new year for correct frame counting.
        if current_year != start_of_year_utc.year:
             start_of_year_utc = datetime(current_year, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        
        # Calculate total hours elapsed since Jan 1, 00:00 UTC OF THE TARGET YEAR
        time_difference = target_date_utc - start_of_year_utc
        hours_elapsed = int(time_difference.total_seconds() / 3600)
        
        # Calculate the MVG Frame Number: (Hours Elapsed + 1) + Correction
        frame_num = hours_elapsed + 1 + MVG_CORRECTION_HOURS
        
        # Format for URL construction
        frame_str = str(frame_num).zfill(4)
        date_key = target_date_utc.strftime('%Y-%m-%d')
        
        # Use the current_year in the URL prefix (e.g., mvg.2026)
        nasa_url = f"https://moon.nasa.gov/mvg.{current_year}/{frame_str}.jpg"
        
        urls[date_key] = nasa_url

    # --- Save to JSON ---
    with open('moon_urls.json', 'w') as f:
        json.dump(urls, f, indent=4)
        
    print(f"Successfully generated {len(urls)} Moon URLs into moon_urls.json.")

if __name__ == '__main__':
    # Generating URLs for the next 90 days (approx. 3 months)
    build_moon_urls(days_ahead=90)
