from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
from config import settings

PRESERVE_COLLECTIONS = {"users", "role_configs", "integrations"}
PRESERVE_USER_EMAIL = settings.preserve_user_email


async def reset_db():
    mongo_url = settings.mongo_url
    db_name = settings.db_name
    if not mongo_url or not db_name:
        print("ERROR: MONGO_URL or DB_NAME not set in environment")
        return 1

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    # Ensure preserve user exists (do not modify per user request)
    preserve_user = await db.users.find_one({"email": PRESERVE_USER_EMAIL})
    if not preserve_user:
        print(
            f"WARNING: Preserve user {PRESERVE_USER_EMAIL} not found in 'users' collection. Proceeding with wipe regardless."
        )

    # Wipe all collections except the preserved ones
    collections = await db.list_collection_names()
    print(f"Found collections: {collections}")
    for coll in collections:
        if coll in PRESERVE_COLLECTIONS:
            continue
        print(f"Clearing collection: {coll}")
        await db[coll].delete_many({})

    # In users, delete everyone except the preserved email
    if preserve_user:
        result = await db.users.delete_many({"email": {"$ne": PRESERVE_USER_EMAIL}})
        print(f"Deleted {result.deleted_count} users (kept {PRESERVE_USER_EMAIL})")
    else:
        # If not present, still clear all users to get clean state, but leave collection empty
        result = await db.users.delete_many({})
        print(f"Deleted {result.deleted_count} users (no preserved user present)")

    # Extra cleanup for sessions/auth artifacts
    for coll in [
        "google_sessions",
        "notifications",
        "channels",
        "messages",
        "time_entries",
        "time_screenshots",
        "activity_logs",
        "documents",
        "internal_notes",
        "useful_links",
        "meeting_notes",
        "breaks",
    ]:
        if coll in PRESERVE_COLLECTIONS:
            continue
        try:
            await db[coll].delete_many({})
            print(f"Cleared collection (explicit): {coll}")
        except Exception as e:
            print(f"Skip clearing {coll}: {e}")

    client.close()
    print("Database wipe complete.")
    return 0


if __name__ == "__main__":
    rc = asyncio.run(reset_db())
    raise SystemExit(rc)
