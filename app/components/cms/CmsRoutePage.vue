<script setup lang="ts">
const props = defineProps<{
  path: string
}>()

const { data: page, error } = await useCmsPage(props.path)
const { data: globals } = await useCmsGlobals()

if (error.value) {
  throw createError({
    statusCode: error.value.statusCode || 500,
    statusMessage: error.value.statusMessage || 'Impossible de charger cette page.',
  })
}

if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Page introuvable.' })
}

usePageSeo({
  title: page.value.seo.title,
  description: page.value.seo.description,
  path: page.value.path,
  image: page.value.seo.image?.src,
  noindex: page.value.seo.noindex,
})

if (props.path === '/') {
  useOrganizationSchema(computed(() => globals.value ?? null))
}
</script>

<template>
  <CmsPageRenderer v-if="page" :page="page" />
</template>
