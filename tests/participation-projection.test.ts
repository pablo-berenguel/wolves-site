import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import BetterSqlite3 from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'

import {
  getMemberParticipationProjection,
  hasMemberParticipationProjection,
} from '../server/utils/participations/projection'

const USER_ID = '111111111111111111'
const temporaryDirectories: string[] = []

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'wolves-participations-'))
  temporaryDirectories.push(directory)
  const filename = join(directory, 'participations.sqlite')
  const database = new BetterSqlite3(filename)
  database.exec(`
    CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE members (
      discord_id TEXT PRIMARY KEY,
      registrations INTEGER NOT NULL,
      cancellations INTEGER NOT NULL,
      late_cancellations INTEGER NOT NULL,
      active_weeks INTEGER NOT NULL,
      club_active_weeks INTEGER NOT NULL,
      first_week_start TEXT,
      last_week_start TEXT
    );
    CREATE TABLE periods (
      discord_id TEXT NOT NULL,
      period_start TEXT NOT NULL,
      registrations INTEGER NOT NULL
    );
    CREATE TABLE breakdowns (
      discord_id TEXT NOT NULL,
      category TEXT NOT NULL,
      registrations INTEGER NOT NULL
    );
    CREATE TABLE recent (
      discord_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      week_start TEXT NOT NULL,
      category TEXT NOT NULL,
      label TEXT NOT NULL
    );
  `)
  database.prepare('INSERT INTO metadata VALUES (?, ?)').run('schema_version', '2')
  database
    .prepare('INSERT INTO metadata VALUES (?, ?)')
    .run('generated_at', new Date().toISOString())
  database
    .prepare('INSERT INTO metadata VALUES (?, ?)')
    .run('source_updated_at', '2026-06-28T16:06:35Z')
  database.prepare('INSERT INTO metadata VALUES (?, ?)').run('period_start', '2024-10-07')
  database.prepare('INSERT INTO metadata VALUES (?, ?)').run('period_end', '2026-06-29')
  database.prepare('INSERT INTO metadata VALUES (?, ?)').run('club_active_weeks', '100')
  database
    .prepare('INSERT INTO members VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(USER_ID, 12, 4, 1, 8, 80, '2024-10-07', '2026-06-29')
  database.prepare('INSERT INTO periods VALUES (?, ?, ?)').run(USER_ID, '2026-06-01', 4)
  database.prepare('INSERT INTO breakdowns VALUES (?, ?, ?)').run(USER_ID, 'open_gym', 9)
  database.prepare('INSERT INTO breakdowns VALUES (?, ?, ?)').run(USER_ID, 'workshop', 3)
  database
    .prepare('INSERT INTO recent VALUES (?, ?, ?, ?, ?)')
    .run(USER_ID, 1, '2026-06-29', 'open_gym', 'Open Gym')
  database.close()

  return filename
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('participation projection', () => {
  it('returns only the authenticated member aggregate', async () => {
    const filename = fixture()
    const projection = await getMemberParticipationProjection(USER_ID, filename)

    expect(projection.stats.summary).toEqual({
      registrations: 12,
      cancellations: 4,
      lateCancellations: 1,
      totalActiveWeeks: 8,
      clubActiveWeeks: 80,
      regularityPercent: 10,
    })
    expect(projection.stats.timeSeries.points).toEqual([
      { periodStart: '2026-06-01', label: 'juin 2026', registrations: 4 },
    ])
    expect(projection.stats.breakdown.map((item) => item.label)).toEqual(['Open Gym', 'Ateliers'])
    expect(projection.stats.recent[0]).toEqual({
      startsAt: '2026-06-29',
      label: 'Open Gym',
      category: 'open_gym',
    })
    expect(JSON.stringify(projection)).not.toContain(USER_ID)
  })

  it('distinguishes a known member without exposing identifiers', async () => {
    const filename = fixture()

    await expect(hasMemberParticipationProjection(USER_ID, filename)).resolves.toBe(true)
    await expect(hasMemberParticipationProjection('222222222222222222', filename)).resolves.toBe(
      false,
    )
  })

  it('refuses a stale projection instead of serving silently outdated data', async () => {
    const filename = fixture()
    const database = new BetterSqlite3(filename)
    database
      .prepare('UPDATE metadata SET value = ? WHERE key = ?')
      .run('2020-01-01T00:00:00Z', 'generated_at')
    database.close()

    await expect(getMemberParticipationProjection(USER_ID, filename)).rejects.toMatchObject({
      statusCode: 503,
    })
  })
})
