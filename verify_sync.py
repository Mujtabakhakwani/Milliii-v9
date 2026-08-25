#!/usr/bin/env python3
"""
Verify that Jibble sync created users in the database
"""

import requests
import json

# Configuration
BACKEND_URL = "https://project-scanner-10.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

def verify_sync():
    # Login as admin
    admin_credentials = {
        "email": "admin@millionaze.com",
        "password": "admin123"
    }
    
    session = requests.Session()
    response = session.post(f"{API_BASE}/auth/login", json=admin_credentials)
    
    if response.status_code != 200:
        print("❌ Failed to login as admin")
        return
    
    admin_token = response.json()['access_token']
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Get all users
    response = session.get(f"{API_BASE}/users", headers=headers)
    
    if response.status_code == 200:
        users = response.json()
        print(f"✅ Total users in database: {len(users)}")
        
        # Count synced users
        synced_users = [u for u in users if u.get('email') and '@' in u['email']]
        print(f"✅ Users with valid emails: {len(synced_users)}")
        
        # Show some examples
        print("\n📋 Sample users:")
        for i, user in enumerate(users[:5]):
            print(f"  {i+1}. {user['name']} ({user['email']}) - Role: {user['role']}")
            
    else:
        print(f"❌ Failed to get users: {response.status_code}")

if __name__ == "__main__":
    verify_sync()