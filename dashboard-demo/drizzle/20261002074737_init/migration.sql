CREATE TABLE `chat_messages` (
	`message_id` text PRIMARY KEY,
	`view_id` text NOT NULL,
	`role` text NOT NULL,
	`parts` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_chat_messages_view_id_views_view_id_fk` FOREIGN KEY (`view_id`) REFERENCES `views`(`view_id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `views` (
	`view_id` text PRIMARY KEY,
	`title` text NOT NULL,
	`project_id` text NOT NULL,
	`component_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `chat_messages_view_id_idx` ON `chat_messages` (`view_id`,`position`);