const RETRY_WITH_SAME_REQUEST_CODES = new Set(['discord_unavailable', 'edit_in_progress'])

export function mutationErrorStatus(error: unknown) {
  if (!error || typeof error !== 'object') return null
  const source = error as {
    status?: unknown
    statusCode?: unknown
    response?: { status?: unknown }
  }
  const status = source.statusCode ?? source.status ?? source.response?.status

  return typeof status === 'number' ? status : null
}

export function mutationErrorCode(error: unknown) {
  if (!error || typeof error !== 'object') return ''
  const source = error as { data?: { code?: unknown; data?: { code?: unknown } } }
  const code = source.data?.data?.code ?? source.data?.code

  return typeof code === 'string' ? code : ''
}

export function mutationOutcomeIsUnknown(error: unknown) {
  const status = mutationErrorStatus(error)

  return (
    status === null ||
    status === 0 ||
    status === 408 ||
    status >= 500 ||
    RETRY_WITH_SAME_REQUEST_CODES.has(mutationErrorCode(error))
  )
}

export function shouldReleaseMutationRequestId(error: unknown) {
  const status = mutationErrorStatus(error)

  return status !== null && status >= 400 && status < 500 && !mutationOutcomeIsUnknown(error)
}
