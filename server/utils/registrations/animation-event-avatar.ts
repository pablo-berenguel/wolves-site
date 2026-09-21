export const ANIMATION_EVENT_AVATAR_MAX_BYTES = 2 * 1024 * 1024

const ALLOWED_CONTENT_TYPES = new Set([
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const)

export type AnimationEventAvatarContentType =
  'image/gif' | 'image/jpeg' | 'image/png' | 'image/webp'

export interface AnimationEventAvatarPayload {
  bytes: Uint8Array
  contentType: AnimationEventAvatarContentType
}

function invalidAvatarResponse(): never {
  throw new Error('Invalid BigBadBot animation event avatar response')
}

function parseContentType(value: string | null): AnimationEventAvatarContentType {
  const contentType = value?.split(';', 1)[0]?.trim().toLowerCase() || ''

  return ALLOWED_CONTENT_TYPES.has(contentType as AnimationEventAvatarContentType)
    ? (contentType as AnimationEventAvatarContentType)
    : invalidAvatarResponse()
}

function validateDeclaredLength(value: string | null) {
  if (value === null) return
  const candidate = value.trim()
  if (!/^(0|[1-9]\d*)$/.test(candidate)) invalidAvatarResponse()
  const length = Number(candidate)
  if (!Number.isSafeInteger(length) || length > ANIMATION_EVENT_AVATAR_MAX_BYTES) {
    invalidAvatarResponse()
  }
}

async function readBoundedBody(response: Response) {
  const reader = response.body?.getReader()
  if (!reader) invalidAvatarResponse()

  const chunks: Uint8Array[] = []
  let length = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value?.byteLength) continue
      length += value.byteLength
      if (length > ANIMATION_EVENT_AVATAR_MAX_BYTES) {
        await reader.cancel()
        invalidAvatarResponse()
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  if (length === 0) invalidAvatarResponse()
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  return bytes
}

export async function parseAnimationEventAvatarResponse(
  response: Response,
): Promise<AnimationEventAvatarPayload> {
  if (!response.ok) invalidAvatarResponse()
  const contentType = parseContentType(response.headers.get('content-type'))
  validateDeclaredLength(response.headers.get('content-length'))
  const bytes = await readBoundedBody(response)

  return { bytes, contentType }
}
