import type { Kysely } from 'kysely'
import { sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // Bosses table
  await db.schema
    .createTable('bosses')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('difficulty', 'integer', (col) => col.notNull()) // 1-5
    .addColumn('budget_ratio', 'numeric', (col) => col.notNull()) // ex: 0.7 = 70% of average
    .addColumn('reward_points', 'integer', (col) => col.notNull())
    .addColumn('image_url', 'varchar(255)')
    .execute()

  // User months table (one per user per month)
  await db.schema
    .createTable('user_months')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'integer', (col) => col.notNull().references('users.id'))
    .addColumn('boss_id', 'integer', (col) => col.references('bosses.id'))
    .addColumn('year', 'integer', (col) => col.notNull())
    .addColumn('month', 'integer', (col) => col.notNull())
    .addColumn('budget', 'integer') // calculated from boss + household
    .addColumn('household_size', 'integer', (col) => col.defaultTo(1).notNull())
    .addColumn('result', 'varchar(50)') // 'win' | 'lose' | null (pending)
    .addColumn('score', 'integer')
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .execute()

  await db.schema.createIndex('idx_user_months_user_year_month')
    .on('user_months')
    .columns(['user_id', 'year', 'month'])
    .unique()
    .execute()

  // Expenses table
  await db.schema
    .createTable('expenses')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'integer', (col) => col.notNull().references('users.id'))
    .addColumn('amount', 'integer', (col) => col.notNull())
    .addColumn('category', 'varchar(100)', (col) => col.notNull())
    .addColumn('note', 'varchar(255)')
    .addColumn('spent_at', 'timestamp', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .execute()

  await db.schema.createIndex('idx_expenses_user_spent_at')
    .on('expenses')
    .columns(['user_id', 'spent_at'])
    .execute()

  // User profiles (rank, points)
  await db.schema
    .createTable('user_profiles')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'integer', (col) => col.notNull().references('users.id').unique())
    .addColumn('total_points', 'integer', (col) => col.defaultTo(0).notNull())
    .addColumn('rank', 'varchar(50)', (col) => col.defaultTo('見習い冒険者').notNull())
    .addColumn('bosses_defeated', 'integer', (col) => col.defaultTo(0).notNull())
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .execute()

  // Debug date per user
  await db.schema
    .createTable('debug_dates')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'integer', (col) => col.notNull().references('users.id').unique())
    .addColumn('current_date', 'timestamp', (col) => col.notNull())
    .execute()

  // Seed bosses
  await db.insertInto('bosses').values([
    { name: 'スライム', description: '初心者向けの簡単な敵。まずはここから始めよう。', difficulty: 1, budget_ratio: 0.95, reward_points: 100 },
    { name: 'ゴブリン', description: 'スライムより少し手強い。油断は禁物。', difficulty: 2, budget_ratio: 0.85, reward_points: 250 },
    { name: 'オーク', description: 'がっしりした体格で攻撃力も高い。本格的な節約が必要。', difficulty: 3, budget_ratio: 0.75, reward_points: 500 },
    { name: 'ドラゴン', description: '伝説の強敵。真の節約家だけが挑める。', difficulty: 4, budget_ratio: 0.60, reward_points: 1000 },
    { name: '混沌の神', description: 'ほぼ不可能…だが倒せれば最高の栄誉。', difficulty: 5, budget_ratio: 0.45, reward_points: 2500 },
  ]).execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('debug_dates').execute()
  await db.schema.dropTable('user_profiles').execute()
  await db.schema.dropTable('expenses').execute()
  await db.schema.dropIndex('idx_user_months_user_year_month').execute()
  await db.schema.dropTable('user_months').execute()
  await db.schema.dropTable('bosses').execute()
}
