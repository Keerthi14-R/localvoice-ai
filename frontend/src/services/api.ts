import { Job, JobListResponse, Settings, Health } from '../types';

const API_BASE = '/api';

export const api = {
  async getHealth(): Promise<Health> {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error('Failed to fetch health status');
    return res.json();
  },

  async getSettings(): Promise<Settings> {
    const res = await fetch(`${API_BASE}/settings`);
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
  },

  async createTranscription(
    file: File | Blob,
    filename: string,
    language?: string,
    model?: string
  ): Promise<{ id: string; filename: string; display_name: string; status: string; created_at: string }> {
    const formData = new FormData();
    formData.append('file', file, filename);
    if (language && language !== 'auto') {
      formData.append('language', language);
    }
    if (model) {
      formData.append('model', model);
    }

    const res = await fetch(`${API_BASE}/transcriptions`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(err.detail || 'Failed to submit transcription job');
    }

    return res.json();
  },

  async getJob(jobId: string): Promise<Job> {
    const res = await fetch(`${API_BASE}/transcriptions/${jobId}`);
    if (!res.ok) throw new Error('Failed to fetch job details');
    return res.json();
  },

  async listJobs(
    page = 1,
    pageSize = 20,
    search?: string,
    status?: string
  ): Promise<JobListResponse> {
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
    });
    if (search) params.append('search', search);
    if (status) params.append('status', status);

    const res = await fetch(`${API_BASE}/transcriptions?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch jobs list');
    return res.json();
  },

  async updateJob(
    jobId: string,
    payload: { display_name?: string; edited_text?: string }
  ): Promise<Job> {
    const res = await fetch(`${API_BASE}/transcriptions/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to update job');
    return res.json();
  },

  async cancelJob(jobId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/transcriptions/${jobId}/cancel`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to cancel job');
  },

  async deleteJob(jobId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/transcriptions/${jobId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete job');
  },

  async deleteAllJobs(): Promise<{ deleted_count: number }> {
    const res = await fetch(`${API_BASE}/transcriptions`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete all jobs');
    return res.json();
  },

  getExportUrl(jobId: string, format: 'txt' | 'srt' | 'vtt'): string {
    return `${API_BASE}/transcriptions/${jobId}/export?format=${format}`;
  },

  getAudioUrl(jobId: string): string {
    return `${API_BASE}/transcriptions/${jobId}/audio`;
  },

  subscribeToEvents(
    jobId: string,
    onMessage: (data: { status: string; progress: number; error?: string }) => void,
    onError?: (err: any) => void
  ): () => void {
    const eventSource = new EventSource(`${API_BASE}/transcriptions/${jobId}/events`);

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        onMessage(parsed);
      } catch (e) {
        // Heartbeat or malformed
      }
    };

    eventSource.onerror = (e) => {
      if (onError) onError(e);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  },
};
