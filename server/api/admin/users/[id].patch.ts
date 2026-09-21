import { createError, getRouterParam, readBody, setHeader } from 'h3'

import type { CmsUserRole } from '../../../../shared/types/cms'
import { getCmsUserById, updateCmsUserAccess } from '../../../utils/cms/repository'
import { isConfiguredCmsSuperAdmin, requireCmsMutationRole } from '../../../utils/cms-authorization'

const VALID_ROLES = new Set<CmsUserRole>(['editor', 'admin', 'super_admin'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export default defineEventHandler(async (event) => {
  const actor = await requireCmsMutationRole(event, 'super_admin')
  const userId = getRouterParam(event, 'id') || ''
  const current = getCmsUserById(userId)
  if (!current) throw createError({ statusCode: 404, statusMessage: 'Utilisateur introuvable.' })

  const body = await readBody<unknown>(event)
  if (!isRecord(body))
    throw createError({ statusCode: 400, statusMessage: 'Modification invalide.' })

  const role = typeof body.role === 'string' ? (body.role as CmsUserRole) : undefined
  const isActive = typeof body.isActive === 'boolean' ? body.isActive : undefined
  if (role && !VALID_ROLES.has(role)) {
    throw createError({ statusCode: 422, statusMessage: 'Rôle invalide.' })
  }

  const configuredSuperAdmin = isConfiguredCmsSuperAdmin(event, current.discordId)
  if (
    configuredSuperAdmin &&
    ((role !== undefined && role !== 'super_admin') || isActive === false)
  ) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Le super administrateur configuré ne peut pas être désactivé ou rétrogradé.',
    })
  }
  if (role === 'super_admin' && !configuredSuperAdmin) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Un seul super administrateur est autorisé par la configuration privée.',
    })
  }
  if (current.id === actor.id && isActive === false) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Tu ne peux pas désactiver ton propre compte.',
    })
  }

  const user = updateCmsUserAccess(
    userId,
    {
      ...(role ? { role } : {}),
      ...(isActive === undefined ? {} : { isActive }),
    },
    actor.id,
  )

  setHeader(event, 'Cache-Control', 'private, no-store')
  return { user }
})
