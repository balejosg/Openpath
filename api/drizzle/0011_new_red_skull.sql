CREATE INDEX "email_verification_tokens_user_expires_idx" ON "email_verification_tokens" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "health_reports_hostname_reported_at_idx" ON "health_reports" USING btree ("hostname","reported_at");--> statement-breakpoint
CREATE INDEX "machines_classroom_created_idx" ON "machines" USING btree ("classroom_id","created_at");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_expires_idx" ON "password_reset_tokens" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "requests_group_created_idx" ON "requests" USING btree ("group_id","created_at");--> statement-breakpoint
CREATE INDEX "requests_status_created_idx" ON "requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "roles_role_idx" ON "roles" USING btree ("role");--> statement-breakpoint
CREATE INDEX "tokens_expires_at_idx" ON "tokens" USING btree ("expires_at");