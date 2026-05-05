ALTER TABLE github_accounts
    ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS user_type TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS site_admin BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS unlinked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS link_status TEXT NOT NULL DEFAULT 'linked';

ALTER TABLE github_user_tokens
    ADD COLUMN IF NOT EXISTS last_refreshed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_refresh_error TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS revoked_reason TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS auth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    github_account_id UUID NOT NULL REFERENCES github_accounts(id) ON DELETE CASCADE,
    session_token_hash TEXT NOT NULL UNIQUE,
    csrf_token_hash TEXT NOT NULL,
    roles TEXT[] NOT NULL DEFAULT '{}'::text[],
    request_ip TEXT NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL DEFAULT '',
    github_authorization_status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rotated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    idle_expires_at TIMESTAMPTZ NOT NULL,
    invalidated_at TIMESTAMPTZ,
    invalidated_reason TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS auth_oauth_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state_nonce TEXT NOT NULL UNIQUE,
    browser_token_hash TEXT NOT NULL,
    intent TEXT NOT NULL,
    client_mode TEXT NOT NULL,
    request_ip TEXT NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL DEFAULT '',
    return_to TEXT NOT NULL DEFAULT '',
    linking_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    used_by_github_account_id UUID REFERENCES github_accounts(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_github_accounts_single_linked_per_user
    ON github_accounts(user_id)
    WHERE link_status = 'linked';

CREATE INDEX IF NOT EXISTS idx_github_accounts_login_status ON github_accounts(login, link_status);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_active ON auth_sessions(user_id, expires_at DESC) WHERE invalidated_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_auth_sessions_github_account_active ON auth_sessions(github_account_id, expires_at DESC) WHERE invalidated_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_auth_oauth_states_expires_unused ON auth_oauth_states(expires_at) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
