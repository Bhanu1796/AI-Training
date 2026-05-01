from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    auth_router,
    chat_router,
    files_router,
    image_router,
    rag_router,
    sheets_router,
    sql_router,
)
from app.core.config import settings
from app.core.logging import configure_logging


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    Path(settings.CHROMA_PERSIST_DIR).mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title="Amzur AI Chat",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    debug=True,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_PREFIX = "/api"
app.include_router(auth_router, prefix=_PREFIX)
app.include_router(chat_router, prefix=_PREFIX)
app.include_router(files_router, prefix=_PREFIX)
app.include_router(rag_router, prefix=_PREFIX)
app.include_router(image_router, prefix=_PREFIX)
app.include_router(sql_router, prefix=_PREFIX)
app.include_router(sheets_router, prefix=_PREFIX)


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok", "app": settings.APP_NAME, "environment": settings.ENVIRONMENT}
