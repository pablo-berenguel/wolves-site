import type { H3Event } from 'h3'
import { describe, expect, it, vi } from 'vitest'

import {
  parseTrainingRosterAccess,
  parseTrainingRosterResponse,
} from '../server/utils/registrations/training-roster-protocol'
import {
  parseTrainingRosterSelection,
  withTrainingRosterActor,
} from '../server/utils/participations/training-roster'

vi.mock('h3', () => ({
  createError: (details: { statusCode: number; statusMessage: string }) =>
    Object.assign(new Error(details.statusMessage), details),
  getQuery: (event: H3Event) =>
    Object.fromEntries(new URL(event.node.req.url || '/', 'http://localhost').searchParams),
  setHeader: (event: H3Event, name: string, value: string) => event.node.res.setHeader(name, value),
}))

const sessionKey = 'abcdefgh12345678ABCDEFGH'
const otherSessionKey = 'ABCDEFGH12345678abcdefgh'
const discordId = '123456789012345678'

function roster() {
  return {
    generatedAt: '2026-09-08T12:00:00Z',
    announcement: {
      title: 'Entraînements de la semaine',
      weekLabel: 'Semaine 37',
      publishedAt: '2026-09-06T18:00:00Z',
      discordMessageId: discordId,
      sessions: [
        {
          key: sessionKey,
          emoji: '🔥',
          label: 'Open Gym',
          details: 'Travail libre',
          startsAt: '2026-09-08T18:00:00Z',
          endsAt: '2026-09-08T20:00:00Z',
          capacity: 40,
          state: 'upcoming',
          discordMessageId: discordId,
        },
      ],
    },
    selectedSessionKey: sessionKey,
    selectionReason: 'next',
    participants: [
      {
        key: `tr_${'a'.repeat(64)}`,
        displayName: 'Membre test',
        username: 'membre.test',
        teamKeys: ['penta', 'hexa'],
        isFlyer: true as boolean | null,
        profileAvailable: true,
        discordId,
        roleIds: [discordId],
        registrations: 120,
      },
    ],
    discordId,
  }
}

describe('contrat des créneaux Wolves', () => {
  it('ne valide que l’accès Wolves, pas une qualité de coach ou d’admin', () => {
    expect(
      parseTrainingRosterAccess({ canAccess: true, reason: 'wolves_role', roleId: discordId }),
    ).toEqual({ canAccess: true, reason: 'wolves_role' })
    for (const reason of ['super_admin', 'admin', 'head_coach', 'missing_wolves_role']) {
      expect(() => parseTrainingRosterAccess({ canAccess: true, reason })).toThrow()
    }
    for (const reason of ['missing_wolves_role', 'not_guild_member', 'channel_forbidden']) {
      expect(parseTrainingRosterAccess({ canAccess: false, reason })).toEqual({
        canAccess: false,
        reason,
      })
    }
    expect(() => parseTrainingRosterAccess({ canAccess: false, reason: 'wolves_role' })).toThrow()
  })

  it('conserve seulement les informations nécessaires du créneau sélectionné', () => {
    const result = parseTrainingRosterResponse(roster())
    expect(result.participants[0]).toEqual({
      key: `tr_${'a'.repeat(64)}`,
      displayName: 'Membre test',
      username: 'membre.test',
      teamKeys: ['penta', 'hexa'],
      isFlyer: true,
      profileAvailable: true,
    })
    expect(result.selectedSessionKey).toBe(sessionKey)
    expect(JSON.stringify(result)).not.toContain(discordId)
    expect(result.participants[0]).not.toHaveProperty('registrations')
    expect(result.announcement).not.toHaveProperty('discordMessageId')
  })

  it('distingue un non-flyer d’un profil dont les rôles sont inconnus', () => {
    const response = roster()
    response.participants[0]!.isFlyer = false
    expect(parseTrainingRosterResponse(response).participants[0]?.isFlyer).toBe(false)
    response.participants[0]!.profileAvailable = false
    response.participants[0]!.isFlyer = null
    response.participants[0]!.teamKeys = []
    expect(parseTrainingRosterResponse(response).participants[0]?.isFlyer).toBeNull()
    response.participants[0]!.isFlyer = false
    expect(() => parseTrainingRosterResponse(response)).toThrow()
  })

  it('interdit des équipes ou un état Flyer périmés pour un profil indisponible', () => {
    const response = roster()
    response.participants[0]!.profileAvailable = false
    response.participants[0]!.isFlyer = null
    expect(() => parseTrainingRosterResponse(response)).toThrow()
    response.participants[0]!.profileAvailable = true
    expect(() => parseTrainingRosterResponse(response)).toThrow()
  })

  it('refuse les rôles Rentrée, clés non opaques et doublons', () => {
    const response = roster()
    response.participants[0]!.teamKeys = ['rentree_penta']
    expect(() => parseTrainingRosterResponse(response)).toThrow()
    response.participants[0]!.teamKeys = ['penta', 'penta']
    expect(() => parseTrainingRosterResponse(response)).toThrow()
    response.participants[0]!.teamKeys = ['penta']
    response.participants[0]!.key = discordId
    expect(() => parseTrainingRosterResponse(response)).toThrow()
    response.participants[0]!.key = `tr_${'a'.repeat(64)}`
    response.participants.push({ ...response.participants[0]! })
    expect(() => parseTrainingRosterResponse(response)).toThrow()
  })

  it('refuse un créneau ne faisant pas partie de la dernière annonce', () => {
    expect(() =>
      parseTrainingRosterResponse({ ...roster(), selectedSessionKey: otherSessionKey }),
    ).toThrow()
    expect(() =>
      parseTrainingRosterResponse({ ...roster(), selectedSessionKey: discordId }),
    ).toThrow()
    expect(() =>
      parseTrainingRosterResponse({ ...roster(), selectionReason: 'arbitrary' }),
    ).toThrow()
  })

  it('refuse les doublons de créneaux et une annonce non vide sans créneau', () => {
    const response = roster()
    response.announcement.sessions.push({ ...response.announcement.sessions[0]! })
    expect(() => parseTrainingRosterResponse(response)).toThrow()
    response.announcement.sessions = []
    expect(() => parseTrainingRosterResponse(response)).toThrow()
  })

  it('accepte une liste vide et une annonce absente sans données personnelles', () => {
    expect(parseTrainingRosterResponse({ ...roster(), participants: [] }).participants).toEqual([])
    const empty = {
      ...roster(),
      announcement: null,
      selectedSessionKey: null,
      selectionReason: null,
      participants: [],
    }
    expect(parseTrainingRosterResponse(empty).announcement).toBeNull()
    expect(() =>
      parseTrainingRosterResponse({ ...empty, participants: roster().participants }),
    ).toThrow()
    expect(() =>
      parseTrainingRosterResponse({ ...empty, selectedSessionKey: sessionKey }),
    ).toThrow()
  })

  it('accepte les anciens créneaux explicitement signalés après la fin de l’annonce', () => {
    const response = roster()
    response.announcement.sessions[0]!.state = 'past'
    response.selectionReason = 'latest_past'
    expect(parseTrainingRosterResponse(response).selectionReason).toBe('latest_past')
  })

  it('refuse les heures sans fuseau et les fins antérieures au début', () => {
    const response = roster()
    response.generatedAt = '2026-09-08T12:00:00'
    expect(() => parseTrainingRosterResponse(response)).toThrow()
    response.generatedAt = '2026-09-08T12:00:00Z'
    response.announcement.sessions[0]!.endsAt = '2026-09-08T17:00:00Z'
    expect(() => parseTrainingRosterResponse(response)).toThrow()
  })
})

describe('accès serveur au roster', () => {
  it('protège aussi le HTML SSR et ses sous-routes, pas seulement l’API', async () => {
    vi.stubGlobal('defineNuxtConfig', (config: unknown) => config)
    try {
      const { default: config } = await import('../nuxt.config')
      for (const path of ['/creneaux', '/creneaux/**']) {
        expect(config.routeRules?.[path]?.headers).toMatchObject({
          'Cache-Control': 'private, no-store',
          'Content-Security-Policy': "frame-ancestors 'none'",
          'X-Frame-Options': 'DENY',
          'X-Robots-Tag': 'noindex, nofollow, noarchive',
        })
      }
      expect(config.nitro?.prerender?.routes).not.toContain('/creneaux')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('laisse le serveur choisir le prochain créneau si aucun n’est demandé', () => {
    expect(parseTrainingRosterSelection(undefined)).toBeUndefined()
    expect(parseTrainingRosterSelection(sessionKey)).toBe(sessionKey)
    for (const value of ['', [sessionKey], discordId, '../../private', 'x'.repeat(25)]) {
      expect(() => parseTrainingRosterSelection(value)).toThrow()
    }
  })

  it('ignore les identités, rôles et privilèges transmis par le client', async () => {
    const event = {
      node: {
        req: {
          url: `/api/member/training-roster?discordId=999999999999999999&cmsAdmin=true&role=Wolves&sessionKey=${sessionKey}`,
        },
        res: { setHeader: vi.fn() },
      },
    } as unknown as H3Event
    const read = vi.fn(async () => roster())
    await withTrainingRosterActor(
      event,
      async () => ({ discordId, username: 'membre', displayName: null }),
      read,
    )
    expect(read).toHaveBeenCalledExactlyOnceWith(discordId, sessionKey)
    expect(event.node.res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
    expect(event.node.res.setHeader).toHaveBeenCalledWith('Vary', 'Cookie')
  })

  it('ne charge aucun participant avant l’authentification', async () => {
    const event = { node: { req: { url: '/' }, res: { setHeader: vi.fn() } } } as unknown as H3Event
    const read = vi.fn()
    await expect(
      withTrainingRosterActor(
        event,
        async () => {
          throw new Error('Unauthorized')
        },
        read,
      ),
    ).rejects.toThrow('Unauthorized')
    expect(read).not.toHaveBeenCalled()
  })
})
