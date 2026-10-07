ALTER TABLE "Session" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'web';
ALTER TABLE "Session" ADD CONSTRAINT "Session_channel_check" CHECK ("channel" IN ('web', 'mobile'));
