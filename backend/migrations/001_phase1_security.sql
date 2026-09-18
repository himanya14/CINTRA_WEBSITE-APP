-- ============================================================
-- CINTRA
-- Phase 1 Security Migration
-- ============================================================

BEGIN;


-- ============================================================
-- OFFICER SECURITY FIELDS
-- ============================================================

ALTER TABLE officers
ADD COLUMN IF NOT EXISTS system_role VARCHAR(50)
NOT NULL DEFAULT 'INVESTIGATOR';

ALTER TABLE officers
ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN
NOT NULL DEFAULT FALSE;

ALTER TABLE officers
ADD COLUMN IF NOT EXISTS mfa_secret VARCHAR(255);

ALTER TABLE officers
ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER
NOT NULL DEFAULT 0;

ALTER TABLE officers
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;

ALTER TABLE officers
ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP;

ALTER TABLE officers
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;


-- ============================================================
-- APPROVED DEVICES
-- ============================================================

CREATE TABLE IF NOT EXISTS approved_devices (

    id SERIAL PRIMARY KEY,

    device_id VARCHAR(255)
        UNIQUE NOT NULL,

    device_name VARCHAR(255),

    station VARCHAR(255),

    status VARCHAR(50)
        NOT NULL DEFAULT 'Active',

    is_approved BOOLEAN
        NOT NULL DEFAULT FALSE,

    approved_by VARCHAR(100),

    approved_at TIMESTAMP,

    last_seen_at TIMESTAMP,

    created_at TIMESTAMP
        NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS
idx_approved_devices_device_id
ON approved_devices(device_id);


-- ============================================================
-- OFFICER SESSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS officer_sessions (

    id SERIAL PRIMARY KEY,

    session_id VARCHAR(255)
        UNIQUE NOT NULL,

    officer_id VARCHAR(100)
        NOT NULL,

    device_id VARCHAR(255),

    refresh_token_hash VARCHAR(255),

    ip_address VARCHAR(100),

    user_agent TEXT,

    is_active BOOLEAN
        NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP
        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    expires_at TIMESTAMP,

    last_activity_at TIMESTAMP
        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    revoked_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS
idx_officer_sessions_session_id
ON officer_sessions(session_id);

CREATE INDEX IF NOT EXISTS
idx_officer_sessions_officer_id
ON officer_sessions(officer_id);


-- ============================================================
-- AUDIT LOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (

    id SERIAL PRIMARY KEY,

    officer_id VARCHAR(100),

    action VARCHAR(150)
        NOT NULL,

    resource_type VARCHAR(100),

    resource_id VARCHAR(255),

    description TEXT,

    ip_address VARCHAR(100),

    device_id VARCHAR(255),

    success BOOLEAN
        NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP
        NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS
idx_audit_logs_officer_id
ON audit_logs(officer_id);

CREATE INDEX IF NOT EXISTS
idx_audit_logs_action
ON audit_logs(action);

CREATE INDEX IF NOT EXISTS
idx_audit_logs_created_at
ON audit_logs(created_at);


-- ============================================================
-- MFA CHALLENGES
-- ============================================================

CREATE TABLE IF NOT EXISTS mfa_challenges (

    id SERIAL PRIMARY KEY,

    challenge_token VARCHAR(255)
        UNIQUE NOT NULL,

    officer_id VARCHAR(100)
        NOT NULL,

    device_id VARCHAR(255),

    expires_at TIMESTAMP
        NOT NULL,

    used BOOLEAN
        NOT NULL DEFAULT FALSE,

    created_at TIMESTAMP
        NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS
idx_mfa_challenges_token
ON mfa_challenges(challenge_token);

CREATE INDEX IF NOT EXISTS
idx_mfa_challenges_officer
ON mfa_challenges(officer_id);


COMMIT;