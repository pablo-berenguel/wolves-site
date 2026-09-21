import type { H3Event } from 'h3'

import { describe, expect, it, vi } from 'vitest'

import type { MemberParticipationStatsProjection } from '../shared/types/participations'
import { getSelfParticipationDashboard } from '../server/utils/participations/self-dashboard'

const projection: MemberParticipationStatsProjection = {
  generatedAt: '2026-08-19T20:00:00.000Z',
  sourceUpdatedAt: '2026-08-19T19:55:00.000Z',
  period: {
    label: 'Saison 2026–2027',
    startDate: '2026-09-01',
    endDate: '2027-08-31',
  },
  stats: {
    summary: {
      registrations: 3,
      cancellations: 2,
      lateCancellations: 1,
      totalActiveWeeks: 2,
      clubActiveWeeks: 4,
      regularityPercent: 50,
    },
    timeSeries: {
      granularity: 'weekly',
      points: [{ periodStart: '2026-09-07', label: '7 sept.', registrations: 2 }],
    },
    breakdown: [{ key: 'open-gym', label: 'Open gym', registrations: 3 }],
    recent: [{ startsAt: '2026-09-07', label: 'Open gym', category: 'Open gym' }],
  },
}

describe('projection personnelle des participations', () => {
  it("interroge uniquement l'identifiant Discord issu de la session", async () => {
    const sessionDiscordId = '123456789012345678'
    const attackerDiscordId = '999999999999999999'
    const event = {
      node: { req: { url: `/api/member/participations?discordId=${attackerDiscordId}` } },
    } as unknown as H3Event
    const getAccess = vi.fn(async () => ({
      canAccess: true as const,
      reason: 'wolves_channel' as const,
    }))
    const getProjection = vi.fn(async () => projection)

    const response = await getSelfParticipationDashboard(event, {
      requireUser: async () => ({
        discordId: sessionDiscordId,
        username: 'member',
        displayName: 'Membre Wolves',
      }),
      getAccess,
      getProjection,
    })

    expect(getAccess).toHaveBeenCalledOnce()
    expect(getAccess).toHaveBeenCalledWith(sessionDiscordId)
    expect(getAccess).not.toHaveBeenCalledWith(attackerDiscordId)
    expect(getProjection).toHaveBeenCalledOnce()
    expect(getProjection).toHaveBeenCalledWith(sessionDiscordId)
    expect(getProjection).not.toHaveBeenCalledWith(attackerDiscordId)
    expect(response.stats.summary.registrations).toBe(3)
  })

  it("ne livre jamais l'identifiant Discord dans la réponse", async () => {
    const discordId = '123456789012345678'
    const response = await getSelfParticipationDashboard({} as H3Event, {
      requireUser: async () => ({
        discordId,
        username: 'member',
        displayName: null,
      }),
      getAccess: async () => ({ canAccess: true, reason: 'participation_record' }),
      getProjection: async () => projection,
    })

    expect(response.user).toEqual({
      username: 'member',
      displayName: null,
    })
    expect(JSON.stringify(response)).not.toContain(discordId)
  })

  it('refuse la projection si BigBadBot ne confirme ni salon Wolves ni historique', async () => {
    const discordId = '123456789012345678'
    const getProjection = vi.fn(async () => projection)

    await expect(
      getSelfParticipationDashboard({} as H3Event, {
        requireUser: async () => ({
          discordId,
          username: 'member',
          displayName: null,
        }),
        getAccess: async () => ({ canAccess: false, reason: null }),
        getProjection,
      }),
    ).rejects.toMatchObject({ statusCode: 403 })

    expect(getProjection).not.toHaveBeenCalled()
  })
})
