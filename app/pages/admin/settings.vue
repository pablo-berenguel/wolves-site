<script setup lang="ts">
import type { CmsFieldSchema } from '#shared/cms/types'
import type { CmsGlobals } from '~/composables/useCmsGlobals'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

useSeoMeta({ title: 'Réglages · Wolves CMS', robots: 'noindex, nofollow' })

const childLinkItem: CmsFieldSchema = {
  kind: 'object',
  label: 'Lien',
  fields: {
    label: { kind: 'text', label: 'Libellé', required: true, maxLength: 80 },
    to: { kind: 'url', label: 'Destination', required: true },
  },
}

const linkItem: CmsFieldSchema = {
  kind: 'object',
  label: 'Lien',
  fields: {
    label: { kind: 'text', label: 'Libellé', required: true, maxLength: 80 },
    to: { kind: 'url', label: 'Destination', required: true },
    children: {
      kind: 'list',
      label: 'Sous-liens',
      item: childLinkItem,
      maxItems: 12,
    },
  },
}

const schemas: Record<'site' | 'navigation' | 'footerLinks' | 'socials', CmsFieldSchema> = {
  site: {
    kind: 'object',
    label: 'Identité du site',
    fields: {
      name: { kind: 'text', label: 'Nom complet', required: true, maxLength: 160 },
      shortName: { kind: 'text', label: 'Nom court', required: true, maxLength: 100 },
      tagline: { kind: 'text', label: 'Signature', maxLength: 160 },
      description: { kind: 'textarea', label: 'Description', required: true, maxLength: 500 },
      footerDescription: {
        kind: 'textarea',
        label: 'Texte du pied de page',
        required: true,
        maxLength: 240,
      },
      founded: { kind: 'number', label: 'Année de création', min: 1900, max: 2100 },
      location: { kind: 'text', label: 'Localisation', maxLength: 200 },
      logo: { kind: 'url', label: 'Logo', required: true },
      heroImage: { kind: 'url', label: 'Image principale' },
      address: {
        kind: 'object',
        label: 'Adresse',
        fields: {
          street: { kind: 'text', label: 'Rue', required: true, maxLength: 160 },
          postalCode: { kind: 'text', label: 'Code postal', required: true, maxLength: 20 },
          city: { kind: 'text', label: 'Ville', required: true, maxLength: 100 },
          country: { kind: 'text', label: 'Pays', required: true, maxLength: 100 },
          formatted: { kind: 'text', label: 'Adresse complète', required: true, maxLength: 240 },
        },
      },
    },
  },
  navigation: {
    kind: 'list',
    label: 'Navigation principale',
    item: linkItem,
    minItems: 1,
    maxItems: 30,
  },
  footerLinks: {
    kind: 'list',
    label: 'Liens du pied de page',
    item: linkItem,
    maxItems: 30,
  },
  socials: {
    kind: 'list',
    label: 'Réseaux sociaux',
    maxItems: 12,
    item: {
      kind: 'object',
      label: 'Réseau',
      fields: {
        platform: {
          kind: 'select',
          label: 'Plateforme',
          required: true,
          options: ['Instagram', 'Facebook', 'YouTube', 'TikTok'].map((value) => ({
            value,
            label: value,
          })),
        },
        label: { kind: 'text', label: 'Libellé accessible', required: true, maxLength: 160 },
        url: { kind: 'url', label: 'Adresse', required: true },
      },
    },
  },
}

const form = ref<CmsGlobals | null>(null)
const saving = ref(false)
const message = reactive({ kind: '' as 'success' | 'error' | '', text: '' })
const { data, error } = await useFetch<CmsGlobals>('/api/admin/settings')

if (data.value) form.value = structuredClone(data.value)

async function save() {
  if (!form.value || saving.value) return
  saving.value = true
  message.kind = ''
  try {
    form.value = await $fetch<CmsGlobals>('/api/admin/settings', {
      method: 'PUT',
      body: form.value,
    })
    await refreshNuxtData('cms-globals')
    message.kind = 'success'
    message.text = 'Réglages publiés.'
  } catch (saveError) {
    const candidate = saveError as { data?: { statusMessage?: string }; message?: string }
    message.kind = 'error'
    message.text =
      candidate.data?.statusMessage || candidate.message || 'Enregistrement impossible.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="cms-settings">
    <header>
      <p>Configuration globale</p>
      <h1>Identité et navigation</h1>
      <span>Ces changements sont communs à toutes les pages et sont publiés immédiatement.</span>
    </header>

    <p v-if="error" class="cms-settings__message is-error">
      Ces réglages sont réservés aux administrateurs.
    </p>

    <form v-else-if="form" class="cms-settings__form" @submit.prevent="save">
      <p v-if="message.text" :class="['cms-settings__message', `is-${message.kind}`]">
        {{ message.text }}
      </p>

      <section>
        <AdminCmsField v-model="form.site" :schema="schemas.site" name="site" />
      </section>
      <section>
        <AdminCmsField v-model="form.navigation" :schema="schemas.navigation" name="navigation" />
      </section>
      <section>
        <AdminCmsField
          v-model="form.footerLinks"
          :schema="schemas.footerLinks"
          name="footerLinks"
        />
      </section>
      <section>
        <AdminCmsField v-model="form.socials" :schema="schemas.socials" name="socials" />
      </section>

      <button type="submit" :disabled="saving">
        {{ saving ? 'Enregistrement…' : 'Publier les réglages' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.cms-settings {
  display: grid;
  gap: 1.25rem;
  max-width: 980px;
  margin: 0 auto;
  color: #27325d;
}

.cms-settings header p,
.cms-settings header h1 {
  margin-top: 0;
}

.cms-settings header p {
  margin-bottom: 0.35rem;
  color: #6b7595;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.cms-settings header span {
  color: #68718f;
}

.cms-settings__form {
  display: grid;
  gap: 1rem;
}

.cms-settings__form > section {
  padding: clamp(1rem, 3vw, 1.5rem);
  border: 1px solid #d7ddec;
  border-radius: 0.8rem;
  background: white;
}

.cms-settings__form > button {
  justify-self: end;
  min-height: 2.8rem;
  padding: 0.65rem 1rem;
  border: 0;
  border-radius: 0.5rem;
  color: white;
  background: #293c92;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.cms-settings__form > button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.cms-settings__message {
  margin: 0;
  padding: 0.8rem 1rem;
  border-radius: 0.55rem;
  font-weight: 800;
}

.cms-settings__message.is-success {
  color: #17643f;
  background: #e7f6ed;
}

.cms-settings__message.is-error {
  color: #9d203a;
  background: #fbe9ed;
}
</style>
