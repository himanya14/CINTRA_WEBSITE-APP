import { useEffect, useState } from "react";

import {
  Navigate,
  Route,
  Routes,
  useSearchParams,
} from "react-router-dom";


/* =========================================================
   AUTH
   ========================================================= */

import LoginPage from "./pages/Login/LoginPage.jsx";


/* =========================================================
   INVESTIGATOR / SUPERVISOR
   ========================================================= */

import OfficerHome from "./pages/Home/OfficerHome.jsx";
import CasesPage from "./pages/Cases/CasesPage.jsx";
import CaseWorkspace from "./pages/CaseWorkspace/CaseWorkspace.jsx";
import RelationshipAnalysis from "./pages/Relationships/RelationshipAnalysis.jsx";
import EvidenceViewer from "./pages/Evidence/EvidenceViewer.jsx";
import PersonsPage from "./pages/Persons/PersonsPage.jsx";
import ChargesheetPreview from "./pages/Chargesheet/ChargesheetPreview.jsx";
import IntelligenceDashboard from "./pages/Intelligence/IntelligenceDashboard.jsx";
import AdvancedSearch from "./pages/Search/AdvancedSearch.jsx";
import CrossCasePage from "./pages/CrossCase/CrossCasePage.jsx";
import LegalMasterPage from "./pages/LegalMaster/LegalMasterPage.jsx";
import CaseLegalPage from "./pages/LegalMaster/CaseLegalPage.jsx";
import MasterDataPage from "./pages/MasterData/MasterDataPage.jsx";
import TimelinePage from "./pages/Timeline/TimelinePage.jsx";


/* =========================================================
   FORENSIC ANALYST
   ========================================================= */

import ForensicOverview from "./pages/ForensicOverview/ForensicOverview.jsx";
import ForensicAssignments from "./pages/ForensicAssignments/ForensicAssignments.jsx";
import ForensicEvidence from "./pages/ForensicEvidence/ForensicEvidence.jsx";
import DigitalForensics from "./pages/DigitalForensics/DigitalForensics.jsx";
import ForensicIntelligence from "./pages/ForensicIntelligence/ForensicIntelligence.jsx";


/* =========================================================
   ADMIN
   ========================================================= */

import AdminDashboard from "./pages/Admin/AdminDashboard.jsx";
import FeatureCoverage from "./pages/FeatureCoverage/FeatureCoverage.jsx";


/* =========================================================
   AUTH SERVICES
   ========================================================= */

import {
  getAccessToken,
  getOfficer,
} from "./services/api.js";

import {
  getForensicCases,
} from "./services/forensics.js";


import "./App.css";


/* =========================================================
   DEFAULT ROUTE
   ========================================================= */

function getDefaultRoute() {
  const officer =
    getOfficer();


  if (!officer) {
    return "/";
  }


  switch (
    officer.system_role
  ) {
    case "SYSTEM_ADMIN":
      return "/admin";

    case "FORENSIC_ANALYST":
      return "/forensic";

    case "SUPERVISOR":
    case "INVESTIGATOR":
    default:
      return "/home";
  }
}


/* =========================================================
   PROTECTED ROUTE
   ========================================================= */

function ProtectedRoute({
  children,
  allowedRoles = null,
}) {
  const token =
    getAccessToken();

  const officer =
    getOfficer();


  if (
    !token ||
    !officer
  ) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }


  if (
    allowedRoles &&
    !allowedRoles.includes(
      officer.system_role
    )
  ) {
    return (
      <Navigate
        to={getDefaultRoute()}
        replace
      />
    );
  }


  return children;
}


/* =========================================================
   LOGIN ROUTE
   ========================================================= */

function LoginRoute() {
  const token =
    getAccessToken();

  const officer =
    getOfficer();


  if (
    token &&
    officer
  ) {
    return (
      <Navigate
        to={getDefaultRoute()}
        replace
      />
    );
  }


  return (
    <LoginPage />
  );
}


/* =========================================================
   FORENSIC RELATIONSHIPS ENTRY

   The top navigation points to /forensic/relationships
   without hardcoding a case.

   This component:
   - loads only cases assigned to the logged-in forensic analyst
   - honors ?case=<database id or display case id> when present
   - otherwise opens the first assigned case
   - redirects into a real :caseId relationship route
   ========================================================= */

function ForensicRelationshipsEntry() {
  const [searchParams] =
    useSearchParams();

  const requestedCase =
    searchParams.get("case");

  const [
    destination,
    setDestination,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);


  useEffect(() => {
    let cancelled = false;


    async function resolveRelationshipCase() {
      try {
        setLoading(true);

        const result =
          await getForensicCases();

        const assignedCases =
          Array.isArray(result)
            ? result
            : [];


        if (cancelled) {
          return;
        }


        if (
          assignedCases.length === 0
        ) {
          setDestination(
            "/forensic/assignments"
          );

          return;
        }


        let selectedCase = null;


        if (requestedCase) {
          selectedCase =
            assignedCases.find(
              (caseRecord) =>
                String(
                  caseRecord.id
                ) ===
                  String(
                    requestedCase
                  ) ||
                String(
                  caseRecord.case_id
                ) ===
                  String(
                    requestedCase
                  )
            ) || null;
        }


        if (!selectedCase) {
          selectedCase =
            assignedCases[0];
        }


        setDestination(
          `/forensic/relationships/${selectedCase.id}`
        );
      } catch (error) {
        console.error(
          "Forensic relationship route error:",
          error
        );

        if (!cancelled) {
          setDestination(
            "/forensic"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }


    resolveRelationshipCase();


    return () => {
      cancelled = true;
    };
  }, [requestedCase]);


  if (loading) {
    return (
      <div
        style={{
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#64748b",
          fontSize: "14px",
        }}
      >
        Loading relationship workspace…
      </div>
    );
  }


  return (
    <Navigate
      to={
        destination ||
        "/forensic"
      }
      replace
    />
  );
}


/* =========================================================
   APP
   ========================================================= */

function App() {
  return (
    <Routes>

      {/* ===================================================
          LOGIN
          =================================================== */}

      <Route
        path="/"
        element={
          <LoginRoute />
        }
      />


      {/* ===================================================
          ADMIN
          =================================================== */}

      <Route
        path="/admin"
        element={
          <ProtectedRoute
            allowedRoles={[
              "SYSTEM_ADMIN",
            ]}
          >
            <AdminDashboard />
          </ProtectedRoute>
        }
      />


      <Route
        path="/admin/features"
        element={
          <ProtectedRoute allowedRoles={["SYSTEM_ADMIN"]}>
            <FeatureCoverage />
          </ProtectedRoute>
        }
      />


      {/* ===================================================
          FORENSIC OVERVIEW
          =================================================== */}

      <Route
        path="/forensic"
        element={
          <ProtectedRoute
            allowedRoles={[
              "FORENSIC_ANALYST",
            ]}
          >
            <ForensicOverview />
          </ProtectedRoute>
        }
      />


      {/* ===================================================
          FORENSIC ASSIGNMENTS
          =================================================== */}

      <Route
        path="/forensic/assignments"
        element={
          <ProtectedRoute
            allowedRoles={[
              "FORENSIC_ANALYST",
            ]}
          >
            <ForensicAssignments />
          </ProtectedRoute>
        }
      />


      {/* ===================================================
          FORENSIC EVIDENCE
          =================================================== */}

      <Route
        path="/forensic/evidence"
        element={
          <ProtectedRoute
            allowedRoles={[
              "FORENSIC_ANALYST",
            ]}
          >
            <ForensicEvidence />
          </ProtectedRoute>
        }
      />


      {/* ===================================================
          FORENSIC INTELLIGENCE
          =================================================== */}

      <Route
        path="/forensic/intelligence"
        element={
          <ProtectedRoute
            allowedRoles={[
              "FORENSIC_ANALYST",
            ]}
          >
            <ForensicIntelligence />
          </ProtectedRoute>
        }
      />


      {/* ===================================================
          DIGITAL FORENSICS

          IMPORTANT:
          NO REDIRECT TO EVIDENCE.
          =================================================== */}

      <Route
        path="/forensic/digital-forensics"
        element={
          <ProtectedRoute
            allowedRoles={[
              "FORENSIC_ANALYST",
            ]}
          >
            <DigitalForensics />
          </ProtectedRoute>
        }
      />


      {/* ===================================================
          FORENSIC RELATIONSHIPS ENTRY
          =================================================== */}

      <Route
        path="/forensic/relationships"
        element={
          <ProtectedRoute
            allowedRoles={[
              "FORENSIC_ANALYST",
            ]}
          >
            <ForensicRelationshipsEntry />
          </ProtectedRoute>
        }
      />


      {/* ===================================================
          FORENSIC CASE RELATIONSHIPS
          =================================================== */}

      <Route
        path="/forensic/relationships/:caseId"
        element={
          <ProtectedRoute
            allowedRoles={[
              "FORENSIC_ANALYST",
            ]}
          >
            <RelationshipAnalysis />
          </ProtectedRoute>
        }
      />


      {/* ===================================================
          FORENSIC SEARCH
          =================================================== */}

      <Route
        path="/forensic/search"
        element={
          <ProtectedRoute
            allowedRoles={[
              "FORENSIC_ANALYST",
            ]}
          >
            <AdvancedSearch />
          </ProtectedRoute>
        }
      />


      {/* ===================================================
          EXPANDED INVESTIGATION MODULES
          =================================================== */}

      <Route
        path="/cross-case"
        element={
          <ProtectedRoute allowedRoles={["INVESTIGATOR", "SUPERVISOR", "FORENSIC_ANALYST"]}>
            <CrossCasePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/legal"
        element={
          <ProtectedRoute allowedRoles={["INVESTIGATOR", "SUPERVISOR", "SYSTEM_ADMIN"]}>
            <LegalMasterPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/master-data"
        element={
          <ProtectedRoute allowedRoles={["INVESTIGATOR", "SUPERVISOR", "SYSTEM_ADMIN"]}>
            <MasterDataPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/cases/:caseId/legal"
        element={
          <ProtectedRoute allowedRoles={["INVESTIGATOR", "SUPERVISOR"]}>
            <CaseLegalPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/cases/:caseId/timeline-full"
        element={
          <ProtectedRoute allowedRoles={["INVESTIGATOR", "SUPERVISOR"]}>
            <TimelinePage />
          </ProtectedRoute>
        }
      />


      {/* ===================================================
          INVESTIGATOR / SUPERVISOR HOME
          =================================================== */}

      <Route
        path="/home"
        element={
          <ProtectedRoute
            allowedRoles={[
              "INVESTIGATOR",
              "SUPERVISOR",
            ]}
          >
            <OfficerHome />
          </ProtectedRoute>
        }
      />


      {/* ===================================================
          CASES
          =================================================== */}

      <Route
        path="/cases"
        element={
          <ProtectedRoute
            allowedRoles={[
              "INVESTIGATOR",
              "SUPERVISOR",
            ]}
          >
            <CasesPage />
          </ProtectedRoute>
        }
      />


      <Route
        path="/cases/:caseId"
        element={
          <ProtectedRoute
            allowedRoles={[
              "INVESTIGATOR",
              "SUPERVISOR",
            ]}
          >
            <CaseWorkspace />
          </ProtectedRoute>
        }
      />


      {/* ===================================================
          PERSONS
          =================================================== */}

      <Route
        path="/persons"
        element={
          <ProtectedRoute
            allowedRoles={[
              "INVESTIGATOR",
              "SUPERVISOR",
            ]}
          >
            <PersonsPage />
          </ProtectedRoute>
        }
      />


      <Route
        path="/cases/:caseId/persons"
        element={
          <ProtectedRoute
            allowedRoles={[
              "INVESTIGATOR",
              "SUPERVISOR",
            ]}
          >
            <PersonsPage />
          </ProtectedRoute>
        }
      />


      {/* ===================================================
          CASE EVIDENCE
          =================================================== */}

      <Route
        path="/cases/:caseId/evidence"
        element={
          <ProtectedRoute
            allowedRoles={[
              "INVESTIGATOR",
              "FORENSIC_ANALYST",
              "SUPERVISOR",
            ]}
          >
            <EvidenceViewer />
          </ProtectedRoute>
        }
      />


      {/* ===================================================
          GENERAL INTELLIGENCE
          =================================================== */}

      <Route
        path="/intelligence"
        element={
          <ProtectedRoute
            allowedRoles={[
              "INVESTIGATOR",
              "FORENSIC_ANALYST",
              "SUPERVISOR",
            ]}
          >
            <IntelligenceDashboard />
          </ProtectedRoute>
        }
      />


      {/* ===================================================
          CASE RELATIONSHIPS
          =================================================== */}

      <Route
        path="/cases/:caseId/relationships"
        element={
          <ProtectedRoute
            allowedRoles={[
              "INVESTIGATOR",
              "FORENSIC_ANALYST",
              "SUPERVISOR",
            ]}
          >
            <RelationshipAnalysis />
          </ProtectedRoute>
        }
      />


      {/* ===================================================
          GENERAL SEARCH
          =================================================== */}

      <Route
        path="/search"
        element={
          <ProtectedRoute
            allowedRoles={[
              "INVESTIGATOR",
              "FORENSIC_ANALYST",
              "SUPERVISOR",
            ]}
          >
            <AdvancedSearch />
          </ProtectedRoute>
        }
      />


      {/* ===================================================
          CHARGESHEET
          =================================================== */}

      <Route
        path="/cases/:caseId/chargesheet"
        element={
          <ProtectedRoute
            allowedRoles={[
              "INVESTIGATOR",
              "SUPERVISOR",
            ]}
          >
            <ChargesheetPreview />
          </ProtectedRoute>
        }
      />


      {/* ===================================================
          UNKNOWN ROUTE
          =================================================== */}

      <Route
        path="*"
        element={
          <Navigate
            to={getDefaultRoute()}
            replace
          />
        }
      />

    </Routes>
  );
}


export default App;
