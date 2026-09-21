<script setup lang="ts">
import type { CmsUser, CmsUserRole } from '#shared/types/cms'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

useSeoMeta({
  title: 'Utilisateurs · Wolves CMS',
  robots: 'noindex, nofollow',
})

const roles: Array<{ value: CmsUserRole; label: string }> = [
  { value: 'editor', label: 'Éditeur' },
  { value: 'admin', label: 'Administrateur' },
  { value: 'super_admin', label: 'Super administrateur' },
]

const form = reactive({
  discordId: '',
  username: '',
  displayName: '',
  role: 'editor' as CmsUserRole,
})
const saving = ref(false)
const message = reactive({ kind: '' as 'success' | 'error' | '', text: '' })

const {
  data: users,
  refresh,
  error: loadError,
} = await useFetch<CmsUser[]>('/api/admin/users', { default: () => [] })

async function addUser() {
  if (saving.value) return
  if (!/^\d{17,20}$/.test(form.discordId)) {
    setMessage('error', 'L’identifiant Discord doit contenir 17 à 20 chiffres.')
    return
  }

  saving.value = true
  try {
    await $fetch('/api/admin/users', {
      method: 'POST',
      body: {
        discordId: form.discordId,
        username: form.username,
        displayName: form.displayName || null,
        role: form.role,
        isActive: true,
      },
    })
    form.discordId = ''
    form.username = ''
    form.displayName = ''
    form.role = 'editor'
    await refresh()
    setMessage('success', 'Utilisateur autorisé. Son rôle sera lié à cet ID Discord.')
  } catch (error) {
    showError(error, 'Impossible d’ajouter cet utilisateur.')
  } finally {
    saving.value = false
  }
}

async function updateUser(user: CmsUser, patch: Partial<Pick<CmsUser, 'role' | 'isActive'>>) {
  try {
    await $fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      body: patch,
    })
    await refresh()
    setMessage('success', 'Droits mis à jour.')
  } catch (error) {
    showError(error, 'Impossible de modifier cet utilisateur.')
  }
}

function onRoleChange(user: CmsUser, event: Event) {
  void updateUser(user, { role: (event.target as HTMLSelectElement).value as CmsUserRole })
}

function setMessage(kind: 'success' | 'error', text: string) {
  message.kind = kind
  message.text = text
}

function showError(error: unknown, fallback: string) {
  const candidate = error as { data?: { statusMessage?: string }; message?: string }
  setMessage('error', candidate.data?.statusMessage || candidate.message || fallback)
}
</script>

<template>
  <div class="cms-users">
    <header>
      <p class="cms-users__eyebrow">Accès au CMS</p>
      <h1>Utilisateurs et rôles</h1>
      <p>
        Les noms servent à reconnaître les personnes. L’autorisation repose toujours sur leur
        identifiant Discord numérique, qui ne change pas.
      </p>
    </header>

    <p v-if="loadError" class="cms-users__message is-error">
      Cette page est réservée au super administrateur.
    </p>

    <template v-else>
      <p v-if="message.text" :class="['cms-users__message', `is-${message.kind}`]">
        {{ message.text }}
      </p>

      <section class="cms-users__panel">
        <h2>Autoriser une personne</h2>
        <form class="cms-users__form" @submit.prevent="addUser">
          <label>
            <span>ID Discord numérique</span>
            <input
              v-model.trim="form.discordId"
              inputmode="numeric"
              pattern="[0-9]{17,20}"
              placeholder="123456789012345678"
              required
            />
          </label>
          <label>
            <span>Nom Discord actuel</span>
            <input
              v-model.trim="form.username"
              placeholder="coach-exemple"
              maxlength="80"
              required
            />
          </label>
          <label>
            <span>Nom affiché (facultatif)</span>
            <input v-model.trim="form.displayName" maxlength="100" />
          </label>
          <label>
            <span>Rôle</span>
            <select v-model="form.role">
              <option v-for="role in roles" :key="role.value" :value="role.value">
                {{ role.label }}
              </option>
            </select>
          </label>
          <button type="submit" :disabled="saving">
            {{ saving ? 'Ajout…' : 'Autoriser l’utilisateur' }}
          </button>
        </form>
      </section>

      <section class="cms-users__panel">
        <h2>Comptes autorisés</h2>
        <div class="cms-users__list">
          <article v-for="user in users" :key="user.id" class="cms-users__user">
            <div>
              <strong>{{ user.displayName || user.username }}</strong>
              <span>@{{ user.username }} · {{ user.discordId }}</span>
              <small>
                {{
                  user.lastLoginAt ? `Dernière connexion : ${user.lastLoginAt}` : 'Jamais connecté'
                }}
              </small>
            </div>
            <label>
              <span>Rôle</span>
              <select :value="user.role" @change="onRoleChange(user, $event)">
                <option v-for="role in roles" :key="role.value" :value="role.value">
                  {{ role.label }}
                </option>
              </select>
            </label>
            <button
              type="button"
              :class="{ 'is-danger': user.isActive }"
              @click="updateUser(user, { isActive: !user.isActive })"
            >
              {{ user.isActive ? 'Désactiver' : 'Réactiver' }}
            </button>
          </article>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.cms-users {
  display: grid;
  gap: 1.25rem;
  max-width: 1080px;
  margin: 0 auto;
  color: #25305d;
}

.cms-users h1,
.cms-users h2,
.cms-users p {
  margin-top: 0;
}

.cms-users header > p:last-child {
  max-width: 48rem;
  color: #68718f;
}

.cms-users__eyebrow {
  margin-bottom: 0.35rem;
  color: #6b7595;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.cms-users__panel {
  padding: clamp(1rem, 3vw, 1.6rem);
  border: 1px solid #d7ddeb;
  border-radius: 0.8rem;
  background: white;
}

.cms-users__form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.cms-users label {
  display: grid;
  gap: 0.4rem;
  color: #596383;
  font-size: 0.78rem;
  font-weight: 800;
}

.cms-users input,
.cms-users select,
.cms-users button {
  min-height: 2.65rem;
  padding: 0.6rem 0.75rem;
  border: 1px solid #cdd3e4;
  border-radius: 0.5rem;
  color: #27325f;
  background: white;
  font: inherit;
}

.cms-users button {
  align-self: end;
  color: white;
  border-color: #283b91;
  background: #283b91;
  font-weight: 800;
  cursor: pointer;
}

.cms-users button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.cms-users__list {
  display: grid;
  gap: 0.7rem;
}

.cms-users__user {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(150px, 220px) auto;
  align-items: end;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid #e0e4ef;
  border-radius: 0.65rem;
}

.cms-users__user strong,
.cms-users__user span,
.cms-users__user small {
  display: block;
}

.cms-users__user span,
.cms-users__user small {
  margin-top: 0.2rem;
  color: #727a95;
  font-size: 0.74rem;
}

.cms-users__user button.is-danger {
  color: #9d203b;
  border-color: #ecc8d0;
  background: white;
}

.cms-users__message {
  margin-bottom: 0;
  padding: 0.8rem 1rem;
  border-radius: 0.55rem;
  font-weight: 800;
}

.cms-users__message.is-success {
  color: #17643f;
  background: #e7f6ed;
}

.cms-users__message.is-error {
  color: #9d203a;
  background: #fbe9ed;
}

@media (max-width: 720px) {
  .cms-users__form,
  .cms-users__user {
    grid-template-columns: 1fr;
  }
}
</style>
