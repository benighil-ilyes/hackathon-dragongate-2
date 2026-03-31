import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { authMiddleware } from '../middleware/auth.js'
import { db } from '../db/connection.js'
import { getCurrentDate } from '../utils/current-date.js'

const MonthHistoryItemSchema = z.object({
  id: z.number(),
  year: z.number(),
  month: z.number(),
  boss_name: z.string().nullable(),
  boss_difficulty: z.number().nullable(),
  budget: z.number().nullable(),
  total_expenses: z.number(),
  result: z.string().nullable(),
  score: z.number().nullable(),
  household_size: z.number(),
})

export const storeHistoryApi = (app: OpenAPIHono) => {
  app.use('/api/months/history', authMiddleware)

  const historyRoute = createRoute({
    method: 'get',
    path: '/api/months/history',
    responses: {
      200: {
        content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.array(MonthHistoryItemSchema) }) } },
        description: '過去の月履歴',
      },
    },
  })

  app.openapi(historyRoute, async (c) => {
    const user = (c as any).get('user') as { id: number }
    const now = await getCurrentDate(user.id)
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1

    const months = await db
      .selectFrom('user_months')
      .leftJoin('bosses', 'bosses.id', 'user_months.boss_id')
      .select([
        'user_months.id',
        'user_months.year',
        'user_months.month',
        'bosses.name as boss_name',
        'bosses.difficulty as boss_difficulty',
        'user_months.budget',
        'user_months.result',
        'user_months.score',
        'user_months.household_size',
      ])
      .where('user_months.user_id', '=', user.id)
      .where((eb) =>
        eb.or([
          eb('user_months.year', '<', currentYear),
          eb.and([
            eb('user_months.year', '=', currentYear),
            eb('user_months.month', '<', currentMonth),
          ]),
        ])
      )
      .orderBy('user_months.year', 'desc')
      .orderBy('user_months.month', 'desc')
      .execute()

    const data = await Promise.all(
      months.map(async (m) => {
        const start = new Date(m.year, m.month - 1, 1)
        const end = new Date(m.year, m.month, 1)
        const expResult = await db
          .selectFrom('expenses')
          .select((eb) => eb.fn.sum('amount').as('total'))
          .where('user_id', '=', user.id)
          .where('spent_at', '>=', start)
          .where('spent_at', '<', end)
          .executeTakeFirst()

        return {
          id: m.id,
          year: m.year,
          month: m.month,
          boss_name: m.boss_name ?? null,
          boss_difficulty: m.boss_difficulty ? Number(m.boss_difficulty) : null,
          budget: m.budget ? Number(m.budget) : null,
          total_expenses: Number(expResult?.total ?? 0),
          result: m.result ?? null,
          score: m.score ? Number(m.score) : null,
          household_size: m.household_size,
        }
      })
    )

    return c.json({ success: true, data })
  })
}
