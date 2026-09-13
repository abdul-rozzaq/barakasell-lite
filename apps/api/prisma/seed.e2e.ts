import "dotenv/config";
import argon2 from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

// Fixture data the e2e suite hardcodes against (admin login "admin" /
// password "admin123", one cashier with PIN "1234"). Kept separate from
// prisma/seed.ts on purpose — that script now bootstraps a real admin from
// CLI-supplied credentials only and must never carry demo/default ones.
export default async function seedForE2e() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    const adminPasswordHash = await argon2.hash("admin123");
    await prisma.user.upsert({
      where: { login: "admin" },
      create: {
        name: "Egasi",
        login: "admin",
        passwordHash: adminPasswordHash,
        role: "ADMIN",
      },
      update: {},
    });

    const existingCashier = await prisma.user.findFirst({ where: { role: "CASHIER" } });
    if (!existingCashier) {
      const cashierPinHash = await argon2.hash("1234");
      await prisma.user.create({
        data: {
          name: "Dilnoza Yusupova",
          pinHash: cashierPinHash,
          role: "CASHIER",
        },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Runnable directly (`tsx prisma/seed.e2e.ts`) as well as importable as
// vitest's globalSetup (see vitest.config.e2e.ts).
if (import.meta.url === `file://${process.argv[1]}`) {
  await seedForE2e();
  console.log("E2E seed complete.");
}
