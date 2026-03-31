import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as svc from '@/services/coinquest.service'
import type { Boss, MonthStatus, Expense, LeaderboardEntry } from '@/services/coinquest.service'

export const useCoinquestStore = defineStore('coinquest', () => {
  const bosses = ref<Boss[]>([])
  const monthStatus = ref<MonthStatus | null>(null)
  const expenses = ref<Expense[]>([])
  const leaderboard = ref<LeaderboardEntry[]>([])
  const loading = ref(false)
  const debugDate = ref<string | null>(null)

  async function loadBosses() {
    bosses.value = await svc.getBosses()
  }

  async function loadMonthStatus() {
    monthStatus.value = await svc.getCurrentMonth()
  }

  async function loadExpenses(month?: string) {
    expenses.value = await svc.getExpenses(month)
  }

  async function loadLeaderboard() {
    leaderboard.value = await svc.getLeaderboard()
  }

  async function loadDebugDate() {
    try {
      debugDate.value = await svc.getDebugDate()
    } catch {
      debugDate.value = null
    }
  }

  async function chooseBoss(bossId: number, householdSize: number) {
    loading.value = true
    try {
      monthStatus.value = await svc.chooseBoss(bossId, householdSize)
    } finally {
      loading.value = false
    }
  }

  async function addExpense(data: { amount: number; category: string; note?: string }) {
    const expense = await svc.createExpense(data)
    expenses.value.unshift(expense)
    await loadMonthStatus()
    return expense
  }

  async function removeExpense(id: number) {
    await svc.deleteExpense(id)
    expenses.value = expenses.value.filter(e => e.id !== id)
    await loadMonthStatus()
  }

  async function battle() {
    const result = await svc.triggerBattle()
    await loadMonthStatus()
    return result
  }

  async function setDebugDate(date: string) {
    debugDate.value = await svc.setDebugDate(date)
    await loadMonthStatus()
    await loadExpenses()
  }

  async function resetDebugDate() {
    await svc.resetDebugDate()
    debugDate.value = null
    await loadMonthStatus()
    await loadExpenses()
  }

  return {
    bosses, monthStatus, expenses, leaderboard, loading, debugDate,
    loadBosses, loadMonthStatus, loadExpenses, loadLeaderboard, loadDebugDate,
    chooseBoss, addExpense, removeExpense, battle, setDebugDate, resetDebugDate,
  }
})
