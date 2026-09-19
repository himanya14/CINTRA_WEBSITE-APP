import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertCircle,
  ArrowRight,
  Bookmark,
  BookmarkPlus,
  ChevronRight,
  FileText,
  FolderOpen,
  History,
  Info,
  MapPin,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

import AppHeader from "../../components/layout/AppHeader";
import "./AdvancedSearch.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000";

const SAVED_SEARCHES_KEY =
  "cintra_saved_searches";

const RECENT_SEARCHES_KEY =
  "cintra_recent_searches";

/* =========================================================
   AUTH
   ========================================================= */

function getToken() {
  return (
    localStorage.getItem("cintra_token") ||
    sessionStorage.getItem("cintra_token")
  );
}

function getStoredOfficer() {
  const raw =
    localStorage.getItem("cintra_officer") ||
    sessionStorage.getItem("cintra_officer");

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
  localStorage.removeItem("cintra_token");
  localStorage.removeItem("cintra_officer");

  sessionStorage.removeItem("cintra_token");
  sessionStorage.removeItem("cintra_officer");
}

/* =========================================================
   STORAGE
   ========================================================= */

function readStoredList(key) {
  try {
    const raw = localStorage.getItem(key);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function writeStoredList(
  key,
  value
) {
  localStorage.setItem(
    key,
    JSON.stringify(value)
  );
}

/* =========================================================
   HELPERS
   ========================================================= */

function normalizeArray(
  result,
  keys = []
) {
  if (Array.isArray(result)) {
    return result;
  }

  for (const key of keys) {
    if (
      Array.isArray(
        result?.[key]
      )
    ) {
      return result[key];
    }
  }

  return [];
}

function normalizeId(value) {
  return String(
    value ?? ""
  )
    .trim()
    .toLowerCase();
}

function dedupeById(records) {
  const map = new Map();

  records.forEach((item) => {
    const key =
      item?.id ??
      item?.case_id ??
      item?.person_id ??
      item?.evidence_id;

    if (
      key !== undefined &&
      key !== null
    ) {
      map.set(
        String(key),
        item
      );
    }
  });

  return [...map.values()];
}

function getCaseTitle(item) {
  return (
    item?.title ||
    item?.case_title ||
    "Investigation Case"
  );
}

function getCaseReference(item) {
  return (
    item?.case_id ||
    `Case ${item?.id || ""}`
  );
}

function getFirNumber(item) {
  return (
    item?.fir_number ||
    item?.fir_no ||
    "—"
  );
}

function getPersonName(person) {
  return (
    person?.name ||
    person?.full_name ||
    "Unnamed Person"
  );
}

function getPersonReference(person) {
  return (
    person?.person_id ||
    `Person ${person?.id || ""}`
  );
}

function getEvidenceTitle(item) {
  return (
    item?.title ||
    item?.evidence_name ||
    item?.evidence_type ||
    "Evidence Record"
  );
}

function getEvidenceReference(item) {
  return (
    item?.evidence_id ||
    `Evidence ${item?.id || ""}`
  );
}

function getLocationValue(item) {
  return (
    item?.location ||
    item?.address ||
    item?.police_station ||
    item?.place ||
    item?.city ||
    item?.district ||
    item?.state ||
    "—"
  );
}

/* =========================================================
   MAIN COMPONENT
   ========================================================= */

function AdvancedSearch() {
  const navigate = useNavigate();

  const [
    sidebarMode,
    setSidebarMode,
  ] = useState("search");

  const [
    query,
    setQuery,
  ] = useState("");

  const [
    searchedQuery,
    setSearchedQuery,
  ] = useState("");

  const [
    searchType,
    setSearchType,
  ] = useState("all");

  const [
    activeTab,
    setActiveTab,
  ] = useState("overview");

  const [
    cases,
    setCases,
  ] = useState([]);

  const [
    persons,
    setPersons,
  ] = useState([]);

  const [
    evidence,
    setEvidence,
  ] = useState([]);

  const [
    identifiers,
    setIdentifiers,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    hasSearched,
    setHasSearched,
  ] = useState(false);

  const [
    savedSearches,
    setSavedSearches,
  ] = useState([]);

  const [
    recentSearches,
    setRecentSearches,
  ] = useState([]);

  /* =======================================================
     LOAD LOCAL SEARCH DATA
     ======================================================= */

  useEffect(() => {
    setSavedSearches(
      readStoredList(
        SAVED_SEARCHES_KEY
      )
    );

    setRecentSearches(
      readStoredList(
        RECENT_SEARCHES_KEY
      )
    );
  }, []);

  /* =======================================================
     DERIVED DATA
     ======================================================= */

  const totalResults =
    persons.length +
    cases.length +
    evidence.length +
    identifiers.length;

  const primaryPerson =
    persons[0] || null;

  const visiblePersons =
    useMemo(
      () =>
        persons.slice(0, 5),
      [persons]
    );

  const visibleCases =
    useMemo(
      () =>
        cases.slice(0, 5),
      [cases]
    );

  const visibleEvidence =
    useMemo(
      () =>
        evidence.slice(0, 6),
      [evidence]
    );

  /* =======================================================
     AUTHENTICATED FETCH
     ======================================================= */

  async function authenticatedFetch(
    endpoint,
    options = {}
  ) {
    const token = getToken();

    if (!token) {
      navigate("/", {
        replace: true,
      });

      return null;
    }

    const response = await fetch(
      `${API_BASE_URL}${endpoint}`,
      {
        ...options,

        headers: {
          Accept:
            "application/json",

          Authorization:
            `Bearer ${token}`,

          ...(options.headers ||
            {}),
        },
      }
    );

    if (response.status === 401) {
      clearStoredAuth();

      navigate("/", {
        replace: true,
      });

      return null;
    }

    return response;
  }

  /* =======================================================
     CORE SEARCH
     ======================================================= */

  async function fetchSearch(
    searchTerm
  ) {
    const response =
      await authenticatedFetch(
        `/search/?q=${encodeURIComponent(
          searchTerm
        )}`
      );

    if (!response) {
      return null;
    }

    let data = {};

    try {
      data =
        await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      throw new Error(
        data?.detail ||
          "Search could not be completed."
      );
    }

    return {
      query:
        data?.query ||
        searchTerm,

      persons:
        normalizeArray(
          data?.persons
        ),

      cases:
        normalizeArray(
          data?.cases
        ),

      evidence:
        normalizeArray(
          data?.evidence
        ),
    };
  }

  /* =======================================================
     LINKED CASE + EVIDENCE RESOLUTION
     ======================================================= */

  async function resolveLinkedRecords(
    matchedPersons,
    directCases,
    directEvidence
  ) {
    if (
      matchedPersons.length === 0
    ) {
      return {
        cases:
          directCases,

        evidence:
          directEvidence,
      };
    }

    try {
      const officer =
        getStoredOfficer();

      const casesEndpoint =
        officer?.system_role ===
        "FORENSIC_ANALYST"
          ? "/forensics/cases"
          : "/cases/";

      const casesResponse =
        await authenticatedFetch(
          casesEndpoint
        );

      if (
        !casesResponse ||
        !casesResponse.ok
      ) {
        return {
          cases:
            directCases,

          evidence:
            directEvidence,
        };
      }

      const caseResult =
        await casesResponse.json();

      const allCases =
        normalizeArray(
          caseResult,
          [
            "cases",
            "records",
          ]
        );

      const matchedPersonIds =
        new Set();

      matchedPersons.forEach(
        (person) => {
          if (
            person?.id !==
            undefined
          ) {
            matchedPersonIds.add(
              normalizeId(
                person.id
              )
            );
          }

          if (
            person?.person_id
          ) {
            matchedPersonIds.add(
              normalizeId(
                person.person_id
              )
            );
          }
        }
      );

      const discoveredCases =
        [];

      await Promise.all(
        allCases.map(
          async (caseItem) => {
            if (!caseItem?.id) {
              return;
            }

            try {
              const response =
                await authenticatedFetch(
                  `/persons/case/${caseItem.id}`
                );

              if (
                !response ||
                !response.ok
              ) {
                return;
              }

              const result =
                await response.json();

              const casePersons =
                normalizeArray(
                  result,
                  [
                    "persons",
                    "records",
                  ]
                );

              const matches =
                casePersons.some(
                  (person) => {
                    const values =
                      [
                        person?.id,
                        person?.person_id,
                      ]
                        .filter(
                          (value) =>
                            value !==
                              undefined &&
                            value !==
                              null
                        )
                        .map(
                          normalizeId
                        );

                    return values.some(
                      (value) =>
                        matchedPersonIds.has(
                          value
                        )
                    );
                  }
                );

              if (matches) {
                discoveredCases.push(
                  caseItem
                );
              }
            } catch {
              // Optional enrichment only
            }
          }
        )
      );

      const mergedCases =
        dedupeById([
          ...directCases,
          ...discoveredCases,
        ]);

      const discoveredEvidence =
        [];

      await Promise.all(
        mergedCases.map(
          async (caseItem) => {
            if (!caseItem?.id) {
              return;
            }

            try {
              const response =
                await authenticatedFetch(
                  `/evidence/case/${caseItem.id}`
                );

              if (
                !response ||
                !response.ok
              ) {
                return;
              }

              const result =
                await response.json();

              const records =
                normalizeArray(
                  result,
                  [
                    "evidence",
                    "records",
                  ]
                );

              discoveredEvidence.push(
                ...records
              );
            } catch {
              // Optional enrichment only
            }
          }
        )
      );

      return {
        cases:
          mergedCases,

        evidence:
          dedupeById([
            ...directEvidence,
            ...discoveredEvidence,
          ]),
      };
    } catch (error) {
      console.error(
        "Linked record resolution error:",
        error
      );

      return {
        cases:
          directCases,

        evidence:
          directEvidence,
      };
    }
  }

  /* =======================================================
     SEARCH HISTORY
     ======================================================= */

  function addRecentSearch(
    value,
    type = searchType
  ) {
    const cleaned =
      value.trim();

    if (!cleaned) {
      return;
    }

    const next = [
      {
        id:
          `${Date.now()}-${cleaned}`,

        query:
          cleaned,

        type,

        searched_at:
          new Date()
            .toISOString(),
      },

      ...recentSearches.filter(
        (item) =>
          normalizeId(
            item.query
          ) !==
          normalizeId(
            cleaned
          )
      ),
    ].slice(0, 10);

    setRecentSearches(next);

    writeStoredList(
      RECENT_SEARCHES_KEY,
      next
    );
  }

  /* =======================================================
     APPLY RESULTS
     ======================================================= */

  async function applySearchResult(
    result,
    options = {}
  ) {
    const {
      addRecent = true,
      type = searchType,
    } = options;

    const directPersons =
      result?.persons || [];

    const directCases =
      result?.cases || [];

    const directEvidence =
      result?.evidence || [];

    const linked =
      await resolveLinkedRecords(
        directPersons,
        directCases,
        directEvidence
      );

    setPersons(
      dedupeById(
        directPersons
      )
    );

    setCases(
      dedupeById(
        linked.cases
      )
    );

    setEvidence(
      dedupeById(
        linked.evidence
      )
    );

    setIdentifiers(
      Array.isArray(result?.identifiers)
        ? result.identifiers
        : []
    );

    setSearchedQuery(
      result?.query ||
        query.trim()
    );

    setActiveTab("overview");

    setHasSearched(true);

    if (addRecent) {
      addRecentSearch(
        result?.query ||
          query.trim(),
        type
      );
    }
  }

  /* =======================================================
     NORMAL SEARCH
     ======================================================= */

  async function performSearch(
    event
  ) {
    if (event) {
      event.preventDefault();
    }

    const cleanQuery =
      query.trim();

    setMessage("");

    if (!cleanQuery) {
      setMessage(
        "Enter a search term."
      );

      return;
    }

    try {
      setLoading(true);

      const result =
        await fetchSearch(
          cleanQuery
        );

      if (!result) {
        return;
      }

      await applySearchResult(
        result,
        {
          type:
            searchType,
        }
      );

      setSidebarMode(
        "search"
      );
    } catch (error) {
      console.error(
        "CINTRA search error:",
        error
      );

      setPersons([]);
      setCases([]);
      setEvidence([]);
      setIdentifiers([]);

      setHasSearched(true);

      setMessage(
        error?.message ||
          "Unable to connect to CINTRA search."
      );
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     SAVED / RECENT
     ======================================================= */

  async function runStoredSearch(
    item
  ) {
    const searchValue =
      typeof item === "string"
        ? item
        : item.query;

    const storedType =
      typeof item === "string"
        ? "all"
        : item.type ||
          "all";

    setQuery(searchValue);
    setSearchType(
      storedType
    );

    setSidebarMode(
      "search"
    );

    setMessage("");

    try {
      setLoading(true);

      const result =
        await fetchSearch(
          searchValue
        );

      if (!result) {
        return;
      }

      await applySearchResult(
        result,
        {
          type:
            storedType,
        }
      );
    } catch (error) {
      setMessage(
        error?.message ||
          "Search could not be completed."
      );
    } finally {
      setLoading(false);
    }
  }

  function saveCurrentSearch() {
    const value =
      searchedQuery ||
      query.trim();

    if (!value) {
      return;
    }

    const duplicate =
      savedSearches.some(
        (item) =>
          normalizeId(
            item.query
          ) ===
            normalizeId(
              value
            ) &&
          item.type ===
            searchType
      );

    if (duplicate) {
      setMessage(
        "This search is already saved."
      );

      return;
    }

    const next = [
      {
        id:
          `${Date.now()}-${value}`,

        query:
          value,

        type:
          searchType,

        saved_at:
          new Date()
            .toISOString(),
      },

      ...savedSearches,
    ];

    setSavedSearches(next);

    writeStoredList(
      SAVED_SEARCHES_KEY,
      next
    );

    setMessage("");
  }

  function deleteSavedSearch(
    id
  ) {
    const next =
      savedSearches.filter(
        (item) =>
          item.id !== id
      );

    setSavedSearches(next);

    writeStoredList(
      SAVED_SEARCHES_KEY,
      next
    );
  }

  function clearRecentSearches() {
    setRecentSearches([]);

    writeStoredList(
      RECENT_SEARCHES_KEY,
      []
    );
  }

  /* =======================================================
     CLEAR
     ======================================================= */

  function clearSearch() {
    setQuery("");
    setSearchedQuery("");

    setPersons([]);
    setCases([]);
    setEvidence([]);
      setIdentifiers([]);

    setMessage("");
    setHasSearched(false);

    setSearchType("all");
    setActiveTab("overview");
  }

  /* =======================================================
     NAVIGATION
     ======================================================= */

  function openPerson(person) {
    if (!person?.id) {
      return;
    }

    const officer =
      getStoredOfficer();

    if (
      officer?.system_role ===
      "FORENSIC_ANALYST"
    ) {
      const linkedCase =
        cases[0] || null;

      if (linkedCase?.id) {
        navigate(
          `/forensic/relationships/${linkedCase.id}`
        );
      } else {
        setMessage(
          "Person details are available through an assigned forensic case."
        );
      }

      return;
    }

    navigate(
      `/persons?personId=${encodeURIComponent(
        person.id
      )}`
    );
  }

  function openCase(item) {
    if (!item?.id) {
      return;
    }

    const officer =
      getStoredOfficer();

    if (
      officer?.system_role ===
      "FORENSIC_ANALYST"
    ) {
      navigate(
        `/forensic/relationships/${item.id}`
      );

      return;
    }

    navigate(
      `/cases/${item.id}`
    );
  }

  function openEvidence(item) {
    if (!item?.case_id) {
      return;
    }

    const officer =
      getStoredOfficer();

    if (
      officer?.system_role ===
      "FORENSIC_ANALYST"
    ) {
      navigate(
        `/forensic/digital-forensics?case=${encodeURIComponent(
          item.case_id
        )}&evidence=${encodeURIComponent(
          item.id ?? ""
        )}`
      );

      return;
    }

    navigate(
      `/cases/${item.case_id}/evidence`
    );
  }

  function selectType(type) {
    setSearchType(type);

    if (type === "person") {
      setActiveTab("persons");
    } else if (
      type === "case"
    ) {
      setActiveTab("cases");
    } else if (
      type === "evidence"
    ) {
      setActiveTab("evidence");
    } else {
      setActiveTab("overview");
    }
  }

  function getSearchPlaceholder() {
    switch (searchType) {
      case "person":
        return "Search person name or person ID";

      case "case":
        return "Search case ID, FIR number, title or offence";

      case "evidence":
        return "Search evidence ID, title, type or source";

      case "location":
        return "Search location, address, district, city or police station";

      default:
        return "Search person, FIR, case, offence, evidence or location";
    }
  }

  /* =======================================================
     PAGE
     ======================================================= */

  return (
    <div className="search-page">

      <AppHeader
        activePage="search"
      />

      {/* TOP CONTEXT */}

      <div className="search-top-context">

        <div>
          <span>
            Search
          </span>

          <ChevronRight
            size={15}
          />

          <strong>
            {sidebarMode ===
            "saved"
              ? "Saved Searches"
              : sidebarMode ===
                  "recent"
                ? "Recent Searches"
                : "Advanced Search"}
          </strong>
        </div>

        <span className="search-index-label">
          Central Investigation Index
        </span>

      </div>

      <div className="search-body">

        {/* =================================================
            SIDEBAR
            ================================================= */}

        <aside className="search-sidebar">

          <div className="search-side-menu">

            <button
              type="button"
              className={
                sidebarMode ===
                "search"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setSidebarMode(
                  "search"
                )
              }
            >
              <Search size={20} />

              <span>
                Advanced Search
              </span>
            </button>

            <button
              type="button"
              className={
                sidebarMode ===
                "saved"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setSidebarMode(
                  "saved"
                )
              }
            >
              <Bookmark
                size={20}
              />

              <span>
                Saved Searches
              </span>

              {savedSearches.length >
                0 && (
                <small>
                  {
                    savedSearches.length
                  }
                </small>
              )}
            </button>

            <button
              type="button"
              className={
                sidebarMode ===
                "recent"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setSidebarMode(
                  "recent"
                )
              }
            >
              <History
                size={20}
              />

              <span>
                Recent Searches
              </span>
            </button>

          </div>

          <div className="search-tips-box">

            <div className="search-tips-heading">

              <Info size={19} />

              <strong>
                Search Tips
              </strong>

            </div>

            <p>
              Search across records
              currently indexed by
              CINTRA.
            </p>

            <ul>
              <li>
                Person name / ID
              </li>

              <li>
                FIR number
              </li>

              <li>
                Case ID / title
              </li>

              <li>
                Offence
              </li>

              <li>
                Evidence ID / title
              </li>

              <li>
                Address
              </li>

              <li>
                Location / district
              </li>

              <li>
                Police station
              </li>
            </ul>

          </div>

        </aside>

        {/* =================================================
            MAIN
            ================================================= */}

        <main className="search-main">

          {/* SAVED SEARCHES */}

          {sidebarMode ===
            "saved" && (
            <SearchLibraryPanel
              title="Saved Searches"
              subtitle="Search queries saved on this workstation."
              icon={
                <Bookmark
                  size={23}
                />
              }
              records={
                savedSearches
              }
              emptyText="No saved searches yet."
              onRun={
                runStoredSearch
              }
              onDelete={
                deleteSavedSearch
              }
            />
          )}

          {/* RECENT SEARCHES */}

          {sidebarMode ===
            "recent" && (
            <section className="search-library-panel">

              <div className="search-library-heading">

                <div>

                  <History
                    size={23}
                  />

                  <div>
                    <span>
                      SEARCH HISTORY
                    </span>

                    <h1>
                      Recent Searches
                    </h1>

                    <p>
                      Recently executed
                      investigation
                      searches.
                    </p>
                  </div>

                </div>

                {recentSearches.length >
                  0 && (
                  <button
                    type="button"
                    className="search-clear-history"
                    onClick={
                      clearRecentSearches
                    }
                  >
                    <Trash2
                      size={16}
                    />

                    Clear History
                  </button>
                )}

              </div>

              {recentSearches.length ===
              0 ? (
                <div className="search-library-empty">
                  No recent searches.
                </div>
              ) : (
                <div className="search-library-list">

                  {recentSearches.map(
                    (item) => (
                      <button
                        type="button"
                        className="search-library-row"
                        key={
                          item.id
                        }
                        onClick={() =>
                          runStoredSearch(
                            item
                          )
                        }
                      >

                        <div>

                          {item.type ===
                          "location" ? (
                            <MapPin
                              size={
                                18
                              }
                            />
                          ) : (
                            <Search
                              size={
                                18
                              }
                            />
                          )}

                          <div>
                            <strong>
                              {
                                item.query
                              }
                            </strong>

                            <span>
                              {item.type ===
                              "location"
                                ? "Location search"
                                : "Record search"}

                              {" · "}

                              {item.searched_at
                                ? new Date(
                                    item.searched_at
                                  ).toLocaleString(
                                    "en-IN"
                                  )
                                : "Recent"}
                            </span>
                          </div>

                        </div>

                        <ArrowRight
                          size={18}
                        />

                      </button>
                    )
                  )}

                </div>
              )}

            </section>
          )}

          {/* ADVANCED SEARCH */}

          {sidebarMode ===
            "search" && (
            <>

              <section className="search-console">

                <div className="search-console-heading">

                  <div>

                    <span>
                      INVESTIGATION RECORD SEARCH
                    </span>

                    <h1>
                      Search Across CINTRA
                    </h1>

                    <p>
                      Locate linked
                      persons, cases,
                      evidence and
                      location-related
                      investigation
                      records.
                    </p>

                  </div>

                  {hasSearched && (
                    <div className="search-record-total">

                      <span>
                        Records Found
                      </span>

                      <strong>
                        {
                          totalResults
                        }
                      </strong>

                    </div>
                  )}

                </div>

                {/* SEARCH TYPES */}

                <div className="search-type-bar">

                  <button
                    type="button"
                    className={
                      searchType ===
                      "all"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      selectType(
                        "all"
                      )
                    }
                  >
                    <Search
                      size={19}
                    />

                    All Records
                  </button>

                  <button
                    type="button"
                    className={
                      searchType ===
                      "person"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      selectType(
                        "person"
                      )
                    }
                  >
                    <UserRound
                      size={19}
                    />

                    Person
                  </button>

                  <button
                    type="button"
                    className={
                      searchType ===
                      "case"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      selectType(
                        "case"
                      )
                    }
                  >
                    <FolderOpen
                      size={19}
                    />

                    Case / FIR
                  </button>

                  <button
                    type="button"
                    className={
                      searchType ===
                      "evidence"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      selectType(
                        "evidence"
                      )
                    }
                  >
                    <FileText
                      size={19}
                    />

                    Evidence
                  </button>

                  <button
                    type="button"
                    className={
                      searchType ===
                      "location"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      selectType(
                        "location"
                      )
                    }
                  >
                    <MapPin
                      size={19}
                    />

                    Location
                  </button>

                </div>

                {/* SEARCH FORM */}

                <form
                  className="search-form"
                  onSubmit={
                    performSearch
                  }
                >

                  <div className="search-input-container">

                    {searchType ===
                    "location" ? (
                      <MapPin
                        size={22}
                      />
                    ) : (
                      <Search
                        size={22}
                      />
                    )}

                    <input
                      type="text"
                      value={query}
                      onChange={(
                        event
                      ) =>
                        setQuery(
                          event.target
                            .value
                        )
                      }
                      placeholder={
                        getSearchPlaceholder()
                      }
                    />

                    {query && (
                      <button
                        type="button"
                        className="search-field-clear"
                        onClick={() =>
                          setQuery("")
                        }
                      >
                        ×
                      </button>
                    )}

                  </div>

                  <button
                    type="submit"
                    className="search-button"
                    disabled={
                      loading
                    }
                  >
                    <Search
                      size={20}
                    />

                    {loading
                      ? "Searching"
                      : "Search"}
                  </button>

                </form>

                <div className="search-console-footer">

                  <span>
                    {searchType ===
                    "location"
                      ? "Search location fields available in indexed CINTRA records."
                      : "Results are retrieved from CINTRA's indexed investigation records."}
                  </span>

                  {(query ||
                    hasSearched) && (
                    <button
                      type="button"
                      onClick={
                        clearSearch
                      }
                    >
                      Clear Search
                    </button>
                  )}

                </div>

              </section>

              {/* MESSAGE */}

              {message && (
                <div className="search-message">

                  <AlertCircle
                    size={19}
                  />

                  {message}

                </div>
              )}

              {/* LOADING */}

              {loading && (
                <section className="search-loading">

                  <div className="search-spinner" />

                  <strong>
                    Searching CINTRA
                  </strong>

                  <span>
                    Resolving direct
                    matches and linked
                    investigation
                    records...
                  </span>

                </section>
              )}

              {/* INITIAL STATE */}

              {!loading &&
                !hasSearched && (
                  <section className="search-start">

                    <Search
                      size={39}
                    />

                    <h2>
                      Search Investigation Records
                    </h2>

                    <p>
                      Search a person,
                      case, FIR,
                      evidence record
                      or location.
                    </p>

                  </section>
                )}

              {/* RESULTS */}

              {!loading &&
                hasSearched && (
                  <section className="search-results">

                    <div className="search-results-header">

                      <div>

                        <span>
                          SEARCH RESULTS
                        </span>

                        <strong>
                          Results for “
                          {searchedQuery}
                          ”
                        </strong>

                      </div>

                      <div className="search-result-actions">

                        <button
                          type="button"
                          className="search-save-button"
                          onClick={
                            saveCurrentSearch
                          }
                        >
                          <BookmarkPlus
                            size={16}
                          />

                          Save Search
                        </button>

                        <div className="search-count-strip">

                          <button
                            type="button"
                            onClick={() =>
                              setActiveTab(
                                "persons"
                              )
                            }
                          >
                            <strong>
                              {
                                persons.length
                              }
                            </strong>

                            <span>
                              Persons
                            </span>
                          </button>

                          <i />

                          <button
                            type="button"
                            onClick={() =>
                              setActiveTab(
                                "cases"
                              )
                            }
                          >
                            <strong>
                              {
                                cases.length
                              }
                            </strong>

                            <span>
                              Cases
                            </span>
                          </button>

                          <i />

                          <button
                            type="button"
                            onClick={() =>
                              setActiveTab(
                                "evidence"
                              )
                            }
                          >
                            <strong>
                              {
                                evidence.length
                              }
                            </strong>

                            <span>
                              Evidence
                            </span>
                          </button>

                        </div>

                      </div>

                    </div>

                    {totalResults ===
                    0 ? (
                      <div className="search-no-results">

                        {searchType ===
                        "location" ? (
                          <MapPin
                            size={37}
                          />
                        ) : (
                          <Search
                            size={37}
                          />
                        )}

                        <h3>
                          No matching records
                        </h3>

                        <p>
                          No indexed
                          records matched
                          “{searchedQuery}”.
                        </p>

                      </div>
                    ) : (
                      <>

                        {/* RESULT TABS */}

                        <div className="search-result-tabs">

                          <button
                            type="button"
                            className={
                              activeTab ===
                              "overview"
                                ? "active"
                                : ""
                            }
                            onClick={() =>
                              setActiveTab(
                                "overview"
                              )
                            }
                          >
                            Overview
                          </button>

                          {persons.length >
                            0 && (
                            <button
                              type="button"
                              className={
                                activeTab ===
                                "persons"
                                  ? "active"
                                  : ""
                              }
                              onClick={() =>
                                setActiveTab(
                                  "persons"
                                )
                              }
                            >
                              Persons (
                              {
                                persons.length
                              }
                              )
                            </button>
                          )}

                          {cases.length >
                            0 && (
                            <button
                              type="button"
                              className={
                                activeTab ===
                                "cases"
                                  ? "active"
                                  : ""
                              }
                              onClick={() =>
                                setActiveTab(
                                  "cases"
                                )
                              }
                            >
                              Cases (
                              {
                                cases.length
                              }
                              )
                            </button>
                          )}

                          {evidence.length >
                            0 && (
                            <button
                              type="button"
                              className={
                                activeTab ===
                                "evidence"
                                  ? "active"
                                  : ""
                              }
                              onClick={() =>
                                setActiveTab(
                                  "evidence"
                                )
                              }
                            >
                              Evidence (
                              {
                                evidence.length
                              }
                              )
                            </button>
                          )}

                          {identifiers.length > 0 && (
                            <button
                              type="button"
                              className={activeTab === "identifiers" ? "active" : ""}
                              onClick={() => setActiveTab("identifiers")}
                            >
                              Cross-Case ({identifiers.length})
                            </button>
                          )}

                        </div>

                        {activeTab === "identifiers" && (
                          <div className="search-identifier-results">
                            {identifiers.map((item, index) => (
                              <article className="search-identifier-card" key={`${item.identifier_type}-${item.normalized_value}-${index}`}>
                                <span>{item.identifier_type}</span>
                                <strong>{item.value}</strong>
                                <small>{item.case_count} case{item.case_count === 1 ? "" : "s"} · {item.records} indexed record{item.records === 1 ? "" : "s"}</small>
                                {item.cross_case && <b>CROSS-CASE OVERLAP</b>}
                              </article>
                            ))}
                          </div>
                        )}

                        {/* OVERVIEW */}

                        {activeTab ===
                          "overview" && (
                          <div className="search-overview">

                            {/* PERSON */}

                            <section className="search-column">

                              <ColumnHeader
                                icon={
                                  <UserRound
                                    size={
                                      20
                                    }
                                  />
                                }
                                title="Person Match"
                                count={
                                  persons.length
                                }
                              />

                              {primaryPerson ? (
                                <>
                                  <article className="search-primary-person">

                                    <div className="search-avatar">

                                      <UserRound
                                        size={
                                          30
                                        }
                                      />

                                    </div>

                                    <div className="search-person-information">

                                      <span>
                                        {getPersonReference(
                                          primaryPerson
                                        )}
                                      </span>

                                      <h3>
                                        {getPersonName(
                                          primaryPerson
                                        )}
                                      </h3>

                                      <div className="search-person-details">

                                        <RecordField
                                          label="Phone"
                                          value={
                                            primaryPerson.phone
                                          }
                                        />

                                        <RecordField
                                          label="Role"
                                          value={
                                            primaryPerson.role
                                          }
                                        />

                                        <RecordField
                                          label="Location"
                                          value={
                                            getLocationValue(
                                              primaryPerson
                                            )
                                          }
                                        />

                                      </div>

                                    </div>

                                    <button
                                      type="button"
                                      className="search-square-action"
                                      onClick={() =>
                                        openPerson(
                                          primaryPerson
                                        )
                                      }
                                    >
                                      <ArrowRight
                                        size={
                                          20
                                        }
                                      />
                                    </button>

                                  </article>

                                  {visiblePersons
                                    .slice(1)
                                    .map(
                                      (
                                        person
                                      ) => (
                                        <button
                                          type="button"
                                          key={
                                            person.id
                                          }
                                          className="search-secondary-row"
                                          onClick={() =>
                                            openPerson(
                                              person
                                            )
                                          }
                                        >

                                          <div>
                                            <UserRound
                                              size={
                                                18
                                              }
                                            />

                                            <span>
                                              {getPersonName(
                                                person
                                              )}
                                            </span>
                                          </div>

                                          <ChevronRight
                                            size={
                                              17
                                            }
                                          />

                                        </button>
                                      )
                                    )}

                                </>
                              ) : (
                                <EmptyColumn
                                  text="No matching person records."
                                />
                              )}

                            </section>

                            {/* CASES */}

                            <section className="search-column">

                              <ColumnHeader
                                icon={
                                  <FolderOpen
                                    size={
                                      20
                                    }
                                  />
                                }
                                title="Linked Cases"
                                count={
                                  cases.length
                                }
                              />

                              {visibleCases.length >
                              0 ? (
                                <div className="search-case-results">

                                  {visibleCases.map(
                                    (item) => (
                                      <button
                                        type="button"
                                        key={
                                          item.id
                                        }
                                        onClick={() =>
                                          openCase(
                                            item
                                          )
                                        }
                                      >

                                        <div>

                                          <div className="search-case-topline">

                                            <strong>
                                              {getCaseReference(
                                                item
                                              )}
                                            </strong>

                                            {item.status && (
                                              <span>
                                                {
                                                  item.status
                                                }
                                              </span>
                                            )}

                                          </div>

                                          <p>
                                            FIR No.:{" "}
                                            {getFirNumber(
                                              item
                                            )}
                                          </p>

                                          <small>
                                            {getLocationValue(
                                              item
                                            )}
                                          </small>

                                          <small>
                                            {item.offence ||
                                              getCaseTitle(
                                                item
                                              )}
                                          </small>

                                        </div>

                                        <ChevronRight
                                          size={
                                            18
                                          }
                                        />

                                      </button>
                                    )
                                  )}

                                </div>
                              ) : (
                                <EmptyColumn
                                  text="No linked case records found."
                                />
                              )}

                            </section>

                            {/* EVIDENCE */}

                            <section className="search-column">

                              <ColumnHeader
                                icon={
                                  <FileText
                                    size={
                                      20
                                    }
                                  />
                                }
                                title="Linked Evidence"
                                count={
                                  evidence.length
                                }
                              />

                              {visibleEvidence.length >
                              0 ? (
                                <div className="search-evidence-list">

                                  {visibleEvidence.map(
                                    (item) => (
                                      <button
                                        type="button"
                                        key={
                                          item.id
                                        }
                                        onClick={() =>
                                          openEvidence(
                                            item
                                          )
                                        }
                                      >

                                        <div className="search-evidence-icon">
                                          <FileText
                                            size={
                                              19
                                            }
                                          />
                                        </div>

                                        <div className="search-evidence-info">

                                          <strong>
                                            {getEvidenceTitle(
                                              item
                                            )}
                                          </strong>

                                          <span>
                                            {getEvidenceReference(
                                              item
                                            )}
                                          </span>

                                          <small>
                                            {getLocationValue(
                                              item
                                            ) !==
                                            "—"
                                              ? getLocationValue(
                                                  item
                                                )
                                              : item.evidence_type ||
                                                item.source ||
                                                "Evidence Record"}
                                          </small>

                                        </div>

                                        <ChevronRight
                                          size={
                                            17
                                          }
                                        />

                                      </button>
                                    )
                                  )}

                                </div>
                              ) : (
                                <EmptyColumn
                                  text="No linked evidence records found."
                                />
                              )}

                            </section>

                          </div>
                        )}

                        {/* PERSONS TAB */}

                        {activeTab ===
                          "persons" && (
                          <div className="search-detail-list">

                            {persons.map(
                              (person) => (
                                <article
                                  className="search-person-record"
                                  key={
                                    person.id
                                  }
                                >

                                  <div className="search-avatar small">
                                    <UserRound
                                      size={
                                        24
                                      }
                                    />
                                  </div>

                                  <div className="search-record-title">

                                    <span>
                                      {getPersonReference(
                                        person
                                      )}
                                    </span>

                                    <strong>
                                      {getPersonName(
                                        person
                                      )}
                                    </strong>

                                  </div>

                                  <RecordField
                                    label="Phone"
                                    value={
                                      person.phone
                                    }
                                  />

                                  <RecordField
                                    label="Role"
                                    value={
                                      person.role
                                    }
                                  />

                                  <RecordField
                                    label="Location"
                                    value={
                                      getLocationValue(
                                        person
                                      )
                                    }
                                  />

                                  <button
                                    type="button"
                                    className="search-view-button"
                                    onClick={() =>
                                      openPerson(
                                        person
                                      )
                                    }
                                  >
                                    View

                                    <ArrowRight
                                      size={
                                        17
                                      }
                                    />
                                  </button>

                                </article>
                              )
                            )}

                          </div>
                        )}

                        {/* CASES TAB */}

                        {activeTab ===
                          "cases" && (
                          <div className="search-table-wrap">

                            <table className="search-table">

                              <thead>
                                <tr>
                                  <th>
                                    Case
                                  </th>

                                  <th>
                                    FIR Number
                                  </th>

                                  <th>
                                    Offence
                                  </th>

                                  <th>
                                    Location / PS
                                  </th>

                                  <th>
                                    Stage
                                  </th>

                                  <th>
                                    Status
                                  </th>

                                  <th />
                                </tr>
                              </thead>

                              <tbody>

                                {cases.map(
                                  (item) => (
                                    <tr
                                      key={
                                        item.id
                                      }
                                    >

                                      <td>
                                        <div className="search-case-table-title">

                                          <strong>
                                            {getCaseReference(
                                              item
                                            )}
                                          </strong>

                                          <span>
                                            {getCaseTitle(
                                              item
                                            )}
                                          </span>

                                        </div>
                                      </td>

                                      <td>
                                        {getFirNumber(
                                          item
                                        )}
                                      </td>

                                      <td>
                                        {item.offence ||
                                          "—"}
                                      </td>

                                      <td>
                                        {getLocationValue(
                                          item
                                        )}
                                      </td>

                                      <td>
                                        {item.stage ||
                                          "—"}
                                      </td>

                                      <td>
                                        {item.status ||
                                          "—"}
                                      </td>

                                      <td>
                                        <button
                                          type="button"
                                          className="search-square-action"
                                          onClick={() =>
                                            openCase(
                                              item
                                            )
                                          }
                                        >
                                          <ArrowRight
                                            size={
                                              18
                                            }
                                          />
                                        </button>
                                      </td>

                                    </tr>
                                  )
                                )}

                              </tbody>

                            </table>

                          </div>
                        )}

                        {/* EVIDENCE TAB */}

                        {activeTab ===
                          "evidence" && (
                          <div className="search-detail-list">

                            {evidence.map(
                              (item) => (
                                <article
                                  className="search-evidence-record"
                                  key={
                                    item.id
                                  }
                                >

                                  <div className="search-file-box">
                                    <FileText
                                      size={
                                        22
                                      }
                                    />
                                  </div>

                                  <div className="search-record-title">

                                    <span>
                                      {getEvidenceReference(
                                        item
                                      )}
                                    </span>

                                    <strong>
                                      {getEvidenceTitle(
                                        item
                                      )}
                                    </strong>

                                  </div>

                                  <RecordField
                                    label="Type"
                                    value={
                                      item.evidence_type
                                    }
                                  />

                                  <RecordField
                                    label="Source"
                                    value={
                                      item.source
                                    }
                                  />

                                  <RecordField
                                    label="Location"
                                    value={
                                      getLocationValue(
                                        item
                                      )
                                    }
                                  />

                                  <button
                                    type="button"
                                    className="search-view-button"
                                    onClick={() =>
                                      openEvidence(
                                        item
                                      )
                                    }
                                  >
                                    View

                                    <ArrowRight
                                      size={
                                        17
                                      }
                                    />
                                  </button>

                                </article>
                              )
                            )}

                          </div>
                        )}

                      </>
                    )}

                  </section>
                )}

            </>
          )}

        </main>

      </div>

      <footer className="search-footer">

        <div>
          <ShieldCheck
            size={16}
          />

          <span>
            CINTRA Investigation System
          </span>
        </div>

        <span>
          Sensitive Information —
          Authorized Personnel Only
        </span>

        <span>
          {hasSearched
            ? `${totalResults} record${
                totalResults === 1
                  ? ""
                  : "s"
              } found`
            : "Central Record Search"}
        </span>

      </footer>

    </div>
  );
}

/* =========================================================
   COMPONENTS
   ========================================================= */

function ColumnHeader({
  icon,
  title,
  count,
}) {
  return (
    <header className="search-column-header">

      <div>
        {icon}

        <strong>
          {title}
        </strong>
      </div>

      <span>
        {count} found
      </span>

    </header>
  );
}

function EmptyColumn({
  text,
}) {
  return (
    <div className="search-column-empty">
      {text}
    </div>
  );
}

function RecordField({
  label,
  value,
}) {
  return (
    <div className="search-record-field">

      <span>
        {label}
      </span>

      <strong>
        {value || "—"}
      </strong>

    </div>
  );
}

function SearchLibraryPanel({
  title,
  subtitle,
  icon,
  records,
  emptyText,
  onRun,
  onDelete,
}) {
  return (
    <section className="search-library-panel">

      <div className="search-library-heading">

        <div>

          {icon}

          <div>
            <span>
              SEARCH LIBRARY
            </span>

            <h1>
              {title}
            </h1>

            <p>
              {subtitle}
            </p>
          </div>

        </div>

      </div>

      {records.length ===
      0 ? (
        <div className="search-library-empty">
          {emptyText}
        </div>
      ) : (
        <div className="search-library-list">

          {records.map(
            (item) => (
              <div
                className="search-saved-row"
                key={
                  item.id
                }
              >

                <button
                  type="button"
                  className="search-saved-run"
                  onClick={() =>
                    onRun(item)
                  }
                >

                  {item.type ===
                  "location" ? (
                    <MapPin
                      size={18}
                    />
                  ) : (
                    <Search
                      size={18}
                    />
                  )}

                  <div>
                    <strong>
                      {item.query}
                    </strong>

                    <span>
                      {item.type ===
                      "location"
                        ? "Location search"
                        : "Record search"}
                    </span>
                  </div>

                </button>

                <button
                  type="button"
                  className="search-saved-delete"
                  onClick={() =>
                    onDelete(
                      item.id
                    )
                  }
                  aria-label="Delete saved search"
                >
                  <Trash2
                    size={17}
                  />
                </button>

              </div>
            )
          )}

        </div>
      )}

    </section>
  );
}

export default AdvancedSearch;

