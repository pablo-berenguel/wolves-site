import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, rename, stat, unlink } from 'node:fs/promises'
import { basename, join } from 'node:path'
import sharp, { type FitEnum, type Metadata } from 'sharp'

import type { CmsImagePreset } from '../../shared/cms/types'

const MAX_INPUT_PIXELS = 25_000_000
const SUPPORTED_INPUT_FORMATS = new Set(['jpeg', 'png', 'webp'])

sharp.cache({ memory: 32, files: 10, items: 100 })
sharp.concurrency(1)

interface PresetRecipe {
  width: number
  height?: number
  fit: keyof FitEnum
  quality: number
}

const PRESET_RECIPES: Record<CmsImagePreset, PresetRecipe> = {
  master: { width: 2560, fit: 'inside', quality: 88 },
  hero: { width: 1920, height: 1080, fit: 'cover', quality: 84 },
  card: { width: 960, height: 720, fit: 'cover', quality: 82 },
  square: { width: 800, height: 800, fit: 'cover', quality: 82 },
  thumbnail: { width: 480, height: 320, fit: 'cover', quality: 78 },
}

export interface ProcessedImageVariant {
  preset: CmsImagePreset
  relativePath: string
  width: number
  height: number
  bytes: number
  sha256: string
}

export interface ProcessedCmsImage {
  sourceSha256: string
  originalFilename: string
  sourceFormat: 'jpeg' | 'png' | 'webp'
  sourceWidth: number
  sourceHeight: number
  variants: ProcessedImageVariant[]
}

async function hashFile(path: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk as Buffer)
  }
  return hash.digest('hex')
}

function imageError(statusCode: number, statusMessage: string) {
  return Object.assign(new Error(statusMessage), { statusCode, statusMessage })
}

let processingQueue = Promise.resolve()

function serializeImageProcessing<T>(operation: () => Promise<T>): Promise<T> {
  const result = processingQueue.then(operation, operation)
  processingQueue = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}

/**
 * Decodes and normalizes an upload, strips metadata, and writes deterministic
 * WebP variants. Files are first completed in .staging then atomically moved.
 */
export function processCmsImage(
  temporaryPath: string,
  originalFilename: string,
  dataDirectory: string,
): Promise<ProcessedCmsImage> {
  return serializeImageProcessing(async () => {
    const mediaDirectory = join(dataDirectory, 'media')
    const stagingDirectory = join(mediaDirectory, '.staging')
    await mkdir(stagingDirectory, { recursive: true, mode: 0o700 })

    let metadata: Metadata
    try {
      metadata = await sharp(temporaryPath, {
        animated: false,
        failOn: 'warning',
        limitInputPixels: MAX_INPUT_PIXELS,
      }).metadata()
    } catch {
      throw imageError(415, 'L’image est illisible ou dépasse 25 mégapixels.')
    }

    if (
      !metadata.format ||
      !SUPPORTED_INPUT_FORMATS.has(metadata.format) ||
      !metadata.width ||
      !metadata.height ||
      (metadata.pages ?? 1) > 1
    ) {
      throw imageError(415, 'Formats acceptés : JPEG, PNG ou WebP non animé.')
    }

    const sourceSha256 = await hashFile(temporaryPath)
    const shard = sourceSha256.slice(0, 2)
    const destinationDirectory = join(mediaDirectory, shard)
    await mkdir(destinationDirectory, { recursive: true, mode: 0o700 })

    const stagedFiles: string[] = []
    const variants: ProcessedImageVariant[] = []

    try {
      for (const [preset, recipe] of Object.entries(PRESET_RECIPES) as Array<
        [CmsImagePreset, PresetRecipe]
      >) {
        const stagedPath = join(stagingDirectory, `${sourceSha256}-${preset}-${Date.now()}.webp`)
        stagedFiles.push(stagedPath)

        await sharp(temporaryPath, {
          animated: false,
          failOn: 'warning',
          limitInputPixels: MAX_INPUT_PIXELS,
        })
          .rotate()
          .resize({
            width: recipe.width,
            height: recipe.height,
            fit: recipe.fit,
            position: preset === 'master' ? 'centre' : 'attention',
            withoutEnlargement: true,
          })
          .webp({ quality: recipe.quality, effort: 4, smartSubsample: true })
          .toFile(stagedPath)

        const outputMetadata = await sharp(stagedPath).metadata()
        if (!outputMetadata.width || !outputMetadata.height) {
          throw imageError(500, 'La variante WebP générée est invalide.')
        }

        const outputSha256 = await hashFile(stagedPath)
        const filename = `${sourceSha256}-${preset}-${outputSha256}.webp`
        const relativePath = join(shard, filename)
        const finalPath = join(destinationDirectory, filename)
        const existingStats = await stat(finalPath).catch((error: NodeJS.ErrnoException) => {
          if (error.code === 'ENOENT') return null
          throw error
        })

        // The output checksum is part of the filename. Never replace an
        // existing content-addressed file, even after a Sharp upgrade.
        if (existingStats?.isFile()) {
          await unlink(stagedPath)
        } else {
          await rename(stagedPath, finalPath)
        }
        const outputStats = existingStats || (await stat(finalPath))

        variants.push({
          preset,
          relativePath,
          width: outputMetadata.width,
          height: outputMetadata.height,
          bytes: outputStats.size,
          sha256: outputSha256,
        })
      }
    } catch (error) {
      await Promise.all(stagedFiles.map((path) => unlink(path).catch(() => undefined)))
      throw error
    }

    return {
      sourceSha256,
      originalFilename: basename(originalFilename).slice(0, 180),
      sourceFormat: metadata.format as 'jpeg' | 'png' | 'webp',
      sourceWidth: metadata.width,
      sourceHeight: metadata.height,
      variants,
    }
  })
}
