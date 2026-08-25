"""Test script to check if the Milli API endpoint is working"""
import requests
import json

# Backend URL
BASE_URL = "http://localhost:8000"

# You'll need to replace this with a valid token from your browser's localStorage
# To get it: Open browser console (F12) and type: localStorage.getItem('token')
TOKEN = input("Please paste your authentication token (from browser localStorage): ")

if not TOKEN or TOKEN.strip() == "":
    print("❌ No token provided. Please get your token from browser localStorage.")
    print("   Open browser console (F12) and type: localStorage.getItem('token')")
    exit(1)

print(f"\n🔍 Testing Milli API endpoint at {BASE_URL}")
print("=" * 60)

# Test 1: Check if backend is responding
print("\n1️⃣  Testing backend connection...")
try:
    response = requests.get(f"{BASE_URL}/api/health", timeout=5)
    if response.status_code == 200:
        print("   ✅ Backend is responding")
    else:
        print(f"   ⚠️  Backend returned status {response.status_code}")
except requests.exceptions.RequestException as e:
    print(f"   ❌ Cannot connect to backend: {e}")
    exit(1)

# Test 2: Get Milli channel
print("\n2️⃣  Testing Milli channel endpoint...")
headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

try:
    response = requests.get(
        f"{BASE_URL}/api/milli/channel",
        headers=headers,
        timeout=10
    )
    
    print(f"   Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print("   ✅ Milli channel retrieved successfully!")
        print(f"\n   Channel Details:")
        print(f"   - ID: {data.get('id')}")
        print(f"   - Name: {data.get('name')}")
        print(f"   - Type: {data.get('type')}")
        print(f"   - Members: {data.get('members')}")
        
    elif response.status_code == 401:
        print("   ❌ Authentication failed - Invalid token")
        print("   Please get a fresh token from your browser")
        
    elif response.status_code == 403:
        print("   ❌ Permission denied - User doesn't have access to Milli")
        print("   Check user permissions in Settings > Roles & Permissions")
        
    else:
        print(f"   ❌ Unexpected error: {response.status_code}")
        print(f"   Response: {response.text}")
        
except requests.exceptions.RequestException as e:
    print(f"   ❌ Request failed: {e}")

# Test 3: Check user permissions
print("\n3️⃣  Checking user permissions...")
try:
    response = requests.get(
        f"{BASE_URL}/api/me",
        headers=headers,
        timeout=5
    )
    
    if response.status_code == 200:
        user = response.json()
        print(f"   User: {user.get('name')} ({user.get('email')})")
        print(f"   Role: {user.get('role')}")
        
        # Check permissions
        perms = user.get('permissions', {})
        can_chat = perms.get('can_chat_with_millii', False)
        
        if can_chat:
            print(f"   ✅ User HAS permission to chat with Milli")
        else:
            print(f"   ❌ User DOES NOT have permission to chat with Milli")
            print(f"   💡 Enable in Settings > Roles & Permissions")
            
    else:
        print(f"   ⚠️  Could not fetch user info: {response.status_code}")
        
except requests.exceptions.RequestException as e:
    print(f"   ❌ Request failed: {e}")

print("\n" + "=" * 60)
print("Test complete!")
print("\n💡 Next steps:")
print("   1. If permission denied: Enable 'can_chat_with_millii' in Settings")
print("   2. If authenticated OK: Check browser console for frontend errors")
print("   3. If Milli appears: Add OpenAI API key to backend/.env")

