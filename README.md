# Teamenergo

Company website with an admin CMS at `/admin`.

- **Frontend** — Next.js 15 (App Router, TypeScript), serves the public site and the admin UI
- **Backend** — Node + Express + Prisma, owns the database and authentication
- **Database** — PostgreSQL
- **Languages** — Serbian (default) and English

The API is never exposed to the internet. The browser talks only to Next.js,
which forwards admin requests to the API over the internal Docker network.

## Layout

```
apps/web          Next.js — public site + /admin
apps/api          Express + Prisma — REST API
packages/shared   Zod schemas and types shared by both
docker/           Dockerfiles
```

## Local development

```bash
cp .env.example .env     # then fill in the secrets
npm install
npm run db:baseline      # first time only — creates and applies the schema
npm run db:seed
npm run dev              # shared (watch) + api + web together
```

`db:baseline` exists because `prisma migrate dev` needs the CREATEDB
privilege to build its shadow database, which an application role often
should not have. It produces an identical, committed migration without one.
After the first run, later schema changes use:

```bash
npx prisma migrate dev --name <change> --schema apps/api/prisma/schema.prisma
```

which does need CREATEDB — grant it with `ALTER ROLE "<user>" CREATEDB;`, or
keep using `db:baseline`'s approach on the server via `npm run db:deploy`.

PostgreSQL is **not** part of this stack. It runs on the machine — yours, and
the server's — and on a server it is usually shared with other things. Nothing
here starts, configures or restarts it. Point `DATABASE_URL` at it and that is
the whole of the arrangement.

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## Deployment

Two containers, `api` and `web`. Only `web` is published, and only on
`127.0.0.1` — nginx on the host is what faces the internet.

```bash
mkdir -p uploads && sudo chown -R 1001:1001 uploads   # the container runs as uid 1001
docker compose up -d --build
docker compose ps        # api must reach "healthy", not just "up"
docker compose logs -f api
```

Migrations and the seed run inside the API container on boot, both idempotent,
so a deploy needs no manual database step and the container is not marked
healthy until it can actually query the database.

### Reaching the host's PostgreSQL

Inside a container `localhost` is the container. The host is reached as
`host.docker.internal`, which `docker-compose.yml` wires up with
`extra_hosts: host-gateway`. So `DATABASE_URL` differs between machines:

```env
# laptop
DATABASE_URL=postgresql://teamAdmin:...@localhost:5432/teamenergo?connection_limit=20
# server
DATABASE_URL=postgresql://teamAdmin:...@host.docker.internal:5433/teamenergo?connection_limit=20
```

The database role needs `CONNECT` on the database and ownership of the public
schema. It does **not** need `CREATEDB` on the server: the container runs
`prisma migrate deploy`, which applies existing migrations and creates nothing.

If PostgreSQL already accepts connections from other containers on that host,
it is configured correctly and needs no change. If not, it needs to listen on
an address containers can reach and to allow Docker's private range in
`pg_hba.conf` — on a shared server, add to those files rather than replacing
them, since other services depend on what is there.

### nginx

```nginx
server {
    server_name teamenergo.rs www.teamenergo.rs;

    # nginx defaults to 1 MB; the app accepts documents up to 10 MB. Without
    # this, uploads over 1 MB fail with a 413 and the admin panel reports
    # nothing useful.
    client_max_body_size 12m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        # Session cookies are Secure in production. Without this the app
        # believes it is on http and nobody can stay signed in to /admin.
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        "upgrade";
    }
}
```

Then `sudo certbot --nginx -d teamenergo.rs -d www.teamenergo.rs`.

Uploaded media lives in `./uploads`, bind-mounted into the API container, so it
survives rebuilds. Back it up alongside a `pg_dump` of the database.

Note that `.env.example` is deliberately not in the repository (see
`.gitignore`), so a fresh clone has no template — copy yours to the server:

```bash
scp .env.example user@server:~/teamenergo_2026/
```

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Web and API in watch mode |
| `npm run build` | Builds shared, api, then web |
| `npm run type-check` | TypeScript across all workspaces |
| `npm run lint` | ESLint across all workspaces |
| `npm run test` | Vitest across all workspaces |
| `npm run db:baseline` | First-time schema setup, no CREATEDB needed |
| `npm run db:migrate` | Create and apply a migration (needs CREATEDB) |
| `npm run db:deploy` | Apply pending migrations (production) |
| `npm run db:seed` | Seed locales and the first admin user |
| `npm run db:studio` | Prisma Studio |
