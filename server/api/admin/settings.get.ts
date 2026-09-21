import { setHeader } from 'h3'

import { getCmsSetting } from '../../utils/cms/repository'
import { requireCmsRole } from '../../utils/cms-authorization'

export default defineEventHandler(async (event) => {
  await requireCmsRole(event, 'admin')
  setHeader(event, 'Cache-Control', 'private, no-store')

  return {
    site: getCmsSetting('site.identity'),
    navigation: getCmsSetting('site.navigation'),
    footerLinks: getCmsSetting('site.footerLinks'),
    socials: getCmsSetting('site.socials'),
  }
})
