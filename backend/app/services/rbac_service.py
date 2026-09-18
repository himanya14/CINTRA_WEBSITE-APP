from fastapi import Depends, HTTPException, status

from app.utils.security import get_current_officer


ROLE_ADMIN = "SYSTEM_ADMIN"
ROLE_INVESTIGATOR = "INVESTIGATOR"
ROLE_ANALYST = "FORENSIC_ANALYST"
ROLE_SUPERVISOR = "SUPERVISOR"


VALID_ROLES = {
    ROLE_ADMIN,
    ROLE_INVESTIGATOR,
    ROLE_ANALYST,
    ROLE_SUPERVISOR,
}


ROLE_LABELS = {
    ROLE_ADMIN: "System Administrator",
    ROLE_INVESTIGATOR: "Investigator",
    ROLE_ANALYST: "Forensic Analyst",
    ROLE_SUPERVISOR: "Supervisor",
}


def get_officer_role(officer):
    return getattr(
        officer,
        "system_role",
        ROLE_INVESTIGATOR
    )


def require_roles(*allowed_roles):
    allowed = set(allowed_roles)

    def dependency(
        officer=Depends(get_current_officer)
    ):
        role = get_officer_role(officer)

        if role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "You do not have permission "
                    "to perform this action."
                )
            )

        return officer

    return dependency


# -------------------------------------------------
# ADMINISTRATION
# -------------------------------------------------

require_admin = require_roles(
    ROLE_ADMIN
)


# -------------------------------------------------
# INVESTIGATION WORK
# -------------------------------------------------

require_investigator = require_roles(
    ROLE_INVESTIGATOR,
    ROLE_SUPERVISOR
)


# -------------------------------------------------
# INTELLIGENCE / FORENSIC ANALYSIS
# -------------------------------------------------

require_analysis_access = require_roles(
    ROLE_INVESTIGATOR,
    ROLE_ANALYST,
    ROLE_SUPERVISOR
)


# -------------------------------------------------
# SUPERVISORY ACTIONS
# -------------------------------------------------

require_supervisor = require_roles(
    ROLE_SUPERVISOR,
    ROLE_ADMIN
)


# -------------------------------------------------
# ANY AUTHORIZED CINTRA OFFICER
# -------------------------------------------------

require_authenticated_officer = require_roles(
    ROLE_ADMIN,
    ROLE_INVESTIGATOR,
    ROLE_ANALYST,
    ROLE_SUPERVISOR
)


def has_role(officer, *roles):
    return get_officer_role(officer) in roles


def is_admin(officer):
    return has_role(
        officer,
        ROLE_ADMIN
    )


def is_supervisor(officer):
    return has_role(
        officer,
        ROLE_SUPERVISOR
    )


def can_manage_officers(officer):
    return is_admin(officer)


def can_manage_devices(officer):
    return is_admin(officer)


def can_view_audit_logs(officer):
    return is_admin(officer)


def can_investigate(officer):
    return has_role(
        officer,
        ROLE_INVESTIGATOR,
        ROLE_SUPERVISOR
    )


def can_analyse(officer):
    return has_role(
        officer,
        ROLE_INVESTIGATOR,
        ROLE_ANALYST,
        ROLE_SUPERVISOR
    )