#!/usr/bin/env python3
"""
Backend API Testing for Millionaze Project Management App
Focus: Chat and Notification System Testing
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BACKEND_URL = "https://project-scanner-10.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

class ChatNotificationTester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.regular_user_token = None
        self.test_results = []
        self.test_channel_id = None
        self.test_message_id = None
        self.test_notification_id = None
        self.test_dm_channel_id = None
        self.regular_user_id = None
        self.test_project_id = None
        
    def log_result(self, test_name, success, message, details=None):
        """Log test result"""
        result = {
            'test': test_name,
            'success': success,
            'message': message,
            'details': details,
            'timestamp': datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def setup_admin_user(self):
        """Login as admin user for testing"""
        print("\n=== Setting up Admin User ===")
        
        admin_credentials = {
            "email": "admin@millionaze.com",
            "password": "admin123"
        }
        
        try:
            response = self.session.post(f"{API_BASE}/auth/login", json=admin_credentials)
            if response.status_code == 200:
                data = response.json()
                self.admin_token = data['access_token']
                self.log_result("Admin Login", True, f"Logged in as admin: {data['user']['name']}")
                return True
            else:
                self.log_result("Admin Login", False, f"Failed to login: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Admin Login", False, f"Exception during admin login: {str(e)}")
            return False
    
    def setup_regular_user(self):
        """Create or login as regular user for testing"""
        print("\n=== Setting up Regular User ===")
        
        # Try to create a regular user
        try:
            user_signup = {
                "name": "Test User",
                "email": "testuser@millionaze.com", 
                "password": "testpass123",
                "role": "user"
            }
            
            response = self.session.post(f"{API_BASE}/auth/signup", json=user_signup)
            if response.status_code == 200:
                data = response.json()
                self.regular_user_token = data['access_token']
                self.regular_user_id = data['user']['id']
                self.log_result("Regular User Signup", True, f"Created regular user: {data['user']['name']}")
                return True
            else:
                # Try to login if user already exists
                login_data = {
                    "email": "testuser@millionaze.com",
                    "password": "testpass123"
                }
                response = self.session.post(f"{API_BASE}/auth/login", json=login_data)
                if response.status_code == 200:
                    data = response.json()
                    self.regular_user_token = data['access_token']
                    self.regular_user_id = data['user']['id']
                    self.log_result("Regular User Login", True, f"Logged in as regular user: {data['user']['name']}")
                    return True
                else:
                    self.log_result("Regular User Setup", False, f"Failed to setup regular user: {response.status_code}", response.text)
                    return False
                
        except Exception as e:
            self.log_result("Regular User Setup", False, f"Exception during regular user setup: {str(e)}")
            return False

    def get_users_list(self):
        """Get list of users for testing"""
        if not self.admin_token:
            return []
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.get(f"{API_BASE}/users", headers=headers)
            if response.status_code == 200:
                return response.json()
        except Exception as e:
            print(f"Error getting users: {e}")
        return []

    def test_get_channels(self):
        """Test GET /api/channels endpoint"""
        print("\n=== Testing Get Channels Endpoint ===")
        
        if not self.admin_token:
            self.log_result("Get Channels", False, "No admin token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.get(f"{API_BASE}/channels", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                if isinstance(data, list):
                    self.log_result("Get Channels Response Type", True, f"Returns array with {len(data)} channels")
                    
                    # Check if we have channels (should include "General" team channel and project channels)
                    if len(data) > 0:
                        channel = data[0]
                        required_fields = ['id', 'name', 'type', 'members', 'created_by', 'created_at']
                        missing_fields = [field for field in required_fields if field not in channel]
                        
                        if not missing_fields:
                            self.log_result("Get Channels Structure", True, "All required fields present")
                            
                            # Store a channel ID for message testing
                            self.test_channel_id = channel.get('id')
                            
                            # Check for General team channel
                            general_channel = next((c for c in data if c.get('name') == 'General' or c.get('type') == 'team'), None)
                            if general_channel:
                                self.log_result("General Team Channel", True, "General team channel exists")
                                self.test_channel_id = general_channel.get('id')  # Use General channel for testing
                            else:
                                self.log_result("General Team Channel", False, "General team channel not found")
                                
                        else:
                            self.log_result("Get Channels Structure", False, f"Missing fields: {missing_fields}")
                    else:
                        self.log_result("Get Channels Data", True, "No channels found (expected for new system)")
                        
                else:
                    self.log_result("Get Channels Response Type", False, f"Expected array, got {type(data)}")
                    
            else:
                self.log_result("Get Channels Endpoint", False, f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Get Channels Endpoint", False, f"Exception: {str(e)}")

    def create_general_channel(self):
        """Create a General team channel for testing"""
        print("\n=== Creating General Team Channel ===")
        
        if not self.admin_token:
            self.log_result("Create General Channel", False, "No admin token available")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            channel_data = {
                "name": "General",
                "type": "team",
                "members": []  # Will be populated automatically
            }
            
            response = self.session.post(f"{API_BASE}/channels", json=channel_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                self.test_channel_id = data.get('id')
                self.log_result("Create General Channel", True, f"Created General channel: {data.get('name')}")
                return True
            else:
                self.log_result("Create General Channel", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Create General Channel", False, f"Exception: {str(e)}")
            return False

    def test_send_channel_message(self):
        """Test POST /api/channels/{channel_id}/messages endpoint"""
        print("\n=== Testing Send Channel Message Endpoint ===")
        
        if not self.admin_token:
            self.log_result("Send Channel Message", False, "No admin token available")
            return
        
        if not self.test_channel_id:
            # Try to create a General channel first
            if not self.create_general_channel():
                self.log_result("Send Channel Message", False, "No channel available for testing")
                return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            message_data = {
                "channel_id": self.test_channel_id,
                "content": "Test message from admin",
                "mentions": [],
                "attachments": []
            }
            
            response = self.session.post(f"{API_BASE}/channels/{self.test_channel_id}/messages", json=message_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                self.test_message_id = data.get('id')
                
                required_fields = ['id', 'channel_id', 'sender_id', 'sender_name', 'content', 'created_at']
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    self.log_result("Send Channel Message", True, f"Message sent successfully: {data.get('content')}")
                    
                    # Verify message content
                    if data.get('content') == message_data['content']:
                        self.log_result("Message Content", True, "Message content matches")
                    else:
                        self.log_result("Message Content", False, "Message content mismatch")
                        
                else:
                    self.log_result("Send Channel Message", False, f"Missing fields: {missing_fields}")
                    
            else:
                self.log_result("Send Channel Message", False, f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Send Channel Message", False, f"Exception: {str(e)}")

    def test_send_mention_message(self):
        """Test sending a message with @mention to trigger notification"""
        print("\n=== Testing Send Message with @Mention ===")
        
        if not self.admin_token or not self.test_channel_id:
            self.log_result("Send Mention Message", False, "Missing admin token or channel ID")
            return
        
        # Get a user to mention (use regular user if available)
        if not self.regular_user_id:
            users = self.get_users_list()
            for user in users:
                if user.get('email') != 'admin@millionaze.com':
                    self.regular_user_id = user.get('id')
                    break
        
        if not self.regular_user_id:
            self.log_result("Send Mention Message", False, "No user available to mention")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            mention_message_data = {
                "channel_id": self.test_channel_id,
                "content": f"@user_{self.regular_user_id} Please review this task",
                "mentions": [self.regular_user_id],
                "attachments": []
            }
            
            response = self.session.post(f"{API_BASE}/channels/{self.test_channel_id}/messages", json=mention_message_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify mentions are stored
                if data.get('mentions') == [self.regular_user_id]:
                    self.log_result("Send Mention Message", True, "Message with mention sent successfully")
                else:
                    self.log_result("Send Mention Message", False, "Mentions not stored correctly")
                    
            else:
                self.log_result("Send Mention Message", False, f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Send Mention Message", False, f"Exception: {str(e)}")

    def test_get_channel_messages(self):
        """Test GET /api/channels/{channel_id}/messages endpoint"""
        print("\n=== Testing Get Channel Messages Endpoint ===")
        
        if not self.admin_token or not self.test_channel_id:
            self.log_result("Get Channel Messages", False, "Missing admin token or channel ID")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.get(f"{API_BASE}/channels/{self.test_channel_id}/messages", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                if isinstance(data, list):
                    self.log_result("Get Channel Messages Response Type", True, f"Returns array with {len(data)} messages")
                    
                    if len(data) > 0:
                        message = data[0]
                        required_fields = ['id', 'channel_id', 'sender_id', 'sender_name', 'content', 'created_at']
                        missing_fields = [field for field in required_fields if field not in message]
                        
                        if not missing_fields:
                            self.log_result("Get Channel Messages Structure", True, "All required fields present")
                            
                            # Verify messages are from our test channel
                            if message.get('channel_id') == self.test_channel_id:
                                self.log_result("Message Channel ID", True, "Messages belong to correct channel")
                            else:
                                self.log_result("Message Channel ID", False, "Message channel ID mismatch")
                                
                        else:
                            self.log_result("Get Channel Messages Structure", False, f"Missing fields: {missing_fields}")
                    else:
                        self.log_result("Get Channel Messages Data", True, "No messages found (expected for new channel)")
                        
                else:
                    self.log_result("Get Channel Messages Response Type", False, f"Expected array, got {type(data)}")
                    
            else:
                self.log_result("Get Channel Messages", False, f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Get Channel Messages", False, f"Exception: {str(e)}")

    def test_direct_message_channel(self):
        """Test GET /api/direct-channels/{user_id} endpoint"""
        print("\n=== Testing Direct Message Channel Endpoint ===")
        
        if not self.admin_token:
            self.log_result("Direct Message Channel", False, "No admin token available")
            return
        
        if not self.regular_user_id:
            self.log_result("Direct Message Channel", False, "No regular user available for DM")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.get(f"{API_BASE}/direct-channels/{self.regular_user_id}", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                self.test_dm_channel_id = data.get('id')
                
                required_fields = ['id', 'name', 'type', 'members', 'created_by', 'created_at']
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    self.log_result("Create/Get DM Channel", True, f"DM channel created/retrieved: {data.get('name')}")
                    
                    # Verify it's a direct channel
                    if data.get('type') == 'direct':
                        self.log_result("DM Channel Type", True, "Channel type is 'direct'")
                    else:
                        self.log_result("DM Channel Type", False, f"Expected 'direct', got '{data.get('type')}'")
                        
                    # Verify both users are members
                    members = data.get('members', [])
                    if len(members) == 2 and self.regular_user_id in members:
                        self.log_result("DM Channel Members", True, "Both users are channel members")
                    else:
                        self.log_result("DM Channel Members", False, f"Incorrect members: {members}")
                        
                else:
                    self.log_result("Create/Get DM Channel", False, f"Missing fields: {missing_fields}")
                    
            else:
                self.log_result("Direct Message Channel", False, f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Direct Message Channel", False, f"Exception: {str(e)}")

    def test_send_direct_message(self):
        """Test sending a message to DM channel"""
        print("\n=== Testing Send Direct Message ===")
        
        if not self.admin_token or not self.test_dm_channel_id:
            self.log_result("Send Direct Message", False, "Missing admin token or DM channel ID")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            dm_message_data = {
                "channel_id": self.test_dm_channel_id,
                "content": "This is a direct message test",
                "mentions": [],
                "attachments": []
            }
            
            response = self.session.post(f"{API_BASE}/channels/{self.test_dm_channel_id}/messages", json=dm_message_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get('content') == dm_message_data['content']:
                    self.log_result("Send Direct Message", True, "Direct message sent successfully")
                else:
                    self.log_result("Send Direct Message", False, "Direct message content mismatch")
                    
            else:
                self.log_result("Send Direct Message", False, f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Send Direct Message", False, f"Exception: {str(e)}")

    def test_verify_dm_messages(self):
        """Test retrieving direct messages"""
        print("\n=== Testing Verify DM Messages ===")
        
        if not self.admin_token or not self.test_dm_channel_id:
            self.log_result("Verify DM Messages", False, "Missing admin token or DM channel ID")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.get(f"{API_BASE}/channels/{self.test_dm_channel_id}/messages", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                if isinstance(data, list) and len(data) > 0:
                    # Look for our test message
                    test_message = next((msg for msg in data if msg.get('content') == 'This is a direct message test'), None)
                    if test_message:
                        self.log_result("Verify DM Messages", True, "Direct message retrieved successfully")
                    else:
                        self.log_result("Verify DM Messages", False, "Test direct message not found")
                else:
                    self.log_result("Verify DM Messages", False, "No messages found in DM channel")
                    
            else:
                self.log_result("Verify DM Messages", False, f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Verify DM Messages", False, f"Exception: {str(e)}")

    def test_get_notifications(self):
        """Test GET /api/notifications endpoint"""
        print("\n=== Testing Get Notifications Endpoint ===")
        
        if not self.regular_user_token:
            self.log_result("Get Notifications", False, "No regular user token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.regular_user_token}"}
            response = self.session.get(f"{API_BASE}/notifications", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                if isinstance(data, list):
                    self.log_result("Get Notifications Response Type", True, f"Returns array with {len(data)} notifications")
                    
                    if len(data) > 0:
                        notification = data[0]
                        self.test_notification_id = notification.get('id')
                        
                        required_fields = ['id', 'user_id', 'type', 'title', 'message', 'read', 'created_at']
                        missing_fields = [field for field in required_fields if field not in notification]
                        
                        if not missing_fields:
                            self.log_result("Get Notifications Structure", True, "All required fields present")
                            
                            # Check if we have mention notifications
                            mention_notifications = [n for n in data if n.get('type') == 'mention']
                            if mention_notifications:
                                self.log_result("Mention Notifications", True, f"Found {len(mention_notifications)} mention notifications")
                            else:
                                self.log_result("Mention Notifications", False, "No mention notifications found (may be expected)")
                                
                        else:
                            self.log_result("Get Notifications Structure", False, f"Missing fields: {missing_fields}")
                    else:
                        self.log_result("Get Notifications Data", True, "No notifications found (expected for new user)")
                        
                else:
                    self.log_result("Get Notifications Response Type", False, f"Expected array, got {type(data)}")
                    
            else:
                self.log_result("Get Notifications", False, f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Get Notifications", False, f"Exception: {str(e)}")

    def test_get_unread_notification_count(self):
        """Test GET /api/notifications/unread-count endpoint"""
        print("\n=== Testing Get Unread Notification Count ===")
        
        if not self.regular_user_token:
            self.log_result("Get Unread Count", False, "No regular user token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.regular_user_token}"}
            response = self.session.get(f"{API_BASE}/notifications/unread-count", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                if 'count' in data and isinstance(data['count'], int):
                    self.log_result("Get Unread Count", True, f"Unread count: {data['count']}")
                else:
                    self.log_result("Get Unread Count", False, f"Invalid response format: {data}")
                    
            else:
                self.log_result("Get Unread Count", False, f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Get Unread Count", False, f"Exception: {str(e)}")

    def test_mark_notification_as_read(self):
        """Test PUT /api/notifications/{id}/read endpoint"""
        print("\n=== Testing Mark Notification as Read ===")
        
        if not self.regular_user_token:
            self.log_result("Mark Notification Read", False, "No regular user token available")
            return
        
        if not self.test_notification_id:
            self.log_result("Mark Notification Read", False, "No notification ID available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.regular_user_token}"}
            response = self.session.put(f"{API_BASE}/notifications/{self.test_notification_id}/read", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get('success') == True:
                    self.log_result("Mark Notification Read", True, "Notification marked as read")
                else:
                    self.log_result("Mark Notification Read", False, f"Unexpected response: {data}")
                    
            elif response.status_code == 404:
                self.log_result("Mark Notification Read", False, "Notification not found (404)")
            else:
                self.log_result("Mark Notification Read", False, f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Mark Notification Read", False, f"Exception: {str(e)}")

    def test_delete_notification(self):
        """Test DELETE /api/notifications/{id} endpoint"""
        print("\n=== Testing Delete Notification ===")
        
        if not self.regular_user_token:
            self.log_result("Delete Notification", False, "No regular user token available")
            return
        
        if not self.test_notification_id:
            self.log_result("Delete Notification", False, "No notification ID available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.regular_user_token}"}
            response = self.session.delete(f"{API_BASE}/notifications/{self.test_notification_id}", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get('success') == True:
                    self.log_result("Delete Notification", True, "Notification deleted successfully")
                else:
                    self.log_result("Delete Notification", False, f"Unexpected response: {data}")
                    
            elif response.status_code == 404:
                self.log_result("Delete Notification", False, "Notification not found (404)")
            else:
                self.log_result("Delete Notification", False, f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Delete Notification", False, f"Exception: {str(e)}")

    def test_project_channel_auto_creation(self):
        """Test that project creation automatically creates a project channel"""
        print("\n=== Testing Project Channel Auto-Creation ===")
        
        if not self.admin_token:
            self.log_result("Project Channel Auto-Creation", False, "No admin token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Create a new project
            project_data = {
                "name": "Test Project for Channel Creation",
                "company_name": "Test Company",
                "business_name": "Test Business",
                "client_name": "Test Client",
                "status": "Getting Started",
                "team_members": []
            }
            
            project_response = self.session.post(f"{API_BASE}/projects", json=project_data, headers=headers)
            
            if project_response.status_code == 200:
                project = project_response.json()
                project_id = project.get('id')
                self.test_project_id = project_id
                
                # Check if a project channel was created
                channels_response = self.session.get(f"{API_BASE}/channels", headers=headers)
                
                if channels_response.status_code == 200:
                    channels = channels_response.json()
                    
                    # Look for a channel with this project_id
                    project_channel = next((c for c in channels if c.get('project_id') == project_id), None)
                    
                    if project_channel:
                        self.log_result("Project Channel Auto-Creation", True, f"Project channel created: {project_channel.get('name')}")
                        
                        # Verify channel properties
                        if project_channel.get('type') == 'project':
                            self.log_result("Project Channel Type", True, "Channel type is 'project'")
                        else:
                            self.log_result("Project Channel Type", False, f"Expected 'project', got '{project_channel.get('type')}'")
                            
                    else:
                        self.log_result("Project Channel Auto-Creation", False, "No project channel found for new project")
                else:
                    self.log_result("Project Channel Auto-Creation", False, f"Failed to get channels: {channels_response.status_code}")
            else:
                self.log_result("Project Channel Auto-Creation", False, f"Failed to create project: {project_response.status_code}")
                
        except Exception as e:
            self.log_result("Project Channel Auto-Creation", False, f"Exception: {str(e)}")

    def run_all_tests(self):
        """Run all chat and notification tests"""
        print("🚀 Starting Millionaze Chat and Notification System Tests")
        print(f"Backend URL: {BACKEND_URL}")
        print("=" * 60)
        
        # Setup users
        admin_setup_success = self.setup_admin_user()
        regular_user_setup_success = self.setup_regular_user()
        
        if not admin_setup_success:
            print("❌ Admin setup failed - cannot continue with tests")
            return False
        
        # Test authentication setup
        self.log_result("Authentication Setup", True, "Admin login successful with admin@millionaze.com / admin123")
        
        # Test channels
        self.test_get_channels()
        self.test_project_channel_auto_creation()
        
        # Test messaging
        self.test_send_channel_message()
        self.test_send_mention_message()
        self.test_get_channel_messages()
        
        # Test direct messages
        self.test_direct_message_channel()
        self.test_send_direct_message()
        self.test_verify_dm_messages()
        
        # Test notifications
        self.test_get_notifications()
        self.test_get_unread_notification_count()
        self.test_mark_notification_as_read()
        self.test_delete_notification()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 CHAT & NOTIFICATION TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for r in self.test_results if r['success'])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        
        if total - passed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['message']}")
        
        print("\n🎯 DETAILED TEST RESULTS:")
        
        # Authentication Tests
        auth_tests = ["Admin Login", "Regular User Signup", "Regular User Login", "Authentication Setup"]
        print("\n📋 Authentication Tests:")
        for test_name in auth_tests:
            result = next((r for r in self.test_results if r['test'] == test_name), None)
            if result:
                status = "✅" if result['success'] else "❌"
                print(f"  {status} {test_name}")
        
        # Channel Tests
        channel_tests = ["Get Channels Response Type", "Get Channels Structure", "General Team Channel", 
                        "Create General Channel", "Project Channel Auto-Creation", "Project Channel Type"]
        print("\n📋 Channel Tests:")
        for test_name in channel_tests:
            result = next((r for r in self.test_results if r['test'] == test_name), None)
            if result:
                status = "✅" if result['success'] else "❌"
                print(f"  {status} {test_name}")
        
        # Message Tests
        message_tests = ["Send Channel Message", "Message Content", "Send Mention Message", 
                        "Get Channel Messages Response Type", "Get Channel Messages Structure", "Message Channel ID"]
        print("\n📋 Message Tests:")
        for test_name in message_tests:
            result = next((r for r in self.test_results if r['test'] == test_name), None)
            if result:
                status = "✅" if result['success'] else "❌"
                print(f"  {status} {test_name}")
        
        # Direct Message Tests
        dm_tests = ["Create/Get DM Channel", "DM Channel Type", "DM Channel Members", 
                   "Send Direct Message", "Verify DM Messages"]
        print("\n📋 Direct Message Tests:")
        for test_name in dm_tests:
            result = next((r for r in self.test_results if r['test'] == test_name), None)
            if result:
                status = "✅" if result['success'] else "❌"
                print(f"  {status} {test_name}")
        
        # Notification Tests
        notification_tests = ["Get Notifications Response Type", "Get Notifications Structure", "Mention Notifications",
                             "Get Unread Count", "Mark Notification Read", "Delete Notification"]
        print("\n📋 Notification Tests:")
        for test_name in notification_tests:
            result = next((r for r in self.test_results if r['test'] == test_name), None)
            if result:
                status = "✅" if result['success'] else "❌"
                print(f"  {status} {test_name}")
        
        return passed == total

if __name__ == "__main__":
    tester = ChatNotificationTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)