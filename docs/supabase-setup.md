# Optional Supabase design — UNEXECUTED / NOT VERIFIED LIVE

This is a documentation deliverable only. The implemented Margin app remains an offline React workspace using localStorage and JSON backups. It has no Supabase SDK, authentication flow, API calls, backend environment variables or runtime connection to these files. Neither npm scripts nor CI execute the SQL. No database, account, keys, services or cloud resources were created or accessed.

## Files and ownership model

- [Schema proposal](supabase-schema.sql): three new tables, indexes, explicit grants, forced RLS and twelve operation-specific policies. It is intentionally a one-time transaction, not an idempotent migration or an automatic repair of existing tables.
- [Policy test examples](supabase-policy-examples.sql): **UNEXECUTED** pgTAP assertions with fictional identities, transaction-local role/claim changes and a final rollback. These are proposed checks, not verified security results.

Every row has `owner_id uuid references auth.users(id)`. Each task and note is identified by `(owner_id, id)`, retaining the app's text IDs. Links use the same owner in both composite foreign keys: `(owner_id, task_id)` and `(owner_id, note_id)`. A user-owned link to another tenant's task or note therefore fails a database constraint, even if the user supplies that record's ID. Deleting an item cascades its links. Tags remain arrays on their owner's items; there is no unprotected tag table.

All three tables permit only authenticated CRUD, subject to ownership. Grants to `PUBLIC` and `anon` are revoked; client TRUNCATE is not granted. The policies compare `(select auth.uid()) = owner_id`. A missing UID fails closed. PostgreSQL permits `USING` on SELECT/DELETE, `WITH CHECK` on INSERT, and both on UPDATE; both UPDATE clauses are present on every table to prevent ownership transfer. RLS is enabled and forced. Administrators and roles with `BYPASSRLS` remain privileged; client-policy tests must run as the actual client role, not the SQL administrator.

## Future setup procedure (instructions only; not performed)

1. Keep the default app unchanged. Export any local work before experimenting. Obtain separate authorization for a disposable Supabase-compatible development environment; this repair does not authorize provisioning or starting one.
2. Have a database maintainer review the schema against that environment's PostgreSQL version, `auth.users`, `auth.uid()`, `anon` and `authenticated` roles. Use a fresh, isolated database: the proposal deliberately fails if its tables already exist. Check any existing default grants, inherited privileges and additional policies before adapting it. Additional permissive policies could widen access.
3. In that authorized disposable environment only, apply the reviewed schema as a single migration transaction through its normal SQL migration workflow. Do not apply it to a live database or an existing unrelated schema. No CLI, SDK, key or database is required to review these text files.
4. Make pgTAP available in the disposable environment's `extensions` schema using that environment's supported test workflow. Review the examples first: their bootstrap SQL inserts two fictional `auth.users` rows inside the rollback transaction; it does not create usable logins. Do not substitute real user data. Adapt fixture requirements if the installed auth schema differs.
5. Run the policy examples through a SQL/pgTAP test runner authorized for that disposable database. For an already configured local Supabase test project, the maintainer may place the reviewed example under its `supabase/tests/` directory and use `supabase test db`. **This command has not been run here.** Read TAP failures and require every allow/deny assertion to pass before considering the design verified.
6. Extend tests for the deployed API's authenticated requests, missing/expired credentials, concurrent writes, migrations and rollback. No client privileged keys should be introduced. A separate future implementation and review would be needed before wiring any browser to this schema.

The examples check own-tenant CRUD on tasks, notes and links, hidden cross-tenant SELECT/UPDATE/DELETE, spoofed INSERT owners, rejected UPDATE owner transfers, rejected cross-owner/dangling links, cascade cleanup, null UID behavior and all four anonymous operations. Actual row/value assertions verify successful writes; explicit `ROW_COUNT = 0` assertions verify cross-tenant update/delete denials. pgTAP's cursor-based `results_eq` is used only for SELECT queries. Each expected error runs inside pgTAP's exception handling, so intentional failures do not abort the outer transaction.

## Mapping and limits

This schema is not a drop-in JSON import endpoint. A future adapter must validate version 1 JSON first, derive the owner from the authenticated context, map `updatedAt` to `updated_at`, preserve `due` as a PostgreSQL `date`, and expand `noteIds` to link rows. Restore note/task/link state in a single database transaction, with explicit destructive confirmation and concurrency handling. No such adapter, sync engine or replacement API is implemented.

The proposal has basic field, status, priority and date checks. The existing app's byte budget, workspace item/tag/link counts, tag normalization/uniqueness, cross-kind ID uniqueness and precise UTF-16 length semantics are **not all enforced by this SQL**. PostgreSQL character counts differ from JavaScript UTF-16 code-unit counts. A future server must enforce the complete import contract and authenticated quotas rather than trusting browser validation. Timestamps are stored, not automatically maintained by a trigger. This design does not claim feature parity or production readiness.

## Official references consulted

No Supabase-specific API/docs skill is installed in this session; the current official references below were read directly on 16 October 2026. No third-party schema or private project was reused.

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): client grants, ownership predicates and the operation-specific policy forms.
- [Supabase tables](https://supabase.com/docs/guides/database/tables): keys and relationships.
- [Supabase pgTAP testing](https://supabase.com/docs/guides/local-development/testing/pgtap-extended): database test workflows and role-based assertions.
- [PostgreSQL CREATE POLICY](https://www.postgresql.org/docs/current/sql-createpolicy.html): `USING` and `WITH CHECK` semantics.
- [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html): composite foreign keys and cascading deletes.
- [pgTAP reference](https://pgtap.org/documentation.html): assertion and cursor-query behavior.

**SQL execution, policy behavior and live Supabase integration remain UNEXECUTED / NOT VERIFIED LIVE.** Passing the app's TypeScript and browser checks does not verify these SQL files.
