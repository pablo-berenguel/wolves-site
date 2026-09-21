import type { CmsBlock, CmsPage as CmsRenderablePage, CmsPageSeo } from '../cms/types'

export * from '../cms/types'

export type CmsJsonPrimitive = boolean | number | string | null

export type CmsJsonValue = CmsJsonPrimitive | CmsJsonObject | CmsJsonValue[]

export interface CmsJsonObject {
  [key: string]: CmsJsonValue
}

export type CmsPageRecordStatus = 'draft' | 'published' | 'archived'

/** A complete page snapshot materialized from one immutable revision. */
export interface CmsPageSnapshot extends Omit<
  CmsRenderablePage,
  'createdAt' | 'publishedAt' | 'status' | 'updatedAt'
> {
  status: 'draft' | 'published'
  revisionId: string
  revisionNumber: number
  createdAt: string
  updatedAt: string
  publishedAt?: string
}

export interface CmsPageSummary {
  id: string
  path: string
  title: string
  status: CmsPageRecordStatus
  draftRevisionId: string | null
  publishedRevisionId: string | null
  createdAt: string
  updatedAt: string
  publishedAt: string | null
}

export interface CmsPageRevision {
  id: string
  pageId: string
  revisionNumber: number
  title: string
  seo: CmsPageSeo
  blocks: CmsBlock[]
  changeNote: string | null
  createdBy: string | null
  createdAt: string
}

export interface CmsCreatePageInput {
  id?: string
  path: string
  title: string
  seo: CmsPageSeo
  blocks?: CmsBlock[]
  changeNote?: string
  actorUserId?: string
}

export interface CmsSavePageRevisionInput {
  pageId: string
  expectedRevisionId?: string
  title: string
  seo: CmsPageSeo
  blocks: CmsBlock[]
  changeNote?: string
  actorUserId?: string
}

export type CmsMediaStorageKind = 'bundled' | 'managed'

export interface CmsMedia {
  id: string
  storageKind: CmsMediaStorageKind
  originalPath: string
  originalFilename: string
  mimeType: string
  byteSize: number | null
  width: number | null
  height: number | null
  checksum: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface CmsMediaVariant {
  id: string
  mediaId: string
  variant: string
  path: string
  mimeType: string
  byteSize: number
  width: number
  height: number
  checksum: string
  createdAt: string
}

export interface CmsCreateMediaInput {
  id?: string
  storageKind: CmsMediaStorageKind
  originalPath: string
  originalFilename: string
  mimeType: string
  byteSize?: number | null
  width?: number | null
  height?: number | null
  checksum?: string | null
  actorUserId?: string
}

export interface CmsUpsertMediaVariantInput {
  id?: string
  mediaId: string
  variant: string
  path: string
  mimeType: string
  byteSize: number
  width: number
  height: number
  checksum: string
}

export type CmsUserRole = 'super_admin' | 'admin' | 'editor'

export interface CmsUser {
  id: string
  discordId: string
  username: string
  displayName: string | null
  avatarHash: string | null
  role: CmsUserRole
  isActive: boolean
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
}

export interface CmsUserAuthorization {
  id: string
  discordId: string
  role: CmsUserRole
  isActive: boolean
}

export interface CmsDiscordProfileInput {
  username: string
  displayName?: string | null
  avatarHash?: string | null
  lastLoginAt?: string
}

export interface CmsUpsertUserInput {
  id?: string
  discordId: string
  username: string
  displayName?: string | null
  avatarHash?: string | null
  role: CmsUserRole
  isActive?: boolean
  lastLoginAt?: string | null
  actorUserId?: string
}

export interface CmsUpdateUserAccessInput {
  role?: CmsUserRole
  isActive?: boolean
}

export interface CmsAuditEntry {
  id: string
  actorUserId: string | null
  action: string
  targetType: string
  targetId: string | null
  details: CmsJsonObject | null
  createdAt: string
}
