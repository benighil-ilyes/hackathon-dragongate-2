<template>
  <div class="login-page">
    <div class="login-card">
      <div class="logo">⚔️ Coin Quest</div>
      <p class="tagline">支出を制して、伝説の冒険者になれ</p>

      <div class="tabs">
        <button :class="{ active: mode === 'login' }" @click="mode = 'login'">ログイン</button>
        <button :class="{ active: mode === 'register' }" @click="mode = 'register'">新規登録</button>
      </div>

      <form @submit.prevent="handleSubmit">
        <div v-if="mode === 'register'" class="field">
          <label>冒険者名</label>
          <input v-model="name" type="text" placeholder="例：ShadowSaver" required minlength="2" />
        </div>
        <div class="field">
          <label>メールアドレス</label>
          <input v-model="email" type="email" placeholder="メールアドレスを入力" required />
        </div>
        <div class="field">
          <label>パスワード</label>
          <input v-model="password" type="password" placeholder="••••••" required minlength="6" />
        </div>

        <div v-if="error" class="error">{{ error }}</div>

        <button type="submit" class="btn-primary" :disabled="loading">
          {{ loading ? '...' : mode === 'login' ? '冒険を始める' : 'アカウントを作成' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores'
import { setStoredToken } from '@/services/api'
import * as svc from '@/services/coinquest.service'

const router = useRouter()
const authStore = useAuthStore()

const mode = ref<'login' | 'register'>('login')
const name = ref('')
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

const handleSubmit = async () => {
  loading.value = true
  error.value = ''
  try {
    if (mode.value === 'login') {
      const ok = await authStore.login({ email: email.value, password: password.value })
      if (ok) router.push('/dashboard')
      else error.value = authStore.error || 'メールアドレスまたはパスワードが正しくありません'
    } else {
      const res = await svc.register({ name: name.value, email: email.value, password: password.value })
      setStoredToken(res.token)
      localStorage.setItem('auth:isLoggedIn', 'true')
      localStorage.setItem('auth:currentUser', JSON.stringify(res.user))
      await authStore.restoreAuthState()
      router.push('/dashboard')
    }
  } catch (e: any) {
    error.value = e.message || 'エラーが発生しました'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
  padding: 1rem;
}
.login-card {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 1.5rem;
  padding: 2rem;
  width: 100%;
  max-width: 400px;
  backdrop-filter: blur(10px);
}
.logo { font-size: 2rem; font-weight: 800; color: #ffd700; text-align: center; margin-bottom: 0.25rem; }
.tagline { text-align: center; color: rgba(255,255,255,0.5); font-size: 0.85rem; margin-bottom: 1.5rem; }
.tabs { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; background: rgba(0,0,0,0.3); border-radius: 0.75rem; padding: 0.25rem; }
.tabs button { flex: 1; padding: 0.5rem; border: none; border-radius: 0.5rem; background: transparent; color: rgba(255,255,255,0.5); cursor: pointer; font-size: 0.9rem; transition: all 0.2s; }
.tabs button.active { background: #ffd700; color: #0f0c29; font-weight: 700; }
.field { margin-bottom: 1rem; }
.field label { display: block; color: rgba(255,255,255,0.7); font-size: 0.85rem; margin-bottom: 0.4rem; }
.field input { width: 100%; padding: 0.75rem; border-radius: 0.75rem; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.08); color: white; font-size: 1rem; box-sizing: border-box; }
.field input:focus { outline: none; border-color: #ffd700; }
.error { color: #ff6b6b; font-size: 0.85rem; margin-bottom: 1rem; text-align: center; }
.btn-primary { width: 100%; padding: 0.9rem; border: none; border-radius: 0.75rem; background: linear-gradient(135deg, #ffd700, #ff8c00); color: #0f0c29; font-size: 1rem; font-weight: 700; cursor: pointer; margin-top: 0.5rem; transition: opacity 0.2s; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
