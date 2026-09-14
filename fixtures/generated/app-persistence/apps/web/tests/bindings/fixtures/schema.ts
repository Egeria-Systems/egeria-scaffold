import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const persistenceFixture = sqliteTable("persistence_fixture", {
  id: text("id").primaryKey(),
  value: text("value").notNull(),
}, (table) => [uniqueIndex("persistence_fixture_value_unique").on(table.value)]);
