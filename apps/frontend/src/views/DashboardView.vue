<template>
  <div class="app">
    <header class="header" role="banner">
      <span class="logo" role="img" aria-label="Coin Quest">⚔️ Coin Quest</span>
      <div class="header-right">
        <div class="user-info" aria-label="ユーザー情報">
          <span class="username">{{ authStore.currentUser?.name }}</span>
          <span v-if="store.profile" class="user-rank" aria-label="冒険者ランク">{{ store.profile.rank }}</span>
        </div>
        <button class="btn-icon" @click="handleLogout" aria-label="ログアウト">🚪</button>
      </div>
    </header>

    <main class="main" role="main">
      <div v-if="loading" class="loading" role="status" aria-live="polite">読み込み中...</div>

      <template v-else>

        <!-- Month header + date switcher -->
        <div class="month-header" role="region" aria-label="現在の月情報">
          <span class="month-label">{{ currentMonthLabel }}</span>
          <div class="date-switcher">
            <label for="debug-date-input" class="date-switcher-label">📅 現在日付</label>
            <input id="debug-date-input" type="date" v-model="debugDateInput" class="date-input" @change="applyDebugDate" aria-label="デバッグ日付を設定" />
            <button v-if="store.debugDate" class="date-reset" @click="resetDate" aria-label="今日の日付に戻す">今日に戻す</button>
          </div>
        </div>

        <!-- Step 1 : No boss → choose one -->
        <div v-if="!status?.boss" class="step-card" role="region" aria-label="ボス選択ステップ">
          <div class="step-number">STEP 1</div>
          <div class="step-content">
            <div class="step-icon" aria-hidden="true">👾</div>
            <div class="step-text">
              <div class="step-title">今月のボスを選ぼう</div>
              <div class="step-desc">倒すべき敵を選んで節約クエストを開始！</div>
            </div>
          </div>
          <button class="btn-primary" @click="router.push('/boss-select')" aria-label="ボス選択画面に移動">ボスを選ぶ →</button>
        </div>

        <!-- Step 2 : Boss selected → show status + expenses -->
        <template v-else>

          <!-- Boss status card -->
          <div class="boss-status" :class="`d${status.boss.difficulty}`" role="region" :aria-label="`今月のボス：${status.boss.name}`">
            <div class="boss-status-top">
              <div class="boss-status-left">
                <div class="boss-status-name">{{ BOSS_EMOJI[status.boss.difficulty] }} {{ status.boss.name }}</div>
                <div class="boss-status-stars">{{ '⭐'.repeat(status.boss.difficulty) }} · {{ status.boss.reward_points }}pt</div>
              </div>
              <div v-if="status.result" class="result-pill" :class="status.result">
                {{ status.result === 'win' ? '🏆 勝利' : '💀 敗北' }}
              </div>
            </div>

            <!-- Boss HP bar -->
            <div class="hp-wrap" role="region" aria-label="予算残高">
              <div class="hp-header">
                <span class="hp-label" aria-hidden="true">❤️ HP</span>
                <span class="hp-value" :class="(status.remaining ?? 0) < 0 ? 'over' : ''" aria-live="polite">
                  {{ Math.max(status.remaining ?? 0, 0).toLocaleString() }} / {{ (status.budget ?? 0).toLocaleString() }}円
                </span>
              </div>
              <div class="hp-track" role="progressbar"
                :aria-valuenow="hpPercent"
                aria-valuemin="0"
                aria-valuemax="100"
                :aria-label="`残り予算 ${hpPercent}%`">
                <div class="hp-fill" :style="{ width: `${hpPercent}%`, background: hpColor }"></div>
              </div>
              <div class="hp-sub">
                <span>{{ (status.total_expenses ?? 0).toLocaleString() }}円 消費</span>
                <span :class="(status.remaining ?? 0) < 0 ? 'over' : 'safe'">
                  {{ (status.remaining ?? 0) < 0 ? '⚠️ 予算オーバー！' : `残り ${(status.remaining ?? 0).toLocaleString()}円` }}
                </span>
              </div>
            </div>

            <!-- Battle -->
            <button v-if="!status.result" class="btn-battle" @click="handleBattle" aria-label="月末決戦を開始する">⚔️ 月末決戦！</button>
            <div v-if="battleMsg" class="battle-result" role="alert" aria-live="assertive">{{ battleMsg }}</div>
          </div>

          <!-- Category breakdown -->
          <div v-if="categoryBreakdown.length > 0" class="category-card" role="region" aria-label="カテゴリ別支出内訳">
            <div class="card-title">📊 カテゴリ別内訳</div>

            <!-- Pie chart -->
            <div v-if="pieSlices.length > 0" class="pie-wrap">
              <svg viewBox="0 0 120 120" class="pie-svg" aria-hidden="true">
                <path v-for="(s, i) in pieSlices" :key="i"
                  :d="slicePath(60, 60, 54, s.startAngle, s.endAngle)"
                  :fill="s.color"
                  stroke="#0f0c29" stroke-width="1.5"
                />
                <circle cx="60" cy="60" r="28" fill="#0f0c29" />
                <text x="60" y="56" text-anchor="middle" fill="white" font-size="9" font-weight="bold">合計</text>
                <text x="60" y="68" text-anchor="middle" fill="#ffd700" font-size="8">
                  {{ Math.round(pieSlices.reduce((s, p) => s + p.spent, 0) / 1000) }}k円
                </text>
              </svg>
              <div class="pie-legend">
                <div v-for="s in pieSlices" :key="s.name" class="legend-item">
                  <span class="legend-dot" :style="{ background: s.color }"></span>
                  <span class="legend-name">{{ s.name }}</span>
                  <span class="legend-pct">{{ Math.round(s.pct * 100) }}%</span>
                </div>
              </div>
            </div>

            <div class="cat-list">
              <div v-for="cat in categoryBreakdown" :key="cat.name" class="cat-item"
                :aria-label="`${cat.name}：${cat.spent.toLocaleString()}円（平均${cat.avg.toLocaleString()}円）`">
                <div class="cat-item-header">
                  <span class="cat-dot" :style="{ background: catColor(cat.name) }" aria-hidden="true"></span>
                  <span class="cat-name">{{ cat.name }}</span>
                  <span class="cat-amounts">
                    <span class="cat-spent" :class="cat.spent > cat.avg ? 'over' : ''">{{ cat.spent.toLocaleString() }}円</span>
                    <span class="cat-avg">/ {{ cat.avg.toLocaleString() }}円</span>
                  </span>
                </div>
                <div class="cat-track" role="presentation">
                  <div class="cat-avg-bar" :style="{ width: '100%' }" aria-hidden="true"></div>
                  <div class="cat-spent-bar"
                    :style="{
                      width: `${Math.min(100, cat.avg > 0 ? Math.round((cat.spent / cat.avg) * 100) : 100)}%`,
                      background: catColor(cat.name)
                    }"
                    aria-hidden="true"
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Add expense -->
          <div class="add-expense-card" role="region" aria-label="支出を記録">
            <div class="card-title-row">
              <span class="card-title">➕ 支出を記録する</span>
              <div class="date-row">
                <span class="date-display" @click="showDatePicker = !showDatePicker"
                  role="button" tabindex="0" @keydown.enter="showDatePicker = !showDatePicker"
                  :aria-label="`日付：${formatDateShort(newDate)}（クリックして変更）`">
                  📅 {{ formatDateShort(newDate) }}
                  <span class="date-edit-hint" aria-hidden="true">変更</span>
                </span>
              </div>
            </div>
            <div v-if="showDatePicker" class="date-picker-wrap">
              <input
                type="date"
                v-model="newDate"
                :min="monthMin"
                :max="monthMax"
                class="inp inp-date-full"
                @change="showDatePicker = false"
                aria-label="支出日を選択"
              />
            </div>
            <div v-if="addError" class="add-error" role="alert">⚠️ {{ addError }}</div>
            <div class="add-row">
              <input v-model.number="newAmount" type="number" placeholder="金額（円）" min="1" class="inp inp-amount" aria-label="金額（円）" />
              <select v-model="newCategory" class="inp inp-cat" aria-label="カテゴリを選択">
                <option value="">カテゴリ</option>
                <option v-for="cat in CATEGORIES" :key="cat" :value="cat">{{ cat }}</option>
              </select>
            </div>
            <div class="add-row">
              <input v-model="newNote" type="text" placeholder="メモ（任意）" class="inp inp-note" aria-label="メモ（任意）" />
              <button class="btn-add" :disabled="!newAmount || !newCategory || adding" @click="handleAdd"
                :aria-label="adding ? '保存中' : '支出を追加'" :aria-busy="adding">
                {{ adding ? '…' : '追加' }}
              </button>
            </div>
          </div>

          <!-- Expenses by date -->
          <div class="expenses-section" role="region" aria-label="今月の支出履歴">
            <div class="card-title">📅 支出履歴</div>

            <div v-if="store.expenses.length === 0" class="empty" aria-live="polite">まだ支出が登録されていません</div>

            <template v-else>
              <template v-for="(group, date) in groupedExpenses" :key="date">
                <div class="date-label" role="heading" aria-level="3">{{ formatDate(date) }}</div>
                <div class="expense-group" role="list">
                  <div v-for="e in group" :key="e.id" class="expense-row" role="listitem"
                    :aria-label="`${e.category}：${e.amount.toLocaleString()}円${e.note ? '（' + e.note + '）' : ''}`">
                    <div class="expense-cat-dot" :style="{ background: catColor(e.category) }" aria-hidden="true"></div>
                    <div class="expense-main">
                      <span class="expense-cat">{{ e.category }}</span>
                      <span v-if="e.note" class="expense-note">{{ e.note }}</span>
                    </div>
                    <span class="expense-amount">{{ e.amount.toLocaleString() }}円</span>
                    <button class="btn-del" @click="store.removeExpense(e.id)" :aria-label="`${e.category}の支出を削除`">✕</button>
                  </div>
                </div>
              </template>

              <!-- Daily total summary -->
              <div class="daily-total" aria-live="polite">
                合計：{{ (status.total_expenses ?? 0).toLocaleString() }}円
              </div>
            </template>
          </div>

        </template>
      </template>
    </main>

    <!-- Battle result overlay -->
    <Transition name="overlay">
      <div v-if="showBattleOverlay" class="battle-overlay" :class="battleResult" @click="showBattleOverlay = false" role="dialog" aria-modal="true" :aria-label="battleResult === 'win' ? '勝利！' : '敗北...'">
        <!-- Confetti (win only) -->
        <template v-if="battleResult === 'win'">
          <div v-for="p in confettiPieces" :key="p.id" class="confetti-piece"
            :style="{
              left: `${p.x}%`,
              width: `${p.size}px`,
              height: `${p.size * 0.5}px`,
              background: p.color,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
              '--rot': `${p.rotation}deg`
            }"
          ></div>
        </template>

        <div class="overlay-content" :class="battleResult">
          <div class="overlay-icon">{{ battleResult === 'win' ? '🏆' : '💀' }}</div>
          <div class="overlay-title">{{ battleResult === 'win' ? '勝利！' : '敗北...' }}</div>
          <div class="overlay-msg">{{ battleMsg }}</div>
          <div class="overlay-tap">タップして閉じる</div>
        </div>
      </div>
    </Transition>

    <nav class="bottom-nav" role="navigation" aria-label="メインナビゲーション">
      <button class="active" aria-label="ホーム（現在のページ）" aria-current="page">🏠 ホーム</button>
      <button @click="router.push('/boss-select')" aria-label="ボス選択">👾 ボス</button>
      <button @click="router.push('/leaderboard')" aria-label="ランキング">🏆 ランキング</button>
      <button @click="router.push('/history')" aria-label="冒険履歴">📜 履歴</button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores'
import { useCoinquestStore } from '@/stores/coinquest.store'
import { CATEGORIES } from '@/services/coinquest.service'
import type { Expense } from '@/services/coinquest.service'

const router = useRouter()
const authStore = useAuthStore()
const store = useCoinquestStore()

const loading = ref(true)
const debugDateInput = ref(new Date().toISOString().split('T')[0])
const newAmount = ref<number | null>(null)
const newCategory = ref('')
const newNote = ref('')
const currentDay = computed(() => {
  const d = store.debugDate ? new Date(store.debugDate) : new Date()
  return d.toISOString().split('T')[0]
})
const newDate = ref(new Date().toISOString().split('T')[0])
const adding = ref(false)
const addError = ref('')
const battleMsg = ref('')
const battleResult = ref<'win' | 'lose' | null>(null)
const showBattleOverlay = ref(false)
const confettiPieces = ref<any[]>([])
const showDatePicker = ref(false)

const BOSS_EMOJI: Record<number, string> = { 1: '🟢', 2: '🔵', 3: '🟠', 4: '🔴', 5: '💀' }

const CAT_COLORS: Record<string, string> = {
  '食費': '#ff6b6b', '住居費': '#4ecdc4', '光熱・水道費': '#45b7d1',
  '家具・家事用品費': '#96ceb4', '被服費': '#ffeaa7', '保健医療費': '#fd79a8',
  '交通・通信費': '#6c5ce7', '教育費': '#00b894', '教養娯楽費': '#fdcb6e', 'その他': '#b2bec3'
}

const status = computed(() => store.monthStatus)

const currentMonthLabel = computed(() => {
  const d = store.debugDate ? new Date(store.debugDate) : new Date()
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
})

const hpPercent = computed(() => {
  const budget = status.value?.budget ?? 0
  const remaining = status.value?.remaining ?? 0
  if (!budget) return 100
  return Math.max(0, Math.round((remaining / budget) * 100))
})

const hpColor = computed(() => {
  const pct = hpPercent.value
  if (pct > 50) return 'linear-gradient(90deg, #4caf50, #8bc34a)'
  if (pct > 25) return 'linear-gradient(90deg, #ff9800, #ffc107)'
  return 'linear-gradient(90deg, #f44336, #ff5722)'
})

const groupedExpenses = computed(() => {
  const groups: Record<string, Expense[]> = {}
  const sorted = [...store.expenses].sort((a, b) => new Date(b.spent_at).getTime() - new Date(a.spent_at).getTime())
  for (const e of sorted) {
    const date = e.spent_at.split('T')[0]
    if (!groups[date]) groups[date] = []
    groups[date].push(e)
  }
  return groups
})

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr + 'T12:00:00')
  return `${d.getMonth() + 1}月${d.getDate()}日（${'日月火水木金土'[d.getDay()]}）`
}

const formatDateShort = (dateStr: string) => {
  const d = new Date(dateStr + 'T12:00:00')
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

const monthMin = computed(() => {
  const d = store.debugDate ? new Date(store.debugDate) : new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
})

const monthMax = computed(() => {
  const d = store.debugDate ? new Date(store.debugDate) : new Date()
  return d.toISOString().split('T')[0]
})

const formatDebugDate = (iso: string) => new Date(iso).toLocaleString('ja-JP')

const catColor = (cat: string) => CAT_COLORS[cat] ?? '#b2bec3'

// --- Pie chart ---
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * Math.PI / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function slicePath(cx: number, cy: number, r: number, start: number, end: number): string {
  if (end - start >= 359.9) {
    // Deux demi-arcs pour éviter le bug SVG du cercle complet
    const top = polarToCartesian(cx, cy, r, 0)
    const bottom = polarToCartesian(cx, cy, r, 180)
    return `M ${top.x} ${top.y} A ${r} ${r} 0 1 1 ${bottom.x} ${bottom.y} A ${r} ${r} 0 1 1 ${top.x} ${top.y} Z`
  }
  const s = polarToCartesian(cx, cy, r, start)
  const e = polarToCartesian(cx, cy, r, end)
  const large = end - start > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y} Z`
}

const pieSlices = computed(() => {
  const items = categoryBreakdown.value.filter(c => c.spent > 0)
  const total = items.reduce((s, c) => s + c.spent, 0)
  if (total === 0) return []
  let angle = 0
  return items.map(c => {
    const pct = c.spent / total
    const start = angle
    angle += pct * 360
    return { name: c.name, spent: c.spent, pct, startAngle: start, endAngle: angle, color: CAT_COLORS[c.name] ?? '#b2bec3' }
  })
})

// --- Battle sound & vibration ---
function playBattleSound(result: 'win' | 'lose') {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const notes = result === 'win'
      ? [523, 659, 784, 1047]   // C5 E5 G5 C6 — fanfare
      : [392, 330, 294, 220]    // descending
    const type = result === 'win' ? 'square' : 'sawtooth'
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = type
      osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.18
      gain.gain.setValueAtTime(0.12, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
      osc.start(t); osc.stop(t + 0.35)
    })
  } catch { /* audio non supporté */ }
}

function triggerVibration(result: 'win' | 'lose') {
  if ('vibrate' in navigator) {
    navigator.vibrate(result === 'win' ? [100, 50, 100, 50, 200] : [400, 100, 400])
  }
}

const categoryBreakdown = computed(() => {
  if (!status.value?.boss || !status.value?.household_size) return []
  const avgEntry = store.avgExpensesData.find(e => e.household_size === status.value!.household_size)
  if (!avgEntry) return []

  const spentByCategory: Record<string, number> = {}
  for (const e of store.expenses) {
    spentByCategory[e.category] = (spentByCategory[e.category] ?? 0) + e.amount
  }

  return avgEntry.categories
    .map(cat => ({
      name: cat.name,
      avg: cat.amount,
      spent: spentByCategory[cat.name] ?? 0,
    }))
    .filter(cat => cat.spent > 0 || cat.avg > 0)
})

onMounted(async () => {
  await Promise.all([store.loadMonthStatus(), store.loadExpenses(), store.loadDebugDate(), store.loadProfile(), store.loadAverageExpenses()])
  if (store.debugDate) debugDateInput.value = store.debugDate.split('T')[0]
  newDate.value = currentDay.value
  loading.value = false
})

watch(currentDay, (val) => {
  newDate.value = val
})

const handleLogout = async () => {
  await authStore.logout()
  router.push('/login')
}

const handleAdd = async () => {
  if (!newAmount.value || !newCategory.value) return
  adding.value = true
  addError.value = ''
  try {
    await store.addExpense({
      amount: newAmount.value,
      category: newCategory.value,
      note: newNote.value || undefined,
      spent_at: newDate.value ? new Date(newDate.value + 'T12:00:00').toISOString() : undefined,
    })
    newAmount.value = null
    newCategory.value = ''
    newNote.value = ''
    newDate.value = currentDay.value
  } catch (e: any) {
    addError.value = e.message || '保存に失敗しました'
  } finally {
    adding.value = false
  }
}

const handleBattle = async () => {
  const result = await store.battle()
  battleMsg.value = result.message
  battleResult.value = result.result as 'win' | 'lose'

  if (result.result === 'win') {
    confettiPieces.value = Array.from({ length: 70 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 1.8,
      duration: 2.5 + Math.random() * 2,
      color: ['#ffd700','#ff6b6b','#4ecdc4','#45b7d1','#96ceb4','#ffeaa7','#fd79a8','#6c5ce7'][Math.floor(Math.random() * 8)],
      size: 7 + Math.random() * 9,
      rotation: Math.random() * 720 - 360,
    }))
  }

  showBattleOverlay.value = true
  playBattleSound(result.result as 'win' | 'lose')
  triggerVibration(result.result as 'win' | 'lose')
  await store.loadProfile()
}

const applyDebugDate = async () => {
  if (!debugDateInput.value) return
  await store.setDebugDate(new Date(debugDateInput.value).toISOString())
}

const resetDate = async () => {
  await store.resetDebugDate()
  debugDateInput.value = new Date().toISOString().split('T')[0]
}
</script>

<style scoped>
* { box-sizing: border-box; }
.app { min-height: 100vh; background: #0f0c29; color: white; font-family: system-ui, sans-serif; display: flex; flex-direction: column; }

.header { display: flex; justify-content: space-between; align-items: center; padding: 0.9rem 1rem; background: rgba(0,0,0,0.5); position: sticky; top: 0; z-index: 10; border-bottom: 1px solid rgba(255,255,255,0.08); }
.logo { font-weight: 800; color: #ffd700; font-size: 1.1rem; }
.header-right { display: flex; align-items: center; gap: 0.5rem; }
.user-info { display: flex; flex-direction: column; align-items: flex-end; gap: 0.1rem; }
.username { color: rgba(255,255,255,0.6); font-size: 0.8rem; }
.user-rank { color: #ffd700; font-size: 0.7rem; font-weight: 700; }
.btn-icon { background: none; border: none; font-size: 1.1rem; cursor: pointer; padding: 0.25rem; }

.debug-panel { background: rgba(255,200,0,0.08); border-bottom: 1px solid rgba(255,200,0,0.2); padding: 0.6rem 1rem; display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; font-size: 0.8rem; color: rgba(255,255,255,0.6); }
.debug-panel input { background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); border-radius: 0.4rem; color: white; padding: 0.25rem 0.4rem; font-size: 0.75rem; }
.debug-panel button { background: rgba(255,200,0,0.15); border: 1px solid rgba(255,200,0,0.3); border-radius: 0.4rem; color: #ffd700; padding: 0.25rem 0.5rem; cursor: pointer; font-size: 0.75rem; }
.debug-active { color: #ffd700; }

.main { flex: 1; padding: 1rem; padding-bottom: 5rem; max-width: 480px; margin: 0 auto; width: 100%; }
.loading { text-align: center; padding: 3rem; opacity: 0.4; }

.month-header { margin-bottom: 1.25rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 1rem; padding: 0.9rem 1rem; }
.month-label { font-size: 1.15rem; font-weight: 800; color: white; display: block; margin-bottom: 0.6rem; }
.date-switcher { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.date-switcher-label { font-size: 0.78rem; color: rgba(255,255,255,0.4); white-space: nowrap; }
.date-input { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,215,0,0.3); border-radius: 0.6rem; color: white; padding: 0.35rem 0.6rem; font-size: 0.82rem; flex: 1; min-width: 130px; }
.date-input:focus { outline: none; border-color: #ffd700; }
.date-reset { background: rgba(244,67,54,0.15); border: 1px solid rgba(244,67,54,0.3); border-radius: 0.6rem; color: #ff6b6b; padding: 0.35rem 0.65rem; cursor: pointer; font-size: 0.78rem; white-space: nowrap; }

/* Step card (no boss) */
.step-card { background: rgba(255,255,255,0.04); border: 1px dashed rgba(255,255,255,0.15); border-radius: 1.25rem; padding: 1.5rem; margin-bottom: 1.25rem; }
.step-number { font-size: 0.7rem; font-weight: 800; color: #ffd700; letter-spacing: 0.1em; margin-bottom: 1rem; }
.step-content { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.25rem; }
.step-icon { font-size: 2.5rem; }
.step-title { font-weight: 700; font-size: 1rem; margin-bottom: 0.25rem; }
.step-desc { font-size: 0.85rem; color: rgba(255,255,255,0.5); }

/* Boss status */
.boss-status { border-radius: 1.25rem; padding: 1.25rem; margin-bottom: 1.25rem; }
.d1 { background: linear-gradient(135deg, #1a3a1a, #2d5a2d); border: 1px solid #4caf5066; }
.d2 { background: linear-gradient(135deg, #1a2a4a, #2d4a7a); border: 1px solid #2196f366; }
.d3 { background: linear-gradient(135deg, #3a2a1a, #7a4a1a); border: 1px solid #ff980066; }
.d4 { background: linear-gradient(135deg, #3a1a1a, #7a2a2a); border: 1px solid #f4433666; }
.d5 { background: linear-gradient(135deg, #2a1a3a, #4a1a6a); border: 1px solid #9c27b066; }

.boss-status-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.boss-status-name { font-size: 1.15rem; font-weight: 800; }
.boss-status-stars { font-size: 0.8rem; color: rgba(255,255,255,0.5); margin-top: 0.2rem; }
.result-pill { padding: 0.35rem 0.75rem; border-radius: 2rem; font-weight: 700; font-size: 0.85rem; }
.result-pill.win { background: rgba(76,175,80,0.25); color: #4caf50; }
.result-pill.lose { background: rgba(244,67,54,0.25); color: #f44336; }
.btn-change { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 0.5rem; color: rgba(255,255,255,0.7); padding: 0.35rem 0.65rem; cursor: pointer; font-size: 0.8rem; }

.hp-wrap { margin-bottom: 1rem; }
.hp-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; }
.hp-label { font-size: 0.8rem; font-weight: 700; color: rgba(255,255,255,0.5); }
.hp-value { font-size: 0.85rem; font-weight: 700; color: white; }
.hp-value.over { color: #f44336; }
.hp-track { height: 18px; background: rgba(0,0,0,0.5); border-radius: 9px; overflow: hidden; margin-bottom: 0.4rem; border: 1px solid rgba(255,255,255,0.08); }
.hp-fill { height: 100%; border-radius: 9px; transition: width 0.6s ease; position: relative; }
.hp-fill::after { content: ''; position: absolute; top: 2px; left: 4px; right: 4px; height: 4px; background: rgba(255,255,255,0.25); border-radius: 2px; }
.hp-sub { display: flex; justify-content: space-between; font-size: 0.8rem; }
.over { color: #f44336; font-weight: 700; }
.safe { color: #4caf50; }

.btn-battle { width: 100%; padding: 0.8rem; border: none; border-radius: 0.75rem; background: linear-gradient(135deg, #ffd700, #ff8c00); color: #0f0c29; font-size: 0.95rem; font-weight: 800; cursor: pointer; }
.battle-result { margin-top: 0.75rem; background: rgba(255,255,255,0.06); border-radius: 0.75rem; padding: 0.75rem; font-size: 0.85rem; text-align: center; line-height: 1.5; }

/* Battle overlay */
.battle-overlay { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; cursor: pointer; overflow: hidden; }
.battle-overlay.win { background: radial-gradient(ellipse at center, rgba(255,215,0,0.25) 0%, rgba(15,12,41,0.97) 70%); }
.battle-overlay.lose { background: radial-gradient(ellipse at center, rgba(244,67,54,0.2) 0%, rgba(15,12,41,0.97) 70%); }

.overlay-content { text-align: center; z-index: 2; padding: 2rem; animation: overlayIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
.overlay-content.lose { animation: overlayShake 0.5s ease-in-out, overlayIn 0.4s ease; }
.overlay-icon { font-size: 5rem; margin-bottom: 0.75rem; filter: drop-shadow(0 0 20px rgba(255,215,0,0.6)); }
.overlay-content.lose .overlay-icon { filter: drop-shadow(0 0 20px rgba(244,67,54,0.6)); }
.overlay-title { font-size: 2.5rem; font-weight: 900; color: #ffd700; margin-bottom: 0.75rem; text-shadow: 0 0 20px rgba(255,215,0,0.5); }
.overlay-content.lose .overlay-title { color: #f44336; text-shadow: 0 0 20px rgba(244,67,54,0.5); }
.overlay-msg { font-size: 0.9rem; color: rgba(255,255,255,0.75); line-height: 1.7; max-width: 300px; margin: 0 auto 1.25rem; }
.overlay-tap { font-size: 0.75rem; color: rgba(255,255,255,0.3); animation: pulse 1.5s ease-in-out infinite; }

@keyframes overlayIn {
  from { transform: scale(0.5); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
@keyframes overlayShake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-12px); }
  40% { transform: translateX(12px); }
  60% { transform: translateX(-8px); }
  80% { transform: translateX(8px); }
}
@keyframes pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.8; }
}

/* Confetti */
.confetti-piece { position: absolute; top: -20px; border-radius: 2px; animation: confettiFall linear forwards; }
@keyframes confettiFall {
  0% { transform: translateY(0) rotate(0deg); opacity: 1; }
  80% { opacity: 1; }
  100% { transform: translateY(110vh) rotate(var(--rot)); opacity: 0; }
}

/* Overlay transition */
.overlay-enter-active, .overlay-leave-active { transition: opacity 0.3s ease; }
.overlay-enter-from, .overlay-leave-to { opacity: 0; }

/* Pie chart */
.pie-wrap { display: flex; align-items: center; gap: 1rem; margin: 0.75rem 0 1rem; }
.pie-svg { width: 120px; height: 120px; flex-shrink: 0; }
.pie-legend { display: flex; flex-direction: column; gap: 0.3rem; flex: 1; overflow: hidden; }
.legend-item { display: flex; align-items: center; gap: 0.4rem; }
.legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.legend-name { font-size: 0.72rem; color: rgba(255,255,255,0.6); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.legend-pct { font-size: 0.72rem; font-weight: 700; color: white; }

/* Category breakdown */
.category-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 1.25rem; padding: 1rem; margin-bottom: 1.25rem; }
.cat-list { display: flex; flex-direction: column; gap: 0.7rem; margin-top: 0.75rem; }
.cat-item { }
.cat-item-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; }
.cat-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.cat-name { font-size: 0.8rem; color: rgba(255,255,255,0.6); flex: 1; }
.cat-amounts { display: flex; align-items: baseline; gap: 0.3rem; }
.cat-spent { font-size: 0.82rem; font-weight: 700; color: white; }
.cat-spent.over { color: #f44336; }
.cat-avg { font-size: 0.72rem; color: rgba(255,255,255,0.3); }
.cat-track { height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden; position: relative; }
.cat-avg-bar { position: absolute; top: 0; left: 0; height: 100%; background: rgba(255,255,255,0.1); border-radius: 3px; }
.cat-spent-bar { position: absolute; top: 0; left: 0; height: 100%; border-radius: 3px; transition: width 0.5s ease; opacity: 0.85; }

/* Add expense */
.add-expense-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 1.25rem; padding: 1rem; margin-bottom: 1.25rem; }
.card-title-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
.card-title { font-size: 0.8rem; font-weight: 700; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.06em; }
.date-display { font-size: 0.82rem; color: rgba(255,255,255,0.5); cursor: pointer; display: flex; align-items: center; gap: 0.35rem; }
.date-edit-hint { background: rgba(255,215,0,0.12); color: #ffd700; border-radius: 0.4rem; padding: 0.15rem 0.4rem; font-size: 0.72rem; }
.date-picker-wrap { margin-bottom: 0.6rem; }
.inp-date-full { width: 100%; padding: 0.6rem 0.75rem; border-radius: 0.75rem; border: 1px solid rgba(255,215,0,0.4); background: rgba(255,255,255,0.06); color: white; font-size: 0.9rem; }
.add-row { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; }
.add-row:last-child { margin-bottom: 0; }
.inp { padding: 0.65rem 0.75rem; border-radius: 0.75rem; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.06); color: white; font-size: 0.9rem; }
.inp:focus { outline: none; border-color: rgba(255,215,0,0.5); }
.inp-amount { width: 35%; }
.inp-cat { flex: 1; background: rgba(20,15,50,0.9); }
.inp-note { flex: 1; }
.inp-date { width: 38%; font-size: 0.8rem; }
.btn-add { padding: 0.65rem 1rem; border: none; border-radius: 0.75rem; background: #ffd700; color: #0f0c29; font-weight: 700; cursor: pointer; font-size: 0.9rem; white-space: nowrap; }
.btn-add:disabled { opacity: 0.45; cursor: not-allowed; }
.add-error { color: #ff6b6b; font-size: 0.8rem; margin-bottom: 0.5rem; }

/* Expenses */
.expenses-section { }
.empty { text-align: center; color: rgba(255,255,255,0.25); padding: 2rem; font-size: 0.85rem; }
.date-label { font-size: 0.8rem; font-weight: 700; color: rgba(255,255,255,0.4); margin: 1rem 0 0.4rem; padding-left: 0.25rem; }
.expense-group { display: flex; flex-direction: column; gap: 0.35rem; }
.expense-row { display: flex; align-items: center; gap: 0.75rem; background: rgba(255,255,255,0.04); border-radius: 0.75rem; padding: 0.7rem 0.85rem; }
.expense-cat-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.expense-main { flex: 1; display: flex; flex-direction: column; gap: 0.15rem; }
.expense-cat { font-size: 0.9rem; font-weight: 600; }
.expense-note { font-size: 0.75rem; color: rgba(255,255,255,0.35); }
.expense-amount { font-weight: 700; color: #ffd700; font-size: 0.9rem; white-space: nowrap; }
.btn-del { background: none; border: none; color: rgba(255,100,100,0.5); cursor: pointer; font-size: 0.8rem; padding: 0.15rem; }
.daily-total { text-align: right; margin-top: 1rem; font-size: 0.85rem; color: rgba(255,255,255,0.4); padding-right: 0.25rem; }

/* Shared */
.btn-primary { width: 100%; padding: 0.85rem; border: none; border-radius: 0.75rem; background: linear-gradient(135deg, #ffd700, #ff8c00); color: #0f0c29; font-size: 0.95rem; font-weight: 700; cursor: pointer; }
.bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; display: flex; background: rgba(10,8,30,0.97); border-top: 1px solid rgba(255,255,255,0.08); }
.bottom-nav button { flex: 1; padding: 0.85rem; border: none; background: none; color: rgba(255,255,255,0.4); cursor: pointer; font-size: 0.78rem; }
.bottom-nav button.active { color: #ffd700; font-weight: 700; }
</style>
