import { createHash, createHmac } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { mapBridgeServiceUnavailable } from '../server/utils/registrations/bridge-errors'

import {
  createBridgeSignatureHeaders,
  parseMemberParticipationAccess,
  parseMemberRegistrationResponse,
  parseRegistrationCommandResponse,
} from '../server/utils/registrations/protocol'

describe('bridge privé BigBadBot', () => {
  it('signe la méthode, le chemin complet et le corps avec le contrat HMAC v1', () => {
    const secret = 'bridge-contract-secret-0123456789abcdef'
    const timestamp = '1787184000'
    const method = 'POST'
    const path = '/v1/self/commands?source=website'
    const body = '{"requestId":"test"}'
    const bodyHash = createHash('sha256').update(body).digest('hex')
    const expected = createHmac('sha256', secret)
      .update(`${timestamp}\n${method}\n${path}\n${bodyHash}`)
      .digest('hex')

    const headers = createBridgeSignatureHeaders(secret, method, path, body, timestamp)

    expect(headers).toEqual({
      'Content-Type': 'application/json',
      'X-Wolves-Key-Id': 'v1',
      'X-Wolves-Timestamp': timestamp,
      'X-Wolves-Signature': expected,
    })
    expect(headers['X-Wolves-Signature']).toBe(
      '75360d6a13456f412ad25a7cb7516a2294a8d98bd76eb258514b0c42efc12dba',
    )
  })

  it('valide une décision minimale d’accès aux participations', () => {
    expect(
      parseMemberParticipationAccess({
        canAccess: true,
        reason: 'wolves_channel',
        discordId: '123456789012345678',
        channelId: '987654321098765432',
      }),
    ).toEqual({ canAccess: true, reason: 'wolves_channel' })

    expect(parseMemberParticipationAccess({ canAccess: false, reason: null })).toEqual({
      canAccess: false,
      reason: null,
    })
    expect(() =>
      parseMemberParticipationAccess({ canAccess: false, reason: 'participation_record' }),
    ).toThrow()
  })

  it('construit une réponse en liste blanche sans recopier un identifiant membre', () => {
    const discordId = '123456789012345678'
    const response = parseMemberRegistrationResponse({
      discordId,
      generatedAt: '2026-08-20T12:00:00Z',
      eligible: true,
      denialReason: null,
      announcement: {
        id: 'discord-message-id-not-needed-by-the-browser',
        title: 'Entraînements semaine 35',
        weekLabel: 'Semaine 35',
        createdAt: '2026-08-20T10:00:00Z',
        discordUrl: 'https://discord.com/channels/1/2/3',
        sessions: [
          {
            sessionKey: 'opaque:session:1',
            emoji: '🐺',
            label: 'Open Gym',
            details: 'Travail libre sur le praticable.',
            startsAt: '2026-08-22T18:00:00+02:00',
            endsAt: '2026-08-22T20:00:00+02:00',
            capacity: 20,
            registeredCount: 18,
            remaining: 2,
            isFull: false,
            isRegistered: false,
            registrationMethod: null,
            isEligible: true,
            eligibilityReason: null,
            alertEnabled: false,
            discordUrl: null,
            discordId,
          },
        ],
      },
    })

    expect(response.announcement?.sessions[0]?.sessionKey).toBe('opaque:session:1')
    expect(response.announcement?.sessions[0]?.details).toBe('Travail libre sur le praticable.')
    expect(JSON.stringify(response)).not.toContain(discordId)
    expect(JSON.stringify(response)).not.toContain('discord-message-id')
  })

  it('refuse un lien sortant qui ne pointe pas vers Discord', () => {
    expect(() =>
      parseMemberRegistrationResponse({
        generatedAt: '2026-08-20T12:00:00Z',
        eligible: true,
        denialReason: null,
        announcement: {
          title: 'Entraînements',
          weekLabel: 'Cette semaine',
          createdAt: '2026-08-20T10:00:00Z',
          discordUrl: 'javascript:alert(1)',
          sessions: [],
        },
      }),
    ).toThrow()
  })

  it('accepte un compteur Discord historique supérieur à la capacité', () => {
    const response = parseMemberRegistrationResponse({
      generatedAt: '2026-08-20T12:00:00Z',
      eligible: true,
      denialReason: null,
      announcement: {
        title: 'Entraînements',
        weekLabel: 'Cette semaine',
        createdAt: '2026-08-20T10:00:00Z',
        discordUrl: null,
        sessions: [
          {
            sessionKey: 'legacy:over-capacity',
            emoji: '🐺',
            label: 'Open Gym',
            startsAt: null,
            endsAt: null,
            capacity: 20,
            registeredCount: 22,
            remaining: 0,
            isFull: true,
            isRegistered: false,
            registrationMethod: null,
            isEligible: true,
            eligibilityReason: null,
            alertEnabled: false,
            discordUrl: null,
          },
        ],
      },
    })

    expect(response.announcement?.sessions[0]?.registeredCount).toBe(22)
    expect(response.announcement?.sessions[0]?.details).toBe('')
  })

  it('refuse un détail de créneau supérieur à 500 caractères', () => {
    expect(() =>
      parseMemberRegistrationResponse({
        generatedAt: '2026-08-20T12:00:00Z',
        eligible: true,
        denialReason: null,
        announcement: {
          title: 'Entraînements',
          weekLabel: 'Cette semaine',
          createdAt: '2026-08-20T10:00:00Z',
          discordUrl: null,
          sessions: [
            {
              sessionKey: 'opaque:session:details',
              emoji: '🐺',
              label: 'Open Gym',
              details: 'x'.repeat(501),
              startsAt: null,
              endsAt: null,
              capacity: 20,
              registeredCount: 0,
              remaining: 20,
              isFull: false,
              isRegistered: false,
              registrationMethod: null,
              isEligible: true,
              eligibilityReason: null,
              alertEnabled: false,
              discordUrl: null,
            },
          ],
        },
      }),
    ).toThrow()
  })

  it('valide et réduit la réponse asynchrone d’une commande', () => {
    expect(
      parseRegistrationCommandResponse({
        requestId: 'de305d54-75b4-431b-adb2-eb6b9e546014',
        status: 'rejected',
        code: 'full',
        discordId: '123456789012345678',
      }),
    ).toEqual({
      requestId: 'de305d54-75b4-431b-adb2-eb6b9e546014',
      status: 'rejected',
      code: 'full',
    })
  })

  it.each([
    {
      path: '/v1/admin/training-announcements/de305d54-75b4-431b-adb2-eb6b9e546014',
      message:
        'La mise à jour Discord n’a pas pu être confirmée. Recharge l’annonce puis réessaie avec la même modification.',
    },
    {
      path: '/v1/admin/animation-events/de305d54-75b4-431b-adb2-eb6b9e546014',
      message:
        'La mise à jour Discord n’a pas pu être confirmée. Recharge l’événement puis réessaie avec la même modification.',
    },
  ])('conserve le 503 Discord allowlisté et son code privé', ({ path, message }) => {
    expect(mapBridgeServiceUnavailable(path, 503, 'discord_unavailable')).toEqual({
      statusCode: 503,
      statusMessage: message,
      data: { code: 'discord_unavailable' },
    })
  })

  it('ne transforme pas un autre 503 BigBadBot en erreur métier allowlistée', () => {
    expect(
      mapBridgeServiceUnavailable(
        '/v1/admin/training-announcements/de305d54-75b4-431b-adb2-eb6b9e546014',
        503,
        'capacity_below_participants',
      ),
    ).toBeNull()
  })
})
