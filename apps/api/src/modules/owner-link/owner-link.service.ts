import { Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';

interface PendingLink {
  userId: string;
  expiresAt: number;
}

// In-memory, short-lived (10 min) one-time codes linking an admin's own
// Telegram account to their User row (see UsersController's
// "Telegram'ga ulash" endpoint and BotController's link/owner endpoint).
// Not persisted — a restart just invalidates codes issued but not yet
// used, which is fine for a "generate, paste into the bot within a few
// minutes" flow; nothing durable depends on it surviving a restart.
@Injectable()
export class OwnerLinkService {
  private readonly codes = new Map<string, PendingLink>();
  private readonly ttlMs = 10 * 60 * 1000;

  generate(userId: string): string {
    const code = String(randomInt(100000, 1000000));
    this.codes.set(code, { userId, expiresAt: Date.now() + this.ttlMs });
    return code;
  }

  consume(code: string): string | null {
    const entry = this.codes.get(code);
    this.codes.delete(code);
    if (!entry || entry.expiresAt < Date.now()) return null;
    return entry.userId;
  }
}
