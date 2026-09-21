import { describe, expect, it } from 'vitest'
import {
  mutationErrorCode,
  mutationErrorStatus,
  mutationOutcomeIsUnknown,
  shouldReleaseMutationRequestId,
} from '../app/utils/autosave-mutation'

describe('autosave mutation failures', () => {
  it.each([undefined, { status: 0 }, { status: 408 }, { statusCode: 500 }])(
    'keeps the request id when the mutation outcome is unknown (%j)',
    (error) => {
      expect(mutationOutcomeIsUnknown(error)).toBe(true)
      expect(shouldReleaseMutationRequestId(error)).toBe(false)
    },
  )

  it('keeps the request id for retryable bridge errors', () => {
    const error = { statusCode: 409, data: { data: { code: 'edit_in_progress' } } }

    expect(mutationErrorCode(error)).toBe('edit_in_progress')
    expect(mutationOutcomeIsUnknown(error)).toBe(true)
    expect(shouldReleaseMutationRequestId(error)).toBe(false)
  })

  it.each([400, 404, 409, 422, 429])(
    'releases the request id after a definite %i rejection',
    (status) => {
      const error = { response: { status } }

      expect(mutationErrorStatus(error)).toBe(status)
      expect(mutationOutcomeIsUnknown(error)).toBe(false)
      expect(shouldReleaseMutationRequestId(error)).toBe(true)
    },
  )
})
