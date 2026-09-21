declare module '#auth-utils' {
  interface User {
    /** Identifiant Discord immuable issu du scope OAuth `identify`. */
    discordId: string
    username: string
    displayName: string | null
    /** Identifiant interne CMS, absent pour un membre sans rôle éditorial. */
    userId?: string
  }
}

export {}
