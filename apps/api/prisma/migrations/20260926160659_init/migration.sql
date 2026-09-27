-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('OWNER', 'EDITOR');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('NEW', 'READ', 'REPLIED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "locale" (
    "code" VARCHAR(5) NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "locale_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "admin_user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'EDITOR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_token" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "diff" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "media" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "path" TEXT NOT NULL,
    "variants" JSONB,
    "folder" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_translation" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "locale" VARCHAR(5) NOT NULL,
    "alt" TEXT,
    "caption" TEXT,

    CONSTRAINT "media_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service" (
    "id" TEXT NOT NULL,
    "iconName" TEXT,
    "accent" TEXT,
    "imageId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_translation" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "locale" VARCHAR(5) NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "summary" TEXT,
    "body" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,

    CONSTRAINT "service_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_stat" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "service_stat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_stat_translation" (
    "id" TEXT NOT NULL,
    "serviceStatId" TEXT NOT NULL,
    "locale" VARCHAR(5) NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "service_stat_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT,
    "coverImageId" TEXT,
    "accent" TEXT,
    "year" INTEGER,
    "completedAt" TIMESTAMP(3),
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_translation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "locale" VARCHAR(5) NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT,
    "tag" TEXT,
    "summary" TEXT,
    "body" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,

    CONSTRAINT "project_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_metric" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "project_metric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_metric_translation" (
    "id" TEXT NOT NULL,
    "projectMetricId" TEXT NOT NULL,
    "locale" VARCHAR(5) NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "project_metric_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_image" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "project_image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_member" (
    "id" TEXT NOT NULL,
    "photoId" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "linkedinUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_member_translation" (
    "id" TEXT NOT NULL,
    "teamMemberId" TEXT NOT NULL,
    "locale" VARCHAR(5) NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "bio" TEXT,

    CONSTRAINT "team_member_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post" (
    "id" TEXT NOT NULL,
    "coverImageId" TEXT,
    "authorId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_translation" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "locale" VARCHAR(5) NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "body" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,

    CONSTRAINT "post_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_category" (
    "id" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "post_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_category_translation" (
    "id" TEXT NOT NULL,
    "postCategoryId" TEXT NOT NULL,
    "locale" VARCHAR(5) NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "post_category_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gallery_album" (
    "id" TEXT NOT NULL,
    "coverImageId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gallery_album_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gallery_album_translation" (
    "id" TEXT NOT NULL,
    "galleryAlbumId" TEXT NOT NULL,
    "locale" VARCHAR(5) NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "gallery_album_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gallery_item" (
    "id" TEXT NOT NULL,
    "galleryAlbumId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "gallery_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gallery_item_translation" (
    "id" TEXT NOT NULL,
    "galleryItemId" TEXT NOT NULL,
    "locale" VARCHAR(5) NOT NULL,
    "caption" TEXT,

    CONSTRAINT "gallery_item_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testimonial" (
    "id" TEXT NOT NULL,
    "avatarId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "testimonial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testimonial_translation" (
    "id" TEXT NOT NULL,
    "testimonialId" TEXT NOT NULL,
    "locale" VARCHAR(5) NOT NULL,
    "quote" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "company" TEXT,

    CONSTRAINT "testimonial_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoId" TEXT,
    "websiteUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stat" (
    "id" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "prefix" TEXT,
    "suffix" TEXT,
    "isDecimal" BOOLEAN NOT NULL DEFAULT false,
    "iconName" TEXT,
    "accent" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stat_translation" (
    "id" TEXT NOT NULL,
    "statId" TEXT NOT NULL,
    "locale" VARCHAR(5) NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "stat_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page" (
    "key" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "page_translation" (
    "id" TEXT NOT NULL,
    "pageKey" TEXT NOT NULL,
    "locale" VARCHAR(5) NOT NULL,
    "title" TEXT NOT NULL,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "ogImageId" TEXT,

    CONSTRAINT "page_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_block" (
    "id" TEXT NOT NULL,
    "pageKey" TEXT NOT NULL,
    "blockKey" TEXT NOT NULL,
    "imageId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_block_translation" (
    "id" TEXT NOT NULL,
    "pageBlockId" TEXT NOT NULL,
    "locale" VARCHAR(5) NOT NULL,
    "eyebrow" TEXT,
    "heading" TEXT,
    "subheading" TEXT,
    "body" TEXT,
    "ctaLabel" TEXT,
    "ctaHref" TEXT,

    CONSTRAINT "page_block_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nav_item" (
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "location" TEXT NOT NULL DEFAULT 'header',
    "href" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "opensInNew" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nav_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nav_item_translation" (
    "id" TEXT NOT NULL,
    "navItemId" TEXT NOT NULL,
    "locale" VARCHAR(5) NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "nav_item_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "serviceId" TEXT,
    "message" TEXT NOT NULL,
    "locale" VARCHAR(5) NOT NULL,
    "status" "InquiryStatus" NOT NULL DEFAULT 'NEW',
    "ip" TEXT,
    "userAgent" TEXT,
    "notes" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PostToCategory" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PostToCategory_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_user_email_key" ON "admin_user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_token_tokenHash_key" ON "refresh_token"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_token_adminUserId_idx" ON "refresh_token"("adminUserId");

-- CreateIndex
CREATE INDEX "refresh_token_familyId_idx" ON "refresh_token"("familyId");

-- CreateIndex
CREATE INDEX "refresh_token_expiresAt_idx" ON "refresh_token"("expiresAt");

-- CreateIndex
CREATE INDEX "audit_log_entity_entityId_idx" ON "audit_log"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_log_createdAt_idx" ON "audit_log"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "media_filename_key" ON "media"("filename");

-- CreateIndex
CREATE INDEX "media_folder_idx" ON "media"("folder");

-- CreateIndex
CREATE INDEX "media_createdAt_idx" ON "media"("createdAt");

-- CreateIndex
CREATE INDEX "media_translation_locale_idx" ON "media_translation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "media_translation_mediaId_locale_key" ON "media_translation"("mediaId", "locale");

-- CreateIndex
CREATE INDEX "service_isPublished_sortOrder_idx" ON "service"("isPublished", "sortOrder");

-- CreateIndex
CREATE INDEX "service_translation_locale_idx" ON "service_translation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "service_translation_serviceId_locale_key" ON "service_translation"("serviceId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "service_translation_locale_slug_key" ON "service_translation"("locale", "slug");

-- CreateIndex
CREATE INDEX "service_stat_serviceId_sortOrder_idx" ON "service_stat"("serviceId", "sortOrder");

-- CreateIndex
CREATE INDEX "service_stat_translation_locale_idx" ON "service_stat_translation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "service_stat_translation_serviceStatId_locale_key" ON "service_stat_translation"("serviceStatId", "locale");

-- CreateIndex
CREATE INDEX "project_isPublished_sortOrder_idx" ON "project"("isPublished", "sortOrder");

-- CreateIndex
CREATE INDEX "project_serviceId_idx" ON "project"("serviceId");

-- CreateIndex
CREATE INDEX "project_translation_locale_idx" ON "project_translation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "project_translation_projectId_locale_key" ON "project_translation"("projectId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "project_translation_locale_slug_key" ON "project_translation"("locale", "slug");

-- CreateIndex
CREATE INDEX "project_metric_projectId_sortOrder_idx" ON "project_metric"("projectId", "sortOrder");

-- CreateIndex
CREATE INDEX "project_metric_translation_locale_idx" ON "project_metric_translation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "project_metric_translation_projectMetricId_locale_key" ON "project_metric_translation"("projectMetricId", "locale");

-- CreateIndex
CREATE INDEX "project_image_projectId_sortOrder_idx" ON "project_image"("projectId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "project_image_projectId_mediaId_key" ON "project_image"("projectId", "mediaId");

-- CreateIndex
CREATE INDEX "team_member_isPublished_sortOrder_idx" ON "team_member"("isPublished", "sortOrder");

-- CreateIndex
CREATE INDEX "team_member_translation_locale_idx" ON "team_member_translation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "team_member_translation_teamMemberId_locale_key" ON "team_member_translation"("teamMemberId", "locale");

-- CreateIndex
CREATE INDEX "post_isPublished_publishedAt_idx" ON "post"("isPublished", "publishedAt");

-- CreateIndex
CREATE INDEX "post_translation_locale_idx" ON "post_translation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "post_translation_postId_locale_key" ON "post_translation"("postId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "post_translation_locale_slug_key" ON "post_translation"("locale", "slug");

-- CreateIndex
CREATE INDEX "post_category_translation_locale_idx" ON "post_category_translation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "post_category_translation_postCategoryId_locale_key" ON "post_category_translation"("postCategoryId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "post_category_translation_locale_slug_key" ON "post_category_translation"("locale", "slug");

-- CreateIndex
CREATE INDEX "gallery_album_isPublished_sortOrder_idx" ON "gallery_album"("isPublished", "sortOrder");

-- CreateIndex
CREATE INDEX "gallery_album_translation_locale_idx" ON "gallery_album_translation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "gallery_album_translation_galleryAlbumId_locale_key" ON "gallery_album_translation"("galleryAlbumId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "gallery_album_translation_locale_slug_key" ON "gallery_album_translation"("locale", "slug");

-- CreateIndex
CREATE INDEX "gallery_item_galleryAlbumId_sortOrder_idx" ON "gallery_item"("galleryAlbumId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "gallery_item_galleryAlbumId_mediaId_key" ON "gallery_item"("galleryAlbumId", "mediaId");

-- CreateIndex
CREATE INDEX "gallery_item_translation_locale_idx" ON "gallery_item_translation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "gallery_item_translation_galleryItemId_locale_key" ON "gallery_item_translation"("galleryItemId", "locale");

-- CreateIndex
CREATE INDEX "testimonial_isPublished_sortOrder_idx" ON "testimonial"("isPublished", "sortOrder");

-- CreateIndex
CREATE INDEX "testimonial_translation_locale_idx" ON "testimonial_translation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "testimonial_translation_testimonialId_locale_key" ON "testimonial_translation"("testimonialId", "locale");

-- CreateIndex
CREATE INDEX "client_isPublished_sortOrder_idx" ON "client"("isPublished", "sortOrder");

-- CreateIndex
CREATE INDEX "stat_isPublished_sortOrder_idx" ON "stat"("isPublished", "sortOrder");

-- CreateIndex
CREATE INDEX "stat_translation_locale_idx" ON "stat_translation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "stat_translation_statId_locale_key" ON "stat_translation"("statId", "locale");

-- CreateIndex
CREATE INDEX "page_translation_locale_idx" ON "page_translation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "page_translation_pageKey_locale_key" ON "page_translation"("pageKey", "locale");

-- CreateIndex
CREATE INDEX "page_block_pageKey_sortOrder_idx" ON "page_block"("pageKey", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "page_block_pageKey_blockKey_key" ON "page_block"("pageKey", "blockKey");

-- CreateIndex
CREATE INDEX "page_block_translation_locale_idx" ON "page_block_translation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "page_block_translation_pageBlockId_locale_key" ON "page_block_translation"("pageBlockId", "locale");

-- CreateIndex
CREATE INDEX "nav_item_location_sortOrder_idx" ON "nav_item"("location", "sortOrder");

-- CreateIndex
CREATE INDEX "nav_item_translation_locale_idx" ON "nav_item_translation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "nav_item_translation_navItemId_locale_key" ON "nav_item_translation"("navItemId", "locale");

-- CreateIndex
CREATE INDEX "inquiry_status_createdAt_idx" ON "inquiry"("status", "createdAt");

-- CreateIndex
CREATE INDEX "inquiry_email_idx" ON "inquiry"("email");

-- CreateIndex
CREATE INDEX "_PostToCategory_B_index" ON "_PostToCategory"("B");

-- AddForeignKey
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "admin_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "admin_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "admin_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_translation" ADD CONSTRAINT "media_translation_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service" ADD CONSTRAINT "service_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_translation" ADD CONSTRAINT "service_translation_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_stat" ADD CONSTRAINT "service_stat_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_stat_translation" ADD CONSTRAINT "service_stat_translation_serviceStatId_fkey" FOREIGN KEY ("serviceStatId") REFERENCES "service_stat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_coverImageId_fkey" FOREIGN KEY ("coverImageId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_translation" ADD CONSTRAINT "project_translation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_metric" ADD CONSTRAINT "project_metric_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_metric_translation" ADD CONSTRAINT "project_metric_translation_projectMetricId_fkey" FOREIGN KEY ("projectMetricId") REFERENCES "project_metric"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_image" ADD CONSTRAINT "project_image_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_image" ADD CONSTRAINT "project_image_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member_translation" ADD CONSTRAINT "team_member_translation_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "team_member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post" ADD CONSTRAINT "post_coverImageId_fkey" FOREIGN KEY ("coverImageId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post" ADD CONSTRAINT "post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "admin_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_translation" ADD CONSTRAINT "post_translation_postId_fkey" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_category_translation" ADD CONSTRAINT "post_category_translation_postCategoryId_fkey" FOREIGN KEY ("postCategoryId") REFERENCES "post_category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_album" ADD CONSTRAINT "gallery_album_coverImageId_fkey" FOREIGN KEY ("coverImageId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_album_translation" ADD CONSTRAINT "gallery_album_translation_galleryAlbumId_fkey" FOREIGN KEY ("galleryAlbumId") REFERENCES "gallery_album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_item" ADD CONSTRAINT "gallery_item_galleryAlbumId_fkey" FOREIGN KEY ("galleryAlbumId") REFERENCES "gallery_album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_item" ADD CONSTRAINT "gallery_item_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_item_translation" ADD CONSTRAINT "gallery_item_translation_galleryItemId_fkey" FOREIGN KEY ("galleryItemId") REFERENCES "gallery_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonial" ADD CONSTRAINT "testimonial_avatarId_fkey" FOREIGN KEY ("avatarId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonial_translation" ADD CONSTRAINT "testimonial_translation_testimonialId_fkey" FOREIGN KEY ("testimonialId") REFERENCES "testimonial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client" ADD CONSTRAINT "client_logoId_fkey" FOREIGN KEY ("logoId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stat_translation" ADD CONSTRAINT "stat_translation_statId_fkey" FOREIGN KEY ("statId") REFERENCES "stat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_translation" ADD CONSTRAINT "page_translation_pageKey_fkey" FOREIGN KEY ("pageKey") REFERENCES "page"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_translation" ADD CONSTRAINT "page_translation_ogImageId_fkey" FOREIGN KEY ("ogImageId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_block" ADD CONSTRAINT "page_block_pageKey_fkey" FOREIGN KEY ("pageKey") REFERENCES "page"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_block" ADD CONSTRAINT "page_block_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_block_translation" ADD CONSTRAINT "page_block_translation_pageBlockId_fkey" FOREIGN KEY ("pageBlockId") REFERENCES "page_block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nav_item" ADD CONSTRAINT "nav_item_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "nav_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nav_item_translation" ADD CONSTRAINT "nav_item_translation_navItemId_fkey" FOREIGN KEY ("navItemId") REFERENCES "nav_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry" ADD CONSTRAINT "inquiry_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PostToCategory" ADD CONSTRAINT "_PostToCategory_A_fkey" FOREIGN KEY ("A") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PostToCategory" ADD CONSTRAINT "_PostToCategory_B_fkey" FOREIGN KEY ("B") REFERENCES "post_category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

