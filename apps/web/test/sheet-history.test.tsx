// @vitest-environment jsdom
import { StrictMode } from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Sheet } from '@/components/ui/sheet'
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
})
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

  it('reports onClosed only after the history entry is gone, not on mount', async () => {
    history.replaceState(null, '', '/')
    const onClosed = vi.fn()
    const view = render(<Sheet open onClose={() => {}} onClosed={onClosed} title="A" />)
    expect(history.state?.trickleSheet).toBe(true)
    let fireBack!: () => void
    const realBack = history.back.bind(history)
    vi.spyOn(history, 'back').mockImplementation(() => {
      fireBack = realBack
    })
    view.rerender(<Sheet open={false} onClose={() => {}} onClosed={onClosed} title="A" />)
    expect(onClosed).not.toHaveBeenCalled()
    fireBack()
    await vi.waitFor(() => expect(onClosed).toHaveBeenCalledOnce())
  })

  it('reports onClosed right away when no history entry remains', () => {
    history.replaceState(null, '', '/')
    const onClosed = vi.fn()
    const view = render(<Sheet open onClose={() => {}} onClosed={onClosed} title="A" />)
    // Closed by Back: the entry was already popped before `open` turns false.
    history.replaceState(null, '', '/')
    view.rerender(<Sheet open={false} onClose={() => {}} onClosed={onClosed} title="A" />)
    expect(onClosed).toHaveBeenCalledOnce()
  })
})
