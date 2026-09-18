import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  CircleDot,
  FileCheck2,
  FileSearch,
  Fingerprint,
  FolderSearch2,
  GitBranch,
  HardDrive,
  History,
  LayoutDashboard,
  Search,
  ShieldAlert,
  Users,
} from "lucide-react";

const sidebarConfig = {
  overview: {
    title: "OVERVIEW",
    items: [
      {
        key: "workspace",
        label: "Workspace",
        icon: LayoutDashboard,
        path: "/forensic",
      },
      {
        key: "assignments",
        label: "My Assignments",
        icon: BriefcaseBusiness,
        path: "/forensic/assignments",
      },
      {
        key: "activity",
        label: "Recent Activity",
        icon: History,
        path: "/forensic/activity",
      },
    ],
  },

  casework: {
    title: "CASEWORK",
    items: [
      {
        key: "cases",
        label: "Assigned Cases",
        icon: FolderSearch2,
        path: "/forensic/cases",
      },
      {
        key: "evidence",
        label: "Evidence",
        icon: FileCheck2,
        children: [
          {
            key: "all-evidence",
            label: "All Evidence",
            path: "/forensic/evidence",
          },
          {
            key: "assigned-evidence",
            label: "Assigned to Me",
            path: "/forensic/evidence",
          },
          {
            key: "digital-evidence",
            label: "Digital Evidence",
            path: "/forensic/evidence",
          },
          {
            key: "chain-custody",
            label: "Chain of Custody",
            path: "/forensic/evidence",
          },
        ],
      },
      {
        key: "examination",
        label: "Examination Queue",
        icon: Fingerprint,
        path: "/forensic/examinations",
      },
      {
        key: "reports",
        label: "Reports",
        icon: FileSearch,
        path: "/forensic/reports",
      },
    ],
  },

  analysis: {
    title: "ANALYSIS",
    items: [
      {
        key: "intelligence",
        label: "Intelligence",
        icon: ShieldAlert,
        children: [
          {
            key: "intelligence-feed",
            label: "Intelligence Feed",
            path: "/forensic/intelligence",
          },
          {
            key: "entities",
            label: "Entity Analysis",
            path: "/forensic/intelligence",
          },
          {
            key: "alerts",
            label: "Alerts & Leads",
            path: "/forensic/intelligence",
          },
        ],
      },

      {
        key: "digital-forensics",
        label: "Digital Forensics",
        icon: HardDrive,
        children: [
          {
            key: "devices",
            label: "Device Examination",
            path: "/forensic/digital-forensics",
          },
          {
            key: "files",
            label: "File Analysis",
            path: "/forensic/digital-forensics",
          },
          {
            key: "metadata",
            label: "Metadata",
            path: "/forensic/digital-forensics",
          },
          {
            key: "hashes",
            label: "Hash Verification",
            path: "/forensic/digital-forensics",
          },
        ],
      },

      {
        key: "relationships",
        label: "Relationship Analysis",
        icon: GitBranch,
        path: "/forensic/relationships",
      },

      {
        key: "timeline",
        label: "Timeline",
        icon: History,
        path: "/forensic/timeline",
      },
    ],
  },

  search: {
    title: "SEARCH & DISCOVERY",
    items: [
      {
        key: "global-search",
        label: "Global Search",
        icon: Search,
        path: "/forensic/search",
      },
      {
        key: "person-search",
        label: "Persons",
        icon: Users,
        path: "/forensic/search",
      },
      {
        key: "identifier-search",
        label: "Devices & Identifiers",
        icon: CircleDot,
        path: "/forensic/search",
      },
      {
        key: "evidence-search",
        label: "Evidence Search",
        icon: FileSearch,
        path: "/forensic/search",
      },
    ],
  },
};

function ModuleSidebar({
  module = "overview",
  activeItem = "",
}) {
  const navigate = useNavigate();

  const config =
    sidebarConfig[module] ||
    sidebarConfig.overview;

  const [expanded, setExpanded] = useState({
    evidence: true,
    intelligence: true,
    "digital-forensics": false,
  });

  function toggleGroup(key) {
    setExpanded((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  return (
    <aside className="forensic-module-sidebar">
      <div className="forensic-sidebar-title">
        {config.title}
      </div>

      <div className="forensic-sidebar-navigation">
        {config.items.map((item) => {
          const Icon = item.icon;
          const hasChildren =
            Array.isArray(item.children) &&
            item.children.length > 0;

          const isExpanded =
            expanded[item.key] === true;

          const childIsActive =
            hasChildren &&
            item.children.some(
              (child) =>
                child.key === activeItem
            );

          const isActive =
            item.key === activeItem ||
            childIsActive;

          if (hasChildren) {
            return (
              <div
                className="forensic-sidebar-group"
                key={item.key}
              >
                <button
                  type="button"
                  className={
                    isActive
                      ? "forensic-sidebar-item active"
                      : "forensic-sidebar-item"
                  }
                  onClick={() =>
                    toggleGroup(item.key)
                  }
                >
                  <span className="forensic-sidebar-item-left">
                    <Icon
                      size={17}
                      strokeWidth={1.8}
                    />

                    <span>{item.label}</span>
                  </span>

                  {isExpanded ? (
                    <ChevronDown
                      size={15}
                      strokeWidth={1.8}
                    />
                  ) : (
                    <ChevronRight
                      size={15}
                      strokeWidth={1.8}
                    />
                  )}
                </button>

                {isExpanded && (
                  <div className="forensic-sidebar-children">
                    {item.children.map(
                      (child) => (
                        <button
                          key={child.key}
                          type="button"
                          className={
                            activeItem ===
                            child.key
                              ? "forensic-sidebar-child active"
                              : "forensic-sidebar-child"
                          }
                          onClick={() =>
                            navigate(
                              child.path
                            )
                          }
                        >
                          {child.label}
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          }

          return (
            <button
              key={item.key}
              type="button"
              className={
                isActive
                  ? "forensic-sidebar-item active"
                  : "forensic-sidebar-item"
              }
              onClick={() =>
                navigate(item.path)
              }
            >
              <span className="forensic-sidebar-item-left">
                <Icon
                  size={17}
                  strokeWidth={1.8}
                />

                <span>{item.label}</span>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

export default ModuleSidebar;