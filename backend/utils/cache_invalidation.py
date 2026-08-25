"""
Cache invalidation utilities
Automatically clear cache when data is modified
"""
from .cache import cache, user_list_cache_key, project_list_cache_key


async def invalidate_user_cache():
    """Invalidate user-related cache"""
    await cache.delete(user_list_cache_key())


async def invalidate_project_cache(user_id: str = None):
    """
    Invalidate project cache
    If user_id provided, only invalidate that user's cache
    Otherwise, clear all project caches
    """
    if user_id:
        await cache.delete(project_list_cache_key(user_id))
    else:
        # Clear all project caches (pattern match)
        await cache.clear_pattern("projects:user:")


async def invalidate_task_cache(project_id: str = None):
    """Invalidate task cache for a project or all tasks"""
    if project_id:
        await cache.delete(f"tasks:project:{project_id}")
    else:
        await cache.clear_pattern("tasks:")
