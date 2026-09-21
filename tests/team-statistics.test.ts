import type { H3Event } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { TEAM_STATISTICS_TEAMS } from '../shared/types/team-statistics'
import {
  parseTeamStatisticsAccess,
  parseTeamStatisticsDetail,
  parseTeamStatisticsOverview,
} from '../server/utils/registrations/team-statistics-protocol'
import {
  parseTeamStatisticsTeam,
  parseTeamStatisticsYear,
  withTeamStatisticsActor,
} from '../server/utils/participations/team-dashboard'
import { isActiveCmsAdministrator } from '../server/utils/cms-authorization'

// Les tests unitaires ne chargent pas le runtime Nitro (h3 est résolu par Nuxt).
vi.mock('h3', () => ({
  createError: (details: { statusCode: number; statusMessage: string }) =>
    Object.assign(new Error(details.statusMessage), details),
  getQuery: (event: H3Event) =>
    Object.fromEntries(new URL(event.node.req.url || '/', 'http://localhost').searchParams),
  setHeader: (event: H3Event, name: string, value: string) => event.node.res.setHeader(name, value),
}))

const privateDiscordId = '123456789012345678'
const metadata = {
  year: 2026,
  currentYear: 2026,
  availableYears: [2026, 2025],
  generatedAt: '2026-09-08T12:00:00Z',
  sourceUpdatedAt: '2026-09-07T18:00:00Z',
  rosterBasis: 'current_roles',
  historyStatus: 'available',
}
const summary = {
  key: 'penta',
  label: 'Pentagone',
  configured: true,
  canViewDetails: true,
  memberCount: 1,
  registeredMemberCount: 1,
  registrations: 2,
  cancellations: 1,
  lateCancellations: 1,
  activeWeeks: 1,
}

function overview() {
  return {
    ...metadata,
    discordId: privateDiscordId,
    teams: Object.entries(TEAM_STATISTICS_TEAMS).map(([key, label]) => ({
      ...summary,
      key,
      label,
      roleId: privateDiscordId,
      members: [{ discordId: privateDiscordId }],
    })),
  }
}

function detail() {
  return {
    ...metadata,
    team: summary,
    discordId: privateDiscordId,
    members: [
      {
        ...summary,
        key: `ts_${'a'.repeat(64)}`,
        displayName: 'Membre de test',
        username: 'membre',
        openGym: 2,
        workshop: 0,
        other: 0,
        discordId: privateDiscordId,
        roles: [privateDiscordId],
      },
    ],
    monthly: Array.from({ length: 12 }, (_, index) => ({
      month: `2026-${String(index + 1).padStart(2, '0')}`,
      registrations: index === 8 ? 2 : 0,
    })),
  }
}

describe('contrat privé des statistiques d’équipe', () => {
  it('ne transmet aucun membre ni identifiant Discord dans la vue globale', () => {
    const result = parseTeamStatisticsOverview(overview())
    expect(result.teams).toHaveLength(6)
    expect(result.teams[0]?.label).toBe('Pentagone')
    expect(JSON.stringify(result)).not.toContain(privateDiscordId)
    expect(JSON.stringify(result)).not.toContain('members')
    expect(JSON.stringify(result)).not.toContain('roleId')
  })

  it('ne conserve que noms affichés, clés opaques et compteurs dans le détail', () => {
    const result = parseTeamStatisticsDetail(detail())
    expect(result.members[0]?.displayName).toBe('Membre de test')
    expect(result.members[0]?.openGym).toBe(2)
    expect(result.monthly).toHaveLength(12)
    expect(JSON.stringify(result)).not.toContain(privateDiscordId)
    expect(result.members[0]).not.toHaveProperty('roles')
  })

  it('refuse une clé de membre qui serait un identifiant Discord brut', () => {
    const response = detail()
    response.members[0]!.key = privateDiscordId
    expect(() => parseTeamStatisticsDetail(response)).toThrow()
  })

  it('valide strictement les six équipes autorisées et leur unicité', () => {
    const response = overview()
    response.teams[0]!.key = 'unknown'
    expect(() => parseTeamStatisticsOverview(response)).toThrow()
    response.teams[0]!.key = 'poly'
    expect(() => parseTeamStatisticsOverview(response)).toThrow()
    expect(() => parseTeamStatisticsOverview({ ...overview(), teams: [] })).toThrow()
  })

  it('refuse les droits incohérents ou un détail marqué non autorisé', () => {
    expect(
      parseTeamStatisticsAccess({ canAccess: false, reason: null, detailTeamKeys: [] }),
    ).toEqual({ canAccess: false, reason: null, detailTeamKeys: [] })
    expect(() =>
      parseTeamStatisticsAccess({
        canAccess: false,
        reason: 'team_coach',
        detailTeamKeys: ['penta'],
      }),
    ).toThrow()
    expect(() =>
      parseTeamStatisticsAccess({ canAccess: true, reason: 'member', detailTeamKeys: [] }),
    ).toThrow()
    expect(() =>
      parseTeamStatisticsAccess({
        canAccess: true,
        reason: 'team_coach',
        detailTeamKeys: ['penta', 'penta'],
      }),
    ).toThrow()
    expect(() =>
      parseTeamStatisticsDetail({ ...detail(), team: { ...summary, canViewDetails: false } }),
    ).toThrow()
    expect(() =>
      parseTeamStatisticsDetail({ ...detail(), team: { ...summary, configured: false } }),
    ).toThrow()
  })

  it('conserve le statut historique inconnu au lieu de prétendre à une absence d’activité', () => {
    const result = parseTeamStatisticsOverview({ ...overview(), historyStatus: 'empty' })
    expect(result.historyStatus).toBe('empty')
    expect(result.rosterBasis).toBe('current_roles')
  })

  it('refuse compteurs négatifs, annulations tardives incohérentes et mauvais mois', () => {
    const response = detail()
    response.members[0]!.registrations = -1
    expect(() => parseTeamStatisticsDetail(response)).toThrow()
    response.members[0]!.registrations = 2
    response.members[0]!.lateCancellations = 2
    expect(() => parseTeamStatisticsDetail(response)).toThrow()
    response.members[0]!.lateCancellations = 1
    response.monthly[0]!.month = '2025-12'
    expect(() => parseTeamStatisticsDetail(response)).toThrow()
  })

  it('refuse une année absente des choix ou postérieure à l’année du serveur', () => {
    expect(() => parseTeamStatisticsOverview({ ...overview(), year: 2027 })).toThrow()
    expect(() => parseTeamStatisticsOverview({ ...overview(), availableYears: [2025] })).toThrow()
    expect(() => parseTeamStatisticsOverview({ ...overview(), generatedAt: 'inconnue' })).toThrow()
    expect(() =>
      parseTeamStatisticsOverview({ ...overview(), sourceUpdatedAt: '2026-09-08T12:00:00' }),
    ).toThrow()
  })
})

describe('requêtes de statistiques', () => {
  it('laisse BigBadBot déterminer l’année courante, jamais le navigateur', () => {
    expect(parseTeamStatisticsYear(undefined)).toBeUndefined()
    expect(parseTeamStatisticsYear('2025')).toBe(2025)
    for (const value of ['', '2025-2026', '2025.0', ['2025'], '1999', '2101', 2025]) {
      expect(() => parseTeamStatisticsYear(value)).toThrow()
    }
  })

  it('refuse les équipes et chemins arbitraires', () => {
    expect(parseTeamStatisticsTeam('octolady')).toBe('octolady')
    for (const value of ['__proto__', '../penta', privateDiscordId, 'Penta', ['penta']]) {
      expect(() => parseTeamStatisticsTeam(value)).toThrow()
    }
  })

  it('ignore toute usurpation d’identité et de privilège dans la query publique', async () => {
    const event = {
      node: {
        req: {
          url: '/api/admin/team-statistics?discordId=999999999999999999&cmsAdmin=true&year=2025',
        },
        res: { setHeader: vi.fn() },
      },
    } as unknown as H3Event
    const read = vi.fn(async () => overview())
    await withTeamStatisticsActor(
      event,
      async () => ({
        discordId: privateDiscordId,
        username: 'member',
        displayName: null,
      }),
      read,
    )
    expect(read).toHaveBeenCalledExactlyOnceWith(privateDiscordId, 2025)
    expect(event.node.res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
    expect(event.node.res.setHeader).toHaveBeenCalledWith('Vary', 'Cookie')
  })

  it('ne consulte pas le bridge si la session est refusée', async () => {
    const event = { node: { req: { url: '/' }, res: { setHeader: vi.fn() } } } as unknown as H3Event
    const read = vi.fn()
    await expect(
      withTeamStatisticsActor(
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

const cms = vi.hoisted(() => ({
  findCmsUserByDiscordId: vi.fn(),
  getCmsUserAuthorization: vi.fn(),
}))
vi.mock('../server/utils/cms/repository', () => cms)

describe('assertion administrateur pour le bridge signé', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetAllMocks()
  })

  it('revalide un admin actif en base, sans croire un rôle stocké dans la session', () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ cmsSuperAdminDiscordId: '' }))
    cms.findCmsUserByDiscordId.mockReturnValue({ id: 'cms-user', isActive: true })
    cms.getCmsUserAuthorization.mockReturnValue({
      discordId: privateDiscordId,
      isActive: true,
      role: 'admin',
    })
    expect(isActiveCmsAdministrator({} as H3Event, privateDiscordId)).toBe(true)
    cms.getCmsUserAuthorization.mockReturnValue({
      discordId: privateDiscordId,
      isActive: false,
      role: 'admin',
    })
    expect(isActiveCmsAdministrator({} as H3Event, privateDiscordId)).toBe(false)
  })

  it('refuse éditeur, ancien super_admin non configuré, compte désactivé et autre identité', () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ cmsSuperAdminDiscordId: '' }))
    cms.findCmsUserByDiscordId.mockReturnValue({ id: 'cms-user', isActive: true })
    for (const role of ['editor', 'super_admin']) {
      cms.getCmsUserAuthorization.mockReturnValue({
        discordId: privateDiscordId,
        isActive: true,
        role,
      })
      expect(isActiveCmsAdministrator({} as H3Event, privateDiscordId)).toBe(false)
    }
    cms.getCmsUserAuthorization.mockReturnValue({
      discordId: '999999999999999999',
      isActive: true,
      role: 'admin',
    })
    expect(isActiveCmsAdministrator({} as H3Event, privateDiscordId)).toBe(false)
    cms.findCmsUserByDiscordId.mockReturnValue({ id: 'cms-user', isActive: false })
    expect(isActiveCmsAdministrator({} as H3Event, privateDiscordId)).toBe(false)
  })

  it('reconnaît uniquement le super administrateur privé configuré', () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ cmsSuperAdminDiscordId: privateDiscordId }))
    expect(isActiveCmsAdministrator({} as H3Event, privateDiscordId)).toBe(true)
    expect(isActiveCmsAdministrator({} as H3Event, '999999999999999999')).toBe(false)
  })
})
