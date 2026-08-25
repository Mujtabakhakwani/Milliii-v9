"""
Pagination utilities for API endpoints
Reduces data transfer and improves performance
"""
from typing import List, Dict, Any, Optional
from fastapi import Query


class PaginationParams:
    """Pagination parameters for list endpoints"""
    
    def __init__(
        self,
        page: int = Query(1, ge=1, description="Page number (starts from 1)"),
        limit: int = Query(50, ge=1, le=100, description="Items per page (max 100)")
    ):
        self.page = page
        self.limit = limit
        self.skip = (page - 1) * limit


def paginate_response(
    data: List[Any],
    total: int,
    page: int,
    limit: int
) -> Dict[str, Any]:
    """
    Create paginated response with metadata
    
    Args:
        data: List of items for current page
        total: Total number of items
        page: Current page number
        limit: Items per page
    
    Returns:
        Dictionary with data and pagination metadata
    """
    total_pages = (total + limit - 1) // limit  # Ceiling division
    
    return {
        "data": data,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1
        }
    }


# Field projections to reduce data transfer
# Only fetch fields that are actually needed

USER_BASIC_FIELDS = {
    "_id": 0,
    "id": 1,
    "name": 1,
    "email": 1,
    "role": 1,
    "profile_image_url": 1
}

USER_LIST_FIELDS = {
    "_id": 0,
    "id": 1,
    "name": 1,
    "email": 1,
    "role": 1,
    "profile_image_url": 1,
    "created_at": 1
}

PROJECT_LIST_FIELDS = {
    "_id": 0,
    "id": 1,
    "name": 1,
    "status": 1,
    "client_name": 1,
    "client_email": 1,
    "business_name": 1,
    "budget": 1,
    "created_by": 1,
    # Project owner and membership fields are needed for filtering
    "project_owner": 1,
    "team_members": 1,
    "guests": 1,
    "owner_id": 1,
    "created_at": 1,
    "archived": 1
}

TASK_LIST_FIELDS = {
    "_id": 0,
    "id": 1,
    "title": 1,
    "status": 1,
    "priority": 1,
    "due_date": 1,
    "assignee": 1,
    "project_id": 1,
    "created_at": 1
}

MESSAGE_LIST_FIELDS = {
    "_id": 0,
    "id": 1,
    "channel_id": 1,
    "content": 1,
    "sender_id": 1,
    "sender_name": 1,
    "timestamp": 1,
    "edited": 1
}

TIME_ENTRY_LIST_FIELDS = {
    "_id": 0,
    "id": 1,
    "user_id": 1,
    "task_id": 1,
    "project_id": 1,
    "clock_in_time": 1,
    "clock_out_time": 1,
    "duration_seconds": 1,
    "is_active": 1
}
