import asyncio
import requests
import json

BACKEND_URL = "https://project-scanner-10.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

async def test_guest_link_flow():
    # Login as admin
    admin_credentials = {
        "email": "admin@millionaze.com",
        "password": "admin123"
    }
    
    response = requests.post(f"{API_BASE}/auth/login", json=admin_credentials)
    if response.status_code != 200:
        print(f"❌ Admin login failed: {response.status_code}")
        return
    
    admin_token = response.json()['access_token']
    headers = {"Authorization": f"Bearer {admin_token}"}
    print("✅ Admin logged in")
    
    # Get the "Launch Millii (PMS)" project
    projects_response = requests.get(f"{API_BASE}/projects", headers=headers)
    projects = projects_response.json()
    
    launch_millii_project = None
    for p in projects:
        if "Launch Millii" in p.get('name', ''):
            launch_millii_project = p
            break
    
    if not launch_millii_project:
        print("❌ Launch Millii project not found")
        return
    
    project_id = launch_millii_project['id']
    print(f"✅ Found project: {launch_millii_project['name']} (ID: {project_id})")
    
    # Check if guest link exists
    guest_link_token = launch_millii_project.get('guest_link')
    
    if not guest_link_token:
        # Generate guest link
        print("📝 Generating guest link...")
        guest_link_response = requests.post(
            f"{API_BASE}/projects/{project_id}/generate-guest-link",
            headers=headers
        )
        if guest_link_response.status_code == 200:
            guest_link_token = guest_link_response.json()['guest_link']
            print(f"✅ Guest link generated: {guest_link_token}")
        else:
            print(f"❌ Failed to generate guest link: {guest_link_response.status_code}")
            return
    else:
        print(f"✅ Existing guest link: {guest_link_token}")
    
    # Create the full guest link URL
    guest_link_url = f"{BACKEND_URL}/guest-invite/{guest_link_token}"
    print(f"\n🔗 Guest Link URL: {guest_link_url}")
    print(f"\nNow testing access via this link...")
    
    # Test accessing via guest link (simulating new user)
    guest_data = {
        "name": "Test Guest Via Link",
        "email": "guestlink@test.com"
    }
    
    access_response = requests.post(f"{API_BASE}/guest-access/{guest_link_token}", json=guest_data)
    
    if access_response.status_code == 200:
        access_data = access_response.json()
        print(f"✅ Guest access successful!")
        print(f"   User: {access_data.get('user', {}).get('name')}")
        print(f"   Role: {access_data.get('user', {}).get('role')}")
        print(f"   Project: {access_data.get('project_id')}")
        
        # Get the guest user token
        guest_token = access_data['access_token']
        guest_headers = {"Authorization": f"Bearer {guest_token}"}
        
        # Check what channels the guest can see
        channels_response = requests.get(f"{API_BASE}/channels", headers=guest_headers)
        if channels_response.status_code == 200:
            channels = channels_response.json()
            print(f"\n📺 Channels visible to guest ({len(channels)} total):")
            for ch in channels:
                print(f"   - {ch.get('name')} (type: {ch.get('type')}, members: {len(ch.get('members', []))})")
            
            # Check if guest is in the project channel
            project_channels = [ch for ch in channels if ch.get('type') == 'project' and ch.get('project_id') == project_id]
            if project_channels:
                print(f"✅ Guest can see the project channel!")
            else:
                print(f"❌ Guest CANNOT see the project channel!")
        else:
            print(f"❌ Failed to get channels for guest: {channels_response.status_code}")
    else:
        print(f"❌ Guest access failed: {access_response.status_code}")
        print(f"   Response: {access_response.text}")

if __name__ == "__main__":
    asyncio.run(test_guest_link_flow())
