ALTER TABLE "commentary" ALTER COLUMN "tags" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "commentary" ALTER COLUMN "tags" SET DEFAULT '[]'::jsonb;