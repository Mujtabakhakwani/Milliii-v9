#!/usr/bin/env python3
"""
Migration script to consolidate guest role into client role
- Updates all users with role="guest" to role="client"
- Provides detailed report of changes made
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
from pathlib import Path

ROOT_DIR = Path(__file__).parent / 'backend'
load_dotenv(ROOT_DIR / '.env')

async def migrate_guest_to_client():
    """Migrate all guest users to client role"""
    
    # Connect to MongoDB
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    print("=" * 60)
    print("GUEST → CLIENT ROLE MIGRATION")
    print("=" * 60)
    
    # 1. Count existing guest users
    guest_count = await db.users.count_documents({"role": "guest"})
    print(f"\n📊 Found {guest_count} users with role='guest'")
    
    if guest_count == 0:
        print("✅ No guest users found. Migration not needed.")
        client.close()
        return
    
    # 2. List guest users before migration
    guest_users = await db.users.find({"role": "guest"}).to_list(length=None)
    print(f"\n👥 Guest Users to be migrated:")
    for user in guest_users:
        print(f"   - {user.get('name', 'N/A')} ({user.get('email', 'N/A')}) [ID: {user.get('id', 'N/A')}]")
    
    # 3. Perform the migration
    print(f"\n🔄 Migrating {guest_count} users from 'guest' to 'client' role...")
    result = await db.users.update_many(
        {"role": "guest"},
        {"$set": {"role": "client"}}
    )
    
    print(f"✅ Successfully updated {result.modified_count} users")
    
    # 4. Verify migration
    remaining_guests = await db.users.count_documents({"role": "guest"})
    client_count = await db.users.count_documents({"role": "client"})
    
    print(f"\n📊 Post-Migration Stats:")
    print(f"   - Users with role='guest': {remaining_guests}")
    print(f"   - Users with role='client': {client_count}")
    
    if remaining_guests == 0:
        print("\n🎉 Migration completed successfully!")
    else:
        print(f"\n⚠️  Warning: {remaining_guests} users still have 'guest' role")
    
    # 5. Check for any other collections that might reference guest role
    print(f"\n🔍 Checking other collections for 'guest' references...")
    
    # Check password_reset_otps
    otp_guests = await db.password_reset_otps.count_documents({"role": "guest"})
    if otp_guests > 0:
        print(f"   ⚠️  Found {otp_guests} password reset OTPs with guest role (these will expire naturally)")
    
    # Check channels (if they store role info)
    channels = await db.channels.find({}).to_list(length=None)
    guest_in_channels = 0
    for channel in channels:
        if 'members' in channel:
            for member in channel['members']:
                if isinstance(member, dict) and member.get('role') == 'guest':
                    guest_in_channels += 1
    
    if guest_in_channels > 0:
        print(f"   ⚠️  Found {guest_in_channels} channel members with guest role (will be updated by backend)")
    else:
        print(f"   ✅ No guest references found in channels")
    
    print("\n" + "=" * 60)
    print("MIGRATION COMPLETE")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Review the migration results above")
    print("2. Update backend code to remove 'guest' role references")
    print("3. Update frontend code to remove 'guest' role references")
    print("4. Test the application with the migrated users")
    print("5. Restart backend and frontend services")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(migrate_guest_to_client())
