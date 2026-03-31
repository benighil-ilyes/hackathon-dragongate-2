<template>
  <div class="app">
    <header class="header" role="banner">
      <button class="btn-back" @click="router.push('/dashboard')" aria-label="ダッシュボードに戻る">← 戻る</button>
      <span class="title" role="heading" aria-level="1">📜 冒険履歴</span>
    </header>

    <main class="main" role="main">
      <div v-if="loading" class="loading" role="status" aria-live="polite">読み込み中...</div>

      <div v-else-if="store.monthHistory.length === 0" class="empty">
        過去の履歴がまだありません。<br>今月のクエストを完了しよう！
      </div>

      <div v-else class="history-list" role="list" aria-label="月ごとの冒険履歴">
        <div
          v-for="item in store.monthHistory"
          :key="item.id"
          class="history-card"
          :class="item.result === 'win' ? 'win' : item.result === 'lose' ? 'lose' : 'pending'"
          role="listitem"
          :aria-label="`${item.year}年${item.month}月 ${item.boss_name ?? 'ボスなし'} ${resultLabel(item.result)}`"
        >
          <div class="card-header">
            <div class="month-info">
              <span class="month-title">{{ item.year }}年{{ item.month }}月</span>
              <span class="boss-name">{{ BOSS_EMOJI[item.boss_difficulty ?? 0] ?? '❓' }} {{ item.boss_name ?? '—' }}</span>
            </div>
            <div class="result-badge" :class="item.result ?? 'none'">
              {{ resultLabel(item.result) }}
            </div>
          </div>

          <div v-if="item.budget" class="budget-section">
            <div class="budget-labels">
              <span>{{ item.total_expenses.toLocaleString() }}円 使用</span>
              <span>予算 {{ item.budget.toLocaleString() }}円</span>
            </div>
            <div class="budget-track" role="progressbar"
              :aria-valuenow="Math.min(item.total_expenses, item.budget)"
              :aria-valuemax="item.budget"
              :aria-label="`予算使用率 ${Math.round((item.total_expenses / item.budget) * 100)}%`">
              <div
                class="budget-fill"
                :style="{
                  width: `${Math.min(100, Math.round((item.total_expenses / item.budget) * 100))}%`,
                  background: fillColor(item.total_expenses, item.budget)
                }"
              ></div>
            </div>
            <div class="budget-pct">
              {{ Math.round((item.total_expenses / item.budget) * 100) }}%使用
              <span v-if="item.score" class="score-badge">+{{ item.score }}pt</span>
            </div>
          </div>

          <div v-if="!item.boss_name" class="no-boss">ボス未選択</div>
          <div v-else-if="!item.result" class="no-result">結果未定（月末決戦がまだです）</div>
        </div>
      </div>
    </main>

    <nav class="bottom-nav" role="navigation" aria-label="メインナビゲーション">
      <button @click="router.push('/dashboard')" aria-label="ホーム">🏠 ホーム</button>
      <button @click="router.push('/boss-select')" aria-label="ボス選択">👾 ボス</button>
      <button @click="router.push('/leaderboard')" aria-label="ランキング">🏆 ランキング</button>
      <button class="active" aria-label="冒険履歴（現在のページ）" aria-current="page">📜 履歴</button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCoinquestStore } from '@/stores/coinquest.store'

const router = useRouter()
const store = useCoinquestStore()
const loading = ref(true)

const BOSS_EMOJI: Record<number, string> = { 1: '🟢', 2: '🔵', 3: '🟠', 4: '🔴', 5: '💀' }

const resultLabel = (result: string | null) => {
  if (result === 'win') return '🏆 勝利'
  if (result === 'lose') return '💀 敗北'
  return '⏳ 未決戦'
}

const fillColor = (spent: number, budget: number) => {
  const pct = spent / budget
  if (pct <= 0.5) return 'linear-gradient(90deg, #4caf50, #8bc34a)'
  if (pct <= 0.75) return 'linear-gradient(90deg, #ff9800, #ffc107)'
  return 'linear-gradient(90deg, #f44336, #ff5722)'
}

onMounted(async () => {
  await store.loadMonthHistory()
  loading.value = false
})
</script>

<style scoped>
* { box-sizing: border-box; }
.app { min-height: 100vh; background: #0f0c29; color: white; font-family: system-ui, sans-serif; display: flex; flex-direction: column; }

.header { display: flex; align-items: center; gap: 1rem; padding: 1rem; background: rgba(0,0,0,0.4); position: sticky; top: 0; z-index: 10; border-bottom: 1px solid rgba(255,255,255,0.08); }
.btn-back { background: none; border: none; color: rgba(255,255,255,0.7); cursor: pointer; font-size: 1rem; padding: 0.25rem; }
.title { font-weight: 700; font-size: 1.1rem; color: #ffd700; }

.main { flex: 1; padding: 1rem; padding-bottom: 5rem; max-width: 480px; margin: 0 auto; width: 100%; }
.loading { text-align: center; padding: 3rem; opacity: 0.5; }
.empty { text-align: center; color: rgba(255,255,255,0.3); padding: 3rem; font-size: 0.9rem; line-height: 1.8; }

.history-list { display: flex; flex-direction: column; gap: 0.75rem; }

.history-card { border-radius: 1.25rem; padding: 1.1rem; border: 1px solid rgba(255,255,255,0.08); }
.history-card.win { background: linear-gradient(135deg, rgba(76,175,80,0.12), rgba(27,94,32,0.2)); border-color: rgba(76,175,80,0.3); }
.history-card.lose { background: linear-gradient(135deg, rgba(244,67,54,0.1), rgba(74,20,20,0.2)); border-color: rgba(244,67,54,0.25); }
.history-card.pending { background: rgba(255,255,255,0.04); }

.card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.85rem; }
.month-info { display: flex; flex-direction: column; gap: 0.25rem; }
.month-title { font-size: 1rem; font-weight: 800; color: white; }
.boss-name { font-size: 0.85rem; color: rgba(255,255,255,0.55); }

.result-badge { padding: 0.3rem 0.7rem; border-radius: 2rem; font-size: 0.8rem; font-weight: 700; }
.result-badge.win { background: rgba(76,175,80,0.2); color: #4caf50; }
.result-badge.lose { background: rgba(244,67,54,0.2); color: #f44336; }
.result-badge.none { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.4); }

.budget-section { }
.budget-labels { display: flex; justify-content: space-between; font-size: 0.78rem; color: rgba(255,255,255,0.5); margin-bottom: 0.35rem; }
.budget-track { height: 12px; background: rgba(0,0,0,0.4); border-radius: 6px; overflow: hidden; margin-bottom: 0.35rem; border: 1px solid rgba(255,255,255,0.06); }
.budget-fill { height: 100%; border-radius: 6px; transition: width 0.5s ease; }
.budget-pct { font-size: 0.78rem; color: rgba(255,255,255,0.4); display: flex; justify-content: space-between; align-items: center; }
.score-badge { background: rgba(255,215,0,0.15); color: #ffd700; border-radius: 2rem; padding: 0.15rem 0.5rem; font-weight: 700; }

.no-boss { font-size: 0.8rem; color: rgba(255,255,255,0.3); font-style: italic; }
.no-result { font-size: 0.78rem; color: rgba(255,200,0,0.5); margin-top: 0.35rem; }

.bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; display: flex; background: rgba(10,8,30,0.97); border-top: 1px solid rgba(255,255,255,0.08); }
.bottom-nav button { flex: 1; padding: 0.85rem; border: none; background: none; color: rgba(255,255,255,0.4); cursor: pointer; font-size: 0.78rem; }
.bottom-nav button.active { color: #ffd700; font-weight: 700; }
</style>
