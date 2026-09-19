import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Download,
  ExternalLink,
  FileImage,
  FileText,
  Film,
  FolderCheck,
  Maximize,
  Monitor,
  Music,
  ShieldCheck,
  Upload,
  UserRound,
} from "lucide-react";

import AppHeader from "../../components/layout/AppHeader";

import "./EvidenceViewer.css";

const API_BASE_URL =
  "http://127.0.0.1:8000";

/* =========================================================
   AUTH
   ========================================================= */

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

/* =========================================================
   FORMATTERS
   ========================================================= */

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function formatClockTime(seconds) {
  const value = Number(seconds);

  if (
    Number.isNaN(value) ||
    value < 0
  ) {
    return "00:00";
  }

  const minutes = Math.floor(
    value / 60
  );

  const remainingSeconds =
    Math.floor(value % 60);

  return `${String(minutes).padStart(
    2,
    "0"
  )}:${String(
    remainingSeconds
  ).padStart(2, "0")}`;
}

/* =========================================================
   FILE HELPERS
   ========================================================= */

function getFileUrl(filePath) {
  if (!filePath) {
    return null;
  }

  if (
    filePath.startsWith("http://") ||
    filePath.startsWith("https://")
  ) {
    return filePath;
  }

  return `${API_BASE_URL}${
    filePath.startsWith("/")
      ? ""
      : "/"
  }${filePath}`;
}

function getFileExtension(filePath) {
  if (!filePath) {
    return "";
  }

  const cleanPath =
    String(filePath)
      .split("?")[0]
      .split("#")[0];

  const parts =
    cleanPath.split(".");

  if (parts.length < 2) {
    return "";
  }

  return parts
    .pop()
    .toLowerCase();
}

function getFileType(filePath) {
  const extension =
    getFileExtension(filePath);

  if (
    [
      "mp4",
      "webm",
      "ogg",
      "mov",
      "avi",
    ].includes(extension)
  ) {
    return "video";
  }

  if (
    [
      "jpg",
      "jpeg",
      "png",
      "webp",
      "gif",
    ].includes(extension)
  ) {
    return "image";
  }

  if (extension === "pdf") {
    return "pdf";
  }

  if (
    [
      "mp3",
      "wav",
      "m4a",
      "aac",
    ].includes(extension)
  ) {
    return "audio";
  }

  return "other";
}

/* =========================================================
   MAIN
   ========================================================= */

function EvidenceViewer() {
  const navigate =
    useNavigate();

  const { caseId } =
    useParams();

  const viewerRef =
    useRef(null);

  const videoRef =
    useRef(null);

  const [caseData, setCaseData] =
    useState(null);

  const [
    evidence,
    setEvidence,
  ] = useState([]);

  const [
    selectedEvidenceId,
    setSelectedEvidenceId,
  ] = useState(null);

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState("");

  const [secureObjectUrl, setSecureObjectUrl] =
    useState(null);

  const [
    videoDuration,
    setVideoDuration,
  ] = useState(0);

  const [
    videoCurrentTime,
    setVideoCurrentTime,
  ] = useState(0);

  const [
    videoResolution,
    setVideoResolution,
  ] = useState("");

  /* =======================================================
     LOAD DATA
     ======================================================= */

  useEffect(() => {
    async function loadPage(silent = false) {
      const token = getToken();

      if (!token) {
        clearStoredAuth();

        navigate("/", {
          replace: true,
        });

        return;
      }

      try {
        if (!silent) {
          setLoading(true);
        }
        setMessage("");

        const headers = {
          Authorization:
            `Bearer ${token}`,
        };

        const [
          caseResponse,
          evidenceResponse,
        ] = await Promise.all([
          fetch(
            `${API_BASE_URL}/cases/${caseId}`,
            {
              headers,
            }
          ),

          fetch(
            `${API_BASE_URL}/evidence/case/${caseId}`,
            {
              headers,
            }
          ),
        ]);

        if (
          caseResponse.status ===
            401 ||
          evidenceResponse.status ===
            401
        ) {
          clearStoredAuth();

          navigate("/", {
            replace: true,
          });

          return;
        }

        if (caseResponse.ok) {
          setCaseData(
            await caseResponse.json()
          );
        }

        if (!evidenceResponse.ok) {
          throw new Error(
            "Evidence records could not be loaded."
          );
        }

        const result =
          await evidenceResponse.json();

        const records =
          Array.isArray(result)
            ? result
            : [];

        setEvidence(records);

        if (records.length > 0) {
          setSelectedEvidenceId(
            (current) => {
              const exists =
                records.some(
                  (item) =>
                    String(item.id) ===
                    String(current)
                );

              return exists
                ? current
                : records[0].id;
            }
          );
        } else {
          setSelectedEvidenceId(
            null
          );
        }
      } catch (error) {
        console.error(
          "Evidence Viewer:",
          error
        );

        setMessage(
          error.message ||
            "Unable to connect to CINTRA services."
        );
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    }

    loadPage();
    const syncTimer = window.setInterval(() => {
      loadPage(true);
    }, 7000);

    return () => window.clearInterval(syncTimer);
  }, [
    caseId,
    navigate,
  ]);

  /* =======================================================
     SELECTED EVIDENCE
     ======================================================= */

  const selectedEvidence =
    useMemo(
      () =>
        evidence.find(
          (item) =>
            String(item.id) ===
            String(
              selectedEvidenceId
            )
        ) || null,
      [
        evidence,
        selectedEvidenceId,
      ]
    );

  const selectedIndex =
    useMemo(
      () =>
        evidence.findIndex(
          (item) =>
            String(item.id) ===
            String(
              selectedEvidenceId
            )
        ),
      [
        evidence,
        selectedEvidenceId,
      ]
    );

  const hasPrevious =
    selectedIndex > 0;

  const hasNext =
    selectedIndex >= 0 &&
    selectedIndex <
      evidence.length - 1;

  const rawFileUrl =
    getFileUrl(
      selectedEvidence
        ?.file_path
    );

  const isSecureEvidenceFile =
    String(selectedEvidence?.file_path || "")
      .startsWith("/evidence/by-code/");

  const fileUrl =
    isSecureEvidenceFile
      ? secureObjectUrl
      : rawFileUrl;

  const fileType =
    getFileType(
      selectedEvidence
        ?.file_path
    );

  const fileExtension =
    getFileExtension(
      selectedEvidence
        ?.file_path
    );

  /* =======================================================
     AUTHENTICATED SECURE EVIDENCE STREAM
     ======================================================= */

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;

    async function loadSecureFile() {
      if (!isSecureEvidenceFile || !rawFileUrl) {
        setSecureObjectUrl(null);
        return;
      }

      const token = getToken();
      if (!token) {
        return;
      }

      try {
        const response = await fetch(rawFileUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Secure evidence stream failed (${response.status})`);
        }

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);

        if (!cancelled) {
          setSecureObjectUrl(objectUrl);
        }
      } catch (error) {
        console.error("Secure evidence load error:", error);
        if (!cancelled) {
          setSecureObjectUrl(null);
          setMessage("Secure evidence file could not be decrypted for preview.");
        }
      }
    }

    loadSecureFile();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [selectedEvidenceId, rawFileUrl, isSecureEvidenceFile]);

  /* =======================================================
     RESET VIDEO STATE
     ======================================================= */

  useEffect(() => {
    setVideoDuration(0);
    setVideoCurrentTime(0);
    setVideoResolution("");
  }, [selectedEvidenceId]);

  /* =======================================================
     NAVIGATION
     ======================================================= */

  function showPreviousEvidence() {
    if (!hasPrevious) {
      return;
    }

    setSelectedEvidenceId(
      evidence[
        selectedIndex - 1
      ].id
    );
  }

  function showNextEvidence() {
    if (!hasNext) {
      return;
    }

    setSelectedEvidenceId(
      evidence[
        selectedIndex + 1
      ].id
    );
  }

  /* =======================================================
     VIDEO
     ======================================================= */

  function handleVideoMetadata(
    event
  ) {
    const video =
      event.currentTarget;

    setVideoDuration(
      video.duration || 0
    );

    if (
      video.videoWidth &&
      video.videoHeight
    ) {
      setVideoResolution(
        `${video.videoWidth} × ${video.videoHeight}`
      );
    }
  }

  function handleVideoTimeUpdate(
    event
  ) {
    setVideoCurrentTime(
      event.currentTarget
        .currentTime || 0
    );
  }

  function seekVideo(event) {
    if (
      !videoRef.current ||
      !videoDuration
    ) {
      return;
    }

    const value =
      Number(
        event.target.value
      );

    videoRef.current.currentTime =
      value;

    setVideoCurrentTime(
      value
    );
  }

  async function enterFullscreen() {
    const element =
      viewerRef.current;

    if (!element) {
      return;
    }

    try {
      if (
        element.requestFullscreen
      ) {
        await element.requestFullscreen();
      }
    } catch (error) {
      console.error(
        "Fullscreen error:",
        error
      );
    }
  }

  /* =======================================================
     RECORDED HISTORY
     ======================================================= */

  const historyEvents =
    useMemo(() => {
      if (!selectedEvidence) {
        return [];
      }

      const events = [];

      if (
        selectedEvidence.collected_at ||
        selectedEvidence.collected_by
      ) {
        events.push({
          key: "collected",
          title: "Collected",
          date:
            selectedEvidence
              .collected_at,
          person:
            selectedEvidence
              .collected_by,
          icon: "collected",
        });
      }

      if (
        selectedEvidence.uploaded_at
      ) {
        events.push({
          key: "uploaded",
          title:
            "Uploaded to CINTRA",
          date:
            selectedEvidence
              .uploaded_at,
          person:
            selectedEvidence
              .collected_by,
          icon: "uploaded",
        });
      }

      if (
        selectedEvidence.status
      ) {
        events.push({
          key: "status",
          title:
            selectedEvidence.status,
          date: null,
          person: null,
          icon: "status",
        });
      }

      return events;
    }, [selectedEvidence]);

  /* =======================================================
     LOADING
     ======================================================= */

  if (loading) {
    return (
      <div className="evidence-viewer-page">
        <AppHeader
          activePage="evidence"
          caseId={caseId}
        />

        <div className="evidence-viewer-loading">
          Loading evidence...
        </div>
      </div>
    );
  }

  /* =======================================================
     PAGE
     ======================================================= */

  return (
    <div className="evidence-viewer-page">
      <AppHeader
        activePage="evidence"
        caseId={caseId}
      />

      {/* TOP CASE BAR */}

      <section className="ev-context-bar">
        <div className="ev-context-left">
          <button
            type="button"
            onClick={() =>
              navigate("/cases")
            }
          >
            Cases
          </button>

          <span>›</span>

          <button
            type="button"
            onClick={() =>
              navigate(
                `/cases/${caseId}`
              )
            }
          >
            {caseData?.case_id ||
              `Case ${caseId}`}
          </button>

          <span>›</span>

          <strong>
            Evidence Viewer
          </strong>
        </div>

        <div className="ev-context-actions">
          <button
            type="button"
            disabled={!hasPrevious}
            onClick={
              showPreviousEvidence
            }
          >
            <ArrowLeft
              size={15}
            />

            Previous Evidence
          </button>

          <button
            type="button"
            disabled={!hasNext}
            onClick={
              showNextEvidence
            }
          >
            Next Evidence

            <ArrowRight
              size={15}
            />
          </button>

          <button
            type="button"
            className="ev-fullscreen-top"
            title="Fullscreen"
            onClick={
              enterFullscreen
            }
          >
            <Maximize
              size={17}
            />
          </button>
        </div>
      </section>

      <main className="ev-main">
        <button
          type="button"
          className="ev-back-button"
          onClick={() =>
            navigate(
              `/cases/${caseId}`
            )
          }
        >
          <ChevronLeft
            size={17}
          />

          Back to Case Workspace
        </button>

        {message && (
          <div className="ev-message">
            {message}
          </div>
        )}

        {!selectedEvidence ? (
          <div className="ev-empty">
            <FileText size={44} />

            <strong>
              No evidence available
            </strong>

            <span>
              This case does not have
              evidence records yet.
            </span>
          </div>
        ) : (
          <div className="ev-layout">

            {/* LEFT SIDE */}

            <div className="ev-left-column">

              {/* VIEWER */}

              <section
                className="ev-viewer-card"
                ref={viewerRef}
              >
                <div className="ev-media-area">

                  {/* MEDIA TOP OVERLAY */}

                  <div className="ev-media-overlay">
                    <strong>
                      {selectedEvidence.source ||
                        selectedEvidence.title ||
                        "Evidence File"}
                    </strong>

                    <span>
                      {selectedEvidence.collected_at
                        ? formatDateTime(
                            selectedEvidence.collected_at
                          )
                        : ""}
                    </span>
                  </div>

                  {fileUrl ? (
                    <>
                      {fileType ===
                        "video" && (
                        <video
                          key={
                            fileUrl
                          }
                          ref={
                            videoRef
                          }
                          className="ev-video"
                          src={
                            fileUrl
                          }
                          controls
                          playsInline
                          preload="metadata"
                          onLoadedMetadata={
                            handleVideoMetadata
                          }
                          onTimeUpdate={
                            handleVideoTimeUpdate
                          }
                        />
                      )}

                      {fileType ===
                        "image" && (
                        <img
                          className="ev-image"
                          src={
                            fileUrl
                          }
                          alt={
                            selectedEvidence.title
                          }
                        />
                      )}

                      {fileType ===
                        "pdf" && (
                        <iframe
                          className="ev-pdf"
                          src={
                            fileUrl
                          }
                          title={
                            selectedEvidence.title
                          }
                        />
                      )}

                      {fileType ===
                        "audio" && (
                        <div className="ev-audio">
                          <Music
                            size={54}
                          />

                          <strong>
                            {
                              selectedEvidence.title
                            }
                          </strong>

                          <audio
                            controls
                            src={
                              fileUrl
                            }
                          />
                        </div>
                      )}

                      {fileType ===
                        "other" && (
                        <div className="ev-file-fallback">
                          <FileText
                            size={48}
                          />

                          <strong>
                            Preview unavailable
                          </strong>

                          <button
                            type="button"
                            onClick={() =>
                              window.open(
                                fileUrl,
                                "_blank",
                                "noopener,noreferrer"
                              )
                            }
                          >
                            <ExternalLink
                              size={15}
                            />

                            Open File
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="ev-file-fallback">
                      <FileText
                        size={48}
                      />

                      <strong>
                        No supporting file
                      </strong>

                      <span>
                        This evidence record
                        does not have an
                        uploaded file.
                      </span>
                    </div>
                  )}
                </div>

                {/* REAL VIDEO TIMELINE */}

                {fileType ===
                  "video" && (
                  <div className="ev-video-timeline">
                    <div className="ev-timeline-heading">
                      <strong>
                        Timeline
                        {selectedEvidence.collected_at
                          ? ` (${formatDate(
                              selectedEvidence.collected_at
                            )})`
                          : ""}
                      </strong>

                      <span>
                        {formatClockTime(
                          videoCurrentTime
                        )}{" "}
                        /{" "}
                        {formatClockTime(
                          videoDuration
                        )}
                      </span>
                    </div>

                    <div className="ev-timeline-control">
                      <span>
                        00:00
                      </span>

                      <input
                        type="range"
                        min="0"
                        max={
                          videoDuration ||
                          0
                        }
                        step="0.01"
                        value={
                          Math.min(
                            videoCurrentTime,
                            videoDuration ||
                              0
                          )
                        }
                        onChange={
                          seekVideo
                        }
                      />

                      <span>
                        {formatClockTime(
                          videoDuration
                        )}
                      </span>
                    </div>

                    <div className="ev-timeline-current">
                      {formatClockTime(
                        videoCurrentTime
                      )}
                    </div>
                  </div>
                )}
              </section>

              {/* RECORDED HISTORY */}

              <section className="ev-history-card">
                <h2>
                  Chain of Custody
                </h2>

                {historyEvents.length ? (
                  <div className="ev-history-track">
                    {historyEvents.map(
                      (
                        event,
                        index
                      ) => (
                        <div
                          className="ev-history-step"
                          key={
                            event.key
                          }
                        >
                          <div className="ev-history-visual">
                            <span className="ev-history-icon">
                              {event.icon ===
                              "collected" ? (
                                <FolderCheck
                                  size={
                                    22
                                  }
                                />
                              ) : event.icon ===
                                "uploaded" ? (
                                <Upload
                                  size={
                                    22
                                  }
                                />
                              ) : (
                                <CheckCircle2
                                  size={
                                    22
                                  }
                                />
                              )}
                            </span>

                            {index <
                              historyEvents.length -
                                1 && (
                              <span className="ev-history-line" />
                            )}
                          </div>

                          <strong>
                            {
                              event.title
                            }
                          </strong>

                          <span>
                            {event.date
                              ? formatDateTime(
                                  event.date
                                )
                              : "Current record status"}
                          </span>

                          {event.person && (
                            <small>
                              {
                                event.person
                              }
                            </small>
                          )}
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <div className="ev-history-empty">
                    No custody history
                    is recorded for this
                    evidence item.
                  </div>
                )}

                <p className="ev-history-note">
                  Only events currently
                  recorded by the CINTRA
                  evidence record are
                  displayed.
                </p>
              </section>
            </div>

            {/* RIGHT SIDE */}

            <aside className="ev-right-column">

              {/* DETAILS */}

              <section className="ev-details-card">
                <div className="ev-card-heading">
                  <h2>
                    Evidence Details
                  </h2>
                </div>

                <div className="ev-details-list">

                  <EvidenceDetail
                    icon={
                      <FileText
                        size={15}
                      />
                    }
                    label="Evidence ID"
                    value={
                      selectedEvidence.evidence_id ||
                      "—"
                    }
                  />

                  <EvidenceDetail
                    icon={
                      <FolderCheck
                        size={15}
                      />
                    }
                    label="Case ID"
                    value={
                      caseData?.case_id ||
                      caseId
                    }
                  />

                  <EvidenceDetail
                    icon={
                      fileType ===
                      "video" ? (
                        <Film
                          size={15}
                        />
                      ) : fileType ===
                        "image" ? (
                        <FileImage
                          size={15}
                        />
                      ) : (
                        <FileText
                          size={15}
                        />
                      )
                    }
                    label="Evidence Type"
                    value={
                      selectedEvidence.evidence_type ||
                      "—"
                    }
                  />

                  <EvidenceDetail
                    icon={
                      <Monitor
                        size={15}
                      />
                    }
                    label="Source"
                    value={
                      selectedEvidence.source ||
                      "—"
                    }
                  />

                  <EvidenceDetail
                    icon={
                      <CalendarDays
                        size={15}
                      />
                    }
                    label="Collected On"
                    value={formatDateTime(
                      selectedEvidence.collected_at
                    )}
                  />

                  <EvidenceDetail
                    icon={
                      <UserRound
                        size={15}
                      />
                    }
                    label="Collected By"
                    value={
                      selectedEvidence.collected_by ||
                      "—"
                    }
                  />

                  <EvidenceDetail
                    icon={
                      <ShieldCheck
                        size={15}
                      />
                    }
                    label="Status"
                    value={
                      selectedEvidence.status ||
                      "—"
                    }
                    status
                  />

                  <EvidenceDetail
                    icon={
                      <FileText
                        size={15}
                      />
                    }
                    label="File Format"
                    value={
                      fileExtension
                        ? fileExtension.toUpperCase()
                        : "—"
                    }
                  />

                  {fileType ===
                    "video" && (
                    <EvidenceDetail
                      icon={
                        <Film
                          size={15}
                        />
                      }
                      label="Duration"
                      value={
                        videoDuration
                          ? formatClockTime(
                              videoDuration
                            )
                          : "—"
                      }
                    />
                  )}

                  {fileType ===
                    "video" && (
                    <EvidenceDetail
                      icon={
                        <Monitor
                          size={15}
                        />
                      }
                      label="Resolution"
                      value={
                        videoResolution ||
                        "—"
                      }
                    />
                  )}

                  <EvidenceDetail
                    icon={
                      <Upload
                        size={15}
                      />
                    }
                    label="Uploaded On"
                    value={formatDateTime(
                      selectedEvidence.uploaded_at
                    )}
                  />
                </div>

                <div className="ev-remarks">
                  <span>
                    Remarks
                  </span>

                  <p>
                    {selectedEvidence.description ||
                      "No remarks recorded."}
                  </p>
                </div>

                {fileUrl && (
                  <div className="ev-file-buttons">
                    <button
                      type="button"
                      onClick={() =>
                        window.open(
                          fileUrl,
                          "_blank",
                          "noopener,noreferrer"
                        )
                      }
                    >
                      <ExternalLink
                        size={15}
                      />

                      Open File
                    </button>

                    <a
                      href={fileUrl}
                      download
                    >
                      <Download
                        size={15}
                      />

                      Download
                    </a>
                  </div>
                )}
              </section>

              {/* TAGS */}

              <section className="ev-tags-card">
                <div className="ev-card-heading">
                  <h2>Tags</h2>
                </div>

                <div className="ev-tags-empty">
                  <span>
                    No tags recorded
                  </span>

                  <p>
                    Tags are not currently
                    stored by the evidence
                    backend.
                  </p>
                </div>
              </section>
            </aside>
          </div>
        )}
      </main>

      <footer className="ev-footer">
        <div>
          <ShieldCheck
            size={16}
          />

          CINTRA v2.1.0
        </div>

        <span>
          Secure. Intelligent.
          Responsive.
        </span>

        <div>
          {selectedIndex >= 0
            ? `Evidence ${
                selectedIndex + 1
              } of ${
                evidence.length
              }`
            : "No evidence"}
        </div>
      </footer>
    </div>
  );
}

/* =========================================================
   DETAIL COMPONENT
   ========================================================= */

function EvidenceDetail({
  icon,
  label,
  value,
  status = false,
}) {
  return (
    <div className="ev-detail-row">
      <span className="ev-detail-icon">
        {icon}
      </span>

      <span className="ev-detail-label">
        {label}
      </span>

      <strong
        className={
          status
            ? "ev-detail-status"
            : ""
        }
      >
        {value}
      </strong>
    </div>
  );
}

export default EvidenceViewer;
