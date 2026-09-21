import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { openCmsDatabase } from '../server/utils/cms/database'
import { createCmsRepository } from '../server/utils/cms/repository'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

describe('persistance du CMS', () => {
  it('retrouve les contenus après fermeture et réouverture d’un fichier SQLite', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wolves-cms-db-'))
    temporaryDirectories.push(directory)
    const filename = join(directory, 'db', 'wolves.sqlite')

    const first = openCmsDatabase({ filename })
    createCmsRepository(first.database).setCmsSetting('test.persisted', {
      label: 'Toujours présent',
    })
    first.database.close()

    const second = openCmsDatabase({ filename })
    expect(second.seed?.applied).toBe(false)
    expect(createCmsRepository(second.database).getCmsSetting('test.persisted')).toEqual({
      label: 'Toujours présent',
    })
    expect(second.database.pragma('integrity_check', { simple: true })).toBe('ok')
    second.database.close()
  })

  it('conserve les anciennes variantes afin que leurs URL restent immuables', () => {
    const opened = openCmsDatabase({ filename: ':memory:' })
    const repository = createCmsRepository(opened.database)
    const media = repository.createCmsMedia({
      id: 'media-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      storageKind: 'managed',
      originalPath: 'aa/master.webp',
      originalFilename: 'image.webp',
      mimeType: 'image/webp',
    })

    for (const checksum of ['1'.repeat(64), '2'.repeat(64)]) {
      repository.upsertCmsMediaVariant({
        id: `variant-${checksum}`,
        mediaId: media.id,
        variant: 'card',
        path: `aa/card-${checksum}.webp`,
        mimeType: 'image/webp',
        byteSize: 100,
        width: 960,
        height: 720,
        checksum,
      })
    }

    expect(repository.listCmsMediaVariants(media.id)).toHaveLength(2)
    opened.database.close()
  })
})
