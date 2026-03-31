<template>
  <div class="app">
    <header class="header" role="banner">
      <button class="btn-back" @click="router.push('/dashboard')" aria-label="ダッシュボードに戻る">← 戻る</button>
      <span class="title" role="heading" aria-level="1">ボスを選ぶ</span>
    </header>

    <main class="main" role="main">
      <div class="household-row">
        <label for="household-select">世帯人数：</label>
        <select id="household-select" v-model="householdSize" class="select-household" aria-label="世帯人数を選択">
          <option :value="1">1人</option>
          <option :value="2">2人</option>
          <option :value="3">3人</option>
          <option :value="4">4人</option>
          <option :value="5">5人</option>
        </select>
      </div>

      <div v-if="loading" class="loading" role="status" aria-live="polite">読み込み中...</div>
      <div v-else class="bosses-list" role="list" aria-label="ボス一覧">
        <div
          v-for="boss in store.bosses"
          :key="boss.id"
          class="boss-card"
          :class="`difficulty-${boss.difficulty}`"
          @click="selectBoss(boss.id)"
          role="listitem button"
          :aria-label="`${boss.name}を選択（難易度${boss.difficulty}、報酬${boss.reward_points}ポイント）`"
          tabindex="0"
          @keydown.enter="selectBoss(boss.id)"
        >
          <div class="boss-top">
            <div>
              <div class="boss-name">{{ BOSS_EMOJI[boss.difficulty] }} {{ boss.name }}</div>
              <div class="boss-stars">{{ '⭐'.repeat(boss.difficulty) }}</div>
            </div>
            <div class="boss-pts">+{{ boss.reward_points }}pt</div>
          </div>
          <div class="boss-desc">{{ boss.description }}</div>
          <div class="boss-budget">
            予算：{{ computeBudget(boss.budget_ratio) }}円
            <span class="boss-ratio">（平均の{{ Math.round(boss.budget_ratio * 100) }}%）</span>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCoinquestStore } from '@/stores/coinquest.store'

const router = useRouter()
const store = useCoinquestStore()
const loading = ref(true)
const householdSize = ref(store.monthStatus?.household_size ?? 1)

const BOSS_EMOJI: Record<number, string> = { 1: '🟢', 2: '🔵', 3: '🟠', 4: '🔴', 5: '💀' }

const avgForHousehold = computed(() => {
  const entry = store.avgExpensesData.find(e => e.household_size === householdSize.value)
  return entry?.average_monthly_expense ?? 163781
})

const computeBudget = (ratio: number) =>
  Math.round(avgForHousehold.value * ratio).toLocaleString()

onMounted(async () => {
  await Promise.all([store.loadBosses(), store.loadMonthStatus(), store.loadAverageExpenses()])
  // Déjà un boss ce mois-ci → retour dashboard
  if (store.monthStatus?.boss) {
    router.replace('/dashboard')
    return
  }
  loading.value = false
})

const selectBoss = async (bossId: number) => {
  await store.chooseBoss(bossId, householdSize.value)
  router.push('/dashboard')
}
</script>

<style scoped>
* { box-sizing: border-box; }
.app { min-height: 100vh; background: #0f0c29; color: white; font-family: system-ui, sans-serif; }
.header { display: flex; align-items: center; gap: 1rem; padding: 1rem; background: rgba(0,0,0,0.4); position: sticky; top: 0; }
.btn-back { background: none; border: none; color: rgba(255,255,255,0.7); cursor: pointer; font-size: 1rem; padding: 0.25rem; }
.title { font-weight: 700; font-size: 1.1rem; color: #ffd700; }
.main { padding: 1rem; max-width: 480px; margin: 0 auto; }
.household-row { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.25rem; }
.household-row label { color: rgba(255,255,255,0.7); font-size: 0.9rem; }
.select-household { background: rgba(30,20,60,0.9); border: 1px solid rgba(255,255,255,0.15); border-radius: 0.75rem; color: white; padding: 0.5rem 0.75rem; font-size: 0.9rem; }
.loading { text-align: center; padding: 3rem; opacity: 0.5; }
.bosses-list { display: flex; flex-direction: column; gap: 0.75rem; }
.boss-card { border-radius: 1.25rem; padding: 1.25rem; cursor: pointer; transition: transform 0.15s, opacity 0.15s; }
.boss-card:active { transform: scale(0.98); opacity: 0.85; }
.difficulty-1 { background: linear-gradient(135deg, #1a3a1a, #2d5a2d); border: 1px solid #4caf50; }
.difficulty-2 { background: linear-gradient(135deg, #1a2a4a, #2d4a7a); border: 1px solid #2196f3; }
.difficulty-3 { background: linear-gradient(135deg, #3a2a1a, #7a4a1a); border: 1px solid #ff9800; }
.difficulty-4 { background: linear-gradient(135deg, #3a1a1a, #7a2a2a); border: 1px solid #f44336; }
.difficulty-5 { background: linear-gradient(135deg, #2a1a3a, #4a1a6a); border: 1px solid #9c27b0; }
.boss-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; }
.boss-name { font-size: 1.15rem; font-weight: 800; }
.boss-stars { font-size: 0.85rem; margin-top: 0.2rem; }
.boss-pts { background: rgba(255,215,0,0.15); color: #ffd700; border-radius: 2rem; padding: 0.3rem 0.75rem; font-weight: 700; font-size: 0.9rem; }
.boss-desc { color: rgba(255,255,255,0.6); font-size: 0.85rem; margin-bottom: 0.6rem; }
.boss-budget { font-size: 0.9rem; font-weight: 600; }
.boss-ratio { color: rgba(255,255,255,0.5); font-size: 0.8rem; margin-left: 0.3rem; }
</style>
