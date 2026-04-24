import { pgTable, serial, timestamp, varchar, jsonb, integer, index, boolean } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// 灵感表 - 存储用户收藏的旅行灵感
export const inspirations = pgTable(
  "inspirations",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }),
    title: varchar("title", { length: 255 }).notNull(),
    image: varchar("image", { length: 500 }),
    source: varchar("source", { length: 20 }).notNull().default("other"),
    type: varchar("type", { length: 20 }).notNull().default("spot"),
    location: jsonb("location"),
    time: varchar("time", { length: 50 }),
    price: integer("price"),
    rating: integer("rating"),
    create_time: timestamp("create_time", { withTimezone: true }).defaultNow().notNull(),
    update_time: timestamp("update_time", { withTimezone: true }),
  },
  (table) => [
    index("inspirations_user_id_idx").on(table.user_id),
    index("inspirations_type_idx").on(table.type),
    index("inspirations_create_time_idx").on(table.create_time),
  ]
)

// 行程表
export const trips = pgTable(
  "trips",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }),
    version_name: varchar("version_name", { length: 50 }).notNull().default("默认方案"),
    content: jsonb("content").notNull(),
    vote_count: integer("vote_count").notNull().default(0),
    is_final: boolean("is_final").notNull().default(false),
    settings: jsonb("settings"),
    create_time: timestamp("create_time", { withTimezone: true }).defaultNow().notNull(),
    update_time: timestamp("update_time", { withTimezone: true }),
  },
  (table) => [
    index("trips_user_id_idx").on(table.user_id),
    index("trips_is_final_idx").on(table.is_final),
    index("trips_create_time_idx").on(table.create_time),
  ]
)

// 投票表
export const votes = pgTable(
  "votes",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    trip_id: varchar("trip_id", { length: 36 }).notNull().references(() => trips.id),
    voter_id: varchar("voter_id", { length: 36 }).notNull(),
    voter_name: varchar("voter_name", { length: 50 }).notNull().default("匿名用户"),
    version_id: varchar("version_id", { length: 36 }).notNull(),
    create_time: timestamp("create_time", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("votes_trip_id_idx").on(table.trip_id),
    index("votes_voter_id_idx").on(table.voter_id),
    index("votes_version_id_idx").on(table.version_id),
  ]
)

export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export type Inspiration = typeof inspirations.$inferSelect;
export type InsertInspiration = typeof inspirations.$inferInsert;
export type Trip = typeof trips.$inferSelect;
export type InsertTrip = typeof trips.$inferInsert;
export type Vote = typeof votes.$inferSelect;
export type InsertVote = typeof votes.$inferInsert;
