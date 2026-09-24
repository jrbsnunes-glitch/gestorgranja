-- Login por username; e-mail permanece interno.
ALTER TABLE "User" ADD COLUMN "username" TEXT;

UPDATE "User"
SET "username" = LOWER(REGEXP_REPLACE(SPLIT_PART("email", '@', 1), '[^a-zA-Z0-9._-]', '', 'g'))
WHERE "username" IS NULL OR "username" = '';

UPDATE "User"
SET "username" = 'user_' || SUBSTRING("id"::text, 1, 8)
WHERE "username" IS NULL OR LENGTH("username") < 3;

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
