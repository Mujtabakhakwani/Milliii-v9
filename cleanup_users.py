#!/usr/bin/env python3
"""
Script to clean up all users except irfan@millionaze.com
"""
import asyncio
import os
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment variables
ROOT_DIR = Path(__file__).parent / 'backend'
load_dotenv(ROOT_DIR / '.env')

async def cleanup_users():
    """Delete all users except irfan@millionaze.com"""
    
    # Connect to MongoDB
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("🔍 Checking users in database...")
    
    # Get all users
    all_users = await db.users.find({}, {"_id": 0, "email": 1, "name": 1}).to_list(length=None)
    print(f"📊 Found {len(all_users)} users in database")
    
    # Find irfan's user
    irfan_user = await db.users.find_one({"email": "irfan@millionaze.com"})
    
    if not irfan_user:
        print("⚠️  Warning: irfan@millionaze.com account not found!")
        print("Available users:")
        for user in all_users:
            print(f"  - {user.get('email')} ({user.get('name')})")
        return
    
    print(f"✅ Found irfan@millionaze.com account (Name: {irfan_user.get('name')})")
    
    # Delete all users except irfan
    result = await db.users.delete_many({
        "email": {"$ne": "irfan@millionaze.com"}
    })
    
    print(f"🗑️  Deleted {result.deleted_count} users")
    
    # Also clean up related data for deleted users
    print("\n🧹 Cleaning up related data...")
    
    # Get remaining user IDs (should be just irfan)
    remaining_users = await db.users.find({}, {"_id": 0, "id": 1}).to_list(length=None)
    remaining_user_ids = [u["id"] for u in remaining_users]
    
    # Clean up google_sessions for deleted users
    sessions_result = await db.google_sessions.delete_many({
        "user_id": {"$nin": remaining_user_ids}
    })
    print(f"  - Deleted {sessions_result.deleted_count} Google sessions")
    
    # Final count
    final_users = await db.users.count_documents({})
    print(f"\n✅ Cleanup complete! {final_users} user(s) remaining in database")
    
    # List remaining users
    remaining = await db.users.find({}, {"_id": 0, "email": 1, "name": 1, "role": 1}).to_list(length=None)
    print("\n👤 Remaining users:")
    for user in remaining:
        print(f"  - {user.get('email')} ({user.get('name')}) - Role: {user.get('role')}")
    
    client.close()

if __name__ == "__main__":
    print("🚀 Starting user cleanup...\n")
    asyncio.run(cleanup_users())
    print("\n✨ Done!")
