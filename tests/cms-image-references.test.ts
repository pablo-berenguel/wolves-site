import type BetterSqlite3 from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'

import {
  getManagedCmsImageUrl,
  validateCmsPageImageReferences,
} from '../server/utils/cms-image-references'
import { openCmsDatabase } from '../server/utils/cms/database'
import { createCmsRepository } from '../server/utils/cms/repository'

const databases: BetterSqlite3.Database[] = []

function memoryRepository() {
  const { database } = openCmsDatabase({ filename: ':memory:' })
  databases.push(database)
  return createCmsRepository(database)
}

afterEach(() => {
  for (const database of databases.splice(0)) {
    if (database.open) database.close()
  }
})

describe('références des images CMS', () => {
  it('accepte toutes les images bundled du seed, y compris les listes imbriquées', () => {
    const repository = memoryRepository()

    for (const summary of repository.listCmsPages()) {
      const page = repository.getDraftPageById(summary.id)
      expect(page).not.toBeNull()
      expect(validateCmsPageImageReferences(page!, repository), summary.path).toEqual([])
    }
  })

  it('refuse un src qui ne correspond pas au originalPath du média bundled', () => {
    const repository = memoryRepository()
    const page = structuredClone(repository.getDraftPageByPath('/equipes'))
    if (!page) throw new Error('Page équipes absente du seed.')

    const teamGrid = page.blocks.find((block) => block.type === 'team_grid')
    if (!teamGrid || teamGrid.type !== 'team_grid') {
      throw new Error('Grille des équipes absente du seed.')
    }
    teamGrid.data.teams[0]!.image.src = '/images/home-team.webp'

    expect(validateCmsPageImageReferences(page, repository)).toContainEqual({
      path: 'blocks.1.data.teams.0.image.src',
      message: 'L’URL ne correspond pas au fichier intégré de ce média.',
    })
  })

  it('exige l’URL exacte et une variante WebP correspondant au preset du champ', () => {
    const repository = memoryRepository()
    const media = repository.createCmsMedia({
      id: 'media-cccccccccccccccccccccccccccccccc',
      storageKind: 'managed',
      originalPath: 'cc/master.webp',
      originalFilename: 'photo.webp',
      mimeType: 'image/webp',
    })
    repository.upsertCmsMediaVariant({
      id: 'variant-managed-card',
      mediaId: media.id,
      variant: 'card',
      path: 'cc/card-checksum.webp',
      mimeType: 'image/webp',
      byteSize: 120,
      width: 960,
      height: 720,
      checksum: 'c'.repeat(64),
    })
    repository.upsertCmsMediaVariant({
      id: 'variant-managed-card-newer',
      mediaId: media.id,
      variant: 'card',
      path: 'cc/card-newer-checksum.webp',
      mimeType: 'image/webp',
      byteSize: 125,
      width: 960,
      height: 720,
      checksum: 'f'.repeat(64),
    })

    const page = structuredClone(repository.getDraftPageByPath('/'))
    if (!page) throw new Error('Accueil absent du seed.')
    const paths = page.blocks.find((block) => block.type === 'link_card_grid')
    if (!paths || paths.type !== 'link_card_grid') {
      throw new Error('Cartes de navigation absentes du seed.')
    }
    paths.data.cards[0]!.image = {
      mediaId: media.id,
      src: getManagedCmsImageUrl(media.id, 'card', 'c'.repeat(64)),
      alt: 'Athlètes pendant une routine',
    }

    expect(validateCmsPageImageReferences(page, repository)).toEqual([])

    paths.data.cards[0]!.image.src = `/media/${media.id}/hero.webp`
    expect(validateCmsPageImageReferences(page, repository)).toContainEqual({
      path: 'blocks.6.data.cards.0.image.src',
      message: 'L’URL doit utiliser la variante « card » de ce média.',
    })
  })

  it('contrôle aussi le preset hero du SEO et refuse une variante manquante', () => {
    const repository = memoryRepository()
    const media = repository.createCmsMedia({
      id: 'media-dddddddddddddddddddddddddddddddd',
      storageKind: 'managed',
      originalPath: 'dd/master.webp',
      originalFilename: 'partage.webp',
      mimeType: 'image/webp',
    })
    repository.upsertCmsMediaVariant({
      id: 'variant-managed-thumbnail',
      mediaId: media.id,
      variant: 'thumbnail',
      path: 'dd/thumbnail-checksum.webp',
      mimeType: 'image/webp',
      byteSize: 80,
      width: 320,
      height: 320,
      checksum: 'd'.repeat(64),
    })

    const page = structuredClone(repository.getDraftPageByPath('/contact'))
    if (!page) throw new Error('Page contact absente du seed.')
    page.seo.image = {
      mediaId: media.id,
      src: getManagedCmsImageUrl(media.id, 'hero', 'd'.repeat(64)),
      alt: '',
      decorative: true,
    }

    expect(validateCmsPageImageReferences(page, repository)).toContainEqual({
      path: 'seo.image.mediaId',
      message: 'Ce média ne possède pas de variante WebP « hero ».',
    })
  })

  it('conserve l’URL checksumée du SEO managed après une sauvegarde et un rechargement', () => {
    const repository = memoryRepository()
    const checksum = 'e'.repeat(64)
    const media = repository.createCmsMedia({
      id: 'media-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      storageKind: 'managed',
      originalPath: 'ee/master.webp',
      originalFilename: 'seo.webp',
      mimeType: 'image/webp',
    })
    repository.upsertCmsMediaVariant({
      id: 'variant-managed-hero',
      mediaId: media.id,
      variant: 'hero',
      path: `ee/hero-${checksum}.webp`,
      mimeType: 'image/webp',
      byteSize: 160,
      width: 1_920,
      height: 1_080,
      checksum,
    })

    const page = structuredClone(repository.getDraftPageByPath('/contact'))
    if (!page) throw new Error('Page contact absente du seed.')
    const expectedSrc = getManagedCmsImageUrl(media.id, 'hero', checksum)
    page.seo.image = {
      mediaId: media.id,
      src: expectedSrc,
      alt: '',
      decorative: true,
    }
    expect(validateCmsPageImageReferences(page, repository)).toEqual([])

    repository.saveCmsPageRevision({
      pageId: page.id,
      expectedRevisionId: page.revisionId,
      title: page.title,
      seo: page.seo,
      blocks: page.blocks,
    })
    repository.upsertCmsMediaVariant({
      id: 'variant-managed-hero-newer',
      mediaId: media.id,
      variant: 'hero',
      path: `ee/hero-${'f'.repeat(64)}.webp`,
      mimeType: 'image/webp',
      byteSize: 165,
      width: 1_920,
      height: 1_080,
      checksum: 'f'.repeat(64),
    })

    const reloaded = repository.getDraftPageById(page.id)
    expect(reloaded?.seo.image?.src).toBe(expectedSrc)
    expect(validateCmsPageImageReferences(reloaded!, repository)).toEqual([])
  })
})
