import { createError, readBody, setHeader } from 'h3'

import type { CmsUserRole } from '../../../../shared/types/cms'
import { findCmsUserByDiscordId, upsertCmsUser } from '../../../utils/cms/repository'
import { isConfiguredCmsSuperAdmin, requireCmsMutationRole } from '../../../utils/cms-authorization'

const VALID_ROLES = new Set<CmsUserRole>(['editor', 'admin', 'super_admin'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export default defineEventHandler(async (event) => {
  const actor = await requireCmsMutationRole(event, 'super_admin')
  const body = await readBody<unknown>(event)
  if (!isRecord(body)) throw createError({ statusCode: 400, statusMessage: 'Compte invalide.' })

  const discordId = typeof body.discordId === 'string' ? body.discordId.trim() : ''
  const username = typeof body.username === 'string' ? body.username.trim().slice(0, 80) : ''
  const displayName =
    typeof body.displayName === 'string' ? body.displayName.trim().slice(0, 100) || null : null
  const role = body.role as CmsUserRole

  if (!/^\d{17,20}$/.test(discordId) || !username || !VALID_ROLES.has(role)) {
    throw createError({ statusCode: 422, statusMessage: 'ID Discord, nom ou rôle invalide.' })
  }
  if (role === 'super_admin' && !isConfiguredCmsSuperAdmin(event, discordId)) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Le super administrateur doit correspondre à l’ID privé configuré.',
    })
  }

  const existing = findCmsUserByDiscordId(discordId)
  if (existing) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Ce compte existe déjà. Modifie-le dans la liste des utilisateurs.',
    })
  }
  const user = upsertCmsUser({
    discordId,
    username,
    displayName,
    role,
    isActive: body.isActive !== false,
    actorUserId: actor.id,
  })

  setHeader(event, 'Cache-Control', 'private, no-store')
  return { user }
})
