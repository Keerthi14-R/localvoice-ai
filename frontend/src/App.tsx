import { useState, useEffect, useRef } from 'react';
import { UploadCloud, Mic, AlertCircle, Loader2, XCircle } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { AudioUploader } from './components/AudioUploader';
import { AudioRecorder } from './components/AudioRecorder';
import { TranscriptEditor } from './components/TranscriptEditor';
import { HistoryList } from './components/HistoryList';
import { SettingsModal } from './components/SettingsModal';
import { useTheme } from './hooks/useTheme';
import { Job } from './types';
import { api } from './services/api';

export function App() {
  const { theme, toggleTheme } = useTheme();
  const [currentTab, setCurrentTab] = useState<'transcribe' | 'history'>('transcribe');
  const [inputMode, setInputMode] = useState<'upload' | 'record'>('upload');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Active Job State
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [activeAudioUrl, setActiveAudioUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cleanupSseRef = useRef<(() => void) | null>(null);

  // Poll or SSE subscribe to active job updates
  useEffect(() => {
    if (!activeJob || activeJob.status === 'completed' || activeJob.status === 'failed' || activeJob.status === 'cancelled') {
      if (cleanupSseRef.current) {
        cleanupSseRef.current();
        cleanupSseRef.current = null;
      }
      return;
    }

    // Subscribe to SSE events
    const cleanup = api.subscribeToEvents(
      activeJob.id,
      (eventData) => {
        if (eventData.status === 'completed') {
          // Fetch complete job results with segments
          api.getJob(activeJob.id).then((freshJob) => {
            setActiveJob(freshJob);
          }).catch(console.error);
        } else if (eventData.status === 'failed') {
          setActiveJob((prev) => prev ? { ...prev, status: 'failed', error_message: eventData.error } : null);
        } else {
          setActiveJob((prev) => prev ? { ...prev, status: eventData.status as any, progress: eventData.progress } : null);
        }
      },
      // Fallback: poll if SSE drops
      () => {
        const interval = setInterval(async () => {
          try {
            const freshJob = await api.getJob(activeJob.id);
            setActiveJob(freshJob);
            if (freshJob.status === 'completed' || freshJob.status === 'failed' || freshJob.status === 'cancelled') {
              clearInterval(interval);
            }
          } catch (e) {
            clearInterval(interval);
          }
        }, 1500);
        return () => clearInterval(interval);
      }
    );

    cleanupSseRef.current = cleanup;

    return () => {
      if (cleanupSseRef.current) {
        cleanupSseRef.current();
        cleanupSseRef.current = null;
      }
    };
  }, [activeJob?.id, activeJob?.status]);

  const handleStartUploadTranscription = async (file: File, language: string, model: string) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const created = await api.createTranscription(file, file.name, language, model);
      const url = URL.createObjectURL(file);
      setActiveAudioUrl(url);

      // Set initial active job
      setActiveJob({
        id: created.id,
        filename: created.filename,
        display_name: created.display_name,
        status: 'queued',
        progress: 0,
        model: model,
        language_requested: language !== 'auto' ? language : null,
        has_audio: true,
        created_at: created.created_at,
        updated_at: created.created_at,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit audio for transcription');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartRecordTranscription = async (
    blob: Blob | File,
    filename: string,
    language: string,
    model: string
  ) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const created = await api.createTranscription(blob, filename, language, model);
      const url = URL.createObjectURL(blob);
      setActiveAudioUrl(url);

      setActiveJob({
        id: created.id,
        filename: created.filename,
        display_name: created.display_name,
        status: 'queued',
        progress: 0,
        model: model,
        language_requested: language !== 'auto' ? language : null,
        has_audio: true,
        created_at: created.created_at,
        updated_at: created.created_at,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit voice recording');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelActiveJob = async () => {
    if (!activeJob) return;
    try {
      await api.cancelJob(activeJob.id);
      setActiveJob((prev) => prev ? { ...prev, status: 'cancelled' } : null);
    } catch (err: any) {
      alert(`Could not cancel job: ${err.message}`);
    }
  };

  const handleSelectHistoryJob = async (job: Job) => {
    try {
      const detailed = await api.getJob(job.id);
      setActiveJob(detailed);
      setActiveAudioUrl(null); // backend stream will be used if has_audio
      setCurrentTab('transcribe');
    } catch (err: any) {
      alert(`Could not load job details: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8">
        {currentTab === 'transcribe' ? (
          <div className="space-y-8">
            {/* Mode Switcher Tabs */}
            <div className="flex justify-center">
              <div className="inline-flex p-1 bg-gray-200/70 dark:bg-gray-800/80 rounded-xl">
                <button
                  onClick={() => setInputMode('upload')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                    inputMode === 'upload'
                      ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Upload Audio File</span>
                </button>

                <button
                  onClick={() => setInputMode('record')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                    inputMode === 'record'
                      ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Mic className="w-4 h-4" />
                  <span>Record Microphone</span>
                </button>
              </div>
            </div>

            {/* Error Feedback */}
            {errorMessage && (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Input Component */}
            {inputMode === 'upload' ? (
              <AudioUploader
                onStartTranscription={handleStartUploadTranscription}
                isSubmitting={isSubmitting}
                maxUploadMb={25}
              />
            ) : (
              <AudioRecorder
                onStartTranscription={handleStartRecordTranscription}
                isSubmitting={isSubmitting}
              />
            )}

            {/* Active Processing / Queued Status Banner */}
            {activeJob && (activeJob.status === 'queued' || activeJob.status === 'processing') && (
              <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-900/60 shadow-md space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                        {activeJob.status === 'queued' ? 'Waiting in Queue...' : 'Transcribing Speech Locally...'}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {activeJob.display_name} • Model: <span className="capitalize">{activeJob.model}</span>
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleCancelActiveJob}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(5, activeJob.progress)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-gray-400">
                    <span>Inference running offline on CPU (INT8)</span>
                    <span>{activeJob.progress}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Completed Transcript View */}
            {activeJob && activeJob.status === 'completed' && (
              <TranscriptEditor
                job={activeJob}
                audioUrl={activeAudioUrl}
                onJobUpdated={(updated) => setActiveJob(updated)}
              />
            )}

            {/* Failed Job Banner */}
            {activeJob && activeJob.status === 'failed' && (
              <div className="p-5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs space-y-1">
                <div className="font-bold text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>Transcription Failed</span>
                </div>
                <p>{activeJob.error_message || 'An unknown error occurred during inference.'}</p>
              </div>
            )}
          </div>
        ) : (
          <HistoryList onSelectJob={handleSelectHistoryJob} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 py-6 text-center text-xs text-gray-500 dark:text-gray-400">
        <p>LocalVoice AI — 100% Private & Offline Speech Recognition Powered by Faster-Whisper</p>
      </footer>

      {/* Settings Modal */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
export default App;
