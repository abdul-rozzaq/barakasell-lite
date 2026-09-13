import "dotenv/config";
import argon2 from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const CATEGORIES = [
  "Bo'yoq",
  "Sement va qurilish",
  "Elektr tovarlari",
  "Santexnika",
  "Asboblar",
];

async function main() {
  await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });

  for (const name of CATEGORIES) {
    await prisma.category.upsert({
      where: { name },
      create: { name },
      update: {},
    });
  }

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

  const cashierPinHash = await argon2.hash("1234");
  const cashierName = "Dilnoza Yusupova";
  const existingCashier = await prisma.user.findFirst({
    where: { name: cashierName, role: "CASHIER" },
  });
  if (!existingCashier) {
    await prisma.user.create({
      data: {
        name: cashierName,
        pinHash: cashierPinHash,
        role: "CASHIER",
      },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
