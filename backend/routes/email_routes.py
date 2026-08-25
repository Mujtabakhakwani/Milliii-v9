from fastapi import APIRouter, HTTPException
from models.email import (
    PasswordResetEmail, UserInvitationEmail,
    TaskNotificationEmail, TimeTrackingReportEmail,
    EmailResponse
)
from services.email_service import EmailService
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/email", tags=["Email"])

@router.post(
    "/send-password-reset",
    response_model=EmailResponse,
    summary="Send password reset email"
)
async def send_password_reset(email_data: PasswordResetEmail):
    """
    Send a password reset email to the specified recipient.
    
    - **recipient**: Email recipient information
    - **reset_link**: The password reset link
    - **expiration_hours**: Hours until link expiration
    """
    try:
        result = await EmailService.send_password_reset(email_data)
        
        if not result.get("success"):
            raise HTTPException(
                status_code=400,
                detail=f"Failed to send email: {result.get('error_message')}"
            )
        
        return EmailResponse(
            success=True,
            message="Password reset email sent successfully",
            email_id=result.get("email_id")
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending password reset email: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to send password reset email"
        )

@router.post(
    "/send-invitation",
    response_model=EmailResponse,
    summary="Send user invitation email"
)
async def send_invitation(email_data: UserInvitationEmail):
    """
    Send a user invitation email for project collaboration.
    
    - **recipient**: Email recipient information
    - **project_name**: Name of the project
    - **invitation_link**: Link to accept invitation
    - **inviter_name**: Name of the person sending invitation
    """
    try:
        result = await EmailService.send_user_invitation(email_data)
        
        if not result.get("success"):
            raise HTTPException(
                status_code=400,
                detail=f"Failed to send email: {result.get('error_message')}"
            )
        
        return EmailResponse(
            success=True,
            message="Invitation email sent successfully",
            email_id=result.get("email_id")
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending invitation email: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to send invitation email"
        )

@router.post(
    "/send-task-notification",
    response_model=EmailResponse,
    summary="Send task notification email"
)
async def send_task_notification(email_data: TaskNotificationEmail):
    """
    Send a task notification email to the assigned user.
    
    - **recipient**: Email recipient information
    - **task_title**: Title of the task
    - **task_description**: Description of the task
    - **due_date**: Task due date
    - **task_link**: Link to view the task
    """
    try:
        result = await EmailService.send_task_notification(email_data)
        
        if not result.get("success"):
            raise HTTPException(
                status_code=400,
                detail=f"Failed to send email: {result.get('error_message')}"
            )
        
        return EmailResponse(
            success=True,
            message="Task notification email sent successfully",
            email_id=result.get("email_id")
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending task notification: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to send task notification email"
        )

@router.post(
    "/send-time-report",
    response_model=EmailResponse,
    summary="Send time tracking report email"
)
async def send_time_report(email_data: TimeTrackingReportEmail):
    """
    Send a time tracking report email.
    
    - **recipient**: Email recipient information
    - **report_period**: Period covered by the report
    - **total_hours**: Total hours tracked
    - **report_link**: Link to view full report
    """
    try:
        result = await EmailService.send_time_tracking_report(email_data)
        
        if not result.get("success"):
            raise HTTPException(
                status_code=400,
                detail=f"Failed to send email: {result.get('error_message')}"
            )
        
        return EmailResponse(
            success=True,
            message="Time tracking report email sent successfully",
            email_id=result.get("email_id")
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending time report: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to send time tracking report email"
        )
