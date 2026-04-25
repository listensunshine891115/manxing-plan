import { pgTable, index, foreignKey, varchar, timestamp, serial, jsonb, integer, boolean, unique, text } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// PostgreSQL gen_random_uuid() 函数
const gen_random_uuid = () => sql`gen_random_uuid()`

export const votes = pgTable("votes", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	tripId: varchar("trip_id", { length: 36 }).notNull(),
	voterId: varchar("voter_id", { length: 36 }).notNull(),
	voterName: varchar("voter_name", { length: 50 }).default('匿名用户').notNull(),
	versionId: varchar("version_id", { length: 36 }).notNull(),
	createTime: timestamp("create_time", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("votes_trip_id_idx").using("btree", table.tripId.asc().nullsLast().op("text_ops")),
	index("votes_version_id_idx").using("btree", table.versionId.asc().nullsLast().op("text_ops")),
	index("votes_voter_id_idx").using("btree", table.voterId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tripId],
			foreignColumns: [trips.id],
			name: "votes_trip_id_trips_id_fk"
		}),
]);

export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const trips = pgTable("trips", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }),
	versionName: varchar("version_name", { length: 50 }).default('默认方案').notNull(),
	content: jsonb().notNull(),
	voteCount: integer("vote_count").default(0).notNull(),
	isFinal: boolean("is_final").default(false).notNull(),
	settings: jsonb(),
	createTime: timestamp("create_time", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updateTime: timestamp("update_time", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("trips_create_time_idx").using("btree", table.createTime.asc().nullsLast().op("timestamptz_ops")),
	index("trips_is_final_idx").using("btree", table.isFinal.asc().nullsLast().op("bool_ops")),
	index("trips_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
]);

export const users = pgTable("users", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	openid: varchar({ length: 64 }),
	unionid: varchar({ length: 64 }),
	nickname: varchar({ length: 50 }),
	avatar: varchar({ length: 500 }),
	userCode: varchar("user_code", { length: 10 }).notNull(),
	createTime: timestamp("create_time", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updateTime: timestamp("update_time", { withTimezone: true, mode: 'string' }),
	wxOpenid: varchar("wx_openid", { length: 64 }),
}, (table) => [
	index("users_openid_idx").using("btree", table.openid.asc().nullsLast().op("text_ops")),
	index("users_user_code_idx").using("btree", table.userCode.asc().nullsLast().op("text_ops")),
	index("users_wx_openid_idx").using("btree", table.wxOpenid.asc().nullsLast().op("text_ops")),
	unique("users_openid_unique").on(table.openid),
	unique("users_user_code_unique").on(table.userCode),
	unique("users_wx_openid_unique").on(table.wxOpenid),
]);

export const inspirations = pgTable("inspirations", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }),
	title: varchar({ length: 255 }).notNull(),
	image: varchar({ length: 500 }),
	source: varchar({ length: 20 }).default('other').notNull(),
	primaryTag: varchar("primary_tag", { length: 20 }).default('spot').notNull(),
	location: jsonb(),
	time: varchar({ length: 50 }),
	price: text(),
	rating: integer(),
	createTime: timestamp("create_time", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updateTime: timestamp("update_time", { withTimezone: true, mode: 'string' }),
	description: text(),
	originalUrl: text("original_url"),
	tags: text().array(),
	locationName: text("location_name"),
	secondaryTag: varchar("secondary_tag", { length: 100 }),
	isFavorite: boolean("is_favorite").default(false),
}, (table) => [
	index("inspirations_create_time_idx").using("btree", table.createTime.asc().nullsLast().op("timestamptz_ops")),
	index("inspirations_type_idx").using("btree", table.primaryTag.asc().nullsLast().op("text_ops")),
	index("inspirations_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
]);

export const voteRecords = pgTable("vote_records", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	sessionId: varchar("session_id", { length: 36 }).notNull(),
	inspirationId: varchar("inspiration_id", { length: 36 }).notNull(),
	inspirationTitle: varchar("inspiration_title", { length: 255 }).notNull(),
	voterOpenid: varchar("voter_openid", { length: 64 }),
	voterName: varchar("voter_name", { length: 50 }).default('微信用户').notNull(),
	voteValue: integer("vote_value").notNull(),
	createTime: timestamp("create_time", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("vote_records_inspiration_id_idx").using("btree", table.inspirationId.asc().nullsLast().op("text_ops")),
	index("vote_records_session_id_idx").using("btree", table.sessionId.asc().nullsLast().op("text_ops")),
	index("vote_records_voter_openid_idx").using("btree", table.voterOpenid.asc().nullsLast().op("text_ops")),
	unique("vote_records_unique").on(table.sessionId, table.inspirationId, table.voterOpenid),
]);

export const voteSessions = pgTable("vote_sessions", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	tripId: varchar("trip_id", { length: 36 }).notNull(),
	shareCode: varchar("share_code", { length: 16 }).notNull(),
	title: varchar({ length: 255 }).notNull(),
	creatorName: varchar("creator_name", { length: 50 }),
	inspirationPoints: jsonb().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	createTime: timestamp("create_time", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("vote_sessions_create_time_idx").using("btree", table.createTime.asc().nullsLast().op("timestamptz_ops")),
	index("vote_sessions_share_code_idx").using("btree", table.shareCode.asc().nullsLast().op("text_ops")),
	index("vote_sessions_trip_id_idx").using("btree", table.tripId.asc().nullsLast().op("text_ops")),
	unique("vote_sessions_share_code_unique").on(table.shareCode),
]);
