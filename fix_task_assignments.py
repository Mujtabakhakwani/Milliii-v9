#!/usr/bin/env python3
"""
Fix task assignments by updating display name assignments to user IDs
"""

import requests
import json
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/backend/.env')

# Configuration
BACKEND_URL = "https://project-scanner-10.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')

async def fix_task_assignments():
    """Fix task assignments to use user IDs instead of display names"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db_name = os.environ.get('DB_NAME', 'test_database')
    db = client[db_name]
    
    print("🔧 Starting Task Assignment Fix...")
    
    try:
        # Get all users to create a mapping
        print("📋 Fetching all users...")
        users_cursor = db.users.find({}, {"_id": 0})
        users = await users_cursor.to_list(length=None)
        
        # Create mapping from name to ID
        name_to_id = {}
        email_to_id = {}
        for user in users:
            name_to_id[user.get('name', '')] = user.get('id')
            email_to_id[user.get('email', '')] = user.get('id')
        
        print(f"👥 Found {len(users)} users")
        
        # Get all tasks
        print("📋 Fetching all tasks...")
        tasks_cursor = db.tasks.find({}, {"_id": 0})
        tasks = await tasks_cursor.to_list(length=None)
        
        print(f"📝 Found {len(tasks)} tasks")
        
        # Track changes
        fixed_count = 0
        issues = []
        
        # Process each task
        for task in tasks:
            task_id = task.get('id')
            assignee = task.get('assignee')
            
            if not assignee:
                continue
                
            # Check if assignee needs fixing
            needs_fix = False
            new_assignee = assignee
            
            # If assignee is a display name, convert to ID
            if assignee in name_to_id:
                new_assignee = name_to_id[assignee]
                needs_fix = True
                print(f"🔄 Converting name '{assignee}' to ID '{new_assignee}' for task: {task.get('title', 'Unnamed')}")
            
            # If assignee is an email with wrong case, fix it
            elif assignee.lower() in [email.lower() for email in email_to_id.keys()]:
                # Find the correct email case
                correct_email = None
                for email in email_to_id.keys():
                    if email.lower() == assignee.lower():
                        correct_email = email
                        break
                
                if correct_email and correct_email != assignee:
                    new_assignee = email_to_id[correct_email]
                    needs_fix = True
                    print(f"🔄 Converting email '{assignee}' to ID '{new_assignee}' for task: {task.get('title', 'Unnamed')}")
            
            # Update the task if needed
            if needs_fix:
                try:
                    await db.tasks.update_one(
                        {"id": task_id},
                        {"$set": {"assignee": new_assignee}}
                    )
                    fixed_count += 1
                except Exception as e:
                    issues.append(f"Failed to update task {task_id}: {str(e)}")
        
        # Report results
        print(f"\n✅ Task Assignment Fix Complete!")
        print(f"📊 Fixed {fixed_count} task assignments")
        
        if issues:
            print(f"⚠️  Issues encountered:")
            for issue in issues[:5]:  # Show first 5 issues
                print(f"   - {issue}")
        
    except Exception as e:
        print(f"❌ Error during fix: {str(e)}")
    
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(fix_task_assignments())