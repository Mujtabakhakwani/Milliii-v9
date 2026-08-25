#!/usr/bin/env python3
"""
Test Chat File Attachment Functionality
Tests that attachments are properly saved when sending messages via WebSocket
"""

import requests
import json
import sys
import base64
import asyncio
import websockets
from datetime import datetime

# Configuration
BACKEND_URL = "https://project-scanner-10.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"
WS_URL = "wss://trackfix-deploy.preview.emergentagent.com/api/ws"

class ChatAttachmentTester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.test_results = []
        self.test_channel_id = None
        self.test_message_id = None
        
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
        print(f"{status} - {test_name}: {message}")
        if details:
            print(f"   Details: {json.dumps(details, indent=2)}")
        return success
    
    def login_admin(self):
        """Login as admin user"""
        print("\n🔐 Logging in as admin...")
        try:
            response = self.session.post(
                f"{API_BASE}/auth/login",
                json={
                    "email": "irfan@millionaze.com",
                    "password": "Test@123"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                self.admin_token = data['access_token']
                self.session.headers.update({
                    'Authorization': f'Bearer {self.admin_token}'
                })
                return self.log_result(
                    "Admin Login",
                    True,
                    f"Successfully logged in as {data['user']['email']}",
                    {"user_id": data['user']['id'], "user_name": data['user']['name']}
                )
            else:
                return self.log_result(
                    "Admin Login",
                    False,
                    f"Login failed with status {response.status_code}",
                    {"response": response.text}
                )
        except Exception as e:
            return self.log_result("Admin Login", False, f"Exception: {str(e)}")
    
    def get_channels(self):
        """Get list of channels"""
        print("\n📋 Getting channels list...")
        try:
            response = self.session.get(f"{API_BASE}/channels")
            
            if response.status_code == 200:
                data = response.json()
                # Handle both direct array and wrapped response
                channels = data.get('channels', data) if isinstance(data, dict) else data
                
                if channels:
                    # Pick the first channel for testing
                    self.test_channel_id = channels[0]['id']
                    return self.log_result(
                        "Get Channels",
                        True,
                        f"Retrieved {len(channels)} channels",
                        {"channel_count": len(channels), "test_channel_id": self.test_channel_id, "channel_name": channels[0]['name']}
                    )
                else:
                    return self.log_result(
                        "Get Channels",
                        False,
                        "No channels found",
                        {"channels": channels}
                    )
            else:
                return self.log_result(
                    "Get Channels",
                    False,
                    f"Failed with status {response.status_code}",
                    {"response": response.text}
                )
        except Exception as e:
            return self.log_result("Get Channels", False, f"Exception: {str(e)}")
    
    async def send_message_with_attachment_via_websocket(self):
        """Send a message with attachment via WebSocket"""
        print("\n💬 Sending message with attachment via WebSocket...")
        try:
            # Create mock attachment data (small base64 encoded image)
            # This is a 1x1 pixel red PNG
            mock_image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
            
            attachment_data = {
                "name": "test_attachment.png",
                "type": "image/png",
                "data": f"data:image/png;base64,{mock_image_base64}"
            }
            
            async with websockets.connect(WS_URL) as websocket:
                # Authenticate
                await websocket.send(json.dumps({
                    "type": "auth",
                    "token": self.admin_token
                }))
                
                # Wait for connection confirmation
                auth_response = await websocket.recv()
                auth_data = json.loads(auth_response)
                
                if auth_data.get('type') != 'connected':
                    return self.log_result(
                        "WebSocket Authentication",
                        False,
                        "Failed to authenticate WebSocket connection",
                        {"response": auth_data}
                    )
                
                self.log_result(
                    "WebSocket Authentication",
                    True,
                    "Successfully authenticated WebSocket connection",
                    {"user_id": auth_data.get('user_id')}
                )
                
                # Join channel
                await websocket.send(json.dumps({
                    "type": "join_channel",
                    "channel_id": self.test_channel_id
                }))
                
                # Wait for join confirmation
                join_response = await websocket.recv()
                join_data = json.loads(join_response)
                
                if join_data.get('type') != 'joined_channel':
                    return self.log_result(
                        "Join Channel",
                        False,
                        "Failed to join channel",
                        {"response": join_data}
                    )
                
                self.log_result(
                    "Join Channel",
                    True,
                    f"Successfully joined channel {self.test_channel_id}",
                    {"channel_id": self.test_channel_id}
                )
                
                # Send message with attachment
                message_content = f"Test message with attachment - {datetime.now().isoformat()}"
                await websocket.send(json.dumps({
                    "type": "send_message",
                    "channel_id": self.test_channel_id,
                    "content": message_content,
                    "attachments": [attachment_data]
                }))
                
                # Wait for responses (could be in any order)
                message_sent_confirmed = False
                broadcast_received = False
                
                for _ in range(2):
                    response = await websocket.recv()
                    data = json.loads(response)
                    
                    if data.get('type') == 'message_sent':
                        message_sent_confirmed = True
                        self.test_message_id = data.get('message_id')
                    elif data.get('type') == 'new_message':
                        broadcast_received = True
                        # Extract message ID from broadcast if we don't have it yet
                        if not self.test_message_id:
                            self.test_message_id = data.get('message', {}).get('id')
                        # Verify attachments are in the broadcast
                        message_data = data.get('message', {})
                        attachments_in_broadcast = message_data.get('attachments', [])
                
                if message_sent_confirmed or broadcast_received:
                    return self.log_result(
                        "Send Message with Attachment",
                        True,
                        "Message with attachment sent successfully",
                        {
                            "message_id": self.test_message_id,
                            "content": message_content,
                            "attachment_count": len(attachments_in_broadcast) if broadcast_received else 1,
                            "message_sent_confirmed": message_sent_confirmed,
                            "broadcast_received": broadcast_received,
                            "attachments_in_broadcast": attachments_in_broadcast if broadcast_received else None
                        }
                    )
                else:
                    return self.log_result(
                        "Send Message with Attachment",
                        False,
                        "Failed to send message - no confirmation received",
                        {"last_response": data}
                    )
                    
        except Exception as e:
            return self.log_result(
                "Send Message with Attachment",
                False,
                f"Exception: {str(e)}",
                {"error_type": type(e).__name__}
            )
    
    def verify_message_in_database(self):
        """Verify message was saved with attachments in database"""
        print("\n🔍 Verifying message in database...")
        try:
            # Get messages from the channel
            response = self.session.get(
                f"{API_BASE}/channels/{self.test_channel_id}/messages",
                params={"limit": 10}
            )
            
            if response.status_code == 200:
                messages = response.json()
                
                # Find our test message
                test_message = None
                for msg in messages:
                    if msg['id'] == self.test_message_id:
                        test_message = msg
                        break
                
                if not test_message:
                    return self.log_result(
                        "Verify Message in Database",
                        False,
                        f"Message {self.test_message_id} not found in database",
                        {"messages_count": len(messages)}
                    )
                
                # Check if attachments field exists
                if 'attachments' not in test_message:
                    return self.log_result(
                        "Verify Message in Database",
                        False,
                        "Message does not have 'attachments' field",
                        {"message": test_message}
                    )
                
                # Check if attachments array is populated
                attachments = test_message.get('attachments', [])
                if not attachments or len(attachments) == 0:
                    return self.log_result(
                        "Verify Message in Database",
                        False,
                        "Attachments array is empty",
                        {"message": test_message}
                    )
                
                # Verify attachment structure
                attachment = attachments[0]
                required_fields = ['name', 'type', 'data']
                missing_fields = [field for field in required_fields if field not in attachment]
                
                if missing_fields:
                    return self.log_result(
                        "Verify Message in Database",
                        False,
                        f"Attachment missing required fields: {missing_fields}",
                        {"attachment": attachment}
                    )
                
                # Verify field values
                checks = []
                checks.append(("name", attachment.get('name') == "test_attachment.png"))
                checks.append(("type", attachment.get('type') == "image/png"))
                checks.append(("data", attachment.get('data', '').startswith("data:image/png;base64,")))
                
                failed_checks = [check[0] for check in checks if not check[1]]
                
                if failed_checks:
                    return self.log_result(
                        "Verify Message in Database",
                        False,
                        f"Attachment field validation failed: {failed_checks}",
                        {"attachment": attachment}
                    )
                
                return self.log_result(
                    "Verify Message in Database",
                    True,
                    "Message saved with attachments correctly",
                    {
                        "message_id": test_message['id'],
                        "attachment_count": len(attachments),
                        "attachment_name": attachment.get('name'),
                        "attachment_type": attachment.get('type'),
                        "attachment_data_length": len(attachment.get('data', ''))
                    }
                )
            else:
                return self.log_result(
                    "Verify Message in Database",
                    False,
                    f"Failed to retrieve messages with status {response.status_code}",
                    {"response": response.text}
                )
        except Exception as e:
            return self.log_result(
                "Verify Message in Database",
                False,
                f"Exception: {str(e)}",
                {"error_type": type(e).__name__}
            )
    
    def verify_message_retrieval(self):
        """Verify messages retrieved include attachments"""
        print("\n📥 Verifying message retrieval includes attachments...")
        try:
            # Get messages again to verify retrieval - use the correct endpoint
            response = self.session.get(
                f"{API_BASE}/channels/{self.test_channel_id}/messages",
                params={"limit": 10}
            )
            
            if response.status_code == 200:
                messages = response.json()
                
                # Find our test message
                test_message = None
                for msg in messages:
                    if msg['id'] == self.test_message_id:
                        test_message = msg
                        break
                
                if not test_message:
                    return self.log_result(
                        "Verify Message Retrieval",
                        False,
                        f"Message {self.test_message_id} not found",
                        {"messages_count": len(messages)}
                    )
                
                # Verify attachments are included
                attachments = test_message.get('attachments', [])
                if not attachments or len(attachments) == 0:
                    return self.log_result(
                        "Verify Message Retrieval",
                        False,
                        "Retrieved message does not include attachments",
                        {"message": test_message}
                    )
                
                return self.log_result(
                    "Verify Message Retrieval",
                    True,
                    "Retrieved message includes attachments",
                    {
                        "message_id": test_message['id'],
                        "attachment_count": len(attachments),
                        "attachment": attachments[0]
                    }
                )
            else:
                return self.log_result(
                    "Verify Message Retrieval",
                    False,
                    f"Failed to retrieve messages with status {response.status_code}",
                    {"response": response.text}
                )
        except Exception as e:
            return self.log_result(
                "Verify Message Retrieval",
                False,
                f"Exception: {str(e)}",
                {"error_type": type(e).__name__}
            )
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*80)
        print("📊 TEST SUMMARY")
        print("="*80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for r in self.test_results if r['success'])
        failed_tests = total_tests - passed_tests
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        print(f"\nTotal Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['message']}")
        
        print("\n" + "="*80)
        
        return failed_tests == 0
    
    async def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting Chat File Attachment Tests")
        print("="*80)
        
        # Test sequence
        if not self.login_admin():
            print("\n❌ Cannot proceed without admin login")
            return False
        
        if not self.get_channels():
            print("\n❌ Cannot proceed without channels")
            return False
        
        if not await self.send_message_with_attachment_via_websocket():
            print("\n❌ Failed to send message with attachment")
            return False
        
        # Give a moment for database to update
        import time
        time.sleep(1)
        
        if not self.verify_message_in_database():
            print("\n❌ Message not properly saved in database")
            return False
        
        if not self.verify_message_retrieval():
            print("\n❌ Message retrieval does not include attachments")
            return False
        
        return self.print_summary()

def main():
    """Main test runner"""
    tester = ChatAttachmentTester()
    
    # Run async tests
    success = asyncio.run(tester.run_all_tests())
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
