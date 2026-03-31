<template>
  <div class="app">
    <header class="header">
      <button class="btn-back" @click="router.push('/dashboard')">← 戻る</button>
      <span class="title">🏆 ランキング</span>
    </header>

    <main class="main">
      <div v-if="loading" class="loading">読み込み中...</div>
      <div v-else-if="store.leaderboard.length === 0" class="empty">
        まだランキングに冒険者がいません。
      </div>
      <div v-else class="leaderboard">
        <div
          v-for="entry in store.leaderboard"
          :key="entry.user_id"
          class="entry"
          :class="{ me: entry.user_id === currentUserId, podium: entry.rank <= 3 }"
        >
          <div class="rank">{{ RANK_EMOJI[entry.rank] ?? entry.rank }}</div>
          <div class="info">
            <div class="name">{{ entry.name }}</div>
            <div class="sub">{{ entry.adventurer_rank }} · {{ entry.bosses_defeated }}体撃破</div>
          </div>
          <div class="points">{{ entry.total_points.toLocaleString() }}pt</div>
        </div>
      </div>
    </main>

    <nav class="bottom-nav">
      <button @click="router.push('/dashboard')">🏠 ホーム</button>
      <button @click="router.push('/boss-select')">👾 ボス</button>
      <button class="active">🏆 ランキング</button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores'
import { useCoinquestStore } from '@/stores/coinquest.store'

const router = useRouter()
const authStore = useAuthStore()
const store = useCoinquestStore()
const loading = ref(true)

const currentUserId = computed(() => authStore.currentUser?.id)
const RANK_EMOJI: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

onMounted(async () => {
  await store.loadLeaderboard()
  loading.value = false
})
</script>

<style scoped>
* { box-sizing: border-box; }
.app { min-height: 100vh; background: #0f0c29; color: white; font-family: system-ui, sans-serif; display: flex; flex-direction: column; }
.header { display: flex; align-items: center; gap: 1rem; padding: 1rem; background: rgba(0,0,0,0.4); position: sticky; top: 0; }
.btn-back { background: none; border: none; color: rgba(255,255,255,0.7); cursor: pointer; font-size: 1rem; padding: 0.25rem; }
.title { font-weight: 700; font-size: 1.1rem; color: #ffd700; }
.main { flex: 1; padding: 1rem; padding-bottom: 5rem; max-width: 480px; margin: 0 auto; width: 100%; }
.loading { text-align: center; padding: 3rem; opacity: 0.5; }
.empty { text-align: center; color: rgba(255,255,255,0.3); padding: 3rem; font-size: 0.9rem; }
.leaderboard { display: flex; flex-direction: column; gap: 0.5rem; }
.entry { display: flex; align-items: center; gap: 1rem; background: rgba(255,255,255,0.05); border-radius: 1rem; padding: 0.9rem 1rem; border: 1px solid transparent; }
.entry.podium { border-color: rgba(255,215,0,0.2); background: rgba(255,215,0,0.05); }
.entry.me { border-color: rgba(255,215,0,0.5); background: rgba(255,215,0,0.08); }
.rank { font-size: 1.4rem; width: 2rem; text-align: center; font-weight: 700; color: rgba(255,255,255,0.5); }
.info { flex: 1; }
.name { font-weight: 700; font-size: 0.95rem; }
.sub { font-size: 0.8rem; color: rgba(255,255,255,0.4); margin-top: 0.15rem; }
.points { font-weight: 800; color: #ffd700; font-size: 1rem; }
.bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; display: flex; background: rgba(15,12,41,0.95); border-top: 1px solid rgba(255,255,255,0.1); }
.bottom-nav button { flex: 1; padding: 0.85rem; border: none; background: none; color: rgba(255,255,255,0.5); cursor: pointer; font-size: 0.8rem; }
.bottom-nav button.active { color: #ffd700; font-weight: 700; }
</style>
