-- Runs once when the local Postgres container is first created.
-- Shadow database for Prisma's drift check and `migrate dev`.
CREATE DATABASE dyjext_shadow OWNER dyjext;
