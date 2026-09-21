import { createHash } from 'node:crypto'

import type BetterSqlite3 from 'better-sqlite3'

export interface CmsMigration {
  version: number
  name: string
  sql: string
}

interface AppliedMigrationRow {
  version: number
  name: string
  checksum: string
}

export class CmsMigrationChecksumError extends Error {
  constructor(version: number) {
    super(`La migration CMS ${version} ne correspond plus à son checksum enregistré.`)
    this.name = 'CmsMigrationChecksumError'
  }
}

export class CmsUnknownMigrationError extends Error {
  constructor(version: number) {
    super(`La base CMS contient une migration inconnue (${version}).`)
    this.name = 'CmsUnknownMigrationError'
  }
}

export const cmsMigrations: readonly CmsMigration[] = [
  {
    version: 1,
    name: 'cms_core_schema',
    sql: `
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        discord_id TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL,
        display_name TEXT,
        avatar_hash TEXT,
        role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'editor')),
        is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_login_at TEXT
      ) STRICT;

      CREATE TABLE media (
        id TEXT PRIMARY KEY,
        storage_kind TEXT NOT NULL CHECK (storage_kind IN ('bundled', 'managed')),
        original_path TEXT NOT NULL UNIQUE,
        original_filename TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        byte_size INTEGER CHECK (byte_size IS NULL OR byte_size >= 0),
        width INTEGER CHECK (width IS NULL OR width > 0),
        height INTEGER CHECK (height IS NULL OR height > 0),
        checksum TEXT,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE media_variants (
        id TEXT PRIMARY KEY,
        media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
        variant TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        mime_type TEXT NOT NULL,
        byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
        width INTEGER NOT NULL CHECK (width > 0),
        height INTEGER NOT NULL CHECK (height > 0),
        checksum TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (media_id, variant, checksum)
      ) STRICT;

      CREATE TABLE pages (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'published', 'archived')),
        draft_revision_id TEXT REFERENCES revisions(id) ON DELETE SET NULL,
        published_revision_id TEXT REFERENCES revisions(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        published_at TEXT,
        CHECK (path LIKE '/%')
      ) STRICT;

      CREATE TABLE revisions (
        id TEXT PRIMARY KEY,
        page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
        revision_number INTEGER NOT NULL CHECK (revision_number > 0),
        title TEXT NOT NULL,
        seo_title TEXT NOT NULL,
        seo_description TEXT NOT NULL,
        seo_image_id TEXT REFERENCES media(id) ON DELETE SET NULL,
        seo_noindex INTEGER NOT NULL DEFAULT 0 CHECK (seo_noindex IN (0, 1)),
        change_note TEXT,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        UNIQUE (page_id, revision_number)
      ) STRICT;

      CREATE TABLE blocks (
        revision_id TEXT NOT NULL REFERENCES revisions(id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        type TEXT NOT NULL,
        variant TEXT,
        sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
        anchor TEXT,
        theme TEXT NOT NULL DEFAULT 'default'
          CHECK (theme IN ('default', 'light', 'raised')),
        enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
        schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version > 0),
        data_json TEXT NOT NULL CHECK (json_valid(data_json)),
        PRIMARY KEY (revision_id, id),
        UNIQUE (revision_id, sort_order),
        UNIQUE (revision_id, anchor)
      ) STRICT;

      CREATE TABLE audit (
        id TEXT PRIMARY KEY,
        actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT,
        details_json TEXT CHECK (details_json IS NULL OR json_valid(details_json)),
        created_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL CHECK (json_valid(value_json)),
        updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_at TEXT NOT NULL
      ) STRICT;
    `,
  },
  {
    version: 2,
    name: 'cms_lookup_indexes',
    sql: `
      CREATE INDEX pages_status_path_idx ON pages(status, path);
      CREATE INDEX revisions_page_created_idx
        ON revisions(page_id, revision_number DESC);
      CREATE INDEX blocks_revision_order_idx
        ON blocks(revision_id, sort_order);
      CREATE INDEX media_created_idx ON media(created_at DESC);
      CREATE INDEX media_variant_lookup_idx
        ON media_variants(media_id, variant, created_at DESC);
      CREATE INDEX users_active_role_idx ON users(is_active, role);
      CREATE INDEX audit_target_created_idx
        ON audit(target_type, target_id, created_at DESC);
    `,
  },
  {
    version: 3,
    name: 'pin_revision_seo_media_variant',
    sql: `
      ALTER TABLE revisions
        ADD COLUMN seo_image_variant_checksum TEXT
        CHECK (
          seo_image_variant_checksum IS NULL
          OR (
            length(seo_image_variant_checksum) = 64
            AND seo_image_variant_checksum NOT GLOB '*[^0-9a-f]*'
          )
        );
    `,
  },
  {
    version: 4,
    name: 'document_ga4_consent_in_privacy_policy',
    sql: `
      UPDATE blocks
      SET data_json = json_set(
        data_json,
        '$.sections[' || (
          SELECT section.key
          FROM json_each(blocks.data_json, '$.sections') AS section
          WHERE json_extract(section.value, '$.title') = 'Mesure d’audience'
          LIMIT 1
        ) || '].paragraphs',
        json('[{"text":"Google Analytics 4 est utilisé uniquement après ton accord pour mesurer la fréquentation, comprendre l’utilisation des pages publiques et évaluer les prises de contact. Google Ireland Limited traite alors notamment l’URL consultée, l’adresse IP nécessaire à la connexion — que Google indique utiliser pour déterminer une localisation approximative sans la journaliser ni la conserver —, les caractéristiques techniques du navigateur et un identifiant de mesure ; le site ne lui transmet ni nom, ni adresse e-mail, ni identifiant Discord. Google Analytics reste entièrement bloqué tant que tu n’as pas accepté et après un refus. Google Signals et la personnalisation publicitaire sont désactivés."},{"text":"Le gestionnaire tarteaucitron.js conserve ton choix pendant 180 jours dans le cookie « tarteaucitron ». Les cookies de mesure « _ga » et « _ga_<identifiant> », déposés uniquement après acceptation, expirent eux aussi au plus tard après 180 jours. Tu peux retirer ton accord à tout moment avec le lien « Gérer mes cookies » du pied de page."},{"text":"Les données liées aux utilisateurs et aux événements sont conservées deux mois dans Google Analytics, sans réinitialisation de cette durée lors d’une nouvelle activité. Elles sont destinées aux personnes autorisées par le club et à Google Ireland Limited en qualité de sous-traitant. Elles peuvent être traitées hors de l’Espace économique européen selon les garanties décrites par Google ; le lien vers sa politique est disponible dans le panneau de gestion des cookies."}]')
      )
      WHERE id = 'privacy:content'
        AND EXISTS (
          SELECT 1
          FROM json_each(blocks.data_json, '$.sections') AS section
          WHERE json_extract(section.value, '$.title') = 'Mesure d’audience'
            AND json_extract(section.value, '$.paragraphs[0].text') =
              'Aucun outil de mesure d’audience n’est intégré dans cette première version. Si un tel outil est ajouté, cette page et le mécanisme de consentement devront être mis à jour avant sa mise en service.'
        );
    `,
  },
  {
    version: 5,
    name: 'replace_ga4_with_matomo_cnil',
    sql: `
      WITH legacy_ga4(paragraphs_json) AS (
        VALUES (
          json('[{"text":"Google Analytics 4 est utilisé uniquement après ton accord pour mesurer la fréquentation, comprendre l’utilisation des pages publiques et évaluer les prises de contact. Google Ireland Limited traite alors notamment l’URL consultée, l’adresse IP nécessaire à la connexion — que Google indique utiliser pour déterminer une localisation approximative sans la journaliser ni la conserver —, les caractéristiques techniques du navigateur et un identifiant de mesure ; le site ne lui transmet ni nom, ni adresse e-mail, ni identifiant Discord. Google Analytics reste entièrement bloqué tant que tu n’as pas accepté et après un refus. Google Signals et la personnalisation publicitaire sont désactivés."},{"text":"Le gestionnaire tarteaucitron.js conserve ton choix pendant 180 jours dans le cookie « tarteaucitron ». Les cookies de mesure « _ga » et « _ga_<identifiant> », déposés uniquement après acceptation, expirent eux aussi au plus tard après 180 jours. Tu peux retirer ton accord à tout moment avec le lien « Gérer mes cookies » du pied de page."},{"text":"Les données liées aux utilisateurs et aux événements sont conservées deux mois dans Google Analytics, sans réinitialisation de cette durée lors d’une nouvelle activité. Elles sont destinées aux personnes autorisées par le club et à Google Ireland Limited en qualité de sous-traitant. Elles peuvent être traitées hors de l’Espace économique européen selon les garanties décrites par Google ; le lien vers sa politique est disponible dans le panneau de gestion des cookies."}]')
        )
      )
      UPDATE blocks
      SET data_json = json_set(
        data_json,
        '$.sections[' || (
          SELECT section.key
          FROM json_each(blocks.data_json, '$.sections') AS section
          WHERE json_extract(section.value, '$.title') = 'Mesure d’audience'
          LIMIT 1
        ) || '].paragraphs',
        json('[{"text":"Matomo est auto-hébergé sur une infrastructure privée administrée par l’éditeur et mesure uniquement la fréquentation des pages publiques afin d’en améliorer les contenus, l’ergonomie et les performances techniques. Les espaces d’administration, d’authentification, d’inscription et de participation sont exclus. Le site ne transmet ni nom, ni adresse e-mail, ni identifiant Discord, ni paramètres de recherche présents dans l’URL."},{"text":"La mesure d’audience est configurée dans le mode d’exemption prévu par la CNIL : aucun cookie de mesure, aucun identifiant utilisateur, aucun suivi entre domaines, aucune attribution marketing et aucun profil individuel ne sont utilisés. Les adresses IP sont masquées avant leur enregistrement et les journaux de visites individuels, cartes de chaleur, enregistrements de session et tests A/B sont désactivés."},{"text":"Chaque site suivi possède un identifiant de mesure séparé. Les données des Wolves ne sont ni rapprochées de celles d’autres sites, ni communiquées à des fins publicitaires. Les données détaillées sont supprimées au plus tard après 180 jours et les statistiques agrégées au plus tard après vingt-quatre mois."},{"text":"Tu peux t’opposer à cette mesure à tout moment avec le contrôle disponible ci-dessous. Cette opposition est mémorisée pendant 180 jours dans un cookie technique qui ne contient aucun identifiant et sert uniquement à empêcher l’envoi de nouvelles statistiques."}]')
      )
      WHERE id = 'privacy:content'
        AND EXISTS (
          SELECT 1
          FROM revisions
          JOIN pages ON pages.id = revisions.page_id
          WHERE revisions.id = blocks.revision_id
            AND pages.path = '/politique-de-confidentialite'
        )
        AND EXISTS (
          SELECT 1
          FROM json_each(blocks.data_json, '$.sections') AS section
          WHERE json_extract(section.value, '$.title') = 'Mesure d’audience'
            AND json_extract(section.value, '$.paragraphs') = (
              SELECT paragraphs_json FROM legacy_ga4
            )
        );
    `,
  },
  {
    version: 6,
    name: 'expand_matomo_cnil_disclosure',
    sql: `
      WITH disclosure(previous_json, current_json) AS (
        VALUES (
          json('[{"text":"Matomo est auto-hébergé sur une infrastructure privée administrée par l’éditeur et mesure uniquement la fréquentation des pages publiques afin d’en améliorer les contenus, l’ergonomie et les performances techniques. Les espaces d’administration, d’authentification, d’inscription et de participation sont exclus. Le site ne transmet ni nom, ni adresse e-mail, ni identifiant Discord, ni paramètres de recherche présents dans l’URL."},{"text":"La mesure d’audience est configurée dans le mode d’exemption prévu par la CNIL : aucun cookie de mesure, aucun identifiant utilisateur, aucun suivi entre domaines, aucune attribution marketing et aucun profil individuel ne sont utilisés. Les adresses IP sont masquées avant leur enregistrement et les journaux de visites individuels, cartes de chaleur, enregistrements de session et tests A/B sont désactivés."},{"text":"Chaque site suivi possède un identifiant de mesure séparé. Les données des Wolves ne sont ni rapprochées de celles d’autres sites, ni communiquées à des fins publicitaires. Les données détaillées sont supprimées au plus tard après 180 jours et les statistiques agrégées au plus tard après vingt-quatre mois."},{"text":"Tu peux t’opposer à cette mesure à tout moment avec le contrôle disponible ci-dessous. Cette opposition est mémorisée pendant 180 jours dans un cookie technique qui ne contient aucun identifiant et sert uniquement à empêcher l’envoi de nouvelles statistiques."}]'),
          json('[{"text":"Matomo est auto-hébergé sur une infrastructure privée administrée par l’éditeur et mesure uniquement l’audience des pages publiques afin d’en améliorer les contenus, l’ergonomie et les performances techniques. Les mesures portent sur les pages consultées, leur titre, le domaine de provenance, des caractéristiques techniques minimisées, les performances de chargement, le temps de visite, des seuils de défilement et les catégories de liens utilisés. Les destinations sont réduites à un chemin public, un type de contact, un format de téléchargement ou un nom de domaine. Les espaces d’administration, d’authentification, d’inscription et de participation sont exclus. Le site ne transmet ni nom, ni adresse e-mail, ni identifiant Discord, ni paramètres de recherche présents dans l’URL."},{"text":"La mesure d’audience est configurée dans le mode d’exemption prévu par la CNIL : aucun cookie de mesure, aucun identifiant de compte ou identifiant persistant, aucun suivi entre domaines et aucune attribution marketing ne sont utilisés. Les adresses IP sont masquées avant leur enregistrement. La consultation ou l’export des journaux et profils individuels, les cartes de chaleur, les enregistrements de session et les tests A/B sont désactivés."},{"text":"Chaque site suivi possède un identifiant de mesure séparé. Les données des Wolves ne sont ni rapprochées de celles d’autres sites, ni communiquées à des fins publicitaires. Les données détaillées sont supprimées au plus tard après 180 jours et les statistiques agrégées au plus tard après vingt-quatre mois."},{"text":"Tu peux t’opposer à cette mesure à tout moment avec le contrôle disponible ci-dessous. Cette opposition est mémorisée pendant 180 jours dans un cookie technique qui ne contient aucun identifiant et sert uniquement à empêcher l’envoi de nouvelles statistiques."}]')
        )
      )
      UPDATE blocks
      SET data_json = json_set(
        data_json,
        '$.sections[' || (
          SELECT section.key
          FROM json_each(blocks.data_json, '$.sections') AS section
          WHERE lower(json_extract(section.value, '$.title')) LIKE '%google analytics%'
            OR lower(json_extract(section.value, '$.title')) LIKE '%ga4%'
            OR lower(json_extract(section.value, '$.title')) LIKE '%tarteaucitron%'
            OR json_extract(section.value, '$.paragraphs') = (
              SELECT previous_json FROM disclosure
            )
            OR EXISTS (
              SELECT 1
              FROM json_each(section.value, '$.paragraphs') AS paragraph
              WHERE lower(json_extract(paragraph.value, '$.text')) LIKE '%google analytics%'
                OR lower(json_extract(paragraph.value, '$.text')) LIKE '%ga4%'
                OR lower(json_extract(paragraph.value, '$.text')) LIKE '%tarteaucitron%'
            )
          ORDER BY
            json_extract(section.value, '$.paragraphs') = (
              SELECT previous_json FROM disclosure
            ) DESC,
            json_extract(section.value, '$.title') = 'Mesure d’audience' DESC
          LIMIT 1
        ) || '].paragraphs',
        json((SELECT current_json FROM disclosure))
      )
      WHERE id = 'privacy:content'
        AND EXISTS (
          SELECT 1
          FROM revisions
          JOIN pages ON pages.id = revisions.page_id
          WHERE revisions.id = blocks.revision_id
            AND pages.path = '/politique-de-confidentialite'
        )
        AND EXISTS (
          SELECT 1
          FROM json_each(blocks.data_json, '$.sections') AS section
          WHERE lower(json_extract(section.value, '$.title')) LIKE '%google analytics%'
            OR lower(json_extract(section.value, '$.title')) LIKE '%ga4%'
            OR lower(json_extract(section.value, '$.title')) LIKE '%tarteaucitron%'
            OR json_extract(section.value, '$.paragraphs') = (
              SELECT previous_json FROM disclosure
            )
            OR EXISTS (
              SELECT 1
              FROM json_each(section.value, '$.paragraphs') AS paragraph
              WHERE lower(json_extract(paragraph.value, '$.text')) LIKE '%google analytics%'
                OR lower(json_extract(paragraph.value, '$.text')) LIKE '%ga4%'
                OR lower(json_extract(paragraph.value, '$.text')) LIKE '%tarteaucitron%'
            )
        );

      UPDATE blocks
      SET data_json = json_set(
        data_json,
        '$.sections[' || (
          SELECT section.key
          FROM json_each(blocks.data_json, '$.sections') AS section
          WHERE lower(json_extract(section.value, '$.title')) LIKE '%google analytics%'
            OR lower(json_extract(section.value, '$.title')) LIKE '%ga4%'
            OR lower(json_extract(section.value, '$.title')) LIKE '%tarteaucitron%'
          LIMIT 1
        ) || '].title',
        'Mesure d’audience'
      )
      WHERE id = 'privacy:content'
        AND EXISTS (
          SELECT 1
          FROM revisions
          JOIN pages ON pages.id = revisions.page_id
          WHERE revisions.id = blocks.revision_id
            AND pages.path = '/politique-de-confidentialite'
        )
        AND EXISTS (
          SELECT 1
          FROM json_each(blocks.data_json, '$.sections') AS section
          WHERE lower(json_extract(section.value, '$.title')) LIKE '%google analytics%'
            OR lower(json_extract(section.value, '$.title')) LIKE '%ga4%'
            OR lower(json_extract(section.value, '$.title')) LIKE '%tarteaucitron%'
        );
    `,
  },
  {
    version: 7,
    name: 'document_coach_team_statistics_in_privacy_policy',
    sql: `
      WITH matching_sections AS (
        SELECT
          blocks.revision_id,
          blocks.id,
          '$.sections[' || MIN(section.key) || ']' AS section_path
        FROM blocks
        JOIN revisions ON revisions.id = blocks.revision_id
        JOIN pages ON pages.id = revisions.page_id
        JOIN json_each(blocks.data_json, '$.sections') AS section
        WHERE blocks.id = 'privacy:content'
          AND blocks.type = 'rich_text'
          AND pages.path = '/politique-de-confidentialite'
          AND pages.status != 'archived'
          AND blocks.revision_id IN (pages.draft_revision_id, pages.published_revision_id)
          AND json_extract(section.value, '$.title') = 'Espace membre, inscriptions et alertes'
          AND json_extract(section.value, '$.paragraphs[0].text') =
            'L’espace membre associe l’identifiant Discord de la session aux inscriptions enregistrées par BigBadBot. Il affiche uniquement au membre concerné ses agrégats d’inscription, ses inscriptions actuellement annulées et, lorsque la date du créneau peut être déterminée, les annulations effectuées moins de vingt-quatre heures avant celui-ci. Ces informations décrivent des inscriptions et non des présences confirmées.'
        GROUP BY blocks.revision_id, blocks.id
        HAVING COUNT(*) = 1
      )
      UPDATE blocks
      SET data_json = json_insert(
        json_set(
          blocks.data_json,
          target.section_path || '.paragraphs[0].text',
          'L’espace membre associe l’identifiant Discord de la session aux inscriptions enregistrées par BigBadBot. Dans « Mes participations », chaque membre consulte ses propres agrégats d’inscription, ses inscriptions actuellement annulées et, lorsque la date du créneau peut être déterminée, les annulations effectuées moins de vingt-quatre heures avant celui-ci. Ces informations décrivent des inscriptions et non des présences confirmées.'
        ),
        target.section_path || '.paragraphs[#]',
        json('{"text":"Pour le suivi des inscriptions par l’encadrement, les coachs d’équipe, les Head Coaches et les administrateurs autorisés peuvent consulter les statistiques agrégées par équipe et par année civile. Le détail nominatif présente le nom affiché et le pseudonyme Discord des membres, leurs inscriptions par activité, leurs annulations et leurs semaines avec une inscription. Ce détail est accessible uniquement aux coachs de l’équipe concernée, aux Head Coaches et aux administrateurs autorisés. Les accès sont vérifiés côté serveur à partir des rôles Discord et des droits d’administration."}'),
        target.section_path || '.paragraphs[#]',
        json('{"text":"Les équipes de ces tableaux correspondent aux rôles Discord actuels Pentagone, Polygone, Hexagone, Heptagone, Octogone et Octolady ; le rôle Rentrée n’est pas utilisé. Les statistiques d’une année passée portent sur les inscriptions de cet effectif actuel et ne reconstituent pas les anciennes équipes. L’historique conservé par BigBadBot peut être partiel, notamment pour les anciennes annulations. Une donnée absente ne prouve pas une absence d’activité et une inscription ne confirme pas une présence."}')
      )
      FROM matching_sections AS target
      WHERE blocks.revision_id = target.revision_id
        AND blocks.id = target.id;
    `,
  },
  {
    version: 8,
    name: 'document_training_roster_in_privacy_policy',
    sql: `
      WITH matching_blocks AS (
        SELECT blocks.revision_id, blocks.id
        FROM blocks
        JOIN revisions ON revisions.id = blocks.revision_id
        JOIN pages ON pages.id = revisions.page_id
        JOIN json_each(blocks.data_json, '$.sections') AS section
        WHERE blocks.id = 'privacy:content'
          AND blocks.type = 'rich_text'
          AND pages.path = '/politique-de-confidentialite'
          AND pages.status != 'archived'
          AND blocks.revision_id IN (pages.draft_revision_id, pages.published_revision_id)
          AND json_type(blocks.data_json, '$.sections') = 'array'
          AND json_extract(section.value, '$.title') = 'Espace membre, inscriptions et alertes'
          AND json_extract(section.value, '$.paragraphs[0].text') =
            'L’espace membre associe l’identifiant Discord de la session aux inscriptions enregistrées par BigBadBot. Dans « Mes participations », chaque membre consulte ses propres agrégats d’inscription, ses inscriptions actuellement annulées et, lorsque la date du créneau peut être déterminée, les annulations effectuées moins de vingt-quatre heures avant celui-ci. Ces informations décrivent des inscriptions et non des présences confirmées.'
          AND NOT EXISTS (
            SELECT 1
            FROM json_each(blocks.data_json, '$.sections') AS existing_section
            WHERE json_extract(existing_section.value, '$.title') = 'Créneaux et liste des inscrits'
          )
        GROUP BY blocks.revision_id, blocks.id
        HAVING COUNT(*) = 1
      )
      UPDATE blocks
      SET data_json = json_insert(
        blocks.data_json,
        '$.sections[#]',
        json('{"title":"Créneaux et liste des inscrits","paragraphs":[{"text":"La page « Créneaux » est réservée aux membres ayant le rôle Wolves et les permissions de lecture du salon d’annonces d’entraînement. Pour un créneau sélectionné dans la dernière annonce publiée, ces membres peuvent voir la liste des inscrits, leur nom affiché et leur pseudonyme Discord, leurs équipes actuelles hors rôles Rentrée et leur statut Flyer lorsqu’il est connu. Cette page présente les inscriptions du créneau sélectionné, et non les statistiques annuelles des membres. Une inscription ne confirme pas une présence. Cette page privée est exclue de la mesure d’audience Matomo."}]}')
      )
      FROM matching_blocks AS target
      WHERE blocks.revision_id = target.revision_id
        AND blocks.id = target.id;
    `,
  },
] as const

export function getCmsMigrationChecksum(migration: CmsMigration): string {
  return createHash('sha256')
    .update(`${migration.version}:${migration.name}\n${migration.sql}`)
    .digest('hex')
}

export function applyCmsMigrations(
  database: BetterSqlite3.Database,
  now: () => string = () => new Date().toISOString(),
): number {
  database.exec(`
    CREATE TABLE IF NOT EXISTS cms_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL
    ) STRICT;
  `)

  const applied = database
    .prepare('SELECT version, name, checksum FROM cms_migrations ORDER BY version')
    .all() as AppliedMigrationRow[]
  const knownByVersion = new Map(cmsMigrations.map((migration) => [migration.version, migration]))

  for (const row of applied) {
    const migration = knownByVersion.get(row.version)
    if (!migration) {
      throw new CmsUnknownMigrationError(row.version)
    }

    if (row.name !== migration.name || row.checksum !== getCmsMigrationChecksum(migration)) {
      throw new CmsMigrationChecksumError(row.version)
    }
  }

  const appliedVersions = new Set(applied.map(({ version }) => version))
  const insertMigration = database.prepare(`
    INSERT INTO cms_migrations (version, name, checksum, applied_at)
    VALUES (@version, @name, @checksum, @appliedAt)
  `)
  const migrate = database.transaction((migration: CmsMigration) => {
    database.exec(migration.sql)
    insertMigration.run({
      version: migration.version,
      name: migration.name,
      checksum: getCmsMigrationChecksum(migration),
      appliedAt: now(),
    })
  })

  let appliedCount = 0
  for (const migration of cmsMigrations) {
    if (appliedVersions.has(migration.version)) {
      continue
    }

    migrate(migration)
    appliedCount += 1
  }

  return appliedCount
}
