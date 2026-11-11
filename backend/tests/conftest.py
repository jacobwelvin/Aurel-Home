import pytest
from typing import Generator
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.session import get_db
from app.models import Base
from app.core.config import get_settings

# In-memory SQLite engine for fast, isolated, non-destructive testing
TEST_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    """Create all tables in memory once for the test session."""
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    """Yields a fresh transaction per test."""
    connection = test_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    if transaction.is_active:
        transaction.rollback()
    connection.close()


@pytest.fixture()
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """Test client with dependency override pointing to isolated in-memory DB."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


import uuid


# Shared test JWT secret — must match what test_auth.py uses
_TEST_JWT_SECRET = "super-secret-test-jwt-key-32-chars-long!"
_ADMIN_UUID = uuid.UUID("00000000-aaaa-bbbb-cccc-000000000099")
_ADMIN_EMAIL = "test_admin_fixture@aurelhome.com"


@pytest.fixture()
def admin_headers(db_session: Session, monkeypatch) -> dict:
    """
    Administrative authorization headers for write endpoints.
    Creates an admin user in the test DB and returns a valid JWT Bearer header.
    """
    from app.models.user import User

    monkeypatch.setattr(get_settings(), "SUPABASE_JWT_SECRET", _TEST_JWT_SECRET)

    # Ensure admin user exists in the test database
    existing = db_session.query(User).filter(User.id == _ADMIN_UUID).first()
    if not existing:
        admin_user = User(
            id=_ADMIN_UUID,
            email=_ADMIN_EMAIL,
            name="Test Admin Fixture",
            role="admin",
        )
        db_session.add(admin_user)
        db_session.commit()

    # Generate a valid JWT token for this admin
    import time
    import jwt as pyjwt
    payload = {
        "sub": str(_ADMIN_UUID),
        "email": _ADMIN_EMAIL,
        "aud": "authenticated",
        "role": "authenticated",
        "exp": int(time.time()) + 3600,
        "iat": int(time.time()),
        "user_metadata": {"name": "Test Admin Fixture"},
    }
    token = pyjwt.encode(payload, _TEST_JWT_SECRET, algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}
