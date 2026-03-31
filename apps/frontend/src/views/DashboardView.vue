<template>
  <div class="app">
    <header class="header">
      <span class="logo">⚔️ Coin Quest</span>
      <div class="header-right">
        <span class="username">{{ authStore.currentUser?.name }}</span>
        <button class="btn-icon" @click="router.push('/leaderboard')">🏆</button>
        <button class="btn-icon" @click="showDebug = !showDebug">🐛</button>
        <button class="btn-icon" @click="handleLogout">🚪</button>
      </div>
    </header>

    <div v-if="showDebug" class="debug-panel">
      <span>🐛 Date :</span>
      <input type="datetime-local" v-model="debugInput" />
      <button @click="applyDebugDate">Appliquer</button>
      <button @click="store.resetDebugDate()">Reset</button>
      <span v-if="store.debugDate" class="debug-active">{{ store.debugDate }}</span>
    </div>

    <main class="main">
      <div v-if="loading" class="loading">Chargement...</div>

      <template v-else-if="!status?.boss">
        <div class="no-boss-card">
          <div class="boss-emoji">👾</div>
          <h2>Aucun boss ce mois-ci</h2>
          <p>Choisissez un ennemi à vaincre pour commencer votre quête d'économies !</p>
          <button class="btn-primary" @click="router.push('/boss-select')">Choisir un boss</button>
        </div>
      </template>

      <template v-else>
        <div class="boss-card" :class="`difficulty-${status.boss.difficulty}`">
          <div class="boss-header">
            <div>
              <div class="boss-name">{{ BOSS_EMOJI[status.boss.difficulty] }} {{ status.boss.name }}</div>
              <div class="boss-diff">{{ '⭐'.repeat(status.boss.difficulty) }} · {{ status.boss.reward_points }} pts</div>
            </div>
            <div v-if="status.result" class="result-badge" :class="status.result">
              {{ status.result === 'win' ? '🏆 Victoire !' : '💀 Défaite' }}
            </div>
            <button v-else class="btn-sm" @click="router.push('/boss-select')">Changer</button>
          </div>

          <div class="budget-section">
            <div class="budget-row">
              <span>Budget : {{ fmt(status.budget) }}¥</span>
              <span :class="(status.remaining ?? 0) < 0 ? 'danger' : 'safe'">
                Reste : {{ fmt(status.remaining) }}¥
              </span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: `${Math.min(status.progress_pct ?? 0, 100)}%`, background: progressColor }"></div>
            </div>
            <div class="progress-label">{{ status.total_expenses }}¥ / {{ status.budget }}¥ · {{ status.progress_pct ?? 0 }}%</div>
          </div>

          <button v-if="!status.result" class="btn-battle" @click="handleBattle">⚔️ Lancer le combat !</button>
          <div v-if="battleMsg" class="battle-msg">{{ battleMsg }}</div>
        </div>

        <div class="section-title">➕ Ajouter une dépense</div>
        <div class="expense-form">
          <div class="form-row">
            <input v-model.number="newAmount" type="number" placeholder="Montant (¥)" min="1" class="input-amount" />
            <select v-model="newCategory" class="input-cat">
              <option value="">Catégorie</option>
              <option v-for="cat in CATEGORIES" :key="cat" :value="cat">{{ CATEGORY_LABELS[cat] }}</option>
            </select>
          </div>
          <div class="form-row">
            <input v-model="newNote" type="text" placeholder="Note (optionnel)" class="input-note" />
            <button class="btn-add" :disabled="!newAmount || !newCategory || addingExpense" @click="handleAddExpense">
              {{ addingExpense ? '...' : 'OK' }}
            </button>
          </div>
        </div>

        <div class="section-title">📋 Dépenses du mois</div>
        <div v-if="store.expenses.length === 0" class="empty">Aucune dépense enregistrée</div>
        <div v-else class="expenses-list">
          <div v-for="e in store.expenses" :key="e.id" class="expense-item">
            <div class="expense-info">
              <span class="expense-cat">{{ CATEGORY_LABELS[e.category] ?? e.category }}</span>
              <span class="expense-note">{{ e.note }}</span>
            </div>
            <div class="expense-right">
              <span class="expense-amount">{{ fmt(e.amount) }}¥</span>
              <button class="btn-del" @click="store.removeExpense(e.id)">✕</button>
            </div>
          </div>
        </div>
      </template>
    </main>

    <nav class="bottom-nav">
      <button class="active">🏠 Accueil</button>
      <button @click="router.push('/boss-select')">👾 Boss</button>
      <button @click="router.push('/leaderboard')">🏆 Classement</button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores'
import { useCoinquestStore } from '@/stores/coinquest.store'
import { CATEGORIES, CATEGORY_LABELS } from '@/services/coinquest.service'

const router = useRouter()
const authStore = useAuthStore()
const store = useCoinquestStore()

const loading = ref(true)
const showDebug = ref(false)
const debugInput = ref('')
const newAmount = ref<number | null>(null)
const newCategory = ref('')
const newNote = ref('')
const addingExpense = ref(false)
const battleMsg = ref('')

const BOSS_EMOJI: Record<number, string> = { 1: '🟢', 2: '🔵', 3: '🟠', 4: '🔴', 5: '💀' }
const status = computed(() => store.monthStatus)
const progressColor = computed(() => {
  const pct = status.value?.progress_pct ?? 0
  if (pct < 60) return '#4caf50'
  if (pct < 85) return '#ff9800'
  return '#f44336'
})
const fmt = (n: number | null | undefined) => n !== null && n !== undefined ? n.toLocaleString() : '—'

onMounted(async () => {
  await Promise.all([store.loadMonthStatus(), store.loadExpenses(), store.loadDebugDate()])
  loading.value = false
})

const handleLogout = async () => {
  await authStore.logout()
  router.push('/login')
}

const handleAddExpense = async () => {
  if (!newAmount.value || !newCategory.value) return
  addingExpense.value = true
  try {
    await store.addExpense({ amount: newAmount.value, category: newCategory.value, note: newNote.value || undefined })
    newAmount.value = null
    newCategory.value = ''
    newNote.value = ''
  } finally {
    addingExpense.value = false
  }
}

const handleBattle = async () => {
  const result = await store.battle()
  battleMsg.value = result.message
}

const applyDebugDate = async () => {
  if (!debugInput.value) return
  await store.setDebugDate(new Date(debugInput.value).toISOString())
}
</script>

<style scoped>
* { box-sizing: border-box; }
.app { min-height: 100vh; background: #0f0c29; color: white; font-family: system-ui, sans-serif; display: flex; flex-direction: column; }
.header { display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: rgba(0,0,0,0.4); position: sticky; top: 0; z-index: 10; }
.logo { font-weight: 800; color: #ffd700; font-size: 1.1rem; }
.header-right { display: flex; align-items: center; gap: 0.5rem; }
.username { color: rgba(255,255,255,0.6); font-size: 0.85rem; }
.btn-icon { background: none; border: none; font-size: 1.2rem; cursor: pointer; padding: 0.25rem; }
.debug-panel { background: rgba(255,200,0,0.1); border-bottom: 1px solid rgba(255,200,0,0.3); padding: 0.75rem 1rem; display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; font-size: 0.85rem; }
.debug-panel input { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); border-radius: 0.5rem; color: white; padding: 0.3rem 0.5rem; font-size: 0.8rem; }
.debug-panel button { background: rgba(255,200,0,0.2); border: 1px solid rgba(255,200,0,0.4); border-radius: 0.5rem; color: #ffd700; padding: 0.3rem 0.6rem; cursor: pointer; font-size: 0.8rem; }
.debug-active { color: #ffd700; font-size: 0.8rem; }
.main { flex: 1; padding: 1rem; padding-bottom: 5rem; max-width: 480px; margin: 0 auto; width: 100%; }
.loading { text-align: center; padding: 3rem; opacity: 0.5; }
.no-boss-card { text-align: center; background: rgba(255,255,255,0.05); border-radius: 1.5rem; padding: 2rem; margin-top: 2rem; }
.boss-emoji { font-size: 4rem; margin-bottom: 1rem; }
.no-boss-card h2 { margin: 0 0 0.5rem; }
.no-boss-card p { color: rgba(255,255,255,0.5); margin-bottom: 1.5rem; font-size: 0.9rem; }
.boss-card { border-radius: 1.25rem; padding: 1.25rem; margin-bottom: 1.25rem; }
.difficulty-1 { background: linear-gradient(135deg, #1a3a1a, #2d5a2d); border: 1px solid #4caf50; }
.difficulty-2 { background: linear-gradient(135deg, #1a2a4a, #2d4a7a); border: 1px solid #2196f3; }
.difficulty-3 { background: linear-gradient(135deg, #3a2a1a, #7a4a1a); border: 1px solid #ff9800; }
.difficulty-4 { background: linear-gradient(135deg, #3a1a1a, #7a2a2a); border: 1px solid #f44336; }
.difficulty-5 { background: linear-gradient(135deg, #2a1a3a, #4a1a6a); border: 1px solid #9c27b0; }
.boss-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; }
.boss-name { font-size: 1.25rem; font-weight: 800; }
.boss-diff { font-size: 0.8rem; color: rgba(255,255,255,0.6); margin-top: 0.25rem; }
.result-badge { padding: 0.4rem 0.75rem; border-radius: 2rem; font-weight: 700; font-size: 0.9rem; }
.result-badge.win { background: rgba(76,175,80,0.3); color: #4caf50; }
.result-badge.lose { background: rgba(244,67,54,0.3); color: #f44336; }
.btn-sm { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 0.5rem; color: white; padding: 0.4rem 0.75rem; cursor: pointer; font-size: 0.85rem; }
.budget-section { margin-bottom: 1rem; }
.budget-row { display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 0.5rem; }
.safe { color: #4caf50; }
.danger { color: #f44336; }
.progress-bar { height: 12px; background: rgba(0,0,0,0.4); border-radius: 6px; overflow: hidden; margin-bottom: 0.35rem; }
.progress-fill { height: 100%; border-radius: 6px; transition: width 0.5s ease; }
.progress-label { font-size: 0.75rem; color: rgba(255,255,255,0.5); text-align: right; }
.btn-battle { width: 100%; padding: 0.85rem; border: none; border-radius: 0.75rem; background: linear-gradient(135deg, #ffd700, #ff8c00); color: #0f0c29; font-size: 1rem; font-weight: 800; cursor: pointer; margin-top: 0.5rem; }
.battle-msg { margin-top: 0.75rem; padding: 0.75rem; background: rgba(255,255,255,0.08); border-radius: 0.75rem; font-size: 0.9rem; text-align: center; }
.section-title { font-weight: 700; margin-bottom: 0.75rem; color: rgba(255,255,255,0.7); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.05em; }
.expense-form { background: rgba(255,255,255,0.05); border-radius: 1rem; padding: 1rem; margin-bottom: 1.25rem; }
.form-row { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; }
.form-row:last-child { margin-bottom: 0; }
.input-amount { width: 40%; padding: 0.65rem; border-radius: 0.75rem; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.08); color: white; font-size: 1rem; }
.input-cat { flex: 1; padding: 0.65rem; border-radius: 0.75rem; border: 1px solid rgba(255,255,255,0.15); background: rgba(30,20,60,0.9); color: white; font-size: 0.9rem; }
.input-note { flex: 1; padding: 0.65rem; border-radius: 0.75rem; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.08); color: white; font-size: 0.9rem; }
.btn-add { padding: 0.65rem 1.25rem; border: none; border-radius: 0.75rem; background: #ffd700; color: #0f0c29; font-weight: 700; cursor: pointer; font-size: 1rem; }
.btn-add:disabled { opacity: 0.5; cursor: not-allowed; }
.empty { text-align: center; color: rgba(255,255,255,0.3); padding: 2rem; font-size: 0.9rem; }
.expenses-list { display: flex; flex-direction: column; gap: 0.5rem; }
.expense-item { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); border-radius: 0.75rem; padding: 0.75rem 1rem; }
.expense-info { display: flex; flex-direction: column; gap: 0.2rem; }
.expense-cat { font-weight: 600; font-size: 0.9rem; }
.expense-note { font-size: 0.8rem; color: rgba(255,255,255,0.4); }
.expense-right { display: flex; align-items: center; gap: 0.75rem; }
.expense-amount { font-weight: 700; color: #ffd700; }
.btn-del { background: none; border: none; color: rgba(255,100,100,0.7); cursor: pointer; font-size: 0.9rem; padding: 0.25rem; }
.btn-primary { padding: 0.9rem 2rem; border: none; border-radius: 0.75rem; background: linear-gradient(135deg, #ffd700, #ff8c00); color: #0f0c29; font-size: 1rem; font-weight: 700; cursor: pointer; }
.bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; display: flex; background: rgba(15,12,41,0.95); border-top: 1px solid rgba(255,255,255,0.1); }
.bottom-nav button { flex: 1; padding: 0.85rem; border: none; background: none; color: rgba(255,255,255,0.5); cursor: pointer; font-size: 0.8rem; }
.bottom-nav button.active { color: #ffd700; font-weight: 700; }
</style>
