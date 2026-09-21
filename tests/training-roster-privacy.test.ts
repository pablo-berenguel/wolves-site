import type BetterSqlite3 from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'

import { openCmsDatabase } from '../server/utils/cms/database'
import { applyCmsMigrations, cmsMigrations } from '../server/utils/cms/migrations'

interface PrivacyContent {
  title: string
  sections: Array<{ title: string; paragraphs: Array<{ text: string }> }>
}

const memberSectionTitle = 'Espace membre, inscriptions et alertes'
const rosterSectionTitle = 'Créneaux et liste des inscrits'
const databases: BetterSqlite3.Database[] = []

function fixture() {
  const { database } = openCmsDatabase({ filename: ':memory:' })
  databases.push(database)
  const row = database
    .prepare("SELECT revision_id, data_json FROM blocks WHERE id = 'privacy:content' LIMIT 1")
    .get() as { revision_id: string; data_json: string }
  const seeded = JSON.parse(row.data_json) as PrivacyContent
  const legacy = structuredClone(seeded)
  legacy.sections = legacy.sections.filter(({ title }) => title !== rosterSectionTitle)
  database.prepare('DELETE FROM cms_migrations WHERE version = 8').run()
  return { database, revisionId: row.revision_id, seeded, legacy }
}

function section(data: PrivacyContent, sectionTitle: string) {
  const result = data.sections.find(({ title }) => title === sectionTitle)
  if (!result) throw new Error(`Section de confidentialité absente : ${sectionTitle}.`)
  return result
}

function writeContent(database: BetterSqlite3.Database, revisionId: string, data: PrivacyContent) {
  database
    .prepare("UPDATE blocks SET data_json = ? WHERE revision_id = ? AND id = 'privacy:content'")
    .run(JSON.stringify(data), revisionId)
}

function readContent(database: BetterSqlite3.Database, revisionId: string) {
  const row = database
    .prepare("SELECT data_json FROM blocks WHERE revision_id = ? AND id = 'privacy:content'")
    .get(revisionId) as { data_json: string }
  return JSON.parse(row.data_json) as PrivacyContent
}

function cloneRevision(
  database: BetterSqlite3.Database,
  source: string,
  id: string,
  number: number,
) {
  database
    .prepare(
      `
      INSERT INTO revisions (
        id, page_id, revision_number, title, seo_title, seo_description, seo_noindex, created_at
      ) SELECT ?, page_id, ?, title, seo_title, seo_description, seo_noindex, created_at
      FROM revisions WHERE id = ?
    `,
    )
    .run(id, number, source)
  database
    .prepare(
      `
      INSERT INTO blocks (
        revision_id, id, type, variant, sort_order, anchor, theme, enabled, schema_version, data_json
      ) SELECT ?, id, type, variant, sort_order, anchor, theme, enabled, schema_version, data_json
      FROM blocks WHERE revision_id = ?
    `,
    )
    .run(id, source)
}

afterEach(() => {
  for (const database of databases.splice(0)) {
    if (database.open) database.close()
  }
})

describe('transparence sur la liste des inscrits aux créneaux', () => {
  it('documente le périmètre de partage et les accès dans une nouvelle base', () => {
    const { seeded } = fixture()
    const text = section(seeded, rosterSectionTitle)
      .paragraphs.map((paragraph) => paragraph.text)
      .join(' ')

    expect(text).toContain('membres ayant le rôle Wolves')
    expect(text).toContain('permissions de lecture du salon d’annonces d’entraînement')
    expect(text).toContain('créneau sélectionné dans la dernière annonce publiée')
    expect(text).toContain('nom affiché et leur pseudonyme Discord')
    expect(text).toContain('équipes actuelles hors rôles Rentrée')
    expect(text).toContain('statut Flyer lorsqu’il est connu')
    expect(text).toContain('non les statistiques annuelles des membres')
    expect(text).toContain('Une inscription ne confirme pas une présence')
    expect(text).toContain('exclue de la mesure d’audience Matomo')
  })

  it('complète publication et brouillon courants sans toucher aux archives ou autres blocs', () => {
    const { database, revisionId, seeded, legacy } = fixture()
    legacy.sections.reverse()
    section(legacy, memberSectionTitle).paragraphs.push({ text: 'Précision ajoutée par le club.' })
    writeContent(database, revisionId, legacy)
    cloneRevision(database, revisionId, 'roster-privacy-draft', 2)
    cloneRevision(database, revisionId, 'roster-privacy-archive', 3)
    database
      .prepare(
        "UPDATE pages SET draft_revision_id = 'roster-privacy-draft' WHERE id = 'page:privacy'",
      )
      .run()
    database
      .prepare(
        `
        INSERT INTO blocks (revision_id, id, type, variant, sort_order, theme, enabled, schema_version, data_json)
        SELECT revision_id, 'privacy:custom', type, variant, 1, theme, enabled, schema_version, data_json
        FROM blocks WHERE revision_id = ? AND id = 'privacy:content'
      `,
      )
      .run(revisionId)

    expect(applyCmsMigrations(database)).toBe(1)

    for (const id of [revisionId, 'roster-privacy-draft']) {
      expect(readContent(database, id)).toEqual({
        ...legacy,
        sections: [...legacy.sections, section(seeded, rosterSectionTitle)],
      })
    }
    expect(readContent(database, 'roster-privacy-archive')).toEqual(legacy)
    const customBlock = database
      .prepare("SELECT data_json FROM blocks WHERE revision_id = ? AND id = 'privacy:custom'")
      .get(revisionId) as { data_json: string }
    expect(JSON.parse(customBlock.data_json)).toEqual(legacy)
  })

  it('préserve un paragraphe membre déjà personnalisé', () => {
    const { database, revisionId, legacy } = fixture()
    section(legacy, memberSectionTitle).paragraphs[0] = { text: 'Texte relu par le club.' }
    writeContent(database, revisionId, legacy)

    applyCmsMigrations(database)

    expect(readContent(database, revisionId)).toEqual(legacy)
  })

  it('préserve une section de créneaux personnalisée déjà présente', () => {
    const { database, revisionId, legacy } = fixture()
    legacy.sections.push({ title: rosterSectionTitle, paragraphs: [{ text: 'Texte du club.' }] })
    writeContent(database, revisionId, legacy)

    applyCmsMigrations(database)

    expect(readContent(database, revisionId)).toEqual(legacy)
  })

  it('ignore les sections membre ambiguës', () => {
    const { database, revisionId, legacy } = fixture()
    legacy.sections.push(structuredClone(section(legacy, memberSectionTitle)))
    writeContent(database, revisionId, legacy)

    applyCmsMigrations(database)

    expect(readContent(database, revisionId)).toEqual(legacy)
  })

  it('préserve une page archivée et une page portant un autre chemin', () => {
    for (const pageUpdate of [
      "UPDATE pages SET status = 'archived' WHERE id = 'page:privacy'",
      "UPDATE pages SET path = '/autre-politique' WHERE id = 'page:privacy'",
    ]) {
      const { database, revisionId, legacy } = fixture()
      writeContent(database, revisionId, legacy)
      database.exec(pageUpdate)

      applyCmsMigrations(database)

      expect(readContent(database, revisionId)).toEqual(legacy)
    }
  })

  it('ne duplique pas la section lors d’une réexécution', () => {
    const { database, revisionId, legacy } = fixture()
    writeContent(database, revisionId, legacy)
    applyCmsMigrations(database)
    const migrated = readContent(database, revisionId)
    expect(applyCmsMigrations(database)).toBe(0)
    const migration = cmsMigrations.find(({ version }) => version === 8)
    if (!migration) throw new Error('Migration de confidentialité des créneaux absente.')

    database.exec(migration.sql)

    expect(readContent(database, revisionId)).toEqual(migrated)
    expect(migrated.sections.filter(({ title }) => title === rosterSectionTitle)).toHaveLength(1)
  })
})
