import { Injectable } from '@angular/core';
import { createClient } from '@neondatabase/neon-js';
import { environment } from '../../../../environments/environment';
import { getAuthErrorMessage } from '../../utils/auth-error.mapper';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

@Injectable({ providedIn: 'root' })
export class NeonService {
  readonly client: ReturnType<typeof createClient>;

  constructor() {
    this.client = createClient({
      auth: { url: this.resolveUrl(environment.neonAuthUrl) },
      dataApi: { url: this.resolveUrl(environment.neonDataApiUrl) },
    });
  }

  private resolveUrl(url: string): string {
    if (url.startsWith('/') && typeof window !== 'undefined') {
      return window.location.origin + url;
    }
    return url;
  }

  async getSession() {
    const { data, error } = await this.client.auth.getSession();
    if (error) return null;
    return data?.session ?? null;
  }

  async getUser(): Promise<AuthUser | null> {
    const { data, error } = await this.client.auth.getSession();
    if (error || !data?.user) return null;
    return {
      id: data.user.id,
      email: data.user.email,
      name: data.user.name ?? undefined,
    };
  }

  async signUp(email: string, password: string, name: string) {
    try {
      const result = await this.client.auth.signUp.email({
        email,
        password,
        name,
      });
      if (result.error) return { data: null, error: result.error };

      await this.client.auth.getSession();
      return { data: result.data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  async signIn(email: string, password: string) {
    try {
      const result = await this.client.auth.signIn.email({ email, password });
      if (result.error) return { data: null, error: result.error };

      await this.client.auth.getSession();
      return { data: result.data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  async signOut() {
    return this.client.auth.signOut();
  }

  getAuthErrorMessage(error: unknown): string {
    return getAuthErrorMessage(error);
  }
}
