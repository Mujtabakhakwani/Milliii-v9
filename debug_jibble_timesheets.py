#!/usr/bin/env python3
"""
Debug script to see what Jibble Timesheets API actually returns
"""
import requests
import json
from datetime import datetime, timezone
import os
import sys

# Add backend to path
sys.path.insert(0, '/app/backend')

# Jibble Configuration
JIBBLE_CLIENT_ID = "bb44dda0-06ae-48c2-b0a8-f150da100f3a"
JIBBLE_CLIENT_SECRET = "VIdFvgcxpo2rL6JoSd982Jm4OxOYbXI4DsZA6-E4pNoL1hEP"
JIBBLE_WORKSPACE_API = "https://workspace.prod.jibble.io/v1"
JIBBLE_TIME_TRACKING_API = "https://time-tracking.prod.jibble.io/v1"
JIBBLE_TIME_ATTENDANCE_API = "https://time-attendance.prod.jibble.io/v1"
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

def debug_timesheets():
    """Debug the Timesheets API"""
    print("=" * 80)
    print("JIBBLE TIMESHEETS API DEBUG")
    print("=" * 80)
    
    # Get token
    print("\n1. Getting Bearer token...")
    bearer_token = get_bearer_token()
    if not bearer_token:
        print("❌ Failed to get bearer token")
        return
    print("✅ Got bearer token")
    
    # Get timesheets for today
    today = datetime.now(timezone.utc).date().isoformat()
    print(f"\n2. Fetching timesheets for date: {today}")
    
    # Try different timesheet endpoints with correct API bases
    endpoints_to_try = [
        (JIBBLE_TIME_ATTENDANCE_API, f"/TimeSheets?date={today}"),
        (JIBBLE_TIME_ATTENDANCE_API, f"/TimesheetsSummary?period=Custom&date={today}&endDate={today}"),
        (JIBBLE_TIME_TRACKING_API, f"/TimeEntries?$filter=date eq {today}"),
        (JIBBLE_WORKSPACE_API, f"/TimeSheets?date={today}"),
    ]
    
    response = None
    working_endpoint = None
    
    for api_base, endpoint in endpoints_to_try:
        print(f"   Trying: {api_base}{endpoint}")
        resp = requests.get(
            f"{api_base}{endpoint}",
            headers={
                "Authorization": f"Bearer {bearer_token}",
                "Content-Type": "application/json"
            },
            timeout=10
        )
        print(f"   Status: {resp.status_code}")
        if resp.status_code == 200:
            response = resp
            working_endpoint = f"{api_base}{endpoint}"
            print(f"   ✅ Found working endpoint!")
            break
    
    if not response:
        print("\n❌ None of the endpoints worked")
        return
    
    print(f"   Status Code: {response.status_code}")
    print(f"   Working endpoint: {working_endpoint}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"\n3. Response Type: {type(data)}")
        print(f"\n4. Response Keys: {data.keys() if isinstance(data, dict) else 'N/A (list)'}")
        
        # Check if OData format
        if isinstance(data, dict) and 'value' in data:
            print("\n5. OData format detected - extracting 'value' array")
            timesheets = data['value']
        elif isinstance(data, list):
            print("\n5. Direct list format")
            timesheets = data
        else:
            print("\n5. Unexpected format")
            timesheets = []
        
        print(f"\n6. Number of timesheets: {len(timesheets)}")
        
        if timesheets:
            print(f"\n7. First timesheet sample:")
            print(json.dumps(timesheets[0], indent=2, default=str))
            
            # Analyze structure
            first = timesheets[0]
            print(f"\n8. Timesheet keys: {first.keys()}")
            
            if 'entries' in first:
                print(f"\n9. Entries count: {len(first['entries'])}")
                if first['entries']:
                    print(f"\n10. First entry sample:")
                    print(json.dumps(first['entries'][0], indent=2, default=str))
        else:
            print("\n7. No timesheets returned")
            print("\nTrying different date formats...")
            
            # Try with different date formats
            from datetime import timedelta
            for days_back in range(7):
                date = (datetime.now(timezone.utc) - timedelta(days=days_back)).date().isoformat()
                resp = requests.get(
                    f"{JIBBLE_API_BASE}/TimeSheets?date={date}",
                    headers={
                        "Authorization": f"Bearer {bearer_token}",
                        "Content-Type": "application/json"
                    },
                    timeout=10
                )
                
                if resp.status_code == 200:
                    d = resp.json()
                    sheets = d.get('value', d) if isinstance(d, dict) else d
                    if sheets:
                        print(f"\n   ✅ Found timesheets for {date}: {len(sheets)} entries")
                        break
                    else:
                        print(f"   ❌ No timesheets for {date}")
    else:
        print(f"\n❌ Failed to fetch timesheets: {response.text}")

if __name__ == "__main__":
    debug_timesheets()
