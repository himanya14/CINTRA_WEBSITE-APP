# CINTRA — Final Unified Web + Mobile Integration

This build uses **one source of truth**:

```text
CINTRA Website ─┐
                ├── FastAPI :8000 ── PostgreSQL cintra_db
CINTRA Mobile ──┘
```

There is no separate mobile user database, case database, person database, or evidence database.
The app fetches the same cases/persons used by the website and writes new field evidence back to
those existing records.

## Login expected for the demo

- Officer ID: `SH-001`
- Password: `CintraDemo#2026`
- Second factor: the **current 6-digit Authenticator/TOTP code from the same authenticator account used by the website**.

The mobile app does not generate a fake OTP. It calls the same `/auth/login` and `/auth/verify-mfa`
endpoints and uses the same PostgreSQL `officers` row and MFA secret as the website.

## 1. Reuse the existing website PostgreSQL environment

From the project root in PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\use_existing_website_env.ps1
```

This reads the existing website `.env` from:

```text
C:\Users\himan\OneDrive\Desktop\SIH'26\backend\.env
```

and writes this project's `backend\.env` without printing the database password or MFA secret.
If the original website moved, pass the path:

```powershell
.\use_existing_website_env.ps1 -OriginalEnv "C:\path\to\old\backend\.env"
```

The final backend intentionally refuses SQLite. If the backend starts, it is using PostgreSQL.

## 2. Install/update dependencies

Backend:

```powershell
cd .\backend
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

If this is a fresh extraction and there is no venv, run the root setup script instead:

```powershell
cd ..
.\setup_windows.ps1
```

## 3. Start backend

```powershell
cd <PROJECT_ROOT>
.\run_backend.ps1
```

Phone/laptop health check:

```text
http://10.61.15.50:8000/api/v1/health
```

The response should include:

```json
{
  "shared_database": true,
  "database_engine": "postgresql",
  "database_name": "cintra_db"
}
```

Optional DB/auth pre-flight, after the backend environment is configured:

```powershell
cd .\backend
.\venv\Scripts\python.exe verify_unified_integration.py
```

It checks that `SH-001`, MFA, central cases/persons/evidence and the new secure-evidence tables are
all present without printing secrets.

## 4. Start website

In a second PowerShell window:

```powershell
cd <PROJECT_ROOT>
.\run_website.ps1
```

Open the Vite URL (normally `http://localhost:5173`). Login with `SH-001`, the website password,
and the current Authenticator code.

## 5. Start mobile

Ensure `mobile\.env` contains the laptop LAN address:

```env
EXPO_PUBLIC_API_BASE_URL=http://10.61.15.50:8000
```

Then in a third PowerShell window:

```powershell
cd <PROJECT_ROOT>
.\run_mobile.ps1
```

`run_mobile.ps1` uses `npx expo start -c` so stale `OFF001` bundles are cleared.
The project is Expo SDK 54, so use a compatible Expo Go SDK 54 build unless you intentionally upgrade the project.

## What is actually shared/mapped

The mobile field companion calls the central backend to load:

- existing FIR/cases from `cases`
- persons already linked to the selected case from `case_persons` + `persons`
- the authenticated officer from `officers`

A mobile evidence upload is mapped to the selected **existing case ID** and optional **existing person ID**.
The backend then performs one integrated field-evidence flow:

```text
mobile file
  -> authenticated SH-001 JWT
  -> existing Case/FIR
  -> optional existing Person
  -> SHA-256 baseline of original bytes
  -> AES-256-GCM encrypted storage
  -> Evidence row in PostgreSQL
  -> REGISTERED chain-of-custody event
  -> optional Hyperledger Fabric ledger receipt
  -> EVIDENCE_CAPTURED timeline event
  -> Person -> Evidence relationship + relationship source
  -> latest relationship graph snapshot
  -> web pages refresh from the same DB
```

Expected website visibility after upload:

- **Evidence**: new evidence record, source, officer and SHA-256
- **Persons → Documents & Records**: evidence if a person was linked
- **Relationship Analysis**: Person → Evidence node/edge if a person was linked
- **Timeline**: `EVIDENCE_CAPTURED`
- **Chain of Custody**: `REGISTERED` by the authenticated officer
- **Case Workspace**: evidence/relationship data after automatic refresh

Evidence, Persons, Relationship Analysis, Timeline and Case Workspace refresh approximately every 7 seconds in this build.

## Evidence security

For new mobile field evidence:

- SHA-256 is calculated server-side from the original bytes and stored as the forensic baseline.
- The original evidence is stored only as an AES-256-GCM encrypted artifact under `backend/secure_storage/evidence`.
- The website decrypts protected evidence only through an authenticated streaming endpoint.
- Integrity verification decrypts/authenticates the AES-GCM artifact, recalculates SHA-256 and records a `VERIFIED` or `INTEGRITY_MISMATCH` custody event.
- Custody actions can also be mirrored to Hyperledger Fabric.

`CINTRA_EVIDENCE_ENCRYPTION_KEY` can be supplied as a URL-safe Base64 32-byte key. If omitted for the
local demo, the service derives a stable 32-byte AES key from the existing CINTRA backend secret so evidence
remains decryptable across restarts as long as that secret is unchanged.

Optional: before the first secure mobile upload, generate an independent key in PowerShell:

```powershell
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
$key = [Convert]::ToBase64String($bytes).Replace('+','-').Replace('/','_')
Add-Content .\backend\.env "CINTRA_EVIDENCE_ENCRYPTION_KEY=$key"
```

Keep that key unchanged after evidence has been encrypted. For the fastest local demo, simply omit it and
use the stable secret-derived key.

## Hyperledger Fabric

The optional bridge is in `fabric_gateway/` and is configured for:

- Channel: `cintrachannel`
- Chaincode: `cintra-custody`
- Local gateway service: `127.0.0.1:4100`

Keep this in `backend/.env` until a real Fabric network/gateway is running:

```env
FABRIC_ENABLED=false
```

CINTRA will truthfully show `DISABLED`; it will never invent a blockchain transaction ID. When the real
network is configured and the gateway is running, set `FABRIC_ENABLED=true`. See `fabric_gateway/README.md`.

## Important

Do **not** run the old `bootstrap_unified_demo.py`. It has been removed from this build because it created
a separate quick-start dataset and was the reason website/app data diverged.

See `DATABASE_NOTE.txt`: there is no second runtime database or SQL dump in this build.
