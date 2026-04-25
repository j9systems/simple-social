# Simple Social

## Conventions
- snake_case for all Supabase columns and tables
- UUID primary keys with default gen_random_uuid()
- Reference /support folder for additional context, specs, and reference docs

## Database guardrails
- Supabase MCP has full write access.
- Before any destructive SQL (ALTER, DROP, DELETE, TRUNCATE), show me the exact statement and wait for explicit approval.
- Read-only queries can run without asking.

## Workflow
- Pull latest before starting: git pull
- Commit after each logical unit of work with a clear message
- Push when feature is complete
