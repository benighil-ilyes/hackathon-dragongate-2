import { apiRequest, api } from './api'

export interface Boss {
  id: number
  name: string
  description: string | null
  difficulty: number
  budget_ratio: number
  reward_points: number
}

export interface MonthStatus {
  year: number
  month: number
  boss: Boss | null
  budget: number | null
  household_size: number
  total_expenses: number
  remaining: number | null
  progress_pct: number | null
  result: string | null
  score: number | null
}

export interface Expense {
  id: number
  amount: number
  category: string
  note: string | null
  spent_at: string
  created_at: string
}

export interface LeaderboardEntry {
  rank: number
  user_id: number
  name: string
  total_points: number
  bosses_defeated: number
  adventurer_rank: string
}

export const CATEGORIES = [
  '食費', '住居費', '光熱・水道費', '家具・家事用品費',
  '被服費', '保健医療費', '交通・通信費', '教育費', '教養娯楽費', 'その他'
]

export const CATEGORY_LABELS: Record<string, string> = {
  '食費': 'Alimentation',
  '住居費': 'Logement',
  '光熱・水道費': 'Énergie/Eau',
  '家具・家事用品費': 'Maison',
  '被服費': 'Vêtements',
  '保健医療費': 'Santé',
  '交通・通信費': 'Transport',
  '教育費': 'Éducation',
  '教養娯楽費': 'Loisirs',
  'その他': 'Divers'
}

export async function getBosses(): Promise<Boss[]> {
  return apiRequest<Boss[]>('/bosses')
}

export async function getCurrentMonth(): Promise<MonthStatus> {
  return apiRequest<MonthStatus>('/months/current')
}

export async function chooseBoss(bossId: number, householdSize: number): Promise<MonthStatus> {
  return apiRequest<MonthStatus>('/months/current/boss', {
    method: 'POST',
    body: { boss_id: bossId, household_size: householdSize }
  })
}

export async function triggerBattle(): Promise<{ result: string; score: number; message: string }> {
  return apiRequest('/months/current/battle', { method: 'POST' })
}

export async function getExpenses(month?: string): Promise<Expense[]> {
  const url = month ? `/expenses?month=${month}` : '/expenses'
  return apiRequest<Expense[]>(url)
}

export async function createExpense(data: { amount: number; category: string; note?: string; spent_at?: string }): Promise<Expense> {
  const res = await api('/expenses', { method: 'POST', body: data })
  return res.data
}

export async function deleteExpense(id: number): Promise<void> {
  await api(`/expenses/${id}`, { method: 'DELETE' })
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  return apiRequest<LeaderboardEntry[]>('/leaderboard')
}

export async function getDebugDate(): Promise<string> {
  const res = await apiRequest<{ current_date: string }>('/debug/date')
  return res.current_date
}

export async function setDebugDate(date: string): Promise<string> {
  const res = await apiRequest<{ current_date: string }>('/debug/date', {
    method: 'POST',
    body: { date }
  })
  return res.current_date
}

export async function resetDebugDate(): Promise<void> {
  await api('/debug/date', { method: 'DELETE' })
}

export async function register(data: { name: string; email: string; password: string }): Promise<{ token: string; user: { id: number; name: string; email: string } }> {
  const res = await api('/users', { method: 'POST', body: data })
  return res.data
}
