-- First-party analytics, kept on this server.
--
-- The deliberate omissions are the design. No IP address is stored, no user
-- agent string, no cookie and no visitor identifier of any kind — which means
-- there is nothing here that identifies a person, and therefore no consent
-- banner to show and nothing to leak. The cost is stated plainly in the admin:
-- this counts views, not visitors, because without an identifier the two
-- cannot be told apart.
--
-- What is kept is the page, the language, the referring site's HOST (never the
-- full URL, which can carry search terms and tokens), and a device class
-- derived from the user agent before that string is discarded.

CREATE TYPE "SiteEventKind" AS ENUM ('VIEW', 'DOWNLOAD');

CREATE TABLE "site_event" (
  "id"           TEXT NOT NULL,
  "kind"         "SiteEventKind" NOT NULL,
  -- A page path for a view, a stored media path for a download.
  "path"         TEXT NOT NULL,
  "locale"       VARCHAR(5),
  -- Host only: "google.com", never the full referring URL.
  "referrerHost" TEXT,
  -- 'mobile' | 'tablet' | 'desktop'. Derived, then the user agent is dropped.
  "device"       TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "site_event_pkey" PRIMARY KEY ("id")
);

-- Every admin query is "this kind, over this date range", and the retention
-- job is "everything older than this date".
CREATE INDEX "site_event_kind_createdAt_idx" ON "site_event"("kind", "createdAt");
CREATE INDEX "site_event_createdAt_idx" ON "site_event"("createdAt");

-- The archive. Raw rows are trimmed after the retention window; these day
-- totals are written before that happens and kept, so a year-on-year
-- comparison survives a policy that deliberately forgets the detail.
CREATE TABLE "analytics_daily" (
  "id"     TEXT NOT NULL,
  "day"    DATE NOT NULL,
  -- 'view' | 'download' | 'referrer' | 'locale' | 'device' | 'page'
  "metric" TEXT NOT NULL,
  -- The thing being counted within that metric, or '' for a plain total.
  "key"    TEXT NOT NULL,
  "count"  INTEGER NOT NULL,

  CONSTRAINT "analytics_daily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "analytics_daily_day_metric_key_key"
  ON "analytics_daily"("day", "metric", "key");
CREATE INDEX "analytics_daily_metric_day_idx" ON "analytics_daily"("metric", "day");

-- post.viewCount has been in the schema since the start, defaulted to 0, and
-- was never written or read. Article views now come from site_event like
-- every other page, which means the number has one home instead of two that
-- can disagree. Nothing is lost: every row holds 0.
ALTER TABLE "post" DROP COLUMN "viewCount";
