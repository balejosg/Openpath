CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "push_subscriptions_group_ids_gin_idx" ON "push_subscriptions" USING gin ("group_ids");--> statement-breakpoint
CREATE INDEX "roles_group_ids_gin_idx" ON "roles" USING gin ("group_ids");