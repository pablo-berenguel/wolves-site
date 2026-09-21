import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import sharp from 'sharp'
import { afterEach, describe, expect, it } from 'vitest'

import { processCmsImage } from '../server/utils/cms-image'

const temporaryDirectories: string[] = []

async function temporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'wolves-cms-image-'))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, {
        recursive: true,
        force: true,
      }),
    ),
  )
})

describe('pipeline image du CMS', () => {
  it('génère cinq variantes WebP adaptées aux blocs', async () => {
    const directory = await temporaryDirectory()
    const input = join(directory, 'source.png')
    await sharp({
      create: {
        width: 2400,
        height: 1200,
        channels: 3,
        background: '#293c92',
      },
    })
      .png()
      .toFile(input)

    const result = await processCmsImage(input, 'photo équipe.png', directory)
    const dimensions = Object.fromEntries(
      result.variants.map((variant) => [variant.preset, [variant.width, variant.height]]),
    )

    expect(result.sourceFormat).toBe('png')
    expect(result.originalFilename).toBe('photo équipe.png')
    expect(dimensions).toEqual({
      master: [2400, 1200],
      hero: [1920, 1080],
      card: [960, 720],
      square: [800, 800],
      thumbnail: [480, 320],
    })

    for (const variant of result.variants) {
      expect(variant.relativePath).toContain(variant.sha256)
      const metadata = await sharp(resolve(directory, 'media', variant.relativePath)).metadata()
      expect(metadata.format).toBe('webp')
    }
  })

  it('conserve les octets sous une URL content-addressée lors d’un réupload', async () => {
    const directory = await temporaryDirectory()
    const input = join(directory, 'source.webp')
    await sharp({
      create: {
        width: 1200,
        height: 900,
        channels: 3,
        background: '#ff8427',
      },
    })
      .webp()
      .toFile(input)

    const first = await processCmsImage(input, 'source.webp', directory)
    const firstCard = first.variants.find((variant) => variant.preset === 'card')
    if (!firstCard) throw new Error('Variante card absente.')
    const firstBytes = await readFile(resolve(directory, 'media', firstCard.relativePath))

    const second = await processCmsImage(input, 'source.webp', directory)
    const secondCard = second.variants.find((variant) => variant.preset === 'card')
    if (!secondCard) throw new Error('Variante card absente.')
    const secondBytes = await readFile(resolve(directory, 'media', secondCard.relativePath))

    expect(secondCard.relativePath).toBe(firstCard.relativePath)
    expect(secondBytes).toEqual(firstBytes)
  })

  it('refuse un fichier qui n’est pas une image décodable', async () => {
    const directory = await temporaryDirectory()
    const input = join(directory, 'fake.jpg')
    await writeFile(input, 'not-an-image', { mode: 0o600 })

    await expect(processCmsImage(input, 'fake.jpg', directory)).rejects.toMatchObject({
      statusCode: 415,
    })
  })
})
