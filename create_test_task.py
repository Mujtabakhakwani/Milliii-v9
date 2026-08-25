#!/usr/bin/env python3
"""
Create test tasks to verify My Tasks functionality
"""

import requests
import json

# Configuration
BACKEND_URL = "https://project-scanner-10.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

def create_test_tasks():
    """Create test tasks assigned to different users"""
    
    # Login as admin to create tasks
    admin_creds = {"email": "admin@millionaze.com", "password": "admin123"}
    session = requests.Session()
    
    try:
        response = session.post(f"{API_BASE}/auth/login", json=admin_creds)
        if response.status_code != 200:
            print("❌ Failed to login as admin")
            return
        
        admin_token = response.json()['access_token']
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get current user (testuser) details
        testuser_creds = {"email": "testuser@millionaze.com", "password": "testpass123"}
        testuser_response = session.post(f"{API_BASE}/auth/login", json=testuser_creds)
        if testuser_response.status_code == 200:
            testuser_data = testuser_response.json()['user']
            testuser_id = testuser_data['id']
            testuser_email = testuser_data['email']
            
            print(f"Creating tasks for Test User:")
            print(f"- ID: {testuser_id}")
            print(f"- Email: {testuser_email}")
            
            # Create tasks with different assignee formats
            test_tasks = [
                {
                    "title": "Test Task for Under Review",
                    "description": "Task assigned by user ID",
                    "assignee": testuser_id,  # Assign by ID
                    "status": "Under Review",
                    "priority": "High"
                },
                {
                    "title": "Test Task for Rejection", 
                    "description": "Task assigned by email",
                    "assignee": testuser_email,  # Assign by email
                    "status": "In Progress",
                    "priority": "Medium"
                },
                {
                    "title": "WebSocket Test Task",
                    "description": "Task assigned by name",
                    "assignee": testuser_data['name'],  # Assign by name
                    "status": "Not Started",
                    "priority": "Low"
                }
            ]
            
            created_tasks = []
            for task_data in test_tasks:
                try:
                    response = session.post(f"{API_BASE}/tasks", json=task_data, headers=headers)
                    if response.status_code == 200:
                        task = response.json()
                        created_tasks.append(task)
                        print(f"✅ Created task: {task['title']} (Assignee: {task['assignee']})")
                    else:
                        print(f"❌ Failed to create task: {task_data['title']} - {response.status_code}")
                except Exception as e:
                    print(f"❌ Exception creating task: {str(e)}")
            
            print(f"\nCreated {len(created_tasks)} test tasks")
            return created_tasks
        else:
            print("❌ Failed to get testuser details")
            return []
            
    except Exception as e:
        print(f"❌ Exception: {str(e)}")
        return []

if __name__ == "__main__":
    create_test_tasks()