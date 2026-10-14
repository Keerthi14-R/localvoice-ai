import React, { useState, useRef } from 'react';
import { UploadCloud, FileAudio, AlertCircle, X } from 'lucide-react';
import { formatBytes, formatSeconds } from '../utils/formatters';

interface AudioUploaderProps {
  onStartTranscription: (file: File, language: string, model: string) => Promise<void>;
  isSubmitting: boolean;
  maxUploadMb: number;
}

const SUPPORTED_EXTS = ['.wav', '.mp3', '.m4a', '.mp4', '.flac', '.ogg', '.webm'];

export const AudioUploader: React.FC<AudioUploaderProps> = ({
  onStartTranscription,
  isSubmitting,
  maxUploadMb,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [language, setLanguage] = useState<string>('auto');
  const [model, setModel] = useState<string>('base');
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleFiles = (file: File) => {
    setError(null);
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!SUPPORTED_EXTS.includes(ext)) {
      setError(`Unsupported format "${ext}". Supported: ${SUPPORTED_EXTS.join(', ')}`);
      return;
    }

    if (file.size > maxUploadMb * 1024 * 1024) {
      setError(`File exceeds the limit of ${maxUploadMb} MB. Please select a smaller file.`);
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    // Load duration
    const tempAudio = new Audio(url);
    tempAudio.onloadedmetadata = () => {
      if (!isNaN(tempAudio.duration) && isFinite(tempAudio.duration)) {
        setDuration(tempAudio.duration);
      }
    };
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files[0]);
    }
  };

  const handleClear = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setDuration(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    try {
      await onStartTranscription(selectedFile, language, model);
    } catch (err: any) {
      setError(err.message || 'Failed to start transcription');
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Drop Zone */}
      {!selectedFile ? (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
            dragActive
              ? 'border-brand-500 bg-brand-500/5'
              : 'border-gray-300 dark:border-gray-700 hover:border-brand-500/50 hover:bg-gray-50 dark:hover:bg-gray-900/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".wav,.mp3,.m4a,.mp4,.flac,.ogg,.webm"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFiles(e.target.files[0]);
              }
            }}
          />
          <div className="w-14 h-14 mx-auto rounded-full bg-brand-500/10 dark:bg-brand-500/20 text-brand-600 dark:text-brand-500 flex items-center justify-center mb-4">
            <UploadCloud className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Click to upload or drag & drop audio
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
            WAV, MP3, M4A, MP4, FLAC, OGG, WebM (Max {maxUploadMb} MB)
          </p>
        </div>
      ) : (
        /* Selected File Card */
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-lg bg-brand-500/10 text-brand-600 flex-shrink-0 flex items-center justify-center">
                <FileAudio className="w-5 h-5" />
              </div>
              <div className="truncate">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatBytes(selectedFile.size)} {duration ? `• ${formatSeconds(duration)}` : ''}
                </p>
              </div>
            </div>
            <button
              onClick={handleClear}
              disabled={isSubmitting}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              title="Remove file"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Audio Player Preview */}
          {previewUrl && (
            <div className="pt-2">
              <audio
                ref={audioRef}
                controls
                src={previewUrl}
                className="w-full h-10 rounded-lg"
              />
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Model & Language Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Model Size
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={isSubmitting}
            className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
          >
            <option value="tiny">Tiny (~39 MB, fastest, minimal RAM)</option>
            <option value="base">Base (~74 MB, recommended default)</option>
            <option value="small">Small (~244 MB, higher accuracy)</option>
            <option value="medium">Medium (~769 MB, slow on CPU)</option>
            <option value="large-v3">Large-v3 (~1.5 GB, heavy RAM)</option>
          </select>
          <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 block">
            Base is recommended for CPU & 8 GB RAM.
          </span>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Language
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={isSubmitting}
            className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
          >
            <option value="auto">Automatic Detection (Default)</option>
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="it">Italian</option>
            <option value="pt">Portuguese</option>
            <option value="hi">Hindi (हिन्दी)</option>
            <option value="ja">Japanese (日本語)</option>
            <option value="zh">Chinese (中文)</option>
            <option value="ar">Arabic (العربية)</option>
            <option value="ru">Russian</option>
          </select>
          <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 block">
            Leave on automatic or select specific language.
          </span>
        </div>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={!selectedFile || isSubmitting}
        className={`w-full py-3 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-all ${
          !selectedFile || isSubmitting
            ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
            : 'bg-brand-600 hover:bg-brand-500 text-white cursor-pointer hover:shadow'
        }`}
      >
        {isSubmitting ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Submitting Job...</span>
          </>
        ) : (
          <>
            <FileAudio className="w-4 h-4" />
            <span>Transcribe Audio</span>
          </>
        )}
      </button>
    </div>
  );
};
