# Re-export from app.main so both `uvicorn main:app` and `uvicorn app.main:app` work.
from app.main import app  # noqa: F401
