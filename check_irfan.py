#!/usr/bin/env python3
"""
Script to check irfan@millionaze.com account details
"""
import asyncio
import os
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment variables
ROOT_DIR = Path(__file__).parent / 'backend'
load_dotenv(ROOT_DIR / '.env')

async def check_irfan():
    """Check irfan's account details"""
    
    # Connect to MongoDB
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("🔍 Checking irfan@millionaze.com account...\n")
    
    # Find irfan's user
    irfan_user = await db.users.find_one({"email": "irfan@millionaze.com"})
    
    if not irfan_user:
        print("❌ irfan@millionaze.com account NOT FOUND!")
        
        # Check for similar emails
        all_users = await db.users.find({}, {"_id": 0, "email": 1, "name": 1}).to_list(length=None)
        print(f"\n📊 Found {len(all_users)} total users:")
        for user in all_users:
            print(f"  - {user.get('email')} ({user.get('name')})")
    else:
        print("✅ Account found!")
        print(f"   Name: {irfan_user.get('name')}")
        print(f"   Email: {irfan_user.get('email')}")
        print(f"   Role: {irfan_user.get('role')}")
        print(f"   ID: {irfan_user.get('id')}")
        
        # Check if password_hash exists
        has_password = 'password_hash' in irfan_user and irfan_user.get('password_hash')
        print(f"   Has Password: {'✅ YES' if has_password else '❌ NO'}")
        
        if not has_password:
            print("\n⚠️  ISSUE FOUND: Account has no password_hash!")
            print("   This account was likely created via Jibble sync without a password.")
            print("   The user cannot log in with email/password.")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_irfan())
