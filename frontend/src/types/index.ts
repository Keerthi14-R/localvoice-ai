export interface Segment {
  id?: number;
  start: number;
  end: number;
  text: string;
}

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface Job {
  id: string;
  filename: string;
  display_name: string;
  status: JobStatus;
  progress: number;
  model: string;
  language_requested?: string | null;
  language_detected?: string | null;
  language_probability?: number | null;
  duration?: number | null;
  processing_time?: number | null;
  real_time_factor?: number | null;
  text?: string | null;
  edited_text?: string | null;
  has_audio: boolean;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  segments?: Segment[];
}

export interface Settings {
  app_name: string;
  app_env: string;
  max_upload_mb: number;
  max_duration_minutes: number;
  keep_audio_files: boolean;
  default_model: string;
  available_models: string[];
  device: string;
  compute_type: string;
  cpu_threads: number;
  max_concurrent_transcriptions: number;
  ffmpeg_available: boolean;
}

export interface Health {
  status: string;
  app_name: string;
  version: string;
  whisper_engine: string;
  device: string;
  compute_type: string;
  ffmpeg_installed: boolean;
  cached_models: string[];
}

export interface JobListResponse {
  items: Job[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
