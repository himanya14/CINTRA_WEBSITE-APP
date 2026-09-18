import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import supremeCourt from "../../assets/images/supreme_court.png";
import cintraLogo from "../../assets/images/cintra-logo.png";

import {
  loginOfficer,
  saveSession,
  verifyMFA,
} from "../../services/api.js";

import "./LoginPage.css";


function getDeviceId() {
  let deviceId =
    localStorage.getItem("cintra_device_id");

  if (!deviceId) {
    deviceId =
      window.crypto?.randomUUID?.() ||
      `CINTRA-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;

    localStorage.setItem(
      "cintra_device_id",
      deviceId
    );
  }

  return deviceId;
}


function getRouteForOfficer(officer) {
  switch (officer?.system_role) {
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


export default function LoginPage() {
  const navigate = useNavigate();

  const [step, setStep] =
    useState("credentials");

  const [officerId, setOfficerId] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [rememberMe, setRememberMe] =
    useState(false);

  const [showPassword, setShowPassword] =
    useState(false);

  const [challengeToken, setChallengeToken] =
    useState("");

  const [mfaCode, setMfaCode] =
    useState("");

  const [
    mfaSetupRequired,
    setMfaSetupRequired,
  ] = useState(false);

  const [mfaSecret, setMfaSecret] =
    useState("");

  const [
    provisioningUri,
    setProvisioningUri,
  ] = useState("");

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");


  async function handleLogin(event) {
    event.preventDefault();

    setMessage("");

    const cleanOfficerId =
      officerId.trim();

    if (!cleanOfficerId || !password) {
      setMessage(
        "Enter your Officer ID and password."
      );

      return;
    }

    try {
      setLoading(true);

      const data = await loginOfficer(
        cleanOfficerId,
        password
      );

      if (data?.access_token) {
        saveSession(
          data,
          rememberMe
        );

        navigate(
          getRouteForOfficer(
            data.officer
          ),
          {
            replace: true,
          }
        );

        return;
      }

      if (!data?.requires_mfa) {
        throw new Error(
          "Authentication response was incomplete."
        );
      }

      if (!data?.challenge_token) {
        throw new Error(
          "MFA challenge token was not returned."
        );
      }

      setChallengeToken(
        data.challenge_token
      );

      setMfaSetupRequired(
        Boolean(
          data.mfa_setup_required
        )
      );

      setMfaSecret(
        data.mfa_secret || ""
      );

      setProvisioningUri(
        data.provisioning_uri || ""
      );

      setMfaCode("");

      setStep("mfa");
    } catch (error) {
      console.error(
        "CINTRA login error:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to connect to CINTRA."
      );
    } finally {
      setLoading(false);
    }
  }


  async function handleVerifyMFA(event) {
    event.preventDefault();

    setMessage("");

    const cleanCode =
      mfaCode.replace(/\s/g, "");

    if (!/^\d{6}$/.test(cleanCode)) {
      setMessage(
        "Enter the 6-digit code from your authenticator app."
      );

      return;
    }

    try {
      setLoading(true);

      const data = await verifyMFA(
        challengeToken,
        cleanCode,
        getDeviceId()
      );

      if (!data?.access_token) {
        throw new Error(
          "Authentication token was not returned."
        );
      }

      if (!data?.officer) {
        throw new Error(
          "Officer information was not returned."
        );
      }

      saveSession(
        data,
        rememberMe
      );

      navigate(
        getRouteForOfficer(
          data.officer
        ),
        {
          replace: true,
        }
      );
    } catch (error) {
      console.error(
        "CINTRA MFA verification error:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to verify authentication code."
      );
    } finally {
      setLoading(false);
    }
  }


  function backToLogin() {
    setStep("credentials");

    setChallengeToken("");
    setMfaCode("");
    setMfaSecret("");
    setProvisioningUri("");
    setMfaSetupRequired(false);
    setMessage("");
  }


  return (
    <div className="cintra-login-page">

      <header className="cintra-login-header">

        <div className="cintra-login-brand">

          <img
            src={cintraLogo}
            alt="CINTRA"
            className="cintra-login-logo"
          />

        </div>


        <div className="cintra-login-header-right">

          <div className="cintra-login-tagline">

            <ShieldCheck
              size={24}
              strokeWidth={1.7}
            />

            <span>
              Secure. Intelligent. Responsive.
            </span>

          </div>


          <span className="cintra-login-header-divider" />


          <button
            type="button"
            className="cintra-login-grid-menu"
            aria-label="Applications"
          >
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </button>

        </div>

      </header>


      <main
        className="cintra-login-hero"
        style={{
          backgroundImage:
            `url(${supremeCourt})`,
        }}
      >

        <div className="cintra-login-overlay" />


        <section className="cintra-login-copy">

          <div className="cintra-login-motto">

            <span />

            <strong>
              SATYAMEV JAYATE
            </strong>

            <span />

          </div>


          <h1>
            CINTRA
          </h1>


          <div className="cintra-login-gold-line" />


          <p>
            Crime Intelligence and
            <br />
            Tracking Response Apparatus
          </p>

        </section>


        <section className="cintra-login-card">

          {step === "credentials" ? (
            <>

              <div className="cintra-login-lock">

                <LockKeyhole
                  size={28}
                  strokeWidth={1.55}
                />

              </div>


              <h2>
                Secure Login
              </h2>


              <p className="cintra-login-subtitle">
                Login to continue to CINTRA
              </p>


              <form
                onSubmit={handleLogin}
                className="cintra-login-form"
              >

                <div className="cintra-login-field">

                  <label htmlFor="officerId">
                    Officer ID
                  </label>


                  <div className="cintra-login-input">

                    <UserRound
                      size={18}
                      strokeWidth={1.7}
                    />


                    <input
                      id="officerId"
                      type="text"
                      value={officerId}
                      placeholder="Enter Officer ID"
                      autoComplete="username"
                      onChange={(event) =>
                        setOfficerId(
                          event.target.value
                        )
                      }
                    />

                  </div>

                </div>


                <div className="cintra-login-field">

                  <label htmlFor="password">
                    Password
                  </label>


                  <div className="cintra-login-input">

                    <LockKeyhole
                      size={18}
                      strokeWidth={1.7}
                    />


                    <input
                      id="password"
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
                      value={password}
                      placeholder="Enter Password"
                      autoComplete="current-password"
                      onChange={(event) =>
                        setPassword(
                          event.target.value
                        )
                      }
                    />


                    <button
                      type="button"
                      className="cintra-login-eye"
                      aria-label={
                        showPassword
                          ? "Hide password"
                          : "Show password"
                      }
                      onClick={() =>
                        setShowPassword(
                          (current) =>
                            !current
                        )
                      }
                    >

                      {showPassword ? (
                        <Eye
                          size={18}
                          strokeWidth={1.7}
                        />
                      ) : (
                        <EyeOff
                          size={18}
                          strokeWidth={1.7}
                        />
                      )}

                    </button>

                  </div>

                </div>


                <div className="cintra-login-options">

                  <label className="cintra-login-remember">

                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(event) =>
                        setRememberMe(
                          event.target.checked
                        )
                      }
                    />

                    <span>
                      Remember me
                    </span>

                  </label>


                  <button
                    type="button"
                    className="cintra-login-forgot"
                  >
                    Forgot Password?
                  </button>

                </div>


                <button
                  type="submit"
                  className="cintra-login-primary"
                  disabled={loading}
                >
                  {loading
                    ? "Authenticating..."
                    : "Login"}
                </button>


                {message && (
                  <div
                    className="cintra-login-message"
                    role="alert"
                  >
                    {message}
                  </div>
                )}

              </form>

            </>
          ) : (
            <>

              <div className="cintra-login-lock">

                <KeyRound
                  size={27}
                  strokeWidth={1.55}
                />

              </div>


              <h2>
                {mfaSetupRequired
                  ? "Set Up Authenticator"
                  : "Verify Identity"}
              </h2>


              <p className="cintra-login-subtitle">

                {mfaSetupRequired
                  ? "Secure your CINTRA officer account"
                  : `Enter the authentication code for ${officerId}`}

              </p>


              {mfaSetupRequired && (
                <div className="cintra-login-mfa-setup">

                  <strong>
                    Authenticator setup required
                  </strong>


                  <p>
                    Add CINTRA to Google Authenticator,
                    Microsoft Authenticator or another
                    TOTP-compatible authenticator.
                  </p>


                  {mfaSecret && (
                    <>

                      <span className="cintra-login-setup-label">
                        Setup key
                      </span>


                      <div className="cintra-login-secret">
                        {mfaSecret}
                      </div>

                    </>
                  )}


                  {provisioningUri && (
                    <p className="cintra-login-setup-note">
                      Your CINTRA account is ready
                      to be added to the authenticator.
                    </p>
                  )}

                </div>
              )}


              <form
                onSubmit={handleVerifyMFA}
                className="cintra-login-form"
              >

                <div className="cintra-login-field">

                  <label htmlFor="mfaCode">
                    6-digit authentication code
                  </label>


                  <div className="cintra-login-input">

                    <KeyRound
                      size={18}
                      strokeWidth={1.7}
                    />


                    <input
                      id="mfaCode"
                      className="cintra-login-mfa-code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="000000"
                      value={mfaCode}
                      autoFocus
                      onChange={(event) =>
                        setMfaCode(
                          event.target.value
                            .replace(/\D/g, "")
                            .slice(0, 6)
                        )
                      }
                    />

                  </div>

                </div>


                <button
                  type="submit"
                  className="cintra-login-primary"
                  disabled={loading}
                >
                  {loading
                    ? "Verifying..."
                    : "Verify & Continue"}
                </button>


                <button
                  type="button"
                  className="cintra-login-back"
                  disabled={loading}
                  onClick={backToLogin}
                >

                  <ArrowLeft
                    size={16}
                    strokeWidth={1.8}
                  />

                  Back to login

                </button>


                {message && (
                  <div
                    className="cintra-login-message"
                    role="alert"
                  >
                    {message}
                  </div>
                )}

              </form>

            </>
          )}

        </section>

      </main>


      <footer className="cintra-login-footer">

        <span>
          © 2026 CINTRA. All rights reserved.
        </span>

        <i />

        <button type="button">
          Privacy Policy
        </button>

        <i />

        <button type="button">
          Terms of Use
        </button>

        <i />

        <button type="button">
          Help &amp; Support
        </button>

      </footer>

    </div>
  );
}