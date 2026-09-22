import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

// Talks only to /api/bot/* (see apps/api/src/modules/bot) — guarded by the
// shared X-Service-Key, never a user JWT. The bot has no Prisma client and
// never touches the database directly; this is its only path to data.
@Injectable()
export class ApiClient {
  private readonly baseUrl: string;
  private readonly serviceKey: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.getOrThrow<string>('API_URL');
    this.serviceKey = this.config.getOrThrow<string>('SERVICE_API_KEY');
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Key': this.serviceKey,
        ...init.headers,
      },
    });
    if (res.status === 204) return undefined as T;

    const body = await res.json().catch(() => undefined);
    if (!res.ok) {
      const message = body?.message ?? `So'rov xato: ${res.status}`;
      throw new ApiError(Array.isArray(message) ? message.join(', ') : message, res.status);
    }
    return body as T;
  }
}
