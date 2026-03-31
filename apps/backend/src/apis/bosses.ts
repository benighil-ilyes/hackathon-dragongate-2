import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { authMiddleware } from '../middleware/auth.js'
import { db } from '../db/connection.js'
import { getCurrentDate } from '../utils/current-date.js'

const BossSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  difficulty: z.number(),
  budget_ratio: z.number(),
  reward_points: z.number(),
})

const MonthStatusSchema = z.object({
  year: z.number(),
  month: z.number(),
  boss: BossSchema.nullable(),
  budget: z.number().nullable(),
  household_size: z.number(),
  total_expenses: z.number(),
  remaining: z.number().nullable(),
  progress_pct: z.number().nullable(),
  result: z.string().nullable(),
  score: z.number().nullable(),
})

export const storeBossApi = (app: OpenAPIHono) => {
  app.use('/api/bosses', authMiddleware)
  app.use('/api/months/*', authMiddleware)

  // GET /api/bosses
  const listBossesRoute = createRoute({
    method: 'get',
    path: '/api/bosses',
    responses: {
      200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.array(BossSchema) }) } }, description: 'Liste des boss' },
    },
  })

  app.openapi(listBossesRoute, async (c) => {
    const bosses = await db.selectFrom('bosses').selectAll().orderBy('difficulty', 'asc').execute()
    return c.json({ success: true, data: bosses.map(b => ({
      id: b.id,
      name: b.name,
      description: b.description,
      difficulty: Number(b.difficulty),
      budget_ratio: Number(b.budget_ratio),
      reward_points: Number(b.reward_points),
    }))})
  })

  // GET /api/months/current
  const getCurrentMonthRoute = createRoute({
    method: 'get',
    path: '/api/months/current',
    responses: {
      200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: MonthStatusSchema }) } }, description: 'Mois courant' },
    },
  })

  app.openapi(getCurrentMonthRoute, async (c) => {
    const user = (c as any).get('user') as { id: number }
    const now = await getCurrentDate(user.id)
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    const userMonth = await db
      .selectFrom('user_months')
      .selectAll()
      .where('user_id', '=', user.id)
      .where('year', '=', year)
      .where('month', '=', month)
      .executeTakeFirst()

    let boss = null
    if (userMonth?.boss_id) {
      const b = await db.selectFrom('bosses').selectAll().where('id', '=', userMonth.boss_id).executeTakeFirst()
      if (b) boss = { id: b.id, name: b.name, description: b.description, difficulty: Number(b.difficulty), budget_ratio: Number(b.budget_ratio), reward_points: Number(b.reward_points) }
    }

    // Calculate total expenses this month
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 1)
    const expensesResult = await db
      .selectFrom('expenses')
      .select((eb) => eb.fn.sum('amount').as('total'))
      .where('user_id', '=', user.id)
      .where('spent_at', '>=', start)
      .where('spent_at', '<', end)
      .executeTakeFirst()

    const totalExpenses = Number(expensesResult?.total ?? 0)
    const budget = userMonth?.budget ? Number(userMonth.budget) : null
    const remaining = budget !== null ? budget - totalExpenses : null
    const progressPct = budget !== null && budget > 0 ? Math.round((totalExpenses / budget) * 100) : null

    return c.json({ success: true, data: {
      year,
      month,
      boss,
      budget,
      household_size: userMonth?.household_size ?? 1,
      total_expenses: totalExpenses,
      remaining,
      progress_pct: progressPct,
      result: userMonth?.result ?? null,
      score: userMonth?.score ? Number(userMonth.score) : null,
    }})
  })

  // POST /api/months/current/boss — choose boss
  const chooseBossRoute = createRoute({
    method: 'post',
    path: '/api/months/current/boss',
    request: { body: { content: { 'application/json': { schema: z.object({ boss_id: z.number(), household_size: z.number().int().min(1).max(5).optional() }) } } } },
    responses: {
      200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: MonthStatusSchema }) } }, description: 'Boss choisi' },
      404: { content: { 'application/json': { schema: z.object({ success: z.boolean(), message: z.string() }) } }, description: 'Boss introuvable' },
    },
  })

  app.openapi(chooseBossRoute, async (c) => {
    const user = (c as any).get('user') as { id: number }
    const { boss_id, household_size = 1 } = c.req.valid('json')
    const now = await getCurrentDate(user.id)
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    const boss = await db.selectFrom('bosses').selectAll().where('id', '=', boss_id).executeTakeFirst()
    if (!boss) return c.json({ success: false, message: 'Boss not found' }, 404)

    // Get average expense for household size
    const avgExpenses: Record<number, number> = { 1: 163781, 2: 287315, 3: 339873, 4: 371381, 5: 389855 }
    const avg = avgExpenses[household_size] ?? 163781
    const budget = Math.round(avg * Number(boss.budget_ratio))

    const existing = await db
      .selectFrom('user_months')
      .selectAll()
      .where('user_id', '=', user.id)
      .where('year', '=', year)
      .where('month', '=', month)
      .executeTakeFirst()

    if (existing) {
      await db.updateTable('user_months')
        .set({ boss_id, budget, household_size, updated_at: new Date() })
        .where('id', '=', existing.id)
        .execute()
    } else {
      await db.insertInto('user_months')
        .values({ user_id: user.id, boss_id, year, month, budget, household_size })
        .execute()
    }

    // Ensure user_profile exists
    const profile = await db.selectFrom('user_profiles').where('user_id', '=', user.id).executeTakeFirst()
    if (!profile) {
      await db.insertInto('user_profiles').values({ user_id: user.id }).execute()
    }

    return c.json({ success: true, data: {
      year, month,
      boss: { id: boss.id, name: boss.name, description: boss.description, difficulty: Number(boss.difficulty), budget_ratio: Number(boss.budget_ratio), reward_points: Number(boss.reward_points) },
      budget,
      household_size,
      total_expenses: 0,
      remaining: budget,
      progress_pct: 0,
      result: null,
      score: null,
    }})
  })

  // POST /api/months/current/battle — trigger end of month battle
  const battleRoute = createRoute({
    method: 'post',
    path: '/api/months/current/battle',
    responses: {
      200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.object({ result: z.string(), score: z.number(), message: z.string() }) }) } }, description: 'Résultat combat' },
      400: { content: { 'application/json': { schema: z.object({ success: z.boolean(), message: z.string() }) } }, description: 'Pas de boss choisi' },
    },
  })

  app.openapi(battleRoute, async (c) => {
    const user = (c as any).get('user') as { id: number }
    const now = await getCurrentDate(user.id)
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    const userMonth = await db.selectFrom('user_months').selectAll()
      .where('user_id', '=', user.id).where('year', '=', year).where('month', '=', month)
      .executeTakeFirst()

    if (!userMonth || !userMonth.boss_id || !userMonth.budget) {
      return c.json({ success: false, message: 'No boss selected for this month' }, 400)
    }

    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 1)
    const expensesResult = await db.selectFrom('expenses')
      .select((eb) => eb.fn.sum('amount').as('total'))
      .where('user_id', '=', user.id)
      .where('spent_at', '>=', start)
      .where('spent_at', '<', end)
      .executeTakeFirst()

    const total = Number(expensesResult?.total ?? 0)
    const budget = Number(userMonth.budget)
    const boss = await db.selectFrom('bosses').selectAll().where('id', '=', userMonth.boss_id).executeTakeFirstOrThrow()

    let result: string
    let score: number
    let message: string

    if (total > budget) {
      result = 'lose'
      score = 0
      message = `Défaite ! Vous avez dépensé ${total}¥ pour un budget de ${budget}¥. ${boss.name} vous a vaincu !`
    } else {
      const ratio = 1 - (total / budget) // 0 = exact, 1 = nothing spent
      score = Math.round(Number(boss.reward_points) * (1 + ratio))
      result = 'win'
      message = `Victoire ! Vous avez vaincu ${boss.name} avec ${total}¥ dépensés sur ${budget}¥ ! Score : ${score}`
    }

    await db.updateTable('user_months')
      .set({ result, score, updated_at: new Date() })
      .where('id', '=', userMonth.id)
      .execute()

    if (result === 'win') {
      await db.updateTable('user_profiles')
        .set((eb) => ({
          total_points: eb('total_points', '+', score),
          bosses_defeated: eb('bosses_defeated', '+', 1),
        }))
        .where('user_id', '=', user.id)
        .execute()
    }

    return c.json({ success: true, data: { result, score, message } })
  })
}
