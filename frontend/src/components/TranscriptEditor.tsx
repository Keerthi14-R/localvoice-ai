import React, { useState, useEffect, useRef } from 'react';
import {
  Copy,
  Check,
  Download,
  Play,
  RotateCcw,
  Save,
  Clock,
  Cpu,
  Globe,
  Volume2,
} from 'lucide-react';
import { Job } from '../types';
import { formatSeconds, formatTimestamp } from '../utils/formatters';
import { api } from '../services/api';

interface TranscriptEditorProps {
  job: Job;
  audioUrl?: string | null;
  onJobUpdated: (updatedJob: Job) => void;
}

export const TranscriptEditor: React.FC<TranscriptEditorProps> = ({
  job,
  audioUrl,
  onJobUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'segments' | 'text'>('segments');
  const [textValue, setTextValue] = useState<string>(job.edited_text || job.text || '');
  const [isCopied, setIsCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Sync text value if job changes
  useEffect(() => {
    setTextValue(job.edited_text || job.text || '');
  }, [job.id, job.edited_text, job.text]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textValue);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy', e);
    }
  };

  const handleSaveText = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const updated = await api.updateJob(job.id, { edited_text: textValue });
      onJobUpdated(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('Failed to save edited transcript', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToOriginal = async () => {
    if (!job.text) return;
    setTextValue(job.text);
    setIsSaving(true);
    try {
      const updated = await api.updateJob(job.id, { edited_text: job.text });
      onJobUpdated(updated);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSeek = (startSeconds: number) => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.currentTime = startSeconds;
      audioPlayerRef.current.play().catch(() => {});
    }
  };

  // Determine effective audio stream: passed preview audioUrl, or backend audio endpoint if has_audio
  const effectiveAudioUrl = audioUrl || (job.has_audio ? api.getAudioUrl(job.id) : null);

  const isEdited = job.edited_text && job.edited_text !== job.text;

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
      {/* Header & Metrics */}
      <div className="p-5 border-b border-gray-200 dark:border-gray-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                {job.display_name}
              </h2>
              {isEdited && (
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full">
                  Edited
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Model: <span className="font-medium capitalize">{job.model}</span>
            </p>
          </div>

          {/* Export Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              title="Copy to clipboard"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-brand-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{isCopied ? 'Copied' : 'Copy'}</span>
            </button>

            <a
              href={api.getExportUrl(job.id, 'txt')}
              download
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>TXT</span>
            </a>

            <a
              href={api.getExportUrl(job.id, 'srt')}
              download
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>SRT</span>
            </a>

            <a
              href={api.getExportUrl(job.id, 'vtt')}
              download
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>VTT</span>
            </a>
          </div>
        </div>

        {/* Real Performance Badges */}
        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800/60 px-2.5 py-1 rounded-lg">
            <Globe className="w-3.5 h-3.5 text-brand-500" />
            <span>
              Language:{' '}
              <strong className="text-gray-900 dark:text-white uppercase">
                {job.language_detected || 'Unknown'}
              </strong>{' '}
              {job.language_probability != null && (
                <span className="text-[11px] text-gray-500">
                  ({Math.round(job.language_probability * 100)}%)
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800/60 px-2.5 py-1 rounded-lg">
            <Clock className="w-3.5 h-3.5 text-blue-500" />
            <span>
              Audio Duration: <strong>{formatSeconds(job.duration)}</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800/60 px-2.5 py-1 rounded-lg">
            <Cpu className="w-3.5 h-3.5 text-purple-500" />
            <span>
              Processing: <strong>{job.processing_time?.toFixed(2) ?? '--'}s</strong>
              {job.real_time_factor != null && (
                <span className="text-[11px] text-gray-500 ml-1">
                  ({job.real_time_factor.toFixed(2)}x RTF)
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Audio Player for Interactive Playback & Seeking */}
        {effectiveAudioUrl && (
          <div className="pt-2">
            <div className="flex items-center gap-2 mb-1.5">
              <Volume2 className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Audio Playback (Click timestamps to seek)
              </span>
            </div>
            <audio
              ref={audioPlayerRef}
              controls
              src={effectiveAudioUrl}
              className="w-full h-10 rounded-lg"
            />
          </div>
        )}
      </div>

      {/* Editor / Segments Toggle */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 px-5">
        <button
          onClick={() => setActiveTab('segments')}
          className={`py-2.5 px-4 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'segments'
              ? 'border-brand-500 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Timestamps & Segments ({job.segments?.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab('text')}
          className={`py-2.5 px-4 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'text'
              ? 'border-brand-500 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Full Editable Text
        </button>
      </div>

      {/* Content Area */}
      <div className="p-5">
        {activeTab === 'segments' ? (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            {job.segments && job.segments.length > 0 ? (
              job.segments.map((seg, idx) => (
                <div
                  key={idx}
                  className="group flex flex-col sm:flex-row sm:items-start gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/60 border border-transparent hover:border-gray-200 dark:hover:border-gray-700/60 transition"
                >
                  <button
                    onClick={() => handleSeek(seg.start)}
                    className="flex-shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-brand-500/10 hover:bg-brand-500/20 text-brand-700 dark:text-brand-400 font-mono text-[11px] font-semibold transition"
                    title="Seek to this time"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>
                      {formatTimestamp(seg.start)} - {formatTimestamp(seg.end)}
                    </span>
                  </button>

                  <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed font-sans select-text">
                    {seg.text}
                  </p>
                </div>
              ))
            ) : (
              <div className="p-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                {textValue || 'No transcript text available.'}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <textarea
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              rows={12}
              className="w-full p-4 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm text-gray-900 dark:text-gray-100 font-sans focus:outline-none focus:ring-2 focus:ring-brand-500 leading-relaxed resize-y"
              placeholder="Edit your transcript here..."
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveText}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                </button>

                {saveSuccess && (
                  <span className="text-xs text-brand-600 dark:text-brand-400 font-medium flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Saved!
                  </span>
                )}
              </div>

              {isEdited && (
                <button
                  onClick={handleResetToOriginal}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset to Original</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
