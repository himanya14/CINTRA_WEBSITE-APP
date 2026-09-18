import { useNavigate } from "react-router-dom";
import { getOfficer } from "../../services/api.js";

function TopNavigation({
  activePage = "",
  caseId = null,
}) {
  const navigate = useNavigate();

  const officer = getOfficer();
  const role = officer?.system_role || "";

  /*
   * GLOBAL CINTRA NAVIGATION
   *
   * Global header contains only modules that have
   * genuine global routes.
   *
   * Evidence and Reports are intentionally NOT here.
   *
   * Evidence:
   *   /cases/:caseId/evidence
   *
   * Reports / Chargesheet:
   *   /cases/:caseId/chargesheet
   *
   * These belong inside a selected case.
   */

  const allItems = [
    {
      key: "home",
      label: "Home",
      roles: [
        "INVESTIGATOR",
        "SUPERVISOR",
      ],
      action: () => navigate("/home"),
    },

    {
      key: "cases",
      label: "Cases",
      roles: [
        "INVESTIGATOR",
        "SUPERVISOR",
      ],
      action: () => navigate("/cases"),
    },

    {
      key: "persons",
      label: "Persons",
      roles: [
        "INVESTIGATOR",
        "SUPERVISOR",
      ],
      action: () => navigate("/persons"),
    },

    {
      key: "intelligence",
      label: "Intelligence",
      roles: [
        "INVESTIGATOR",
        "SUPERVISOR",
      ],
      action: () => {
        if (caseId) {
          navigate(`/cases/${caseId}/relationships`);
        } else {
          navigate("/intelligence");
        }
      },
    },

    {
      key: "cross-case",
      label: "Cross-Case",
      roles: [
        "INVESTIGATOR",
        "SUPERVISOR",
      ],
      action: () => navigate("/cross-case"),
    },

    {
      key: "legal",
      label: "Legal",
      roles: [
        "INVESTIGATOR",
        "SUPERVISOR",
      ],
      action: () => navigate("/legal"),
    },

    {
      key: "search",
      label: "Search",
      roles: [
        "INVESTIGATOR",
        "SUPERVISOR",
      ],
      action: () => navigate("/search"),
    },
  ];

  const items = allItems.filter((item) =>
    item.roles.includes(role)
  );

  if (
    role === "SYSTEM_ADMIN" ||
    role === "FORENSIC_ANALYST"
  ) {
    return null;
  }

  return (
    <nav
      className="shared-top-navigation"
      aria-label="Primary navigation"
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={
            activePage === item.key
              ? "active"
              : ""
          }
          onClick={item.action}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

export default TopNavigation;