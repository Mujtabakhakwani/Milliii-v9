#!/usr/bin/env python3
"""
Database cleanup script - keeps only irfan@millionaze.com user
Deletes all other data for fresh manual testing
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

async def cleanup_database():
    # Connect to MongoDB
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_url)
    db = client.millii
    
    print("\n" + "="*80)
    print("DATABASE CLEANUP FOR MANUAL TESTING")
    print("="*80)
    
    # Get irfan's user data to preserve
    irfan_user = await db.users.find_one({"email": "irfan@millionaze.com"}, {"_id": 0})
    
    if not irfan_user:
        print("\n❌ ERROR: User irfan@millionaze.com not found in database!")
        print("   Cannot proceed with cleanup.")
        return
    
    irfan_id = irfan_user.get("id")
    print(f"\n✅ Found user: {irfan_user.get('name')} ({irfan_user.get('email')})")
    print(f"   User ID: {irfan_id}")
    
    # Collections to clean (delete all documents)
    collections_to_clear = [
        "projects",
        "tasks", 
        "channels",
        "messages",
        "notifications",
        "time_entries",
        "time_screenshots",
        "activity_logs",
        "documents",
        "internal_notes",
        "useful_links",
        "meeting_notes",
        "breaks",
        "channel_unreads",
        "message_reads",
        "task_activities",
        "task_comments",
        "google_sessions",
        "password_reset_otps"
    ]
    
    print("\n🗑️  Deleting all data from collections...")
    for collection_name in collections_to_clear:
        try:
            result = await db[collection_name].delete_many({})
            print(f"   ✅ {collection_name}: Deleted {result.deleted_count} documents")
        except Exception as e:
            print(f"   ⚠️  {collection_name}: {str(e)}")
    
    # Delete all users EXCEPT irfan@millionaze.com
    print("\n👥 Cleaning users (keeping only irfan@millionaze.com)...")
    result = await db.users.delete_many({"email": {"$ne": "irfan@millionaze.com"}})
    print(f"   ✅ Deleted {result.deleted_count} users (kept irfan@millionaze.com)")
    
    # Verify irfan still exists
    irfan_check = await db.users.find_one({"email": "irfan@millionaze.com"}, {"_id": 0})
    if irfan_check:
        print(f"   ✅ Verified: {irfan_check.get('name')} still exists in database")
    else:
        print(f"   ❌ ERROR: irfan@millionaze.com was accidentally deleted!")
    
    # Get final counts
    print("\n📊 Final Database State:")
    final_counts = {}
    all_collections = await db.list_collection_names()
    for coll_name in all_collections:
        if coll_name != "system.indexes":
            count = await db[coll_name].count_documents({})
            if count > 0:
                final_counts[coll_name] = count
                print(f"   {coll_name}: {count} documents")
    
    print("\n" + "="*80)
    print("✅ DATABASE CLEANUP COMPLETE!")
    print("="*80)
    print(f"\n🎯 Ready for manual testing with user: irfan@millionaze.com")
    print(f"   Password: (use existing password)")
    print(f"\nAll other data has been cleared. You can now test the app from scratch!")
    print("="*80 + "\n")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(cleanup_database())
