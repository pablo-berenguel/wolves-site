import { constants } from 'node:fs'
import { access, mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { setResponseStatus } from 'h3'

import { getCmsDatabase } from '../utils/cms/database'

const DISCORD_SNOWFLAKE_PATTERN = /^\d{17,20}$/

export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig(event)
    if (process.env.NODE_ENV === 'production') {
      const sessionPassword = String(process.env.NUXT_SESSION_PASSWORD || '')
      const discordClientId = String(process.env.NUXT_OAUTH_DISCORD_CLIENT_ID || '')
      const superAdminDiscordId = String(config.cmsSuperAdminDiscordId || '')
      const bridgeUrl = String(config.bigbadbotBridgeUrl || '')
      const configuredBridgeSecret = String(config.bigbadbotBridgeSecret || '').trim()
      const bridgeSecretFile = String(config.bigbadbotBridgeSecretFile || '')
      const bridgeRequired = String(config.bigbadbotBridgeRequired) === 'true'
      let bridgeConfigurationValid =
        !bridgeRequired && !bridgeUrl && !configuredBridgeSecret && !bridgeSecretFile
      if (bridgeUrl || configuredBridgeSecret || bridgeSecretFile) {
        try {
          const parsedBridgeUrl = new URL(bridgeUrl)
          const bridgeSecret =
            configuredBridgeSecret || (await readFile(bridgeSecretFile, 'utf8')).trim()
          bridgeConfigurationValid =
            ['http:', 'https:'].includes(parsedBridgeUrl.protocol) && bridgeSecret.length >= 32
        } catch {
          bridgeConfigurationValid = false
        }
      }
      if (
        sessionPassword.length < 32 ||
        !DISCORD_SNOWFLAKE_PATTERN.test(discordClientId) ||
        !process.env.NUXT_OAUTH_DISCORD_CLIENT_SECRET ||
        !DISCORD_SNOWFLAKE_PATTERN.test(superAdminDiscordId) ||
        !bridgeConfigurationValid
      ) {
        throw new Error('Invalid private CMS configuration')
      }
    }

    getCmsDatabase().prepare('SELECT 1').get()

    const mediaDirectory = resolve(String(config.cmsDataDir || '.data'), 'media')
    await mkdir(mediaDirectory, { recursive: true, mode: 0o700 })
    await access(mediaDirectory, constants.W_OK)

    return { status: 'ok' }
  } catch {
    setResponseStatus(event, 503)
    return { status: 'error' }
  }
})
