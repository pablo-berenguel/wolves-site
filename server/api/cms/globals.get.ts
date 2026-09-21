import { setHeader } from 'h3'

import { getCmsSetting } from '../../utils/cms/repository'

export default defineEventHandler((event) => {
  setHeader(event, 'Cache-Control', 'public, max-age=0, must-revalidate')

  return {
    site: getCmsSetting('site.identity'),
    navigation: getCmsSetting('site.navigation'),
    footerLinks: getCmsSetting('site.footerLinks'),
    socials: getCmsSetting('site.socials'),
  }
})
