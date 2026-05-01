"""
Auth router — register, login (email/password), Google OAuth, logout, and /me.
"""
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, UserCreate, UserRead
from app.services.auth_service import (
    authenticate_user,
    create_access_token,
    get_or_create_google_user,
    register_user,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/providers")
async def list_providers() -> dict:
    """Returns which auth providers are configured on this server."""
    return {"google": bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)}


_COOKIE_SETTINGS = {
    "key": "access_token",
    "httponly": True,
    "samesite": "lax",
    "secure": settings.is_production,
    "max_age": settings.JWT_EXPIRE_MINUTES * 60,
}


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    body: UserCreate,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    try:
        user = await register_user(db, body.email, body.password, body.full_name)
    except ValueError as e:
        raise HTTPException(status_code=409, detail={"error": "conflict", "message": str(e)})

    token = create_access_token(user.id, user.email)
    response.set_cookie(value=token, **_COOKIE_SETTINGS)
    return TokenResponse(user=UserRead.model_validate(user))


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    user = await authenticate_user(db, body.email, body.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "invalid_credentials", "message": "Incorrect email or password"},
        )

    token = create_access_token(user.id, user.email)
    response.set_cookie(value=token, **_COOKIE_SETTINGS)
    return TokenResponse(user=UserRead.model_validate(user))


@router.post("/logout")
async def logout(response: Response) -> dict:
    response.delete_cookie("access_token")
    return {"message": "Logged out"}


@router.get("/me", response_model=UserRead)
async def me(current_user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(current_user)


# ── Google OAuth ──────────────────────────────────────────────────────────────

@router.get("/google")
async def google_login() -> dict:
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail={"error": "not_configured", "message": "Google OAuth is not configured."})

    from urllib.parse import urlencode
    params = urlencode({
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
    })
    return {"redirect_url": f"https://accounts.google.com/o/oauth2/v2/auth?{params}"}


@router.get("/google/callback")
async def google_callback(
    code: str | None = None,
    error: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> dict:
    from fastapi.responses import RedirectResponse

    # Google returned an error or user denied access
    if error or not code:
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/login?error=oauth_cancelled")

    import httpx

    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=503, detail={"error": "not_configured", "message": "Google OAuth is not configured."})

    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    if token_resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail={
                "error": "oauth_error",
                "message": f"Google token exchange failed: {token_resp.text}",
            },
        )

    id_token = token_resp.json().get("id_token")
    if not id_token:
        raise HTTPException(status_code=502, detail={"error": "oauth_error", "message": "No id_token in response."})

    # Decode ID token (without verifying signature — use Google's public keys in production)
    import jwt as pyjwt
    profile = pyjwt.decode(id_token, options={"verify_signature": False})

    user = await get_or_create_google_user(
        db,
        google_id=profile["sub"],
        email=profile["email"],
        full_name=profile.get("name"),
        avatar_url=profile.get("picture"),
    )

    token = create_access_token(user.id, user.email)

    redirect = RedirectResponse(url=settings.FRONTEND_URL)
    redirect.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.is_production,
        max_age=settings.JWT_EXPIRE_MINUTES * 60,
    )
    return redirect
