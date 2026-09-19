import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Database,
  FileCheck2,
  FileSearch,
  FileText,
  Fingerprint,
  FolderOpen,
  Hash,
  Image as ImageIcon,
  Loader2,
  MonitorPlay,
  PhoneCall,
  RefreshCw,
  Search,
  UserRound,
  Video,
  Upload,
  X,
  ExternalLink,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import ForensicPageLayout from "../../components/layout/ForensicPageLayout.jsx";

import {
  getForensicCaseEvidence,
  getForensicCases,
} from "../../services/forensics.js";

import {
  createForensicArtifact,
  getEvidenceIntegrityHistory,
  getForensicArtifacts,
  verifyEvidenceIntegrity,
} from "../../services/forensicIntegrity.js";

import {
  analyzeCDRRecords,
  parseCDRFile,
} from "../../utils/cdrFileParser.js";

import "./DigitalForensics.css";


const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000";


/* =========================================================
   HELPERS
   ========================================================= */

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}


function formatDuration(seconds) {
  if (
    seconds === null ||
    seconds === undefined ||
    Number.isNaN(Number(seconds))
  ) {
    return "—";
  }

  const total = Math.max(
    0,
    Math.floor(Number(seconds))
  );

  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(
    (total % 3600) / 60
  );
  const remaining = total % 60;

  return [
    hours,
    minutes,
    remaining,
  ]
    .map((value) =>
      String(value).padStart(2, "0")
    )
    .join(":");
}


function formatBytes(bytes) {
  if (
    bytes === null ||
    bytes === undefined ||
    Number.isNaN(Number(bytes))
  ) {
    return "—";
  }

  const value = Number(bytes);

  if (value === 0) {
    return "0 B";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
  ];

  const index = Math.min(
    Math.floor(
      Math.log(value) /
        Math.log(1024)
    ),
    units.length - 1
  );

  return `${(
    value /
    1024 ** index
  ).toFixed(
    index === 0 ? 0 : 2
  )} ${units[index]}`;
}


function getCaseReference(record) {
  return (
    record?.case_id ||
    record?.fir_number ||
    `Case #${record?.id ?? "—"}`
  );
}


function getEvidenceReference(record) {
  return (
    record?.evidence_id ||
    `Evidence #${record?.id ?? "—"}`
  );
}


function getEvidenceTitle(record) {
  return (
    record?.title ||
    "Untitled Evidence"
  );
}


function getEvidenceType(record) {
  return (
    record?.evidence_type ||
    "Evidence"
  );
}


function deduplicateEvidence(records) {
  const map = new Map();

  records.forEach((record) => {
    const key =
      record?.id ??
      record?.evidence_id;

    if (
      key === null ||
      key === undefined
    ) {
      return;
    }

    map.set(
      String(key),
      record
    );
  });

  return Array.from(
    map.values()
  );
}


function getFileName(evidence) {
  if (!evidence?.file_path) {
    return "No file attached";
  }

  const normalized =
    String(
      evidence.file_path
    ).replace(/\\/g, "/");

  return (
    normalized
      .split("/")
      .filter(Boolean)
      .pop() ||
    "Evidence file"
  );
}


function getExtension(evidence) {
  const filename =
    getFileName(evidence);

  const index =
    filename.lastIndexOf(".");

  if (index < 0) {
    return "";
  }

  return filename
    .slice(index + 1)
    .toLowerCase();
}


function getEvidenceFileUrl(evidence) {
  if (!evidence?.file_path) {
    return null;
  }

  const raw =
    String(
      evidence.file_path
    );

  if (
    /^https?:\/\//i.test(raw)
  ) {
    return raw;
  }

  let normalized =
    raw.replace(/\\/g, "/");

  const uploadsIndex =
    normalized
      .toLowerCase()
      .indexOf("/uploads/");

  if (uploadsIndex >= 0) {
    normalized =
      normalized.slice(
        uploadsIndex
      );
  }

  if (
    normalized.startsWith(
      "uploads/"
    )
  ) {
    normalized =
      `/${normalized}`;
  }

  if (
    normalized.startsWith(
      "/uploads/"
    )
  ) {
    return `${API_BASE_URL}${normalized}`;
  }

  return null;
}


function isCDREvidence(evidence) {
  const value =
    `${evidence?.evidence_type || ""} ${evidence?.title || ""}`
      .toLowerCase();

  return (
    value.includes("cdr") ||
    value.includes("call detail") ||
    value.includes("call record") ||
    value.includes("communication")
  );
}


function isMediaEvidence(evidence) {
  const value =
    `${evidence?.evidence_type || ""} ${evidence?.title || ""}`
      .toLowerCase();

  const extension =
    getExtension(evidence);

  return (
    value.includes("cctv") ||
    value.includes("video") ||
    value.includes("image") ||
    value.includes("photo") ||
    value.includes("audio") ||
    [
      "mp4",
      "mov",
      "avi",
      "jpg",
      "jpeg",
      "png",
      "mp3",
      "wav",
    ].includes(extension)
  );
}


function isLegacySyntheticMediaPlaceholder(evidence) {
  const reference = String(
    evidence?.evidence_id || ""
  );

  const title = String(
    evidence?.title || ""
  ).toLowerCase();

  const source = String(
    evidence?.source || ""
  ).toLowerCase();

  const legacyReference =
    /^SYN-EVD-\d{3}-(04|08)$/i.test(reference);

  const legacyTitle =
    title.includes("evidence 04") ||
    title.includes("evidence 08") ||
    title.includes("cctv image evidence") ||
    title.includes("communication record evidence");

  return (
    legacyReference &&
    legacyTitle &&
    source.includes("synthetic connected dataset")
  );
}


function getRecommendedTool(evidence) {
  if (isCDREvidence(evidence)) {
    return "cdr";
  }

  if (isMediaEvidence(evidence)) {
    return "media";
  }

  return "integrity";
}


function getMediaKind(evidence) {
  const extension =
    getExtension(evidence);

  const type =
    String(
      evidence?.evidence_type ||
        ""
    ).toLowerCase();

  if (
    [
      "mp4",
      "mov",
      "avi",
    ].includes(extension) ||
    type.includes("video") ||
    type.includes("cctv")
  ) {
    return "video";
  }

  if (
    [
      "jpg",
      "jpeg",
      "png",
    ].includes(extension) ||
    type.includes("image") ||
    type.includes("photo")
  ) {
    return "image";
  }

  if (
    [
      "mp3",
      "wav",
    ].includes(extension) ||
    type.includes("audio")
  ) {
    return "audio";
  }

  return "unknown";
}


function arrayBufferToHex(buffer) {
  return Array.from(
    new Uint8Array(buffer)
  )
    .map((byte) =>
      byte
        .toString(16)
        .padStart(2, "0")
    )
    .join("");
}


/* =========================================================
   PAGE
   ========================================================= */

function DigitalForensics() {
  const navigate =
    useNavigate();

  const [searchParams] =
    useSearchParams();


  const initialEvidence =
    useRef(
      searchParams.get("evidence")
    ).current;

  const initialCase =
    useRef(
      searchParams.get("case")
    ).current;

  const initialAssignment =
    useRef(
      searchParams.get("assignment")
    ).current;

  const initialTool =
    useRef(
      searchParams.get("tool")
    ).current;


  const validInitialTool =
    [
      "integrity",
      "media",
      "cdr",
    ].includes(initialTool)
      ? initialTool
      : null;


  const [
    cases,
    setCases,
  ] = useState([]);

  const [
    evidence,
    setEvidence,
  ] = useState([]);

  const [
    selectedEvidenceId,
    setSelectedEvidenceId,
  ] = useState(null);

  const [
    activeTool,
    setActiveTool,
  ] = useState(
    validInitialTool ||
      "integrity"
  );

  const [
    searchText,
    setSearchText,
  ] = useState("");

  const [
    caseFilter,
    setCaseFilter,
  ] = useState("");

  const [
    mediaTypeFilter,
    setMediaTypeFilter,
  ] = useState("all");

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


  /* HASH */

  const [
    hashLoading,
    setHashLoading,
  ] = useState(false);

  const [
    hashValue,
    setHashValue,
  ] = useState("");

  const [
    hashError,
    setHashError,
  ] = useState("");

  const [
    hashFileSize,
    setHashFileSize,
  ] = useState(null);

  const [
    candidateFile,
    setCandidateFile,
  ] = useState(null);

  const [
    candidateHash,
    setCandidateHash,
  ] = useState("");

  const [
    candidateLoading,
    setCandidateLoading,
  ] = useState(false);

  const [
    candidateError,
    setCandidateError,
  ] = useState("");

  const [
    candidateMatches,
    setCandidateMatches,
  ] = useState(null);

  const candidateInputRef =
    useRef(null);

  const [
    integrityResult,
    setIntegrityResult,
  ] = useState(null);

  const [
    integrityHistory,
    setIntegrityHistory,
  ] = useState([]);

  const [
    integrityHistoryLoading,
    setIntegrityHistoryLoading,
  ] = useState(false);

  const [
    integrityHistoryError,
    setIntegrityHistoryError,
  ] = useState("");

  const [
    artifacts,
    setArtifacts,
  ] = useState([]);

  const [
    artifactsLoading,
    setArtifactsLoading,
  ] = useState(false);

  const [
    artifactError,
    setArtifactError,
  ] = useState("");

  const [
    artifactSuccess,
    setArtifactSuccess,
  ] = useState("");

  const [
    artifactUploading,
    setArtifactUploading,
  ] = useState(false);

  const [
    showArtifactForm,
    setShowArtifactForm,
  ] = useState(false);

  const [
    artifactForm,
    setArtifactForm,
  ] = useState({
    title: "",
    artifactType: "Forensic Report",
    description: "",
    file: null,
  });

  const artifactFileInputRef =
    useRef(null);


  /* MEDIA */

  const [
    mediaMetadata,
    setMediaMetadata,
  ] = useState(null);

  const [
    mediaError,
    setMediaError,
  ] = useState("");

  // Changes whenever the analyst refreshes the workspace.
  // This forces the browser to request the latest bytes for media
  // even when the evidence filename itself has not changed.
  const [
    mediaCacheKey,
    setMediaCacheKey,
  ] = useState(() => Date.now());


  /* CDR */

  const [
    cdrLoading,
    setCdrLoading,
  ] = useState(false);

  const [
    cdrError,
    setCdrError,
  ] = useState("");

  const [
    cdrRecords,
    setCdrRecords,
  ] = useState([]);

  const [
    cdrAnalysis,
    setCdrAnalysis,
  ] = useState(null);

  const [
    cdrSourceFormat,
    setCdrSourceFormat,
  ] = useState("");


  /* =======================================================
     LOAD WORKSPACE
     ======================================================= */

  const loadWorkspace =
    useCallback(
      async (
        manualRefresh = false
      ) => {
        if (manualRefresh) {
          setRefreshing(true);
          setMediaCacheKey(Date.now());
        } else {
          setLoading(true);
        }

        setError("");

        try {
          const caseData =
            await getForensicCases();

          const assignedCases =
            Array.isArray(caseData)
              ? caseData
              : [];

          setCases(
            assignedCases
          );


          const results =
            await Promise.allSettled(
              assignedCases.map(
                (caseRecord) =>
                  getForensicCaseEvidence(
                    caseRecord.id
                  )
              )
            );


          const combined = [];

          results.forEach(
            (result) => {
              if (
                result.status ===
                  "fulfilled" &&
                Array.isArray(
                  result.value
                )
              ) {
                combined.push(
                  ...result.value
                );
              }
            }
          );


          const uniqueEvidence =
            deduplicateEvidence(
              combined
            );

          setEvidence(
            uniqueEvidence
          );


          let preferred =
            null;


          if (initialEvidence) {
            preferred =
              uniqueEvidence.find(
                (item) =>
                  String(item.id) ===
                    String(
                      initialEvidence
                    ) ||
                  String(
                    item.evidence_id
                  ) ===
                    String(
                      initialEvidence
                    )
              ) || null;
          }


          if (
            !preferred &&
            initialCase
          ) {
            preferred =
              uniqueEvidence.find(
                (item) =>
                  String(
                    item.case_id
                  ) ===
                  String(
                    initialCase
                  )
              ) || null;
          }


          if (!preferred) {
            preferred =
              uniqueEvidence[0] ||
              null;
          }


          if (preferred) {
            setSelectedEvidenceId(
              preferred.id ??
                preferred.evidence_id
            );

            setCaseFilter((current) =>
              current || String(preferred.case_id || "")
            );

            if (!validInitialTool) {
              setActiveTool(
                getRecommendedTool(
                  preferred
                )
              );
            }
          } else {
            setSelectedEvidenceId(
              null
            );
          }

        } catch (
          requestError
        ) {
          console.error(
            "Digital forensics load error:",
            requestError
          );

          setEvidence([]);

          setError(
            requestError?.message ||
              "Unable to load digital forensic evidence."
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        initialEvidence,
        initialCase,
        validInitialTool,
      ]
    );


  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);


  /* =======================================================
     DERIVED DATA
     ======================================================= */

  const caseMap =
    useMemo(() => {
      const map =
        new Map();

      cases.forEach(
        (caseRecord) => {
          map.set(
            Number(
              caseRecord.id
            ),
            caseRecord
          );
        }
      );

      return map;
    }, [cases]);


  const selectedEvidence =
    useMemo(
      () =>
        evidence.find(
          (item) =>
            String(
              item.id ??
                item.evidence_id
            ) ===
            String(
              selectedEvidenceId
            )
        ) || null,
      [
        evidence,
        selectedEvidenceId,
      ]
    );


  const selectedCase =
    selectedEvidence
      ? caseMap.get(
          Number(
            selectedEvidence.case_id
          )
        )
      : null;


  const selectedFileUrlBase =
    selectedEvidence
      ? getEvidenceFileUrl(selectedEvidence)
      : null;

  const selectedFileUrl =
    selectedFileUrlBase
      ? `${selectedFileUrlBase}${
          selectedFileUrlBase.includes("?")
            ? "&"
            : "?"
        }v=${mediaCacheKey}`
      : null;

  const toolEvidence =
    useMemo(() => {
      let records =
        evidence;


      if (
        activeTool === "media"
      ) {
        records =
          evidence.filter(
            (item) =>
              isMediaEvidence(item) &&
              !isLegacySyntheticMediaPlaceholder(item)
          );
      }


      if (
        activeTool === "cdr"
      ) {
        records =
          evidence.filter(
            (item) =>
              isCDREvidence(item) &&
              !isLegacySyntheticMediaPlaceholder(item)
          );
      }


      if (caseFilter) {
        records = records.filter(
          (item) =>
            String(item.case_id) ===
            String(caseFilter)
        );
      }


      if (
        activeTool === "media" &&
        mediaTypeFilter !== "all"
      ) {
        records = records.filter(
          (item) =>
            getMediaKind(item) ===
            mediaTypeFilter
        );
      }


      const query =
        searchText
          .trim()
          .toLowerCase();


      if (!query) {
        return records;
      }


      return records.filter(
        (item) =>
          [
            item.evidence_id,
            item.title,
            item.evidence_type,
            item.source,
            item.description,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(query)
      );
    }, [
      evidence,
      activeTool,
      searchText,
      caseFilter,
      mediaTypeFilter,
    ]);


  useEffect(() => {
    if (!toolEvidence.length) {
      return;
    }

    const selectedVisible =
      toolEvidence.some(
        (item) =>
          String(
            item.id ??
              item.evidence_id
          ) ===
          String(selectedEvidenceId)
      );

    if (!selectedVisible) {
      const first = toolEvidence[0];
      setSelectedEvidenceId(
        first.id ??
          first.evidence_id
      );
    }
  }, [
    toolEvidence,
    selectedEvidenceId,
  ]);

  /* =======================================================
     TOOL CHANGE
     ======================================================= */

  function changeTool(tool) {
    setActiveTool(tool);


    if (
      tool === "media" &&
      selectedEvidence &&
      !isMediaEvidence(
        selectedEvidence
      )
    ) {
      const firstMedia =
        evidence.find(
          isMediaEvidence
        );

      if (firstMedia) {
        setSelectedEvidenceId(
          firstMedia.id ??
            firstMedia.evidence_id
        );
      }
    }


    if (
      tool === "cdr" &&
      selectedEvidence &&
      !isCDREvidence(
        selectedEvidence
      )
    ) {
      const firstCDR =
        evidence.find(
          isCDREvidence
        );

      if (firstCDR) {
        setSelectedEvidenceId(
          firstCDR.id ??
            firstCDR.evidence_id
        );
      }
    }
  }


  useEffect(() => {
    setHashValue("");
    setHashError("");
    setHashFileSize(null);
    setIntegrityResult(null);

    setCandidateFile(null);
    setCandidateHash("");
    setCandidateError("");
    setCandidateMatches(null);

    if (
      candidateInputRef.current
    ) {
      candidateInputRef.current.value =
        "";
    }

    setIntegrityHistory([]);
    setIntegrityHistoryError("");

    setArtifacts([]);
    setArtifactError("");
    setArtifactSuccess("");
    setShowArtifactForm(false);
    setArtifactForm({
      title: "",
      artifactType: "Forensic Report",
      description: "",
      file: null,
    });

    if (
      artifactFileInputRef.current
    ) {
      artifactFileInputRef.current.value =
        "";
    }

    setMediaMetadata(null);
    setMediaError("");

    setCdrRecords([]);
    setCdrAnalysis(null);
    setCdrError("");
    setCdrSourceFormat("");
  }, [
    selectedEvidenceId,
  ]);


  async function refreshIntegrityHistory(
    evidenceDatabaseId
  ) {
    if (!evidenceDatabaseId) {
      setIntegrityHistory([]);
      return;
    }

    setIntegrityHistoryLoading(true);
    setIntegrityHistoryError("");

    try {
      const history =
        await getEvidenceIntegrityHistory(
          evidenceDatabaseId
        );

      setIntegrityHistory(
        Array.isArray(history)
          ? history
          : []
      );
    } catch (
      requestError
    ) {
      console.error(
        "Integrity history error:",
        requestError
      );

      setIntegrityHistory([]);

      setIntegrityHistoryError(
        requestError?.message ||
          "Unable to load integrity verification history."
      );
    } finally {
      setIntegrityHistoryLoading(false);
    }
  }


  async function refreshArtifacts(
    caseId
  ) {
    if (!caseId) {
      setArtifacts([]);
      return;
    }

    setArtifactsLoading(true);
    setArtifactError("");

    try {
      const records =
        await getForensicArtifacts(
          caseId
        );

      setArtifacts(
        Array.isArray(records)
          ? records
          : []
      );
    } catch (
      requestError
    ) {
      console.error(
        "Forensic artifacts error:",
        requestError
      );

      setArtifacts([]);

      setArtifactError(
        requestError?.message ||
          "Unable to load forensic outputs."
      );
    } finally {
      setArtifactsLoading(false);
    }
  }


  useEffect(() => {
    if (!selectedEvidence?.id) {
      return;
    }

    refreshIntegrityHistory(
      selectedEvidence.id
    );

    if (selectedEvidence.case_id) {
      refreshArtifacts(
        selectedEvidence.case_id
      );
    }
  }, [
    selectedEvidence?.id,
    selectedEvidence?.case_id,
  ]);


  /* =======================================================
     HASH & INTEGRITY
     ======================================================= */

  async function computeHash() {
    if (!selectedEvidence?.id) {
      setHashError(
        "No evidence record is selected."
      );

      return;
    }


    setHashLoading(true);
    setHashError("");
    setHashValue("");
    setHashFileSize(null);
    setIntegrityResult(null);


    try {
      const result =
        await verifyEvidenceIntegrity(
          selectedEvidence.id
        );

      setIntegrityResult(
        result
      );

      setHashValue(
        result?.current_hash ||
          ""
      );

      setHashFileSize(
        result?.file_size ??
          null
      );

      await refreshIntegrityHistory(
        selectedEvidence.id
      );

    } catch (
      requestError
    ) {
      console.error(
        "Integrity verification error:",
        requestError
      );

      setHashError(
        requestError?.message ||
          "Unable to verify evidence integrity."
      );
    } finally {
      setHashLoading(false);
    }
  }


  async function compareCandidateCopy() {
    if (!candidateFile) {
      setCandidateError(
        "Choose the suspected copy you want to compare."
      );
      return;
    }

    const baselineHash =
      integrityResult?.baseline_hash ||
      selectedEvidence?.sha256_hash ||
      "";

    if (!baselineHash) {
      setCandidateError(
        "Run Verify Integrity once first so CINTRA can load the official baseline SHA-256."
      );
      return;
    }

    setCandidateLoading(true);
    setCandidateError("");
    setCandidateHash("");
    setCandidateMatches(null);

    try {
      const buffer =
        await candidateFile.arrayBuffer();

      const digest =
        await window.crypto.subtle.digest(
          "SHA-256",
          buffer
        );

      const calculatedHash =
        arrayBufferToHex(
          digest
        );

      const matches =
        String(
          calculatedHash
        ).toLowerCase() ===
        String(
          baselineHash
        ).toLowerCase();

      setCandidateHash(
        calculatedHash
      );

      setCandidateMatches(
        matches
      );
    } catch (
      requestError
    ) {
      console.error(
        "Candidate copy comparison error:",
        requestError
      );

      setCandidateError(
        requestError?.message ||
          "Unable to compare the selected copy."
      );
    } finally {
      setCandidateLoading(false);
    }
  }


  async function handleArtifactSubmit(
    event
  ) {
    event.preventDefault();

    if (!selectedEvidence?.case_id) {
      setArtifactError(
        "No assigned case is available for this evidence."
      );
      return;
    }

    if (!artifactForm.title.trim()) {
      setArtifactError(
        "Enter a title for the forensic artifact."
      );
      return;
    }

    if (!artifactForm.file) {
      setArtifactError(
        "Choose a forensic artifact file."
      );
      return;
    }

    setArtifactUploading(true);
    setArtifactError("");
    setArtifactSuccess("");

    try {
      const created =
        await createForensicArtifact({
          caseId:
            selectedEvidence.case_id,

          sourceEvidenceId:
            selectedEvidence.id ??
            null,

          title:
            artifactForm.title.trim(),

          artifactType:
            artifactForm.artifactType,

          description:
            artifactForm.description.trim(),

          file:
            artifactForm.file,
        });

      setArtifactSuccess(
        `${created?.artifact_id || "Forensic artifact"} added successfully.`
      );

      setArtifactForm({
        title: "",
        artifactType: "Forensic Report",
        description: "",
        file: null,
      });

      if (
        artifactFileInputRef.current
      ) {
        artifactFileInputRef.current.value =
          "";
      }

      setShowArtifactForm(false);

      await refreshArtifacts(
        selectedEvidence.case_id
      );

    } catch (
      requestError
    ) {
      console.error(
        "Forensic artifact upload error:",
        requestError
      );

      setArtifactError(
        requestError?.message ||
          "Unable to add forensic artifact."
      );
    } finally {
      setArtifactUploading(false);
    }
  }


  /* =======================================================
     CDR
     ======================================================= */

  async function runCDRAnalysis() {
    if (!selectedFileUrl) {
      setCdrError(
        "No accessible evidence file is attached to this CDR record."
      );

      return;
    }


    setCdrLoading(true);
    setCdrError("");
    setCdrRecords([]);
    setCdrAnalysis(null);
    setCdrSourceFormat("");


    try {
      const response =
        await fetch(
          selectedFileUrl
        );


      if (!response.ok) {
        throw new Error(
          `CDR evidence could not be loaded (${response.status}).`
        );
      }


      const buffer =
        await response.arrayBuffer();

      const extension =
        getExtension(
          selectedEvidence
        );


      const records =
        await parseCDRFile(
          buffer,
          extension
        );


      if (
        !Array.isArray(
          records
        ) ||
        records.length === 0
      ) {
        throw new Error(
          "No communication records were found in this evidence file."
        );
      }


      const analysis =
        analyzeCDRRecords(
          records
        );


      if (!analysis) {
        throw new Error(
          "CINTRA could not calculate communication statistics from the evidence file."
        );
      }


      setCdrRecords(
        records
      );

      setCdrAnalysis(
        analysis
      );

      setCdrSourceFormat(
        extension
          ? extension.toUpperCase()
          : "FILE"
      );

    } catch (
      requestError
    ) {
      console.error(
        "CDR analysis error:",
        requestError
      );

      setCdrError(
        requestError?.message ||
          "Unable to analyse the CDR evidence."
      );
    } finally {
      setCdrLoading(false);
    }
  }


  /* =======================================================
     CASEWORK
     ======================================================= */

  function returnToCasework() {
    const caseId =
      selectedEvidence?.case_id ||
      initialCase;


    if (!caseId) {
      navigate(
        "/forensic/assignments"
      );

      return;
    }


    const params =
      new URLSearchParams();

    params.set(
      "case",
      String(caseId)
    );


    if (
      initialAssignment
    ) {
      params.set(
        "assignment",
        String(
          initialAssignment
        )
      );
    }


    navigate(
      `/forensic/evidence?${params.toString()}`
    );
  }


  /* =======================================================
     UI
     ======================================================= */

  return (
    <ForensicPageLayout
      module="digital-forensics"
    >
      <div className="df-lab">

        <section className="df-lab-header">

          <div>

            <span className="df-lab-eyebrow">
              FORENSIC ANALYST · DIGITAL FORENSICS
            </span>

            <h1>
              Digital Examination Laboratory
            </h1>

            <p>
              Perform technical examination of digital evidence linked to your assigned investigations.
            </p>

          </div>


          <div
            style={{
              display: "flex",
              gap: "10px",
            }}
          >

            {initialCase && (
              <button
                type="button"
                className="df-refresh"
                onClick={
                  returnToCasework
                }
              >
                <FolderOpen
                  size={16}
                />

                Casework
              </button>
            )}


            <button
              type="button"
              className="df-refresh"
              disabled={
                loading ||
                refreshing
              }
              onClick={() =>
                loadWorkspace(true)
              }
            >
              <RefreshCw
                size={16}
                className={
                  refreshing
                    ? "df-spin"
                    : ""
                }
              />

              {refreshing
                ? "Refreshing"
                : "Refresh"}
            </button>

          </div>

        </section>


        <section className="df-tool-strip">

          <button
            type="button"
            className={
              activeTool ===
              "integrity"
                ? "active"
                : ""
            }
            onClick={() =>
              changeTool(
                "integrity"
              )
            }
          >
            <Fingerprint
              size={18}
            />

            <span>
              Hash & Integrity
            </span>

            <small>
              Verify evidence files
            </small>
          </button>


          <button
            type="button"
            className={
              activeTool ===
              "media"
                ? "active"
                : ""
            }
            onClick={() =>
              changeTool(
                "media"
              )
            }
          >
            <MonitorPlay
              size={18}
            />

            <span>
              Media Analysis
            </span>

            <small>
              CCTV, images & audio
            </small>
          </button>


          <button
            type="button"
            className={
              activeTool ===
              "cdr"
                ? "active"
                : ""
            }
            onClick={() =>
              changeTool(
                "cdr"
              )
            }
          >
            <PhoneCall
              size={18}
            />

            <span>
              CDR Analysis
            </span>

            <small>
              Communication records
            </small>
          </button>

        </section>


        {error && (
          <div className="df-error">

            <AlertCircle
              size={18}
            />

            {error}

          </div>
        )}


        {loading ? (
          <div className="df-loading">

            <Loader2
              size={26}
              className="df-spin"
            />

            Loading forensic evidence…

          </div>
        ) : (
          <div className="df-lab-workspace">

            <aside className="df-lab-queue">

              <div className="df-queue-title">

                <span>
                  {activeTool ===
                  "integrity"
                    ? "EVIDENCE FILES"
                    : activeTool ===
                        "media"
                      ? "MEDIA EVIDENCE"
                      : "COMMUNICATION EVIDENCE"}
                </span>


                <strong>
                  {toolEvidence.length}{" "}
                  {toolEvidence.length ===
                  1
                    ? "record"
                    : "records"}
                </strong>

              </div>


              <div className="df-queue-search">

                <Search
                  size={15}
                />

                <input
                  value={
                    searchText
                  }
                  onChange={(
                    event
                  ) =>
                    setSearchText(
                      event.target.value
                    )
                  }
                  placeholder="Search evidence"
                />

              </div>


              <div className="df-queue-filters">

                <select
                  value={caseFilter}
                  onChange={(event) =>
                    setCaseFilter(
                      event.target.value
                    )
                  }
                  aria-label="Filter evidence by assigned case"
                >
                  <option value="">
                    All assigned cases
                  </option>

                  {cases.map((caseRecord) => (
                    <option
                      key={caseRecord.id}
                      value={String(caseRecord.id)}
                    >
                      {getCaseReference(caseRecord)}
                    </option>
                  ))}
                </select>

                {activeTool === "media" && (
                  <select
                    value={mediaTypeFilter}
                    onChange={(event) =>
                      setMediaTypeFilter(
                        event.target.value
                      )
                    }
                    aria-label="Filter media type"
                  >
                    <option value="all">
                      All media
                    </option>
                    <option value="video">
                      Video / CCTV
                    </option>
                    <option value="audio">
                      Audio
                    </option>
                    <option value="image">
                      Images
                    </option>
                  </select>
                )}

              </div>


              <div className="df-queue-list">

                {toolEvidence.length ===
                0 ? (
                  <div className="df-queue-empty">

                    <FileSearch
                      size={25}
                    />

                    No suitable evidence for this forensic tool.

                  </div>
                ) : (
                  toolEvidence.map(
                    (item) => {
                      const key =
                        item.id ??
                        item.evidence_id;

                      const selected =
                        String(key) ===
                        String(
                          selectedEvidenceId
                        );

                      const caseRecord =
                        caseMap.get(
                          Number(
                            item.case_id
                          )
                        );


                      return (
                        <button
                          key={key}
                          type="button"
                          className={
                            selected
                              ? "df-queue-record active"
                              : "df-queue-record"
                          }
                          onClick={() =>
                            setSelectedEvidenceId(
                              key
                            )
                          }
                        >

                          <FileText
                            size={17}
                          />


                          <div>

                            <strong>
                              {getEvidenceReference(
                                item
                              )}
                            </strong>


                            <span>
                              {getEvidenceTitle(
                                item
                              )}
                            </span>


                            <small>
                              {getCaseReference(
                                caseRecord
                              )}
                            </small>

                          </div>

                        </button>
                      );
                    }
                  )
                )}

              </div>

            </aside>


            <main className="df-lab-main">

              {!selectedEvidence ? (
                <div className="df-no-selection">

                  <FileSearch
                    size={36}
                  />

                  <h3>
                    Select evidence
                  </h3>

                  <p>
                    Choose evidence from the forensic queue.
                  </p>

                </div>
              ) : (
                <>

                  <header className="df-evidence-header">

                    <div>

                      <div className="df-evidence-tags">

                        <span>
                          {getEvidenceReference(
                            selectedEvidence
                          )}
                        </span>

                        <span>
                          {getEvidenceType(
                            selectedEvidence
                          )}
                        </span>

                        <span>
                          {selectedEvidence.status ||
                            "Recorded"}
                        </span>

                      </div>


                      <h2>
                        {getEvidenceTitle(
                          selectedEvidence
                        )}
                      </h2>


                      <p>
                        {selectedCase
                          ? getCaseReference(
                              selectedCase
                            )
                          : `Case #${selectedEvidence.case_id}`}
                        {" · "}
                        {selectedEvidence.source ||
                          "Source not recorded"}
                      </p>

                    </div>


                    <div className="df-file-state">

                      {selectedFileUrl ? (
                        <>

                          <FileCheck2
                            size={18}
                          />

                          <div>

                            <span>
                              Evidence file
                            </span>

                            <strong>
                              Available
                              {getExtension(
                                selectedEvidence
                              )
                                ? ` · ${getExtension(
                                    selectedEvidence
                                  ).toUpperCase()}`
                                : ""}
                            </strong>

                          </div>

                        </>
                      ) : (
                        <>

                          <AlertCircle
                            size={18}
                          />

                          <div>

                            <span>
                              Evidence file
                            </span>

                            <strong>
                              Not attached
                            </strong>

                          </div>

                        </>
                      )}

                    </div>

                  </header>


                  {activeTool ===
                    "integrity" && (
                    <section className="df-tool-panel">

                      <div className="df-panel-heading">

                        <div>

                          <span>
                            FORENSIC INTEGRITY
                          </span>

                          <h3>
                            SHA-256 Verification
                          </h3>

                          <p>
                            Recalculate the current server file and compare it with the immutable SHA-256 baseline recorded for the original evidence.
                          </p>

                        </div>


                        <Hash
                          size={24}
                        />

                      </div>


                      <div className="df-integrity-layout">

                        <div className="df-integrity-details">

                          <div>

                            <span>
                              Evidence ID
                            </span>

                            <strong>
                              {getEvidenceReference(
                                selectedEvidence
                              )}
                            </strong>

                          </div>


                          <div>

                            <span>
                              File
                            </span>

                            <strong>
                              {getFileName(
                                selectedEvidence
                              )}
                            </strong>

                          </div>


                          <div>

                            <span>
                              Collected By
                            </span>

                            <strong>
                              {selectedEvidence.collected_by ||
                                "—"}
                            </strong>

                          </div>


                          <div>

                            <span>
                              Collected
                            </span>

                            <strong>
                              {formatDate(
                                selectedEvidence.collected_at
                              )}
                            </strong>

                          </div>

                        </div>


                        <div className="df-hash-box">

                          <div className="df-hash-label">

                            <Fingerprint
                              size={19}
                            />

                            Integrity Verification

                          </div>


                          {!integrityResult &&
                            !hashLoading && (
                              <div className="df-hash-empty">
                                No server-side integrity check has been run for this evidence in this session.
                              </div>
                            )}


                          {hashLoading && (
                            <div className="df-hash-loading">

                              <Loader2
                                size={19}
                                className="df-spin"
                              />

                              Recalculating current SHA-256…

                            </div>
                          )}


                          {integrityResult && (
                            <>

                              <div
                                style={{
                                  display: "grid",
                                  gap: "14px",
                                }}
                              >

                                <div>

                                  <span
                                    style={{
                                      display: "block",
                                      marginBottom: "6px",
                                      fontSize: "11px",
                                      fontWeight: 700,
                                      letterSpacing: "0.08em",
                                      color: "#64748b",
                                    }}
                                  >
                                    BASELINE SHA-256
                                  </span>

                                  <code className="df-hash-value">
                                    {integrityResult.baseline_hash ||
                                      selectedEvidence.sha256_hash ||
                                      "No stored baseline hash"}
                                  </code>

                                </div>


                                <div>

                                  <span
                                    style={{
                                      display: "block",
                                      marginBottom: "6px",
                                      fontSize: "11px",
                                      fontWeight: 700,
                                      letterSpacing: "0.08em",
                                      color: "#64748b",
                                    }}
                                  >
                                    CURRENT SHA-256
                                  </span>

                                  <code className="df-hash-value">
                                    {integrityResult.current_hash ||
                                      hashValue ||
                                      "—"}
                                  </code>

                                </div>

                              </div>


                              {integrityResult.status ===
                              "VERIFIED" ? (
                                <div className="df-hash-result">

                                  <CheckCircle2
                                    size={17}
                                  />

                                  <div>

                                    <strong>
                                      Integrity verified
                                    </strong>

                                    <span>
                                      Original baseline and current server file match
                                      {hashFileSize !== null
                                        ? ` · File size: ${formatBytes(
                                            hashFileSize
                                          )}`
                                        : ""}
                                    </span>

                                  </div>

                                </div>
                              ) : (
                                <div className="df-tool-error">

                                  <AlertCircle
                                    size={17}
                                  />

                                  <div>

                                    <strong>
                                      Integrity compromised
                                    </strong>

                                    <div>
                                      The current evidence file does not match the immutable SHA-256 baseline recorded for the original evidence.
                                    </div>

                                  </div>

                                </div>
                              )}


                              <div
                                style={{
                                  marginTop: "12px",
                                  display: "grid",
                                  gap: "4px",
                                  fontSize: "12px",
                                  color: "#64748b",
                                }}
                              >
                                <span>
                                  Verified by:{" "}
                                  <strong
                                    style={{
                                      color: "#334155",
                                    }}
                                  >
                                    {integrityResult.verified_by ||
                                      "—"}
                                  </strong>
                                </span>

                                <span>
                                  Verified at:{" "}
                                  <strong
                                    style={{
                                      color: "#334155",
                                    }}
                                  >
                                    {formatDate(
                                      integrityResult.verified_at
                                    )}
                                  </strong>
                                </span>
                              </div>

                            </>
                          )}


                          {hashError && (
                            <div className="df-tool-error">

                              <AlertCircle
                                size={17}
                              />

                              {hashError}

                            </div>
                          )}


                          <button
                            type="button"
                            className="df-primary-action"
                            disabled={
                              hashLoading ||
                              !selectedEvidence?.id
                            }
                            onClick={
                              computeHash
                            }
                          >

                            {hashLoading ? (
                              <Loader2
                                size={16}
                                className="df-spin"
                              />
                            ) : (
                              <Fingerprint
                                size={16}
                              />
                            )}

                            {integrityResult
                              ? "Verify Integrity Again"
                              : "Verify Integrity"}

                          </button>


                          <div
                            style={{
                              marginTop: "18px",
                              paddingTop: "16px",
                              borderTop: "1px solid #e2e8f0",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "12px",
                                fontWeight: 800,
                                color: "#0f172a",
                              }}
                            >
                              Compare Suspected Copy
                            </div>

                            <div
                              style={{
                                marginTop: "4px",
                                fontSize: "11px",
                                lineHeight: 1.5,
                                color: "#64748b",
                              }}
                            >
                              Select a received or suspected copy and compare it with the immutable original baseline. This does not replace or modify the stored evidence.
                            </div>


                            <input
                              ref={
                                candidateInputRef
                              }
                              type="file"
                              onChange={(
                                event
                              ) => {
                                const file =
                                  event.target.files?.[0] ||
                                  null;

                                setCandidateFile(
                                  file
                                );

                                setCandidateHash(
                                  ""
                                );

                                setCandidateMatches(
                                  null
                                );

                                setCandidateError(
                                  ""
                                );
                              }}
                              style={{
                                width: "100%",
                                marginTop: "12px",
                                padding: "9px",
                                border: "1px solid #cbd5e1",
                                borderRadius: "7px",
                                background: "#ffffff",
                                color: "#334155",
                              }}
                            />


                            <button
                              type="button"
                              className="df-refresh"
                              disabled={
                                candidateLoading ||
                                !candidateFile
                              }
                              onClick={
                                compareCandidateCopy
                              }
                              style={{
                                marginTop: "10px",
                              }}
                            >
                              {candidateLoading ? (
                                <Loader2
                                  size={15}
                                  className="df-spin"
                                />
                              ) : (
                                <FileSearch
                                  size={15}
                                />
                              )}

                              {candidateLoading
                                ? "Comparing…"
                                : "Compare With Baseline"}
                            </button>


                            {candidateError && (
                              <div
                                className="df-tool-error"
                                style={{
                                  marginTop: "10px",
                                }}
                              >
                                <AlertCircle
                                  size={17}
                                />

                                {candidateError}
                              </div>
                            )}


                            {candidateHash &&
                              candidateMatches ===
                                true && (
                                <div
                                  className="df-hash-result"
                                  style={{
                                    marginTop: "10px",
                                  }}
                                >
                                  <CheckCircle2
                                    size={17}
                                  />

                                  <div>
                                    <strong>
                                      COPY MATCHES ORIGINAL
                                    </strong>

                                    <span>
                                      The selected file has the same SHA-256 as the official baseline.
                                    </span>
                                  </div>
                                </div>
                              )}


                            {candidateHash &&
                              candidateMatches ===
                                false && (
                                <div
                                  className="df-tool-error"
                                  style={{
                                    marginTop: "10px",
                                  }}
                                >
                                  <AlertCircle
                                    size={17}
                                  />

                                  <div>
                                    <strong>
                                      INTEGRITY COMPROMISED
                                    </strong>

                                    <div>
                                      The selected copy does not match the immutable original SHA-256 baseline.
                                    </div>
                                  </div>
                                </div>
                              )}


                            {candidateHash && (
                              <div
                                style={{
                                  marginTop: "10px",
                                  display: "grid",
                                  gap: "6px",
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: "10px",
                                    fontWeight: 800,
                                    letterSpacing: "0.07em",
                                    color: "#64748b",
                                  }}
                                >
                                  SUSPECTED COPY SHA-256
                                </span>

                                <code className="df-hash-value">
                                  {candidateHash}
                                </code>

                                <span
                                  style={{
                                    fontSize: "10px",
                                    color: "#64748b",
                                  }}
                                >
                                  Local comparison only · Original evidence and verification history remain unchanged.
                                </span>
                              </div>
                            )}
                          </div>

                        </div>

                      </div>


                      <div
                        style={{
                          marginTop: "22px",
                          paddingTop: "20px",
                          borderTop: "1px solid #e2e8f0",
                        }}
                      >

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "12px",
                            marginBottom: "12px",
                          }}
                        >

                          <div>

                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                fontSize: "13px",
                                fontWeight: 800,
                                color: "#0f172a",
                              }}
                            >
                              <Clock3
                                size={16}
                              />

                              Verification History
                            </div>

                            <div
                              style={{
                                marginTop: "4px",
                                fontSize: "12px",
                                color: "#64748b",
                              }}
                            >
                              Each integrity check is recorded with the analyst and timestamp.
                            </div>

                          </div>


                          <button
                            type="button"
                            className="df-refresh"
                            disabled={
                              integrityHistoryLoading ||
                              !selectedEvidence?.id
                            }
                            onClick={() =>
                              refreshIntegrityHistory(
                                selectedEvidence.id
                              )
                            }
                          >
                            <RefreshCw
                              size={14}
                              className={
                                integrityHistoryLoading
                                  ? "df-spin"
                                  : ""
                              }
                            />

                            Refresh
                          </button>

                        </div>


                        {integrityHistoryError && (
                          <div className="df-tool-error">

                            <AlertCircle
                              size={17}
                            />

                            {integrityHistoryError}

                          </div>
                        )}


                        {integrityHistoryLoading ? (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              padding: "14px 0",
                              color: "#64748b",
                              fontSize: "13px",
                            }}
                          >
                            <Loader2
                              size={17}
                              className="df-spin"
                            />

                            Loading verification history…
                          </div>
                        ) : integrityHistory.length ===
                          0 ? (
                          <div
                            style={{
                              padding: "14px",
                              border: "1px dashed #cbd5e1",
                              borderRadius: "8px",
                              fontSize: "13px",
                              color: "#64748b",
                            }}
                          >
                            No previous integrity checks are recorded for this evidence.
                          </div>
                        ) : (
                          <div
                            style={{
                              display: "grid",
                              gap: "8px",
                            }}
                          >
                            {integrityHistory.map(
                              (check) => {
                                const verified =
                                  check.status ===
                                  "VERIFIED";

                                return (
                                  <div
                                    key={
                                      check.id
                                    }
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns:
                                        "minmax(110px, 0.7fr) minmax(130px, 0.8fr) minmax(160px, 1fr)",
                                      gap: "12px",
                                      alignItems: "center",
                                      padding: "11px 12px",
                                      border: "1px solid #e2e8f0",
                                      borderRadius: "8px",
                                      background: "#ffffff",
                                    }}
                                  >

                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "7px",
                                        color: verified
                                          ? "#166534"
                                          : "#b91c1c",
                                        fontWeight: 800,
                                        fontSize: "12px",
                                      }}
                                    >
                                      {verified ? (
                                        <CheckCircle2
                                          size={15}
                                        />
                                      ) : (
                                        <AlertCircle
                                          size={15}
                                        />
                                      )}

                                      {verified
                                        ? "VERIFIED"
                                        : "MISMATCH"}
                                    </div>


                                    <div
                                      style={{
                                        fontSize: "12px",
                                        color: "#475569",
                                      }}
                                    >
                                      <strong
                                        style={{
                                          color: "#0f172a",
                                        }}
                                      >
                                        {check.verified_by ||
                                          "—"}
                                      </strong>
                                      <br />
                                      Analyst
                                    </div>


                                    <div
                                      style={{
                                        fontSize: "12px",
                                        color: "#475569",
                                      }}
                                    >
                                      {formatDate(
                                        check.verified_at
                                      )}
                                    </div>

                                  </div>
                                );
                              }
                            )}
                          </div>
                        )}

                      </div>


                      <div
                        style={{
                          marginTop: "24px",
                          paddingTop: "20px",
                          borderTop: "1px solid #e2e8f0",
                        }}
                      >

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "14px",
                            marginBottom: "14px",
                          }}
                        >

                          <div>

                            <div
                              style={{
                                fontSize: "13px",
                                fontWeight: 800,
                                color: "#0f172a",
                              }}
                            >
                              Forensic Outputs
                            </div>

                            <div
                              style={{
                                marginTop: "4px",
                                fontSize: "12px",
                                color: "#64748b",
                              }}
                            >
                              Add derived reports, extracted frames or analysis exports. Original evidence is never replaced.
                            </div>

                          </div>


                          <button
                            type="button"
                            className="df-primary-action"
                            onClick={() => {
                              setShowArtifactForm(
                                (current) =>
                                  !current
                              );
                              setArtifactError("");
                              setArtifactSuccess("");
                            }}
                          >
                            {showArtifactForm ? (
                              <X
                                size={16}
                              />
                            ) : (
                              <Upload
                                size={16}
                              />
                            )}

                            {showArtifactForm
                              ? "Cancel"
                              : "Add Forensic Artifact"}
                          </button>

                        </div>


                        {artifactSuccess && (
                          <div className="df-hash-result">

                            <CheckCircle2
                              size={17}
                            />

                            <div>

                              <strong>
                                Artifact added
                              </strong>

                              <span>
                                {artifactSuccess}
                              </span>

                            </div>

                          </div>
                        )}


                        {artifactError && (
                          <div className="df-tool-error">

                            <AlertCircle
                              size={17}
                            />

                            {artifactError}

                          </div>
                        )}


                        {showArtifactForm && (
                          <form
                            onSubmit={
                              handleArtifactSubmit
                            }
                            style={{
                              display: "grid",
                              gap: "12px",
                              padding: "16px",
                              marginBottom: "16px",
                              border: "1px solid #dbe4ee",
                              borderRadius: "10px",
                              background: "#f8fafc",
                            }}
                          >

                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns:
                                  "minmax(0, 1fr) minmax(180px, 0.6fr)",
                                gap: "12px",
                              }}
                            >

                              <label
                                style={{
                                  display: "grid",
                                  gap: "6px",
                                  fontSize: "12px",
                                  fontWeight: 700,
                                  color: "#334155",
                                }}
                              >
                                Artifact title

                                <input
                                  type="text"
                                  value={
                                    artifactForm.title
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    setArtifactForm(
                                      (
                                        current
                                      ) => ({
                                        ...current,
                                        title:
                                          event
                                            .target
                                            .value,
                                      })
                                    )
                                  }
                                  placeholder="e.g. Extracted CCTV Frame"
                                  style={{
                                    minHeight: "40px",
                                    padding: "8px 10px",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "7px",
                                    background: "#ffffff",
                                    color: "#0f172a",
                                  }}
                                />
                              </label>


                              <label
                                style={{
                                  display: "grid",
                                  gap: "6px",
                                  fontSize: "12px",
                                  fontWeight: 700,
                                  color: "#334155",
                                }}
                              >
                                Artifact type

                                <select
                                  value={
                                    artifactForm.artifactType
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    setArtifactForm(
                                      (
                                        current
                                      ) => ({
                                        ...current,
                                        artifactType:
                                          event
                                            .target
                                            .value,
                                      })
                                    )
                                  }
                                  style={{
                                    minHeight: "40px",
                                    padding: "8px 10px",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "7px",
                                    background: "#ffffff",
                                    color: "#0f172a",
                                  }}
                                >
                                  <option value="Forensic Report">
                                    Forensic Report
                                  </option>

                                  <option value="Extracted Frame">
                                    Extracted Frame
                                  </option>

                                  <option value="Metadata Report">
                                    Metadata Report
                                  </option>

                                  <option value="Analysis Export">
                                    Analysis Export
                                  </option>

                                  <option value="Other">
                                    Other
                                  </option>
                                </select>
                              </label>

                            </div>


                            <label
                              style={{
                                display: "grid",
                                gap: "6px",
                                fontSize: "12px",
                                fontWeight: 700,
                                color: "#334155",
                              }}
                            >
                              Description

                              <textarea
                                rows={3}
                                value={
                                  artifactForm.description
                                }
                                onChange={(
                                  event
                                ) =>
                                  setArtifactForm(
                                    (
                                      current
                                    ) => ({
                                      ...current,
                                      description:
                                        event
                                          .target
                                          .value,
                                    })
                                  )
                                }
                                placeholder="What was produced during examination?"
                                style={{
                                  padding: "9px 10px",
                                  border: "1px solid #cbd5e1",
                                  borderRadius: "7px",
                                  resize: "vertical",
                                  background: "#ffffff",
                                  color: "#0f172a",
                                }}
                              />
                            </label>


                            <label
                              style={{
                                display: "grid",
                                gap: "6px",
                                fontSize: "12px",
                                fontWeight: 700,
                                color: "#334155",
                              }}
                            >
                              File

                              <input
                                ref={
                                  artifactFileInputRef
                                }
                                type="file"
                                accept=".jpg,.jpeg,.png,.pdf,.mp4,.mov,.avi,.mp3,.wav,.csv,.json,.txt"
                                onChange={(
                                  event
                                ) =>
                                  setArtifactForm(
                                    (
                                      current
                                    ) => ({
                                      ...current,
                                      file:
                                        event
                                          .target
                                          .files?.[0] ||
                                        null,
                                    })
                                  )
                                }
                                style={{
                                  padding: "9px",
                                  border: "1px solid #cbd5e1",
                                  borderRadius: "7px",
                                  background: "#ffffff",
                                  color: "#334155",
                                }}
                              />
                            </label>


                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "12px",
                              }}
                            >

                              <span
                                style={{
                                  fontSize: "11px",
                                  color: "#64748b",
                                }}
                              >
                                Linked to{" "}
                                {getEvidenceReference(
                                  selectedEvidence
                                )}. The original evidence file remains unchanged.
                              </span>


                              <button
                                type="submit"
                                className="df-primary-action"
                                disabled={
                                  artifactUploading
                                }
                              >
                                {artifactUploading ? (
                                  <Loader2
                                    size={16}
                                    className="df-spin"
                                  />
                                ) : (
                                  <Upload
                                    size={16}
                                  />
                                )}

                                {artifactUploading
                                  ? "Uploading…"
                                  : "Save Artifact"}
                              </button>

                            </div>

                          </form>
                        )}


                        {artifactsLoading ? (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              padding: "14px 0",
                              color: "#64748b",
                              fontSize: "13px",
                            }}
                          >
                            <Loader2
                              size={17}
                              className="df-spin"
                            />

                            Loading forensic outputs…
                          </div>
                        ) : artifacts.length ===
                          0 ? (
                          <div
                            style={{
                              padding: "14px",
                              border: "1px dashed #cbd5e1",
                              borderRadius: "8px",
                              fontSize: "13px",
                              color: "#64748b",
                            }}
                          >
                            No forensic artifacts have been added to this assigned case yet.
                          </div>
                        ) : (
                          <div
                            style={{
                              display: "grid",
                              gap: "9px",
                            }}
                          >
                            {artifacts.map(
                              (artifact) => {
                                const fileUrl =
                                  getEvidenceFileUrl(
                                    artifact
                                  );

                                const linkedToCurrent =
                                  String(
                                    artifact.source_evidence_id
                                  ) ===
                                  String(
                                    selectedEvidence.id
                                  );

                                return (
                                  <div
                                    key={
                                      artifact.id
                                    }
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns:
                                        "minmax(0, 1fr) auto",
                                      gap: "14px",
                                      alignItems: "center",
                                      padding: "12px 13px",
                                      border: linkedToCurrent
                                        ? "1px solid #bfdbfe"
                                        : "1px solid #e2e8f0",
                                      borderRadius: "9px",
                                      background: linkedToCurrent
                                        ? "#f8fbff"
                                        : "#ffffff",
                                    }}
                                  >

                                    <div
                                      style={{
                                        minWidth: 0,
                                      }}
                                    >

                                      <div
                                        style={{
                                          display: "flex",
                                          flexWrap: "wrap",
                                          alignItems: "center",
                                          gap: "7px",
                                        }}
                                      >

                                        <strong
                                          style={{
                                            fontSize: "13px",
                                            color: "#0f172a",
                                          }}
                                        >
                                          {artifact.title}
                                        </strong>

                                        <span
                                          style={{
                                            padding: "2px 6px",
                                            border: "1px solid #dbe4ee",
                                            borderRadius: "4px",
                                            fontSize: "10px",
                                            fontWeight: 700,
                                            color: "#475569",
                                          }}
                                        >
                                          {artifact.artifact_type}
                                        </span>

                                        {linkedToCurrent && (
                                          <span
                                            style={{
                                              padding: "2px 6px",
                                              borderRadius: "4px",
                                              background: "#dbeafe",
                                              fontSize: "10px",
                                              fontWeight: 800,
                                              color: "#1d4ed8",
                                            }}
                                          >
                                            LINKED EVIDENCE
                                          </span>
                                        )}

                                      </div>


                                      <div
                                        style={{
                                          marginTop: "5px",
                                          fontSize: "11px",
                                          color: "#64748b",
                                        }}
                                      >
                                        {artifact.artifact_id}
                                        {" · "}
                                        {artifact.created_by}
                                        {" · "}
                                        {formatDate(
                                          artifact.created_at
                                        )}
                                      </div>


                                      <code
                                        style={{
                                          display: "block",
                                          marginTop: "6px",
                                          overflowWrap: "anywhere",
                                          fontSize: "10px",
                                          color: "#475569",
                                        }}
                                      >
                                        SHA-256:{" "}
                                        {artifact.sha256_hash}
                                      </code>

                                    </div>


                                    {fileUrl && (
                                      <a
                                        href={
                                          fileUrl
                                        }
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "6px",
                                          padding: "7px 9px",
                                          border: "1px solid #cbd5e1",
                                          borderRadius: "7px",
                                          textDecoration: "none",
                                          fontSize: "12px",
                                          fontWeight: 700,
                                          color: "#334155",
                                          background: "#ffffff",
                                        }}
                                      >
                                        <ExternalLink
                                          size={14}
                                        />

                                        Open
                                      </a>
                                    )}

                                  </div>
                                );
                              }
                            )}
                          </div>
                        )}

                      </div>

                    </section>
                  )}


                  {activeTool ===
                    "media" && (
                    <section className="df-tool-panel">

                      <div className="df-panel-heading">

                        <div>

                          <span>
                            MEDIA FORENSICS
                          </span>

                          <h3>
                            Media Examination
                          </h3>

                          <p>
                            Review CCTV, image or audio evidence and inspect file metadata.
                          </p>

                        </div>


                        <Video
                          size={24}
                        />

                      </div>


                      {!selectedFileUrl ? (
                        <div className="df-tool-notice">

                          <AlertCircle
                            size={19}
                          />

                          <div>

                            <strong>
                              Media file unavailable
                            </strong>

                            <p>
                              This evidence record does not have an accessible uploaded media file.
                            </p>

                          </div>

                        </div>
                      ) : (
                        <div className="df-media-layout">

                          <div className="df-media-preview">

                            {getMediaKind(
                              selectedEvidence
                            ) ===
                              "video" && (
                              <video
                                key={
                                  selectedFileUrl
                                }
                                src={selectedFileUrl}
                                controls
                                preload="metadata"
                                onLoadedMetadata={(
                                  event
                                ) => {
                                  setMediaMetadata({
                                    kind:
                                      "Video",
                                    duration:
                                      event.currentTarget.duration,
                                    width:
                                      event.currentTarget.videoWidth,
                                    height:
                                      event.currentTarget.videoHeight,
                                  });

                                  setMediaError(
                                    ""
                                  );
                                }}
                                onError={() =>
                                  setMediaError(
                                    "The browser could not open this video file."
                                  )
                                }
                              />
                            )}


                            {getMediaKind(
                              selectedEvidence
                            ) ===
                              "image" && (
                              <img
                                key={
                                  selectedFileUrl
                                }
                                src={
                                  selectedFileUrl
                                }
                                alt={
                                  getEvidenceTitle(
                                    selectedEvidence
                                  )
                                }
                                onLoad={(
                                  event
                                ) => {
                                  setMediaMetadata({
                                    kind:
                                      "Image",
                                    width:
                                      event.currentTarget.naturalWidth,
                                    height:
                                      event.currentTarget.naturalHeight,
                                  });

                                  setMediaError(
                                    ""
                                  );
                                }}
                                onError={() =>
                                  setMediaError(
                                    "The evidence image could not be loaded."
                                  )
                                }
                              />
                            )}


                            {getMediaKind(
                              selectedEvidence
                            ) ===
                              "audio" && (
                              <audio
                                key={
                                  selectedFileUrl
                                }
                                src={
                                  selectedFileUrl
                                }
                                controls
                                onLoadedMetadata={(
                                  event
                                ) => {
                                  setMediaMetadata({
                                    kind:
                                      "Audio",
                                    duration:
                                      event.currentTarget.duration,
                                  });

                                  setMediaError(
                                    ""
                                  );
                                }}
                                onError={() =>
                                  setMediaError(
                                    "The browser could not open this audio file."
                                  )
                                }
                              />
                            )}

                          </div>


                          <aside className="df-media-metadata">

                            <div className="df-subheading">

                              <ImageIcon
                                size={17}
                              />

                              File Metadata

                            </div>


                            <div>

                              <span>
                                Filename
                              </span>

                              <strong>
                                {getFileName(
                                  selectedEvidence
                                )}
                              </strong>

                            </div>


                            <div>

                              <span>
                                Media Type
                              </span>

                              <strong>
                                {mediaMetadata?.kind ||
                                  getEvidenceType(
                                    selectedEvidence
                                  )}
                              </strong>

                            </div>


                            <div>

                              <span>
                                Resolution
                              </span>

                              <strong>
                                {mediaMetadata?.width &&
                                mediaMetadata?.height
                                  ? `${mediaMetadata.width} × ${mediaMetadata.height}`
                                  : "—"}
                              </strong>

                            </div>


                            <div>

                              <span>
                                Duration
                              </span>

                              <strong>
                                {mediaMetadata?.duration !==
                                undefined
                                  ? formatDuration(
                                      mediaMetadata.duration
                                    )
                                  : "—"}
                              </strong>

                            </div>


                            <div>

                              <span>
                                Source
                              </span>

                              <strong>
                                {selectedEvidence.source ||
                                  "—"}
                              </strong>

                            </div>


                            <div>

                              <span>
                                SHA-256 Baseline
                              </span>

                              <strong className="df-media-hash">
                                {selectedEvidence.sha256_hash ||
                                  "Not recorded"}
                              </strong>

                            </div>

                          </aside>

                        </div>
                      )}


                      {selectedEvidence.description && (
                        <div className="df-media-context">
                          <span>
                            EXAMINATION CONTEXT / TRANSCRIPT
                          </span>

                          <p>
                            {selectedEvidence.description}
                          </p>
                        </div>
                      )}


                      {mediaError && (
                        <div className="df-tool-error">

                          <AlertCircle
                            size={17}
                          />

                          {mediaError}

                        </div>
                      )}

                    </section>
                  )}


                  {activeTool ===
                    "cdr" && (
                    <section className="df-tool-panel">

                      <div className="df-panel-heading">

                        <div>

                          <span>
                            COMMUNICATION FORENSICS
                          </span>

                          <h3>
                            Call Detail Record Analysis
                          </h3>

                          <p>
                            Analyse communication records directly from the attached evidence file.
                          </p>

                        </div>


                        <PhoneCall
                          size={24}
                        />

                      </div>


                      <div className="df-cdr-record-summary">

                        <div>

                          <Database
                            size={17}
                          />

                          <span>
                            Evidence
                          </span>

                          <strong>
                            {getEvidenceReference(
                              selectedEvidence
                            )}
                          </strong>

                        </div>


                        <div>

                          <FolderOpen
                            size={17}
                          />

                          <span>
                            Case
                          </span>

                          <strong>
                            {selectedCase
                              ? getCaseReference(
                                  selectedCase
                                )
                              : `Case #${selectedEvidence.case_id}`}
                          </strong>

                        </div>


                        <div>

                          <UserRound
                            size={17}
                          />

                          <span>
                            Collected By
                          </span>

                          <strong>
                            {selectedEvidence.collected_by ||
                              "—"}
                          </strong>

                        </div>


                        <div>

                          <Clock3
                            size={17}
                          />

                          <span>
                            Collected
                          </span>

                          <strong>
                            {formatDate(
                              selectedEvidence.collected_at
                            )}
                          </strong>

                        </div>

                      </div>


                      {selectedEvidence.description && (
                        <div className="df-cdr-description">

                          <span>
                            Recorded Summary
                          </span>

                          <p>
                            {selectedEvidence.description}
                          </p>

                        </div>
                      )}


                      {!cdrAnalysis && (
                        <div className="df-cdr-start">

                          <PhoneCall
                            size={31}
                          />


                          <h4>
                            Analyse attached CDR evidence
                          </h4>


                          <p>
                            CINTRA reads communication records from the attached PDF, CSV or JSON evidence file and calculates results from those records.
                          </p>


                          <button
                            type="button"
                            className="df-primary-action"
                            disabled={
                              cdrLoading ||
                              !selectedFileUrl
                            }
                            onClick={
                              runCDRAnalysis
                            }
                          >

                            {cdrLoading ? (
                              <Loader2
                                size={16}
                                className="df-spin"
                              />
                            ) : (
                              <PhoneCall
                                size={16}
                              />
                            )}


                            {cdrLoading
                              ? "Analysing Evidence…"
                              : "Analyse CDR File"}

                          </button>

                        </div>
                      )}


                      {cdrError && (
                        <div className="df-tool-notice">

                          <AlertCircle
                            size={18}
                          />

                          <div>

                            <strong>
                              CDR analysis could not be completed
                            </strong>

                            <p>
                              {cdrError}
                            </p>

                          </div>

                        </div>
                      )}


                      {cdrAnalysis && (
                        <>

                          <div className="df-cdr-description">

                            <span>
                              ANALYSIS SOURCE
                            </span>

                            <p>
                              Results below were parsed directly from the attached{" "}
                              <strong>
                                {cdrSourceFormat}
                              </strong>{" "}
                              evidence file.
                            </p>

                          </div>


                          <div className="df-cdr-results">

                            <div>

                              <span>
                                Call Records
                              </span>

                              <strong>
                                {cdrAnalysis.totalRecords}
                              </strong>

                            </div>


                            <div>

                              <span>
                                Unique Numbers
                              </span>

                              <strong>
                                {cdrAnalysis.uniqueContacts}
                              </strong>

                            </div>


                            <div>

                              <span>
                                Total Duration
                              </span>

                              <strong>
                                {formatDuration(
                                  cdrAnalysis.totalDuration
                                )}
                              </strong>

                            </div>

                          </div>


                          <div className="df-cdr-findings">

                            <div>

                              <span>
                                Most Frequent Connection
                              </span>

                              <strong>
                                {cdrAnalysis.topPair
                                  ? cdrAnalysis.topPair[0]
                                  : "Not available"}
                              </strong>

                              <small>
                                {cdrAnalysis.topPair
                                  ? `${cdrAnalysis.topPair[1]} communication records`
                                  : "No valid connection found"}
                              </small>

                            </div>


                            <div>

                              <span>
                                Peak Activity
                              </span>


                              <strong>
                                {cdrAnalysis.peakHours?.length ===
                                1
                                  ? `${String(
                                      cdrAnalysis.peakHours[0]
                                    ).padStart(
                                      2,
                                      "0"
                                    )}:00 – ${String(
                                      (
                                        cdrAnalysis.peakHours[0] +
                                        1
                                      ) %
                                        24
                                    ).padStart(
                                      2,
                                      "0"
                                    )}:00`
                                  : cdrAnalysis.peakHours?.length >
                                      1
                                    ? "Multiple activity windows"
                                    : "Not available"}
                              </strong>


                              <small>
                                {cdrAnalysis.peakHours?.length
                                  ? `${cdrAnalysis.peakCount} record(s) in the busiest time window`
                                  : "No parseable timestamps"}
                              </small>

                            </div>

                          </div>


                          <div className="df-cdr-table">

                            <div className="df-cdr-table-head">

                              <span>
                                From
                              </span>

                              <span>
                                To
                              </span>

                              <span>
                                Time
                              </span>

                              <span>
                                Duration
                              </span>

                            </div>


                            {cdrRecords.map(
                              (record) => (
                                <div
                                  key={
                                    record.id
                                  }
                                  className="df-cdr-table-row"
                                >

                                  <span>
                                    {record.from ||
                                      "—"}
                                  </span>


                                  <span>
                                    {record.to ||
                                      "—"}
                                  </span>


                                  <span>
                                    {formatDate(
                                      record.timestamp
                                    )}
                                  </span>


                                  <span>
                                    {formatDuration(
                                      record.duration
                                    )}
                                  </span>

                                </div>
                              )
                            )}

                          </div>

                        </>
                      )}

                    </section>
                  )}

                </>
              )}

            </main>

          </div>
        )}

      </div>
    </ForensicPageLayout>
  );
}


export default DigitalForensics;

