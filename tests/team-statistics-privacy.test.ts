import type BetterSqlite3 from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'

import { openCmsDatabase } from '../server/utils/cms/database'
import { applyCmsMigrations, cmsMigrations } from '../server/utils/cms/migrations'

interface PrivacyContent {
  title: string
  sections: Array<{ title: string; paragraphs: Array<{ text: string }> }>
}

const oldMemberParagraph =
  'L’espace membre associe l’identifiant Discord de la session aux inscriptions enregistrées par BigBadBot. Il affiche uniquement au membre concerné ses agrégats d’inscription, ses inscriptions actuellement annulées et, lorsque la date du créneau peut être déterminée, les annulations effectuées moins de vingt-quatre heures avant celui-ci. Ces informations décrivent des inscriptions et non des présences confirmées.'
const memberSectionTitle = 'Espace membre, inscriptions et alertes'
const databases: BetterSqlite3.Database[] = []

function fixture() {
  const { database } = openCmsDatabase({ filename: ':memory:' })
  databases.push(database)
  const row = database
    .prepare("SELECT revision_id, data_json FROM blocks WHERE id = 'privacy:content' LIMIT 1")
    .get() as { revision_id: string; data_json: string }
  const seeded = JSON.parse(row.data_json) as PrivacyContent
  const legacy = structuredClone(seeded)
  const section = memberSection(legacy)
  section.paragraphs = [{ text: oldMemberParagraph }, ...section.paragraphs.slice(1, 3)]
  database.prepare('DELETE FROM cms_migrations WHERE version = 7').run()
  return { database, revisionId: row.revision_id, seeded, legacy }
}

function memberSection(data: PrivacyContent) {
  const section = data.sections.find(({ title }) => title === memberSectionTitle)
  if (!section) throw new Error('Section membre absente de la politique.')
  return section
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

describe('transparence sur les statistiques nominatives d’équipe', () => {
  it('documente les destinataires et les limites dans une nouvelle base', () => {
    const { seeded } = fixture()
    const paragraphs = memberSection(seeded)
      .paragraphs.map(({ text }) => text)
      .join(' ')
    expect(paragraphs).toContain('Dans « Mes participations », chaque membre consulte ses propres')
    expect(paragraphs).toContain('statistiques agrégées par équipe et par année civile')
    expect(paragraphs).toContain('uniquement aux coachs de l’équipe concernée')
    expect(paragraphs).toContain('aux Head Coaches et aux administrateurs autorisés')
    expect(paragraphs).toContain('nom affiché et le pseudonyme Discord')
    expect(paragraphs).toContain('le rôle Rentrée n’est pas utilisé')
    expect(paragraphs).toContain('ne reconstituent pas les anciennes équipes')
    expect(paragraphs).toContain('non des présences confirmées')
  })

  it('actualise brouillon et publication sans écraser les autres contenus ni les archives', () => {
    const { database, revisionId, legacy, seeded } = fixture()
    legacy.sections.reverse()
    const customParagraph = { text: 'Précision personnalisée conservée par le club.' }
    memberSection(legacy).paragraphs.push(customParagraph)
    writeContent(database, revisionId, legacy)
    cloneRevision(database, revisionId, 'privacy-draft', 2)
    cloneRevision(database, revisionId, 'privacy-archive', 3)
    database
      .prepare("UPDATE pages SET draft_revision_id = 'privacy-draft' WHERE id = 'page:privacy'")
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
    for (const id of [revisionId, 'privacy-draft']) {
      const result = readContent(database, id)
      expect(result.sections.filter(({ title }) => title !== memberSectionTitle)).toEqual(
        legacy.sections.filter(({ title }) => title !== memberSectionTitle),
      )
      expect(memberSection(result).paragraphs).toEqual([
        memberSection(seeded).paragraphs[0],
        ...memberSection(legacy).paragraphs.slice(1),
        ...memberSection(seeded).paragraphs.slice(3),
      ])
    }
    expect(readContent(database, 'privacy-archive')).toEqual(legacy)
    const otherBlock = database
      .prepare("SELECT data_json FROM blocks WHERE revision_id = ? AND id = 'privacy:custom'")
      .get(revisionId) as { data_json: string }
    expect(JSON.parse(otherBlock.data_json)).toEqual(legacy)
  })

  it('préserve un paragraphe membre déjà personnalisé', () => {
    const { database, revisionId, legacy } = fixture()
    memberSection(legacy).paragraphs[0] = { text: 'Texte membre personnalisé et relu par le club.' }
    writeContent(database, revisionId, legacy)
    applyCmsMigrations(database)
    expect(readContent(database, revisionId)).toEqual(legacy)
  })

  it('ne modifie pas un bloc identique placé sur une autre page', () => {
    const { database, revisionId, legacy } = fixture()
    writeContent(database, revisionId, legacy)
    database.prepare("UPDATE pages SET path = '/autre-politique' WHERE id = 'page:privacy'").run()
    applyCmsMigrations(database)
    expect(readContent(database, revisionId)).toEqual(legacy)
  })

  it('ne duplique pas les nouveaux paragraphes en cas de réexécution', () => {
    const { database, revisionId, legacy } = fixture()
    writeContent(database, revisionId, legacy)
    applyCmsMigrations(database)
    const migrated = readContent(database, revisionId)
    expect(applyCmsMigrations(database)).toBe(0)
    const migration = cmsMigrations.find(({ version }) => version === 7)
    if (!migration) throw new Error('Migration de confidentialité absente.')
    database.exec(migration.sql)
    expect(readContent(database, revisionId)).toEqual(migrated)
    expect(memberSection(migrated).paragraphs).toHaveLength(5)
  })
})
