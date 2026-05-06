-- CreateEnum
CREATE TYPE "FDERole" AS ENUM ('ADMIN', 'FDE');

-- CreateEnum
CREATE TYPE "PageVersionStatus" AS ENUM ('DRAFT', 'STAGED', 'PUBLISHED', 'ARCHIVED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "Environment" AS ENUM ('STAGING', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "BuildStatus" AS ENUM ('PENDING', 'BUILDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "AppRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "ComponentType" AS ENUM ('PRIMITIVE', 'CUSTOM_WIDGET', 'PREBUILT_VIEW');

-- CreateEnum
CREATE TYPE "RegistryScope" AS ENUM ('COMMON', 'TENANT_LOCAL');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('ACTIVE', 'DEPRECATED', 'PENDING_REVIEW', 'REJECTED');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('INTERNAL', 'EXTERNAL_PLATFORM', 'COMPOSED');

-- CreateEnum
CREATE TYPE "ConnectorAuthType" AS ENUM ('BEARER', 'API_KEY', 'OAUTH2', 'NONE');

-- CreateEnum
CREATE TYPE "HttpMethod" AS ENUM ('GET', 'POST', 'PUT', 'PATCH', 'DELETE');

-- CreateEnum
CREATE TYPE "DataSourceMode" AS ENUM ('REGISTERED', 'CUSTOM_CONNECTOR', 'CUSTOM_MANUAL');

-- CreateEnum
CREATE TYPE "IdPType" AS ENUM ('GOOGLE', 'OKTA', 'SAML', 'OIDC', 'AUTH0', 'MAGIC_LINK', 'USERNAME_PASSWORD');

-- CreateEnum
CREATE TYPE "TokenContext" AS ENUM ('BUILDER', 'PORTAL');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('SUCCESS', 'ERROR');

-- CreateTable
CREATE TABLE "FDEUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "FDERole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FDEUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "App" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "App_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSource" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageVersion" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "schema" JSONB NOT NULL,
    "status" "PageVersionStatus" NOT NULL,
    "changelog" TEXT,
    "diffFromPrev" JSONB,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "promotedAt" TIMESTAMP(3),
    "promotedBy" TEXT,

    CONSTRAINT "PageVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deployment" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "environment" "Environment" NOT NULL,
    "buildStatus" "BuildStatus" NOT NULL,
    "deployedBy" TEXT NOT NULL,
    "deployedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeploymentPage" (
    "deploymentId" TEXT NOT NULL,
    "pageVersionId" TEXT NOT NULL,

    CONSTRAINT "DeploymentPage_pkey" PRIMARY KEY ("deploymentId","pageVersionId")
);

-- CreateTable
CREATE TABLE "AppMember" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AppRole" NOT NULL,
    "addedBy" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppUserGroup" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppUserGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppUserGroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "addedBy" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppUserGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistryEntry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ComponentType" NOT NULL,
    "scope" "RegistryScope" NOT NULL,
    "status" "EntryStatus" NOT NULL,
    "currentVersion" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "sourceRef" TEXT,
    "ownedBy" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistryEntryVersion" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "propsSchema" JSONB NOT NULL,
    "defaultProps" JSONB NOT NULL,
    "bundleUrl" TEXT,
    "bundleHash" TEXT,
    "viewSchema" JSONB,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "icon" TEXT,
    "thumbnail" TEXT,
    "tags" TEXT[],
    "changelog" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedBy" TEXT NOT NULL,

    CONSTRAINT "RegistryEntryVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Connector" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "baseUrl" JSONB NOT NULL,
    "authType" "ConnectorAuthType" NOT NULL,
    "authConfig" TEXT NOT NULL,
    "headers" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Connector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EndpointDef" (
    "id" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "method" "HttpMethod" NOT NULL,
    "path" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tags" TEXT[],
    "pathParams" JSONB NOT NULL,
    "queryParams" JSONB NOT NULL,
    "bodySchema" JSONB,
    "headers" JSONB NOT NULL,
    "responseSchema" JSONB NOT NULL,
    "responseSample" JSONB,
    "bindingPaths" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EndpointDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectorRateLimit" (
    "id" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "requestsPerMin" INTEGER NOT NULL DEFAULT 60,
    "requestsPerHour" INTEGER NOT NULL DEFAULT 1000,
    "requestsPerDay" INTEGER NOT NULL DEFAULT 10000,
    "burstLimit" INTEGER NOT NULL DEFAULT 10,
    "maxConcurrent" INTEGER NOT NULL DEFAULT 5,
    "maxResponseSizeKb" INTEGER NOT NULL DEFAULT 5120,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectorRateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EndpointCacheConfig" (
    "id" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "ttlSeconds" INTEGER NOT NULL,
    "varyBy" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EndpointCacheConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomEndpointUsage" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "mode" "DataSourceMode" NOT NULL,
    "url" TEXT NOT NULL,
    "method" "HttpMethod" NOT NULL,
    "usedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomEndpointUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectorRequestLog" (
    "id" TEXT NOT NULL,
    "correlationId" TEXT,
    "appId" TEXT NOT NULL,
    "pageId" TEXT,
    "datasourceAlias" TEXT,
    "actionId" TEXT,
    "userId" TEXT NOT NULL,
    "mode" "DataSourceMode" NOT NULL,
    "connectorId" TEXT,
    "endpointId" TEXT,
    "method" "HttpMethod" NOT NULL,
    "urlPattern" TEXT NOT NULL,
    "statusCode" INTEGER,
    "durationMs" INTEGER NOT NULL,
    "cacheHit" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectorRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderIdentityProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "IdPType" NOT NULL,
    "label" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuilderIdentityProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppIdentityProvider" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "environment" "Environment" NOT NULL,
    "type" "IdPType" NOT NULL,
    "label" TEXT NOT NULL,
    "configSecretRef" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "AppIdentityProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "tokenFamily" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "appId" TEXT,
    "context" "TokenContext" NOT NULL,
    "environment" "Environment",
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthState" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "idpId" TEXT NOT NULL,
    "context" "TokenContext" NOT NULL,
    "appId" TEXT,
    "environment" "Environment",
    "redirectTo" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SAMLState" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "idpId" TEXT NOT NULL,
    "context" "TokenContext" NOT NULL,
    "appId" TEXT,
    "environment" "Environment",
    "redirectTo" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SAMLState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionExecutionLog" (
    "id" TEXT NOT NULL,
    "correlationId" TEXT,
    "appId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "actionName" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "status" "ActionStatus" NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "error" TEXT,
    "metadata" JSONB,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NodeComment" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "pageVersionId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NodeComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NodeCommentReply" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NodeCommentReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "userId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FDEUser_email_key" ON "FDEUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "App_slug_key" ON "App"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Page_appId_slug_key" ON "Page"("appId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "DataSource_appId_alias_key" ON "DataSource"("appId", "alias");

-- CreateIndex
CREATE INDEX "PageVersion_pageId_status_idx" ON "PageVersion"("pageId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PageVersion_pageId_version_key" ON "PageVersion"("pageId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "AppMember_appId_userId_key" ON "AppMember"("appId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "AppUserGroup_appId_name_key" ON "AppUserGroup"("appId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "AppUserGroupMember_groupId_identifier_key" ON "AppUserGroupMember"("groupId", "identifier");

-- CreateIndex
CREATE INDEX "RegistryEntry_type_scope_status_idx" ON "RegistryEntry"("type", "scope", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RegistryEntry_name_scope_key" ON "RegistryEntry"("name", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "RegistryEntryVersion_entryId_version_key" ON "RegistryEntryVersion"("entryId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "EndpointDef_connectorId_method_path_key" ON "EndpointDef"("connectorId", "method", "path");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectorRateLimit_connectorId_key" ON "ConnectorRateLimit"("connectorId");

-- CreateIndex
CREATE UNIQUE INDEX "EndpointCacheConfig_endpointId_key" ON "EndpointCacheConfig"("endpointId");

-- CreateIndex
CREATE INDEX "CustomEndpointUsage_mode_createdAt_idx" ON "CustomEndpointUsage"("mode", "createdAt");

-- CreateIndex
CREATE INDEX "ConnectorRequestLog_appId_createdAt_idx" ON "ConnectorRequestLog"("appId", "createdAt");

-- CreateIndex
CREATE INDEX "ConnectorRequestLog_correlationId_idx" ON "ConnectorRequestLog"("correlationId");

-- CreateIndex
CREATE INDEX "ConnectorRequestLog_connectorId_createdAt_idx" ON "ConnectorRequestLog"("connectorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AppIdentityProvider_appId_environment_type_key" ON "AppIdentityProvider"("appId", "environment", "type");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_tokenFamily_idx" ON "RefreshToken"("tokenFamily");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_context_idx" ON "RefreshToken"("userId", "context");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthState_state_key" ON "OAuthState"("state");

-- CreateIndex
CREATE UNIQUE INDEX "SAMLState_requestId_key" ON "SAMLState"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_key_key" ON "Asset"("key");

-- CreateIndex
CREATE INDEX "Asset_appId_idx" ON "Asset"("appId");

-- CreateIndex
CREATE INDEX "Asset_hash_idx" ON "Asset"("hash");

-- CreateIndex
CREATE INDEX "ActionExecutionLog_appId_executedAt_idx" ON "ActionExecutionLog"("appId", "executedAt");

-- CreateIndex
CREATE INDEX "ActionExecutionLog_correlationId_idx" ON "ActionExecutionLog"("correlationId");

-- CreateIndex
CREATE INDEX "ActionExecutionLog_pageId_executedAt_idx" ON "ActionExecutionLog"("pageId", "executedAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_pageId_createdAt_idx" ON "AnalyticsEvent"("pageId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_appId_createdAt_idx" ON "AnalyticsEvent"("appId", "createdAt");

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataSource" ADD CONSTRAINT "DataSource_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageVersion" ADD CONSTRAINT "PageVersion_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentPage" ADD CONSTRAINT "DeploymentPage_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentPage" ADD CONSTRAINT "DeploymentPage_pageVersionId_fkey" FOREIGN KEY ("pageVersionId") REFERENCES "PageVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppMember" ADD CONSTRAINT "AppMember_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppUserGroup" ADD CONSTRAINT "AppUserGroup_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppUserGroupMember" ADD CONSTRAINT "AppUserGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "AppUserGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistryEntryVersion" ADD CONSTRAINT "RegistryEntryVersion_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "RegistryEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EndpointDef" ADD CONSTRAINT "EndpointDef_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "Connector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorRateLimit" ADD CONSTRAINT "ConnectorRateLimit_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "Connector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EndpointCacheConfig" ADD CONSTRAINT "EndpointCacheConfig_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "EndpointDef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppIdentityProvider" ADD CONSTRAINT "AppIdentityProvider_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeComment" ADD CONSTRAINT "NodeComment_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeCommentReply" ADD CONSTRAINT "NodeCommentReply_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "NodeComment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
