import requests
import urllib3
import ssl
import time
from requests.adapters import HTTPAdapter
from fastapi import Depends, HTTPException, status, Request

# In-memory session cache to survive offline periods and prevent redundant network calls
SESSION_CACHE = {}
CACHE_TTL = 300       # Cache tokens for 5 minutes of active offline state
CACHE_MAX_AGE = 86400 # Allow fallback up to 24 hours if network is down
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAILS, is_supabase_enabled

security = HTTPBearer(auto_error=False)

class StableTLSAdapter(HTTPAdapter):
    def init_poolmanager(self, *args, **kwargs):
        ctx = urllib3.util.ssl_.create_urllib3_context()
        # Fall back to TLS 1.2 and set SECLEVEL to compatibility mode to avoid OpenSSL handshake failures on Windows
        ctx.minimum_version = ssl.TLSVersion.TLSv1_2
        ctx.set_ciphers('DEFAULT@SECLEVEL=1')
        kwargs['ssl_context'] = ctx
        return super(StableTLSAdapter, self).init_poolmanager(*args, **kwargs)

def get_stable_session():
    session = requests.Session()
    session.mount("https://", StableTLSAdapter())
    return session

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
        response = get_stable_session().post(url, json=payload, headers=headers, timeout=10)
        
        # Safe JSON parsing
        try:
            data = response.json()
        except Exception:
            data = {}
            
        if response.status_code != 200:
            error_msg = data.get("error_description") or data.get("msg") or f"Supabase auth failed with status code {response.status_code}"
            # Catch API key or JWT claim errors from gateway/auth server
            if any(term in error_msg for term in ["apiKey", "claim", "JWT", "apikey"]) or response.status_code in [401, 403]:
                error_msg = f"Supabase Auth configuration error. Please verify your SUPABASE_SERVICE_ROLE_KEY in .env."
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=error_msg)

        access_token = data.get("access_token")
        if not access_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token response from authentication server."
            )

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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Authentication server error: {str(e)}"
        )

def verify_token_with_supabase(token: str) -> dict:
    """
    Verifies a Supabase JWT access token using the Supabase Auth /user endpoint.
    Uses in-memory cache to handle offline/intermittent network drops.
    """
    now = time.time()
    
    # 1. Check in-memory cache first
    if token in SESSION_CACHE:
        cache_entry = SESSION_CACHE[token]
        # If cache is fresh, return it immediately
        if now - cache_entry["timestamp"] < CACHE_TTL:
            return cache_entry["user"]

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
        response = get_stable_session().get(url, headers=headers, timeout=5)
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

        user_info = {
            "id": user_data.get("id"),
            "email": user_email,
            "role": "admin"
        }
        
        # Save to cache
        SESSION_CACHE[token] = {
            "timestamp": now,
            "user": user_info
        }
        return user_info

    except HTTPException:
        # If credentials failed explicitly (e.g. 401/403), remove from cache and raise
        SESSION_CACHE.pop(token, None)
        raise
    except Exception as e:
        print(f"[Auth] Supabase token verification exception: {e}")
        
        # 2. Network/DNS error fallback:
        # If we have a cached session, reuse it (up to CACHE_MAX_AGE) to prevent logout during network drops
        if token in SESSION_CACHE:
            cache_entry = SESSION_CACHE[token]
            if now - cache_entry["timestamp"] < CACHE_MAX_AGE:
                print(f"[Auth] Network error. Falling back to cached session for token.")
                return cache_entry["user"]
                
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token verification failed due to network error."
        )

async def get_current_admin_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    FastAPI Security Dependency. Protects admin endpoints.
    Supports standard 'Authorization: Bearer <access_token>' header or 'admin_token' cookie.
    """
    token = None
    if credentials and credentials.credentials:
        token = credentials.credentials
    else:
        # Try cookie fallback
        token = request.cookies.get("admin_token")

    # Also support query parameter fallback for EventSource/SSE
    if not token:
        token = request.query_params.get("token")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in at /admin-login"
        )

    return verify_token_with_supabase(token)
