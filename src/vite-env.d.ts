/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly CARTO_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
