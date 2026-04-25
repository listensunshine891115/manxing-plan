import { relations } from "drizzle-orm/relations";
import { trips, votes } from "./schema";

export const votesRelations = relations(votes, ({one}) => ({
	trip: one(trips, {
		fields: [votes.tripId],
		references: [trips.id]
	}),
}));

export const tripsRelations = relations(trips, ({many}) => ({
	votes: many(votes),
}));