import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Car,
  CheckCircle2,
  CircleDollarSign,
  FileSearch,
  Filter,
  Link2,
  MapPin,
  Network,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  UserRound,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import ForceGraph3D from "react-force-graph-3d";

import AppHeader from "../../components/layout/AppHeader.jsx";
import { featureApi } from "../../services/expandedFeatures.js";
import "./CrossCasePage.css";

const TYPE_CONFIG = [
  ["case", "FIR / Case"],
  ["person", "Person"],
  ["phone", "Phone"],
  ["device", "Device / IMEI"],
  ["vehicle", "Vehicle"],
  ["account", "Account"],
  ["location", "Location"],
  ["organisation", "Organisation"],
  ["entity", "Other"],
];

function normalizeType(value = "") {
  const type = String(value).trim().toUpperCase();

  if (type === "CASE" || type === "FIR") return "case";
  if (type === "PERSON" || type === "PERSON_NAME") return "person";
  if (type === "PHONE" || type === "CDR") return "phone";
  if (type === "IMEI" || type === "DEVICE") return "device";
  if (type === "VEHICLE") return "vehicle";
  if (type === "ACCOUNT") return "account";
  if (type === "LOCATION") return "location";

  if (
    type === "ORGANISATION" ||
    type === "ORGANIZATION"
  ) {
    return "organisation";
  }

  return "entity";
}

function getNodeType(node) {
  return normalizeType(
    node?.entity_type ||
      node?.node_type ||
      node?.identifier_type ||
      node?.type
  );
}

function getNodeLabel(node) {
  return String(
    node?.label ||
      node?.value ||
      node?.secondary_label ||
      node?.normalized_value ||
      node?.id ||
      "Unknown"
  );
}

function getNodeId(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  if (typeof value === "object") {
    return String(
      value.id ?? ""
    );
  }

  return String(value);
}

function getCaseDatabaseId(node) {
  if (!node) {
    return null;
  }

  return (
    node?.database_id ??
    node?.case_id ??
    node?.caseId ??
    null
  );
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function nodeTooltip(node) {
  const type =
    getNodeType(node);

  const label =
    escapeHtml(
      getNodeLabel(node)
    );

  if (type === "case") {
    return `
      <div class="cintra-graph-tooltip">
        <span>FIR / CASE</span>
        <strong>${label}</strong>
        <small>${escapeHtml(
          node?.title ||
          "Investigation record"
        )}</small>
      </div>
    `;
  }

  const count =
    Number(
      node?.case_count || 0
    );

  return `
    <div class="cintra-graph-tooltip">
      <span>${escapeHtml(
        type.toUpperCase()
      )}</span>

      <strong>${label}</strong>

      <small>
        ${count || 1}
        linked investigation${
          count === 1
            ? ""
            : "s"
        }
      </small>
    </div>
  `;
}

function baseNodeColor(type) {
  switch (
    normalizeType(type)
  ) {
    case "case":
      return "#244f84";

    case "person":
      return "#7048b6";

    case "phone":
      return "#0f8b8d";

    case "device":
      return "#267d8e";

    case "vehicle":
      return "#47749c";

    case "account":
      return "#29815e";

    case "location":
      return "#0a8f7c";

    case "organisation":
      return "#8e537a";

    default:
      return "#60768c";
  }
}

function NodeIcon({
  type,
  size = 16,
}) {
  switch (
    normalizeType(type)
  ) {
    case "case":
      return (
        <FileSearch
          size={size}
        />
      );

    case "person":
      return (
        <UserRound
          size={size}
        />
      );

    case "phone":
      return (
        <Phone
          size={size}
        />
      );

    case "device":
      return (
        <Smartphone
          size={size}
        />
      );

    case "vehicle":
      return (
        <Car
          size={size}
        />
      );

    case "account":
      return (
        <CircleDollarSign
          size={size}
        />
      );

    case "location":
      return (
        <MapPin
          size={size}
        />
      );

    case "organisation":
      return (
        <Building2
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

function StatCard({
  icon,
  label,
  value,
}) {
  return (
    <div className="cross-case-stat">

      <div className="cross-case-stat-icon">
        {icon}
      </div>

      <div>

        <span>
          {label}
        </span>

        <strong>
          {value ?? 0}
        </strong>

      </div>

    </div>
  );
}


/* =========================================================
   DEMO-STYLE 3D LAYOUT

   FIR / Case nodes:
   - fixed outer ring

   Shared entities:
   - compact central cluster

   Every node receives fx/fy/fz so the layout remains clean.
   It is still a real 3D scene and can be rotated.
   ========================================================= */

function applyDemoLayout(nodes) {
  const cases =
    nodes
      .filter(
        (node) =>
          getNodeType(node) ===
          "case"
      )
      .sort(
        (a, b) =>
          getNodeLabel(a)
            .localeCompare(
              getNodeLabel(b)
            )
      );

  const entities =
    nodes
      .filter(
        (node) =>
          getNodeType(node) !==
          "case"
      )
      .sort(
        (a, b) =>
          Number(
            b?.case_count || 0
          ) -
          Number(
            a?.case_count || 0
          )
      );

  const result = [];

  const caseCount =
    Math.max(
      cases.length,
      1
    );

  const outerRadius =
    Math.min(
      205,
      Math.max(
        155,
        135 +
          cases.length *
            1.8
      )
    );


  /* =======================================================
     OUTER CASE RING
     ======================================================= */

  cases.forEach(
    (
      node,
      index
    ) => {

      const angle =
        -Math.PI / 2 +
        (
          index /
          caseCount
        ) *
        Math.PI *
        2;

      const x =
        Math.cos(angle) *
        outerRadius;

      const y =
        Math.sin(angle) *
        outerRadius *
        0.78;

      /*
       * A small Z wave gives the ring real 3D depth
       * without ruining the clean circular appearance.
       */

      const z =
        Math.sin(
          angle * 2
        ) * 20;

      result.push({
        ...node,

        fx: x,
        fy: y,
        fz: z,

        x,
        y,
        z,
      });

    }
  );


  /* =======================================================
     CENTRAL ENTITY CLUSTER
     ======================================================= */

  const goldenAngle =
    Math.PI *
    (
      3 -
      Math.sqrt(5)
    );

  const entityCount =
    Math.max(
      entities.length,
      1
    );

  entities.forEach(
    (
      node,
      index
    ) => {

      const t =
        (
          index +
          0.5
        ) /
        entityCount;

      const radius =
        10 +
        Math.sqrt(t) *
          72;

      const angle =
        index *
        goldenAngle;

      const x =
        Math.cos(angle) *
        radius;

      const y =
        Math.sin(angle) *
        radius *
        0.72;

      /*
       * Central nodes receive actual depth.
       * This is what keeps the graph visibly 3D when rotated.
       */

      const z =
        Math.sin(
          index *
          1.73
        ) *
        (
          10 +
          t *
            42
        );

      result.push({
        ...node,

        fx: x,
        fy: y,
        fz: z,

        x,
        y,
        z,
      });

    }
  );

  return result;
}


export default function CrossCasePage() {
  const navigate =
    useNavigate();

  const graphRef =
    useRef(null);

  const graphContainerRef =
    useRef(null);

  const [
    graphSize,
    setGraphSize,
  ] = useState({
    width: 900,
    height: 630,
  });

  const [
    graph,
    setGraph,
  ] = useState({
    nodes: [],
    edges: [],
    stats: {},
    entity_type_counts: {},
    cluster_counts: {},
    responsible_use: "",
  });

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    query,
    setQuery,
  ] = useState("");

  const [
    selectedNode,
    setSelectedNode,
  ] = useState(null);

  const [
    hoveredNode,
    setHoveredNode,
  ] = useState(null);

  const [
    bridgeOnly,
    setBridgeOnly,
  ] = useState(false);

  const [
    verifiedOnly,
    setVerifiedOnly,
  ] = useState(false);

  const [
    enabledTypes,
    setEnabledTypes,
  ] = useState({
    case: true,
    person: true,
    phone: true,
    device: true,
    vehicle: true,
    account: true,
    location: true,
    organisation: true,
    entity: true,
  });


  /* =======================================================
     GRAPH RESIZE
     ======================================================= */

  useEffect(() => {
    const element =
      graphContainerRef.current;

    if (!element) {
      return undefined;
    }

    const updateSize =
      () => {

        const rect =
          element
            .getBoundingClientRect();

        setGraphSize({
          width:
            Math.max(
              320,
              Math.floor(
                rect.width
              )
            ),

          height:
            Math.max(
              500,
              Math.floor(
                rect.height
              )
            ),
        });
      };

    updateSize();

    const observer =
      new ResizeObserver(
        updateSize
      );

    observer.observe(
      element
    );

    return () =>
      observer.disconnect();

  }, []);


  /* =======================================================
     LOAD GLOBAL CROSS-CASE GRAPH
     ======================================================= */

  async function loadGraph() {
    try {
      setLoading(true);
      setError("");

      const data =
        await featureApi
          .globalCrossCaseNetwork({
            bridgesOnly: false,
            limit: 300,
          });

      setGraph({
        nodes:
          Array.isArray(
            data?.nodes
          )
            ? data.nodes
            : [],

        edges:
          Array.isArray(
            data?.edges
          )
            ? data.edges
            : [],

        stats:
          data?.stats ||
          {},

        entity_type_counts:
          data
            ?.entity_type_counts ||
          {},

        cluster_counts:
          data
            ?.cluster_counts ||
          {},

        responsible_use:
          data
            ?.responsible_use ||
          "",
      });

      setSelectedNode(
        null
      );

      setHoveredNode(
        null
      );

    } catch (err) {
      console.error(
        "Cross-case network error:",
        err
      );

      setError(
        err?.message ||
        "Unable to load cross-case network."
      );

    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGraph();
  }, []);


  /* =======================================================
     FILTER NODES
     ======================================================= */

  const visibleNodes =
    useMemo(
      () => {

        return graph.nodes.filter(
          (node) => {

            const type =
              getNodeType(
                node
              );

            if (
              enabledTypes[
                type
              ] === false
            ) {
              return false;
            }

            if (
              bridgeOnly &&
              type !== "case" &&
              !node?.is_bridge &&
              Number(
                node
                  ?.case_count ||
                0
              ) < 2
            ) {
              return false;
            }

            if (
              verifiedOnly &&
              type !== "case" &&
              String(
                node?.status ||
                ""
              )
                .trim()
                .toLowerCase() !==
                "verified"
            ) {
              return false;
            }

            return true;
          }
        );

      },
      [
        graph.nodes,
        enabledTypes,
        bridgeOnly,
        verifiedOnly,
      ]
    );


  /* =======================================================
     VISIBLE IDS + EDGES
     ======================================================= */

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
      () => {

        return graph.edges.filter(
          (edge) => {

            const sourceId =
              getNodeId(
                edge.source
              );

            const targetId =
              getNodeId(
                edge.target
              );

            return (
              visibleIds.has(
                sourceId
              ) &&
              visibleIds.has(
                targetId
              )
            );
          }
        );

      },
      [
        graph.edges,
        visibleIds,
      ]
    );


  /* =======================================================
     DEMO GRAPH DATA
     ======================================================= */

  const graphData =
    useMemo(
      () => {

        return {
          nodes:
            applyDemoLayout(
              visibleNodes
            ),

          links:
            visibleEdges.map(
              (edge) => ({
                ...edge,

                source:
                  getNodeId(
                    edge.source
                  ),

                target:
                  getNodeId(
                    edge.target
                  ),
              })
            ),
        };

      },
      [
        visibleNodes,
        visibleEdges,
      ]
    );


  /* =======================================================
     RAW NODE LOOKUP
     ======================================================= */

  const rawNodeMap =
    useMemo(
      () =>
        new Map(
          graph.nodes.map(
            (node) => [
              String(
                node.id
              ),
              node,
            ]
          )
        ),
      [
        graph.nodes,
      ]
    );


  /* =======================================================
     ACTIVE NODE

     Hover temporarily overrides selected node.
     When hover ends, clicked selection remains highlighted.
     ======================================================= */

  const activeNodeId =
    hoveredNode
      ? String(
          hoveredNode.id
        )
      : selectedNode
        ? String(
            selectedNode.id
          )
        : null;


  /* =======================================================
     ACTIVE NEIGHBOURS
     ======================================================= */

  const activeNeighbourIds =
    useMemo(
      () => {

        const ids =
          new Set();

        if (!activeNodeId) {
          return ids;
        }

        visibleEdges.forEach(
          (edge) => {

            const sourceId =
              getNodeId(
                edge.source
              );

            const targetId =
              getNodeId(
                edge.target
              );

            if (
              sourceId ===
              activeNodeId
            ) {
              ids.add(
                targetId
              );
            }

            if (
              targetId ===
              activeNodeId
            ) {
              ids.add(
                sourceId
              );
            }

          }
        );

        return ids;

      },
      [
        activeNodeId,
        visibleEdges,
      ]
    );


  function isActiveLink(link) {
    if (!activeNodeId) {
      return false;
    }

    const sourceId =
      getNodeId(
        link.source
      );

    const targetId =
      getNodeId(
        link.target
      );

    return (
      sourceId ===
        activeNodeId ||
      targetId ===
        activeNodeId
    );
  }


  /* =======================================================
     NODE APPEARANCE
     ======================================================= */

  function graphNodeColor(node) {
    const id =
      String(
        node.id
      );

    if (
      activeNodeId &&
      id === activeNodeId
    ) {
      return "#d29b2f";
    }

    if (
      activeNodeId &&
      activeNeighbourIds.has(
        id
      )
    ) {
      return "#17a27b";
    }

    return baseNodeColor(
      getNodeType(
        node
      )
    );
  }

  function graphNodeValue(node) {
  const type =
    getNodeType(node);

  // FIR / Case = clearly biggest
  if (type === "case") {
    return 8;
  }

  // Shared cross-case entities = medium-small
  if (node?.is_bridge) {
    return 0.9;
  }

  // Normal entities = smallest
  return 0.6;
}


  /* =======================================================
     NODE CLICK
     ======================================================= */

  function handleNodeClick(node) {
    const rawNode =
      rawNodeMap.get(
        String(
          node.id
        )
      ) || node;

    setSelectedNode(
      rawNode
    );

    const {
      x = 0,
      y = 0,
      z = 0,
    } = node;

    const distance =
      Math.hypot(
        x,
        y,
        z
      ) || 1;

    const ratio =
      1 +
      145 /
        distance;

    graphRef.current
      ?.cameraPosition(
        {
          x:
            x *
            ratio,

          y:
            y *
            ratio,

          z:
            z *
              ratio +
            55,
        },

        {
          x,
          y,
          z,
        },

        700
      );
  }


  /* =======================================================
     SEARCH
     ======================================================= */

  function runSearch(event) {
    event?.preventDefault();

    const value =
      query
        .trim()
        .toLowerCase();

    if (!value) {
      return;
    }

    const match =
      graph.nodes.find(
        (node) => {

          const haystack = [
            node?.label,
            node?.value,
            node
              ?.secondary_label,
            node?.title,
            node
              ?.normalized_value,
            node?.entity_type,
            node?.node_type,
            node?.cluster,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return haystack.includes(
            value
          );
        }
      );

    if (!match) {
      setError(
        `No network node found for "${query}".`
      );

      return;
    }

    setError("");

    const rendered =
      graphData.nodes.find(
        (node) =>
          String(
            node.id
          ) ===
          String(
            match.id
          )
      );

    if (rendered) {
      handleNodeClick(
        rendered
      );
    } else {
      setSelectedNode(
        match
      );
    }
  }


  /* =======================================================
     TYPE COUNTS
     ======================================================= */

  const typeCounts =
    useMemo(
      () => {

        const counts = {
          case: 0,
          person: 0,
          phone: 0,
          device: 0,
          vehicle: 0,
          account: 0,
          location: 0,
          organisation: 0,
          entity: 0,
        };

        graph.nodes.forEach(
          (node) => {

            const type =
              getNodeType(
                node
              );

            counts[type] =
              (
                counts[type] ||
                0
              ) + 1;
          }
        );

        return counts;

      },
      [
        graph.nodes,
      ]
    );


  /* =======================================================
     SELECTED LINKS
     ======================================================= */

  const selectedEdges =
    useMemo(
      () => {

        if (!selectedNode) {
          return [];
        }

        const selectedId =
          String(
            selectedNode.id
          );

        return graph.edges.filter(
          (edge) => {

            const sourceId =
              getNodeId(
                edge.source
              );

            const targetId =
              getNodeId(
                edge.target
              );

            return (
              sourceId ===
                selectedId ||
              targetId ===
                selectedId
            );
          }
        );

      },
      [
        graph.edges,
        selectedNode,
      ]
    );


  /* =======================================================
     CONNECTED NODES
     ======================================================= */

  const selectedConnectedNodes =
    useMemo(
      () => {

        if (!selectedNode) {
          return [];
        }

        const selectedId =
          String(
            selectedNode.id
          );

        const ids =
          new Set();

        selectedEdges.forEach(
          (edge) => {

            const sourceId =
              getNodeId(
                edge.source
              );

            const targetId =
              getNodeId(
                edge.target
              );

            ids.add(
              sourceId ===
                selectedId
                ? targetId
                : sourceId
            );
          }
        );

        return graph.nodes.filter(
          (node) =>
            ids.has(
              String(
                node.id
              )
            )
        );

      },
      [
        graph.nodes,
        selectedEdges,
        selectedNode,
      ]
    );


  /* =======================================================
     SUPPORTING EVIDENCE
     ======================================================= */

  const selectedEvidence =
    useMemo(
      () => {

        const map =
          new Map();

        selectedEdges.forEach(
          (edge) => {

            const items =
              Array.isArray(
                edge
                  ?.supporting_evidence
              )
                ? edge
                    .supporting_evidence
                : [];

            items.forEach(
              (
                item,
                index
              ) => {

                const key =
                  String(
                    item?.id ??
                    item
                      ?.evidence_id ??
                    `${index}-${item?.title || ""}`
                  );

                if (
                  !map.has(
                    key
                  )
                ) {
                  map.set(
                    key,
                    item
                  );
                }
              }
            );
          }
        );

        return Array.from(
          map.values()
        );

      },
      [
        selectedEdges,
      ]
    );


  function toggleType(type) {
    setEnabledTypes(
      (current) => ({
        ...current,

        [type]:
          !current[
            type
          ],
      })
    );
  }


  /* =======================================================
     INITIAL DEMO CAMERA

     Tilted perspective matches the original reference.
     ======================================================= */

  useEffect(() => {
    if (
      !graphRef.current ||
      loading ||
      graphData.nodes.length ===
        0
    ) {
      return;
    }

    const timer =
      window.setTimeout(
        () => {

          graphRef.current
            ?.cameraPosition(
              {
                x: 0,
                y: 235,
                z: 390,
              },

              {
                x: 0,
                y: 0,
                z: 0,
              },

              0
            );

          graphRef.current
            ?.zoomToFit(
              0,
              72
            );
        },
        80
      );

    return () =>
      window.clearTimeout(
        timer
      );

  }, [
    loading,
    graphData,
  ]);


  return (
    <div className="cross-case-page">

      <AppHeader
        activePage="cross-case"
      />


      <main className="cross-case-main">

        <section className="cross-case-heading">

          <div>

            <span className="cross-case-eyebrow">
              CINTRA · CROSS-CASE INTELLIGENCE
            </span>

            <h1>
              Cross-Crime Entity Network
            </h1>

            <p>
              Trace recurring people,
              phones, vehicles, devices,
              accounts, locations and
              organisations across authorized
              investigations.
            </p>

          </div>


          <button
            type="button"
            className="cross-case-refresh"
            onClick={
              loadGraph
            }
            disabled={
              loading
            }
          >

            <RefreshCw
              size={15}
              className={
                loading
                  ? "spin"
                  : ""
              }
            />

            Refresh

          </button>

        </section>


        <div className="cross-case-notice">

          <ShieldCheck
            size={17}
          />

          <span>
            {
              graph
                .responsible_use ||
              "Cross-case connections are investigative leads. Supporting evidence must be reviewed by an authorized officer."
            }
          </span>

        </div>


        <section className="cross-case-stats">

          <StatCard
            icon={
              <FileSearch
                size={20}
              />
            }
            label="Connected FIRs"
            value={
              graph
                .stats
                ?.case_count ??
              typeCounts.case
            }
          />

          <StatCard
            icon={
              <Network
                size={20}
              />
            }
            label="Shared Bridges"
            value={
              graph
                .stats
                ?.bridge_count ??
              0
            }
          />

          <StatCard
            icon={
              <Link2
                size={20}
              />
            }
            label="Connections"
            value={
              graph
                .stats
                ?.connection_count ??
              graph.edges.length
            }
          />

          <StatCard
            icon={
              <CheckCircle2
                size={20}
              />
            }
            label="Verified"
            value={
              graph
                .stats
                ?.verified_count ??
              0
            }
          />

        </section>


        <section className="cross-case-search-row">

          <form
            className="cross-case-search-box"
            onSubmit={
              runSearch
            }
          >

            <Search
              size={18}
            />

            <input
              value={
                query
              }
              onChange={
                (event) =>
                  setQuery(
                    event
                      .target
                      .value
                  )
              }
              placeholder="Search FIR, person, phone, IMEI, vehicle, account or location"
            />

            {
              query &&
              (
                <button
                  type="button"
                  className="cross-case-search-clear"
                  onClick={
                    () =>
                      setQuery("")
                  }
                  aria-label="Clear search"
                >
                  <X
                    size={16}
                  />
                </button>
              )
            }

          </form>


          <label className="cross-case-toggle">

            <input
              type="checkbox"
              checked={
                bridgeOnly
              }
              onChange={
                (event) =>
                  setBridgeOnly(
                    event
                      .target
                      .checked
                  )
              }
            />

            <span className="cross-case-switch" />

            <strong>
              Cross-Case Bridges Only
            </strong>

          </label>

        </section>


        {
          error &&
          (
            <div className="cross-case-warning">
              {error}
            </div>
          )
        }


        <section className="cross-case-workspace">


          {/* =================================================
              LEFT FILTERS
              ================================================= */}

          <aside className="cross-case-filters">

            <header>

              <Filter
                size={18}
              />

              <div>

                <span>
                  NETWORK FILTERS
                </span>

                <strong>
                  Entity Types
                </strong>

              </div>

            </header>


            <div className="cross-case-filter-list">

              {
                TYPE_CONFIG.map(
                  (
                    [
                      type,
                      label,
                    ]
                  ) => (

                    <label
                      key={
                        type
                      }
                      className="cross-case-filter-item"
                    >

                      <input
                        type="checkbox"
                        checked={
                          enabledTypes[
                            type
                          ]
                        }
                        onChange={
                          () =>
                            toggleType(
                              type
                            )
                        }
                      />

                      <span
                        className={
                          `cross-case-filter-icon type-${type}`
                        }
                      >

                        <NodeIcon
                          type={
                            type
                          }
                          size={15}
                        />

                      </span>

                      <strong>
                        {label}
                      </strong>

                      <em>
                        {
                          typeCounts[
                            type
                          ] || 0
                        }
                      </em>

                    </label>
                  )
                )
              }

            </div>


            <div className="cross-case-filter-section">

              <span className="cross-case-filter-title">
                RELATIONSHIP STATUS
              </span>


              <label className="cross-case-check-row">

                <input
                  type="checkbox"
                  checked={
                    verifiedOnly
                  }
                  onChange={
                    (event) =>
                      setVerifiedOnly(
                        event
                          .target
                          .checked
                      )
                  }
                />

                <i className="status-dot verified" />

                Verified only

              </label>


              <label className="cross-case-check-row">

                <input
                  type="checkbox"
                  checked={
                    bridgeOnly
                  }
                  onChange={
                    (event) =>
                      setBridgeOnly(
                        event
                          .target
                          .checked
                      )
                  }
                />

                <i className="status-dot inferred" />

                Cross-case bridge

              </label>

            </div>

          </aside>


          {/* =================================================
              3D GRAPH
              ================================================= */}

          <section className="cross-case-graph-panel">

            <header className="cross-case-panel-header">

              <div>

                <span>
                  INTERACTIVE 3D CROSS-CASE NETWORK
                </span>

                <strong>
                  {
                    graphData
                      .nodes
                      .length
                  } nodes ·{" "}
                  {
                    graphData
                      .links
                      .length
                  } connections
                </strong>

              </div>


              <div className="cross-case-network-key">

                <span>
                  Drag to rotate
                </span>

                <span>
                  Scroll to zoom
                </span>

                <span>
                  Hover to inspect
                </span>

              </div>

            </header>


            <div
              ref={
                graphContainerRef
              }
              className="cross-case-graph-3d"
            >

              {
                loading
                  ? (
                      <div className="cross-case-loading">

                        <Network
                          size={32}
                        />

                        <strong>
                          Loading 3D network
                        </strong>

                        <span>
                          Building the cross-case intelligence graph…
                        </span>

                      </div>
                    )
                  : graphData
                      .nodes
                      .length ===
                    0
                    ? (
                        <div className="cross-case-loading">

                          <Network
                            size={32}
                          />

                          <strong>
                            No network records
                          </strong>

                          <span>
                            Change the filters or refresh the graph.
                          </span>

                        </div>
                      )
                    : (
                        <ForceGraph3D
                          ref={
                            graphRef
                          }

                          width={
                            graphSize.width
                          }

                          height={
                            graphSize.height
                          }

                          graphData={
                            graphData
                          }

                          nodeId="id"

                          /*
                           * IMPORTANT:
                           * This appears ONLY while hovering.
                           * No permanent labels clutter the graph.
                           */
                          nodeLabel={
                            nodeTooltip
                          }

                          nodeColor={
                            graphNodeColor
                          }

                          nodeVal={
                            graphNodeValue
                          }

                          nodeOpacity={
                            0.98
                          }

                          nodeResolution={
                            18
                          }

                          enableNodeDrag={
                            false
                          }

                          showNavInfo={
                            false
                          }

                          controlType="orbit"

                          enableNavigationControls

                          /*
                           * Every node is already positioned
                           * by applyDemoLayout().
                           * Do not allow a force simulation
                           * to destroy the clean ring.
                           */
                          warmupTicks={
                            0
                          }

                          cooldownTicks={
                            0
                          }

                          linkColor={
                            (link) => {

                              if (
                                !activeNodeId
                              ) {
                                return "rgba(28, 146, 108, 0.22)";
                              }

                              return isActiveLink(
                                link
                              )
                                ? "rgba(17, 150, 108, 0.98)"
                                : "rgba(130, 153, 160, 0.035)";
                            }
                          }

                          linkWidth={
                            (link) => {

                              if (
                                !activeNodeId
                              ) {
                                return 0.55;
                              }

                              return isActiveLink(
                                link
                              )
                                ? 2.8
                                : 0.12;
                            }
                          }

                          linkOpacity={
                            1
                          }

                          /*
                           * Only selected/hovered connections
                           * receive moving particles.
                           */
                          linkDirectionalParticles={
                            (link) =>
                              isActiveLink(
                                link
                              )
                                ? 2
                                : 0
                          }

                          linkDirectionalParticleWidth={
                            1.35
                          }

                          linkDirectionalParticleSpeed={
                            0.004
                          }

                          linkDirectionalParticleColor={
                            () =>
                              "#d6a83a"
                          }

                          backgroundColor={
                            "#f4f7fa"
                          }

                          onNodeHover={
                            (node) =>
                              setHoveredNode(
                                node ||
                                null
                              )
                          }

                          onNodeClick={
                            handleNodeClick
                          }

                          onBackgroundClick={
                            () => {

                              setSelectedNode(
                                null
                              );

                              setHoveredNode(
                                null
                              );
                            }
                          }
                        />
                      )
              }

            </div>

          </section>


          {/* =================================================
              RIGHT DETAILS
              ================================================= */}

          <aside className="cross-case-detail-panel">

            <header className="cross-case-detail-header">

              <div>

                <span>
                  EXPLAINABILITY
                </span>

                <strong>
                  Selection Details
                </strong>

              </div>


              {
                selectedNode &&
                (
                  <button
                    type="button"
                    onClick={
                      () =>
                        setSelectedNode(
                          null
                        )
                    }
                    aria-label="Close selection"
                  >

                    <X
                      size={16}
                    />

                  </button>
                )
              }

            </header>


            {
              !selectedNode
                ? (
                    <div className="cross-case-detail-empty">

                      <Network
                        size={31}
                      />

                      <strong>
                        Select a node
                      </strong>

                      <p>
                        Hover a node to see only its label.
                        Click it to keep its connections highlighted
                        and inspect its investigation context.
                      </p>

                    </div>
                  )
                : (
                    <SelectionDetails
                      node={
                        selectedNode
                      }
                      edges={
                        selectedEdges
                      }
                      connectedNodes={
                        selectedConnectedNodes
                      }
                      evidence={
                        selectedEvidence
                      }
                      navigate={
                        navigate
                      }
                    />
                  )
            }

          </aside>

        </section>

      </main>

    </div>
  );
}


function SelectionDetails({
  node,
  edges,
  connectedNodes,
  evidence,
  navigate,
}) {
  const type =
    getNodeType(
      node
    );

  const isCase =
    type === "case";

  const connectedCases =
    connectedNodes.filter(
      (item) =>
        getNodeType(
          item
        ) === "case"
    );

  const connectedEntities =
    connectedNodes.filter(
      (item) =>
        getNodeType(
          item
        ) !== "case"
    );

  const caseDatabaseId =
    getCaseDatabaseId(
      node
    );

  return (
    <div className="cross-case-detail-body">

      <div className="cross-case-selected-identity">

        <span
          className={
            `cross-case-selected-icon type-${type}`
          }
        >

          <NodeIcon
            type={
              type
            }
            size={21}
          />

        </span>


        <div>

          <small>
            {
              isCase
                ? "FIR / CASE"
                : node
                    ?.entity_type ||
                  type
                    .toUpperCase()
            }
          </small>

          <h2>
            {
              getNodeLabel(
                node
              )
            }
          </h2>

        </div>

      </div>


      <div className="cross-case-detail-metrics">

        <div>

          <span>
            LINKS
          </span>

          <strong>
            {edges.length}
          </strong>

        </div>


        <div>

          <span>
            CASES
          </span>

          <strong>
            {
              isCase
                ? 1
                : node
                    ?.case_count ??
                  connectedCases.length
            }
          </strong>

        </div>


        <div>

          <span>
            STATUS
          </span>

          <strong>
            {
              node?.status ||
              (
                isCase
                  ? "Active"
                  : "Review"
              )
            }
          </strong>

        </div>

      </div>


      {
        isCase
          ? (
              <>

                <DetailBlock
                  label="CASE TITLE"
                >

                  <strong>
                    {
                      node?.title ||
                      "Investigation record"
                    }
                  </strong>

                </DetailBlock>


                <DetailBlock
                  label="RECORDED OFFENCE"
                >

                  <p>
                    {
                      node?.offence ||
                      "No offence summary returned."
                    }
                  </p>

                </DetailBlock>


                <DetailBlock
                  label="CRIME CLUSTER"
                >

                  <strong>
                    {
                      node?.cluster ||
                      "Other Investigation"
                    }
                  </strong>

                </DetailBlock>


                <DetailBlock
                  label={
                    `CONNECTED ENTITIES · ${connectedEntities.length}`
                  }
                >

                  <ConnectedNodeList
                    nodes={
                      connectedEntities
                    }
                  />

                </DetailBlock>


                {
                  caseDatabaseId !==
                    null &&
                  (
                    <button
                      type="button"
                      className="cross-case-primary-action"
                      onClick={
                        () =>
                          navigate(
                            `/cases/${caseDatabaseId}`
                          )
                      }
                    >
                      Open Case Workspace
                    </button>
                  )
                }

              </>
            )
          : (
              <>

                <DetailBlock
                  label="CROSS-CASE ASSESSMENT"
                >

                  <p>
                    {
                      node?.is_bridge
                        ? `${getNodeLabel(node)} appears across ${node?.case_count || connectedCases.length} authorized investigations. Review each connection with its supporting records.`
                        : `${getNodeLabel(node)} is present in the indexed investigation network.`
                    }
                  </p>

                </DetailBlock>


                {
                  node
                    ?.normalized_value &&
                  (
                    <DetailBlock
                      label="NORMALIZED IDENTIFIER"
                    >

                      <strong className="cross-case-mono">
                        {
                          node
                            .normalized_value
                        }
                      </strong>

                    </DetailBlock>
                  )
                }


                <DetailBlock
                  label={
                    `LINKED CASES · ${connectedCases.length}`
                  }
                >

                  {
                    connectedCases.length
                      ? (
                          <div className="cross-case-linked-list">

                            {
                              connectedCases.map(
                                (
                                  caseNode
                                ) => {

                                  const id =
                                    getCaseDatabaseId(
                                      caseNode
                                    );

                                  return (
                                    <button
                                      key={
                                        caseNode.id
                                      }
                                      type="button"
                                      onClick={
                                        () =>
                                          id !==
                                            null &&
                                          navigate(
                                            `/cases/${id}`
                                          )
                                      }
                                    >

                                      <div>

                                        <strong>
                                          {
                                            getNodeLabel(
                                              caseNode
                                            )
                                          }
                                        </strong>

                                        <span>
                                          {
                                            caseNode
                                              ?.title ||
                                            caseNode
                                              ?.secondary_label ||
                                            "Investigation record"
                                          }
                                        </span>

                                      </div>

                                      <FileSearch
                                        size={14}
                                      />

                                    </button>
                                  );
                                }
                              )
                            }

                          </div>
                        )
                      : (
                          <div className="cross-case-no-records">
                            No linked FIR records returned.
                          </div>
                        )
                  }

                </DetailBlock>


                <DetailBlock
                  label={
                    `SUPPORTING EVIDENCE · ${evidence.length}`
                  }
                >

                  {
                    evidence.length
                      ? (
                          <div className="cross-case-evidence-list">

                            {
                              evidence
                                .slice(
                                  0,
                                  8
                                )
                                .map(
                                  (
                                    item,
                                    index
                                  ) => (

                                    <article
                                      key={
                                        item?.id ??
                                        item?.evidence_id ??
                                        index
                                      }
                                    >

                                      <FileSearch
                                        size={14}
                                      />

                                      <div>

                                        <strong>
                                          {
                                            item
                                              ?.evidence_id ||
                                            `Evidence ${index + 1}`
                                          }
                                        </strong>

                                        <span>
                                          {
                                            item?.title ||
                                            item
                                              ?.evidence_type ||
                                            item?.source ||
                                            "Supporting record"
                                          }
                                        </span>

                                      </div>

                                    </article>
                                  )
                                )
                            }

                          </div>
                        )
                      : (
                          <div className="cross-case-no-records">
                            No supporting evidence attached to these links.
                          </div>
                        )
                  }

                </DetailBlock>

              </>
            )
      }

    </div>
  );
}


function DetailBlock({
  label,
  children,
}) {
  return (
    <div className="cross-case-detail-section">

      <span>
        {label}
      </span>

      {children}

    </div>
  );
}


function ConnectedNodeList({
  nodes,
}) {
  if (!nodes.length) {
    return (
      <div className="cross-case-no-records">
        No connected entity records.
      </div>
    );
  }

  return (
    <div className="cross-case-entity-list">

      {
        nodes
          .slice(
            0,
            14
          )
          .map(
            (node) => {

              const type =
                getNodeType(
                  node
                );

              return (
                <article
                  key={
                    node.id
                  }
                >

                  <span
                    className={
                      `cross-case-mini-entity type-${type}`
                    }
                  >

                    <NodeIcon
                      type={
                        type
                      }
                      size={13}
                    />

                  </span>

                  <div>

                    <strong>
                      {
                        getNodeLabel(
                          node
                        )
                      }
                    </strong>

                    <small>
                      {
                        type
                          .replaceAll(
                            "_",
                            " "
                          )
                          .toUpperCase()
                      }
                    </small>

                  </div>

                </article>
              );
            }
          )
      }

    </div>
  );
}