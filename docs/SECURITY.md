# Zivvvo — Security

> How we handle secrets, learner data, and backend hardening.

## Why this exists

Zivvvo holds learner attempt data (a proxy for their ability) and, in research
tooling, a third-party site's account credentials. Both must be protected by
design: nothing sensitive in the repository, least-privilege everywhere.

## Secrets & Authentication

- **Nothing sensitive is committed.** Research credentials live in
  `data/primaed/.creds.txt` or environment variables (`PRIMAED_USER` /
  `PRIMAED_PASS`) and are read by `tools/primaed/primaed_session.ps1`.
  `.gitignore` blocks them; the scraper scripts contain zero hardcoded
  credentials (verified).
- **Client never holds service keys.** Supabase service-role keys exist only
  server-side (Edge Functions) — never bundled into the PWA.
- **`.env` / `.env.local`** are gitignored and only reference public
  Supabase anon/project URLs for device use.

## Backend Hardening

1. **RLS everywhere on learner-owned tables** (`attempts`,
   `mastery_snapshot`, `sync_watermark`) — row access keyed to `auth.uid()`.
2. **Content is read-only, hash-verified** — content packs are immutable,
   served with content hash checks; the client rejects tampered packs.
3. **Admin writes** (content publishing, pack signing) via an internal channel
   gated by role + MFA, never via client API.
4. **Sign-in** via Supabase Auth; sessions short-lived with refresh.

## Research Tooling

- Credential gate: `primaed_session.ps1` resolves user/password from env or the
  gitignored creds file — no credentials in any committed script, log, or
  report.
- Downloaded sensitive credentials never appear in outputs or commits
  (checked on every pipeline run).

## HSDL (Hardened Software Development Lifecycle) Alignment

Pre-commit credential scan on the repo (any change that adds a secret fails)
— to be automated as a Phase 1 CI gate (git hook + CI check).

## Status

- Secrets policy + credential refactor: **Implemented** (verified — repo has
  zero committed credentials).
- Backend RLS, Edge-Function service channel, content signing: **Planned**
  (Supabase project does not exist yet).

## Assumptions

- The app targets real exam users (attestation: attempts are personal data;
  we hold the minimum, sync with consent, and support deletion).
- Threat model: opportunistic credential leakage and casual backend
  misuse — not nation-state adversaries.

## Future

- Audit log of admin actions.
- Privacy: data export + right-to-be-forgotten (matching
  `DATABASE.md` future list).
- PII scrubbing in analytics exports.