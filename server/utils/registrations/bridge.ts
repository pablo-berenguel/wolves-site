import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'

import { createError, type H3Event } from 'h3'

import type { MemberParticipationAccess } from '../../../shared/types/participations'
import type {
  MemberRegistrationActionBody,
  MemberRegistrationCommandResponse,
  MemberRegistrationResponse,
} from '../../../shared/types/registrations'
import type {
  TrainingAnnouncementAccess,
  TrainingAnnouncementActionRequest,
  TrainingAnnouncementCreateRequest,
  TrainingAnnouncementListResponse,
  TrainingAnnouncementResponse,
  TrainingAnnouncementUpdateRequest,
} from '../../../shared/types/training-announcements'
import type {
  AnimationEventActionRequest,
  AnimationEventCreateRequest,
  AnimationEventDraft,
  AnimationEventGroupConfigRequest,
  AnimationEventGroupConfigResponse,
  AnimationEventListResponse,
  AnimationEventPreviewResponse,
  AnimationEventResponse,
  AnimationEventUpdateRequest,
} from '../../../shared/types/animation-events'
import {
  createBridgeSignatureHeaders,
  parseMemberParticipationAccess,
  parseMemberRegistrationResponse,
  parseRegistrationCommandResponse,
  parseTrainingAnnouncementAccess,
  parseTrainingAnnouncementListResponse,
  parseTrainingAnnouncementResponse,
} from './protocol'
import {
  parseAnimationEventGroupConfigResponse,
  parseAnimationEventListResponse,
  parseAnimationEventPreviewResponse,
  parseAnimationEventResponse,
} from './animation-events-protocol'
import {
  parseAnimationEventAvatarResponse,
  type AnimationEventAvatarPayload,
} from './animation-event-avatar'
import { mapBridgeServiceUnavailable } from './bridge-errors'
import { isActiveCmsAdministrator } from '../cms-authorization'
import type { TeamStatisticsTeamKey } from '../../../shared/types/team-statistics'
import {
  parseTeamStatisticsAccess,
  parseTeamStatisticsDetail,
  parseTeamStatisticsOverview,
} from './team-statistics-protocol'
import { parseTrainingRosterAccess, parseTrainingRosterResponse } from './training-roster-protocol'

const REQUEST_TIMEOUT_MS = 6_000
const SYNC_REQUEST_TIMEOUT_MS = 30_000
// L’effectif complet est relu avec pagination après les droits et les rôles.
const TEAM_STATISTICS_REQUEST_TIMEOUT_MS = 50_000
const TRAINING_ANNOUNCEMENT_ERROR_MESSAGES: Record<string, string> = {
  duplicate_week: 'Une annonce existe déjà pour cette semaine.',
  stale_revision: 'Cette annonce a été modifiée ailleurs. Recharge-la avant de réessayer.',
  message_too_long: 'Le message final dépasse la limite Discord de 2 000 caractères.',
  immutable_structure:
    'La semaine et la plage de diffusion d’une annonce publiée ne peuvent plus changer.',
  participant_history_exists:
    'Ce créneau possède déjà un historique d’inscriptions : sa réaction ou sa suppression ne peut plus changer.',
  capacity_below_participants:
    'La capacité ne peut pas être inférieure au nombre de personnes déjà inscrites.',
  discord_unavailable:
    'La mise à jour Discord n’a pas pu être confirmée. Recharge l’annonce puis réessaie avec la même modification.',
  edit_in_progress:
    'Une autre modification Discord est déjà en cours. Attends quelques secondes puis recharge l’annonce.',
  window_elapsed: 'La plage de diffusion est déjà terminée. Choisis une nouvelle plage.',
  invalid_announcement: "L'annonce contient une valeur invalide.",
  not_found: "Cette annonce n'existe plus.",
  conflict: "L'annonce ne peut pas être modifiée dans son état actuel.",
}
const ANIMATION_EVENT_ERROR_MESSAGES: Record<string, string> = {
  idempotency_conflict:
    'Cette tentative ne correspond plus à la modification initiale. Recharge la page.',
  stale_revision: 'Cet événement a été modifié ailleurs. Recharge-le avant de réessayer.',
  stale_version: 'Les groupes ont été modifiés ailleurs. Recharge-les avant de réessayer.',
  message_too_long: 'Le message final dépasse la limite Discord de 2 000 caractères.',
  participant_history_exists:
    'Cette catégorie possède déjà un historique de réactions : son emoji ou sa suppression ne peut plus changer.',
  capacity_below_participants:
    'La capacité ne peut pas être inférieure au nombre de participants actifs.',
  discord_unavailable:
    'La mise à jour Discord n’a pas pu être confirmée. Recharge l’événement puis réessaie avec la même modification.',
  edit_in_progress:
    'Une autre modification Discord est déjà en cours. Attends quelques secondes puis recharge l’événement.',
  too_many_slots: 'Discord accepte au maximum vingt catégories de réaction par message.',
  invalid_window: 'La plage de diffusion doit précéder le premier événement.',
  window_elapsed: 'La plage de diffusion est déjà terminée. Choisis une nouvelle plage.',
  immutable_event:
    'Ce message est désormais en lecture seule. Relance sa publication ou duplique-le.',
  slot_not_published: 'Les groupes sont disponibles uniquement après publication du message.',
  inactive_participant:
    'Une personne ayant retiré sa réaction ne peut pas être ajoutée à un groupe.',
  unknown_participant: "Une personne du groupe ne fait plus partie de l'événement.",
  invalid_action: "Cette action n'est pas disponible dans l'état actuel du message.",
  invalid_event: "L'événement contient une valeur invalide.",
  not_found: "Cet événement n'existe plus.",
  conflict: "L'événement ne peut pas être modifié dans son état actuel.",
}

interface BridgeConfig {
  baseUrl: string
  secret: string
}

function unavailable(): never {
  throw createError({
    statusCode: 503,
    statusMessage: 'Registration service unavailable',
  })
}

function normalizeBaseUrl(value: unknown) {
  const candidate = typeof value === 'string' ? value.trim() : ''

  if (!candidate) return ''

  try {
    const url = new URL(candidate)
    if (!['http:', 'https:'].includes(url.protocol)) return ''
    url.pathname = url.pathname.replace(/\/$/, '')
    url.search = ''
    url.hash = ''

    return url.toString().replace(/\/$/, '')
  } catch {
    return ''
  }
}

async function bridgeConfig(event: H3Event): Promise<BridgeConfig> {
  const config = useRuntimeConfig(event)
  const baseUrl = normalizeBaseUrl(config.bigbadbotBridgeUrl)
  const configuredSecret = String(config.bigbadbotBridgeSecret || '').trim()
  const secretFilename = String(config.bigbadbotBridgeSecretFile || '').trim()
  let secret = configuredSecret

  if (!secret && secretFilename) {
    try {
      secret = (await readFile(secretFilename, 'utf8')).trim()
    } catch {
      return unavailable()
    }
  }

  if (!baseUrl || secret.length < 32) return unavailable()

  return { baseUrl, secret }
}

async function bridgeRequest<T>(
  event: H3Event,
  method: 'GET' | 'POST' | 'PUT',
  pathWithQuery: string,
  body?: Record<string, unknown>,
  timeout = REQUEST_TIMEOUT_MS,
): Promise<T> {
  const config = await bridgeConfig(event)
  const rawBody = body ? JSON.stringify(body) : ''

  try {
    return await $fetch<T>(`${config.baseUrl}${pathWithQuery}`, {
      method,
      headers: createBridgeSignatureHeaders(config.secret, method, pathWithQuery, rawBody),
      ...(rawBody ? { body: rawBody } : {}),
      retry: 0,
      timeout,
    })
  } catch (error) {
    const remoteCode = String((error as { data?: { code?: unknown } }).data?.code || '')
    const isTrainingAnnouncementRequest = pathWithQuery.startsWith(
      '/v1/admin/training-announcements',
    )
    const isAnimationEventRequest = pathWithQuery.startsWith('/v1/admin/animation-events')
    const isTeamStatisticsRequest = pathWithQuery.startsWith('/v1/admin/team-statistics')
    const isTrainingRosterRequest = pathWithQuery.startsWith('/v1/member/training-roster')
    const status = Number(
      (error as { response?: { status?: unknown }; statusCode?: unknown }).response?.status ||
        (error as { statusCode?: unknown }).statusCode,
    )
    const mappedServiceUnavailable = mapBridgeServiceUnavailable(pathWithQuery, status, remoteCode)
    if (mappedServiceUnavailable) throw createError(mappedServiceUnavailable)

    if (isTrainingRosterRequest && [400, 403, 404, 409, 503].includes(status)) {
      const messages: Record<number, string> = {
        400: 'Créneau invalide.',
        403: 'Le rôle Wolves et l’accès au salon d’entraînement sont nécessaires.',
        404: 'Ce créneau n’est plus disponible dans la dernière annonce.',
        409: 'L’annonce a changé. Recharge les créneaux du dernier message.',
        503: 'BigBadBot ne peut pas vérifier les rôles, les créneaux ou les inscrits pour le moment.',
      }
      throw createError({ statusCode: status, statusMessage: messages[status] })
    }

    if (isTeamStatisticsRequest && status === 503) {
      throw createError({
        statusCode: 503,
        statusMessage:
          remoteCode === 'team_statistics_not_configured'
            ? 'Les rôles d’équipe doivent être configurés dans BigBadBot.'
            : remoteCode === 'discord_unavailable'
              ? 'Discord ne permet pas de vérifier les rôles ou les effectifs pour le moment.'
              : 'Les statistiques BigBadBot sont temporairement indisponibles.',
      })
    }

    if ([400, 404, 409, 422].includes(status)) {
      throw createError({
        statusCode: status,
        statusMessage: isTeamStatisticsRequest
          ? status === 404
            ? 'Équipe non configurée ou inconnue.'
            : 'Année invalide.'
          : isAnimationEventRequest
            ? ANIMATION_EVENT_ERROR_MESSAGES[remoteCode] ||
              "BigBadBot a refusé l'événement. Vérifie les champs et son état."
            : isTrainingAnnouncementRequest
              ? TRAINING_ANNOUNCEMENT_ERROR_MESSAGES[remoteCode] ||
                "BigBadBot a refusé l'annonce. Vérifie les champs et son état."
              : 'Registration command rejected',
        data: remoteCode ? { code: remoteCode } : undefined,
      })
    }

    if (status === 403) {
      throw createError({
        statusCode: 403,
        statusMessage: isTeamStatisticsRequest
          ? 'Accès réservé aux coachs autorisés et aux administrateurs.'
          : isTrainingAnnouncementRequest || isAnimationEventRequest
            ? 'Ton compte Discord ne possède pas le rôle requis.'
            : 'Forbidden',
      })
    }

    return unavailable()
  }
}

export function createRegistrationRequestId() {
  return randomUUID()
}

function parseBridgeResponse<T>(parser: (value: unknown) => T, value: unknown) {
  try {
    return parser(value)
  } catch {
    return unavailable()
  }
}

function teamStatisticsQuery(event: H3Event, discordId: string, year?: number) {
  const query = new URLSearchParams({ discordId })
  if (isActiveCmsAdministrator(event, discordId)) query.set('cmsAdmin', 'true')
  if (year !== undefined) query.set('year', String(year))
  return query
}

export async function getTeamStatisticsAccess(event: H3Event, discordId: string) {
  const query = teamStatisticsQuery(event, discordId)
  const response = await bridgeRequest(
    event,
    'GET',
    `/v1/admin/team-statistics/access?${query}`,
    undefined,
    25_000,
  )
  return parseBridgeResponse(parseTeamStatisticsAccess, response)
}

export async function getTrainingRosterAccess(event: H3Event, discordId: string) {
  const query = new URLSearchParams({ discordId })
  // Aucun indicateur admin : le rôle Wolves est obligatoire pour tout le monde.
  const response = await bridgeRequest(
    event,
    'GET',
    `/v1/member/training-roster/access?${query}`,
    undefined,
    25_000,
  )
  return parseBridgeResponse(parseTrainingRosterAccess, response)
}

export async function getTrainingRoster(event: H3Event, discordId: string, sessionKey?: string) {
  const query = new URLSearchParams({ discordId })
  if (sessionKey !== undefined) query.set('sessionKey', sessionKey)
  const response = await bridgeRequest(
    event,
    'GET',
    `/v1/member/training-roster?${query}`,
    undefined,
    55_000,
  )
  return parseBridgeResponse(parseTrainingRosterResponse, response)
}

export async function getTeamStatisticsOverview(event: H3Event, discordId: string, year?: number) {
  const query = teamStatisticsQuery(event, discordId, year)
  const response = await bridgeRequest(
    event,
    'GET',
    `/v1/admin/team-statistics/overview?${query}`,
    undefined,
    TEAM_STATISTICS_REQUEST_TIMEOUT_MS,
  )
  return parseBridgeResponse(parseTeamStatisticsOverview, response)
}

export async function getTeamStatisticsDetail(
  event: H3Event,
  discordId: string,
  team: TeamStatisticsTeamKey,
  year?: number,
) {
  const query = teamStatisticsQuery(event, discordId, year)
  const response = await bridgeRequest(
    event,
    'GET',
    `/v1/admin/team-statistics/teams/${team}?${query}`,
    undefined,
    TEAM_STATISTICS_REQUEST_TIMEOUT_MS,
  )
  return parseBridgeResponse(parseTeamStatisticsDetail, response)
}

export async function getSelfRegistration(
  event: H3Event,
  discordId: string,
): Promise<MemberRegistrationResponse> {
  const query = new URLSearchParams({ discordId })

  const response = await bridgeRequest(event, 'GET', `/v1/self/registration?${query}`)

  return parseBridgeResponse(parseMemberRegistrationResponse, response)
}

export async function getMemberParticipationAccess(
  event: H3Event,
  discordId: string,
): Promise<MemberParticipationAccess> {
  const query = new URLSearchParams({ discordId })
  const response = await bridgeRequest(event, 'GET', `/v1/self/participations/access?${query}`)

  return parseBridgeResponse(parseMemberParticipationAccess, response)
}

export async function createSelfRegistrationCommand(
  event: H3Event,
  discordId: string,
  requestId: string,
  command: MemberRegistrationActionBody,
): Promise<MemberRegistrationCommandResponse> {
  const response = await bridgeRequest(event, 'POST', '/v1/self/commands', {
    requestId,
    discordId,
    action: command.action,
    sessionKey: command.sessionKey,
  })

  return parseBridgeResponse(parseRegistrationCommandResponse, response)
}

export async function getSelfRegistrationCommand(
  event: H3Event,
  discordId: string,
  requestId: string,
): Promise<MemberRegistrationCommandResponse> {
  const query = new URLSearchParams({ discordId })

  const response = await bridgeRequest(event, 'GET', `/v1/self/commands/${requestId}?${query}`)

  return parseBridgeResponse(parseRegistrationCommandResponse, response)
}

function trainingAnnouncementPath(id?: string) {
  const base = '/v1/admin/training-announcements'

  return id ? `${base}/${encodeURIComponent(id)}` : base
}

function actorQuery(discordId: string) {
  return new URLSearchParams({ discordId }).toString()
}

export async function getTrainingAnnouncementAccess(
  event: H3Event,
  discordId: string,
): Promise<TrainingAnnouncementAccess> {
  const path = `${trainingAnnouncementPath()}/access?${actorQuery(discordId)}`
  const response = await bridgeRequest(event, 'GET', path)

  return parseBridgeResponse(parseTrainingAnnouncementAccess, response)
}

export async function listTrainingAnnouncements(
  event: H3Event,
  discordId: string,
): Promise<TrainingAnnouncementListResponse> {
  const path = `${trainingAnnouncementPath()}?${actorQuery(discordId)}`
  const response = await bridgeRequest(event, 'GET', path)

  return parseBridgeResponse(parseTrainingAnnouncementListResponse, response)
}

export async function getTrainingAnnouncement(
  event: H3Event,
  discordId: string,
  announcementId: string,
): Promise<TrainingAnnouncementResponse> {
  const path = `${trainingAnnouncementPath(announcementId)}?${actorQuery(discordId)}`
  const response = await bridgeRequest(event, 'GET', path)

  return parseBridgeResponse(parseTrainingAnnouncementResponse, response)
}

export async function createTrainingAnnouncement(
  event: H3Event,
  discordId: string,
  request: TrainingAnnouncementCreateRequest,
): Promise<TrainingAnnouncementResponse> {
  const response = await bridgeRequest(event, 'POST', trainingAnnouncementPath(), {
    ...request,
    discordId,
  })

  return parseBridgeResponse(parseTrainingAnnouncementResponse, response)
}

export async function updateTrainingAnnouncement(
  event: H3Event,
  discordId: string,
  announcementId: string,
  request: TrainingAnnouncementUpdateRequest,
): Promise<TrainingAnnouncementResponse> {
  const response = await bridgeRequest(event, 'PUT', trainingAnnouncementPath(announcementId), {
    ...request,
    discordId,
  })

  return parseBridgeResponse(parseTrainingAnnouncementResponse, response)
}

export async function performTrainingAnnouncementAction(
  event: H3Event,
  discordId: string,
  announcementId: string,
  request: TrainingAnnouncementActionRequest,
): Promise<TrainingAnnouncementResponse> {
  const response = await bridgeRequest(
    event,
    'POST',
    `${trainingAnnouncementPath(announcementId)}/action`,
    {
      ...request,
      discordId,
    },
  )

  return parseBridgeResponse(parseTrainingAnnouncementResponse, response)
}

function animationEventPath(eventId?: string) {
  const base = '/v1/admin/animation-events'
  return eventId ? `${base}/${encodeURIComponent(eventId)}` : base
}

export async function listAnimationEvents(
  event: H3Event,
  discordId: string,
): Promise<AnimationEventListResponse> {
  const query = new URLSearchParams({ discordId })
  const response = await bridgeRequest(event, 'GET', `${animationEventPath()}?${query}`)
  return parseBridgeResponse(parseAnimationEventListResponse, response)
}

export async function syncAnimationEvents(
  event: H3Event,
  discordId: string,
): Promise<AnimationEventListResponse> {
  const response = await bridgeRequest(
    event,
    'POST',
    `${animationEventPath()}/sync`,
    { discordId },
    SYNC_REQUEST_TIMEOUT_MS,
  )
  return parseBridgeResponse(parseAnimationEventListResponse, response)
}

export async function getAnimationEvent(
  event: H3Event,
  discordId: string,
  eventId: string,
): Promise<AnimationEventResponse> {
  const query = new URLSearchParams({ discordId })
  const response = await bridgeRequest(event, 'GET', `${animationEventPath(eventId)}?${query}`)
  return parseBridgeResponse(parseAnimationEventResponse, response)
}

export async function previewAnimationEvent(
  event: H3Event,
  discordId: string,
  draft: AnimationEventDraft,
): Promise<AnimationEventPreviewResponse> {
  const response = await bridgeRequest(event, 'POST', `${animationEventPath()}/preview`, {
    discordId,
    event: draft,
  })
  return parseBridgeResponse(parseAnimationEventPreviewResponse, response)
}

export async function createAnimationEvent(
  event: H3Event,
  discordId: string,
  request: AnimationEventCreateRequest,
): Promise<AnimationEventResponse> {
  const response = await bridgeRequest(event, 'POST', animationEventPath(), {
    ...request,
    discordId,
  })
  return parseBridgeResponse(parseAnimationEventResponse, response)
}

export async function updateAnimationEvent(
  event: H3Event,
  discordId: string,
  eventId: string,
  request: AnimationEventUpdateRequest,
): Promise<AnimationEventResponse> {
  const response = await bridgeRequest(event, 'PUT', animationEventPath(eventId), {
    ...request,
    discordId,
  })
  return parseBridgeResponse(parseAnimationEventResponse, response)
}

export async function performAnimationEventAction(
  event: H3Event,
  discordId: string,
  eventId: string,
  request: AnimationEventActionRequest,
): Promise<AnimationEventResponse> {
  const response = await bridgeRequest(event, 'POST', `${animationEventPath(eventId)}/action`, {
    ...request,
    discordId,
  })
  return parseBridgeResponse(parseAnimationEventResponse, response)
}

export async function saveAnimationEventGroupConfig(
  event: H3Event,
  discordId: string,
  eventId: string,
  slotId: string,
  request: AnimationEventGroupConfigRequest,
): Promise<AnimationEventGroupConfigResponse> {
  const response = await bridgeRequest(
    event,
    'PUT',
    `${animationEventPath(eventId)}/slots/${encodeURIComponent(slotId)}/group-config`,
    { ...request, discordId },
  )
  return parseBridgeResponse(parseAnimationEventGroupConfigResponse, response)
}

export async function getAnimationEventParticipantAvatar(
  event: H3Event,
  discordId: string,
  participantKey: string,
): Promise<AnimationEventAvatarPayload> {
  const config = await bridgeConfig(event)
  const path = `${animationEventPath()}/participants/${encodeURIComponent(participantKey)}/avatar?${actorQuery(discordId)}`
  let response: Response

  try {
    response = await fetch(`${config.baseUrl}${path}`, {
      method: 'GET',
      headers: {
        ...createBridgeSignatureHeaders(config.secret, 'GET', path, ''),
        Accept: 'image/webp,image/png,image/jpeg,image/gif',
      },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch {
    return unavailable()
  }

  if (response.status === 403) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Ton compte Discord ne possède pas le rôle requis.',
    })
  }
  if (response.status === 404) {
    throw createError({ statusCode: 404, statusMessage: 'Avatar introuvable.' })
  }
  if (!response.ok) return unavailable()

  try {
    return await parseAnimationEventAvatarResponse(response)
  } catch {
    return unavailable()
  }
}
