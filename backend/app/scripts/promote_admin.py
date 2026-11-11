r"""
Aurel Home — Server-Side Administrator Provisioning Utility.

Promotes an authenticated patron to an atelier administrator without exposing
any public admin registration endpoint.

Usage from backend directory:
    .\.venv\Scripts\python app\scripts\promote_admin.py user@domain.com
    .\.venv\Scripts\python app\scripts\promote_admin.py user@domain.com --demote
    .\.venv\Scripts\python app\scripts\promote_admin.py user@domain.com --check
"""
import sys
from pathlib import Path
import argparse

# Ensure backend root is on sys.path
BASE_DIR = Path(__file__).resolve().parent.parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from sqlalchemy import func, text
from app.db.session import get_session_factory
from app.models.user import User


def promote_user(email: str, demote: bool = False, check_only: bool = False) -> int:
    """
    Finds the user by email in the database and safely updates their role.
    If the user has verified in Supabase Auth but not yet synced to public.users,
    automatically provisions their record using their exact auth.users UUID.
    Uses atomic transaction management and guaranteed session closure.
    Returns 0 on success, 1 on not found or error.
    """
    clean_email = email.strip().lower()
    target_role = "customer" if demote else "admin"

    factory = get_session_factory()
    session = factory()

    try:
        with session.begin():
            # 1. Query for existing user in public.users (case-insensitive)
            user = session.query(User).filter(func.lower(User.email) == clean_email).first()

            if not user:
                # Check auth.users table in Supabase PostgreSQL (safely handles environments without auth schema)
                auth_row = None
                try:
                    auth_row = session.execute(
                        text("SELECT id, email, raw_user_meta_data FROM auth.users WHERE lower(email) = :email"),
                        {"email": clean_email},
                    ).fetchone()
                except Exception:
                    auth_row = None

                if auth_row:
                    auth_id, auth_email, raw_meta = auth_row
                    import json
                    meta = raw_meta if isinstance(raw_meta, dict) else (json.loads(raw_meta) if raw_meta else {})
                    user_name = meta.get("name") or meta.get("full_name") or None

                    if check_only:
                        print(f"User found in Supabase Auth (auth.users) but not yet synced to public.users.")
                        print(f"User ID:      {auth_id}")
                        print(f"Email:        {auth_email}")
                        print(f"Name:         {user_name or '(not set)'}")
                        print(f"Current Role: customer (registered in Supabase Auth, pending public.users sync)")
                        print(f"Is Admin:     False")
                        return 0

                    # Auto-provision directly into public.users with target role
                    new_user = User(
                        id=auth_id,
                        email=clean_email,
                        name=user_name,
                        role=target_role,
                    )
                    session.add(new_user)
                    print(f"Success: Provisioned user '{clean_email}' directly from Supabase Auth into public.users with role '{target_role}'.")
                    print("The user can now access the Admin Dashboard at http://localhost:3000/admin")
                    return 0

                print(f"Error: User with email '{clean_email}' was not found in public.users or in Supabase auth.users.")
                print("Note: The user must first create an account at http://localhost:3000/register")
                return 1

            # 2. If check only, display current verified status
            if check_only:
                print(f"User ID:      {user.id}")
                print(f"Email:        {user.email}")
                print(f"Name:         {user.name or '(not set)'}")
                print(f"Current Role: {user.role}")
                print(f"Is Admin:     {user.role == 'admin'}")
                return 0

            # 3. Check if already holds target role
            if user.role == target_role:
                print(f"Notice: User '{user.email}' already holds role '{user.role}'. No changes required.")
                return 0

            # 4. Update role (committed atomically on exit of session.begin block)
            previous_role = user.role
            user.role = target_role

        print(f"Success: User '{user.email}' role updated from '{previous_role}' to '{user.role}'.")
        print("The user can now access the Admin Dashboard at http://localhost:3000/admin")
        return 0

    except Exception as e:
        print(f"Error during role update: {type(e).__name__}: {e}")
        return 1
    finally:
        session.close()


def main():
    parser = argparse.ArgumentParser(
        description="Promote or demote an Aurel Home patron in the PostgreSQL database."
    )
    parser.add_argument("email", help="Registered email address of the user")
    parser.add_argument(
        "--demote",
        action="store_true",
        help="Demote user back to standard customer role",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Check the current verified role without modifying anything",
    )
    args = parser.parse_args()

    exit_code = promote_user(
        email=args.email,
        demote=args.demote,
        check_only=args.check,
    )
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
