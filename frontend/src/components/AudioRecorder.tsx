import React, { useState } from 'react';
import { Mic, Square, X, AlertCircle, Send } from 'lucide-react';
import { useRecorder } from '../hooks/useRecorder';
import { formatSeconds } from '../utils/formatters';

interface AudioRecorderProps {
  onStartTranscription: (file: File | Blob, filename: string, language: string, model: string) => Promise<void>;
  isSubmitting: boolean;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onStartTranscription,
  isSubmitting,
}) => {
  const {
    isRecording,
    recordingTime,
    audioBlob,
    audioUrl,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
    resetRecording,
  } = useRecorder();

  const [language, setLanguage] = useState<string>('auto');
  const [model, setModel] = useState<string>('base');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!audioBlob) return;
    setSubmitError(null);
    try {
      const filename = `mic_recording_${Date.now()}.webm`;
      await onStartTranscription(audioBlob, filename, language, model);
      resetRecording();
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit recording');
    }
  };

  return (
    <div className="space-y-6">
      {/* Recording Display Card */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 text-center shadow-sm">
        {!isRecording && !audioUrl && (
          <div className="space-y-4">
            <button
              onClick={startRecording}
              disabled={isSubmitting}
              className="w-20 h-20 mx-auto rounded-full bg-red-500 hover:bg-red-600 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-red-500/25 transition-all group"
            >
              <Mic className="w-8 h-8 group-hover:scale-110 transition-transform" />
            </button>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                Record from Microphone
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
                Click to start recording your voice. Recording is processed locally with Faster-Whisper once completed.
              </p>
            </div>
          </div>
        )}

        {/* Live Recording State */}
        {isRecording && (
          <div className="space-y-5">
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
              <button
                onClick={stopRecording}
                className="relative z-10 w-16 h-16 rounded-full bg-red-600 text-white flex items-center justify-center shadow-md hover:bg-red-700 transition"
                title="Stop recording"
              >
                <Square className="w-6 h-6 fill-current" />
              </button>
            </div>

            <div className="space-y-1">
              <div className="text-2xl font-mono font-bold text-red-600 dark:text-red-400 tracking-wider">
                {formatSeconds(recordingTime)}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Recording in progress... Click the square button to stop.
              </p>
            </div>

            <button
              onClick={cancelRecording}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel Recording</span>
            </button>
          </div>
        )}

        {/* Finished Recording Preview */}
        {!isRecording && audioUrl && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                Recorded Audio ({formatSeconds(recordingTime)})
              </span>
              <button
                onClick={resetRecording}
                disabled={isSubmitting}
                className="text-xs text-red-500 hover:text-red-600 dark:hover:text-red-400"
              >
                Discard & Retake
              </button>
            </div>

            <audio controls src={audioUrl} className="w-full h-10 rounded-lg" />
          </div>
        )}
      </div>

      {(error || submitError) && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error || submitError}</span>
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
            disabled={isSubmitting || isRecording}
            className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
          >
            <option value="tiny">Tiny (~39 MB, fastest)</option>
            <option value="base">Base (~74 MB, recommended)</option>
            <option value="small">Small (~244 MB, higher accuracy)</option>
            <option value="medium">Medium (~769 MB)</option>
            <option value="large-v3">Large-v3 (~1.5 GB)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Language
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={isSubmitting || isRecording}
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
        </div>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={!audioBlob || isRecording || isSubmitting}
        className={`w-full py-3 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-all ${
          !audioBlob || isRecording || isSubmitting
            ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
            : 'bg-brand-600 hover:bg-brand-500 text-white cursor-pointer hover:shadow'
        }`}
      >
        {isSubmitting ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Submitting Recording...</span>
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            <span>Transcribe Recording</span>
          </>
        )}
      </button>

      <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center">
        Note: Recording is captured in your browser and transcribed locally after stopping.
      </p>
    </div>
  );
};
