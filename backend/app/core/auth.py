import requests
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAILS, is_supabase_enabled

security = HTTPBearer(auto_error=False)

def authenticate_supabase_user(email: str, password: str) -> dict:
    """
    Authenticates email & password against Supabase Auth API.
    Verifies user credentials and admin authorization.
    """
    if not is_supabase_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase credentials are not configured on the server."
        )

    url = f"{SUPABASE_URL.rstrip('/')}/auth/v1/token?grant_type=password"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "email": email.strip(),
        "password": password
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        if response.status_code != 200:
            err_data = response.json()
            error_msg = err_data.get("error_description") or err_data.get("msg") or "Invalid email or password"
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=error_msg)

        data = response.json()
        access_token = data.get("access_token")
        user = data.get("user", {})
        user_email = (user.get("email") or email).strip().lower()

        # Perform server-side admin authorization check
        if ADMIN_EMAILS and user_email not in ADMIN_EMAILS:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. User '{user_email}' is not an authorized administrator."
            )

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": data.get("expires_in", 3600),
            "user": {
                "id": user.get("id"),
                "email": user_email,
                "role": "admin"
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Auth] Supabase auth exception: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Authentication server error")

def verify_token_with_supabase(token: str) -> dict:
    """
    Verifies a Supabase JWT access token using the Supabase Auth /user endpoint.
    """
    if not is_supabase_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase credentials are not configured on the server."
        )

    url = f"{SUPABASE_URL.rstrip('/')}/auth/v1/user"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {token}"
    }

    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired or invalid token. Please log in again."
            )

        user_data = response.json()
        user_email = (user_data.get("email") or "").strip().lower()

        # Perform server-side admin authorization check
        if ADMIN_EMAILS and user_email not in ADMIN_EMAILS:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. User '{user_email}' is not an authorized administrator."
            )

        return {
            "id": user_data.get("id"),
            "email": user_email,
            "role": "admin"
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Auth] Supabase token verification exception: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token verification failed."
        )

async def get_current_admin_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    FastAPI Security Dependency. Protects admin endpoints.
    Requires 'Authorization: Bearer <access_token>' header.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in at /admin-login.html"
        )

    token = credentials.credentials
    return verify_token_with_supabase(token)
