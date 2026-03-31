import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { authMiddleware } from '../middleware/auth.js'
import { db } from '../db/connection.js'
import { getCurrentDate } from '../utils/current-date.js'

const CreateExpenseSchema = z.object({
  amount: z.number().int().positive(),
  category: z.string().min(1),
  note: z.string().optional(),
  spent_at: z.string().optional(), // ISO date string, defaults to now
})

const ExpenseSchema = z.object({
  id: z.number(),
  amount: z.number(),
  category: z.string(),
  note: z.string().nullable(),
  spent_at: z.string(),
  created_at: z.string(),
})

export const storeExpenseApi = (app: OpenAPIHono) => {
  app.use('/api/expenses/*', authMiddleware)
  app.use('/api/expenses', authMiddleware)

  // POST /api/expenses
  const createRoute_ = createRoute({
    method: 'post',
    path: '/api/expenses',
    request: { body: { content: { 'application/json': { schema: CreateExpenseSchema } } } },
    responses: {
      201: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: ExpenseSchema }) } }, description: 'Dépense créée' },
      500: { content: { 'application/json': { schema: z.object({ success: z.boolean(), message: z.string() }) } }, description: 'Erreur' },
    },
  })

  app.openapi(createRoute_, async (c) => {
    const user = (c as any).get('user') as { id: number }
    const body = c.req.valid('json')
    const now = await getCurrentDate(user.id)
    const spentAt = body.spent_at ? new Date(body.spent_at) : now

    try {
      const expense = await db
        .insertInto('expenses')
        .values({
          user_id: user.id,
          amount: body.amount,
          category: body.category,
          note: body.note ?? null,
          spent_at: spentAt,
        })
        .returning(['id', 'amount', 'category', 'note', 'spent_at', 'created_at'])
        .executeTakeFirstOrThrow()

      return c.json({ success: true, data: {
        id: expense.id,
        amount: expense.amount,
        category: expense.category,
        note: expense.note,
        spent_at: new Date(expense.spent_at).toISOString(),
        created_at: new Date(expense.created_at).toISOString(),
      }}, 201)
    } catch (e) {
      return c.json({ success: false, message: String(e) }, 500)
    }
  })

  // GET /api/expenses?month=2026-03
  const listRoute = createRoute({
    method: 'get',
    path: '/api/expenses',
    request: { query: z.object({ month: z.string().optional() }) },
    responses: {
      200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.array(ExpenseSchema) }) } }, description: 'Liste dépenses' },
      500: { content: { 'application/json': { schema: z.object({ success: z.boolean(), message: z.string() }) } }, description: 'Erreur' },
    },
  })

  app.openapi(listRoute, async (c) => {
    const user = (c as any).get('user') as { id: number }
    const { month } = c.req.valid('query')
    const now = await getCurrentDate(user.id)
    const year = month ? parseInt(month.split('-')[0]) : now.getFullYear()
    const m = month ? parseInt(month.split('-')[1]) : now.getMonth() + 1

    const start = new Date(year, m - 1, 1)
    const end = new Date(year, m, 1)

    try {
      const expenses = await db
        .selectFrom('expenses')
        .select(['id', 'amount', 'category', 'note', 'spent_at', 'created_at'])
        .where('user_id', '=', user.id)
        .where('spent_at', '>=', start)
        .where('spent_at', '<', end)
        .orderBy('spent_at', 'desc')
        .execute()

      return c.json({ success: true, data: expenses.map(e => ({
        id: e.id,
        amount: e.amount,
        category: e.category,
        note: e.note,
        spent_at: new Date(e.spent_at).toISOString(),
        created_at: new Date(e.created_at).toISOString(),
      }))})
    } catch (e) {
      return c.json({ success: false, message: String(e) }, 500)
    }
  })

  // DELETE /api/expenses/:id
  const deleteRoute = createRoute({
    method: 'delete',
    path: '/api/expenses/{id}',
    request: { params: z.object({ id: z.string() }) },
    responses: {
      204: { description: 'Supprimé' },
      404: { content: { 'application/json': { schema: z.object({ success: z.boolean(), message: z.string() }) } }, description: 'Non trouvé' },
    },
  })

  app.openapi(deleteRoute, async (c) => {
    const user = (c as any).get('user') as { id: number }
    const { id } = c.req.valid('param')

    const result = await db
      .deleteFrom('expenses')
      .where('id', '=', parseInt(id))
      .where('user_id', '=', user.id)
      .executeTakeFirst()

    if (result.numDeletedRows === 0n) {
      return c.json({ success: false, message: 'Not found' }, 404)
    }
    return c.body(null, 204)
  })
}
