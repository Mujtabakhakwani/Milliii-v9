#!/usr/bin/env python3
"""
Script to reset irfan@millionaze.com password
"""
import asyncio
import os
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from passlib.context import CryptContext

# Load environment variables
ROOT_DIR = Path(__file__).parent / 'backend'
load_dotenv(ROOT_DIR / '.env')

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def reset_irfan_password():
    """Reset irfan's password to a known value"""
    
    # Connect to MongoDB
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("🔐 Resetting irfan@millionaze.com password...\n")
    
    # Find irfan's user
    irfan_user = await db.users.find_one({"email": "irfan@millionaze.com"})
    
    if not irfan_user:
        print("❌ irfan@millionaze.com account NOT FOUND!")
        client.close()
        return
    
    # Set new password
    new_password = "admin123"
    password_hash = pwd_context.hash(new_password)
    
    # Update password
    result = await db.users.update_one(
        {"email": "irfan@millionaze.com"},
        {"$set": {"password_hash": password_hash}}
    )
    
    if result.modified_count > 0:
        print("✅ Password reset successful!")
        print(f"\n📧 Email: irfan@millionaze.com")
        print(f"🔑 Password: {new_password}")
        print(f"\n👤 Account Details:")
        print(f"   Name: {irfan_user.get('name')}")
        print(f"   Role: {irfan_user.get('role')}")
    else:
        print("⚠️  Password was already set to this value or update failed")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(reset_irfan_password())
    print("\n✨ Done! You can now log in with the credentials above.")
