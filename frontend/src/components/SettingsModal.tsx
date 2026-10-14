import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, ShieldCheck, Info } from 'lucide-react';
import { Settings } from '../types';
import { api } from '../services/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      api
        .getSettings()
        .then(setSettings)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-brand-600 dark:text-brand-500" />
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              System Settings & Privacy
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="py-8 text-center text-xs text-gray-400">Loading system settings...</div>
        ) : settings ? (
          <div className="space-y-4 text-xs">
            {/* Privacy Guarantee Card */}
            <div className="p-3.5 rounded-xl bg-brand-50/60 dark:bg-brand-950/30 border border-brand-200/50 dark:border-brand-900/50 text-brand-800 dark:text-brand-300 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-brand-600 flex-shrink-0" />
                <span>100% Offline & Local-First</span>
              </div>
              <p className="text-[11px] leading-relaxed opacity-90">
                All voice processing runs directly on your machine using Faster-Whisper. Audio and transcriptions are never sent to external servers or cloud APIs.
              </p>
            </div>

            {/* Inference Hardware Profile */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40">
                <span className="text-gray-500 block mb-1">Inference Device</span>
                <span className="font-semibold text-gray-900 dark:text-white capitalize">
                  {settings.device} ({settings.compute_type})
                </span>
              </div>

              <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40">
                <span className="text-gray-500 block mb-1">CPU Threads</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {settings.cpu_threads} workers
                </span>
              </div>

              <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40">
                <span className="text-gray-500 block mb-1">Max Upload Limit</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {settings.max_upload_mb} MB
                </span>
              </div>

              <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40">
                <span className="text-gray-500 block mb-1">Audio Retention</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {settings.keep_audio_files ? 'Retain source' : 'Delete after transcribe'}
                </span>
              </div>
            </div>

            {/* FFmpeg Status */}
            <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-800 flex items-start gap-3">
              {settings.ffmpeg_available ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              ) : (
                <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <span className="font-semibold text-gray-900 dark:text-white">
                  FFmpeg Audio Engine: {settings.ffmpeg_available ? 'Available' : 'Using Bundled PyAV'}
                </span>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {settings.ffmpeg_available
                    ? 'System FFmpeg is installed and ready for advanced audio decoding.'
                    : 'Faster-Whisper built-in PyAV decoders are active. For full system FFmpeg, install via `winget install Gyan.FFmpeg`.'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-red-500">Could not retrieve settings.</div>
        )}

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
