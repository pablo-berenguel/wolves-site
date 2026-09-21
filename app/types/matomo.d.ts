type MatomoQueueCommand = [string, ...unknown[]]

declare global {
  interface Window {
    _paq?: MatomoQueueCommand[]
  }
}

export {}
