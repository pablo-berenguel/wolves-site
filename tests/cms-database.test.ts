import type BetterSqlite3 from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'

import { openCmsDatabase } from '../server/utils/cms/database'
import {
  applyCmsMigrations,
  cmsMigrations,
  getCmsMigrationChecksum,
} from '../server/utils/cms/migrations'
import { CmsConflictError, createCmsRepository } from '../server/utils/cms/repository'

const databases: BetterSqlite3.Database[] = []

function memoryDatabase() {
  const opened = openCmsDatabase({
    filename: ':memory:',
    now: () => '2026-08-19T20:00:00.000Z',
  })
  databases.push(opened.database)
  return opened
}

afterEach(() => {
  for (const database of databases.splice(0)) {
    if (database.open) database.close()
  }
})

describe('base SQLite du CMS', () => {
  it('préserve le checksum de la migration Matomo déjà publiée', () => {
    const migration = cmsMigrations.find(({ version }) => version === 5)
    expect(migration).toBeDefined()
    if (!migration) throw new Error('Migration Matomo v5 absente.')
    expect(getCmsMigrationChecksum(migration)).toBe(
      'd920aaf17d5a0a7fd9282ad391cf46a3c1ff9660256f23069cf3eef023030575',
    )
  })

  it('applique les migrations et le seed initial une seule fois', () => {
    const opened = memoryDatabase()

    expect(opened.migrationsApplied).toBe(cmsMigrations.length)
    expect(opened.seed).toMatchObject({ applied: true, pages: 9, blocks: 35 })
    expect(applyCmsMigrations(opened.database)).toBe(0)

    const counts = opened.database
      .prepare(
        `
          SELECT
            (SELECT COUNT(*) FROM pages) AS pages,
            (SELECT COUNT(*) FROM blocks) AS blocks,
            (SELECT COUNT(*) FROM media) AS media
        `,
      )
      .get() as { pages: number; blocks: number; media: number }

    expect(counts.pages).toBe(9)
    expect(counts.blocks).toBe(35)
    expect(counts.media).toBeGreaterThan(10)
  })

  it('migre une ancienne politique de confidentialité jusqu’à Matomo sans reseed', () => {
    const { database } = memoryDatabase()
    const row = database
      .prepare("SELECT revision_id, data_json FROM blocks WHERE id = 'privacy:content' LIMIT 1")
      .get() as { revision_id: string; data_json: string }
    const data = JSON.parse(row.data_json) as {
      sections: Array<{ title?: string; paragraphs?: Array<{ text: string }> }>
    }
    const audienceSection = data.sections.find(({ title }) => title === 'Mesure d’audience')
    if (!audienceSection) throw new Error('Section de mesure d’audience absente du seed.')

    audienceSection.paragraphs = [
      {
        text: 'Aucun outil de mesure d’audience n’est intégré dans cette première version. Si un tel outil est ajouté, cette page et le mécanisme de consentement devront être mis à jour avant sa mise en service.',
      },
    ]
    data.sections.reverse()
    database
      .prepare('UPDATE blocks SET data_json = ? WHERE revision_id = ? AND id = ?')
      .run(JSON.stringify(data), row.revision_id, 'privacy:content')
    database.prepare('DELETE FROM cms_migrations WHERE version >= 4').run()

    expect(applyCmsMigrations(database)).toBe(
      cmsMigrations.filter(({ version }) => version >= 4).length,
    )

    const migrated = database
      .prepare('SELECT data_json FROM blocks WHERE revision_id = ? AND id = ?')
      .get(row.revision_id, 'privacy:content') as { data_json: string }
    const migratedData = JSON.parse(migrated.data_json) as typeof data
    const migratedAudienceSection = migratedData.sections.find(
      ({ title }) => title === 'Mesure d’audience',
    )

    expect(migratedAudienceSection?.paragraphs).toHaveLength(4)
    expect(migratedAudienceSection?.paragraphs?.[0]?.text).toContain('Matomo')
    expect(migratedAudienceSection?.paragraphs?.[1]?.text).toContain('aucun cookie de mesure')
    expect(migratedAudienceSection?.paragraphs?.[3]?.text).toContain('180 jours')
    expect(migratedData.sections.at(0)?.title).toBe('Contact et droits')
  })

  it('remplace une information Google Analytics personnalisée devenue obsolète', () => {
    const { database } = memoryDatabase()
    const row = database
      .prepare("SELECT revision_id, data_json FROM blocks WHERE id = 'privacy:content' LIMIT 1")
      .get() as { revision_id: string; data_json: string }
    const data = JSON.parse(row.data_json) as {
      sections: Array<{ title?: string; paragraphs?: Array<{ text: string }> }>
    }
    const audienceSection = data.sections.find(({ title }) => title === 'Mesure d’audience')
    if (!audienceSection) throw new Error('Section de mesure d’audience absente du seed.')

    const customParagraph = {
      text: 'Texte personnalisé par le club au sujet de Google Analytics 4.',
    }
    audienceSection.title = 'Cookies et Google Analytics'
    audienceSection.paragraphs = [customParagraph]
    database
      .prepare('UPDATE blocks SET data_json = ? WHERE revision_id = ? AND id = ?')
      .run(JSON.stringify(data), row.revision_id, 'privacy:content')
    database.prepare('DELETE FROM cms_migrations WHERE version >= 5').run()

    expect(applyCmsMigrations(database)).toBe(
      cmsMigrations.filter(({ version }) => version >= 5).length,
    )

    const migrated = database
      .prepare('SELECT data_json FROM blocks WHERE revision_id = ? AND id = ?')
      .get(row.revision_id, 'privacy:content') as { data_json: string }
    const migratedData = JSON.parse(migrated.data_json) as typeof data
    const migratedParagraphs = migratedData.sections.find(
      ({ title }) => title === 'Mesure d’audience',
    )?.paragraphs
    expect(migratedParagraphs).toHaveLength(4)
    expect(migratedParagraphs?.[0]?.text).toContain('Matomo')
    expect(migratedParagraphs?.some(({ text }) => text.includes('Google Analytics'))).toBe(false)
    expect(migratedData.sections.some(({ title }) => title?.includes('Google Analytics'))).toBe(
      false,
    )
  })

  it('préserve une section de mesure d’audience Matomo personnalisée', () => {
    const { database } = memoryDatabase()
    const row = database
      .prepare("SELECT revision_id, data_json FROM blocks WHERE id = 'privacy:content' LIMIT 1")
      .get() as { revision_id: string; data_json: string }
    const data = JSON.parse(row.data_json) as {
      sections: Array<{ title?: string; paragraphs?: Array<{ text: string }> }>
    }
    const audienceSection = data.sections.find(({ title }) => title === 'Mesure d’audience')
    if (!audienceSection) throw new Error('Section de mesure d’audience absente du seed.')

    const customParagraph = {
      text: 'Texte Matomo personnalisé et déjà relu par le club.',
    }
    audienceSection.paragraphs = [customParagraph]
    database
      .prepare('UPDATE blocks SET data_json = ? WHERE revision_id = ? AND id = ?')
      .run(JSON.stringify(data), row.revision_id, 'privacy:content')
    database.prepare('DELETE FROM cms_migrations WHERE version = 6').run()

    expect(applyCmsMigrations(database)).toBe(1)

    const migrated = database
      .prepare('SELECT data_json FROM blocks WHERE revision_id = ? AND id = ?')
      .get(row.revision_id, 'privacy:content') as { data_json: string }
    const migratedData = JSON.parse(migrated.data_json) as typeof data
    expect(
      migratedData.sections.find(({ title }) => title === 'Mesure d’audience')?.paragraphs,
    ).toEqual([customParagraph])
  })

  it('sépare le brouillon de la version publiée puis publie atomiquement', () => {
    const { database } = memoryDatabase()
    const repository = createCmsRepository(database)
    const before = repository.getPublishedPageByPath('/animations')
    expect(before).not.toBeNull()

    const blocks = structuredClone(before!.blocks)
    const cta = blocks.find((block) => block.id === 'events:cta')
    expect(cta?.type).toBe('cta_band')
    if (!cta || cta.type !== 'cta_band') throw new Error('Bloc CTA absent du seed.')
    const originalTitle = cta.data.title
    cta.data.title = 'Nouveau titre encore privé'

    const revision = repository.saveCmsPageRevision({
      pageId: before!.id,
      expectedRevisionId: before!.revisionId,
      title: before!.title,
      seo: before!.seo,
      blocks,
      actorUserId: undefined,
      changeNote: 'Test brouillon',
    })

    expect(revision.revisionNumber).toBe(2)
    expect(
      repository
        .getPublishedPageByPath('/animations')
        ?.blocks.find((block) => block.id === 'events:cta'),
    ).toMatchObject({ data: { title: originalTitle } })
    expect(
      repository.getDraftPageById(before!.id)?.blocks.find((block) => block.id === 'events:cta'),
    ).toMatchObject({ data: { title: 'Nouveau titre encore privé' } })

    expect(() =>
      repository.saveCmsPageRevision({
        pageId: before!.id,
        expectedRevisionId: before!.revisionId,
        title: before!.title,
        seo: before!.seo,
        blocks: before!.blocks,
      }),
    ).toThrow(CmsConflictError)

    const published = repository.publishCmsPage(before!.id, revision.id)
    expect(published.status).toBe('published')
    expect(
      repository
        .getPublishedPageByPath('/animations')
        ?.blocks.find((block) => block.id === 'events:cta'),
    ).toMatchObject({ data: { title: 'Nouveau titre encore privé' } })
  })

  it('ne livre pas le contenu masqué dans le snapshot public', () => {
    const { database } = memoryDatabase()
    const repository = createCmsRepository(database)
    const draft = repository.getDraftPageByPath('/animations')
    expect(draft).not.toBeNull()

    const blocks = structuredClone(draft!.blocks)
    const hiddenBlock = blocks.at(-1)
    if (!hiddenBlock) throw new Error('Bloc de test absent.')
    hiddenBlock.enabled = false

    const revision = repository.saveCmsPageRevision({
      pageId: draft!.id,
      expectedRevisionId: draft!.revisionId,
      title: draft!.title,
      seo: draft!.seo,
      blocks,
    })
    repository.publishCmsPage(draft!.id, revision.id)

    expect(repository.getDraftPageById(draft!.id)?.blocks.some((block) => !block.enabled)).toBe(
      true,
    )
    expect(
      repository.getPublishedPageByPath('/animations')?.blocks.every((block) => block.enabled),
    ).toBe(true)
  })

  it('persiste les rôles Discord par identifiant immuable', () => {
    const { database } = memoryDatabase()
    const repository = createCmsRepository(database)
    const created = repository.upsertCmsUser({
      discordId: '123456789012345678',
      username: 'coach-exemple',
      displayName: 'Coach Exemple',
      role: 'super_admin',
      isActive: true,
    })

    expect(repository.findCmsUserByDiscordId('123456789012345678')).toMatchObject({
      id: created.id,
      role: 'super_admin',
      isActive: true,
    })

    repository.updateCmsUserAccess(created.id, { role: 'admin', isActive: false })
    expect(repository.getCmsUserAuthorization(created.id)).toMatchObject({
      discordId: '123456789012345678',
      role: 'admin',
      isActive: false,
    })
  })

  it('stocke les réglages globaux en JSON sans reseed', () => {
    const { database } = memoryDatabase()
    const repository = createCmsRepository(database)

    repository.setCmsSetting('test.setting', { enabled: true, label: 'Wolves' })

    expect(repository.getCmsSetting('test.setting')).toEqual({ enabled: true, label: 'Wolves' })
  })
})
