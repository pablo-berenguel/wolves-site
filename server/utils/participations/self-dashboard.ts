import type { H3Event } from 'h3'

import type {
  MemberParticipationAccess,
  MemberParticipationsResponse,
  MemberParticipationStatsProjection,
} from '../../../shared/types/participations'

export interface AuthenticatedDiscordPrincipal {
  discordId: string
  username: string
  displayName: string | null
}

interface SelfParticipationDependencies {
  requireUser: (event: H3Event) => Promise<AuthenticatedDiscordPrincipal>
  getAccess: (discordId: string) => Promise<MemberParticipationAccess>
  getProjection: (discordId: string) => Promise<MemberParticipationStatsProjection>
}

function forbidden(): never {
  throw Object.assign(new Error('Wolves member access required'), {
    statusCode: 403,
    statusMessage: 'Wolves member access required',
  })
}

/**
 * Le cas d'usage n'accepte volontairement aucun identifiant utilisateur en
 * entrée. L'identité interrogée provient toujours de la session validée par
 * le serveur.
 */
export async function getSelfParticipationDashboard(
  event: H3Event,
  dependencies: SelfParticipationDependencies,
): Promise<MemberParticipationsResponse> {
  const user = await dependencies.requireUser(event)
  const access = await dependencies.getAccess(user.discordId)

  if (!access.canAccess) return forbidden()

  const projection = await dependencies.getProjection(user.discordId)

  return {
    ...projection,
    user: {
      displayName: user.displayName,
      username: user.username,
    },
  }
}
