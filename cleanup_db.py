import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

async def cleanup_database():
    # Get MongoDB connection
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client.test_database  # Using test_database as shown in the list
    
    print("🗑️  Starting database cleanup...")
    print("=" * 50)
    
    # 1. Delete all projects
    projects_result = await db.projects.delete_many({})
    print(f"✅ Deleted {projects_result.deleted_count} projects")
    
    # 2. Delete all tasks
    tasks_result = await db.tasks.delete_many({})
    print(f"✅ Deleted {tasks_result.deleted_count} tasks")
    
    # 3. Delete all channels
    channels_result = await db.channels.delete_many({})
    print(f"✅ Deleted {channels_result.deleted_count} channels")
    
    # 4. Delete all messages
    messages_result = await db.messages.delete_many({})
    print(f"✅ Deleted {messages_result.deleted_count} messages")
    
    # 5. Delete all documents (useful links, meeting notes, internal notes)
    documents_result = await db.documents.delete_many({})
    print(f"✅ Deleted {documents_result.deleted_count} documents")
    
    # 6. Delete meeting notes
    meeting_notes_result = await db.meeting_notes.delete_many({})
    print(f"✅ Deleted {meeting_notes_result.deleted_count} meeting notes")
    
    # 7. Delete internal notes
    internal_notes_result = await db.internal_notes.delete_many({})
    print(f"✅ Deleted {internal_notes_result.deleted_count} internal notes")
    
    # 8. Keep only admin and users with Jibble integration
    # Delete users that don't have email containing specific domains or are not admin
    # Assuming Jibble users might have specific email patterns or we keep admin only
    
    # First, let's see what users we have
    all_users = await db.users.find({}, {"_id": 0, "email": 1, "name": 1, "role": 1}).to_list(1000)
    print(f"\n📋 Current users ({len(all_users)}):")
    for user in all_users:
        print(f"  - {user.get('name')} ({user.get('email')}) - Role: {user.get('role')}")
    
    # Keep only admin users and delete the rest
    # You can modify this to keep specific Jibble users if you know their emails
    users_to_keep_emails = [
        'admin@example.com',  # Keep admin
        # Add Jibble user emails here if you know them
    ]
    
    users_result = await db.users.delete_many({
        "email": {"$nin": users_to_keep_emails}
    })
    print(f"\n✅ Deleted {users_result.deleted_count} users (kept admin and specified users)")
    
    # Show remaining users
    remaining_users = await db.users.find({}, {"_id": 0, "email": 1, "name": 1, "role": 1}).to_list(1000)
    print(f"\n✨ Remaining users ({len(remaining_users)}):")
    for user in remaining_users:
        print(f"  - {user.get('name')} ({user.get('email')}) - Role: {user.get('role')}")
    
    print("\n" + "=" * 50)
    print("🎉 Database cleanup completed!")
    print("\nSummary:")
    print(f"  - Projects deleted: {projects_result.deleted_count}")
    print(f"  - Tasks deleted: {tasks_result.deleted_count}")
    print(f"  - Channels deleted: {channels_result.deleted_count}")
    print(f"  - Messages deleted: {messages_result.deleted_count}")
    print(f"  - Documents deleted: {documents_result.deleted_count}")
    print(f"  - Users deleted: {users_result.deleted_count}")
    print(f"  - Users remaining: {len(remaining_users)}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(cleanup_database())
