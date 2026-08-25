#!/usr/bin/env python3
"""
Simple test script to create sample channels for testing the UI
"""
import asyncio
import httpx
import json
from datetime import datetime, timezone

BACKEND_URL = "http://localhost:8001"

async def test_channel_creation():
    """Test creating sample channels"""
    
    # First, get an auth token (you'll need to replace these with actual admin credentials)
    login_data = {
        "email": "admin@example.com",  # Replace with actual admin email
        "password": "admin123"         # Replace with actual admin password
    }
    
    async with httpx.AsyncClient() as client:
        try:
            # Login to get token
            print("🔐 Attempting login...")
            login_response = await client.post(f"{BACKEND_URL}/api/auth/login", json=login_data)
            
            if login_response.status_code != 200:
                print("❌ Login failed. Please check credentials.")
                return
            
            token = login_response.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
            
            print("✅ Login successful!")
            
            # Test sample channels to create
            sample_channels = [
                {
                    "name": "General Discussion",
                    "description": "Company-wide general discussions",
                    "type": "company",
                    "category": "company",
                    "is_private": False,
                    "permissions": {
                        "can_send_messages": True,
                        "can_invite_members": False,
                        "can_edit_channel": False,
                        "can_delete_messages": False,
                        "read_only": False
                    },
                    "members": []
                },
                {
                    "name": "Announcements",
                    "description": "Important company announcements - read only",
                    "type": "announcement",
                    "category": "announcement",
                    "is_private": False,
                    "permissions": {
                        "can_send_messages": True,
                        "can_invite_members": False,
                        "can_edit_channel": False,
                        "can_delete_messages": False,
                        "read_only": True  # Only admins/managers can post
                    },
                    "members": []
                },
                {
                    "name": "Development Team",
                    "description": "Private channel for development discussions",
                    "type": "team",
                    "category": "general",
                    "is_private": True,
                    "permissions": {
                        "can_send_messages": True,
                        "can_invite_members": True,
                        "can_edit_channel": False,
                        "can_delete_messages": False,
                        "read_only": False
                    },
                    "members": []
                }
            ]
            
            # Create sample channels
            for channel_data in sample_channels:
                try:
                    print(f"📝 Creating channel: {channel_data['name']}")
                    response = await client.post(
                        f"{BACKEND_URL}/api/channels",
                        json=channel_data,
                        headers=headers
                    )
                    
                    if response.status_code == 200:
                        print(f"✅ Created channel: {channel_data['name']}")
                    else:
                        print(f"❌ Failed to create {channel_data['name']}: {response.text}")
                        
                except Exception as e:
                    print(f"❌ Error creating {channel_data['name']}: {str(e)}")
            
            print("🎉 Channel creation test completed!")
            print("\nYou should now be able to see the channels with settings buttons in the UI.")
            
        except Exception as e:
            print(f"❌ Test failed with error: {str(e)}")

if __name__ == "__main__":
    asyncio.run(test_channel_creation())