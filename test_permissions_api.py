import requests

BACKEND_URL = "https://project-scanner-10.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

# Login as a client user
client_credentials = {
    "email": "testclient@millii.com",
    "password": "client123"
}

response = requests.post(f"{API_BASE}/auth/login", json=client_credentials)
if response.status_code == 200:
    data = response.json()
    client_token = data['access_token']
    user_id = data['user']['id']
    
    print(f"✅ Logged in as client")
    print(f"   User ID: {user_id}")
    print(f"   Role: {data['user']['role']}")
    
    # Get permissions for this user
    headers = {"Authorization": f"Bearer {client_token}"}
    perm_response = requests.get(f"{API_BASE}/users/{user_id}/permissions", headers=headers)
    
    if perm_response.status_code == 200:
        perm_data = perm_response.json()
        print(f"\n✅ Permissions API Response:")
        print(f"   Role: {perm_data.get('role')}")
        print(f"   Effective Role: {perm_data.get('effective_role')}")
        print(f"\n   Role Permissions:")
        role_perms = perm_data.get('role_permissions', {})
        for key, value in role_perms.items():
            print(f"      {key}: {value}")
        
        print(f"\n   Effective Permissions:")
        eff_perms = perm_data.get('effective_permissions', {})
        for key, value in eff_perms.items():
            print(f"      {key}: {value}")
        
        # Check specific permissions
        has_direct_chat = eff_perms.get('can_have_direct_chat')
        has_millii_chat = eff_perms.get('can_chat_with_millii')
        
        print(f"\n🔍 Key Permissions Check:")
        print(f"   can_have_direct_chat: {has_direct_chat}")
        print(f"   can_chat_with_millii: {has_millii_chat}")
        
        if has_direct_chat:
            print(f"\n✅ Client SHOULD be able to access /chats")
        else:
            print(f"\n❌ Client CANNOT access /chats (missing can_have_direct_chat)")
    else:
        print(f"❌ Failed to get permissions: {perm_response.status_code}")
        print(f"   Response: {perm_response.text}")
else:
    print(f"❌ Login failed: {response.status_code}")

