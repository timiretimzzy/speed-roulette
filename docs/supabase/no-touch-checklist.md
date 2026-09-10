# Supabase no-touch checklist

Baseline snapshot of the shared Supabase project, captured read-only before any
Zivvvo work. The project hosts another product ("EduStack") that must remain
untouched. Diff this file against a re-run of the same read-only steps at the
end of any Zivvvo backend work to prove zero drift.

## Project identity

- Project ref: `uvmgmbwnsdebtkwldfaa`
- Display name: `EduStack`
- Organization: `fripgcupqflslngjyjzi`
- Region: `eu-west-2`
- Status: `ACTIVE_HEALTHY` (at capture time)

Captured: 2026-09-09, via Supabase Management API (PAT) + postgREST OpenAPI,
both read-only. Access token is a personal access token, not committed anywhere.

## API keys present (names/types only — values live in the project only)

| id            | type        | notes                                            |
| ------------- | ----------- | ------------------------------------------------ |
| anon          | legacy      | deprecated legacy anon key                       |
| service_role  | legacy      | deprecated service key; admin-only, never client |
| `2e1a97c7…`   | publishable | client-side key (browser bundle)                 |
| `fdf4bb74…`   | secret      | server/admin only; `service_role` JWT template   |

Zivvvo policy: publishable key in the client bundle, secret key never committed
or shipped; legacy keys retired.

## Exposed postgREST endpoints (baseline: 41 paths)

Queried via `GET {project}.supabase.co/rest/v1/` with the service key and
`Accept: application/openapi+json`. All objects belong to the EduStack product
in the (default-exposed) `public` schema:

```
/
academic_years        announcements         assessment_results   assessments
attendance_records    audit_logs            classes              fee_invoices
grades_or_forms       modules               parent_profiles      parent_student_relationships
payments              permissions           platform_admins      role_permissions
roles                 staff_profiles        student_enrolments   student_links
students              subjects              teacher_assignments  tenant_branding
tenant_domains        tenant_invitations    tenant_memberships   tenant_modules
tenants               terms

rpc/generate_login_id          rpc/has_permission
rpc/has_tenant_membership      rpc/is_admin_like
rpc/is_assigned_to_class       rpc/is_assigned_to_class_subject
rpc/is_linked_parent           rpc/is_linked_student
rpc/is_platform_admin          rpc/rls_auto_enable
```

Nothing Zivvvo-shaped (`zivvvo`, `attempts`, `learners`, `sync_watermark`,
`content_pack`, `scores`) exists in the exposed surface.

## Zivvvo additive footprint (expected diff after migration)

- New schema `zivvvo` (tables `attempts`, `learners`, `sync_watermark`,
  `content_pack`; function `request_device_id`; RLS policies) — new objects only.
- `ALTER ROLE authenticator SET pgrst.db_schemas = 'public, zivvvo'` — additive:
  keeps `public`, appends `zivvvo`; does not remove or alter any EduStack object.
- No DDL/grants/policies on `public` or any pre-existing object.

## Verification log

- 2026-09-09 — OpenAPI inventory captured (41 paths, above).
- 2026-09-09 — Migration `001_init_zivvvo.sql` applied by the operator on the
  remote (tables confirmed; `select count(*)` on `zivvvo.attempts` → 0; the
  only rows will be from the app's own sync).
- 2026-09-09 — postgREST probes with the publishable key:
  `zivvvo/attempts`, `zivvvo/learners`, `zivvvo/content_pack`,
  `zivvvo/sync_watermark` → **PGRST125 "Invalid path"**: schema not exposed
  yet. Fix = add `zivvvo` under Dashboard → Project Settings → API → Exposed
  schemas (additive, keeps `public`). Re-probe after.
- 2026-09-09 01:05 — exposure not yet reflected after SQL `alter role
  authenticator set pgrst.db_schemas = 'public, storage, graphql_public,
  zivvvo'` + `pg_reload_conf()` + `NOTIFY pgrst, 'reload schema'`, and after
  the dashboard Save. Platform-managed config appears authoritative.
- 2026-09-09 01:08 — **external activity note:** the OpenAPI inventory grew
  from 41 → 50 paths with 9 new *EduStack* tables (`fee_categories`,
  `fee_structures`, `grading_scale_levels`, `grading_scales`,
  `notifications`, `report_card_lines`, `report_cards`,
  `timetable_periods`, `timetable_slots`) that are **not ours** — likely the
  EduStack owner/CI deployed new objects during our window. Confirms the
  checklist must diff path-by-path, not by count.

## Steps to re-verify (read-only)

1. `supabase projects list` → expect exactly one project, ref above.
2. OpenAPI inventory (script in prior recon) → expect the EduStack surface
   listed here plus any *new external* EduStack objects; `zivvvo` must appear
   only after the platform exposure lands (`zivvvo/attempts`,
   `zivvvo/learners`, `zivvvo/sync_watermark`, `zivvvo/content_pack`).
3. `select count(*)` on `zivvvo.attempts` via publishable key RLS → the
   device's own synced rows only.
4. On unblock (ADR-022): rerun (2) — confirm EduStack paths unchanged relative
   to this file and `zivvvo` added; then one idempotent app sync + probe.