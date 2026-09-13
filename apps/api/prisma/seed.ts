import 'dotenv/config';
// Thin wrapper for local dev (`tsx prisma/seed.ts`, .env loaded above) and
// `prisma db seed`. The actual logic lives in src/seed.ts so it also
// compiles into dist/seed.js for the production image — see that file's
// comment.
import '../src/seed.js';
