import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ImportScreen } from '../../../src/views/import/ImportScreen'

vi.mock('../../../src/app/AppContext', () => ({
  useApp: () => ({
    refreshData: vi.fn(),
  }),
}))

vi.mock('../../../src/db/import', () => ({
  runImport: vi.fn().mockResolvedValue(undefined),
}))

describe('ImportScreen component', () => {
  it('renders Welcome header and single Select Folder button', () => {
    render(
      <MemoryRouter>
        <ImportScreen />
      </MemoryRouter>,
    )

    expect(screen.getByText('Welcome to SnapVault')).toBeDefined()
    expect(screen.getByText('Select Folder')).toBeDefined()
    expect(screen.queryByText('Browse Folder')).toBeNull()
  })

  it('triggers transparent fallback to file input when showDirectoryPicker is unsupported', () => {
    // Ensure window.showDirectoryPicker is undefined (as in Firefox/Safari/jsdom)
    // @ts-expect-error deleting property for test
    delete window.showDirectoryPicker

    const inputClickSpy = vi.spyOn(HTMLInputElement.prototype, 'click')

    render(
      <MemoryRouter>
        <ImportScreen />
      </MemoryRouter>,
    )

    const selectFolderBtn = screen.getByText('Select Folder')
    fireEvent.click(selectFolderBtn)

    // Should seamlessly trigger hidden file input click
    expect(inputClickSpy).toHaveBeenCalled()
    // Should NOT show the legacy error
    expect(screen.queryByText(/Directory Picker API is not supported/i)).toBeNull()

    inputClickSpy.mockRestore()
  })

  it('invokes showDirectoryPicker when available in browser', async () => {
    const mockShowDir = vi.fn().mockResolvedValue({
      kind: 'directory',
      name: 'export',
      values: async function* () {},
    })

    // @ts-expect-error setting mock directory picker
    window.showDirectoryPicker = mockShowDir

    render(
      <MemoryRouter>
        <ImportScreen />
      </MemoryRouter>,
    )

    const selectFolderBtn = screen.getByText('Select Folder')
    fireEvent.click(selectFolderBtn)

    expect(mockShowDir).toHaveBeenCalledOnce()

    // @ts-expect-error cleanup
    delete window.showDirectoryPicker
  })
})
