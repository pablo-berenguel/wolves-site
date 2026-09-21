import type { CmsImagePreset } from '../../shared/cms/types'

const MEDIA_ID_PATTERN = /^media-[a-f0-9]{32}$/
const VERSIONED_FILENAME_PATTERN = /^(master|hero|card|square|thumbnail)-([a-f0-9]{64})\.webp$/

export interface CmsMediaRouteParams {
  mediaId: string
  preset: CmsImagePreset
  checksum: string
}

export function parseCmsMediaRouteParams(
  mediaId: string,
  filename: string,
): CmsMediaRouteParams | null {
  if (!MEDIA_ID_PATTERN.test(mediaId)) return null

  const match = VERSIONED_FILENAME_PATTERN.exec(filename)
  if (!match) return null

  const preset = match[1]
  const checksum = match[2]
  if (!preset || !checksum) return null

  return {
    mediaId,
    preset: preset as CmsImagePreset,
    checksum,
  }
}
