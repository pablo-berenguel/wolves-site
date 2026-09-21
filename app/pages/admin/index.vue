<script setup lang="ts">
import {
  cmsSeoImageFieldSchema,
  createCmsBlock,
  listCmsBlockDefinitions,
} from '#shared/cms/registry'
import type { CmsBlock, CmsBlockType, CmsPageSnapshot, CmsPageSummary } from '#shared/types/cms'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

useSeoMeta({
  title: 'Pages · Wolves CMS',
  robots: 'noindex, nofollow',
})

const blockDefinitions = listCmsBlockDefinitions()
const selectedPageId = ref('')
const selectedBlockType = ref<CmsBlockType>('split_content')
const page = ref<CmsPageSnapshot | null>(null)
const changeNote = ref('')
const dirty = ref(false)
const loadingPage = ref(false)
const saving = ref(false)
const publishing = ref(false)
const message = reactive({ kind: '' as 'success' | 'error' | '', text: '' })

const { data: summaries, refresh: refreshSummaries } = await useFetch<CmsPageSummary[]>(
  '/api/admin/pages',
  { default: () => [] },
)

watch(
  page,
  () => {
    if (!loadingPage.value && page.value) dirty.value = true
  },
  { deep: true },
)

onMounted(async () => {
  if (!selectedPageId.value && summaries.value[0]) {
    await selectPage(summaries.value[0].id)
  }
})

async function selectPage(pageId: string) {
  if (
    dirty.value &&
    page.value &&
    !window.confirm('Abandonner les modifications non enregistrées ?')
  ) {
    return
  }

  loadingPage.value = true
  message.kind = ''
  try {
    const response = await $fetch<{ page: CmsPageSnapshot }>(`/api/admin/pages/${pageId}`)
    selectedPageId.value = pageId
    page.value = structuredClone(response.page)
    changeNote.value = ''
    await nextTick()
    dirty.value = false
  } catch (error) {
    showErrorMessage(error, 'Impossible de charger cette page.')
  } finally {
    loadingPage.value = false
  }
}

function normalizeBlockOrder(blocks: CmsBlock[]): CmsBlock[] {
  return blocks.map((block, index) => ({ ...block, sortOrder: index }))
}

function updateBlock(index: number, block: CmsBlock) {
  if (!page.value) return
  const blocks = [...page.value.blocks]
  blocks[index] = block
  page.value.blocks = normalizeBlockOrder(blocks)
}

function moveBlock(index: number, direction: -1 | 1) {
  if (!page.value) return
  const target = index + direction
  if (target < 0 || target >= page.value.blocks.length) return
  const blocks = [...page.value.blocks]
  const current = blocks[index]
  const destination = blocks[target]
  if (!current || !destination) return
  blocks[index] = destination
  blocks[target] = current
  page.value.blocks = normalizeBlockOrder(blocks)
}

function removeBlock(index: number) {
  if (!page.value || !window.confirm('Retirer ce bloc du brouillon ?')) return
  page.value.blocks = normalizeBlockOrder(
    page.value.blocks.filter((_, blockIndex) => blockIndex !== index),
  )
}

function addBlock() {
  if (!page.value) return
  const id = globalThis.crypto?.randomUUID?.() ?? `block-${Date.now()}`
  page.value.blocks.push(
    createCmsBlock(selectedBlockType.value, id, page.value.blocks.length) as unknown as CmsBlock,
  )
}

async function saveDraft() {
  if (!page.value || saving.value) return
  saving.value = true
  message.kind = ''
  try {
    const response = await $fetch<{ page: CmsPageSnapshot }>(`/api/admin/pages/${page.value.id}`, {
      method: 'PUT',
      body: {
        title: page.value.title,
        seo: page.value.seo,
        blocks: normalizeBlockOrder(page.value.blocks),
        expectedRevisionId: page.value.revisionId,
        changeNote: changeNote.value,
      },
    })
    page.value = structuredClone(response.page)
    await refreshSummaries()
    await nextTick()
    dirty.value = false
    changeNote.value = ''
    message.kind = 'success'
    message.text = 'Brouillon enregistré.'
  } catch (error) {
    showErrorMessage(error, 'Le brouillon n’a pas pu être enregistré.')
  } finally {
    saving.value = false
  }
}

async function publishPage() {
  if (!page.value || publishing.value) return
  if (dirty.value) {
    message.kind = 'error'
    message.text = 'Enregistre d’abord le brouillon avant de le publier.'
    return
  }
  if (!window.confirm('Publier cette révision sur le site ?')) return

  publishing.value = true
  message.kind = ''
  try {
    const response = await $fetch<{ page: CmsPageSnapshot }>(
      `/api/admin/pages/${page.value.id}/publish`,
      { method: 'POST', body: { revisionId: page.value.revisionId } },
    )
    page.value = structuredClone(response.page)
    await refreshSummaries()
    await nextTick()
    dirty.value = false
    message.kind = 'success'
    message.text = 'Page publiée immédiatement.'
  } catch (error) {
    showErrorMessage(error, 'La publication a échoué.')
  } finally {
    publishing.value = false
  }
}

function showErrorMessage(error: unknown, fallback: string) {
  const candidate = error as { data?: { statusMessage?: string }; message?: string }
  message.kind = 'error'
  message.text = candidate.data?.statusMessage || candidate.message || fallback
}
</script>

<template>
  <div class="cms-admin">
    <aside class="cms-admin__sidebar">
      <div>
        <p class="cms-admin__eyebrow">Contenu du site</p>
        <h1>Pages</h1>
      </div>
      <button
        v-for="summary in summaries"
        :key="summary.id"
        type="button"
        :class="['cms-admin__page-button', { 'is-active': summary.id === selectedPageId }]"
        @click="selectPage(summary.id)"
      >
        <span>{{ summary.title }}</span>
        <small>{{ summary.path }}</small>
        <span :class="['cms-admin__status', { 'is-published': summary.publishedRevisionId }]">
          {{ summary.publishedRevisionId ? 'Publiée' : 'Brouillon' }}
        </span>
      </button>
    </aside>

    <section class="cms-admin__editor" aria-live="polite">
      <p v-if="loadingPage" class="cms-admin__empty">Chargement…</p>
      <p v-else-if="!page" class="cms-admin__empty">Choisis une page à modifier.</p>

      <template v-else>
        <header class="cms-admin__editor-header">
          <div>
            <p class="cms-admin__eyebrow">{{ page.path }}</p>
            <h2>{{ page.title }}</h2>
            <p>
              Révision {{ page.revisionNumber }}
              <span v-if="dirty"> · Modifications non enregistrées</span>
            </p>
          </div>
          <div class="cms-admin__actions">
            <button type="button" :disabled="saving || !dirty" @click="saveDraft">
              {{ saving ? 'Enregistrement…' : 'Enregistrer le brouillon' }}
            </button>
            <button
              type="button"
              class="cms-admin__publish"
              :disabled="publishing || dirty"
              @click="publishPage"
            >
              {{ publishing ? 'Publication…' : 'Publier' }}
            </button>
          </div>
        </header>

        <p v-if="message.text" :class="['cms-admin__message', `is-${message.kind}`]">
          {{ message.text }}
        </p>

        <section class="cms-admin__panel">
          <h3>Page et référencement</h3>
          <div class="cms-admin__seo-grid">
            <label>
              <span>Nom interne</span>
              <input v-model="page.title" maxlength="160" />
            </label>
            <label>
              <span>Titre SEO</span>
              <input v-model="page.seo.title" maxlength="160" />
            </label>
            <label class="cms-admin__wide">
              <span>Description SEO</span>
              <textarea v-model="page.seo.description" rows="3" maxlength="320" />
            </label>
            <label class="cms-admin__check">
              <input v-model="page.seo.noindex" type="checkbox" />
              <span>Ne pas indexer cette page</span>
            </label>
            <div class="cms-admin__wide">
              <AdminCmsField
                v-model="page.seo.image"
                :schema="cmsSeoImageFieldSchema"
                name="seo.image"
              />
            </div>
          </div>
        </section>

        <section class="cms-admin__blocks">
          <div class="cms-admin__section-title">
            <div>
              <p class="cms-admin__eyebrow">Construction de la page</p>
              <h3>{{ page.blocks.length }} blocs</h3>
            </div>
            <div class="cms-admin__add-block">
              <select v-model="selectedBlockType">
                <option
                  v-for="definition in blockDefinitions"
                  :key="definition.type"
                  :value="definition.type"
                >
                  {{ definition.label }}
                </option>
              </select>
              <button type="button" @click="addBlock">+ Ajouter le bloc</button>
            </div>
          </div>

          <AdminCmsBlockEditor
            v-for="(block, index) in page.blocks"
            :key="block.id"
            :model-value="block"
            :index="index"
            :count="page.blocks.length"
            @update:model-value="updateBlock(index, $event)"
            @move="moveBlock(index, $event)"
            @remove="removeBlock(index)"
          />
        </section>

        <section class="cms-admin__panel">
          <label>
            <span>Note de modification (journal interne)</span>
            <input
              v-model="changeNote"
              maxlength="300"
              placeholder="Ex. Mise à jour de la rentrée"
            />
          </label>
        </section>
      </template>
    </section>
  </div>
</template>

<style scoped>
.cms-admin {
  display: grid;
  grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
  gap: clamp(1rem, 3vw, 2.5rem);
}

.cms-admin__sidebar {
  position: sticky;
  top: 6rem;
  display: grid;
  align-content: start;
  gap: 0.65rem;
  max-height: calc(100vh - 8rem);
  overflow-y: auto;
}

.cms-admin h1,
.cms-admin h2,
.cms-admin h3,
.cms-admin p {
  margin-top: 0;
}

.cms-admin__eyebrow {
  margin-bottom: 0.3rem;
  color: #687394;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.cms-admin__page-button {
  position: relative;
  display: grid;
  gap: 0.2rem;
  width: 100%;
  padding: 0.85rem;
  border: 1px solid #d7dceb;
  border-radius: 0.65rem;
  color: #27325e;
  background: white;
  text-align: left;
  cursor: pointer;
}

.cms-admin__page-button.is-active {
  border-color: #34499f;
  box-shadow: 0 0 0 2px rgb(52 73 159 / 12%);
}

.cms-admin__page-button > span:first-child {
  font-weight: 800;
}

.cms-admin__page-button small {
  color: #717994;
}

.cms-admin__status {
  position: absolute;
  top: 0.7rem;
  right: 0.7rem;
  color: #81520a;
  font-size: 0.62rem;
  font-weight: 800;
}

.cms-admin__status.is-published {
  color: #187044;
}

.cms-admin__editor,
.cms-admin__blocks {
  display: grid;
  align-content: start;
  gap: 1rem;
  min-width: 0;
}

.cms-admin__editor-header,
.cms-admin__section-title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.cms-admin__editor-header p:last-child {
  color: #717994;
  font-size: 0.8rem;
}

.cms-admin__actions,
.cms-admin__add-block {
  display: flex;
  gap: 0.55rem;
  flex-wrap: wrap;
}

.cms-admin__actions button,
.cms-admin__add-block button,
.cms-admin__add-block select {
  min-height: 2.65rem;
  padding: 0.55rem 0.8rem;
  border: 1px solid #cbd2e4;
  border-radius: 0.5rem;
  color: #2e3a6b;
  background: white;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 800;
}

.cms-admin__actions button,
.cms-admin__add-block button {
  cursor: pointer;
}

.cms-admin__actions .cms-admin__publish {
  color: white;
  border-color: #26398f;
  background: #26398f;
}

.cms-admin__actions button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.cms-admin__panel {
  padding: clamp(1rem, 2vw, 1.5rem);
  border: 1px solid #d9deec;
  border-radius: 0.85rem;
  background: white;
}

.cms-admin__panel h3 {
  margin-bottom: 1rem;
}

.cms-admin__panel label,
.cms-admin__seo-grid {
  display: grid;
  gap: 0.45rem;
}

.cms-admin__panel label > span {
  color: #4e587c;
  font-size: 0.78rem;
  font-weight: 800;
}

.cms-admin__panel input:not([type='checkbox']),
.cms-admin__panel textarea {
  width: 100%;
  padding: 0.7rem 0.8rem;
  border: 1px solid #cfd5e7;
  border-radius: 0.5rem;
  font: inherit;
}

.cms-admin__seo-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.cms-admin__wide {
  grid-column: 1 / -1;
}

.cms-admin__check {
  display: flex !important;
  align-items: center;
  grid-column: 1 / -1;
}

.cms-admin__message {
  margin-bottom: 0;
  padding: 0.75rem 1rem;
  border-radius: 0.55rem;
  font-size: 0.82rem;
  font-weight: 800;
}

.cms-admin__message.is-success {
  color: #17643f;
  background: #e7f6ed;
}

.cms-admin__message.is-error {
  color: #9d203a;
  background: #fbe9ed;
}

.cms-admin__empty {
  padding: 3rem;
  color: #6c7594;
  border: 1px dashed #cfd5e7;
  border-radius: 0.8rem;
  text-align: center;
}

@media (max-width: 920px) {
  .cms-admin {
    grid-template-columns: 1fr;
  }

  .cms-admin__sidebar {
    position: static;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    max-height: none;
  }

  .cms-admin__sidebar > div {
    grid-column: 1 / -1;
  }
}

@media (max-width: 620px) {
  .cms-admin__sidebar,
  .cms-admin__seo-grid {
    grid-template-columns: 1fr;
  }

  .cms-admin__editor-header,
  .cms-admin__section-title {
    display: grid;
  }
}
</style>
