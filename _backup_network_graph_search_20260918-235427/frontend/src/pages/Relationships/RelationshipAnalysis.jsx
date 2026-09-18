import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  Banknote,
  Car,
  ChevronDown,
  Database,
  FileSearch,
  Filter,
  MapPin,
  Maximize2,
  Monitor,
  Network,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";

import AppHeader from "../../components/layout/AppHeader";
import { featureApi } from "../../services/expandedFeatures.js";
import "./RelationshipAnalysis.css";

const API_BASE_URL =
  "http://127.0.0.1:8000";

/* =========================================================
   EDGE COLOURS
   ========================================================= */

const EDGE_COLORS = [
  "#1976d2",
  "#2e8b57",
  "#7b4fc3",
  "#d97706",
  "#d32f2f",
  "#16858c",
  "#d81b60",
  "#64748b",
  "#f0a500",
  "#00897b",
  "#5e35b1",
  "#ef6c00",
  "#1565c0",
  "#558b2f",
  "#ad1457",
  "#6d4c41",
  "#00838f",
  "#c62828",
  "#4527a0",
  "#0277bd",
];

function getEdgeColor(index) {
  const safeIndex =
    Number.isFinite(index)
      ? Math.abs(index)
      : 0;

  return EDGE_COLORS[
    safeIndex %
      EDGE_COLORS.length
  ];
}


/* =========================================================
   COMPLETE FILTER CATALOG
   ========================================================= */

const ENTITY_FILTER_ORDER = [
  "People",
  "Mobile Numbers",
  "Vehicles",
  "Locations",
  "Bank Accounts",
  "Devices",
  "CCTV",
  "Evidence",
  "Organisations",
  "Other",
];

const LINK_FILTER_ORDER = [
  "communication",
  "device",
  "location",
  "vehicle",
  "ownership",
  "financial",
  "cctv",
  "general",
];

/* =========================================================
   AUTH
   ========================================================= */

function getToken() {
  return (
    localStorage.getItem(
      "cintra_token"
    ) ||
    sessionStorage.getItem(
      "cintra_token"
    )
  );
}

function getStoredOfficer() {
  const raw =
    localStorage.getItem(
      "cintra_officer"
    ) ||
    sessionStorage.getItem(
      "cintra_officer"
    );

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}


function clearStoredAuth() {
  localStorage.removeItem(
    "cintra_token"
  );

  localStorage.removeItem(
    "cintra_officer"
  );

  sessionStorage.removeItem(
    "cintra_token"
  );

  sessionStorage.removeItem(
    "cintra_officer"
  );
}

/* =========================================================
   GENERAL HELPERS
   ========================================================= */

function normalize(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replaceAll("_", " ");
}

function getNodeLabel(node) {
  return (
    node?.name ||
    node?.label ||
    node?.entity_name ||
    node?.title ||
    `Entity ${node?.id || ""}`
  );
}

function getNodeType(node) {
  return (
    node?.type ||
    node?.entity_type ||
    node?.category ||
    "Entity"
  );
}

function getInitials(
  name = ""
) {
  const parts =
    String(name)
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (!parts.length) {
    return "?";
  }

  if (
    parts.length === 1
  ) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function formatRelationship(
  value = ""
) {
  return String(
    value || "Linked"
  )
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

function formatConfidence(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  let number =
    Number(value);

  if (
    Number.isNaN(
      number
    )
  ) {
    return "—";
  }

  if (number <= 1) {
    number *= 100;
  }

  return `${Math.round(
    number
  )}%`;
}

/* =========================================================
   PERSON HELPERS
   ========================================================= */

const DEMO_PERSON_PHOTOS = {
  "P-DEMO-001":
    "/uploads/persons/P-DEMO-001_3f88ea97.jpeg",

  "P-DEMO-002":
    "/uploads/persons/P-DEMO-002_fd2e5dbf.jpeg",

  "P-DEMO-003":
    "/uploads/persons/P-DEMO-003_9070a2b6.jpeg",

  "P-DEMO-004":
    "/uploads/persons/P-DEMO-004_772c13b9.jpeg",

  "P-DEMO-005":
    "/uploads/persons/Devanshi%20Saxena.jpeg",
};


function findPerson(
  node,
  persons
) {
  if (!node) {
    return null;
  }

  const candidates = [
    node?.person_id,
    node?.personId,
    node?.id,
    node?.entity_id,
    node?.entityId,
  ]
    .filter(
      (value) =>
        value !==
          undefined &&
        value !== null
    )
    .map(
      (value) =>
        String(value)
          .trim()
          .toUpperCase()
    );

  const byExternalId =
    persons.find(
      (person) => {
        const externalId =
          String(
            person?.person_id ??
            ""
          )
            .trim()
            .toUpperCase();

        return (
          externalId &&
          candidates.some(
            (value) =>
              value ===
                externalId ||
              value.includes(
                externalId
              )
          )
        );
      }
    );

  if (byExternalId) {
    return byExternalId;
  }

  const label =
    normalize(
      getNodeLabel(
        node
      )
    );

  const byName =
    persons.find(
      (person) =>
        normalize(
          person?.name
        ) === label
    );

  if (byName) {
    return byName;
  }

  /*
   * Some graph records use an external person ID as their
   * label instead of the person's name. Resolve that too.
   */
  return (
    persons.find(
      (person) =>
        normalize(
          person?.person_id
        ) === label
    ) || null
  );
}


function personPhoto(
  node,
  persons
) {
  const person =
    findPerson(
      node,
      persons
    );

  const externalId =
    String(
      person?.person_id ??
      node?.person_id ??
      node?.personId ??
      node?.id ??
      ""
    )
      .trim()
      .toUpperCase();

  const personName =
    normalize(
      person?.name ||
      getNodeLabel(node)
    );

  /*
   * FORCE the known Devanshi JPEG.
   *
   * This intentionally overrides profile_image_path because the
   * database may still contain an older P-DEMO-005 hashed path.
   */
  if (
    externalId ===
      "P-DEMO-005" ||
    personName ===
      "devanshi saxena"
  ) {
    return `${API_BASE_URL}/uploads/persons/Devanshi%20Saxena.jpeg`;
  }

  const demoFallback =
    DEMO_PERSON_PHOTOS[
      externalId
    ] || null;

  const path =
    person
      ?.profile_image_path ||
    node
      ?.profile_image_path ||
    demoFallback;

  if (!path) {
    return null;
  }

  if (
    path.startsWith(
      "http://"
    ) ||
    path.startsWith(
      "https://"
    )
  ) {
    return path;
  }

  /*
   * Encode spaces safely but keep URL slashes intact.
   */
  const safePath =
    String(path)
      .split("/")
      .map(
        (part) =>
          encodeURIComponent(
            decodeURIComponent(
              part
            )
          )
      )
      .join("/");

  return `${API_BASE_URL}${
    safePath.startsWith("/")
      ? ""
      : "/"
  }${safePath}`;
}

/* =========================================================
   EDGE HELPERS
   ========================================================= */

function getEdgeSource(
  edge
) {
  return (
    edge?.source ??
    edge?.source_id ??
    edge?.from ??
    edge?.from_id
  );
}

function getEdgeTarget(
  edge
) {
  return (
    edge?.target ??
    edge?.target_id ??
    edge?.to ??
    edge?.to_id
  );
}

function getEdgeLabel(
  edge
) {
  return (
    edge?.relationship ||
    edge?.relationship_type ||
    edge?.label ||
    edge?.type ||
    "Linked"
  );
}

/* =========================================================
   ENTITY TYPES
   ========================================================= */

function getTypeGroup(
  node
) {
  const type =
    normalize(
      getNodeType(
        node
      )
    );

  const label =
    normalize(
      getNodeLabel(
        node
      )
    );

  if (
    type.includes(
      "person"
    ) ||
    type.includes(
      "suspect"
    ) ||
    type.includes(
      "associate"
    ) ||
    type.includes(
      "witness"
    ) ||
    type.includes(
      "individual"
    )
  ) {
    return "People";
  }

  if (
    type.includes(
      "phone"
    ) ||
    type.includes(
      "mobile"
    )
  ) {
    return "Mobile Numbers";
  }

  if (
    type.includes(
      "vehicle"
    ) ||
    type.includes(
      "car"
    )
  ) {
    return "Vehicles";
  }

  if (
    type.includes(
      "location"
    ) ||
    type.includes(
      "place"
    )
  ) {
    return "Locations";
  }

  if (
    type.includes(
      "bank"
    ) ||
    type.includes(
      "account"
    )
  ) {
    return "Bank Accounts";
  }

  if (
    type.includes(
      "device"
    ) ||
    type.includes(
      "imei"
    )
  ) {
    if (
      label.includes(
        "cctv"
      ) ||
      label.includes(
        "camera"
      )
    ) {
      return "CCTV";
    }

    return "Devices";
  }

  if (
    type.includes(
      "cctv"
    ) ||
    type.includes(
      "camera"
    )
  ) {
    return "CCTV";
  }

  if (
    type.includes(
      "evidence"
    ) ||
    type.includes(
      "document"
    )
  ) {
    return "Evidence";
  }

  if (
    type.includes(
      "organisation"
    ) ||
    type.includes(
      "organization"
    )
  ) {
    return "Organisations";
  }

  return "Other";
}

function typeClass(
  group
) {
  return String(group)
    .toLowerCase()
    .replace(
      /\s+/g,
      "-"
    );
}

function typeIcon(
  group,
  size = 17
) {
  switch (group) {
    case "People":
      return (
        <UserRound
          size={size}
        />
      );

    case "Mobile Numbers":
      return (
        <Phone
          size={size}
        />
      );

    case "Vehicles":
      return (
        <Car
          size={size}
        />
      );

    case "Locations":
      return (
        <MapPin
          size={size}
        />
      );

    case "Bank Accounts":
      return (
        <Banknote
          size={size}
        />
      );

    case "Devices":
      return (
        <Smartphone
          size={size}
        />
      );

    case "CCTV":
      return (
        <Monitor
          size={size}
        />
      );

    case "Evidence":
      return (
        <FileSearch
          size={size}
        />
      );

    case "Organisations":
      return (
        <Database
          size={size}
        />
      );

    default:
      return (
        <Network
          size={size}
        />
      );
  }
}

/* =========================================================
   RELATIONSHIP TYPE
   ========================================================= */

function relationshipClass(
  label = ""
) {
  const value =
    normalize(label);

  if (
    value.includes(
      "transfer"
    ) ||
    value.includes(
      "paid"
    ) ||
    value.includes(
      "money"
    ) ||
    value.includes(
      "financial"
    )
  ) {
    return "financial";
  }

  if (
    value.includes(
      "call"
    ) ||
    value.includes(
      "contact"
    ) ||
    value.includes(
      "phone"
    ) ||
    value.includes(
      "message"
    )
  ) {
    return "communication";
  }

  if (
    value.includes(
      "location"
    ) ||
    value.includes(
      "seen"
    ) ||
    value.includes(
      "observed"
    )
  ) {
    return "location";
  }

  if (
    value.includes(
      "vehicle"
    )
  ) {
    return "vehicle";
  }

  if (
    value.includes(
      "device"
    ) ||
    value.includes(
      "imei"
    )
  ) {
    return "device";
  }

  if (
    value.includes(
      "cctv"
    ) ||
    value.includes(
      "camera"
    )
  ) {
    return "cctv";
  }

  if (
    value.includes(
      "own"
    ) ||
    value.includes(
      "control"
    ) ||
    value.includes(
      "account"
    )
  ) {
    return "ownership";
  }

  return "general";
}


/* =========================================================
   GRAPH NORMALISATION

   The saved intelligence graph may contain:
   - a redundant Case node
   - multiple seed aliases for the same real demo person
   - duplicate exact technical entities
   - duplicate edges after those aliases are merged

   Clean those before layout/rendering.
   ========================================================= */

function canonicalSeedPersonId(
  value
) {
  const match =
    String(value || "")
      .trim()
      .match(
        /^SYN-P-(\d+)$/i
      );

  if (!match) {
    return value
      ? String(value)
      : null;
  }

  const number =
    Number(match[1]);

  if (
    !Number.isFinite(number) ||
    number < 1
  ) {
    return String(value);
  }

  const canonical =
    (
      (
        number - 1
      ) %
      20
    ) + 1;

  return `SYN-P-${String(
    canonical
  ).padStart(3, "0")}`;
}


function resolveGraphPerson(
  node,
  persons
) {
  if (!node) {
    return null;
  }

  const directPersonId =
    node?.person_id ??
    node?.personId;

  if (
    directPersonId !==
      undefined &&
    directPersonId !== null
  ) {
    const canonicalDirectId =
      canonicalSeedPersonId(
        directPersonId
      );

    const direct =
      persons.find(
        (person) =>
          canonicalSeedPersonId(
            person.person_id
          ) ===
          canonicalDirectId
      );

    if (direct) {
      return direct;
    }
  }

  const name =
    normalize(
      getNodeLabel(
        node
      )
    );

  const matches =
    persons.filter(
      (person) =>
        normalize(
          person.name
        ) === name
    );

  /*
   * Name fallback is safe when there is one match, or when
   * multiple records collapse to the same seeded identity.
   * Genuine namesakes with different canonical IDs remain
   * separate.
   */
  if (
    matches.length === 1
  ) {
    return matches[0];
  }

  if (
    matches.length > 1
  ) {
    const canonicalIds =
      new Set(
        matches.map(
          (person) =>
            canonicalSeedPersonId(
              person.person_id
            )
        )
      );

    if (
      canonicalIds.size === 1
    ) {
      return matches[0];
    }
  }

  return null;
}


function cleanGraphData(
  rawNodes,
  rawEdges,
  persons,
  caseData
) {
  const nodes =
    Array.isArray(rawNodes)
      ? rawNodes
      : [];

  const edges =
    Array.isArray(rawEdges)
      ? rawEdges
      : [];

  const caseLabels =
    new Set(
      [
        caseData?.case_id,
        caseData?.fir_number,
      ]
        .filter(Boolean)
        .map(normalize)
    );

  const oldToNew =
    new Map();

  const canonicalByKey =
    new Map();

  const cleanedNodes =
    [];

  nodes.forEach(
    (node) => {
      const oldId =
        String(node.id);

      const group =
        getTypeGroup(node);

      const label =
        getNodeLabel(node);

      const labelKey =
        normalize(label);

      const typeKey =
        normalize(
          getNodeType(node)
        );

      const isCaseNode =
        typeKey === "case" ||
        typeKey.includes(
          "case record"
        ) ||
        caseLabels.has(
          labelKey
        );

      /*
       * The Case Workspace itself already supplies case context.
       * A CASE node in the graph makes it look like the suspect.
       */
      if (isCaseNode) {
        oldToNew.set(
          oldId,
          null
        );

        return;
      }

      let key =
        `node:${oldId}`;

      let nextNode = {
        ...node,
      };

      if (
        group ===
        "People"
      ) {
        const person =
          resolveGraphPerson(
            node,
            persons
          );

        if (person) {
          const canonicalPersonId =
            canonicalSeedPersonId(
              person.person_id ??
              node.person_id ??
              person.id
            );

          key =
            `person:${canonicalPersonId}`;

          nextNode = {
            ...node,

            id:
              `PERSON::${canonicalPersonId}`,

            person_id:
              person.person_id ??
              node.person_id,

            name:
              person.name ||
              node.name,

            label:
              person.name ||
              node.label,

            role_in_case:
              person.role_in_case ??
              node.role_in_case,

            status:
              person.status ??
              node.status,

            profile_image_path:
              person.profile_image_path ??
              node.profile_image_path,
          };
        }
      } else if (
        group !== "Other" &&
        labelKey
      ) {
        /*
         * Exact repeated phone/device/account/location labels
         * are one visible technical entity.
         */
        key =
          `entity:${group}:${labelKey}`;
      }

      const existing =
        canonicalByKey.get(
          key
        );

      if (existing) {
        oldToNew.set(
          oldId,
          String(existing.id)
        );

        return;
      }

      canonicalByKey.set(
        key,
        nextNode
      );

      cleanedNodes.push(
        nextNode
      );

      oldToNew.set(
        oldId,
        String(nextNode.id)
      );
    }
  );

  const cleanedEdges =
    [];

  const edgeKeys =
    new Set();

  edges.forEach(
    (
      edge,
      index
    ) => {
      const rawSource =
        String(
          getEdgeSource(
            edge
          )
        );

      const rawTarget =
        String(
          getEdgeTarget(
            edge
          )
        );

      const source =
        oldToNew.has(
          rawSource
        )
          ? oldToNew.get(
              rawSource
            )
          : rawSource;

      const target =
        oldToNew.has(
          rawTarget
        )
          ? oldToNew.get(
              rawTarget
            )
          : rawTarget;

      if (
        !source ||
        !target ||
        source === target
      ) {
        return;
      }

      const relationship =
        getEdgeLabel(edge);

      const key =
        [
          source,
          target,
          normalize(
            relationship
          ),
        ].join("|");

      if (
        edgeKeys.has(key)
      ) {
        return;
      }

      edgeKeys.add(key);

      cleanedEdges.push({
        ...edge,

        id:
          edge.id ??
          `EDGE::${index}`,

        source,
        target,
      });
    }
  );

  return {
    nodes:
      cleanedNodes,

    edges:
      cleanedEdges,
  };
}


function choosePrimaryNode(
  nodes,
  edges,
  persons,
  result
) {
  if (!nodes.length) {
    return null;
  }

  const people =
    nodes.filter(
      (node) =>
        getTypeGroup(node) ===
        "People"
    );

  /*
   * Investigator-assigned case role wins over analytical
   * guesses. Prime suspect/suspect/accused are preferred.
   */
  const rolePriority = [
    "prime suspect",
    "suspect",
    "accused",
    "person of interest",
    "poi",
    "associate",
    "witness",
    "victim",
  ];

  for (
    const role of
    rolePriority
  ) {
    const person =
      persons.find(
        (item) =>
          normalize(
            item.role_in_case
          ).includes(role)
      );

    if (!person) {
      continue;
    }

    const byPersonId =
      people.find(
        (node) =>
          String(
            node.person_id
          ) ===
          String(
            person.person_id
          )
      );

    if (byPersonId) {
      return byPersonId;
    }

    const byName =
      people.find(
        (node) =>
          normalize(
            getNodeLabel(node)
          ) ===
          normalize(
            person.name
          )
      );

    if (byName) {
      return byName;
    }
  }

  const analysisName =
    result
      ?.insights
      ?.primary_subject
      ?.name ||
    result
      ?.network_influence
      ?.suspect;

  if (analysisName) {
    const fromAnalysis =
      people.find(
        (node) =>
          normalize(
            getNodeLabel(node)
          ) ===
          normalize(
            analysisName
          )
      );

    if (fromAnalysis) {
      return fromAnalysis;
    }
  }

  /*
   * Last fallback: the most connected PERSON, never an
   * arbitrary technical/case node.
   */
  const degree =
    new Map();

  people.forEach(
    (node) => {
      degree.set(
        String(node.id),
        0
      );
    }
  );

  edges.forEach(
    (edge) => {
      const source =
        String(
          getEdgeSource(edge)
        );

      const target =
        String(
          getEdgeTarget(edge)
        );

      if (
        degree.has(source)
      ) {
        degree.set(
          source,
          degree.get(source) + 1
        );
      }

      if (
        degree.has(target)
      ) {
        degree.set(
          target,
          degree.get(target) + 1
        );
      }
    }
  );

  return (
    [...people].sort(
      (a, b) =>
        (
          degree.get(
            String(b.id)
          ) || 0
        ) -
        (
          degree.get(
            String(a.id)
          ) || 0
        )
    )[0] ||
    nodes[0]
  );
}

/* =========================================================
   TYPE-AWARE LAYOUT

   Important:
   Person nodes go to the top.
   CCTV is deliberately moved below Ravi.
   Technical entities fill left / right / bottom.

   This uses ENTITY TYPE only.
   No names or case data are hardcoded.
   ========================================================= */


function estimateNodeBox(node) {
  const group = getTypeGroup(node);

  if (String(node.id || "") === String(node.primary ? node.id : "")) {
    return { width: 21, height: 11 };
  }

  if (group === "People" || group === "Other") {
    return { width: 18, height: 9 };
  }

  return { width: 16, height: 8 };
}

function relaxLayout(nodes, primaryId) {
  const next = nodes.map((node) => ({
    ...node,
    graphX: Number(node.graphX ?? 50),
    graphY: Number(node.graphY ?? 50),
  }));

  const centerId = String(primaryId);

  const clamp = (value, min, max) =>
    Math.max(min, Math.min(max, value));

  for (let pass = 0; pass < 180; pass += 1) {
    for (let i = 0; i < next.length; i += 1) {
      for (let j = i + 1; j < next.length; j += 1) {
        const a = next[i];
        const b = next[j];

        if (
          String(a.id) === centerId &&
          String(b.id) === centerId
        ) {
          continue;
        }

        const aBox = estimateNodeBox(a);
        const bBox = estimateNodeBox(b);

        const minDx =
          (aBox.width + bBox.width) / 2 + 1.8;
        const minDy =
          (aBox.height + bBox.height) / 2 + 1.6;

        let dx = b.graphX - a.graphX;
        let dy = b.graphY - a.graphY;

        if (dx === 0 && dy === 0) {
          dx = 0.01;
          dy = 0.01;
        }

        const overlapX = minDx - Math.abs(dx);
        const overlapY = minDy - Math.abs(dy);

        if (overlapX > 0 && overlapY > 0) {
          const pushX =
            (overlapX / 2 + 0.2) * (dx >= 0 ? 1 : -1);
          const pushY =
            (overlapY / 2 + 0.2) * (dy >= 0 ? 1 : -1);

          const aLocked = String(a.id) === centerId;
          const bLocked = String(b.id) === centerId;

          if (!aLocked && !bLocked) {
            a.graphX -= pushX;
            b.graphX += pushX;
            a.graphY -= pushY;
            b.graphY += pushY;
          } else if (aLocked && !bLocked) {
            b.graphX += pushX * 1.6;
            b.graphY += pushY * 1.6;
          } else if (!aLocked && bLocked) {
            a.graphX -= pushX * 1.6;
            a.graphY -= pushY * 1.6;
          }
        }
      }
    }

    next.forEach((node) => {
      if (String(node.id) === centerId) {
        node.graphX = 50;
        node.graphY = 50;
        return;
      }

      const dx = node.graphX - 50;
      const dy = node.graphY - 50;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;

      if (distance < 16) {
        const scale = 16 / distance;
        node.graphX = 50 + dx * scale;
        node.graphY = 50 + dy * scale;
      }

      node.graphX = clamp(node.graphX, 6, 94);
      node.graphY = clamp(node.graphY, 6, 94);
    });
  }

  return next;
}


function buildLayout(
  nodes,
  primaryId,
  edges = []
) {
  if (!nodes.length) {
    return [];
  }

  const primary =
    nodes.find(
      (node) =>
        String(node.id) ===
        String(primaryId)
    ) ||
    nodes.find(
      (node) =>
        getTypeGroup(node) ===
        "People"
    ) ||
    nodes[0];

  const primaryKey =
    String(primary.id);

  const others =
    nodes.filter(
      (node) =>
        String(node.id) !==
        primaryKey
    );

  const degree =
    new Map();

  nodes.forEach(
    (node) => {
      degree.set(
        String(node.id),
        0
      );
    }
  );

  edges.forEach(
    (edge) => {
      const source =
        String(
          getEdgeSource(edge)
        );

      const target =
        String(
          getEdgeTarget(edge)
        );

      degree.set(
        source,
        (
          degree.get(source) ||
          0
        ) + 1
      );

      degree.set(
        target,
        (
          degree.get(target) ||
          0
        ) + 1
      );
    }
  );

  /*
   * All distinct entities remain visible.
   *
   * Instead of hiding nodes, large cases use multiple
   * non-overlapping elliptical rings around the primary subject.
   */
  const count =
    others.length;

  let ringSizes;

  if (count <= 8) {
    ringSizes = [
      count,
    ];
  } else if (count <= 16) {
    ringSizes = [
      6,
      count - 6,
    ];
  } else if (count <= 26) {
    ringSizes = [
      6,
      9,
      count - 15,
    ];
  } else {
    ringSizes = [
      6,
      9,
      12,
      count - 27,
    ];
  }

  const ringGeometry = [
    {
      radiusX: 26,
      radiusY: 25,
      offset: -90,
    },
    {
      radiusX: 37,
      radiusY: 35,
      offset: -72,
    },
    {
      radiusX: 46,
      radiusY: 43,
      offset: -90,
    },
    {
      radiusX: 54,
      radiusY: 49,
      offset: -78,
    },
  ];

  const preferredAngle = {
    People: -75,
    CCTV: -140,
    Devices: -165,
    "Mobile Numbers": 10,
    Vehicles: 35,
    "Bank Accounts": 135,
    Locations: 110,
    Organisations: 85,
    Evidence: -25,
    Other: 180,
  };

  function angleDistance(
    a,
    b
  ) {
    let difference =
      Math.abs(
        a - b
      ) % 360;

    if (
      difference > 180
    ) {
      difference =
        360 -
        difference;
    }

    return difference;
  }

  const slots = [];

  ringSizes.forEach(
    (
      ringSize,
      ringIndex
    ) => {
      if (
        ringSize <= 0
      ) {
        return;
      }

      const geometry =
        ringGeometry[
          Math.min(
            ringIndex,
            ringGeometry.length - 1
          )
        ];

      for (
        let index = 0;
        index < ringSize;
        index += 1
      ) {
        const angle =
          geometry.offset +
          (
            360 *
            index
          ) /
          ringSize;

        const radians =
          (
            angle *
            Math.PI
          ) /
          180;

        slots.push({
          ringIndex,
          angle,
          x:
            50 +
            Math.cos(
              radians
            ) *
              geometry.radiusX,
          y:
            50 +
            Math.sin(
              radians
            ) *
              geometry.radiusY,
        });
      }
    }
  );

  /*
   * Higher-degree nodes are allocated first.
   * People are slightly preferred toward the upper half while
   * technical/supporting entities naturally distribute around
   * the remaining circumference.
   */
  const ordered =
    [...others].sort(
      (a, b) => {
        const aPeople =
          getTypeGroup(a) ===
          "People"
            ? 1
            : 0;

        const bPeople =
          getTypeGroup(b) ===
          "People"
            ? 1
            : 0;

        if (
          aPeople !==
          bPeople
        ) {
          return (
            bPeople -
            aPeople
          );
        }

        return (
          (
            degree.get(
              String(b.id)
            ) || 0
          ) -
          (
            degree.get(
              String(a.id)
            ) || 0
          )
        );
      }
    );

  const available =
    [...slots];

  const positioned = [
    {
      ...primary,
      graphX: 50,
      graphY: 50,
      primary: true,
    },
  ];

  ordered.forEach(
    (node) => {
      if (
        !available.length
      ) {
        return;
      }

      const group =
        getTypeGroup(node);

      const targetAngle =
        preferredAngle[
          group
        ] ?? 180;

      let bestIndex = 0;
      let bestScore =
        Number.POSITIVE_INFINITY;

      available.forEach(
        (
          slot,
          index
        ) => {
          const angleScore =
            angleDistance(
              slot.angle,
              targetAngle
            );

          /*
           * Well-connected entities are slightly encouraged
           * toward inner rings, reducing long line crossings.
           */
          const connectionCount =
            degree.get(
              String(node.id)
            ) || 0;

          const ringPenalty =
            slot.ringIndex *
            Math.max(
              0,
              5 -
              connectionCount
            ) *
            8;

          const score =
            angleScore +
            ringPenalty;

          if (
            score <
            bestScore
          ) {
            bestScore =
              score;

            bestIndex =
              index;
          }
        }
      );

      const slot =
        available.splice(
          bestIndex,
          1
        )[0];

      positioned.push({
        ...node,

        graphX:
          Math.max(
            6,
            Math.min(
              94,
              slot.x
            )
          ),

        graphY:
          Math.max(
            6,
            Math.min(
              94,
              slot.y
            )
          ),

        primary: false,
      });
    }
  );

  return relaxLayout(
    positioned,
    primaryKey
  );
}

/* =========================================================
   MAIN COMPONENT
   ========================================================= */

function RelationshipAnalysis() {
  const navigate =
    useNavigate();

  const { caseId } =
    useParams();


  const officer =
    getStoredOfficer();

  const isForensicAnalyst =
    officer?.system_role ===
    "FORENSIC_ANALYST";

  const [
    caseData,
    setCaseData,
  ] = useState(null);

  const [
    persons,
    setPersons,
  ] = useState([]);

  const [
    latestAnalysis,
    setLatestAnalysis,
  ] = useState(null);


  const [
    personAssessment,
    setPersonAssessment,
  ] = useState(null);

  const [
    assessmentLoading,
    setAssessmentLoading,
  ] = useState(false);

  const [
    assessmentError,
    setAssessmentError,
  ] = useState("");

  const [
    graphData,
    setGraphData,
  ] = useState({
    nodes: [],
    edges: [],
  });

  const [
    primaryNodeId,
    setPrimaryNodeId,
  ] = useState(null);

  const [
    selectedNodeId,
    setSelectedNodeId,
  ] = useState(null);

  const [
    selectedEdge,
    setSelectedEdge,
  ] = useState(null);

  const [edgeReviewMessage, setEdgeReviewMessage] = useState("");
  const [edgeReviewLoading, setEdgeReviewLoading] = useState(false);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    typeFilters,
    setTypeFilters,
  ] = useState({});

  const [
    linkFilters,
    setLinkFilters,
  ] = useState({});

  const [
    detailsOpen,
    setDetailsOpen,
  ] = useState(true);

  const [
    actionsOpen,
    setActionsOpen,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    zoom,
    setZoom,
  ] = useState(1);

  /* =======================================================
     LOAD
     ======================================================= */

  async function loadPage(
    refresh = false
  ) {
    const token =
      getToken();

    if (!token) {
      clearStoredAuth();

      navigate("/", {
        replace: true,
      });

      return;
    }

    try {
      if (refresh) {
        setRefreshing(
          true
        );
      } else {
        setLoading(
          true
        );
      }

      setMessage("");

      const headers = {
        Authorization:
          `Bearer ${token}`,
      };

      /*
       * FORENSIC_ANALYST is intentionally restricted from the
       * investigator-only /cases/{id} detail endpoint.
       * Use the analyst's assignment-scoped case list instead.
       */
      const caseRequestUrl =
        isForensicAnalyst
          ? `${API_BASE_URL}/forensics/cases`
          : `${API_BASE_URL}/cases/${caseId}`;

      const [
        caseResponse,
        analysisResponse,
        personsResponse,
      ] =
        await Promise.all([
          fetch(
            caseRequestUrl,
            {
              headers,
            }
          ),

          fetch(
            `${API_BASE_URL}/intelligence/analysis/case/${caseId}`,
            {
              headers,
            }
          ),

          fetch(
            `${API_BASE_URL}/persons/case/${caseId}`,
            {
              headers,
            }
          ),
        ]);

      if (
        caseResponse.status ===
          401 ||
        analysisResponse.status ===
          401 ||
        personsResponse.status ===
          401
      ) {
        clearStoredAuth();

        navigate("/", {
          replace: true,
        });

        return;
      }

      let caseResult =
        null;

      if (
        caseResponse.ok
      ) {
        const casePayload =
          await caseResponse.json();

        if (
          isForensicAnalyst
        ) {
          const assignedCases =
            Array.isArray(
              casePayload
            )
              ? casePayload
              : [];

          caseResult =
            assignedCases.find(
              (item) =>
                String(
                  item?.id
                ) ===
                  String(
                    caseId
                  ) ||
                String(
                  item?.case_id
                ) ===
                  String(
                    caseId
                  )
            ) || null;

          if (!caseResult) {
            throw new Error(
              "This case is not assigned to the current forensic analyst."
            );
          }
        } else {
          caseResult =
            casePayload;
        }

        setCaseData(
          caseResult
        );
      } else if (
        caseResponse.status ===
        403
      ) {
        throw new Error(
          "You do not have access to this case record."
        );
      }

      let personsData =
        [];

      if (
        personsResponse.ok
      ) {
        const data =
          await personsResponse.json();

        personsData =
          Array.isArray(
            data
          )
            ? data
            : [];

        setPersons(
          personsData
        );
      } else {
        setPersons([]);
      }

      if (
        !analysisResponse.ok
      ) {
        throw new Error(
          "Unable to load intelligence analysis."
        );
      }

      const analyses =
        await analysisResponse.json();

      const latest =
        Array.isArray(
          analyses
        )
          ? [
              ...analyses,
            ].sort(
              (
                a,
                b
              ) =>
                Number(
                  b.id ||
                    0
                ) -
                Number(
                  a.id ||
                    0
                )
            )[0]
          : analyses;

      if (!latest) {
        setLatestAnalysis(
          null
        );

        setGraphData({
          nodes: [],
          edges: [],
        });

        setPrimaryNodeId(
          null
        );

        setSelectedNodeId(
          null
        );

        return;
      }

      setLatestAnalysis(
        latest
      );

      const result =
        latest
          .result_json ||
        {};

      const rawNodes =
        Array.isArray(
          result.nodes
        )
          ? result.nodes
          : [];

      const rawEdges =
        Array.isArray(
          result.edges
        )
          ? result.edges
          : [];

      const cleaned =
        cleanGraphData(
          rawNodes,
          rawEdges,
          personsData,
          caseResult
        );

      const nodes =
        cleaned.nodes;

      const edges =
        cleaned.edges;

      setGraphData({
        nodes,
        edges,
      });

      const primary =
        choosePrimaryNode(
          nodes,
          edges,
          personsData,
          result
        );

      setPrimaryNodeId(
        primary?.id ??
          null
      );

      setSelectedNodeId(
        (current) => {
          const exists =
            nodes.some(
              (node) =>
                String(
                  node.id
                ) ===
                String(
                  current
                )
            );

          if (
            refresh &&
            exists
          ) {
            return current;
          }

          return (
            primary?.id ??
            null
          );
        }
      );

      setTypeFilters(
        Object.fromEntries(
          ENTITY_FILTER_ORDER.map(
            (group) => [
              group,
              true,
            ]
          )
        )
      );

      setLinkFilters(
        Object.fromEntries(
          LINK_FILTER_ORDER.map(
            (type) => [
              type,
              true,
            ]
          )
        )
      );
    } catch (error) {
      console.error(
        "Relationship Analysis:",
        error
      );

      setMessage(
        error.message ||
          "Unable to connect to CINTRA services."
      );
    } finally {
      setLoading(false);

      setRefreshing(
        false
      );
    }
  }

  useEffect(() => {
    loadPage();

    // Mobile evidence writes to the same DB. Refresh the active graph so a
    // newly uploaded Evidence node/edge appears without a manual browser reload.
    const syncTimer = window.setInterval(() => {
      loadPage(true);
    }, 7000);

    return () => window.clearInterval(syncTimer);
  }, [caseId]);

  /* =======================================================
     PRIORITY
     ======================================================= */

  const priorityByName =
    useMemo(() => {
      const map =
        new Map();

      const priorities =
        latestAnalysis
          ?.result_json
          ?.investigation_priorities;

      if (
        Array.isArray(
          priorities
        )
      ) {
        priorities.forEach(
          (item) => {
            if (
              item?.suspect
            ) {
              map.set(
                normalize(
                  item.suspect
                ),
                item
              );
            }
          }
        );
      }

      return map;
    }, [
      latestAnalysis,
    ]);

  /* =======================================================
     FILTER COUNTS
     ======================================================= */

  const typeCounts =
    useMemo(() => {
      const counts =
        {};

      graphData.nodes.forEach(
        (node) => {
          const group =
            getTypeGroup(
              node
            );

          counts[group] =
            (
              counts[
                group
              ] || 0
            ) + 1;
        }
      );

      return counts;
    }, [
      graphData.nodes,
    ]);

  const linkCounts =
    useMemo(() => {
      const counts =
        {};

      graphData.edges.forEach(
        (edge) => {
          const type =
            relationshipClass(
              getEdgeLabel(
                edge
              )
            );

          counts[type] =
            (
              counts[
                type
              ] || 0
            ) + 1;
        }
      );

      return counts;
    }, [
      graphData.edges,
    ]);

  /* =======================================================
     VISIBLE GRAPH
     ======================================================= */

  const visibleNodes =
    useMemo(() => {
      const query =
        normalize(
          search
        );

      return graphData.nodes.filter(
        (node) => {
          const group =
            getTypeGroup(
              node
            );

          if (
            typeFilters[
              group
            ] === false
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          const person =
            findPerson(
              node,
              persons
            );

          return [
            getNodeLabel(
              node
            ),

            getNodeType(
              node
            ),

            person
              ?.person_id,

            person
              ?.role_in_case,
          ]
            .filter(
              Boolean
            )
            .join(" ")
            .toLowerCase()
            .includes(
              query
            );
        }
      );
    }, [
      graphData.nodes,
      typeFilters,
      search,
      persons,
    ]);

  const visibleIds =
    useMemo(
      () =>
        new Set(
          visibleNodes.map(
            (node) =>
              String(
                node.id
              )
          )
        ),
      [
        visibleNodes,
      ]
    );

  const visibleEdges =
    useMemo(
      () =>
        graphData.edges.filter(
          (edge) => {
            const source =
              String(
                getEdgeSource(
                  edge
                )
              );

            const target =
              String(
                getEdgeTarget(
                  edge
                )
              );

            const type =
              relationshipClass(
                getEdgeLabel(
                  edge
                )
              );

            return (
              visibleIds.has(
                source
              ) &&
              visibleIds.has(
                target
              ) &&
              linkFilters[
                type
              ] !== false
            );
          }
        ),
      [
        graphData.edges,
        visibleIds,
        linkFilters,
      ]
    );

  /* =======================================================
     COMPLETE MAP
     ======================================================= */

  const effectivePrimary =
    useMemo(() => {
      const exists =
        visibleNodes.some(
          (node) =>
            String(
              node.id
            ) ===
            String(
              primaryNodeId
            )
        );

      if (exists) {
        return primaryNodeId;
      }

      return (
        visibleNodes.find(
          (node) =>
            getTypeGroup(node) ===
            "People"
        )?.id ||
        visibleNodes[0]
          ?.id ||
        null
      );
    }, [
      visibleNodes,
      primaryNodeId,
    ]);

  /*
   * IMPORTANT:
   * Nothing is hidden here.
   * Every visible/filter-matching entity and relationship is
   * rendered on the canvas.
   */
  const displayNodes =
    visibleNodes;

  const displayEdges =
    visibleEdges;

  const layout =
    useMemo(
      () =>
        buildLayout(
          displayNodes,
          effectivePrimary,
          displayEdges
        ),
      [
        displayNodes,
        effectivePrimary,
        displayEdges,
      ]
    );

  const positions =
    useMemo(() => {
      const map =
        new Map();

      layout.forEach(
        (node) => {
          map.set(
            String(
              node.id
            ),
            {
              x:
                node.graphX,

              y:
                node.graphY,
            }
          );
        }
      );

      return map;
    }, [
      layout,
    ]);

  /* =======================================================
     SELECTED ENTITY
     ======================================================= */

  const selectedNode =
    useMemo(
      () =>
        graphData.nodes.find(
          (node) =>
            String(
              node.id
            ) ===
            String(
              selectedNodeId
            )
        ) ||
        null,
      [
        graphData.nodes,
        selectedNodeId,
      ]
    );

  const selectedPerson =
    useMemo(
      () =>
        findPerson(
          selectedNode,
          persons
        ),
      [
        selectedNode,
        persons,
      ]
    );

  const selectedPriority =
    selectedNode
      ? priorityByName.get(
          normalize(
            getNodeLabel(
              selectedNode
            )
          )
        ) ||
        null
      : null;

  const selectedRelationships =
    useMemo(() => {
      if (!selectedNode) {
        return [];
      }

      return graphData.edges.filter(
        (edge) =>
          String(
            getEdgeSource(
              edge
            )
          ) ===
            String(
              selectedNode.id
            ) ||
          String(
            getEdgeTarget(
              edge
            )
          ) ===
            String(
              selectedNode.id
            )
      );
    }, [
      selectedNode,
      graphData.edges,
    ]);

  const localAssessment =
    useMemo(() => {
      if (
        !selectedNode ||
        getTypeGroup(
          selectedNode
        ) !== "People"
      ) {
        return null;
      }

      const role =
        normalize(
          selectedPerson
            ?.role_in_case ||
          selectedPerson
            ?.role ||
          selectedNode
            ?.role_in_case
        );

      let score = 8;

      if (
        role.includes(
          "prime suspect"
        )
      ) {
        score += 34;
      } else if (
        role.includes(
          "suspect"
        ) ||
        role.includes(
          "accused"
        )
      ) {
        score += 27;
      } else if (
        role.includes(
          "person of interest"
        ) ||
        role === "poi"
      ) {
        score += 20;
      } else if (
        role.includes(
          "associate"
        )
      ) {
        score += 13;
      } else if (
        role.includes(
          "witness"
        )
      ) {
        score += 6;
      } else if (
        role.includes(
          "victim"
        )
      ) {
        score += 3;
      }

      const connectionCount =
        selectedRelationships.length;

      score += Math.min(
        connectionCount * 4,
        28
      );

      const categories =
        new Set(
          selectedRelationships.map(
            (edge) =>
              relationshipClass(
                getEdgeLabel(
                  edge
                )
              )
          )
        );

      score += Math.min(
        categories.size * 4,
        16
      );

      score =
        Math.min(
          100,
          Math.round(
            score
          )
        );

      const priorityLevel =
        score >= 65
          ? "High"
          : score >= 35
            ? "Medium"
            : "Low";

      const reasons = [];

      if (
        selectedPerson
          ?.role_in_case
      ) {
        reasons.push(
          `Case role: ${selectedPerson.role_in_case}`
        );
      }

      reasons.push(
        `${connectionCount} recorded graph connection${
          connectionCount === 1
            ? ""
            : "s"
        }`
      );

      if (
        categories.size
      ) {
        reasons.push(
          `${categories.size} connection categor${
            categories.size === 1
              ? "y"
              : "ies"
          } represented`
        );
      }

      return {
        priority_level:
          priorityLevel,

        investigation_priority:
          score,

        connection_count:
          connectionCount,

        linked_entity_count:
          0,

        reasons,

        basis:
          "Current case role and saved relationship graph",

        computed:
          true,
      };
    }, [
      selectedNode,
      selectedPerson,
      selectedRelationships,
    ]);

  useEffect(() => {
    if (
      !selectedPerson
        ?.person_id ||
      getTypeGroup(
        selectedNode
      ) !== "People"
    ) {
      setPersonAssessment(
        null
      );

      setAssessmentError(
        ""
      );

      return;
    }

    let cancelled =
      false;

    async function loadAssessment() {
      const token =
        getToken();

      if (!token) {
        return;
      }

      try {
        setAssessmentLoading(
          true
        );

        setAssessmentError(
          ""
        );

        const response =
          await fetch(
            `${API_BASE_URL}/intelligence/assessment/case/${caseId}/person/${encodeURIComponent(
              selectedPerson.person_id
            )}`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        if (
          !response.ok
        ) {
          throw new Error(
            "Assessment service unavailable"
          );
        }

        const data =
          await response.json();

        if (!cancelled) {
          setPersonAssessment(
            data
          );
        }
      } catch (error) {
        if (!cancelled) {
          setPersonAssessment(
            null
          );

          setAssessmentError(
            error.message ||
              "Assessment unavailable"
          );
        }
      } finally {
        if (!cancelled) {
          setAssessmentLoading(
            false
          );
        }
      }
    }

    loadAssessment();

    return () => {
      cancelled = true;
    };
  }, [
    caseId,
    selectedPerson
      ?.person_id,
    selectedNode
      ?.id,
  ]);

  const effectiveAssessment =
    personAssessment ||
    selectedPriority ||
    localAssessment;

  async function reviewSelectedEdge(statusValue) {
    if (!selectedEdge) return;
    try {
      setEdgeReviewLoading(true);
      setEdgeReviewMessage("");
      const result = await featureApi.reviewAnalysisEdge(caseId, {
        source_ref: String(getEdgeSource(selectedEdge)),
        target_ref: String(getEdgeTarget(selectedEdge)),
        relationship_type: formatRelationship(getEdgeLabel(selectedEdge)),
        confidence: selectedEdge.confidence ?? null,
        description: selectedEdge.description || selectedEdge.reason || selectedEdge.explanation || null,
        source_name: selectedEdge.source || "Saved Analysis Graph",
        status: statusValue,
        synthetic: caseData?.synthetic ?? true,
      });
      setSelectedEdge((current) => current ? { ...current, verification_status: result.verification_status } : current);
      setEdgeReviewMessage(`Connection marked ${result.verification_status}.`);
    } catch (error) {
      setEdgeReviewMessage(error?.message || "Unable to review connection.");
    } finally {
      setEdgeReviewLoading(false);
    }
  }

  /* =======================================================
     ACTIONS
     ======================================================= */

  function resetFilters() {
    setTypeFilters(
      Object.fromEntries(
        ENTITY_FILTER_ORDER.map(
          (group) => [
            group,
            true,
          ]
        )
      )
    );

    setLinkFilters(
      Object.fromEntries(
        LINK_FILTER_ORDER.map(
          (type) => [
            type,
            true,
          ]
        )
      )
    );

    setSearch("");
  }

  function fitGraph() {
    setZoom(1);

    if (
      effectivePrimary
    ) {
      setSelectedNodeId(
        effectivePrimary
      );
    }

    setDetailsOpen(
      true
    );
  }

  /* =======================================================
     LOADING
     ======================================================= */

  if (loading) {
    return (
      <div className="relationship-page">
        <AppHeader activePage="relationships" />

        <div className="relationship-loading">
          <Network
            size={30}
          />

          <strong>
            Loading relationship analysis...
          </strong>
        </div>
      </div>
    );
  }

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <div className="relationship-page">
      <AppHeader />

      <div className="relationship-context-bar">
        <div className="relationship-context-left">
          <button
            type="button"
            onClick={() =>
              navigate(
                isForensicAnalyst
                  ? "/forensic/assignments"
                  : `/cases/${caseId}`
              )
            }
          >
            Cases
          </button>

          <span>
            ›
          </span>

          <strong>
            {caseData
              ?.case_id ||
              `Case ${caseId}`}
          </strong>

          <span>
            ›
          </span>

          <b>
            Relationship Analysis
          </b>
        </div>

        <div className="relationship-actions-wrap">
          <button
            type="button"
            className="relationship-actions-button"
            onClick={() =>
              setActionsOpen(
                (
                  current
                ) =>
                  !current
              )
            }
          >
            More Actions

            <ChevronDown
              size={15}
            />
          </button>

          {actionsOpen && (
            <div className="relationship-actions-menu">
              <button
                type="button"
                onClick={() => {
                  setActionsOpen(
                    false
                  );

                  loadPage(
                    true
                  );
                }}
              >
                <RefreshCw
                  size={15}
                />

                Refresh Analysis
              </button>

              <button
                type="button"
                onClick={() => {
                  setActionsOpen(
                    false
                  );

                  fitGraph();
                }}
              >
                <Maximize2
                  size={15}
                />

                Fit Graph
              </button>

              <button
                type="button"
                onClick={() => {
                  setActionsOpen(
                    false
                  );

                  navigate(
                    isForensicAnalyst
                      ? "/forensic/search"
                      : `/cases/${caseId}/persons`
                  );
                }}
              >
                <UsersRound
                  size={15}
                />

                View Persons
              </button>
            </div>
          )}
        </div>
      </div>

      {message && (
        <div className="relationship-message">
          {message}
        </div>
      )}

      <main
        className={`relationship-main ${
          detailsOpen
            ? ""
            : "details-closed"
        }`}
      >
        {/* LEFT FILTERS */}

        <aside className="relationship-filter-panel">
          <section className="relationship-filter-section">
            <div className="relationship-filter-heading">
              <strong>
                ENTITY FILTERS
              </strong>

              <Filter
                size={14}
              />
            </div>

            <div className="relationship-search">
              <Search
                size={15}
              />

              <input
                value={
                  search
                }
                onChange={(
                  event
                ) =>
                  setSearch(
                    event
                      .target
                      .value
                  )
                }
                placeholder="Search entities"
              />
            </div>

            <div className="relationship-filter-list">
              {ENTITY_FILTER_ORDER.map(
                (group) => {
                  const count =
                    typeCounts[
                      group
                    ] || 0;

                  return (
                  <label
                    key={
                      group
                    }
                    className="relationship-filter-item"
                  >
                    <input
                      type="checkbox"
                      checked={
                        typeFilters[
                          group
                        ] !==
                        false
                      }
                      onChange={() =>
                        setTypeFilters(
                          (
                            current
                          ) => ({
                            ...current,

                            [group]:
                              current[
                                group
                              ] ===
                              false,
                          })
                        )
                      }
                    />

                    <span
                      className={`relationship-filter-icon ${typeClass(
                        group
                      )}`}
                    >
                      {typeIcon(
                        group
                      )}
                    </span>

                    <span className="relationship-filter-name">
                      {group}
                    </span>

                    <span className="relationship-filter-count">
                      {count}
                    </span>
                  </label>
                  );
                }
              )}
            </div>
          </section>

          <section className="relationship-filter-section">
            <div className="relationship-filter-heading">
              <strong>
                LINK TYPES
              </strong>
            </div>

            <div className="relationship-link-filter-list">
              {LINK_FILTER_ORDER.map(
                (type) => {
                  const count =
                    linkCounts[
                      type
                    ] || 0;

                  return (
                  <label
                    key={
                      type
                    }
                    className="relationship-link-filter"
                  >
                    <input
                      type="checkbox"
                      checked={
                        linkFilters[
                          type
                        ] !==
                        false
                      }
                      onChange={() =>
                        setLinkFilters(
                          (
                            current
                          ) => ({
                            ...current,

                            [type]:
                              current[
                                type
                              ] ===
                              false,
                          })
                        )
                      }
                    />

                    <span
                      className={`relationship-filter-line ${type}`}
                    />

                    <span>
                      {formatRelationship(
                        type
                      )}
                    </span>

                    <small>
                      {count}
                    </small>
                  </label>
                  );
                }
              )}
            </div>
          </section>

          <button
            type="button"
            className="relationship-reset-button"
            onClick={
              resetFilters
            }
          >
            <RefreshCw
              size={14}
            />

            Reset Filters
          </button>
        </aside>

        {/* MAP */}

        <section className="relationship-map-panel">
          <header className="relationship-map-heading">
            <div>
              <strong>
                RELATIONSHIP MAP
              </strong>

              <span>
                {displayNodes.length}{" "}
                entities ·{" "}
                {displayEdges.length}{" "}
                relationships
              </span>
            </div>

            <div className="relationship-map-controls">
              <button
                type="button"
                title="Fit graph"
                onClick={
                  fitGraph
                }
              >
                <Maximize2
                  size={16}
                />
              </button>

              <button
                type="button"
                title="Refresh"
                disabled={
                  refreshing
                }
                onClick={() =>
                  loadPage(
                    true
                  )
                }
              >
                <RefreshCw
                  size={16}
                  className={
                    refreshing
                      ? "spin"
                      : ""
                  }
                />
              </button>
            </div>
          </header>

          <div
            className={`relationship-canvas ${
              layout.length >= 26
                ? "relationship-canvas-very-dense"
                : layout.length >= 18
                  ? "relationship-canvas-dense"
                  : ""
            }`}
          >
            {layout.length ? (
              <div
                className={`relationship-stage ${
                  layout.length >= 26
                    ? "relationship-stage-very-dense"
                    : layout.length >= 18
                      ? "relationship-stage-dense"
                      : ""
                }`}
                style={{
                  transform:
                    `translate(-50%, -50%) scale(${zoom})`,
                }}
              >
                {/* RELATIONSHIP LINES */}

                <svg
                  className="relationship-lines"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  {displayEdges.map(
                    (
                      edge,
                      visibleIndex
                    ) => {
                      const source =
                        positions.get(
                          String(
                            getEdgeSource(
                              edge
                            )
                          )
                        );

                      const target =
                        positions.get(
                          String(
                            getEdgeTarget(
                              edge
                            )
                          )
                        );

                      if (
                        !source ||
                        !target
                      ) {
                        return null;
                      }

                      const originalIndex =
                        graphData.edges.indexOf(
                          edge
                        );

                      const edgeIndex =
                        originalIndex >=
                        0
                          ? originalIndex
                          : visibleIndex;

                      const touchesSelected =
                        selectedNodeId !==
                          null &&
                        selectedNodeId !==
                          undefined &&
                        (
                          String(
                            getEdgeSource(
                              edge
                            )
                          ) ===
                            String(
                              selectedNodeId
                            ) ||
                          String(
                            getEdgeTarget(
                              edge
                            )
                          ) ===
                            String(
                              selectedNodeId
                            )
                        );

                      return (
                        <line
                          key={
                            edge.id ||
                            visibleIndex
                          }
                          className={`relationship-edge ${
                            selectedEdge === edge
                              ? "selected"
                              : touchesSelected
                                ? "connected"
                                : "muted"
                          }`}
                          onClick={() => {
                            setSelectedEdge(edge);
                            setDetailsOpen(true);
                          }}
                          style={{
                            stroke:
                              getEdgeColor(
                                edgeIndex
                              ),
                          }}
                          x1={
                            source.x
                          }
                          y1={
                            source.y
                          }
                          x2={
                            target.x
                          }
                          y2={
                            target.y
                          }
                        />
                      );
                    }
                  )}
                </svg>

                {/* NODES */}

                {layout.map(
                  (node) => {
                    const group =
                      getTypeGroup(
                        node
                      );

                    const person =
                      findPerson(
                        node,
                        persons
                      );

                    const photo =
                      personPhoto(
                        node,
                        persons
                      );

                    const selected =
                      String(
                        selectedNodeId
                      ) ===
                      String(
                        node.id
                      );

                    const priority =
                      priorityByName.get(
                        normalize(
                          getNodeLabel(
                            node
                          )
                        )
                      );

                    if (
                      node.primary
                    ) {
                      return (
                        <button
                          key={
                            node.id
                          }
                          type="button"
                          className={`relationship-primary-node ${
                            selected
                              ? "selected"
                              : ""
                          }`}
                          style={{
                            left:
                              `${node.graphX}%`,

                            top:
                              `${node.graphY}%`,
                          }}
                          onClick={() => {
                            setSelectedNodeId(
                              node.id
                            );

                            setDetailsOpen(
                              true
                            );
                          }}
                        >
                          <span className="relationship-primary-avatar">
                            {photo ? (
                              <img
                                src={
                                  photo
                                }
                                alt={
                                  getNodeLabel(
                                    node
                                  )
                                }
                              />
                            ) : (
                              getInitials(
                                getNodeLabel(
                                  node
                                )
                              )
                            )}
                          </span>

                          <span className="relationship-primary-copy">
                            <strong>
                              {getNodeLabel(
                                node
                              )}
                            </strong>

                            <small>
                              {person
                                ?.role_in_case ||
                                priority
                                  ?.priority_level ||
                                group}
                            </small>
                          </span>
                        </button>
                      );
                    }

                    return (
                      <button
                        key={
                          node.id
                        }
                        type="button"
                        className={`relationship-node relationship-node-${typeClass(
                          group
                        )} ${
                          selected
                            ? "selected"
                            : ""
                        }`}
                        style={{
                          left:
                            `${node.graphX}%`,

                          top:
                            `${node.graphY}%`,
                        }}
                        onClick={() => {
                          setSelectedNodeId(
                            node.id
                          );
                          setSelectedEdge(null);

                          setDetailsOpen(
                            true
                          );
                        }}
                      >
                        <span
                          className={`relationship-node-avatar ${typeClass(
                            group
                          )}`}
                        >
                          {photo ? (
                            <img
                              src={
                                photo
                              }
                              alt={
                                getNodeLabel(
                                  node
                                )
                              }
                            />
                          ) : group ===
                            "People" ? (
                            getInitials(
                              getNodeLabel(
                                node
                              )
                            )
                          ) : (
                            typeIcon(
                              group,
                              22
                            )
                          )}
                        </span>

                        <span className="relationship-node-copy">
                          <strong>
                            {getNodeLabel(
                              node
                            )}
                          </strong>

                          <small>
                            {person
                              ?.role_in_case ||
                              group}
                          </small>
                        </span>
                      </button>
                    );
                  }
                )}

                <div className="relationship-zoom">
                  <button
                    type="button"
                    onClick={() =>
                      setZoom(
                        (
                          current
                        ) =>
                          Math.max(
                            0.75,
                            current -
                              0.1
                          )
                      )
                    }
                  >
                    −
                  </button>

                  <span>
                    {Math.round(
                      zoom *
                        100
                    )}
                    %
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setZoom(
                        (
                          current
                        ) =>
                          Math.min(
                            1.25,
                            current +
                              0.1
                          )
                      )
                    }
                  >
                    +
                  </button>
                </div>
              </div>
            ) : (
              <div className="relationship-empty">
                <Network
                  size={35}
                />

                <strong>
                  No relationship data
                </strong>

                <span>
                  No entities match the current filters.
                </span>
              </div>
            )}
          </div>

          <div className="relationship-legend">
            <span>
              Solid colours distinguish individual visible connections.
            </span>
          </div>
        </section>

        {/* DETAILS */}

        {detailsOpen && (
          <aside className="relationship-detail-panel">
            <header className="relationship-detail-heading">
              <strong>
                {selectedEdge ? "CONNECTION DETAILS" : "ENTITY DETAILS"}
              </strong>

              <button
                type="button"
                onClick={() =>
                  setDetailsOpen(
                    false
                  )
                }
              >
                <X
                  size={17}
                />
              </button>
            </header>

            {selectedEdge ? (
              <>
                <section className="relationship-selected-profile">
                  <div className="relationship-selected-copy">
                    <span>RELATIONSHIP</span>
                    <h2>{formatRelationship(getEdgeLabel(selectedEdge))}</h2>
                    <b className="relationship-case-role">
                      {selectedEdge.verification_status || selectedEdge.provenance || "Inferred"}
                    </b>
                  </div>
                </section>
                <section className="relationship-detail-list">
                  <Detail label="Source" value={String(getEdgeSource(selectedEdge))} />
                  <Detail label="Target" value={String(getEdgeTarget(selectedEdge))} />
                  <Detail label="Relationship Type" value={formatRelationship(getEdgeLabel(selectedEdge))} />
                  <Detail label="Confidence" value={formatConfidence(selectedEdge.confidence)} />
                  <Detail label="Provenance" value={selectedEdge.provenance || selectedEdge.source || "Inferred from saved analysis"} />
                </section>
                <section className="relationship-intelligence-section">
                  <h3>WHY THIS LINK EXISTS</h3>
                  <p className="relationship-priority-empty">
                    {selectedEdge.description || selectedEdge.reason || selectedEdge.explanation || `This connection was recorded in the saved case analysis as ${formatRelationship(getEdgeLabel(selectedEdge))}.`}
                  </p>
                  <div className="relationship-priority-note">
                    Supporting evidence should be reviewed before relying on an inferred connection. Verified, inferred and manual relationships remain distinct.
                  </div>
                </section>
                <section className="relationship-connections">
                  <h3>SUPPORTING EVIDENCE</h3>
                  <p className="relationship-no-connections">
                    {selectedEdge.evidence_id || selectedEdge.evidence || selectedEdge.source_reference || selectedEdge.source || "Open the linked case evidence to review the source material for this connection."}
                  </p>
                </section>
                <div className="relationship-edge-review-actions">
                  <button type="button" disabled={edgeReviewLoading} onClick={() => reviewSelectedEdge("Verified")}>Verify</button>
                  <button type="button" className="reject" disabled={edgeReviewLoading} onClick={() => reviewSelectedEdge("Rejected")}>Reject</button>
                </div>
                {edgeReviewMessage && <div className="relationship-edge-review-message">{edgeReviewMessage}</div>}
                <div className="relationship-review-note">
                  <ShieldCheck size={15} />
                  <span>AI detects. CINTRA explains. The officer decides.</span>
                </div>
              </>
            ) : selectedNode ? (
              <>
                <section className="relationship-selected-profile">
                  <div
                    className={`relationship-selected-avatar ${typeClass(
                      getTypeGroup(
                        selectedNode
                      )
                    )}`}
                  >
                    {personPhoto(
                      selectedNode,
                      persons
                    ) ? (
                      <img
                        src={personPhoto(
                          selectedNode,
                          persons
                        )}
                        alt={getNodeLabel(
                          selectedNode
                        )}
                      />
                    ) : getTypeGroup(
                        selectedNode
                      ) ===
                      "People" ? (
                      getInitials(
                        getNodeLabel(
                          selectedNode
                        )
                      )
                    ) : (
                      typeIcon(
                        getTypeGroup(
                          selectedNode
                        ),
                        30
                      )
                    )}
                  </div>

                  <div className="relationship-selected-copy">
                    <span>
                      {getTypeGroup(
                        selectedNode
                      )}
                    </span>

                    <h2>
                      {getNodeLabel(
                        selectedNode
                      )}
                    </h2>

                    {selectedPerson
                      ?.role_in_case && (
                      <b className="relationship-case-role">
                        {
                          selectedPerson
                            .role_in_case
                        }
                      </b>
                    )}
                  </div>
                </section>

                <section className="relationship-detail-list">
                  {selectedPerson
                    ?.person_id && (
                    <Detail
                      label="Person ID"
                      value={
                        selectedPerson
                          .person_id
                      }
                    />
                  )}

                  {selectedPerson
                    ?.role_in_case && (
                    <Detail
                      label="Role in Case"
                      value={
                        selectedPerson
                          .role_in_case
                      }
                    />
                  )}

                  {selectedPerson
                    ?.status && (
                    <Detail
                      label="Status"
                      value={
                        selectedPerson
                          .status
                      }
                    />
                  )}

                  {selectedPerson
                    ?.phone && (
                    <Detail
                      label="Phone"
                      value={
                        selectedPerson
                          .phone
                      }
                    />
                  )}

                  <Detail
                    label="Recorded Connections"
                    value={
                      selectedRelationships.length
                    }
                  />
                </section>

                {getTypeGroup(
                  selectedNode
                ) ===
                  "People" && (
                  <section className="relationship-intelligence-section">
                    <h3>
                      INTELLIGENCE ASSESSMENT
                    </h3>

                    {assessmentLoading &&
                    !effectiveAssessment ? (
                      <p className="relationship-priority-empty">
                        Calculating analytical assessment…
                      </p>
                    ) : effectiveAssessment ? (
                      <>
                        <Detail
                          label="Investigation Priority"
                          value={
                            effectiveAssessment
                              .priority_level
                          }
                        />

                        <Detail
                          label="Priority Score"
                          value={`${effectiveAssessment
                            .investigation_priority}/100`}
                        />

                        <Detail
                          label="Recorded Connections"
                          value={
                            effectiveAssessment
                              .connection_count ??
                            selectedRelationships
                              .length
                          }
                        />

                        {effectiveAssessment
                          .linked_entity_count !==
                          undefined && (
                          <Detail
                            label="Linked Intelligence Entities"
                            value={
                              effectiveAssessment
                                .linked_entity_count
                            }
                          />
                        )}

                        {Array.isArray(
                          effectiveAssessment
                            .reasons
                        ) &&
                          effectiveAssessment
                            .reasons
                            .length > 0 && (
                          <div
                            className="relationship-priority-note"
                            style={{
                              marginTop: 12,
                            }}
                          >
                            {effectiveAssessment
                              .reasons
                              .slice(
                                0,
                                3
                              )
                              .map(
                                (
                                  reason,
                                  index
                                ) => (
                                  <div
                                    key={`${reason}-${index}`}
                                    style={{
                                      marginBottom:
                                        index <
                                        Math.min(
                                          effectiveAssessment
                                            .reasons
                                            .length,
                                          3
                                        ) -
                                          1
                                          ? 5
                                          : 0,
                                    }}
                                  >
                                    • {reason}
                                  </div>
                                )
                              )}
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="relationship-priority-empty">
                        Analytical assessment is not available for this record.
                      </p>
                    )}

                    <div className="relationship-priority-note">
                      Analytical triage aid only. It does not determine guilt and does not replace the investigator-assigned case role.
                      {assessmentError
                        ? " The displayed score uses the saved case graph as a fallback."
                        : ""}
                    </div>
                  </section>
                )}

                <section className="relationship-connections">
                  <h3>
                    CONNECTIONS
                  </h3>

                  {selectedRelationships.length ? (
                    selectedRelationships.map(
                      (
                        edge,
                        index
                      ) => {
                        const source =
                          getEdgeSource(
                            edge
                          );

                        const target =
                          getEdgeTarget(
                            edge
                          );

                        const otherId =
                          String(
                            source
                          ) ===
                          String(
                            selectedNode.id
                          )
                            ? target
                            : source;

                        const other =
                          graphData.nodes.find(
                            (
                              node
                            ) =>
                              String(
                                node.id
                              ) ===
                              String(
                                otherId
                              )
                          );

                        const edgeIndex =
                          graphData.edges.indexOf(
                            edge
                          );

                        return (
                          <button
                            key={
                              edge.id ||
                              index
                            }
                            type="button"
                            onClick={() => {
                              setSelectedEdge(edge);
                              setDetailsOpen(true);
                            }}
                          >
                            <span
                              className="relationship-connection-color"
                              style={{
                                background:
                                  getEdgeColor(
                                    edgeIndex >=
                                      0
                                      ? edgeIndex
                                      : index
                                  ),
                              }}
                            />

                            <span className="relationship-connection-copy">
                              <strong>
                                {other
                                  ? getNodeLabel(
                                      other
                                    )
                                  : otherId}
                              </strong>

                              <small>
                                {formatRelationship(
                                  getEdgeLabel(
                                    edge
                                  )
                                )}
                              </small>
                            </span>

                            <b>
                              {formatConfidence(
                                edge.confidence
                              )}
                            </b>
                          </button>
                        );
                      }
                    )
                  ) : (
                    <p className="relationship-no-connections">
                      No recorded connections.
                    </p>
                  )}
                </section>

                <div className="relationship-review-note">
                  <ShieldCheck
                    size={15}
                  />

                  <span>
                    Intelligence relationships and priority scores are investigative leads and require investigator review.
                  </span>
                </div>
              </>
            ) : (
              <div className="relationship-empty-details">
                <UsersRound
                  size={30}
                />

                Select an entity.
              </div>
            )}
          </aside>
        )}
      </main>
    </div>
  );
}

/* =========================================================
   DETAIL COMPONENT
   ========================================================= */

function Detail({
  label,
  value,
}) {
  return (
    <div className="relationship-detail-row">
      <span>
        {label}
      </span>

      <strong>
        {value ?? "—"}
      </strong>
    </div>
  );
}

export default RelationshipAnalysis;