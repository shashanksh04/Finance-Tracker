"""Usage: python make_admin.py <email>

Promotes a user to admin by email.
Run against the database directly (synchronous).
"""
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.user import User

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python make_admin.py <email>")
        sys.exit(1)

    email = sys.argv[1]
    engine = create_engine(settings.DATABASE_URL_SYNC)
    with Session(engine) as session:
        user = session.query(User).filter(User.email == email).first()
        if not user:
            print(f"User with email '{email}' not found.")
            sys.exit(1)
        user.is_admin = True
        session.commit()
        print(f"User '{email}' is now an admin.")
