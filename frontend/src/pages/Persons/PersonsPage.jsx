import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import {
  ArrowLeft,
  Camera,
  Check,
  ChevronDown,
  Link2,
  MapPin,
  Phone,
  FileText,
  FileImage,
  ExternalLink,
  Plus,
  Search,
  ShieldCheck,
  Upload,
  UserPlus,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";

import AppHeader from "../../components/layout/AppHeader";
import "./PersonsPage.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000";

const EMPTY_PERSON_FORM = {
  person_id: "",
  name: "",
  age: "",
  gender: "",
  phone: "",
  address: "",
  role: "",
  status: "Under Investigation",
  role_in_case: "",
};

function getToken() {
  return (
    localStorage.getItem("cintra_token") ||
    sessionStorage.getItem("cintra_token")
  );
}

function clearStoredAuth() {
  localStorage.removeItem("cintra_token");
  localStorage.removeItem("cintra_officer");

  sessionStorage.removeItem("cintra_token");
  sessionStorage.removeItem("cintra_officer");
}

function getCanonicalDemoNumber(personId = "") {
  const match = String(personId)
    .trim()
    .toUpperCase()
    .match(/^SYN-P-(\d+)$/);

  if (!match) {
    return null;
  }

  const raw = Number(match[1]);

  if (!Number.isFinite(raw) || raw < 1) {
    return null;
  }

  /*
   * Seeded CINTRA demo identities repeat every 20 IDs:
   * 001, 021, 041, 061, 081, 101 -> person 001.
   */
  return ((raw - 1) % 20) + 1;
}

function getDemoJpeg(person) {
  const number = getCanonicalDemoNumber(
    person?.person_id
  );

  if (!number) {
    return null;
  }

  return `/persons/person-${String(number).padStart(
    3,
    "0"
  )}.jpg`;
}

function resolveApiFilePath(path) {
  if (!path) {
    return null;
  }

  const value = String(path).trim();

  if (!value) {
    return null;
  }

  if (
    value.startsWith("http://") ||
    value.startsWith("https://")
  ) {
    return value;
  }

  if (value.startsWith("/persons/")) {
    return value;
  }

  return `${API_BASE_URL}${
    value.startsWith("/") ? "" : "/"
  }${value}`;
}

function getProfileImage(person) {
  if (!person) {
    return null;
  }

  const storedPath = String(
    person.profile_image_path || ""
  ).trim();

  /*
   * Existing uploaded raster photographs are preferred.
   * Old SVG placeholders are intentionally ignored.
   */
  if (
    storedPath &&
    !storedPath.toLowerCase().endsWith(".svg")
  ) {
    return resolveApiFilePath(storedPath);
  }

  return getDemoJpeg(person);
}

function getPersonInitials(person) {
  const words = String(person?.name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) {
    return "P";
  }

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || "")
    .join("");
}

function PersonPhoto({
  person,
  className = "",
  fallbackSize = "normal",
}) {
  const [imageFailed, setImageFailed] =
    useState(false);

  const image = getProfileImage(person);

  useEffect(() => {
    setImageFailed(false);
  }, [
    person?.id,
    person?.person_id,
    person?.profile_image_path,
  ]);

  if (!image || imageFailed) {
    return (
      <div
        className={`persons-photo-fallback ${fallbackSize} ${className}`}
        aria-label={`${person?.name || "Person"} photograph unavailable`}
      >
        {getPersonInitials(person)}
      </div>
    );
  }

  return (
    <img
      className={className}
      src={image}
      alt={person?.name || "Person"}
      onError={() => setImageFailed(true)}
      loading="lazy"
    />
  );
}

function getPersonDocuments(details) {
  const candidates = [
    details?.documents,
    details?.attachments,
    details?.person_documents,
    details?.records,
  ];

  const found = candidates.find(
    (value) => Array.isArray(value)
  );

  return found || [];
}

function getDocumentPath(documentItem) {
  const raw =
    documentItem?.file_path ||
    documentItem?.path ||
    documentItem?.url ||
    documentItem?.file_url ||
    "";

  return resolveApiFilePath(raw);
}

function getDocumentName(documentItem) {
  return (
    documentItem?.title ||
    documentItem?.name ||
    documentItem?.document_name ||
    documentItem?.filename ||
    "Document"
  );
}

function isImageDocument(documentItem) {
  const path = String(
    getDocumentPath(documentItem) || ""
  ).toLowerCase();

  const type = String(
    documentItem?.mime_type ||
    documentItem?.file_type ||
    documentItem?.type ||
    ""
  ).toLowerCase();

  return (
    type.startsWith("image/") ||
    /\.(jpg|jpeg|png|webp)$/i.test(path)
  );
}

function PersonDocumentCard({
  documentItem,
}) {
  const path = getDocumentPath(documentItem);
  const name = getDocumentName(documentItem);
  const image = isImageDocument(documentItem);
  const secure = String(documentItem?.file_path || "").startsWith(
    "/evidence/by-code/"
  );
  const [secureUrl, setSecureUrl] = useState(null);

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;

    async function loadSecurePreview() {
      if (!secure || !path) return;
      const token = getToken();
      if (!token) return;

      try {
        const response = await fetch(path, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setSecureUrl(objectUrl);
      } catch {
        if (!cancelled) setSecureUrl(null);
      }
    }

    loadSecurePreview();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, secure]);

  const openPath = secure ? secureUrl : path;

  return (
    <div className="persons-document-card">
      <div className="persons-document-preview">
        {image && openPath ? (
          <img src={openPath} alt={name} loading="lazy" />
        ) : (
          <FileText size={24} />
        )}
      </div>

      <div className="persons-document-copy">
        <span>
          {documentItem?.document_type ||
            documentItem?.type ||
            documentItem?.file_type ||
            (image ? "IMAGE" : "DOCUMENT")}
        </span>
        <strong>{name}</strong>
        <small>
          {documentItem?.source ||
            documentItem?.description ||
            "Person-linked record"}
        </small>
      </div>

      {openPath && (
        <a
          className="persons-document-open"
          href={openPath}
          target="_blank"
          rel="noreferrer"
          title={`Open ${name}`}
        >
          <ExternalLink size={15} />
        </a>
      )}
    </div>
  );
}

function normalize(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replaceAll("_", " ");
}

function roleOrder(role = "") {
  const value = normalize(role);

  if (value === "victim") return 0;

  if (value === "prime suspect") return 1;

  if (value.startsWith("suspect")) {
    return 2;
  }

  if (value === "witness") return 3;

  if (value === "associate") return 4;

  return 5;
}

function roleClass(role = "") {
  const value = normalize(role);

  if (value === "victim") {
    return "victim";
  }

  if (value === "prime suspect") {
    return "prime-suspect";
  }

  if (value.startsWith("suspect")) {
    return "suspect";
  }

  if (value === "associate") {
    return "associate";
  }

  if (value === "witness") {
    return "witness";
  }

  return "other";
}

function getErrorMessage(
  data,
  fallback
) {
  if (!data) return fallback;

  if (
    typeof data.detail === "string"
  ) {
    return data.detail;
  }

  if (
    Array.isArray(data.detail)
  ) {
    return data.detail
      .map(
        (item) =>
          item?.msg || String(item)
      )
      .join(", ");
  }

  if (
    typeof data.message === "string"
  ) {
    return data.message;
  }

  return fallback;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function CaseRoleBadge({
  role,
  large = false,
}) {
  if (!role) return null;

  return (
    <span
      className={`persons-case-role ${roleClass(
        role
      )} ${large ? "large" : ""}`}
    >
      {role}
    </span>
  );
}

function PersonsPage() {
  const navigate = useNavigate();

  const { caseId } =
    useParams();

  const [searchParams] =
    useSearchParams();

  const requestedPersonId =
    searchParams.get("personId");

  const isCaseContext =
    Boolean(caseId);

  const [persons, setPersons] =
    useState([]);

  const [caseData, setCaseData] =
    useState(null);

  const [
    selectedPersonId,
    setSelectedPersonId,
  ] = useState(null);

  const [
    selectedPersonDetails,
    setSelectedPersonDetails,
  ] = useState(null);

  const [
    detailsLoading,
    setDetailsLoading,
  ] = useState(false);

  const [
    searchTerm,
    setSearchTerm,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("All Statuses");

  const [
    roleFilter,
    setRoleFilter,
  ] = useState("All Case Roles");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
    showAddModal,
    setShowAddModal,
  ] = useState(false);

  const [
    addMode,
    setAddMode,
  ] = useState("create");

  const [
    personForm,
    setPersonForm,
  ] = useState(EMPTY_PERSON_FORM);

  const [
    selectedImage,
    setSelectedImage,
  ] = useState(null);

  const [
    imagePreview,
    setImagePreview,
  ] = useState("");

  const [
    submittingPerson,
    setSubmittingPerson,
  ] = useState(false);

  const [
    modalMessage,
    setModalMessage,
  ] = useState("");

  const [
    allPersons,
    setAllPersons,
  ] = useState([]);

  const [
    existingSearch,
    setExistingSearch,
  ] = useState("");

  const [
    selectedExistingPerson,
    setSelectedExistingPerson,
  ] = useState(null);

  const [
    existingRoleInCase,
    setExistingRoleInCase,
  ] = useState("");

  async function unauthorized() {
    clearStoredAuth();

    navigate("/", {
      replace: true,
    });
  }

  async function loadPageData({
    preserveSelection = false,
  } = {}) {
    const token = getToken();

    if (!token) {
      await unauthorized();
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const headers = {
        Authorization:
          `Bearer ${token}`,
      };

      const personsUrl =
        isCaseContext
          ? `${API_BASE_URL}/persons/case/${caseId}`
          : `${API_BASE_URL}/persons/`;

      const requests = [
        fetch(personsUrl, {
          headers,
        }),
      ];

      if (isCaseContext) {
        requests.push(
          fetch(
            `${API_BASE_URL}/cases/${caseId}`,
            {
              headers,
            }
          )
        );
      }

      const responses =
        await Promise.all(requests);

      const personsResponse =
        responses[0];

      const caseResponse =
        isCaseContext
          ? responses[1]
          : null;

      if (
        personsResponse.status === 401 ||
        caseResponse?.status === 401
      ) {
        await unauthorized();
        return;
      }

      if (!personsResponse.ok) {
        const errorData =
          await readJson(
            personsResponse
          );

        throw new Error(
          getErrorMessage(
            errorData,
            "Unable to load person records."
          )
        );
      }

      const personsResult =
        await personsResponse.json();

      const list =
        Array.isArray(personsResult)
          ? personsResult
          : [];

      setPersons(list);

      if (caseResponse?.ok) {
        setCaseData(
          await caseResponse.json()
        );
      }

      if (!list.length) {
        setSelectedPersonId(null);
        return;
      }

      if (
        preserveSelection &&
        list.some(
          (person) =>
            String(person.id) ===
            String(
              selectedPersonId
            )
        )
      ) {
        return;
      }

      const requested =
        requestedPersonId
          ? list.find(
              (person) =>
                String(person.id) ===
                String(
                  requestedPersonId
                )
            )
          : null;

      setSelectedPersonId(
        requested?.id ||
          list[0].id
      );
    } catch (error) {
      console.error(
        "Persons page:",
        error
      );

      setMessage(
        error.message ||
          "Unable to connect to CINTRA services."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPageData();
  }, [
    caseId,
    requestedPersonId,
  ]);


  useEffect(() => {
    async function loadSelectedPersonDetails(silent = false) {
      if (!selectedPersonId) {
        setSelectedPersonDetails(null);
        return;
      }

      const token = getToken();
      if (!token) return;

      try {
        if (!silent) {
          setDetailsLoading(true);
        }

        const response = await fetch(
          `${API_BASE_URL}/persons/${selectedPersonId}/details`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.status === 401) {
          await unauthorized();
          return;
        }

        if (!response.ok) {
          const data = await readJson(response);
          throw new Error(
            getErrorMessage(
              data,
              "Unable to load associated cases."
            )
          );
        }

        setSelectedPersonDetails(
          await response.json()
        );
      } catch (error) {
        console.error(
          "Person details:",
          error
        );
        setSelectedPersonDetails(null);
      } finally {
        if (!silent) {
          setDetailsLoading(false);
        }
      }
    }

    loadSelectedPersonDetails();
    const syncTimer = window.setInterval(() => {
      loadSelectedPersonDetails(true);
    }, 7000);

    return () => window.clearInterval(syncTimer);
  }, [selectedPersonId]);

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(
          imagePreview
        );
      }
    };
  }, [imagePreview]);

  const statusOptions =
    useMemo(() => {
      return [
        "All Statuses",
        ...Array.from(
          new Set(
            persons
              .map(
                (person) =>
                  person.status
              )
              .filter(Boolean)
          )
        ),
      ];
    }, [persons]);

  const roleOptions =
    useMemo(() => {
      return [
        "All Case Roles",
        ...Array.from(
          new Set(
            persons
              .map(
                (person) =>
                  person.role_in_case
              )
              .filter(Boolean)
          )
        ).sort(
          (a, b) =>
            roleOrder(a) -
            roleOrder(b)
        ),
      ];
    }, [persons]);

  const filteredPersons =
    useMemo(() => {
      const query =
        searchTerm
          .trim()
          .toLowerCase();

      return persons
        .filter((person) => {
          const statusMatches =
            statusFilter ===
              "All Statuses" ||
            person.status ===
              statusFilter;

          const roleMatches =
            !isCaseContext ||
            roleFilter ===
              "All Case Roles" ||
            person.role_in_case ===
              roleFilter;

          if (
            !statusMatches ||
            !roleMatches
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          return [
            person.person_id,
            person.name,
            person.phone,
            person.address,
            person.status,
            isCaseContext
              ? person.role_in_case
              : person.role,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(query);
        })
        .sort((a, b) => {
          if (!isCaseContext) {
            return String(
              a.name || ""
            ).localeCompare(
              String(
                b.name || ""
              )
            );
          }

          const diff =
            roleOrder(
              a.role_in_case
            ) -
            roleOrder(
              b.role_in_case
            );

          if (diff) return diff;

          return String(
            a.name || ""
          ).localeCompare(
            String(
              b.name || ""
            )
          );
        });
    }, [
      persons,
      searchTerm,
      statusFilter,
      roleFilter,
      isCaseContext,
    ]);

  const selectedPerson =
    useMemo(
      () =>
        persons.find(
          (person) =>
            String(person.id) ===
            String(
              selectedPersonId
            )
        ) || null,
      [
        persons,
        selectedPersonId,
      ]
    );

  /*
   * Defensive UI dedupe:
   * the backend now returns one row per case, but this also
   * protects the profile if older duplicate CasePerson links
   * are still returned by a stale server during development.
   */
  const uniqueAssociatedCases =
    useMemo(() => {
      const source =
        Array.isArray(
          selectedPersonDetails
            ?.associated_cases
        )
          ? selectedPersonDetails
              .associated_cases
          : [];

      const byCase =
        new Map();

      source.forEach(
        (caseItem) => {
          const key =
            String(
              caseItem
                ?.case_database_id ??
              caseItem?.case_id ??
              caseItem?.fir_number ??
              ""
            );

          if (!key) {
            return;
          }

          const existing =
            byCase.get(key);

          if (!existing) {
            byCase.set(
              key,
              {
                ...caseItem,
                _roles: new Set(
                  caseItem
                    ?.role_in_case
                    ? [
                        caseItem
                          .role_in_case,
                      ]
                    : []
                ),
              }
            );

            return;
          }

          if (
            caseItem
              ?.role_in_case
          ) {
            existing
              ._roles
              .add(
                caseItem
                  .role_in_case
              );
          }
        }
      );

      return Array.from(
        byCase.values()
      ).map(
        (caseItem) => {
          const roles =
            Array.from(
              caseItem._roles
            ).sort(
              (a, b) =>
                roleOrder(a) -
                roleOrder(b)
            );

          const {
            _roles,
            ...cleanCase
          } = caseItem;

          return {
            ...cleanCase,
            role_in_case:
              roles.join(" / ") ||
              cleanCase
                .role_in_case ||
              "—",
          };
        }
      );
    }, [
      selectedPersonDetails,
    ]);

  function selectPerson(person) {
    setSelectedPersonId(
      person.id
    );

    const path =
      isCaseContext
        ? `/cases/${caseId}/persons`
        : "/persons";

    navigate(
      `${path}?personId=${encodeURIComponent(
        person.id
      )}`,
      {
        replace: true,
      }
    );
  }

  function resetModal() {
    setPersonForm(
      EMPTY_PERSON_FORM
    );

    setSelectedImage(null);

    if (imagePreview) {
      URL.revokeObjectURL(
        imagePreview
      );
    }

    setImagePreview("");

    setExistingSearch("");

    setSelectedExistingPerson(
      null
    );

    setExistingRoleInCase("");

    setModalMessage("");
  }

  async function openAddModal() {
    setSuccessMessage("");
    setAddMode("create");

    resetModal();

    setShowAddModal(true);

    const token = getToken();

    if (!token) return;

    try {
      const response =
        await fetch(
          `${API_BASE_URL}/persons/`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      if (response.ok) {
        const data =
          await response.json();

        setAllPersons(
          Array.isArray(data)
            ? data
            : []
        );
      }
    } catch (error) {
      console.error(error);
    }
  }

  function closeModal() {
    if (submittingPerson) {
      return;
    }

    setShowAddModal(false);
    resetModal();
  }

  function updateForm(
    field,
    value
  ) {
    setPersonForm(
      (current) => ({
        ...current,
        [field]: value,
      })
    );
  }

  function handleImageChange(
    event
  ) {
    const file =
      event.target.files?.[0];

    if (!file) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setModalMessage(
        "Choose a JPG, JPEG, PNG or WEBP photograph."
      );
      return;
    }

    if (imagePreview) {
      URL.revokeObjectURL(
        imagePreview
      );
    }

    setSelectedImage(file);

    setImagePreview(
      URL.createObjectURL(file)
    );
  }

  async function linkToCase(
    personDatabaseId,
    caseRole
  ) {
    const token = getToken();

    const response =
      await fetch(
        `${API_BASE_URL}/persons/link-to-case/`,
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${token}`,
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            case_id:
              Number(caseId),

            person_id:
              Number(
                personDatabaseId
              ),

            role_in_case:
              caseRole.trim(),
          }),
        }
      );

    if (!response.ok) {
      const data =
        await readJson(response);

      throw new Error(
        getErrorMessage(
          data,
          "Unable to link person to case."
        )
      );
    }
  }

  async function uploadPhoto(
    personDatabaseId
  ) {
    if (!selectedImage) {
      return;
    }

    const formData =
      new FormData();

    formData.append(
      "file",
      selectedImage
    );

    const response =
      await fetch(
        `${API_BASE_URL}/persons/${personDatabaseId}/upload-photo`,
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${getToken()}`,
          },

          body: formData,
        }
      );

    if (!response.ok) {
      throw new Error(
        "Person created, but photograph could not be uploaded."
      );
    }
  }

  async function createPerson(
    event
  ) {
    event.preventDefault();

    if (
      !personForm.person_id.trim() ||
      !personForm.name.trim() ||
      !personForm.role_in_case.trim()
    ) {
      setModalMessage(
        "Person ID, full name and role in this case are required."
      );
      return;
    }

    try {
      setSubmittingPerson(true);
      setModalMessage("");

      const token = getToken();

      /*
       * Person.role is still required by your backend Person model.
       * We store a general value, but DO NOT show it on the
       * case-specific UI beside role_in_case.
       */
      const generalRole =
        personForm.role.trim() ||
        personForm.role_in_case.trim();

      const response =
        await fetch(
          `${API_BASE_URL}/persons/`,
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${token}`,

              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              person_id:
                personForm.person_id.trim(),

              name:
                personForm.name.trim(),

              age:
                personForm.age === ""
                  ? null
                  : Number(
                      personForm.age
                    ),

              gender:
                personForm.gender ||
                null,

              phone:
                personForm.phone ||
                null,

              address:
                personForm.address ||
                null,

              role: generalRole,

              status:
                personForm.status ||
                "Under Investigation",

              profile_image_path:
                null,
            }),
          }
        );

      if (!response.ok) {
        const data =
          await readJson(response);

        throw new Error(
          getErrorMessage(
            data,
            "Unable to create person."
          )
        );
      }

      const created =
        await response.json();

      await uploadPhoto(
        created.id
      );

      if (isCaseContext) {
        await linkToCase(
          created.id,
          personForm.role_in_case
        );
      }

      setSuccessMessage(
        isCaseContext
          ? `${created.name} was added to this case.`
          : `${created.name} was created.`
      );

      setShowAddModal(false);
      resetModal();

      await loadPageData();
    } catch (error) {
      setModalMessage(
        error.message
      );
    } finally {
      setSubmittingPerson(false);
    }
  }

  const availableExisting =
    useMemo(() => {
      const currentIds =
        new Set(
          persons.map(
            (person) =>
              String(person.id)
          )
        );

      const query =
        existingSearch
          .trim()
          .toLowerCase();

      return allPersons
        .filter(
          (person) =>
            !currentIds.has(
              String(person.id)
            )
        )
        .filter((person) => {
          if (!query) return true;

          return [
            person.person_id,
            person.name,
            person.phone,
            person.address,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(query);
        });
    }, [
      allPersons,
      persons,
      existingSearch,
    ]);

  async function linkExisting(
    event
  ) {
    event.preventDefault();

    if (
      !selectedExistingPerson ||
      !existingRoleInCase.trim()
    ) {
      setModalMessage(
        "Select a person and enter their role in this case."
      );
      return;
    }

    try {
      setSubmittingPerson(true);

      await linkToCase(
        selectedExistingPerson.id,
        existingRoleInCase
      );

      setShowAddModal(false);

      setSuccessMessage(
        `${selectedExistingPerson.name} was linked to this case.`
      );

      resetModal();

      await loadPageData();
    } catch (error) {
      setModalMessage(
        error.message
      );
    } finally {
      setSubmittingPerson(false);
    }
  }

  return (
    <div className="persons-page">
      <AppHeader activePage="persons"/>

      <main className="persons-main">
        {isCaseContext && (
          <div className="persons-case-context">
            <button
              type="button"
              onClick={() =>
                navigate(
                  `/cases/${caseId}`
                )
              }
            >
              <ArrowLeft
                size={15}
              />
              Case Workspace
            </button>

            <span>/</span>

            <strong>
              {caseData?.case_id ||
                `Case ${caseId}`}
            </strong>

            <span>/</span>

            <span>
              Persons
            </span>
          </div>
        )}

        <section className="persons-title-row">
          <div className="persons-title">
            <div className="persons-title-accent" />

            <div>
              <span>
                {isCaseContext
                  ? "CASE INVESTIGATION"
                  : "INVESTIGATION RECORDS"}
              </span>

              <h1>
                {isCaseContext
                  ? "Associated Persons"
                  : "Persons"}
              </h1>

              <p>
                {isCaseContext
                  ? `Review persons linked to ${
                      caseData?.case_id ||
                      "this investigation"
                    }.`
                  : "Review person records stored in CINTRA."}
              </p>
            </div>
          </div>

          <div className="persons-title-actions">
            {isCaseContext && (
              <button
                type="button"
                className="persons-add-button"
                onClick={
                  openAddModal
                }
              >
                <Plus size={17} />
                Add Person to Case
              </button>
            )}

            <div className="persons-count-box">
              <UsersRound
                size={22}
              />

              <div>
                <span>
                  {isCaseContext
                    ? "ASSOCIATED PERSONS"
                    : "PERSON RECORDS"}
                </span>

                <strong>
                  {persons.length}
                </strong>
              </div>
            </div>
          </div>
        </section>

        {isCaseContext &&
          caseData && (
            <section className="persons-case-summary">
              <div>
                <span>
                  CASE ID
                </span>

                <strong>
                  {caseData.case_id ||
                    "—"}
                </strong>
              </div>

              <div>
                <span>
                  FIR NUMBER
                </span>

                <strong>
                  {caseData.fir_number ||
                    caseData.fir_no ||
                    "—"}
                </strong>
              </div>

              <div>
                <span>
                  CASE TITLE
                </span>

                <strong>
                  {caseData.title ||
                    "—"}
                </strong>
              </div>

              <div>
                <span>
                  STATUS
                </span>

                <strong>
                  {caseData.status ||
                    "—"}
                </strong>
              </div>
            </section>
          )}

        {message && (
          <div className="persons-message">
            {message}
          </div>
        )}

        {successMessage && (
          <div className="persons-success-message">
            <ShieldCheck
              size={16}
            />

            {successMessage}
          </div>
        )}

        <section className="persons-toolbar">
          <div className="persons-search">
            <Search size={17} />

            <input
              type="text"
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(
                  event.target.value
                )
              }
              placeholder="Search name, ID, role, phone or address"
            />
          </div>

          {isCaseContext && (
            <div className="persons-filter">
              <select
                value={roleFilter}
                onChange={(event) =>
                  setRoleFilter(
                    event.target.value
                  )
                }
              >
                {roleOptions.map(
                  (role) => (
                    <option
                      key={role}
                      value={role}
                    >
                      {role}
                    </option>
                  )
                )}
              </select>

              <ChevronDown
                size={14}
              />
            </div>
          )}

          <div className="persons-filter">
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
            >
              {statusOptions.map(
                (status) => (
                  <option
                    key={status}
                    value={status}
                  >
                    {status}
                  </option>
                )
              )}
            </select>

            <ChevronDown
              size={14}
            />
          </div>
        </section>

        <section className="persons-workspace">
          <div className="persons-record-panel">
            <div className="persons-record-heading">
              <div>
                <span>
                  {isCaseContext
                    ? "CASE PERSON DIRECTORY"
                    : "PERSON DIRECTORY"}
                </span>

                <strong>
                  {filteredPersons.length}{" "}
                  {filteredPersons.length ===
                  1
                    ? "record"
                    : "records"}
                </strong>
              </div>
            </div>

            <div className="persons-list">
              {loading ? (
                <div className="persons-empty">
                  Loading person records...
                </div>
              ) : filteredPersons.length ===
                0 ? (
                <div className="persons-empty">
                  No person records match the current filters.
                </div>
              ) : (
                filteredPersons.map(
                  (person) => {
                    const selected =
                      String(
                        person.id
                      ) ===
                      String(
                        selectedPersonId
                      );

                    return (
                      <button
                        key={
                          person.id
                        }
                        type="button"
                        className={`persons-list-item ${
                          selected
                            ? "selected"
                            : ""
                        }`}
                        onClick={() =>
                          selectPerson(
                            person
                          )
                        }
                      >
                        <div className="persons-list-photo">
                          <PersonPhoto
                            person={person}
                            fallbackSize="small"
                          />
                        </div>

                        <div className="persons-list-copy">
                          <span>
                            {
                              person.person_id
                            }
                          </span>

                          <strong>
                            {person.name}
                          </strong>

                          {isCaseContext && (
                            <CaseRoleBadge
                              role={
                                person.role_in_case
                              }
                            />
                          )}

                          <div className="persons-list-status">
                            {person.status ||
                              "—"}
                          </div>
                        </div>
                      </button>
                    );
                  }
                )
              )}
            </div>
          </div>

          <div className="persons-profile-panel">
            {selectedPerson ? (
              <>
                <div className="persons-profile-heading">
                  <div className="persons-profile-image">
                    <PersonPhoto
                      person={selectedPerson}
                      fallbackSize="large"
                    />
                  </div>

                  <div className="persons-profile-title">
                    <span>
                      {
                        selectedPerson.person_id
                      }
                    </span>

                    <h2>
                      {
                        selectedPerson.name
                      }
                    </h2>

                    {isCaseContext ? (
                      <CaseRoleBadge
                        role={
                          selectedPerson.role_in_case
                        }
                        large
                      />
                    ) : (
                      <p>
                        Unified person record
                      </p>
                    )}
                  </div>

                  <div className="persons-profile-status">
                    <span>
                      STATUS
                    </span>

                    <strong>
                      {selectedPerson.status ||
                        "—"}
                    </strong>
                  </div>
                </div>

                <div className="persons-profile-section">
                  <div className="persons-section-heading">
                    <UserRound
                      size={17}
                    />

                    <h3>
                      Personal Information
                    </h3>
                  </div>

                  <div className="persons-information-grid">
                    <Info
                      label="Person ID"
                      value={
                        selectedPerson.person_id
                      }
                    />

                    <Info
                      label="Full Name"
                      value={
                        selectedPerson.name
                      }
                    />

                    <Info
                      label="Age"
                      value={
                        selectedPerson.age
                      }
                    />

                    <Info
                      label="Gender"
                      value={
                        selectedPerson.gender
                      }
                    />

                    {isCaseContext ? (
                      <Info
                        label="Role in this Case"
                        value={
                          selectedPerson.role_in_case
                        }
                      />
                    ) : (
                      <Info
                        label="Associated Cases"
                        value={
                          uniqueAssociatedCases.length ||
                          "—"
                        }
                      />
                    )}

                    <Info
                      label="Status"
                      value={
                        selectedPerson.status
                      }
                    />
                  </div>
                </div>

                <div className="persons-profile-section">
                  <div className="persons-section-heading">
                    <Phone
                      size={17}
                    />

                    <h3>
                      Contact Information
                    </h3>
                  </div>

                  <div className="persons-contact-grid">
                    <div>
                      <Phone
                        size={17}
                      />

                      <span>
                        <small>
                          Phone Number
                        </small>

                        <strong>
                          {selectedPerson.phone ||
                            "—"}
                        </strong>
                      </span>
                    </div>

                    <div>
                      <MapPin
                        size={17}
                      />

                      <span>
                        <small>
                          Address
                        </small>

                        <strong>
                          {selectedPerson.address ||
                            "—"}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="persons-profile-section">
                  <div className="persons-section-heading">
                    <Link2 size={17} />
                    <h3>
                      Associated Cases
                      {` (${uniqueAssociatedCases.length})`}
                    </h3>
                  </div>

                  {detailsLoading ? (
                    <div className="persons-empty">
                      Loading associated cases...
                    </div>
                  ) : !uniqueAssociatedCases.length ? (
                    <div className="persons-empty">
                      No cases are currently linked to this person.
                    </div>
                  ) : (
                    uniqueAssociatedCases.map(
                      (caseItem) => (
                        <div
                          key={caseItem.case_database_id || caseItem.case_id || caseItem.fir_number}
                          className="persons-information-grid"
                          style={{ marginBottom: 14 }}
                        >
                          <Info
                            label="Case ID"
                            value={caseItem.case_id}
                          />
                          <Info
                            label="FIR Number"
                            value={caseItem.fir_number}
                          />
                          <Info
                            label="Role in Case"
                            value={caseItem.role_in_case}
                          />
                          <Info
                            label="Case Title"
                            value={caseItem.title}
                          />
                          <Info
                            label="Offence"
                            value={caseItem.offence}
                          />
                          <Info
                            label="Police Station"
                            value={caseItem.police_station}
                          />
                          <Info
                            label="Investigating Officer"
                            value={caseItem.investigating_officer}
                          />
                          <Info
                            label="Stage"
                            value={caseItem.stage}
                          />
                          <Info
                            label="Status"
                            value={caseItem.status}
                          />
                        </div>
                      )
                    )
                  )}
                </div>

                {!isCaseContext && (
                  <div className="persons-profile-section">
                    <div className="persons-section-heading">
                      <FileImage size={17} />
                      <h3>
                        Documents & Records
                        {getPersonDocuments(
                          selectedPersonDetails
                        ).length > 0 &&
                          ` (${getPersonDocuments(
                            selectedPersonDetails
                          ).length})`}
                      </h3>
                    </div>

                    {detailsLoading ? (
                      <div className="persons-empty compact">
                        Loading person-linked documents...
                      </div>
                    ) : getPersonDocuments(
                        selectedPersonDetails
                      ).length === 0 ? (
                      <div className="persons-empty compact">
                        No person-specific documents are linked to this identity.
                      </div>
                    ) : (
                      <div className="persons-documents-grid">
                        {getPersonDocuments(
                          selectedPersonDetails
                        ).map(
                          (
                            documentItem,
                            documentIndex
                          ) => (
                            <PersonDocumentCard
                              key={
                                documentItem?.id ||
                                documentItem?.document_id ||
                                documentItem?.file_path ||
                                documentIndex
                              }
                              documentItem={
                                documentItem
                              }
                            />
                          )
                        )}
                      </div>
                    )}
                  </div>
                )}

                {isCaseContext && (
                  <div className="persons-record-note">
                    <ShieldCheck
                      size={19}
                    />

                    <div>
                      <strong>
                        Investigator-assigned Case Role
                      </strong>

                      <span>
                        The role shown on this case page comes from the case-person association and is separate from automated intelligence priority.
                      </span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="persons-no-selection">
                <UserRound
                  size={45}
                />

                <strong>
                  No person selected
                </strong>
              </div>
            )}
          </div>
        </section>
      </main>

      {showAddModal && (
        <div className="persons-modal-backdrop">
          <div className="persons-modal">
            <div className="persons-modal-header">
              <div>
                <span>
                  CASE PERSON RECORD
                </span>

                <h2>
                  Add Person to Case
                </h2>

                <p>
                  {caseData?.case_id ||
                    `Case ${caseId}`}
                </p>
              </div>

              <button
                type="button"
                className="persons-modal-close"
                onClick={
                  closeModal
                }
              >
                <X size={20} />
              </button>
            </div>

            <div className="persons-modal-tabs">
              <button
                type="button"
                className={
                  addMode ===
                  "create"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setAddMode(
                    "create"
                  )
                }
              >
                <UserPlus
                  size={16}
                />
                Create New Person
              </button>

              <button
                type="button"
                className={
                  addMode ===
                  "existing"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setAddMode(
                    "existing"
                  )
                }
              >
                <Link2
                  size={16}
                />
                Link Existing Person
              </button>
            </div>

            {modalMessage && (
              <div className="persons-modal-message">
                {modalMessage}
              </div>
            )}

            {addMode ===
            "create" ? (
              <form
                onSubmit={
                  createPerson
                }
              >
                <div className="persons-modal-body">
                  <section className="persons-photo-section">
                    <div className="persons-photo-control">
                      <div className="persons-photo-preview">
                        {imagePreview ? (
                          <img
                            src={
                              imagePreview
                            }
                            alt="Preview"
                          />
                        ) : (
                          <Camera
                            size={38}
                          />
                        )}
                      </div>

                      <label className="persons-image-upload">
                        <Upload
                          size={15}
                        />
                        Choose Photograph

                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={
                            handleImageChange
                          }
                        />
                      </label>
                    </div>
                  </section>

                  <section className="persons-form-section">
                    <div className="persons-form-grid">
                      <FormInput
                        label="Person ID *"
                        value={
                          personForm.person_id
                        }
                        onChange={(
                          value
                        ) =>
                          updateForm(
                            "person_id",
                            value
                          )
                        }
                      />

                      <FormInput
                        label="Full Name *"
                        value={
                          personForm.name
                        }
                        onChange={(
                          value
                        ) =>
                          updateForm(
                            "name",
                            value
                          )
                        }
                      />

                      <FormInput
                        label="Age"
                        type="number"
                        value={
                          personForm.age
                        }
                        onChange={(
                          value
                        ) =>
                          updateForm(
                            "age",
                            value
                          )
                        }
                      />

                      <FormInput
                        label="Gender"
                        value={
                          personForm.gender
                        }
                        onChange={(
                          value
                        ) =>
                          updateForm(
                            "gender",
                            value
                          )
                        }
                      />

                      <FormInput
                        label="Phone"
                        value={
                          personForm.phone
                        }
                        onChange={(
                          value
                        ) =>
                          updateForm(
                            "phone",
                            value
                          )
                        }
                      />

                      <FormInput
                        label="Role in this Case *"
                        value={
                          personForm.role_in_case
                        }
                        onChange={(
                          value
                        ) =>
                          updateForm(
                            "role_in_case",
                            value
                          )
                        }
                        placeholder="Victim, Prime Suspect, Suspect 2..."
                      />

                      <label className="persons-form-full-width">
                        <span>
                          Address
                        </span>

                        <textarea
                          rows="3"
                          value={
                            personForm.address
                          }
                          onChange={(
                            event
                          ) =>
                            updateForm(
                              "address",
                              event
                                .target
                                .value
                            )
                          }
                        />
                      </label>
                    </div>
                  </section>
                </div>

                <div className="persons-modal-footer">
                  <button
                    type="button"
                    className="persons-modal-secondary"
                    onClick={
                      closeModal
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="persons-modal-primary"
                    disabled={
                      submittingPerson
                    }
                  >
                    <UserPlus
                      size={16}
                    />
                    Add Person to Case
                  </button>
                </div>
              </form>
            ) : (
              <form
                onSubmit={
                  linkExisting
                }
              >
                <div className="persons-modal-body">
                  <section className="persons-form-section">
                    <div className="persons-existing-search">
                      <Search
                        size={16}
                      />

                      <input
                        value={
                          existingSearch
                        }
                        onChange={(
                          event
                        ) =>
                          setExistingSearch(
                            event.target
                              .value
                          )
                        }
                        placeholder="Search existing persons"
                      />
                    </div>

                    <div className="persons-existing-list">
                      {availableExisting.map(
                        (person) => (
                          <button
                            key={
                              person.id
                            }
                            type="button"
                            className={`persons-existing-item ${
                              selectedExistingPerson?.id ===
                              person.id
                                ? "selected"
                                : ""
                            }`}
                            onClick={() =>
                              setSelectedExistingPerson(
                                person
                              )
                            }
                          >
                            <div className="persons-existing-photo">
                              <PersonPhoto
                                person={person}
                                fallbackSize="small"
                              />
                            </div>

                            <div className="persons-existing-copy">
                              <span>
                                {
                                  person.person_id
                                }
                              </span>

                              <strong>
                                {
                                  person.name
                                }
                              </strong>
                            </div>

                            {selectedExistingPerson?.id ===
                              person.id && (
                              <Check
                                size={18}
                              />
                            )}
                          </button>
                        )
                      )}
                    </div>

                    {selectedExistingPerson && (
                      <div className="persons-existing-role">
                        <label>
                          <span>
                            Role in this Case *
                          </span>

                          <input
                            value={
                              existingRoleInCase
                            }
                            onChange={(
                              event
                            ) =>
                              setExistingRoleInCase(
                                event
                                  .target
                                  .value
                              )
                            }
                            placeholder="Victim, Prime Suspect, Suspect 2..."
                          />
                        </label>
                      </div>
                    )}
                  </section>
                </div>

                <div className="persons-modal-footer">
                  <button
                    type="button"
                    className="persons-modal-secondary"
                    onClick={
                      closeModal
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="persons-modal-primary"
                  >
                    Link Person
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Info({
  label,
  value,
}) {
  return (
    <div>
      <span>{label}</span>

      <strong>
        {value ??
          "—"}
      </strong>
    </div>
  );
}

function FormInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
}) {
  return (
    <label>
      <span>
        {label}
      </span>

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
      />
    </label>
  );
}

export default PersonsPage;