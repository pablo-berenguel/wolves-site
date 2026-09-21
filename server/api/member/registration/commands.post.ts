import { createError, readBody, setHeader } from 'h3'

import type {
  MemberRegistrationActionBody,
  RegistrationAction,
} from '../../../../shared/types/registrations'
import {
  assertCmsMutationOrigin,
  requireAuthenticatedDiscordUser,
} from '../../../utils/cms-authorization'
import {
  createRegistrationRequestId,
  createSelfRegistrationCommand,
} from '../../../utils/registrations/bridge'

const ACTIONS = new Set<RegistrationAction>([
  'register',
  'cancel',
  'subscribe_alert',
  'unsubscribe_alert',
])
const SESSION_KEY_PATTERN = /^[\w:-]{1,160}$/

function parseBody(value: unknown): MemberRegistrationActionBody {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid registration command' })
  }

  const record = value as Record<string, unknown>
  const action = typeof record.action === 'string' ? record.action : ''
  const sessionKey = typeof record.sessionKey === 'string' ? record.sessionKey.trim() : ''

  if (!ACTIONS.has(action as RegistrationAction) || !SESSION_KEY_PATTERN.test(sessionKey)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid registration command' })
  }

  return {
    action: action as RegistrationAction,
    sessionKey,
  }
}

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'Vary', 'Cookie')
  assertCmsMutationOrigin(event)

  const user = await requireAuthenticatedDiscordUser(event)
  const body = parseBody(await readBody(event))

  return createSelfRegistrationCommand(event, user.discordId, createRegistrationRequestId(), body)
})
