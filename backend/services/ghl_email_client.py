import httpx
import logging
from typing import Optional, Dict, Any
from config import settings

logger = logging.getLogger(__name__)


class GHLEmailClient:
    def __init__(self):
        self.api_key = settings.ghl_api_key
        self.base_url = settings.ghl_api_base_url
        self.sub_account_id = settings.ghl_sub_account_id
        self.timeout = httpx.Timeout(30.0)

        # Log warnings but don't fail at init
        if not self.api_key:
            logger.warning("GHL_API_KEY environment variable is not set")
        if not self.sub_account_id:
            logger.warning("GHL_SUB_ACCOUNT_ID environment variable is not set")

        # Allow overriding default from email via env; fallback to millii.ai
        self.default_from_email = settings.default_from_email
        self.default_from_name = settings.default_from_name

    def _get_headers(self) -> Dict[str, str]:
        """Construct authorization headers with JWT Bearer token"""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Version": "2021-07-28",
        }

    async def get_or_create_contact(
        self, email: str, name: Optional[str] = None
    ) -> Optional[str]:
        """
        Get existing contact by email or create new one

        Args:
            email: Contact email address
            name: Contact name (optional)

        Returns:
            Contact ID or None if failed
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                # First, try to find existing contact by email using query parameter
                search_response = await client.get(
                    f"{self.base_url}/contacts/lookup",
                    headers=self._get_headers(),
                    params={"email": email, "locationId": self.sub_account_id},
                )

                if search_response.status_code == 200:
                    contact_data = search_response.json()
                    if contact_data and "contacts" in contact_data:
                        contacts = contact_data.get("contacts", [])
                        if contacts and len(contacts) > 0:
                            contact_id = contacts[0].get("id")
                            logger.info(
                                f"Found existing contact: {contact_id} for {email}"
                            )
                            return contact_id

                # If not found, create new contact
                first_name = ""
                last_name = ""
                if name:
                    name_parts = name.split(" ", 1)
                    first_name = name_parts[0]
                    last_name = name_parts[1] if len(name_parts) > 1 else ""

                create_payload = {
                    "locationId": self.sub_account_id,
                    "email": email,
                    "firstName": first_name or "User",
                    "lastName": last_name,
                }

                create_response = await client.post(
                    f"{self.base_url}/contacts/",
                    headers=self._get_headers(),
                    json=create_payload,
                )

                if create_response.status_code in [200, 201]:
                    contact_data = create_response.json()
                    contact_id = contact_data.get("contact", {}).get("id")
                    logger.info(f"Created new contact: {contact_id} for {email}")
                    return contact_id
                elif create_response.status_code == 400:
                    # Check if it's a duplicate contact error - extract existing contact ID
                    error_data = create_response.json()
                    if "meta" in error_data and "contactId" in error_data["meta"]:
                        existing_contact_id = error_data["meta"]["contactId"]
                        logger.info(
                            f"Contact already exists: {existing_contact_id} for {email}"
                        )
                        return existing_contact_id
                    else:
                        logger.error(
                            f"Failed to create contact: {create_response.status_code} - {create_response.text}"
                        )
                        return None
                else:
                    logger.error(
                        f"Failed to create contact: {create_response.status_code} - {create_response.text}"
                    )
                    return None

        except Exception as e:
            logger.error(f"Error in get_or_create_contact: {str(e)}")
            return None

    async def send_email(
        self,
        to_email: str,
        to_name: Optional[str],
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        from_name: Optional[str] = None,
        from_email: Optional[str] = None,
        contact_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Send email through GoHighLevel Email API

        Args:
            to_email: Recipient email address
            to_name: Recipient display name
            subject: Email subject line
            html_content: HTML formatted email body
            text_content: Plain text email body
            from_name: Sender display name
            from_email: Sender email address
            contact_id: GoHighLevel contact ID for conversation threading

        Returns:
            Response dictionary with email ID and status
        """
        # Validate credentials at send time
        if not self.api_key:
            return {
                "success": False,
                "error_code": "MISSING_API_KEY",
                "error_message": "GHL_API_KEY environment variable is not configured",
            }
        if not self.sub_account_id:
            return {
                "success": False,
                "error_code": "MISSING_SUB_ACCOUNT_ID",
                "error_message": "GHL_SUB_ACCOUNT_ID environment variable is not configured",
            }

        from_name = from_name or self.default_from_name
        from_email = from_email or self.default_from_email

        # Get or create contact if contact_id not provided
        if not contact_id:
            contact_id = await self.get_or_create_contact(to_email, to_name)
            if not contact_id:
                return {
                    "success": False,
                    "error_code": "CONTACT_CREATION_FAILED",
                    "error_message": "Failed to create or find contact in GoHighLevel",
                }

        # Construct the payload according to GHL API v2
        payload = {
            "type": "Email",
            "locationId": self.sub_account_id,
            "contactId": contact_id,
            "subject": subject,
            "html": html_content,
            # Try multiple fields accepted by GHL variants to enforce sender address
            "emailFrom": from_email,
            "fromEmail": from_email,
            "fromAddress": from_email,
            "from": from_email,
            "emailFromName": from_name,
            "sender": {"email": from_email, "name": from_name},
            "fromName": from_name,
            # Recipient variants
            "emailTo": to_email,
            "toEmail": to_email,
            "to": to_email,
        }

        if text_content:
            payload["text"] = text_content

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                # Using the conversations/messages endpoint
                response = await client.post(
                    f"{self.base_url}/conversations/messages",
                    headers=self._get_headers(),
                    json=payload,
                )

                logger.info(f"GHL API Response Status: {response.status_code}")
                logger.info(f"GHL API Response: {response.text[:500]}")

                if response.status_code in [200, 201]:
                    response_data = response.json()
                    logger.info(f"Email sent successfully to {to_email}")
                    return {
                        "success": True,
                        "email_id": response_data.get("messageId")
                        or response_data.get("id"),
                        "status": "sent",
                        "response": response_data,
                    }
                else:
                    logger.error(
                        f"Failed to send email: {response.status_code} - "
                        f"{response.text}"
                    )
                    return {
                        "success": False,
                        "error_code": str(response.status_code),
                        "error_message": response.text,
                    }
        except httpx.TimeoutException as e:
            logger.error(f"Timeout sending email to {to_email}: {str(e)}")
            return {
                "success": False,
                "error_code": "TIMEOUT",
                "error_message": "Request timed out after 30 seconds",
            }
        except Exception as e:
            logger.error(f"Error sending email to {to_email}: {str(e)}")
            return {
                "success": False,
                "error_code": "INTERNAL_ERROR",
                "error_message": str(e),
            }


# Singleton instance
ghl_email_client = GHLEmailClient()
