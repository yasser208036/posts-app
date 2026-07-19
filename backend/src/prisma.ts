import { PrismaClient } from "@prisma/client";

// Single shared client for the process. ts-node-dev --respawn creates a fresh
// process on reload, so no global-caching hack is needed for dev.
export const prisma = new PrismaClient();
