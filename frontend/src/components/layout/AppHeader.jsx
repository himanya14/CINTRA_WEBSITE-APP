import {
  Bell,
  LogOut,
  UserRound,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

import TopNavigation from "./TopNavigation.jsx";
import ForensicTopNavigation from "./ForensicTopNavigation.jsx";

import {
  clearSession,
  getOfficer,
} from "../../services/api.js";

function getOfficerHome(officer) {
  switch (officer?.system_role) {
    case "SYSTEM_ADMIN":
      return "/admin";

    case "FORENSIC_ANALYST":
      return "/forensic";

    case "SUPERVISOR":
    case "INVESTIGATOR":
    default:
      return "/home";
  }
}


function CintraLogo() {
  return (
    <svg
      className="shared-cintra-symbol"
      viewBox="0 0 64 60"
      aria-hidden="true"
    >
      <path
        d="M32 3 L60 55 H48 L32 25 L16 55 H4Z"
        fill="#06194d"
      />

      <path
        d="M32 18 L49 51 H42 L32 33 L22 51 H15Z"
        fill="#ffffff"
      />

      <path
        d="M32 29 L43 51 H21Z"
        fill="#bd8f2c"
      />
    </svg>
  );
}


function AppHeader({
  activePage = "",
  caseId = null,
  showNavigation = true,
}) {
  const navigate = useNavigate();

  const officer = getOfficer();

  const officerId =
    officer?.officer_id ||
    officer?.id ||
    "Officer";

  const designation =
    officer?.designation ||
    (
      officer?.system_role === "FORENSIC_ANALYST"
        ? "Forensic Analyst"
        : "CINTRA Officer"
    );

  const homeRoute =
    getOfficerHome(officer);

  const isForensicAnalyst =
    officer?.system_role === "FORENSIC_ANALYST";


  function logout() {
    clearSession();

    navigate("/", {
      replace: true,
    });
  }


  return (
    <header className="shared-app-header">

      <div className="shared-header-left">

        <button
          type="button"
          className="shared-brand"
          onClick={() => navigate(homeRoute)}
          aria-label="CINTRA Home"
        >
          <CintraLogo />

          <span
            className="shared-brand-divider"
            aria-hidden="true"
          />

          <span className="shared-brand-name">
            CINTRA
          </span>
        </button>

      </div>


      <div className="shared-header-navigation">

        {showNavigation && (
          isForensicAnalyst ? (
            <ForensicTopNavigation
              activeModule={activePage}
            />
          ) : (
            <TopNavigation
              activePage={activePage}
              caseId={caseId}
            />
          )
        )}

      </div>


      <div className="shared-header-actions">

        <button
          type="button"
          className="shared-icon-button"
          aria-label="Notifications"
          title="Notifications"
        >
          <Bell
            size={21}
            strokeWidth={1.8}
          />
        </button>


        <span
          className="shared-action-divider"
          aria-hidden="true"
        />


        <div className="shared-officer-avatar">
          <UserRound
            size={25}
            strokeWidth={1.7}
          />
        </div>


        <div className="shared-officer-copy">
          <strong>
            {officerId}
          </strong>

          <span>
            {designation}
          </span>
        </div>


        <button
          type="button"
          className="shared-icon-button shared-logout"
          onClick={logout}
          aria-label="Logout"
          title="Logout"
        >
          <LogOut
            size={22}
            strokeWidth={1.8}
          />
        </button>

      </div>

    </header>
  );
}


export default AppHeader;
