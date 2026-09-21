import { randomUUID } from 'node:crypto'

import type BetterSqlite3 from 'better-sqlite3'

import type {
  CmsAuditEntry,
  CmsBlock,
  CmsCreateMediaInput,
  CmsCreatePageInput,
  CmsDiscordProfileInput,
  CmsImage,
  CmsJsonObject,
  CmsMedia,
  CmsMediaVariant,
  CmsPageRevision,
  CmsPageSnapshot,
  CmsPageSummary,
  CmsSavePageRevisionInput,
  CmsUpsertMediaVariantInput,
  CmsUpsertUserInput,
  CmsUser,
  CmsUserAuthorization,
  CmsUserRole,
} from '../../../shared/types/cms'
import { getManagedCmsImageUrl } from '../cms-image-references'
import { getCmsDatabase } from './database'

export class CmsNotFoundError extends Error {
  constructor(message = 'Ressource CMS introuvable.') {
    super(message)
    this.name = 'CmsNotFoundError'
  }
}

export class CmsConflictError extends Error {
  constructor(message = 'Cette ressource CMS existe déjà.') {
    super(message)
    this.name = 'CmsConflictError'
  }
}

export class CmsValidationError extends Error {
  constructor(message = 'Les données CMS sont invalides.') {
    super(message)
    this.name = 'CmsValidationError'
  }
}

interface PageRow {
  id: string
  path: string
  status: 'draft' | 'published' | 'archived'
  draft_revision_id: string | null
  published_revision_id: string | null
  created_at: string
  updated_at: string
  published_at: string | null
}

interface RevisionRow {
  id: string
  page_id: string
  revision_number: number
  title: string
  seo_title: string
  seo_description: string
  seo_image_id: string | null
  seo_image_variant_checksum: string | null
  seo_noindex: number
  change_note: string | null
  created_by: string | null
  created_at: string
  media_storage_kind: 'bundled' | 'managed' | null
  media_original_path: string | null
  media_width: number | null
  media_height: number | null
  media_variant_checksum: string | null
  media_variant_width: number | null
  media_variant_height: number | null
}

interface BlockRow {
  id: string
  type: CmsBlock['type']
  variant: string | null
  sort_order: number
  anchor: string | null
  theme: CmsBlock['theme']
  enabled: number
  schema_version: number
  data_json: string
}

interface MediaRow {
  id: string
  storage_kind: CmsMedia['storageKind']
  original_path: string
  original_filename: string
  mime_type: string
  byte_size: number | null
  width: number | null
  height: number | null
  checksum: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

interface MediaVariantRow {
  id: string
  media_id: string
  variant: string
  path: string
  mime_type: string
  byte_size: number
  width: number
  height: number
  checksum: string
  created_at: string
}

interface UserRow {
  id: string
  discord_id: string
  username: string
  display_name: string | null
  avatar_hash: string | null
  role: CmsUserRole
  is_active: number
  created_at: string
  updated_at: string
  last_login_at: string | null
}

function now() {
  return new Date().toISOString()
}

function isSqliteConstraint(error: unknown) {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code.startsWith('SQLITE_CONSTRAINT')
  )
}

function runWrite(operation: () => void) {
  try {
    operation()
  } catch (error) {
    if (isSqliteConstraint(error)) {
      throw new CmsConflictError()
    }
    throw error
  }
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function mapMedia(row: MediaRow): CmsMedia {
  return {
    id: row.id,
    storageKind: row.storage_kind,
    originalPath: row.original_path,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    width: row.width,
    height: row.height,
    checksum: row.checksum,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapMediaVariant(row: MediaVariantRow): CmsMediaVariant {
  return {
    id: row.id,
    mediaId: row.media_id,
    variant: row.variant,
    path: row.path,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    width: row.width,
    height: row.height,
    checksum: row.checksum,
    createdAt: row.created_at,
  }
}

function mapUser(row: UserRow): CmsUser {
  return {
    id: row.id,
    discordId: row.discord_id,
    username: row.username,
    displayName: row.display_name,
    avatarHash: row.avatar_hash,
    role: row.role,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
  }
}

function pageSummary(database: BetterSqlite3.Database, row: PageRow): CmsPageSummary {
  const revisionId = row.draft_revision_id || row.published_revision_id
  const revision = revisionId
    ? (database.prepare('SELECT title FROM revisions WHERE id = ?').get(revisionId) as
        { title: string } | undefined)
    : undefined

  return {
    id: row.id,
    path: row.path,
    title: revision?.title || row.path,
    status: row.status,
    draftRevisionId: row.draft_revision_id,
    publishedRevisionId: row.published_revision_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  }
}

function pageImage(row: RevisionRow) {
  if (!row.seo_image_id || !row.media_original_path) return undefined
  if (row.media_storage_kind === 'managed' && !row.media_variant_checksum) return undefined
  const src =
    row.media_storage_kind === 'managed'
      ? `/media/${encodeURIComponent(row.seo_image_id)}/hero-${row.media_variant_checksum}.webp`
      : row.media_original_path
  return {
    mediaId: row.seo_image_id,
    src,
    alt: '',
    ...(row.media_variant_width || row.media_width
      ? { width: row.media_variant_width || row.media_width || undefined }
      : {}),
    ...(row.media_variant_height || row.media_height
      ? { height: row.media_variant_height || row.media_height || undefined }
      : {}),
    decorative: true,
  }
}

function getSeoImageVariantChecksum(
  database: BetterSqlite3.Database,
  image: CmsImage | undefined,
): string | null {
  if (!image) return null
  const mediaId = image.mediaId
  if (!mediaId) {
    throw new CmsValidationError('L’image SEO doit référencer un média CMS.')
  }

  const media = database
    .prepare('SELECT storage_kind, original_path FROM media WHERE id = ?')
    .get(mediaId) as { storage_kind: CmsMedia['storageKind']; original_path: string } | undefined
  if (!media) throw new CmsValidationError('Le média SEO n’existe pas.')

  if (media.storage_kind === 'bundled') {
    if (image.src !== media.original_path) {
      throw new CmsValidationError('L’URL de l’image SEO intégrée est invalide.')
    }
    return null
  }

  const variants = database
    .prepare(
      `
        SELECT checksum
        FROM media_variants
        WHERE media_id = ? AND variant = 'hero' AND mime_type = 'image/webp'
      `,
    )
    .all(mediaId) as Array<{ checksum: string }>
  const variant = variants.find(
    ({ checksum }) => image.src === getManagedCmsImageUrl(mediaId, 'hero', checksum),
  )
  if (!variant) {
    throw new CmsValidationError('L’image SEO ne correspond à aucune variante hero enregistrée.')
  }
  return variant.checksum
}

function revisionRow(database: BetterSqlite3.Database, revisionId: string) {
  return database
    .prepare(
      `
        SELECT
          revisions.*,
          media.storage_kind AS media_storage_kind,
          media.original_path AS media_original_path,
          media.width AS media_width,
          media.height AS media_height,
          seo_variant.checksum AS media_variant_checksum,
          seo_variant.width AS media_variant_width,
          seo_variant.height AS media_variant_height
        FROM revisions
        LEFT JOIN media ON media.id = revisions.seo_image_id
        LEFT JOIN media_variants AS seo_variant ON seo_variant.id = (
          SELECT candidate.id
          FROM media_variants AS candidate
          WHERE candidate.media_id = revisions.seo_image_id
            AND candidate.variant = 'hero'
            AND (
              revisions.seo_image_variant_checksum IS NULL
              OR candidate.checksum = revisions.seo_image_variant_checksum
            )
          ORDER BY candidate.created_at DESC, candidate.id DESC
          LIMIT 1
        )
        WHERE revisions.id = ?
      `,
    )
    .get(revisionId) as RevisionRow | undefined
}

function revisionBlocks(database: BetterSqlite3.Database, revisionId: string): CmsBlock[] {
  const rows = database
    .prepare(
      `
        SELECT id, type, variant, sort_order, anchor, theme, enabled, schema_version, data_json
        FROM blocks
        WHERE revision_id = ?
        ORDER BY sort_order, id
      `,
    )
    .all(revisionId) as BlockRow[]

  return rows.map(
    (row) =>
      ({
        id: row.id,
        type: row.type,
        ...(row.variant ? { variant: row.variant } : {}),
        sortOrder: row.sort_order,
        ...(row.anchor ? { anchor: row.anchor } : {}),
        theme: row.theme || 'default',
        enabled: row.enabled === 1,
        schemaVersion: row.schema_version as 1,
        data: parseJson(row.data_json, {}),
      }) as CmsBlock,
  )
}

function hydratePage(
  database: BetterSqlite3.Database,
  page: PageRow,
  revisionId: string,
  status: 'draft' | 'published',
): CmsPageSnapshot | null {
  const revision = revisionRow(database, revisionId)
  if (!revision || revision.page_id !== page.id) return null

  return {
    id: page.id,
    path: page.path,
    title: revision.title,
    status,
    seo: {
      title: revision.seo_title,
      description: revision.seo_description,
      ...(pageImage(revision) ? { image: pageImage(revision) } : {}),
      noindex: revision.seo_noindex === 1,
    },
    blocks: revisionBlocks(database, revision.id),
    revisionId: revision.id,
    revisionNumber: revision.revision_number,
    createdAt: page.created_at,
    updatedAt: page.updated_at,
    ...(page.published_at ? { publishedAt: page.published_at } : {}),
  }
}

function audit(
  database: BetterSqlite3.Database,
  action: string,
  targetType: string,
  targetId: string | null,
  actorUserId?: string,
  details?: CmsJsonObject,
) {
  const entry: CmsAuditEntry = {
    id: `audit:${randomUUID()}`,
    actorUserId: actorUserId || null,
    action,
    targetType,
    targetId,
    details: details || null,
    createdAt: now(),
  }
  database
    .prepare(
      `
        INSERT INTO audit (id, actor_user_id, action, target_type, target_id, details_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      entry.id,
      entry.actorUserId,
      entry.action,
      entry.targetType,
      entry.targetId,
      entry.details ? JSON.stringify(entry.details) : null,
      entry.createdAt,
    )
}

export function createCmsRepository(database: BetterSqlite3.Database = getCmsDatabase()) {
  const pageByIdStatement = database.prepare('SELECT * FROM pages WHERE id = ?')
  const pageByPathStatement = database.prepare('SELECT * FROM pages WHERE path = ?')

  function listCmsPages(): CmsPageSummary[] {
    const rows = database.prepare('SELECT * FROM pages ORDER BY path').all() as PageRow[]
    return rows.map((row) => pageSummary(database, row))
  }

  function getPublishedPageByPath(path: string): CmsPageSnapshot | null {
    const page = pageByPathStatement.get(path) as PageRow | undefined
    const snapshot = page?.published_revision_id
      ? hydratePage(database, page, page.published_revision_id, 'published')
      : null

    return snapshot
      ? { ...snapshot, blocks: snapshot.blocks.filter((block) => block.enabled) }
      : null
  }

  function getDraftPageById(pageId: string): CmsPageSnapshot | null {
    const page = pageByIdStatement.get(pageId) as PageRow | undefined
    if (!page) return null
    const revisionId = page.draft_revision_id || page.published_revision_id
    return revisionId ? hydratePage(database, page, revisionId, 'draft') : null
  }

  function getDraftPageByPath(path: string): CmsPageSnapshot | null {
    const page = pageByPathStatement.get(path) as PageRow | undefined
    return page ? getDraftPageById(page.id) : null
  }

  function insertRevision(input: CmsSavePageRevisionInput): CmsPageRevision {
    const page = pageByIdStatement.get(input.pageId) as PageRow | undefined
    if (!page) throw new CmsNotFoundError('Page CMS introuvable.')
    if (input.expectedRevisionId && page.draft_revision_id !== input.expectedRevisionId) {
      throw new CmsConflictError(
        'Cette page a été modifiée par un autre éditeur. Recharge-la avant de continuer.',
      )
    }
    if (!input.title.trim() || !input.seo.title.trim() || !input.seo.description.trim()) {
      throw new CmsValidationError('Le titre et les champs SEO sont requis.')
    }

    const latest = database
      .prepare(
        'SELECT COALESCE(MAX(revision_number), 0) AS number FROM revisions WHERE page_id = ?',
      )
      .get(input.pageId) as { number: number }
    const revisionNumber = latest.number + 1
    const revisionId = `revision:${input.pageId}:${revisionNumber}:${randomUUID()}`
    const timestamp = now()
    const seoImageVariantChecksum = getSeoImageVariantChecksum(database, input.seo.image)
    const blocks = [...input.blocks]
      .sort((first, second) => first.sortOrder - second.sortOrder)
      .map((block, sortOrder) => ({ ...block, sortOrder }))

    database
      .prepare(
        `
          INSERT INTO revisions (
            id, page_id, revision_number, title, seo_title, seo_description,
            seo_image_id, seo_image_variant_checksum, seo_noindex,
            change_note, created_by, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        revisionId,
        input.pageId,
        revisionNumber,
        input.title.trim(),
        input.seo.title.trim(),
        input.seo.description.trim(),
        input.seo.image?.mediaId || null,
        seoImageVariantChecksum,
        input.seo.noindex ? 1 : 0,
        input.changeNote?.trim() || null,
        input.actorUserId || null,
        timestamp,
      )

    const insertBlock = database.prepare(
      `
        INSERT INTO blocks (
          revision_id, id, type, variant, sort_order, anchor, theme,
          enabled, schema_version, data_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    for (const block of blocks) {
      insertBlock.run(
        revisionId,
        block.id,
        block.type,
        block.variant || null,
        block.sortOrder,
        block.anchor || null,
        block.theme || 'default',
        block.enabled ? 1 : 0,
        block.schemaVersion,
        JSON.stringify(block.data),
      )
    }

    database
      .prepare('UPDATE pages SET draft_revision_id = ?, updated_at = ? WHERE id = ?')
      .run(revisionId, timestamp, input.pageId)
    audit(database, 'page.revision.saved', 'page', input.pageId, input.actorUserId, {
      revisionId,
      revisionNumber,
    })

    return {
      id: revisionId,
      pageId: input.pageId,
      revisionNumber,
      title: input.title.trim(),
      seo: input.seo,
      blocks,
      changeNote: input.changeNote?.trim() || null,
      createdBy: input.actorUserId || null,
      createdAt: timestamp,
    }
  }

  function saveCmsPageRevision(input: CmsSavePageRevisionInput): CmsPageRevision {
    let result: CmsPageRevision | undefined
    runWrite(() => {
      result = database.transaction(() => insertRevision(input))()
    })
    if (!result) throw new CmsValidationError()
    return result
  }

  function createCmsPage(input: CmsCreatePageInput): CmsPageSnapshot {
    const path = input.path === '/' ? '/' : input.path.replace(/\/+$/, '')
    if (!path.startsWith('/') || path.includes('?') || path.includes('#')) {
      throw new CmsValidationError('Le chemin de page est invalide.')
    }
    const pageId = input.id || `page:${randomUUID()}`
    const timestamp = now()
    let result: CmsPageSnapshot | null = null
    runWrite(() => {
      database.transaction(() => {
        database
          .prepare(
            `
              INSERT INTO pages (
                id, path, status, draft_revision_id, published_revision_id,
                created_at, updated_at, published_at
              ) VALUES (?, ?, 'draft', NULL, NULL, ?, ?, NULL)
            `,
          )
          .run(pageId, path, timestamp, timestamp)
        insertRevision({
          pageId,
          title: input.title,
          seo: input.seo,
          blocks: input.blocks || [],
          changeNote: input.changeNote,
          actorUserId: input.actorUserId,
        })
        result = getDraftPageById(pageId)
      })()
    })
    if (!result) throw new CmsValidationError('Impossible de créer la page.')
    return result
  }

  function publishCmsPage(
    pageId: string,
    revisionId?: string,
    actorUserId?: string,
  ): CmsPageSnapshot {
    let snapshot: CmsPageSnapshot | null = null
    runWrite(() => {
      database.transaction(() => {
        const page = pageByIdStatement.get(pageId) as PageRow | undefined
        if (!page) throw new CmsNotFoundError('Page CMS introuvable.')
        const targetRevisionId = revisionId || page.draft_revision_id
        if (!targetRevisionId) throw new CmsValidationError('Aucun brouillon à publier.')
        if (page.draft_revision_id !== targetRevisionId) {
          throw new CmsConflictError(
            'Cette page a été modifiée par un autre éditeur. Recharge-la avant de publier.',
          )
        }
        const revision = revisionRow(database, targetRevisionId)
        if (!revision || revision.page_id !== pageId) {
          throw new CmsNotFoundError('Révision CMS introuvable.')
        }
        const timestamp = now()
        database
          .prepare(
            `
              UPDATE pages
              SET status = 'published', published_revision_id = ?, published_at = ?, updated_at = ?
              WHERE id = ?
            `,
          )
          .run(targetRevisionId, timestamp, timestamp, pageId)
        audit(database, 'page.published', 'page', pageId, actorUserId, {
          revisionId: targetRevisionId,
        })
        const updated = pageByIdStatement.get(pageId) as PageRow
        snapshot = hydratePage(database, updated, targetRevisionId, 'published')
      })()
    })
    if (!snapshot) throw new CmsValidationError('Impossible de publier la page.')
    return snapshot
  }

  function listCmsMedia(): CmsMedia[] {
    return (
      database.prepare('SELECT * FROM media ORDER BY created_at DESC').all() as MediaRow[]
    ).map(mapMedia)
  }

  function getCmsMediaById(id: string): CmsMedia | null {
    const row = database.prepare('SELECT * FROM media WHERE id = ?').get(id) as MediaRow | undefined
    return row ? mapMedia(row) : null
  }

  function createCmsMedia(input: CmsCreateMediaInput): CmsMedia {
    const id = input.id || `media:${randomUUID()}`
    const timestamp = now()
    runWrite(() => {
      database
        .prepare(
          `
            INSERT INTO media (
              id, storage_kind, original_path, original_filename, mime_type,
              byte_size, width, height, checksum, created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
        .run(
          id,
          input.storageKind,
          input.originalPath,
          input.originalFilename,
          input.mimeType,
          input.byteSize ?? null,
          input.width ?? null,
          input.height ?? null,
          input.checksum ?? null,
          input.actorUserId || null,
          timestamp,
          timestamp,
        )
      audit(database, 'media.created', 'media', id, input.actorUserId)
    })
    const media = getCmsMediaById(id)
    if (!media) throw new CmsValidationError('Impossible de créer le média.')
    return media
  }

  function listCmsMediaVariants(mediaId: string): CmsMediaVariant[] {
    return (
      database
        .prepare(
          'SELECT * FROM media_variants WHERE media_id = ? ORDER BY variant, created_at DESC',
        )
        .all(mediaId) as MediaVariantRow[]
    ).map(mapMediaVariant)
  }

  function upsertCmsMediaVariant(input: CmsUpsertMediaVariantInput): CmsMediaVariant {
    const id = input.id || `variant:${randomUUID()}`
    const timestamp = now()
    runWrite(() => {
      database
        .prepare(
          `
            INSERT INTO media_variants (
              id, media_id, variant, path, mime_type, byte_size,
              width, height, checksum, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(media_id, variant, checksum) DO NOTHING
          `,
        )
        .run(
          id,
          input.mediaId,
          input.variant,
          input.path,
          input.mimeType,
          input.byteSize,
          input.width,
          input.height,
          input.checksum,
          timestamp,
        )
    })
    const row = database
      .prepare('SELECT * FROM media_variants WHERE media_id = ? AND variant = ? AND checksum = ?')
      .get(input.mediaId, input.variant, input.checksum) as MediaVariantRow | undefined
    if (!row) throw new CmsValidationError('Impossible de créer la variante média.')
    return mapMediaVariant(row)
  }

  function getCmsUserById(id: string): CmsUser | null {
    const row = database.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
    return row ? mapUser(row) : null
  }

  function findCmsUserByDiscordId(discordId: string): CmsUser | null {
    const row = database.prepare('SELECT * FROM users WHERE discord_id = ?').get(discordId) as
      UserRow | undefined
    return row ? mapUser(row) : null
  }

  function listCmsUsers(): CmsUser[] {
    return (database.prepare('SELECT * FROM users ORDER BY created_at').all() as UserRow[]).map(
      mapUser,
    )
  }

  function getCmsUserAuthorization(userId: string): CmsUserAuthorization | null {
    const user = getCmsUserById(userId)
    return user
      ? { id: user.id, discordId: user.discordId, role: user.role, isActive: user.isActive }
      : null
  }

  function upsertCmsUser(input: CmsUpsertUserInput): CmsUser {
    const existing = findCmsUserByDiscordId(input.discordId)
    const id = existing?.id || input.id || `user:${randomUUID()}`
    const timestamp = now()
    const isActive = input.isActive !== false
    const accessChanged =
      !existing || existing.role !== input.role || existing.isActive !== isActive
    runWrite(() => {
      database.transaction(() => {
        database
          .prepare(
            `
              INSERT INTO users (
                id, discord_id, username, display_name, avatar_hash, role,
                is_active, created_at, updated_at, last_login_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(discord_id) DO UPDATE SET
                username = excluded.username,
                display_name = excluded.display_name,
                avatar_hash = excluded.avatar_hash,
                role = excluded.role,
                is_active = excluded.is_active,
                updated_at = excluded.updated_at,
                last_login_at = COALESCE(excluded.last_login_at, users.last_login_at)
            `,
          )
          .run(
            id,
            input.discordId,
            input.username,
            input.displayName ?? null,
            input.avatarHash ?? null,
            input.role,
            isActive ? 1 : 0,
            existing?.createdAt || timestamp,
            timestamp,
            input.lastLoginAt ?? null,
          )
        if (accessChanged) {
          audit(
            database,
            existing ? 'user.access.upserted' : 'user.created',
            'user',
            id,
            input.actorUserId,
            { role: input.role, isActive },
          )
        }
      })()
    })
    const user = findCmsUserByDiscordId(input.discordId)
    if (!user) throw new CmsValidationError('Impossible de créer l’utilisateur.')
    return user
  }

  function updateCmsUserDiscordProfile(
    discordId: string,
    profile: CmsDiscordProfileInput,
  ): CmsUser | null {
    const timestamp = now()
    database
      .prepare(
        `
          UPDATE users
          SET username = ?, display_name = ?, avatar_hash = ?, updated_at = ?, last_login_at = ?
          WHERE discord_id = ?
        `,
      )
      .run(
        profile.username,
        profile.displayName ?? null,
        profile.avatarHash ?? null,
        timestamp,
        profile.lastLoginAt || timestamp,
        discordId,
      )
    return findCmsUserByDiscordId(discordId)
  }

  function updateCmsUserAccess(
    userId: string,
    input: { role?: CmsUserRole; isActive?: boolean },
    actorUserId?: string,
  ): CmsUser {
    const user = getCmsUserById(userId)
    if (!user) throw new CmsNotFoundError('Utilisateur CMS introuvable.')
    const role = input.role || user.role
    const isActive = input.isActive ?? user.isActive
    const timestamp = now()
    runWrite(() => {
      database.transaction(() => {
        database
          .prepare('UPDATE users SET role = ?, is_active = ?, updated_at = ? WHERE id = ?')
          .run(role, isActive ? 1 : 0, timestamp, userId)
        audit(database, 'user.access.updated', 'user', userId, actorUserId, {
          role,
          isActive,
        })
      })()
    })
    const updated = getCmsUserById(userId)
    if (!updated) throw new CmsValidationError('Impossible de modifier l’utilisateur.')
    return updated
  }

  function getCmsSetting<T = unknown>(key: string): T | null {
    const row = database.prepare('SELECT value_json FROM settings WHERE key = ?').get(key) as
      { value_json: string } | undefined
    return row ? parseJson<T | null>(row.value_json, null) : null
  }

  function writeCmsSetting(key: string, value: unknown, actorUserId?: string): void {
    const normalizedKey = key.trim()
    if (!normalizedKey) throw new CmsValidationError('La clé de réglage est vide.')
    const valueJson = JSON.stringify(value)
    if (valueJson === undefined) throw new CmsValidationError('Le réglage n’est pas sérialisable.')
    const timestamp = now()
    database
      .prepare(
        `
          INSERT INTO settings (key, value_json, updated_by, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET
            value_json = excluded.value_json,
            updated_by = excluded.updated_by,
            updated_at = excluded.updated_at
        `,
      )
      .run(normalizedKey, valueJson, actorUserId || null, timestamp)
    audit(database, 'setting.updated', 'setting', normalizedKey, actorUserId)
  }

  function setCmsSettings(values: Record<string, unknown>, actorUserId?: string): void {
    runWrite(() => {
      database.transaction(() => {
        for (const [key, value] of Object.entries(values)) {
          writeCmsSetting(key, value, actorUserId)
        }
      })()
    })
  }

  function setCmsSetting(key: string, value: unknown, actorUserId?: string): void {
    setCmsSettings({ [key]: value }, actorUserId)
  }

  return {
    listCmsPages,
    getPublishedPageByPath,
    getDraftPageById,
    getDraftPageByPath,
    createCmsPage,
    saveCmsPageRevision,
    publishCmsPage,
    listCmsMedia,
    getCmsMediaById,
    createCmsMedia,
    listCmsMediaVariants,
    upsertCmsMediaVariant,
    listCmsUsers,
    getCmsUserById,
    findCmsUserByDiscordId,
    getCmsUserAuthorization,
    updateCmsUserDiscordProfile,
    upsertCmsUser,
    updateCmsUserAccess,
    getCmsSetting,
    setCmsSetting,
    setCmsSettings,
  }
}

type CmsRepository = ReturnType<typeof createCmsRepository>

function repository(): CmsRepository {
  return createCmsRepository(getCmsDatabase())
}

export const listCmsPages = () => repository().listCmsPages()
export const getPublishedPageByPath = (path: string) => repository().getPublishedPageByPath(path)
export const getDraftPageById = (pageId: string) => repository().getDraftPageById(pageId)
export const getDraftPageByPath = (path: string) => repository().getDraftPageByPath(path)
export const createCmsPage = (input: CmsCreatePageInput) => repository().createCmsPage(input)
export const saveCmsPageRevision = (input: CmsSavePageRevisionInput) =>
  repository().saveCmsPageRevision(input)
export const publishCmsPage = (pageId: string, revisionId?: string, actorUserId?: string) =>
  repository().publishCmsPage(pageId, revisionId, actorUserId)
export const listCmsMedia = () => repository().listCmsMedia()
export const getCmsMediaById = (id: string) => repository().getCmsMediaById(id)
export const createCmsMedia = (input: CmsCreateMediaInput) => repository().createCmsMedia(input)
export const listCmsMediaVariants = (mediaId: string) => repository().listCmsMediaVariants(mediaId)
export const upsertCmsMediaVariant = (input: CmsUpsertMediaVariantInput) =>
  repository().upsertCmsMediaVariant(input)
export const listCmsUsers = () => repository().listCmsUsers()
export const getCmsUserById = (id: string) => repository().getCmsUserById(id)
export const findCmsUserByDiscordId = (discordId: string) =>
  repository().findCmsUserByDiscordId(discordId)
export const getCmsUserAuthorization = (userId: string) =>
  repository().getCmsUserAuthorization(userId)
export const updateCmsUserDiscordProfile = (discordId: string, profile: CmsDiscordProfileInput) =>
  repository().updateCmsUserDiscordProfile(discordId, profile)
export const upsertCmsUser = (input: CmsUpsertUserInput) => repository().upsertCmsUser(input)
export const updateCmsUserAccess = (
  userId: string,
  input: { role?: CmsUserRole; isActive?: boolean },
  actorUserId?: string,
) => repository().updateCmsUserAccess(userId, input, actorUserId)
export const getCmsSetting = <T = unknown>(key: string) => repository().getCmsSetting<T>(key)
export const setCmsSetting = (key: string, value: unknown, actorUserId?: string) =>
  repository().setCmsSetting(key, value, actorUserId)
export const setCmsSettings = (values: Record<string, unknown>, actorUserId?: string) =>
  repository().setCmsSettings(values, actorUserId)
