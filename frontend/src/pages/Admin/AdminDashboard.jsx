import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import {
  Activity,
  FileClock,
  Laptop,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";

import {
  getAuditLogs,
  createOfficer,
  getDevices,
  getOfficers,
  resetOfficerMFA,
  revokeOfficerSessions,
  updateDeviceApproval,
  updateOfficerRole,
  updateOfficerStatus,
} from "../../services/adminService";

import {
  clearSession,
  getOfficer,
} from "../../services/api";

import "./AdminDashboard.css";

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString();
}

const EMPTY_OFFICER_FORM = {
  officer_id: "",
  name: "",
  designation: "",
  police_station: "",
  email: "",
  phone: "",
  password: "",
  system_role: "INVESTIGATOR",
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const currentOfficer = getOfficer();

  const [activeSection, setActiveSection] =
    useState("officers");

  const [officers, setOfficers] = useState([]);
  const [devices, setDevices] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [workingId, setWorkingId] = useState("");

  const [showCreateOfficer, setShowCreateOfficer] =
    useState(false);

  const [creatingOfficer, setCreatingOfficer] =
    useState(false);

  const [officerForm, setOfficerForm] = useState(
    EMPTY_OFFICER_FORM
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setMessage("");

      const [
        officerData,
        deviceData,
        auditData,
      ] = await Promise.all([
        getOfficers(),
        getDevices(),
        getAuditLogs(100),
      ]);

      setOfficers(
        Array.isArray(officerData)
          ? officerData
          : []
      );

      setDevices(
        Array.isArray(deviceData)
          ? deviceData
          : []
      );

      setAuditLogs(
        Array.isArray(auditData)
          ? auditData
          : []
      );
    } catch (error) {
      setMessage(
        error.message ||
          "Unable to load administration data."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleOfficerFormChange(event) {
    const { name, value } = event.target;

    setOfficerForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function resetOfficerForm() {
    setOfficerForm({
      ...EMPTY_OFFICER_FORM,
    });
  }

  function closeCreateOfficer() {
    setShowCreateOfficer(false);
    resetOfficerForm();
  }

  async function handleCreateOfficer(event) {
    event.preventDefault();

    if (!officerForm.officer_id.trim()) {
      setMessage("Officer ID is required.");
      return;
    }

    if (!officerForm.name.trim()) {
      setMessage("Officer name is required.");
      return;
    }

    if (!officerForm.designation.trim()) {
      setMessage("Designation is required.");
      return;
    }

    if (!officerForm.police_station.trim()) {
      setMessage("Unit / Station is required.");
      return;
    }

    if (officerForm.password.length < 10) {
      setMessage(
        "Temporary password must contain at least 10 characters."
      );
      return;
    }

    try {
      setCreatingOfficer(true);
      setMessage("");

      const payload = {
        officer_id:
          officerForm.officer_id.trim(),
        name: officerForm.name.trim(),
        designation:
          officerForm.designation.trim(),
        police_station:
          officerForm.police_station.trim(),
        email:
          officerForm.email.trim() || null,
        phone:
          officerForm.phone.trim() || null,
        password: officerForm.password,
        system_role:
          officerForm.system_role,
      };

      const created =
        await createOfficer(payload);

      await loadData();

      resetOfficerForm();
      setShowCreateOfficer(false);

      setMessage(
        `Officer ${
          created?.officer_id ||
          payload.officer_id
        } created successfully. MFA setup will be required on first login.`
      );
    } catch (error) {
      setMessage(
        error.message ||
          "Unable to create officer."
      );
    } finally {
      setCreatingOfficer(false);
    }
  }

  async function handleRoleChange(
    officerId,
    newRole
  ) {
    try {
      setWorkingId(officerId);
      setMessage("");

      await updateOfficerRole(
        officerId,
        newRole
      );

      await loadData();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setWorkingId("");
    }
  }

  async function handleStatusChange(officer) {
    try {
      setWorkingId(officer.officer_id);
      setMessage("");

      const shouldActivate =
        officer.status !== "Active";

      await updateOfficerStatus(
        officer.officer_id,
        shouldActivate
      );

      await loadData();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setWorkingId("");
    }
  }

  async function handleResetMFA(officerId) {
    const confirmed = window.confirm(
      `Reset MFA for ${officerId}? The officer will need to configure an authenticator again.`
    );

    if (!confirmed) return;

    try {
      setWorkingId(officerId);
      setMessage("");

      await resetOfficerMFA(officerId);

      setMessage(
        `MFA reset completed for ${officerId}.`
      );

      await loadData();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setWorkingId("");
    }
  }

  async function handleRevokeSessions(
    officerId
  ) {
    const confirmed = window.confirm(
      `Revoke all active sessions for ${officerId}?`
    );

    if (!confirmed) return;

    try {
      setWorkingId(officerId);
      setMessage("");

      await revokeOfficerSessions(
        officerId
      );

      setMessage(
        `Active sessions revoked for ${officerId}.`
      );

      await loadData();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setWorkingId("");
    }
  }

  async function handleDeviceApproval(device) {
    try {
      setWorkingId(device.device_id);
      setMessage("");

      await updateDeviceApproval(
        device.device_id,
        !device.is_approved
      );

      await loadData();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setWorkingId("");
    }
  }

  function logout() {
    clearSession();

    navigate("/", {
      replace: true,
    });
  }

  const activeOfficers =
    officers.filter(
      (officer) =>
        officer.status === "Active"
    ).length;

  const approvedDevices =
    devices.filter(
      (device) => device.is_approved
    ).length;

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="admin-brand">
          <div className="admin-mark">
            <ShieldCheck />
          </div>

          <div>
            <strong>CINTRA</strong>
            <span>
              System Administration
            </span>
          </div>
        </div>

        <div className="admin-header-right">
          <div className="admin-identity">
            <strong>
              {currentOfficer?.name ||
                "System Administrator"}
            </strong>

            <span>
              {currentOfficer?.officer_id ||
                "SYSTEM ADMIN"}
            </span>
          </div>

          <button
            type="button"
            className="admin-logout"
            onClick={logout}
          >
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </header>

      <nav className="admin-navigation">
        <button
          type="button"
          className={
            activeSection === "officers"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveSection("officers")
          }
        >
          <Users size={17} />
          Officers
        </button>

        <button
          type="button"
          className={
            activeSection === "devices"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveSection("devices")
          }
        >
          <Laptop size={17} />
          Devices
        </button>

        <button
          type="button"
          className={
            activeSection === "audit"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveSection("audit")
          }
        >
          <FileClock size={17} />
          Audit Trail
        </button>
      </nav>

      <main className="admin-content">
        <div className="admin-page-heading">
          <div>
            <span className="admin-eyebrow">
              CINTRA CONTROL
            </span>

            <h1>
              System Administration
            </h1>

            <p>
              Manage authorised officers,
              departmental devices and
              system accountability records.
            </p>
          </div>

          <div style={{display:"flex",gap:"8px"}}>
          

          <button
            type="button"
            className="admin-refresh"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw
              size={16}
              className={
                loading
                  ? "admin-spinning"
                  : ""
              }
            />

            Refresh
          </button>
          </div>
        </div>

        <section className="admin-summary-strip">
          <div>
            <span>
              Authorised officers
            </span>
            <strong>
              {officers.length}
            </strong>
          </div>

          <div>
            <span>
              Active accounts
            </span>
            <strong>
              {activeOfficers}
            </strong>
          </div>

          <div>
            <span>
              Approved devices
            </span>
            <strong>
              {approvedDevices}
            </strong>
          </div>

          <div>
            <span>
              Recent audit records
            </span>
            <strong>
              {auditLogs.length}
            </strong>
          </div>
        </section>

        {message && (
          <div className="admin-message">
            {message}
          </div>
        )}

        {activeSection === "officers" && (
          <section className="admin-section">
            <div className="admin-section-header">
              <div>
                <h2>
                  Officer Directory
                </h2>

                <p>
                  Account status and CINTRA
                  system permissions.
                </p>
              </div>

              <div className="admin-section-tools">
                <UserCog size={21} />

                <button
                  type="button"
                  className="admin-primary-button"
                  onClick={() => {
                    setShowCreateOfficer(
                      (value) => !value
                    );
                    setMessage("");
                  }}
                >
                  <UserPlus size={15} />

                  {showCreateOfficer
                    ? "Close form"
                    : "Add Officer"}
                </button>
              </div>
            </div>

            {showCreateOfficer && (
              <div className="admin-create-panel">
                <div className="admin-create-heading">
                  <div>
                    <h3>
                      Create authorised officer
                    </h3>

                    <p>
                      Create a CINTRA account
                      and assign its initial
                      system role.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="admin-close-button"
                    aria-label="Close form"
                    onClick={closeCreateOfficer}
                  >
                    ×
                  </button>
                </div>

                <form
                  className="admin-officer-form"
                  onSubmit={
                    handleCreateOfficer
                  }
                >
                  <label>
                    <span>
                      Officer ID *
                    </span>

                    <input
                      name="officer_id"
                      value={
                        officerForm.officer_id
                      }
                      onChange={
                        handleOfficerFormChange
                      }
                      placeholder="e.g. OFF-1042"
                      autoComplete="off"
                      required
                    />
                  </label>

                  <label>
                    <span>
                      Full name *
                    </span>

                    <input
                      name="name"
                      value={
                        officerForm.name
                      }
                      onChange={
                        handleOfficerFormChange
                      }
                      placeholder="Officer full name"
                      required
                    />
                  </label>

                  <label>
                    <span>
                      Designation *
                    </span>

                    <input
                      name="designation"
                      value={
                        officerForm.designation
                      }
                      onChange={
                        handleOfficerFormChange
                      }
                      placeholder="e.g. Inspector"
                      required
                    />
                  </label>

                  <label>
                    <span>
                      Unit / Station *
                    </span>

                    <input
                      name="police_station"
                      value={
                        officerForm.police_station
                      }
                      onChange={
                        handleOfficerFormChange
                      }
                      placeholder="Police station or unit"
                      required
                    />
                  </label>

                  <label>
                    <span>Email</span>

                    <input
                      type="email"
                      name="email"
                      value={
                        officerForm.email
                      }
                      onChange={
                        handleOfficerFormChange
                      }
                      placeholder="Official email"
                    />
                  </label>

                  <label>
                    <span>Phone</span>

                    <input
                      type="tel"
                      name="phone"
                      value={
                        officerForm.phone
                      }
                      onChange={
                        handleOfficerFormChange
                      }
                      placeholder="Official mobile number"
                    />
                  </label>

                  <label>
                    <span>
                      Temporary password *
                    </span>

                    <input
                      type="password"
                      name="password"
                      value={
                        officerForm.password
                      }
                      onChange={
                        handleOfficerFormChange
                      }
                      placeholder="Minimum 10 characters"
                      autoComplete="new-password"
                      minLength={10}
                      required
                    />
                  </label>

                  <label>
                    <span>
                      System role *
                    </span>

                    <select
                      name="system_role"
                      value={
                        officerForm.system_role
                      }
                      onChange={
                        handleOfficerFormChange
                      }
                      required
                    >
                      <option value="INVESTIGATOR">
                        Investigator
                      </option>

                      <option value="FORENSIC_ANALYST">
                        Forensic Analyst
                      </option>

                      <option value="SUPERVISOR">
                        Supervisor
                      </option>

                      <option value="SYSTEM_ADMIN">
                        System Administrator
                      </option>
                    </select>
                  </label>

                  <div className="admin-form-note">
                    <ShieldCheck size={16} />

                    <span>
                      First login requires
                      authenticator setup.
                      Administrative account
                      creation is recorded in
                      the CINTRA audit trail.
                    </span>
                  </div>

                  <div className="admin-form-actions">
                    <button
                      type="button"
                      className="admin-secondary-button"
                      disabled={
                        creatingOfficer
                      }
                      onClick={
                        closeCreateOfficer
                      }
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="admin-primary-button"
                      disabled={
                        creatingOfficer
                      }
                    >
                      <UserPlus size={15} />

                      {creatingOfficer
                        ? "Creating…"
                        : "Create Officer"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {loading ? (
              <div className="admin-loading">
                Loading authorised officers…
              </div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Officer</th>
                      <th>Designation</th>
                      <th>
                        Unit / Station
                      </th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>MFA</th>
                      <th>Last login</th>
                      <th>Controls</th>
                    </tr>
                  </thead>

                  <tbody>
                    {officers.length === 0 ? (
                      <tr>
                        <td
                          colSpan="8"
                          className="admin-empty"
                        >
                          No authorised
                          officers found.
                        </td>
                      </tr>
                    ) : (
                      officers.map(
                        (officer) => {
                          const isCurrentAdmin =
                            officer.officer_id ===
                            currentOfficer?.officer_id;

                          return (
                            <tr
                              key={
                                officer.officer_id
                              }
                            >
                              <td>
                                <div className="admin-officer-cell">
                                  <strong>
                                    {officer.name}
                                  </strong>

                                  <span>
                                    {
                                      officer.officer_id
                                    }
                                  </span>
                                </div>
                              </td>

                              <td>
                                {officer.designation ||
                                  "—"}
                              </td>

                              <td>
                                {officer.police_station ||
                                  "—"}
                              </td>

                              <td>
                                <select
                                  value={
                                    officer.system_role
                                  }
                                  disabled={
                                    workingId ===
                                      officer.officer_id ||
                                    isCurrentAdmin
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    handleRoleChange(
                                      officer.officer_id,
                                      event.target
                                        .value
                                    )
                                  }
                                >
                                  <option value="INVESTIGATOR">
                                    Investigator
                                  </option>

                                  <option value="FORENSIC_ANALYST">
                                    Forensic
                                    Analyst
                                  </option>

                                  <option value="SUPERVISOR">
                                    Supervisor
                                  </option>

                                  <option value="SYSTEM_ADMIN">
                                    System
                                    Administrator
                                  </option>
                                </select>
                              </td>

                              <td>
                                <span
                                  className={`admin-status ${
                                    officer.status ===
                                    "Active"
                                      ? "active"
                                      : "inactive"
                                  }`}
                                >
                                  {officer.status}
                                </span>
                              </td>

                              <td>
                                {officer.mfa_enabled
                                  ? "Configured"
                                  : "Setup required"}
                              </td>

                              <td>
                                {formatDate(
                                  officer.last_login_at
                                )}
                              </td>

                              <td>
                                <div className="admin-actions">
                                  <button
                                    type="button"
                                    disabled={
                                      workingId ===
                                        officer.officer_id ||
                                      isCurrentAdmin
                                    }
                                    onClick={() =>
                                      handleStatusChange(
                                        officer
                                      )
                                    }
                                  >
                                    {officer.status ===
                                    "Active"
                                      ? "Disable"
                                      : "Enable"}
                                  </button>

                                  <button
                                    type="button"
                                    disabled={
                                      workingId ===
                                      officer.officer_id
                                    }
                                    onClick={() =>
                                      handleResetMFA(
                                        officer.officer_id
                                      )
                                    }
                                  >
                                    Reset MFA
                                  </button>

                                  <button
                                    type="button"
                                    disabled={
                                      workingId ===
                                        officer.officer_id ||
                                      isCurrentAdmin
                                    }
                                    onClick={() =>
                                      handleRevokeSessions(
                                        officer.officer_id
                                      )
                                    }
                                  >
                                    Revoke sessions
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        }
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeSection === "devices" && (
          <section className="admin-section">
            <div className="admin-section-header">
              <div>
                <h2>
                  Departmental Devices
                </h2>

                <p>
                  Review devices registered
                  for CINTRA access.
                </p>
              </div>

              <Laptop size={21} />
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Device ID</th>
                    <th>Device</th>
                    <th>Station</th>
                    <th>Approval</th>
                    <th>Status</th>
                    <th>Registered</th>
                    <th>Control</th>
                  </tr>
                </thead>

                <tbody>
                  {devices.length === 0 ? (
                    <tr>
                      <td
                        colSpan="7"
                        className="admin-empty"
                      >
                        No departmental
                        devices registered.
                      </td>
                    </tr>
                  ) : (
                    devices.map(
                      (device) => (
                        <tr
                          key={
                            device.device_id
                          }
                        >
                          <td>
                            <strong>
                              {
                                device.device_id
                              }
                            </strong>
                          </td>

                          <td>
                            {device.device_name ||
                              "—"}
                          </td>

                          <td>
                            {device.station ||
                              "—"}
                          </td>

                          <td>
                            {device.is_approved
                              ? "Approved"
                              : "Pending"}
                          </td>

                          <td>
                            {device.status ||
                              "—"}
                          </td>

                          <td>
                            {formatDate(
                              device.created_at
                            )}
                          </td>

                          <td>
                            <button
                              type="button"
                              className="admin-row-button"
                              disabled={
                                workingId ===
                                device.device_id
                              }
                              onClick={() =>
                                handleDeviceApproval(
                                  device
                                )
                              }
                            >
                              {device.is_approved
                                ? "Revoke"
                                : "Approve"}
                            </button>
                          </td>
                        </tr>
                      )
                    )
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeSection === "audit" && (
          <section className="admin-section">
            <div className="admin-section-header">
              <div>
                <h2>
                  System Audit Trail
                </h2>

                <p>
                  Recorded authentication
                  and administrative activity.
                </p>
              </div>

              <Activity size={21} />
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Officer</th>
                    <th>Action</th>
                    <th>Resource</th>
                    <th>Description</th>
                    <th>Result</th>
                  </tr>
                </thead>

                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td
                        colSpan="6"
                        className="admin-empty"
                      >
                        No audit records
                        available.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map(
                      (log, index) => (
                        <tr
                          key={
                            log.id ||
                            `${log.action}-${index}`
                          }
                        >
                          <td>
                            {formatDate(
                              log.created_at
                            )}
                          </td>

                          <td>
                            {log.officer_id ||
                              "SYSTEM"}
                          </td>

                          <td>
                            <strong>
                              {log.action}
                            </strong>
                          </td>

                          <td>
                            {log.resource_type ||
                              "—"}

                            {log.resource_id
                              ? ` / ${log.resource_id}`
                              : ""}
                          </td>

                          <td>
                            {log.description ||
                              "—"}
                          </td>

                          <td>
                            {log.success ===
                            false
                              ? "Failed"
                              : "Success"}
                          </td>
                        </tr>
                      )
                    )
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      <footer className="admin-footer">
        <span>
          CINTRA · Crime Intelligence and
          Tracking Response Apparatus
        </span>

        <span>
          Administrative access is audited.
        </span>
      </footer>
    </div>
  );
}
