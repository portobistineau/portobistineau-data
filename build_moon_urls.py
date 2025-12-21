import json
from datetime import datetime, timedelta, timezone

def build_moon_urls(days_ahead=91):
    """
    Calculates the NASA MVG URL for each day starting from YESTERDAY
    to ensure timezone overlap coverage, and saves them to moon_urls.json.
    """
    
    # --- Configuration ---
    MVG_CORRECTION_HOURS = 0
    urls = {}
    
    # --- CALCULATE BASE START DATE ---
    # FIX: Subtract 1 day from current time to include "yesterday" (UTC).
    # This covers the ~5 hour gap for Central Time users after the UTC rollover.
    now_utc = datetime.now(timezone.utc)
    base_start_date = (now_utc - timedelta(days=1)).replace(hour=12, minute=0, second=0, microsecond=0)

    # Initialize the start of the year based on the current year
    start_of_year_utc = datetime(base_start_date.year, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    
    # Iterate through the range (91 days to keep a full 3-month window + the buffer)
    for i in range(days_ahead):
        
        target_date_utc = base_start_date + timedelta(days=i)
        current_year = target_date_utc.year 
        
        if current_year != start_of_year_utc.year:
             start_of_year_utc = datetime(current_year, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        
        # Calculate total hours elapsed
        time_difference = target_date_utc - start_of_year_utc
        hours_elapsed = int(time_difference.total_seconds() / 3600)
        
        # Calculate Frame Number
        frame_num = hours_elapsed + 1 + MVG_CORRECTION_HOURS
        frame_str = str(frame_num).zfill(4)
        date_key = target_date_utc.strftime('%Y-%m-%d')
        
        # --- URL LOGIC ---
        # 2025 uses the standard shortcut. 
        # 2026 uses the direct SVS 5587 path because the shortcut isn't live yet.
        if current_year == 2025:
            nasa_url = f"https://moon.nasa.gov/mvg.2025/{frame_str}.jpg"
        else:
            # Found them! Using SVS ID 5587 for 2026 images.
            nasa_url = f"https://svs.gsfc.nasa.gov/vis/a000000/a005500/a005587/frames/730x730_1x1_30p/moon.{frame_str}.jpg"
        
        urls[date_key] = nasa_url

    # --- Save to JSON ---
    with open('moon_urls.json', 'w') as f:
        json.dump(urls, f, indent=4)
        
    print(f"Successfully generated {len(urls)} Moon URLs starting from {base_start_date.strftime('%Y-%m-%d')}.")

if __name__ == '__main__':
    build_moon_urls(days_ahead=91)
