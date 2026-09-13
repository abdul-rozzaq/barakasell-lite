import "dotenv/config";
import argon2 from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Deliberately CLI-args only, never .env — a seeded admin credential must
// be typed by whoever runs this, not sit as a default anywhere in the repo
// or environment config.
function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

const adminLogin = readArg("admin-login");
const adminPassword = readArg("admin-password");

if (!adminLogin || !adminPassword) {
  console.error(
    "Xato: --admin-login va --admin-password argumentlari majburiy.\n" +
      "Misol: tsx prisma/seed.ts --admin-login=admin --admin-password=StrongPass123\n" +
      "(`prisma db seed` orqali: prisma db seed -- --admin-login=admin --admin-password=StrongPass123)",
  );
  process.exit(1);
}

async function main() {
  const adminPasswordHash = await argon2.hash(adminPassword!);
  await prisma.user.upsert({
    where: { login: adminLogin },
    create: {
      name: "Egasi",
      login: adminLogin,
      passwordHash: adminPasswordHash,
      role: "ADMIN",
    },
    // Re-running with a new --admin-password resets it — also doubles as
    // a password-reset path if the admin forgets it.
    update: { passwordHash: adminPasswordHash },
  });

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
