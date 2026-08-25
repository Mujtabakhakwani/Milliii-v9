#!/usr/bin/env python3
"""
WebSocket Testing for Millionaze Project Management App
Focus: Real-time chat WebSocket endpoint testing
"""

import asyncio
import websockets
import json
import requests
from datetime import datetime
import sys

# Configuration
BACKEND_URL = "https://project-scanner-10.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"
WS_URL = "wss://chatwise-pm.preview.emergentagent.com/api/ws"

class WebSocketTester:
    def __init__(self):
        self.admin_token = None
        self.admin_user_id = None
        self.admin_user_name = None
        self.connection_id = None
        self.general_channel_id = None
        self.test_results = []
        self.received_messages = []
        
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
        print(f"\n{status} {test_name}: {message}")
        if details:
            print(f"   Details: {details}")
    
    def log_ws_message(self, direction, message):
        """Log WebSocket message with timestamp"""
        timestamp = datetime.now().strftime('%H:%M:%S.%f')[:-3]
        arrow = "→" if direction == "SENT" else "←"
        print(f"[{timestamp}] {arrow} {direction}: {json.dumps(message, indent=2)}")
        self.received_messages.append({
            'direction': direction,
            'message': message,
            'timestamp': timestamp
        })
    
    def setup_admin_user(self):
        """Login as admin user to get JWT token"""
        print("\n" + "="*80)
        print("SETTING UP ADMIN USER")
        print("="*80)
        
        admin_credentials = {
            "email": "admin@millionaze.com",
            "password": "admin123"
        }
        
        try:
            response = requests.post(f"{API_BASE}/auth/login", json=admin_credentials)
            if response.status_code == 200:
                data = response.json()
                self.admin_token = data['access_token']
                self.admin_user_id = data['user']['id']
                self.admin_user_name = data['user']['name']
                self.log_result("Admin Login", True, f"Logged in as: {self.admin_user_name}")
                return True
            else:
                self.log_result("Admin Login", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Admin Login", False, f"Exception: {str(e)}")
            return False
    
    def get_general_channel(self):
        """Get the General channel ID"""
        print("\n" + "="*80)
        print("GETTING GENERAL CHANNEL")
        print("="*80)
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.get(f"{API_BASE}/channels", headers=headers)
            
            if response.status_code == 200:
                channels = response.json()
                
                # Find General channel
                for channel in channels:
                    if channel.get('name') == 'General' or channel.get('type') == 'team':
                        self.general_channel_id = channel.get('id')
                        self.log_result("Get General Channel", True, 
                                      f"Found channel: {channel.get('name')} (ID: {self.general_channel_id})")
                        return True
                
                # If no General channel found, use first channel
                if channels and len(channels) > 0:
                    self.general_channel_id = channels[0].get('id')
                    self.log_result("Get General Channel", True, 
                                  f"Using first channel: {channels[0].get('name')} (ID: {self.general_channel_id})")
                    return True
                else:
                    self.log_result("Get General Channel", False, "No channels found")
                    return False
            else:
                self.log_result("Get General Channel", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Get General Channel", False, f"Exception: {str(e)}")
            return False
    
    async def test_websocket_without_auth(self):
        """Test 1: WebSocket connection without authentication should fail"""
        print("\n" + "="*80)
        print("TEST 1: WebSocket Connection Without Authentication")
        print("="*80)
        
        try:
            async with websockets.connect(WS_URL) as websocket:
                self.log_ws_message("SENT", {"type": "ping"})
                await websocket.send(json.dumps({"type": "ping"}))
                
                # Wait for response with timeout
                try:
                    response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                    message = json.loads(response)
                    self.log_ws_message("RECEIVED", message)
                    
                    if message.get('type') == 'error' and 'authentication' in message.get('message', '').lower():
                        self.log_result("WebSocket Without Auth", True, 
                                      "Connection properly rejected without authentication")
                    else:
                        self.log_result("WebSocket Without Auth", False, 
                                      "Connection should require authentication", message)
                except asyncio.TimeoutError:
                    self.log_result("WebSocket Without Auth", True, 
                                  "Connection closed/timeout (authentication required)")
        except Exception as e:
            # Connection might be closed immediately, which is expected
            if "close" in str(e).lower() or "1008" in str(e):
                self.log_result("WebSocket Without Auth", True, 
                              "Connection closed without authentication (expected)")
            else:
                self.log_result("WebSocket Without Auth", False, f"Unexpected error: {str(e)}")
    
    async def test_websocket_with_auth(self):
        """Test 2: WebSocket connection with valid JWT token"""
        print("\n" + "="*80)
        print("TEST 2: WebSocket Connection With Valid JWT Token")
        print("="*80)
        
        try:
            async with websockets.connect(WS_URL) as websocket:
                # Send authentication message
                auth_message = {
                    "type": "auth",
                    "token": self.admin_token
                }
                self.log_ws_message("SENT", auth_message)
                await websocket.send(json.dumps(auth_message))
                
                # Wait for connection confirmation
                response = await asyncio.wait_for(websocket.recv(), timeout=10.0)
                message = json.loads(response)
                self.log_ws_message("RECEIVED", message)
                
                if message.get('type') == 'connected':
                    self.connection_id = message.get('connection_id')
                    received_user_id = message.get('user_id')
                    received_user_name = message.get('user_name')
                    
                    if received_user_id == self.admin_user_id:
                        self.log_result("WebSocket Authentication", True, 
                                      f"Successfully authenticated as {received_user_name}")
                        self.log_result("Connection Message", True, 
                                      f"Received connection_id: {self.connection_id}")
                        return True
                    else:
                        self.log_result("WebSocket Authentication", False, 
                                      f"User ID mismatch: expected {self.admin_user_id}, got {received_user_id}")
                        return False
                else:
                    self.log_result("WebSocket Authentication", False, 
                                  f"Expected 'connected' message, got: {message.get('type')}")
                    return False
                    
        except asyncio.TimeoutError:
            self.log_result("WebSocket Authentication", False, "Timeout waiting for connection confirmation")
            return False
        except Exception as e:
            self.log_result("WebSocket Authentication", False, f"Exception: {str(e)}")
            return False
    
    async def test_join_channel(self, websocket):
        """Test 3: Join the General channel"""
        print("\n" + "="*80)
        print("TEST 3: Join General Channel")
        print("="*80)
        
        try:
            join_message = {
                "type": "join_channel",
                "channel_id": self.general_channel_id
            }
            self.log_ws_message("SENT", join_message)
            await websocket.send(json.dumps(join_message))
            
            # Wait for join confirmation
            response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            message = json.loads(response)
            self.log_ws_message("RECEIVED", message)
            
            if message.get('type') == 'joined_channel' and message.get('channel_id') == self.general_channel_id:
                self.log_result("Join Channel", True, f"Successfully joined channel: {self.general_channel_id}")
                return True
            else:
                self.log_result("Join Channel", False, f"Unexpected response: {message}")
                return False
                
        except asyncio.TimeoutError:
            self.log_result("Join Channel", False, "Timeout waiting for join confirmation")
            return False
        except Exception as e:
            self.log_result("Join Channel", False, f"Exception: {str(e)}")
            return False
    
    async def test_send_message(self, websocket):
        """Test 4: Send a test message to the General channel"""
        print("\n" + "="*80)
        print("TEST 4: Send Test Message")
        print("="*80)
        
        try:
            message_content = "Test WebSocket message from automated testing"
            send_message = {
                "type": "send_message",
                "channel_id": self.general_channel_id,
                "content": message_content,
                "mentions": []
            }
            self.log_ws_message("SENT", send_message)
            await websocket.send(json.dumps(send_message))
            
            # Wait for message confirmation
            response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            message = json.loads(response)
            self.log_ws_message("RECEIVED", message)
            
            if message.get('type') == 'message_sent':
                message_id = message.get('message_id')
                self.log_result("Send Message", True, f"Message sent successfully (ID: {message_id})")
                
                # Verify message is stored in database
                await asyncio.sleep(1)  # Give time for DB write
                headers = {"Authorization": f"Bearer {self.admin_token}"}
                response = requests.get(f"{API_BASE}/channels/{self.general_channel_id}/messages", headers=headers)
                
                if response.status_code == 200:
                    messages = response.json()
                    found_message = any(msg.get('id') == message_id for msg in messages)
                    
                    if found_message:
                        self.log_result("Message Storage", True, "Message successfully stored in database")
                    else:
                        self.log_result("Message Storage", False, "Message not found in database")
                else:
                    self.log_result("Message Storage", False, f"Failed to retrieve messages: {response.status_code}")
                
                return True
            else:
                self.log_result("Send Message", False, f"Unexpected response: {message}")
                return False
                
        except asyncio.TimeoutError:
            self.log_result("Send Message", False, "Timeout waiting for message confirmation")
            return False
        except Exception as e:
            self.log_result("Send Message", False, f"Exception: {str(e)}")
            return False
    
    async def test_send_message_with_mention(self, websocket):
        """Test 5: Send a message with @mention"""
        print("\n" + "="*80)
        print("TEST 5: Send Message With @Mention")
        print("="*80)
        
        try:
            # Get a user to mention (use admin user for simplicity)
            message_content = f"Test message with @mention to {self.admin_user_name}"
            send_message = {
                "type": "send_message",
                "channel_id": self.general_channel_id,
                "content": message_content,
                "mentions": [self.admin_user_id]
            }
            self.log_ws_message("SENT", send_message)
            await websocket.send(json.dumps(send_message))
            
            # Wait for message confirmation
            response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            message = json.loads(response)
            self.log_ws_message("RECEIVED", message)
            
            if message.get('type') == 'message_sent':
                self.log_result("Send Message With Mention", True, "Message with mention sent successfully")
                
                # Verify notification was created
                await asyncio.sleep(1)  # Give time for notification creation
                headers = {"Authorization": f"Bearer {self.admin_token}"}
                response = requests.get(f"{API_BASE}/notifications", headers=headers)
                
                if response.status_code == 200:
                    notifications = response.json()
                    mention_notification = any(
                        notif.get('type') == 'mention' and self.admin_user_id in notif.get('user_id', '')
                        for notif in notifications
                    )
                    
                    if mention_notification:
                        self.log_result("Mention Notification", True, "Notification created for @mention")
                    else:
                        self.log_result("Mention Notification", False, "No notification found for @mention")
                else:
                    self.log_result("Mention Notification", False, f"Failed to retrieve notifications: {response.status_code}")
                
                return True
            else:
                self.log_result("Send Message With Mention", False, f"Unexpected response: {message}")
                return False
                
        except asyncio.TimeoutError:
            self.log_result("Send Message With Mention", False, "Timeout waiting for message confirmation")
            return False
        except Exception as e:
            self.log_result("Send Message With Mention", False, f"Exception: {str(e)}")
            return False
    
    async def test_typing_indicator(self, websocket):
        """Test 6: Send typing indicators"""
        print("\n" + "="*80)
        print("TEST 6: Typing Indicators")
        print("="*80)
        
        try:
            # Send typing start
            typing_start = {
                "type": "typing",
                "channel_id": self.general_channel_id,
                "is_typing": True
            }
            self.log_ws_message("SENT", typing_start)
            await websocket.send(json.dumps(typing_start))
            
            await asyncio.sleep(1)
            
            # Send typing stop
            typing_stop = {
                "type": "typing",
                "channel_id": self.general_channel_id,
                "is_typing": False
            }
            self.log_ws_message("SENT", typing_stop)
            await websocket.send(json.dumps(typing_stop))
            
            self.log_result("Typing Indicators", True, "Typing indicators sent successfully (start and stop)")
            return True
            
        except Exception as e:
            self.log_result("Typing Indicators", False, f"Exception: {str(e)}")
            return False
    
    async def test_heartbeat(self, websocket):
        """Test 7: Heartbeat/ping-pong mechanism"""
        print("\n" + "="*80)
        print("TEST 7: Heartbeat/Ping-Pong Mechanism")
        print("="*80)
        
        try:
            # Wait for server ping
            print("Waiting for server ping (30 second interval)...")
            
            ping_received = False
            start_time = asyncio.get_event_loop().time()
            
            while asyncio.get_event_loop().time() - start_time < 35:
                try:
                    response = await asyncio.wait_for(websocket.recv(), timeout=35.0)
                    message = json.loads(response)
                    self.log_ws_message("RECEIVED", message)
                    
                    if message.get('type') == 'ping':
                        ping_received = True
                        self.log_result("Server Ping", True, "Received ping from server")
                        
                        # Send pong response
                        pong_message = {"type": "pong"}
                        self.log_ws_message("SENT", pong_message)
                        await websocket.send(json.dumps(pong_message))
                        
                        self.log_result("Client Pong", True, "Sent pong response to server")
                        break
                        
                except asyncio.TimeoutError:
                    break
            
            if not ping_received:
                self.log_result("Heartbeat Mechanism", False, 
                              "No ping received within 35 seconds (expected 30 second interval)")
            else:
                self.log_result("Heartbeat Mechanism", True, "Ping-pong mechanism working correctly")
            
            return ping_received
            
        except Exception as e:
            self.log_result("Heartbeat Mechanism", False, f"Exception: {str(e)}")
            return False
    
    async def test_connection_stays_alive(self, websocket):
        """Test 8: Connection stays alive"""
        print("\n" + "="*80)
        print("TEST 8: Connection Stays Alive")
        print("="*80)
        
        try:
            # Send a test message to verify connection is still active
            test_message = {
                "type": "send_message",
                "channel_id": self.general_channel_id,
                "content": "Connection alive test message",
                "mentions": []
            }
            self.log_ws_message("SENT", test_message)
            await websocket.send(json.dumps(test_message))
            
            # Wait for confirmation
            response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            message = json.loads(response)
            self.log_ws_message("RECEIVED", message)
            
            if message.get('type') == 'message_sent':
                self.log_result("Connection Stays Alive", True, 
                              "Connection still active after heartbeat test")
                return True
            else:
                self.log_result("Connection Stays Alive", False, 
                              f"Unexpected response: {message}")
                return False
                
        except Exception as e:
            self.log_result("Connection Stays Alive", False, f"Exception: {str(e)}")
            return False
    
    async def test_graceful_disconnect(self, websocket):
        """Test 9: Graceful disconnect"""
        print("\n" + "="*80)
        print("TEST 9: Graceful Disconnect")
        print("="*80)
        
        try:
            # Close the WebSocket connection gracefully
            await websocket.close()
            self.log_result("Graceful Disconnect", True, "WebSocket connection closed gracefully")
            return True
            
        except Exception as e:
            self.log_result("Graceful Disconnect", False, f"Exception: {str(e)}")
            return False
    
    async def run_all_websocket_tests(self):
        """Run all WebSocket tests in sequence"""
        print("\n" + "="*80)
        print("STARTING WEBSOCKET TESTS")
        print("="*80)
        
        # Test 1: Connection without auth
        await self.test_websocket_without_auth()
        
        # Test 2-9: Connection with auth and all features
        try:
            async with websockets.connect(WS_URL) as websocket:
                # Test 2: Authenticate
                auth_message = {
                    "type": "auth",
                    "token": self.admin_token
                }
                self.log_ws_message("SENT", auth_message)
                await websocket.send(json.dumps(auth_message))
                
                response = await asyncio.wait_for(websocket.recv(), timeout=10.0)
                message = json.loads(response)
                self.log_ws_message("RECEIVED", message)
                
                if message.get('type') == 'connected':
                    self.connection_id = message.get('connection_id')
                    self.log_result("WebSocket Authentication", True, 
                                  f"Authenticated as {message.get('user_name')}")
                    
                    # Test 3: Join channel
                    await self.test_join_channel(websocket)
                    
                    # Test 4: Send message
                    await self.test_send_message(websocket)
                    
                    # Test 5: Send message with mention
                    await self.test_send_message_with_mention(websocket)
                    
                    # Test 6: Typing indicators
                    await self.test_typing_indicator(websocket)
                    
                    # Test 7: Heartbeat
                    await self.test_heartbeat(websocket)
                    
                    # Test 8: Connection stays alive
                    await self.test_connection_stays_alive(websocket)
                    
                    # Test 9: Graceful disconnect
                    await self.test_graceful_disconnect(websocket)
                else:
                    self.log_result("WebSocket Authentication", False, 
                                  f"Authentication failed: {message}")
                    
        except Exception as e:
            self.log_result("WebSocket Tests", False, f"Exception during tests: {str(e)}")
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*80)
        print("TEST SUMMARY")
        print("="*80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"\nTotal Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
        if failed_tests > 0:
            print("\n" + "="*80)
            print("FAILED TESTS")
            print("="*80)
            for result in self.test_results:
                if not result['success']:
                    print(f"\n❌ {result['test']}")
                    print(f"   Message: {result['message']}")
                    if result['details']:
                        print(f"   Details: {result['details']}")
        
        print("\n" + "="*80)
        print("WEBSOCKET MESSAGE LOG")
        print("="*80)
        print(f"\nTotal messages exchanged: {len(self.received_messages)}")
        
        return passed_tests == total_tests

async def main():
    """Main test execution"""
    tester = WebSocketTester()
    
    # Setup
    if not tester.setup_admin_user():
        print("\n❌ Failed to setup admin user. Exiting.")
        sys.exit(1)
    
    if not tester.get_general_channel():
        print("\n❌ Failed to get General channel. Exiting.")
        sys.exit(1)
    
    # Run all WebSocket tests
    await tester.run_all_websocket_tests()
    
    # Print summary
    all_passed = tester.print_summary()
    
    if all_passed:
        print("\n✅ All WebSocket tests passed!")
        sys.exit(0)
    else:
        print("\n❌ Some WebSocket tests failed. See summary above.")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
