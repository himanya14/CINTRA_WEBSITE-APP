import {
  useLocation,
  useNavigate,
} from "react-router-dom";


const NAV_ITEMS = [
  {
    label: "Overview",
    path: "/forensic",
  },
  {
    label: "Assignments",
    path: "/forensic/assignments",
  },
  {
    label: "Digital Forensics",
    path: "/forensic/digital-forensics",
  },
  {
    label: "Intelligence",
    path: "/forensic/intelligence",
  },
  {
    label: "Relationships",
    path: "/forensic/relationships",
  },
  {
    label: "Search",
    path: "/forensic/search",
  },
];


function isActive(
  pathname,
  path
) {
  if (path === "/forensic") {
    return pathname === "/forensic";
  }

  return pathname.startsWith(path);
}


export default function ForensicTopNavigation() {
  const navigate =
    useNavigate();

  const location =
    useLocation();


  return (
    <nav
      className="forensic-top-navigation"
      aria-label="Forensic analyst navigation"
    >
      {NAV_ITEMS.map(
        (item) => (
          <button
            key={item.path}
            type="button"
            className={
              isActive(
                location.pathname,
                item.path
              )
                ? "forensic-nav-item active"
                : "forensic-nav-item"
            }
            onClick={() =>
              navigate(item.path)
            }
          >
            {item.label}
          </button>
        )
      )}
    </nav>
  );
}