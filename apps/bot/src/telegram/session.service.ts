import { Injectable } from "@nestjs/common";
import { ApiClient } from "../api/api.client.js";

export type Identity = { role: "customer"; customerId: string } | { role: "owner"; userId: string };

// Caches chatId -> identity in memory so most turns skip the API round
// trip; a cache miss (process restart, or never-registered chat) falls
// back to the API. For a private Telegram chat, chatId === the user's
// telegramId. Owner is checked first since /link binds far fewer chats
// than /start does — either check works, this just avoids the more common
// customer chat making a wasted owner lookup on every cold cache hit.
@Injectable()
export class SessionService {
  private readonly cache = new Map<number, Identity>();

  constructor(private readonly api: ApiClient) {}

  async resolve(chatId: number): Promise<Identity | null> {
    const cached = this.cache.get(chatId);
    if (cached) return cached;

    const owner = await this.api
      .get<{ id: string } | null>(`/bot/owner/by-telegram/${chatId}`)
      .catch(() => null);

    if (owner) {
      const identity: Identity = { role: "owner", userId: owner.id };
      this.cache.set(chatId, identity);
      return identity;
    }

    const customer = await this.api
      .get<{ id: string } | null>(`/bot/customers/by-telegram/${chatId}`)
      .catch(() => null);
      
    if (customer) {
      const identity: Identity = { role: "customer", customerId: customer.id };
      this.cache.set(chatId, identity);
      return identity;
    }

    return null;
  }

  // The menu/card flows only ever act on a customer, never an owner.
  async getCustomerId(chatId: number): Promise<string | null> {
    const identity = await this.resolve(chatId);
    return identity?.role === "customer" ? identity.customerId : null;
  }

  rememberCustomer(chatId: number, customerId: string) {
    this.cache.set(chatId, { role: "customer", customerId });
  }

  rememberOwner(chatId: number, userId: string) {
    this.cache.set(chatId, { role: "owner", userId });
  }
}
