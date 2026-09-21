import { describe, expect, it } from 'vitest'

import {
  MATOMO_OPT_OUT_COOKIE,
  MATOMO_OPT_OUT_MAX_AGE_DAYS,
  classifyMatomoLink,
  getLegacyAnalyticsCookieExpiryValues,
  getNewMatomoScrollThresholds,
  hasMatomoOptOutCookie,
  matomoOptOutCookieValue,
  normalizeMatomoSiteId,
  normalizeMatomoUrl,
  sanitizeMatomoReferrer,
  shouldTrackAnalyticsPath,
} from '../app/utils/matomo'

describe('configuration Matomo', () => {
  it('normalise uniquement une origine HTTPS sans donnée annexe', () => {
    expect(normalizeMatomoUrl(' https://analytics.example.test ')).toBe(
      'https://analytics.example.test/',
    )
    expect(normalizeMatomoUrl('https://analytics.example.test/matomo')).toBe(
      'https://analytics.example.test/matomo/',
    )
    expect(normalizeMatomoUrl('http://localhost:8080')).toBe('http://localhost:8080/')
    expect(normalizeMatomoUrl('http://127.0.0.1:8080/test')).toBe('http://127.0.0.1:8080/test/')

    expect(normalizeMatomoUrl('http://analytics.example.test')).toBeNull()
    expect(normalizeMatomoUrl('https://user:secret@analytics.example.test')).toBeNull()
    expect(normalizeMatomoUrl('https://analytics.example.test?site=1')).toBeNull()
    expect(normalizeMatomoUrl('https://analytics.example.test/#admin')).toBeNull()
    expect(normalizeMatomoUrl('ftp://analytics.example.test')).toBeNull()
    expect(normalizeMatomoUrl(undefined)).toBeNull()
  })

  it('accepte uniquement un identifiant de site strictement positif', () => {
    expect(normalizeMatomoSiteId(' 1 ')).toBe('1')
    expect(normalizeMatomoSiteId(42)).toBe('42')
    expect(normalizeMatomoSiteId('0')).toBeNull()
    expect(normalizeMatomoSiteId('-1')).toBeNull()
    expect(normalizeMatomoSiteId('1.5')).toBeNull()
    expect(normalizeMatomoSiteId('wolves')).toBeNull()
  })

  it.each([
    '/admin',
    '/admin/evenements?tab=planning',
    '/admin/statistiques?year=2025',
    '/admin/statistiques/penta?year=2026',
    '/auth/discord',
    '/inscriptions',
    '/mes-participations#historique',
    '/creneaux',
    '/creneaux?sessionKey=private-session',
  ])('exclut la route privée %s', (path) => {
    expect(shouldTrackAnalyticsPath(path)).toBe(false)
  })

  it.each(['/', '/animations', '/contact?source=menu'])('autorise la route publique %s', (path) => {
    expect(shouldTrackAnalyticsPath(path)).toBe(true)
  })

  it('réduit le référent à son origine', () => {
    expect(sanitizeMatomoReferrer('https://example.com/path?member=42#details')).toBe(
      'https://example.com',
    )
    expect(sanitizeMatomoReferrer('http://localhost:3000/private?token=secret')).toBe(
      'http://localhost:3000',
    )
    expect(sanitizeMatomoReferrer('https://user:secret@example.com/path')).toBe('')
    expect(sanitizeMatomoReferrer('javascript:alert(1)')).toBe('')
    expect(sanitizeMatomoReferrer('')).toBe('')
  })

  it('classe les clics sans envoyer de coordonnées ni de paramètres', () => {
    const origin = 'https://www.wolvestoulousecheerleading.fr'

    expect(classifyMatomoLink('/equipes?member=42#bio', origin)).toEqual({
      action: 'Lien interne',
      name: '/equipes',
    })
    expect(classifyMatomoLink('https://discord.com/invite/secret?ref=member', origin)).toEqual({
      action: 'Lien externe',
      name: 'discord.com',
    })
    expect(classifyMatomoLink('mailto:personne@example.test', origin)).toEqual({
      action: 'Contact',
      name: 'E-mail',
    })
    expect(classifyMatomoLink('tel:+33123456789', origin)).toEqual({
      action: 'Contact',
      name: 'Téléphone',
    })
    expect(classifyMatomoLink('/media/dossier-personnel.pdf?token=secret', origin)).toEqual({
      action: 'Téléchargement',
      name: 'PDF',
    })
    expect(classifyMatomoLink('/admin', origin)).toBeNull()
    expect(classifyMatomoLink('#section-privee', origin)).toBeNull()
    expect(classifyMatomoLink('javascript:alert(1)', origin)).toBeNull()
  })

  it('ne rapporte chaque seuil de lecture qu’une seule fois', () => {
    expect(getNewMatomoScrollThresholds(74, 0)).toEqual([25, 50])
    expect(getNewMatomoScrollThresholds(100, 50)).toEqual([75, 100])
    expect(getNewMatomoScrollThresholds(30, 50)).toEqual([])
  })

  it('supprime temporairement les anciens cookies GA et tarteaucitron', () => {
    const expiryValues = getLegacyAnalyticsCookieExpiryValues(
      'session=ok; _ga=legacy; _ga_ABC=legacy; tarteaucitron=legacy',
      'www.wolvestoulousecheerleading.fr',
      true,
      Date.parse('2026-09-03T00:00:00Z'),
    )

    expect(expiryValues).toHaveLength(9)
    expect(expiryValues).toContain(
      '_ga=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Secure',
    )
    expect(expiryValues).toContain(
      '_ga_ABC=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Domain=wolvestoulousecheerleading.fr; SameSite=Lax; Secure',
    )
    expect(expiryValues.some((value) => value.startsWith('session='))).toBe(false)
    expect(
      getLegacyAnalyticsCookieExpiryValues(
        '_ga=legacy',
        'www.wolvestoulousecheerleading.fr',
        true,
        Date.parse('2027-03-03T00:00:00Z'),
      ),
    ).toEqual([])
  })

  it('reconnaît uniquement le cookie d’opposition actif', () => {
    expect(hasMatomoOptOutCookie(`${MATOMO_OPT_OUT_COOKIE}=1`)).toBe(true)
    expect(hasMatomoOptOutCookie(`session=x; ${MATOMO_OPT_OUT_COOKIE}=1; theme=dark`)).toBe(true)
    expect(hasMatomoOptOutCookie(`${MATOMO_OPT_OUT_COOKIE}=0`)).toBe(false)
    expect(hasMatomoOptOutCookie('')).toBe(false)
  })

  it('borne la mémorisation de l’opposition à 180 jours', () => {
    expect(MATOMO_OPT_OUT_MAX_AGE_DAYS).toBe(180)
    expect(matomoOptOutCookieValue(true, true)).toBe(
      `${MATOMO_OPT_OUT_COOKIE}=1; Path=/; SameSite=Lax; Max-Age=15552000; Secure`,
    )
    expect(matomoOptOutCookieValue(false, false)).toBe(
      `${MATOMO_OPT_OUT_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`,
    )
  })
})
