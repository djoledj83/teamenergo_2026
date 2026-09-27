-- Grants the application role what it needs to create the schema.
--
-- Run this ONCE as a superuser (usually "postgres"), against the database
-- itself — not against "postgres". Replace the role and database names if
-- yours differ. Quoting matters: an unquoted teamAdmin folds to teamadmin.
--
--   npx prisma db execute --url "postgresql://postgres:PASS@localhost:5432/teamenergo" --file scripts/sql/grant-privileges.sql
--
-- Making the role the database owner is the conventional setup and covers
-- everything below, but the explicit grants work too if you would rather not
-- transfer ownership.

ALTER DATABASE "teamenergo" OWNER TO "teamAdmin";

-- Equivalent minimum, if ownership must stay elsewhere:
--   GRANT CREATE ON DATABASE "teamenergo" TO "teamAdmin";
--   GRANT CREATE, USAGE ON SCHEMA public TO "teamAdmin";

-- Optional: lets `prisma migrate dev` build its shadow database later.
-- Not required if you use `npm run db:baseline` / `npm run db:deploy`.
--   ALTER ROLE "teamAdmin" CREATEDB;
