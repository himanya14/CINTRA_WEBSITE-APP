import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import {
  BarChart3,
  Database,
  FileText,
  MapPinned,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

import AppHeader from "../../components/layout/AppHeader";
import "./IntelligenceDashboard.css";


const API_BASE_URL = "http://127.0.0.1:8000";

const MAP_WIDTH = 760;
const MAP_HEIGHT = 720;


// ============================================================
// AUTH
// ============================================================

function getToken() {
  return (
    localStorage.getItem("cintra_token") ||
    sessionStorage.getItem("cintra_token")
  );
}


function clearAuth() {
  localStorage.removeItem("cintra_token");
  localStorage.removeItem("cintra_officer");

  sessionStorage.removeItem("cintra_token");
  sessionStorage.removeItem("cintra_officer");
}


// ============================================================
// GENERAL HELPERS
// ============================================================

function toNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const cleaned = String(value)
    .replace(/,/g, "")
    .replace(/%/g, "")
    .trim();

  const number = Number(cleaned);

  return Number.isFinite(number)
    ? number
    : null;
}


function formatNumber(value, decimals = 0) {
  const number = toNumber(value);

  if (number === null) {
    return "—";
  }

  return number.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}


function formatPercent(value) {
  const number = toNumber(value);

  if (number === null) {
    return "—";
  }

  return `${number.toLocaleString("en-IN", {
    maximumFractionDigits: 1,
  })}%`;
}


// ============================================================
// STATE CRIME DATA
// ============================================================

function getStateName(record) {
  return record?.["State/UT"] || "—";
}


function getYearValue(record, year) {
  return toNumber(record?.[year]);
}


function getCrimeRate(record) {
  return toNumber(
    record?.[
      "Rate of Cognizable Crimes (IPC) (2022)"
    ]
  );
}


function getChargesheetRate(record) {
  return toNumber(
    record?.["Chargesheeting Rate (2022)"]
  );
}


function getPopulation(record) {
  return toNumber(
    record?.[
      "Mid-Year Projected Population (in Lakhs) (2022)"
    ]
  );
}


function getChange(record) {
  const first = getYearValue(
    record,
    "2020"
  );

  const last = getYearValue(
    record,
    "2022"
  );

  if (
    first === null ||
    last === null ||
    first === 0
  ) {
    return null;
  }

  return ((last - first) / first) * 100;
}


// ============================================================
// STATE NAME MATCHING
// ============================================================

function normalizeStateName(value) {
  let name = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[.,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const aliases = {
    "andaman and nicobar island":
      "andaman and nicobar islands",

    "nct of delhi":
      "delhi",

    "national capital territory of delhi":
      "delhi",

    "delhi nct":
      "delhi",

    orissa:
      "odisha",

    pondicherry:
      "puducherry",

    uttaranchal:
      "uttarakhand",

    "jammu kashmir":
      "jammu and kashmir",

    "dadra and nagar haveli":
      "dadra and nagar haveli and daman and diu",

    "daman and diu":
      "dadra and nagar haveli and daman and diu",
  };

  return aliases[name] || name;
}


// ============================================================
// GEOJSON HELPERS
// ============================================================

function getGeoStateName(feature) {
  return (
    feature?.properties?.ST_NM ||
    feature?.properties?.stname ||
    feature?.properties?.STNAME ||
    feature?.properties?.STATE ||
    feature?.properties?.state ||
    feature?.properties?.NAME ||
    feature?.properties?.name ||
    ""
  );
}


function collectPoints(
  coordinates,
  output
) {
  if (!Array.isArray(coordinates)) {
    return;
  }

  if (
    coordinates.length >= 2 &&
    typeof coordinates[0] === "number" &&
    typeof coordinates[1] === "number"
  ) {
    output.push([
      coordinates[0],
      coordinates[1],
    ]);

    return;
  }

  coordinates.forEach((item) => {
    collectPoints(item, output);
  });
}


function getBounds(features) {
  const points = [];

  features.forEach((feature) => {
    collectPoints(
      feature?.geometry?.coordinates,
      points
    );
  });

  if (!points.length) {
    return null;
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  points.forEach(([x, y]) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);

    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  });

  return {
    minX,
    maxX,
    minY,
    maxY,
  };
}


function projectPoint(
  longitude,
  latitude,
  bounds
) {
  if (!bounds) {
    return [0, 0];
  }

  const padding = 30;

  const longitudeRange =
    bounds.maxX - bounds.minX || 1;

  const latitudeRange =
    bounds.maxY - bounds.minY || 1;

  const availableWidth =
    MAP_WIDTH - padding * 2;

  const availableHeight =
    MAP_HEIGHT - padding * 2;

  const scale = Math.min(
    availableWidth / longitudeRange,
    availableHeight / latitudeRange
  );

  const drawnWidth =
    longitudeRange * scale;

  const drawnHeight =
    latitudeRange * scale;

  const offsetX =
    (MAP_WIDTH - drawnWidth) / 2;

  const offsetY =
    (MAP_HEIGHT - drawnHeight) / 2;

  const x =
    offsetX +
    (longitude - bounds.minX) * scale;

  const y =
    offsetY +
    (bounds.maxY - latitude) * scale;

  return [x, y];
}


function ringToPath(
  ring,
  bounds
) {
  if (
    !Array.isArray(ring) ||
    ring.length === 0
  ) {
    return "";
  }

  const commands = [];

  ring.forEach((point, index) => {
    if (
      !Array.isArray(point) ||
      point.length < 2
    ) {
      return;
    }

    const [x, y] = projectPoint(
      point[0],
      point[1],
      bounds
    );

    commands.push(
      `${index === 0 ? "M" : "L"} ${x} ${y}`
    );
  });

  if (!commands.length) {
    return "";
  }

  return `${commands.join(" ")} Z`;
}


function geometryToPath(
  geometry,
  bounds
) {
  if (!geometry) {
    return "";
  }

  if (geometry.type === "Polygon") {
    return geometry.coordinates
      .map((ring) =>
        ringToPath(
          ring,
          bounds
        )
      )
      .join(" ");
  }

  if (
    geometry.type === "MultiPolygon"
  ) {
    return geometry.coordinates
      .map((polygon) =>
        polygon
          .map((ring) =>
            ringToPath(
              ring,
              bounds
            )
          )
          .join(" ")
      )
      .join(" ");
  }

  return "";
}


// ============================================================
// MAP METRICS
// ============================================================

function getMetricValue(
  record,
  metric,
  year
) {
  if (!record) {
    return null;
  }

  if (metric === "crime-rate") {
    return getCrimeRate(record);
  }

  if (
    metric === "chargesheeting"
  ) {
    return getChargesheetRate(record);
  }

  return getYearValue(
    record,
    year
  );
}


function getMetricTitle(
  metric,
  year
) {
  if (metric === "crime-rate") {
    return "Crime Rate · 2022";
  }

  if (
    metric === "chargesheeting"
  ) {
    return "Chargesheeting Rate · 2022";
  }

  return `IPC Crimes · ${year}`;
}


function formatMetric(
  value,
  metric
) {
  if (value === null) {
    return "No data";
  }

  if (
    metric === "chargesheeting"
  ) {
    return formatPercent(value);
  }

  if (
    metric === "crime-rate"
  ) {
    return formatNumber(
      value,
      1
    );
  }

  return formatNumber(value);
}


function getFill(
  value,
  maximum
) {
  if (
    value === null ||
    maximum <= 0
  ) {
    return "#e6ebf0";
  }

  const ratio =
    value / maximum;

  if (ratio < 0.12) {
    return "#dceaf5";
  }

  if (ratio < 0.25) {
    return "#bfd8ea";
  }

  if (ratio < 0.4) {
    return "#96bdd8";
  }

  if (ratio < 0.6) {
    return "#6199c1";
  }

  if (ratio < 0.8) {
    return "#3376a7";
  }

  return "#124f7d";
}


// ============================================================
// CYBER DATA
// ============================================================

function findValue(
  record,
  words
) {
  if (!record) {
    return null;
  }

  const key =
    Object.keys(record).find(
      (currentKey) => {
        const lower =
          currentKey.toLowerCase();

        return words.every(
          (word) =>
            lower.includes(
              word.toLowerCase()
            )
        );
      }
    );

  if (!key) {
    return null;
  }

  return record[key];
}


function getCyberHead(record) {
  return (
    record?.["Crime Head"] ||
    record?.crime_head ||
    findValue(
      record,
      ["crime", "head"]
    ) ||
    "—"
  );
}


function getCyberReported(record) {
  return toNumber(
    record?.cases_reported ??
      findValue(
        record,
        ["cases", "reported"]
      )
  );
}


function getCyberInvestigation(
  record
) {
  return toNumber(
    record?.cases_for_investigation ??
      findValue(
        record,
        [
          "cases",
          "investigation",
        ]
      )
  );
}


function getCyberChargesheeted(
  record
) {
  return toNumber(
    record?.cases_chargesheeted ??
      findValue(
        record,
        ["charge", "sheet"]
      )
  );
}


function getCyberPending(record) {
  return toNumber(
    record?.cases_pending ??
      findValue(
        record,
        [
          "pending",
          "investigation",
        ]
      )
  );
}


// ============================================================
// DATASET METADATA
// ============================================================

function DatasetMetadata({
  data,
}) {
  return (
    <section className="dataset-metadata">
      <div className="dataset-metadata-icon">
        <ShieldCheck
          size={21}
        />
      </div>

      <div className="dataset-metadata-main">
        <span>
          DATA SOURCE
        </span>

        <strong>
          {data?.source || "—"}
        </strong>
      </div>

      <div className="dataset-metadata-item">
        <span>
          DATASET
        </span>

        <strong>
          {data?.dataset || "—"}
        </strong>
      </div>

      <div className="dataset-metadata-item">
        <span>
          DATA TYPE
        </span>

        <strong>
          {data?.data_type || "—"}
        </strong>
      </div>

      <div className="dataset-metadata-count">
        <span>
          RECORDS
        </span>

        <strong>
          {formatNumber(
            data?.count
          )}
        </strong>
      </div>
    </section>
  );
}


// ============================================================
// MAIN COMPONENT
// ============================================================

function IntelligenceDashboard() {
  const navigate = useNavigate();

  const [
    activeSection,
    setActiveSection,
  ] = useState("overview");

  /*
   * Keep complete API objects.
   *
   * We need source, dataset,
   * data_type, count AND records.
   */
  const [
    stateData,
    setStateData,
  ] = useState(null);

  const [
    cyberData,
    setCyberData,
  ] = useState(null);

  const [
    boundaries,
    setBoundaries,
  ] = useState([]);

  const [
    selectedYear,
    setSelectedYear,
  ] = useState("2022");

  const [
    selectedMetric,
    setSelectedMetric,
  ] = useState("crime-volume");

  const [
    selectedState,
    setSelectedState,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    mapError,
    setMapError,
  ] = useState("");


  const stateCrime =
    useMemo(
      () =>
        Array.isArray(
          stateData?.records
        )
          ? stateData.records
          : [],
      [stateData]
    );


  const cyberCrime =
    useMemo(
      () =>
        Array.isArray(
          cyberData?.records
        )
          ? cyberData.records
          : [],
      [cyberData]
    );


  // ==========================================================
  // API
  // ==========================================================

  const apiFetch =
    useCallback(
      async (path) => {
        const token =
          getToken();

        if (!token) {
          clearAuth();
          navigate("/");
          return null;
        }

        const response =
          await fetch(
            `${API_BASE_URL}${path}`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,

                Accept:
                  "application/json",
              },
            }
          );

        if (
          response.status === 401
        ) {
          clearAuth();
          navigate("/");
          return null;
        }

        return response;
      },
      [navigate]
    );


  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  const loadInitialData =
    useCallback(
      async () => {
        try {
          setLoading(true);
          setError("");
          setMapError("");

          const [
            stateResponse,
            cyberResponse,
            mapResponse,
          ] = await Promise.all([
            apiFetch(
              "/government-data/state-crime"
            ),

            apiFetch(
              "/government-data/cyber-crime"
            ),

            apiFetch(
              "/government-data/india-boundaries"
            ),
          ]);

          if (
            !stateResponse ||
            !cyberResponse ||
            !mapResponse
          ) {
            return;
          }

          if (
            !stateResponse.ok
          ) {
            throw new Error(
              "State crime data could not be loaded."
            );
          }

          if (
            !cyberResponse.ok
          ) {
            throw new Error(
              "Cyber crime data could not be loaded."
            );
          }

          const stateJson =
            await stateResponse.json();

          const cyberJson =
            await cyberResponse.json();

          setStateData(
            stateJson
          );

          setCyberData(
            cyberJson
          );

          if (
            Array.isArray(
              stateJson?.records
            ) &&
            stateJson.records.length
          ) {
            setSelectedState(
              getStateName(
                stateJson.records[0]
              )
            );
          }

          if (
            mapResponse.ok
          ) {
            const mapJson =
              await mapResponse.json();

            const features =
              mapJson?.geojson
                ?.features;

            if (
              Array.isArray(
                features
              )
            ) {
              setBoundaries(
                features
              );
            } else {
              setMapError(
                "Boundary file contains no map features."
              );
            }
          } else {
            setMapError(
              "India boundary geometry could not be loaded."
            );
          }
        } catch (err) {
          console.error(
            "Intelligence load error:",
            err
          );

          setError(
            err?.message ||
              "Unable to load intelligence data."
          );
        } finally {
          setLoading(false);
        }
      },
      [apiFetch]
    );


  // ==========================================================
  // REFRESH
  // ==========================================================

  const refreshStatistics =
    useCallback(
      async () => {
        try {
          setRefreshing(true);
          setError("");

          const [
            stateResponse,
            cyberResponse,
          ] = await Promise.all([
            apiFetch(
              "/government-data/state-crime"
            ),

            apiFetch(
              "/government-data/cyber-crime"
            ),
          ]);

          if (
            !stateResponse ||
            !cyberResponse
          ) {
            return;
          }

          if (
            !stateResponse.ok ||
            !cyberResponse.ok
          ) {
            throw new Error(
              "Government statistics could not be refreshed."
            );
          }

          const stateJson =
            await stateResponse.json();

          const cyberJson =
            await cyberResponse.json();

          setStateData(
            stateJson
          );

          setCyberData(
            cyberJson
          );
        } catch (err) {
          console.error(
            "Refresh error:",
            err
          );

          setError(
            err?.message ||
              "Unable to refresh government data."
          );
        } finally {
          setRefreshing(false);
        }
      },
      [apiFetch]
    );


  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);


  useEffect(() => {
    const timer =
      window.setInterval(
        refreshStatistics,
        60000
      );

    return () =>
      window.clearInterval(
        timer
      );
  }, [refreshStatistics]);


  // ==========================================================
  // STATE LOOKUP
  // ==========================================================

  const stateLookup =
    useMemo(() => {
      const lookup =
        new Map();

      stateCrime.forEach(
        (record) => {
          lookup.set(
            normalizeStateName(
              getStateName(
                record
              )
            ),
            record
          );
        }
      );

      return lookup;
    }, [stateCrime]);


  // ==========================================================
  // MAP
  // ==========================================================

  const mapItems =
    useMemo(() => {
      return boundaries.map(
        (feature, index) => {
          const mapName =
            getGeoStateName(
              feature
            );

          const normalized =
            normalizeStateName(
              mapName
            );

          return {
            id:
              feature?.properties
                ?.ST_ID ||
              feature?.properties
                ?.ID ||
              `${normalized}-${index}`,

            name:
              mapName,

            normalized,

            feature,

            record:
              stateLookup.get(
                normalized
              ) || null,
          };
        }
      );
    }, [
      boundaries,
      stateLookup,
    ]);


  const bounds =
    useMemo(
      () =>
        getBounds(
          boundaries
        ),
      [boundaries]
    );


  const maximumValue =
    useMemo(() => {
      const values =
        mapItems
          .map((item) =>
            getMetricValue(
              item.record,
              selectedMetric,
              selectedYear
            )
          )
          .filter(
            (value) =>
              value !== null
          );

      return values.length
        ? Math.max(
            ...values
          )
        : 0;
    }, [
      mapItems,
      selectedMetric,
      selectedYear,
    ]);


  const selectedRecord =
    useMemo(
      () =>
        stateLookup.get(
          normalizeStateName(
            selectedState
          )
        ) || null,
      [
        selectedState,
        stateLookup,
      ]
    );


  // ==========================================================
  // TOTALS
  // ==========================================================

  const totals =
    useMemo(() => {
      return stateCrime.reduce(
        (result, record) => {
          result["2020"] +=
            getYearValue(
              record,
              "2020"
            ) || 0;

          result["2021"] +=
            getYearValue(
              record,
              "2021"
            ) || 0;

          result["2022"] +=
            getYearValue(
              record,
              "2022"
            ) || 0;

          return result;
        },
        {
          "2020": 0,
          "2021": 0,
          "2022": 0,
        }
      );
    }, [stateCrime]);


  const rankedStates =
    useMemo(
      () =>
        [...stateCrime].sort(
          (a, b) =>
            (getYearValue(
              b,
              "2022"
            ) || 0) -
            (getYearValue(
              a,
              "2022"
            ) || 0)
        ),
      [stateCrime]
    );


  const cyberRows =
    useMemo(
      () =>
        [...cyberCrime].sort(
          (a, b) =>
            (getCyberReported(
              b
            ) || 0) -
            (getCyberReported(
              a
            ) || 0)
        ),
      [cyberCrime]
    );


  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <div className="intelligence-page">
        <AppHeader
          activePage="intelligence"
        />

        <div className="intelligence-loading">
          <RefreshCw
            size={25}
            className="spin"
          />

          <span>
            Loading government
            intelligence…
          </span>
        </div>
      </div>
    );
  }


  // ==========================================================
  // PAGE
  // ==========================================================

  return (
    <div className="intelligence-page">
      <AppHeader
        activePage="intelligence"
      />


      {/* CONTEXT BAR */}

      <div className="intelligence-context-bar">
        <div>
          <strong>
            Intelligence
          </strong>

          <span>
            Official aggregate crime
            context
          </span>
        </div>

        <button
          type="button"
          onClick={
            refreshStatistics
          }
          disabled={
            refreshing
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

          {refreshing
            ? "Refreshing"
            : "Refresh Data"}
        </button>
      </div>


      <div className="intelligence-shell">

        {/* SIDEBAR */}

        <aside className="intelligence-sidebar">
          <div className="intelligence-sidebar-title">
            <MapPinned
              size={18}
            />

            <span>
              INTELLIGENCE
            </span>
          </div>

          <button
            type="button"
            className={
              activeSection ===
              "overview"
                ? "active"
                : ""
            }
            onClick={() =>
              setActiveSection(
                "overview"
              )
            }
          >
            Overview
          </button>

          <div className="intelligence-sidebar-label">
            GOVERNMENT INTELLIGENCE
          </div>

          <button
            type="button"
            className={
              activeSection ===
              "state"
                ? "active"
                : ""
            }
            onClick={() =>
              setActiveSection(
                "state"
              )
            }
          >
            State Crime Overview
          </button>

          <button
            type="button"
            className={
              activeSection ===
              "cyber"
                ? "active"
                : ""
            }
            onClick={() =>
              setActiveSection(
                "cyber"
              )
            }
          >
            Cyber Crime Overview
          </button>

          <button
            type="button"
            className={
              activeSection ===
              "trends"
                ? "active"
                : ""
            }
            onClick={() =>
              setActiveSection(
                "trends"
              )
            }
          >
            Crime Trends
          </button>

          <div className="intelligence-source-note">
            <Database
              size={16}
            />

            <p>
              Government statistics
              provide contextual
              intelligence and remain
              separate from case
              evidence.
            </p>
          </div>
        </aside>


        {/* MAIN */}

        <main className="intelligence-main">

          {error && (
            <div className="intelligence-message">
              {error}
            </div>
          )}


          {/* =================================================
              OVERVIEW
          ================================================= */}

          {activeSection ===
            "overview" && (
            <>
              <section className="intelligence-heading">
                <div>
                  <span className="intelligence-eyebrow">
                    NATIONAL CONTEXT
                  </span>

                  <h1>
                    India Crime
                    Intelligence
                  </h1>

                  <p>
                    Interactive State
                    and Union Territory
                    view based on
                    official aggregate
                    NCRB statistics.
                  </p>
                </div>
              </section>


              <section className="intelligence-summary-grid">
                <article>
                  <span>
                    STATE / UT
                    RECORDS
                  </span>

                  <strong>
                    {formatNumber(
                      stateData?.count
                    )}
                  </strong>

                  <small>
                    Government dataset
                  </small>
                </article>

                <article>
                  <span>
                    IPC CRIMES · 2020
                  </span>

                  <strong>
                    {formatNumber(
                      totals["2020"]
                    )}
                  </strong>

                  <small>
                    NCRB aggregate
                  </small>
                </article>

                <article>
                  <span>
                    IPC CRIMES · 2021
                  </span>

                  <strong>
                    {formatNumber(
                      totals["2021"]
                    )}
                  </strong>

                  <small>
                    NCRB aggregate
                  </small>
                </article>

                <article>
                  <span>
                    IPC CRIMES · 2022
                  </span>

                  <strong>
                    {formatNumber(
                      totals["2022"]
                    )}
                  </strong>

                  <small>
                    NCRB aggregate
                  </small>
                </article>
              </section>


              <section className="india-map-panel">
                <header className="india-map-header">
                  <div>
                    <span className="intelligence-eyebrow">
                      INDIA-WIDE VIEW
                    </span>

                    <h2>
                      State Crime Map
                    </h2>

                    <p>
                      Select a region to
                      inspect its NCRB
                      statistics.
                    </p>
                  </div>

                  <div className="india-map-controls">
                    <label>
                      Metric

                      <select
                        value={
                          selectedMetric
                        }
                        onChange={(
                          event
                        ) =>
                          setSelectedMetric(
                            event
                              .target
                              .value
                          )
                        }
                      >
                        <option value="crime-volume">
                          IPC Crime Volume
                        </option>

                        <option value="crime-rate">
                          Crime Rate
                        </option>

                        <option value="chargesheeting">
                          Chargesheeting
                          Rate
                        </option>
                      </select>
                    </label>

                    {selectedMetric ===
                      "crime-volume" && (
                      <label>
                        Year

                        <select
                          value={
                            selectedYear
                          }
                          onChange={(
                            event
                          ) =>
                            setSelectedYear(
                              event
                                .target
                                .value
                            )
                          }
                        >
                          <option value="2020">
                            2020
                          </option>

                          <option value="2021">
                            2021
                          </option>

                          <option value="2022">
                            2022
                          </option>
                        </select>
                      </label>
                    )}
                  </div>
                </header>


                <div className="india-map-layout">

                  <div className="india-map-stage">
                    {mapError ? (
                      <div className="india-map-empty">
                        <MapPinned
                          size={32}
                        />

                        <strong>
                          Map unavailable
                        </strong>

                        <span>
                          {mapError}
                        </span>
                      </div>
                    ) : (
                      <svg
                        className="india-map-svg"
                        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                        preserveAspectRatio="xMidYMid meet"
                      >
                        {mapItems.map(
                          (item) => {
                            const value =
                              getMetricValue(
                                item.record,
                                selectedMetric,
                                selectedYear
                              );

                            const path =
                              geometryToPath(
                                item.feature
                                  ?.geometry,
                                bounds
                              );

                            const selected =
                              normalizeStateName(
                                selectedState
                              ) ===
                              item.normalized;

                            return (
                              <path
                                key={
                                  item.id
                                }
                                d={
                                  path
                                }
                                fill={getFill(
                                  value,
                                  maximumValue
                                )}
                                stroke={
                                  selected
                                    ? "#d4a72c"
                                    : "#ffffff"
                                }
                                strokeWidth={
                                  selected
                                    ? "2.6"
                                    : "1"
                                }
                                className={`india-state-shape ${
                                  selected
                                    ? "selected"
                                    : ""
                                }`}
                                onClick={() =>
                                  setSelectedState(
                                    item.record
                                      ? getStateName(
                                          item.record
                                        )
                                      : item.name
                                  )
                                }
                              >
                                <title>
                                  {item.name}
                                  {" — "}
                                  {formatMetric(
                                    value,
                                    selectedMetric
                                  )}
                                </title>
                              </path>
                            );
                          }
                        )}
                      </svg>
                    )}

                    {!mapError &&
                      mapItems.length >
                        0 && (
                        <div className="india-map-legend">
                          <span>
                            Lower
                          </span>

                          <div className="india-map-gradient" />

                          <span>
                            Higher
                          </span>
                        </div>
                      )}
                  </div>


                  <aside className="india-state-inspector">
                    <span className="intelligence-eyebrow">
                      SELECTED REGION
                    </span>

                    <h3>
                      {selectedState ||
                        "Select a State / UT"}
                    </h3>

                    {selectedRecord ? (
                      <>
                        <div className="india-state-primary-value">
                          <span>
                            {getMetricTitle(
                              selectedMetric,
                              selectedYear
                            )}
                          </span>

                          <strong>
                            {formatMetric(
                              getMetricValue(
                                selectedRecord,
                                selectedMetric,
                                selectedYear
                              ),
                              selectedMetric
                            )}
                          </strong>
                        </div>

                        <dl className="india-state-details">
                          <div>
                            <dt>
                              IPC Crimes
                              2020
                            </dt>

                            <dd>
                              {formatNumber(
                                getYearValue(
                                  selectedRecord,
                                  "2020"
                                )
                              )}
                            </dd>
                          </div>

                          <div>
                            <dt>
                              IPC Crimes
                              2021
                            </dt>

                            <dd>
                              {formatNumber(
                                getYearValue(
                                  selectedRecord,
                                  "2021"
                                )
                              )}
                            </dd>
                          </div>

                          <div>
                            <dt>
                              IPC Crimes
                              2022
                            </dt>

                            <dd>
                              {formatNumber(
                                getYearValue(
                                  selectedRecord,
                                  "2022"
                                )
                              )}
                            </dd>
                          </div>

                          <div>
                            <dt>
                              Crime Rate
                            </dt>

                            <dd>
                              {formatNumber(
                                getCrimeRate(
                                  selectedRecord
                                ),
                                1
                              )}
                            </dd>
                          </div>

                          <div>
                            <dt>
                              Chargesheeting
                            </dt>

                            <dd>
                              {formatPercent(
                                getChargesheetRate(
                                  selectedRecord
                                )
                              )}
                            </dd>
                          </div>

                          <div>
                            <dt>
                              Population
                              (Lakhs)
                            </dt>

                            <dd>
                              {formatNumber(
                                getPopulation(
                                  selectedRecord
                                ),
                                1
                              )}
                            </dd>
                          </div>
                        </dl>
                      </>
                    ) : (
                      <p className="india-state-no-data">
                        No matching NCRB
                        record is
                        available for
                        this region.
                      </p>
                    )}
                  </aside>
                </div>
              </section>


              <section className="intelligence-panel">
                <header>
                  <div>
                    <span className="intelligence-eyebrow">
                      NATIONAL
                      COMPARISON · 2022
                    </span>

                    <h2>
                      Highest IPC Crime
                      Volume
                    </h2>
                  </div>

                  <BarChart3
                    size={20}
                  />
                </header>

                <div className="intelligence-ranking-list">
                  {rankedStates
                    .slice(0, 8)
                    .map(
                      (
                        record,
                        index
                      ) => (
                        <div
                          className="intelligence-ranking-row"
                          key={`${getStateName(
                            record
                          )}-${index}`}
                        >
                          <span className="ranking-number">
                            {String(
                              index + 1
                            ).padStart(
                              2,
                              "0"
                            )}
                          </span>

                          <strong>
                            {getStateName(
                              record
                            )}
                          </strong>

                          <span>
                            {formatNumber(
                              getYearValue(
                                record,
                                "2022"
                              )
                            )}
                          </span>
                        </div>
                      )
                    )}
                </div>
              </section>
            </>
          )}


          {/* =================================================
              STATE CRIME
          ================================================= */}

          {activeSection ===
            "state" && (
            <>
              <section className="intelligence-heading">
                <div>
                  <span className="intelligence-eyebrow">
                    GOVERNMENT
                    INTELLIGENCE
                  </span>

                  <h1>
                    State Crime
                    Overview
                  </h1>

                  <p>
                    Official State and
                    Union Territory-wise
                    IPC crime statistics
                    available to CINTRA
                    for contextual
                    analysis.
                  </p>
                </div>
              </section>


              <DatasetMetadata
                data={
                  stateData
                }
              />


              <section className="intelligence-panel intelligence-table-panel">
                <header>
                  <div>
                    <span className="intelligence-eyebrow">
                      OFFICIAL
                      AGGREGATE RECORDS
                    </span>

                    <h2>
                      State / UT Crime
                      Statistics
                    </h2>
                  </div>

                  <Database
                    size={20}
                  />
                </header>

                <div className="intelligence-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>
                          State / UT
                        </th>

                        <th>
                          2020
                        </th>

                        <th>
                          2021
                        </th>

                        <th>
                          2022
                        </th>

                        <th>
                          2020–22 Change
                        </th>

                        <th>
                          Population
                          (Lakhs)
                        </th>

                        <th>
                          Crime Rate
                          2022
                        </th>

                        <th>
                          Chargesheeting
                          2022
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {stateCrime.map(
                        (
                          record,
                          index
                        ) => {
                          const change =
                            getChange(
                              record
                            );

                          return (
                            <tr
                              key={`${getStateName(
                                record
                              )}-${index}`}
                            >
                              <td>
                                <strong>
                                  {getStateName(
                                    record
                                  )}
                                </strong>
                              </td>

                              <td>
                                {formatNumber(
                                  getYearValue(
                                    record,
                                    "2020"
                                  )
                                )}
                              </td>

                              <td>
                                {formatNumber(
                                  getYearValue(
                                    record,
                                    "2021"
                                  )
                                )}
                              </td>

                              <td>
                                {formatNumber(
                                  getYearValue(
                                    record,
                                    "2022"
                                  )
                                )}
                              </td>

                              <td>
                                {change ===
                                null
                                  ? "—"
                                  : `${change >=
                                    0
                                      ? "+"
                                      : ""}${change.toFixed(
                                      1
                                    )}%`}
                              </td>

                              <td>
                                {formatNumber(
                                  getPopulation(
                                    record
                                  ),
                                  1
                                )}
                              </td>

                              <td>
                                {formatNumber(
                                  getCrimeRate(
                                    record
                                  ),
                                  1
                                )}
                              </td>

                              <td>
                                {formatPercent(
                                  getChargesheetRate(
                                    record
                                  )
                                )}
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              </section>


              <div className="government-data-disclaimer">
                <FileText
                  size={17}
                />

                <p>
                  This dataset provides
                  aggregate contextual
                  statistics. It is not
                  treated as case
                  evidence and does not
                  establish an
                  investigative
                  relationship with any
                  person or case.
                </p>
              </div>
            </>
          )}


          {/* =================================================
              CYBER CRIME
          ================================================= */}

          {activeSection ===
            "cyber" && (
            <>
              <section className="intelligence-heading">
                <div>
                  <span className="intelligence-eyebrow">
                    GOVERNMENT
                    INTELLIGENCE
                  </span>

                  <h1>
                    Cyber Crime
                    Overview
                  </h1>

                  <p>
                    Official
                    crime-head-wise
                    police disposal
                    statistics used as
                    contextual
                    intelligence.
                  </p>
                </div>
              </section>


              <DatasetMetadata
                data={
                  cyberData
                }
              />


              <section className="intelligence-panel intelligence-table-panel">
                <header>
                  <div>
                    <span className="intelligence-eyebrow">
                      OFFICIAL
                      AGGREGATE RECORDS
                    </span>

                    <h2>
                      Cyber Crime
                      Police Disposal
                    </h2>
                  </div>

                  <Database
                    size={20}
                  />
                </header>

                <div className="intelligence-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>
                          Crime Head
                        </th>

                        <th>
                          Cases Reported
                        </th>

                        <th>
                          For
                          Investigation
                        </th>

                        <th>
                          Chargesheeted
                        </th>

                        <th>
                          Pending
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {cyberRows.map(
                        (
                          record,
                          index
                        ) => (
                          <tr
                            key={`${getCyberHead(
                              record
                            )}-${index}`}
                          >
                            <td>
                              <strong>
                                {getCyberHead(
                                  record
                                )}
                              </strong>
                            </td>

                            <td>
                              {formatNumber(
                                getCyberReported(
                                  record
                                )
                              )}
                            </td>

                            <td>
                              {formatNumber(
                                getCyberInvestigation(
                                  record
                                )
                              )}
                            </td>

                            <td>
                              {formatNumber(
                                getCyberChargesheeted(
                                  record
                                )
                              )}
                            </td>

                            <td>
                              {formatNumber(
                                getCyberPending(
                                  record
                                )
                              )}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </section>


              <div className="government-data-disclaimer">
                <FileText
                  size={17}
                />

                <p>
                  Cyber crime
                  statistics shown
                  here are aggregate
                  government records
                  for contextual
                  intelligence and
                  remain separate from
                  case-specific
                  evidence.
                </p>
              </div>
            </>
          )}


          {/* =================================================
              CRIME TRENDS
          ================================================= */}

          {activeSection ===
            "trends" && (
            <>
              <section className="intelligence-heading">
                <div>
                  <span className="intelligence-eyebrow">
                    GOVERNMENT
                    INTELLIGENCE
                  </span>

                  <h1>
                    Crime Trends
                  </h1>

                  <p>
                    Comparative
                    three-year trend
                    analysis calculated
                    directly from the
                    State / UT
                    government
                    dataset.
                  </p>
                </div>
              </section>


              <DatasetMetadata
                data={
                  stateData
                }
              />


              <section className="crime-trend-overview">
                <article>
                  <span>
                    2020
                  </span>

                  <strong>
                    {formatNumber(
                      totals["2020"]
                    )}
                  </strong>

                  <small>
                    Total IPC crimes
                  </small>
                </article>

                <div className="crime-trend-connector">
                  →
                </div>

                <article>
                  <span>
                    2021
                  </span>

                  <strong>
                    {formatNumber(
                      totals["2021"]
                    )}
                  </strong>

                  <small>
                    Total IPC crimes
                  </small>
                </article>

                <div className="crime-trend-connector">
                  →
                </div>

                <article>
                  <span>
                    2022
                  </span>

                  <strong>
                    {formatNumber(
                      totals["2022"]
                    )}
                  </strong>

                  <small>
                    Total IPC crimes
                  </small>
                </article>
              </section>


              <section className="intelligence-panel intelligence-table-panel">
                <header>
                  <div>
                    <span className="intelligence-eyebrow">
                      2020–2022
                      COMPARISON
                    </span>

                    <h2>
                      State / UT Trend
                      Analysis
                    </h2>
                  </div>

                  <TrendingUp
                    size={20}
                  />
                </header>

                <div className="intelligence-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>
                          State / UT
                        </th>

                        <th>
                          2020
                        </th>

                        <th>
                          2021
                        </th>

                        <th>
                          2022
                        </th>

                        <th>
                          2020–22 Change
                        </th>

                        <th>
                          Direction
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {stateCrime.map(
                        (
                          record,
                          index
                        ) => {
                          const change =
                            getChange(
                              record
                            );

                          let direction =
                            "—";

                          if (
                            change !==
                            null
                          ) {
                            if (
                              change > 0
                            ) {
                              direction =
                                "Increase";
                            } else if (
                              change < 0
                            ) {
                              direction =
                                "Decrease";
                            } else {
                              direction =
                                "No change";
                            }
                          }

                          return (
                            <tr
                              key={`${getStateName(
                                record
                              )}-${index}`}
                            >
                              <td>
                                <strong>
                                  {getStateName(
                                    record
                                  )}
                                </strong>
                              </td>

                              <td>
                                {formatNumber(
                                  getYearValue(
                                    record,
                                    "2020"
                                  )
                                )}
                              </td>

                              <td>
                                {formatNumber(
                                  getYearValue(
                                    record,
                                    "2021"
                                  )
                                )}
                              </td>

                              <td>
                                {formatNumber(
                                  getYearValue(
                                    record,
                                    "2022"
                                  )
                                )}
                              </td>

                              <td>
                                {change ===
                                null
                                  ? "—"
                                  : `${change >=
                                    0
                                      ? "+"
                                      : ""}${change.toFixed(
                                      1
                                    )}%`}
                              </td>

                              <td>
                                {direction}
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              </section>


              <div className="government-data-disclaimer">
                <TrendingUp
                  size={17}
                />

                <p>
                  Trend values are
                  calculated from the
                  years contained in
                  the referenced
                  government dataset.
                  They represent
                  aggregate historical
                  context rather than
                  predictions of
                  individual criminal
                  activity.
                </p>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}


export default IntelligenceDashboard;