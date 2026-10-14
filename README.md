# LocalVoice AI 🎙️

A production-ready, local-first audio-to-text transcription web application built with **React**, **FastAPI**, and **Faster-Whisper (CTranslate2)**.

Designed specifically to operate **100% offline and privately** without cloud speech-to-text APIs, subscription keys, or external network requests during transcription.

---

## ⚡ Hardware Profile & Optimization

This implementation is pre-configured and optimized for **Windows 10/11 computers with 8 GB RAM or less and CPU-only inference (no dedicated GPU)**:

| Setting | Default Value | Rationale |
| :--- | :--- | :--- |
| **Model** | `base` (or `tiny`) | Lightweight footprint (~74 MB for base, ~39 MB for tiny) |
| **Device** | `cpu` | No CUDA or Nvidia GPU requirements |
| **Compute Type** | `int8` | Reduced memory usage and ~2-3x speedup on CPU |
| **CPU Threads** | `2` | Prevents CPU starvation and excessive thermal throttling |
| **Concurrent Jobs** | `1` | Strictly bounded queue to avoid out-of-memory crashes |
| **VAD Filter** | `True` | Silero Voice Activity Filter skips silent pauses |
| **Max File Upload** | `25 MB` (configurable) | Streamed directly to disk in 64 KB chunks |
| **Audio Retention** | Disabled by default | Deletes source audio after processing to protect privacy and disk space |

---

## 🏗️ Architecture

```
localvoice-ai/
├── frontend/                     # React 18 + Vite + TypeScript + Tailwind CSS
│   ├── src/
│   │   ├── components/           # AudioUploader, AudioRecorder, TranscriptEditor, HistoryList, SettingsModal
│   │   ├── hooks/                # useRecorder (MediaRecorder API), useTheme (Dark/Light mode)
│   │   ├── services/             # API client & SSE real-time event streaming
│   │   ├── types/                # TypeScript interfaces
│   │   └── utils/                # Formatters (timestamp SRT/VTT, byte units, durations)
│   ├── src/__tests__/            # Frontend test suite (Vitest + React Testing Library)
│   ├── package.json
│   └── vite.config.ts
├── backend/                      # Python 3.11 + FastAPI + Faster-Whisper
│   ├── app/
│   │   ├── api/routes/           # /api/health, /api/settings, /api/transcriptions
│   │   ├── core/                 # config.py (Pydantic BaseSettings), logging.py
│   │   ├── db/                   # SQLite database & SQLAlchemy Job model
│   │   ├── schemas/              # Pydantic request/response schemas
│   │   ├── services/             # TranscriptionService (Faster-Whisper lazy cache), exportservice, jobservice
│   │   ├── utils/                # File validation (magic bytes, safe UUID names), temp cleanup
│   │   ├── workers/              # Asynchronous single-worker queue & SSE event broadcaster
│   │   └── main.py               # FastAPI application with lifecycle management
│   ├── tests/                    # Pytest test suite (mocked inference + endpoints)
│   ├── benchmark.py              # CLI benchmark tool measuring inference time, RTF, and RAM
│   └── requirements.txt
├── storage/                      # SQLite database and temporary audio storage
├── requirements.txt              # Pinned tested dependencies (root level)
├── requirement.txt               # Alias reference to requirements.txt
├── .env                          # Active environment configuration
├── .env.example                  # Environment configuration template
├── docker-compose.yml            # Containerized deployment
├── Dockerfile.backend
└── Dockerfile.frontend
```

---

## 🚀 Quick Start (Windows PowerShell)

### 1. Prerequisites
- **Python**: 3.11.x (64-bit)
- **Node.js**: v18+ or v20+
- **FFmpeg** *(Optional)*: Faster-Whisper includes bundled audio decoders (PyAV), but system FFmpeg can be installed via `winget install Gyan.FFmpeg`.

---

### 2. Backend Setup
From the `localvoice-ai` folder:

```powershell
# Create Python 3.11 virtual environment
py -3.11 -m venv .venv

# Activate virtual environment
.\.venv\Scripts\Activate.ps1

# Upgrade pip & install backend dependencies
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

# Start FastAPI backend server
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
* **Interactive API Documentation**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
* **Application Health Endpoint**: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)
* **Safe Settings Endpoint**: [http://127.0.0.1:8000/api/settings](http://127.0.0.1:8000/api/settings)

---

### 3. Frontend Setup
In a second terminal window:

```powershell
cd C:\Users\004298\Documents\GitHub\localvoice-ai\frontend

# Install npm packages
npm install

# Start Vite development server
npm run dev
```
Open your browser to: [http://localhost:5173](http://localhost:5173)

---

## 🧪 Automated Tests

### Backend Tests (Pytest)
The backend test suite uses mocked inference to execute in under a second without requiring internet or downloading AI models:
```powershell
.\.venv\Scripts\python.exe -m pytest backend/tests -v
```
**Test Coverage:**
- Health check & settings schemas
- File validation (supported extensions, path traversal sanitization, upload size limits)
- Timestamp formatting & subtitle generation (TXT, SRT, VTT with Unicode Hindi/Japanese/Arabic support)
- Job creation, status transitions, retrieval, metadata edits, and deletion

### Frontend Tests (Vitest)
```powershell
cd frontend
npm run test
```
**Test Coverage:**
- Drag-and-drop audio uploader interaction & format checking
- Browser microphone recorder & error states
- Interactive transcript editor, timestamp seeking, and subtitle export downloads

### Production Frontend Build Check
```powershell
cd frontend
npm run build
```

---

## 📊 Benchmarking Inference & Memory

Run the built-in benchmark script to measure inference time, Real-Time Factor (RTF), and peak process memory:

```powershell
# Benchmark synthetic test audio using tiny model
.\.venv\Scripts\python.exe backend/benchmark.py --model tiny

# Benchmark synthetic test audio using base model (default)
.\.venv\Scripts\python.exe backend/benchmark.py --model base

# Benchmark an actual recorded audio file
.\.venv\Scripts\python.exe backend/benchmark.py --audio path\to\audio.mp3 --model base
```

*Actual Measured Benchmark on Windows (CPU INT8, 2 threads):*
- Model: `tiny`
- Audio Duration: 3.00 s
- Inference Time: 1.56 s (RTF: 0.52x — faster than real-time)
- Peak Process Memory: ~210 MB total RAM

---

## 🔒 Security & Privacy Boundary

- **Localhost Binding**: Binds exclusively to `127.0.0.1` by default.
- **Zero External Telemetry**: No third-party tracking, analytics, or external API calls.
- **Path Traversal Protection**: Uploaded files are assigned random UUID server-side names inside safe storage directories; original filenames are never trusted as filesystem paths.
- **Automatic Audio Cleanup**: Unless `KEEP_AUDIO_FILES=true` is set, source audio files are automatically deleted after transcription completes.
- **Trust Boundary**: Anyone with physical or network access to the local port can access the local SQLite database. Keep the application bound to localhost unless configured behind an authenticated reverse proxy.

---

## 📁 Resetting Database & Clearing Stored Data

To completely reset the database and clear all local jobs:
1. Stop the backend server (`Ctrl + C`).
2. Delete the SQLite database:
   ```powershell
   Remove-Item storage\localvoice.db -Force -ErrorAction SilentlyContinue
   ```
3. Alternatively, click **Clear History** inside the application dashboard.
