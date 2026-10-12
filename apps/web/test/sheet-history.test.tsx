// @vitest-environment jsdom
import { StrictMode } from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Sheet } from '@/components/ui/sheet'
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  history.replaceState(null, '', '/')
})
describe('sheet history recovery', () => {
  it('removes only one stale sheet entry after reload under StrictMode', () => {
    history.replaceState({ trickleSheet: true }, '', '/')
    const back = vi.spyOn(history, 'back').mockImplementation(() => {})
    render(
      <StrictMode>
        <Sheet open={false} onClose={() => {}} title="Penarikan" />
      </StrictMode>,
    )
    expect(back).toHaveBeenCalledOnce()
  })
})
