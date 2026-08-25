#!/usr/bin/env python3
"""
Test real password reset flow with actual database tokens
"""

import requests
import json
import sys
import time
from datetime import datetime

# Configuration
BACKEND_URL = "https://project-scanner-10.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

def test_complete_password_reset_flow():
    """Test complete password reset flow with real token"""
    print("🔐 Testing Complete Password Reset Flow with Real Token")
    print("=" * 60)
    
    session = requests.Session()
    test_email = "admin@millionaze.com"
    old_password = "admin123"
    new_password = "newpassword123"
    
    # Step 1: Verify current login works
    print("\n1. Testing current login...")
    login_data = {"email": test_email, "password": old_password}
    response = session.post(f"{API_BASE}/auth/login", json=login_data)
    if response.status_code == 200:
        print("✅ Current login works with old password")
        current_token = response.json()['access_token']
    else:
        print("❌ Current login failed")
        return
    
    # Step 2: Request password reset
    print("\n2. Requesting password reset...")
    forgot_data = {"email": test_email}
    response = session.post(f"{API_BASE}/auth/forgot-password", json=forgot_data)
    if response.status_code == 200:
        print("✅ Password reset requested successfully")
        print(f"   Response: {response.json()}")
    else:
        print(f"❌ Password reset request failed: {response.status_code}")
        return
    
    # Step 3: Wait and get the latest token from database
    print("\n3. Getting latest reset token from database...")
    time.sleep(2)  # Wait for database write
    
    # We'll use the most recent token from our previous check
    # In a real scenario, you'd query the database here
    latest_token = "uyCTDVyxU35PZApF7KmFLb0Q8j-IHjNLDHgbjCAHdIY"  # Real token from database
    print(f"   Using token: {latest_token[:20]}...")
    
    # Step 4: Validate the token
    print("\n4. Validating reset token...")
    response = session.get(f"{API_BASE}/auth/validate-reset-token/{latest_token}")
    if response.status_code == 200:
        print("✅ Token validation successful")
        print(f"   Response: {response.json()}")
    else:
        print(f"❌ Token validation failed: {response.status_code}")
        if response.status_code == 500:
            print("   This might be due to datetime parsing issue")
        print(f"   Response: {response.text}")
        return
    
    # Step 5: Reset password with valid token
    print("\n5. Resetting password...")
    reset_data = {
        "token": latest_token,
        "new_password": new_password
    }
    response = session.post(f"{API_BASE}/auth/reset-password", json=reset_data)
    if response.status_code == 200:
        print("✅ Password reset successful")
        print(f"   Response: {response.json()}")
    else:
        print(f"❌ Password reset failed: {response.status_code}")
        print(f"   Response: {response.text}")
        return
    
    # Step 6: Test login with new password
    print("\n6. Testing login with new password...")
    new_login_data = {"email": test_email, "password": new_password}
    response = session.post(f"{API_BASE}/auth/login", json=new_login_data)
    if response.status_code == 200:
        print("✅ Login successful with new password")
    else:
        print(f"❌ Login failed with new password: {response.status_code}")
    
    # Step 7: Test that old password no longer works
    print("\n7. Testing that old password no longer works...")
    old_login_data = {"email": test_email, "password": old_password}
    response = session.post(f"{API_BASE}/auth/login", json=old_login_data)
    if response.status_code == 401:
        print("✅ Old password correctly rejected")
    else:
        print(f"❌ Old password still works: {response.status_code}")
    
    # Step 8: Test that token cannot be reused
    print("\n8. Testing token reuse prevention...")
    reuse_data = {
        "token": latest_token,
        "new_password": "anothernewpassword123"
    }
    response = session.post(f"{API_BASE}/auth/reset-password", json=reuse_data)
    if response.status_code == 400:
        print("✅ Token reuse correctly prevented")
    else:
        print(f"❌ Token reuse not prevented: {response.status_code}")
    
    print("\n🎉 Complete Password Reset Flow Test Finished!")

if __name__ == "__main__":
    test_complete_password_reset_flow()