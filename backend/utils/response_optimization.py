"""
Response optimization utilities
Reduces response payload size and improves performance
"""
from typing import Dict, List, Any, Optional


def strip_null_values(data: Dict) -> Dict:
    """Remove null/None values from dictionary to reduce payload size"""
    return {k: v for k, v in data.items() if v is not None}


def minimize_user_response(user: Dict) -> Dict:
    """Return minimal user data for list responses"""
    return {
        "id": user.get("id"),
        "name": user.get("name"),
        "email": user.get("email"),
        "role": user.get("role"),
        "profile_image_url": user.get("profile_image_url")
    }


def minimize_project_response(project: Dict) -> Dict:
    """Return minimal project data for list responses"""
    return strip_null_values({
        "id": project.get("id"),
        "name": project.get("name"),
        "status": project.get("status"),
        "client_name": project.get("client_name"),
        "created_by": project.get("created_by"),
        "owner_id": project.get("owner_id"),
        "created_at": project.get("created_at"),
        "archived": project.get("archived", False)
    })


def minimize_task_response(task: Dict) -> Dict:
    """Return minimal task data for list responses"""
    return strip_null_values({
        "id": task.get("id"),
        "title": task.get("title"),
        "status": task.get("status"),
        "priority": task.get("priority"),
        "due_date": task.get("due_date"),
        "assignee": task.get("assignee"),
        "project_id": task.get("project_id"),
        "created_at": task.get("created_at")
    })


def optimize_screenshot_data(screenshot: Dict) -> Dict:
    """
    Optimize screenshot data for response
    Don't include full base64 image data in lists
    """
    optimized = screenshot.copy()
    
    # Remove large base64 data from list responses
    if "image_data" in optimized:
        del optimized["image_data"]
    
    # Keep only essential fields
    return {
        "id": optimized.get("id"),
        "time_entry_id": optimized.get("time_entry_id"),
        "timestamp": optimized.get("timestamp"),
        "file_path": optimized.get("file_path"),
        "blur_level": optimized.get("blur_level", 0)
    }


def batch_minimize_users(users: List[Dict]) -> List[Dict]:
    """Batch minimize user responses"""
    return [minimize_user_response(u) for u in users]


def batch_minimize_projects(projects: List[Dict]) -> List[Dict]:
    """Batch minimize project responses"""
    return [minimize_project_response(p) for p in projects]


def batch_minimize_tasks(tasks: List[Dict]) -> List[Dict]:
    """Batch minimize task responses"""
    return [minimize_task_response(t) for t in tasks]
