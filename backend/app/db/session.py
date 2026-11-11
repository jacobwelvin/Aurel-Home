import time
import logging
from typing import Generator, Dict, Any
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.engine import Engine
from app.core.config import get_settings

logger = logging.getLogger("aurel.db")

_engine: Engine | None = None
_session_factory: sessionmaker[Session] | None = None
_cached_responsive_ips: Dict[tuple[str, int], str] = {}


def _resolve_responsive_hostaddr(host: str, port: int = 5432) -> str | None:
    """
    Resolve cloud database hostname (such as Supabase pooler) to a verified
    responsive IPv4 address, avoiding multi-IP DNS round-robin hangs where
    unreachable availability zone IPs trigger 10-15s connection timeouts.
    """
    global _cached_responsive_ips
    import socket

    key = (host.lower().strip(), port)
    cached = _cached_responsive_ips.get(key)
    if cached:
        try:
            s = socket.create_connection((cached, port), timeout=0.6)
            s.close()
            return cached
        except Exception:
            _cached_responsive_ips.pop(key, None)

    try:
        addr_info = socket.getaddrinfo(host, port, socket.AF_INET, socket.SOCK_STREAM)
        ips = list(dict.fromkeys([res[4][0] for res in addr_info]))
        for ip in ips:
            try:
                s = socket.create_connection((ip, port), timeout=0.8)
                s.close()
                _cached_responsive_ips[key] = ip
                logger.info(f"Discovered healthy database hostaddr {ip} for {host}:{port}")
                return ip
            except Exception:
                continue
    except Exception as exc:
        logger.warning(f"Failed to probe responsive hostaddr for {host}: {exc}")
    return None


def get_engine() -> Engine:
    """
    Get or create SQLAlchemy engine singleton configured for the environment.
    """
    global _engine
    if _engine is None:
        settings = get_settings()
        url = settings.sync_database_url

        connect_args: Dict[str, Any] = {}
        if url.startswith("sqlite"):
            connect_args["check_same_thread"] = False
            _engine = create_engine(
                url,
                connect_args=connect_args,
                echo=settings.DEBUG and settings.APP_ENV == "development",
            )
        else:
            # PostgreSQL / Supabase connection pooling configuration with bounded connect timeouts
            connect_args["connect_timeout"] = 5  # Fail fast after 5s instead of 2-3 minute OS TCP hang
            connect_args["options"] = "-c statement_timeout=30000"  # 30-second statement limit

            if "pooler.supabase.com" in url or "supabase.co" in url:
                import urllib.parse
                parsed = urllib.parse.urlparse(url)
                host = parsed.hostname
                port = parsed.port or 5432
                if host:
                    responsive_ip = _resolve_responsive_hostaddr(host, port)
                    if responsive_ip:
                        connect_args["hostaddr"] = responsive_ip

            if host and "hostaddr" not in connect_args:
                import socket
                try:
                    addr_info = socket.getaddrinfo(host, port, socket.AF_INET, socket.SOCK_STREAM)
                    if addr_info:
                        connect_args["hostaddr"] = addr_info[0][4][0]
                except socket.gaierror:
                    pass

            _engine = create_engine(
                url,
                connect_args=connect_args,
                pool_pre_ping=True,
                pool_recycle=240,
                pool_size=10,
                max_overflow=10,
                pool_timeout=25,  # 25s queue wait max
                echo=settings.DEBUG and settings.APP_ENV == "development",
            )
    return _engine


def get_session_factory() -> sessionmaker[Session]:
    """
    Get or create SQLAlchemy session factory.
    """
    global _session_factory
    if _session_factory is None:
        engine = get_engine()
        _session_factory = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=engine,
        )
    return _session_factory


def SessionLocal() -> Session:
    """
    Convenience factory function returning a new database Session instance.
    """
    factory = get_session_factory()
    return factory()


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that yields a scoped database session and guarantees closure.
    Measures session acquisition latency for operational health.
    """
    start_time = time.perf_counter()
    factory = get_session_factory()
    db = factory()
    acq_ms = (time.perf_counter() - start_time) * 1000
    if acq_ms > 250:
        logger.warning(f"Database session acquisition latency elevated: {acq_ms:.2f}ms")
    try:
        yield db
    finally:
        db.close()


def check_db_connectivity() -> Dict[str, Any]:
    """
    Safely probe database connectivity with strict bounded timeouts without leaking credentials or crashing.
    """
    settings = get_settings()
    db_url = settings.DATABASE_URL

    # Detect placeholder credentials
    if "YOUR_PASSWORD" in db_url or "YOUR_PROJECT_REF" in db_url:
        return {
            "status": "unconfigured",
            "connected": False,
            "message": "DATABASE_URL contains template placeholders. Configure backend/.env when ready."
        }

    start = time.perf_counter()
    try:
        engine = get_engine()
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        ping_ms = (time.perf_counter() - start) * 1000
        return {
            "status": "connected",
            "connected": True,
            "latency_ms": round(ping_ms, 2),
            "message": f"Database ping successful ({ping_ms:.1f}ms)."
        }
    except Exception as e:
        ping_ms = (time.perf_counter() - start) * 1000
        return {
            "status": "disconnected",
            "connected": False,
            "latency_ms": round(ping_ms, 2),
            "message": f"Database unreachable ({type(e).__name__})"
        }

