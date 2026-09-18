import getpass
import sys
from pathlib import Path


# Allow script to import backend/app
BACKEND_DIR = Path(__file__).resolve().parents[1]

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


from app.database import SessionLocal
from app import models
from app.utils.security import hash_password


def ask_required(label):
    while True:
        value = input(label).strip()

        if value:
            return value

        print("This field is required.")


def main():
    print()
    print("=" * 58)
    print(" CINTRA — INITIAL SYSTEM ADMIN SETUP")
    print("=" * 58)
    print()

    db = SessionLocal()

    try:
        officer_id = ask_required(
            "Officer ID: "
        )

        existing = (
            db.query(models.Officer)
            .filter(
                models.Officer.officer_id
                == officer_id
            )
            .first()
        )

        if existing:
            print()
            print(
                f"Officer {officer_id} "
                "already exists."
            )

            make_admin = input(
                "Convert this officer to "
                "SYSTEM_ADMIN? [y/N]: "
            ).strip().lower()

            if make_admin != "y":
                print("No changes made.")
                return

            existing.system_role = (
                "SYSTEM_ADMIN"
            )

            existing.status = "Active"

            db.commit()

            print()
            print(
                f"{officer_id} is now "
                "a CINTRA System Admin."
            )

            return

        name = ask_required(
            "Officer name: "
        )

        designation = (
            input(
                "Designation "
                "[System Administrator]: "
            ).strip()
            or "System Administrator"
        )

        police_station = (
            input(
                "Unit / Police Station "
                "[CINTRA HQ]: "
            ).strip()
            or "CINTRA HQ"
        )

        email = input(
            "Official email (optional): "
        ).strip() or None

        phone = input(
            "Official phone (optional): "
        ).strip() or None

        while True:
            password = getpass.getpass(
                "Password: "
            )

            confirm = getpass.getpass(
                "Confirm password: "
            )

            if password != confirm:
                print(
                    "Passwords do not match."
                )
                continue

            if len(password) < 10:
                print(
                    "Use at least "
                    "10 characters."
                )
                continue

            break

        admin = models.Officer(
            officer_id=officer_id,
            name=name,
            designation=designation,
            police_station=police_station,
            email=email,
            phone=phone,
            hashed_password=(
                hash_password(password)
            ),
            status="Active",
            system_role="SYSTEM_ADMIN",
            mfa_enabled=False,
            failed_login_attempts=0
        )

        db.add(admin)
        db.commit()

        print()
        print("=" * 58)
        print(" SYSTEM ADMIN CREATED")
        print("=" * 58)

        print(
            f"Officer ID : {officer_id}"
        )

        print(
            "Role       : SYSTEM_ADMIN"
        )

        print(
            "MFA        : Setup required "
            "on first login"
        )

        print()
        print(
            "The first login will return "
            "an authenticator setup key."
        )

    except Exception as exc:
        db.rollback()

        print()
        print(
            "Admin creation failed:"
        )

        print(exc)

        raise

    finally:
        db.close()


if __name__ == "__main__":
    main()