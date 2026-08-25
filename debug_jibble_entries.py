#!/usr/bin/env python3
"""
Debug script to check TimeEntries API for real-time status
"""
import requests
import json
from datetime import datetime, timezone, timedelta

# Jibble Configuration
JIBBLE_CLIENT_ID = "bb44dda0-06ae-48c2-b0a8-f150da100f3a"
JIBBLE_CLIENT_SECRET = "VIdFvgcxpo2rL6JoSd982Jm4OxOYbXI4DsZA6-E4pNoL1hEP"
JIBBLE_TIME_TRACKING_API = "https://time-tracking.prod.jibble.io/v1"
JIBBLE_TOKEN_URL = "https://identity.prod.jibble.io/connect/token"

def get_bearer_token():
    """Get Jibble Bearer token"""
    response = requests.post(
        JIBBLE_TOKEN_URL,
        data={
            'grant_type': 'client_credentials',
            'client_id': JIBBLE_CLIENT_ID,
            'client_secret': JIBBLE_CLIENT_SECRET
        },
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
        timeout=10
    )
    
    if response.status_code == 200:
        return response.json().get('access_token')
    return None

def check_time_entries():
    """Check TimeEntries API"""
    print("=" * 80)
    print("JIBBLE TIME ENTRIES API DEBUG")
    print("=" * 80)
    
    # Get token
    print("\n1. Getting Bearer token...")
    bearer_token = get_bearer_token()
    if not bearer_token:
        print("❌ Failed to get bearer token")
        return
    print("✅ Got bearer token")
    
    today = datetime.now(timezone.utc).date().isoformat()
    
    # Try different filters
    filters_to_try = [
        "$filter=out eq null",
        "$filter=endTime eq null", 
        f"$filter=date eq {today}",
        "",  # No filter - get all
    ]
    
    for filter_str in filters_to_try:
        print(f"\n2. Trying filter: {filter_str if filter_str else '(no filter)'}")
        
        url = f"{JIBBLE_TIME_TRACKING_API}/TimeEntries"
        if filter_str:
            url += f"?{filter_str}"
        
        response = requests.get(
            url,
            headers={
                "Authorization": f"Bearer {bearer_token}",
                "Content-Type": "application/json"
            },
            timeout=10
        )
        
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, dict) and 'value' in data:
                entries = data['value']
            elif isinstance(data, list):
                entries = data
            else:
                entries = []
            
            print(f"   Number of entries: {len(entries)}")
            
            if entries:
                print(f"\n   ✅ Found entries! Using this filter.")
                break
        else:
            print(f"   Error: {response.text[:200]}")
    
    if response.status_code != 200:
        print("\n❌ Could not fetch time entries")
        return
    
    if response.status_code == 200:
        data = response.json()
        print(f"\n3. Response Type: {type(data)}")
        
        if isinstance(data, dict) and 'value' in data:
            entries = data['value']
        elif isinstance(data, list):
            entries = data
        else:
            entries = []
        
        print(f"\n4. Number of active entries: {len(entries)}")
        
        if entries:
            print(f"\n5. First active entry sample:")
            print(json.dumps(entries[0], indent=2, default=str))
            
            # Show all active entries
            print(f"\n6. All active entries summary:")
            for i, entry in enumerate(entries):
                person_id = entry.get('personId', 'Unknown')
                start = entry.get('start', 'Unknown')
                activity = entry.get('activity', {})
                project = entry.get('project', {})
                is_break = entry.get('isBreak', False)
                
                status = "BREAK" if is_break else "IN"
                
                print(f"\n   Entry {i+1}:")
                print(f"   - PersonId: {person_id}")
                print(f"   - Status: {status}")
                print(f"   - Start: {start}")
                print(f"   - Activity: {activity.get('name', 'None')}")
                print(f"   - Project: {project.get('name', 'None')}")
        else:
            print("\n5. No active entries found (everyone is clocked out)")
    else:
        print(f"\n❌ Failed: {response.text}")

if __name__ == "__main__":
    check_time_entries()
