import { describe, expect, it } from 'vitest'

import { parseCmsMediaRouteParams } from '../server/utils/cms-media-route'

describe('route des médias CMS', () => {
  const mediaId = `media-${'a'.repeat(32)}`
  const checksum = 'b'.repeat(64)

  it('reconnaît le nom de fichier versionné produit après un téléversement', () => {
    expect(parseCmsMediaRouteParams(mediaId, `master-${checksum}.webp`)).toEqual({
      mediaId,
      preset: 'master',
      checksum,
    })
  })

  it.each([
    ['', `master-${checksum}.webp`],
    [mediaId, `master-${checksum}`],
    [mediaId, `unknown-${checksum}.webp`],
    [mediaId, `master-${'g'.repeat(64)}.webp`],
    [mediaId, `master-${checksum}.webp/../../secret`],
  ])('refuse les paramètres invalides', (id, filename) => {
    expect(parseCmsMediaRouteParams(id, filename)).toBeNull()
  })
})
