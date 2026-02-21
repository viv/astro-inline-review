import type { Annotation, TextAnnotation, ElementAnnotation, PageNote, ReviewStore } from './types.js';

const API_BASE = '/__inline-review/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  /** Fetch full store, optionally filtered by page URL */
  async getStore(page?: string): Promise<ReviewStore> {
    const query = page ? `?page=${encodeURIComponent(page)}` : '';
    return request<ReviewStore>(`/annotations${query}`);
  },

  async createAnnotation(data: Omit<TextAnnotation, 'id' | 'createdAt' | 'updatedAt'> | Omit<ElementAnnotation, 'id' | 'createdAt' | 'updatedAt'>): Promise<Annotation> {
    return request<Annotation>('/annotations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateAnnotation(id: string, data: Partial<Annotation>): Promise<Annotation> {
    return request<Annotation>(`/annotations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deleteAnnotation(id: string): Promise<void> {
    await request(`/annotations/${id}`, { method: 'DELETE' });
  },

  async createPageNote(data: Omit<PageNote, 'id' | 'createdAt' | 'updatedAt'>): Promise<PageNote> {
    return request<PageNote>('/page-notes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updatePageNote(id: string, data: Partial<PageNote>): Promise<PageNote> {
    return request<PageNote>(`/page-notes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deletePageNote(id: string): Promise<void> {
    await request(`/page-notes/${id}`, { method: 'DELETE' });
  },

  async getExport(): Promise<string> {
    const res = await fetch(`${API_BASE}/export`);
    return res.text();
  },
};
