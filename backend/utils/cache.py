"""
Simple in-memory cache for frequently accessed data
Reduces database load and improves response times
"""
from typing import Any, Optional, Dict
from datetime import datetime, timedelta
import asyncio


class SimpleCache:
    """Thread-safe in-memory cache with TTL support"""
    
    def __init__(self):
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._lock = asyncio.Lock()
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache if not expired"""
        async with self._lock:
            if key not in self._cache:
                return None
            
            cache_entry = self._cache[key]
            
            # Check if expired
            if datetime.now() > cache_entry["expires_at"]:
                del self._cache[key]
                return None
            
            return cache_entry["value"]
    
    async def set(self, key: str, value: Any, ttl_seconds: int = 300):
        """
        Set value in cache with TTL (default 5 minutes)
        
        Args:
            key: Cache key
            value: Value to cache
            ttl_seconds: Time to live in seconds (default 300 = 5 minutes)
        """
        async with self._lock:
            self._cache[key] = {
                "value": value,
                "expires_at": datetime.now() + timedelta(seconds=ttl_seconds)
            }
    
    async def delete(self, key: str):
        """Delete key from cache"""
        async with self._lock:
            if key in self._cache:
                del self._cache[key]
    
    async def clear(self):
        """Clear all cache"""
        async with self._lock:
            self._cache.clear()
    
    async def clear_pattern(self, pattern: str):
        """Clear all keys matching pattern (simple string match)"""
        async with self._lock:
            keys_to_delete = [k for k in self._cache.keys() if pattern in k]
            for key in keys_to_delete:
                del self._cache[key]


# Global cache instance
cache = SimpleCache()


# Cache key generators
def user_list_cache_key() -> str:
    return "users:list"

def project_list_cache_key(user_id: str) -> str:
    return f"projects:user:{user_id}"

def user_cache_key(user_id: str) -> str:
    return f"user:{user_id}"

def project_cache_key(project_id: str) -> str:
    return f"project:{project_id}"
