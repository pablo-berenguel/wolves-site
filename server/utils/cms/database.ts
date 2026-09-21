import { mkdirSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'

import BetterSqlite3 from 'better-sqlite3'

import { seedCmsDatabase, type CmsSeedResult } from '../../data/cms-seed'
import { applyCmsMigrations } from './migrations'

export interface OpenCmsDatabaseOptions {
  filename: string
  seed?: boolean
  now?: () => string
}

export interface OpenCmsDatabaseResult {
  database: BetterSqlite3.Database
  migrationsApplied: number
  seed: CmsSeedResult | null
}

let singletonDatabase: BetterSqlite3.Database | undefined

function ensureDatabaseDirectory(filename: string): void {
  if (filename === ':memory:' || filename.startsWith('file:')) {
    return
  }

  mkdirSync(dirname(filename), { recursive: true })
}

export function configureCmsDatabase(database: BetterSqlite3.Database): void {
  database.pragma('foreign_keys = ON')
  database.pragma('busy_timeout = 5000')
  database.pragma('journal_mode = WAL')
  database.pragma('synchronous = FULL')
  database.pragma('wal_autocheckpoint = 1000')
}

export function openCmsDatabase(options: OpenCmsDatabaseOptions): OpenCmsDatabaseResult {
  const now = options.now ?? (() => new Date().toISOString())
  ensureDatabaseDirectory(options.filename)

  const database = new BetterSqlite3(options.filename)
  try {
    configureCmsDatabase(database)
    const migrationsApplied = applyCmsMigrations(database, now)
    const seed = options.seed === false ? null : seedCmsDatabase(database, now)
    const foreignKeyProblems = database.pragma('foreign_key_check') as unknown[]

    if (foreignKeyProblems.length > 0) {
      throw new Error('La base CMS contient des références invalides après son initialisation.')
    }

    return { database, migrationsApplied, seed }
  } catch (error) {
    database.close()
    throw error
  }
}

export function resolveCmsDatabaseFilename(): string {
  const explicitFilename = process.env.CMS_DATABASE_PATH?.trim()
  if (explicitFilename) {
    return isAbsolute(explicitFilename) ? explicitFilename : resolve(explicitFilename)
  }

  const configuredDirectory = process.env.NUXT_CMS_DATA_DIR?.trim() || '.data'
  const dataDirectory = isAbsolute(configuredDirectory)
    ? configuredDirectory
    : resolve(configuredDirectory)

  return resolve(dataDirectory, 'db', 'wolves.sqlite')
}

export function getCmsDatabase(): BetterSqlite3.Database {
  if (!singletonDatabase?.open) {
    singletonDatabase = openCmsDatabase({ filename: resolveCmsDatabaseFilename() }).database
  }

  return singletonDatabase
}

export function closeCmsDatabase(): void {
  if (singletonDatabase?.open) {
    singletonDatabase.close()
  }
  singletonDatabase = undefined
}
