import { db } from '../db/connection.js'

export async function getCurrentDate(userId: number): Promise<Date> {
  const debug = await db
    .selectFrom('debug_dates')
    .select('current_date')
    .where('user_id', '=', userId)
    .executeTakeFirst()

  return debug ? new Date(debug.current_date) : new Date()
}
