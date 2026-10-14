import sys
import time
import argparse
from pathlib import Path
import psutil
import soundfile as sf
import numpy as np

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.services.transcription import TranscriptionService
from app.core.config import settings

def generate_test_tone_wav(output_path: Path, duration_sec: float = 3.0, sample_rate: int = 16000):
    """Generate a simple sine tone wave file for benchmarking inference."""
    t = np.linspace(0, duration_sec, int(sample_rate * duration_sec), endpoint=False)
    # 440 Hz standard tone
    audio = 0.5 * np.sin(2 * np.pi * 440 * t)
    sf.write(str(output_path), audio.astype(np.float32), sample_rate)

def run_benchmark(audio_path: str = None, model_name: str = "base"):
    process = psutil.Process()
    mem_before = process.memory_info().rss / (1024 * 1024)

    temp_created = False
    if not audio_path or not Path(audio_path).exists():
        temp_audio = Path("storage/benchmark_sample.wav")
        temp_audio.parent.mkdir(parents=True, exist_ok=True)
        print("Generating 3.0s synthetic audio test sample...")
        generate_test_tone_wav(temp_audio, duration_sec=3.0)
        audio_path = str(temp_audio)
        temp_created = True

    print("\n" + "=" * 55)
    print(f" LocalVoice AI Benchmark (Windows CPU INT8)")
    print("=" * 55)
    print(f"Model:           {model_name}")
    print(f"Device:          {settings.WHISPER_DEVICE}")
    print(f"Compute Type:    {settings.WHISPER_COMPUTE_TYPE}")
    print(f"CPU Threads:     {settings.WHISPER_CPU_THREADS}")
    print(f"Memory (Start):  {mem_before:.1f} MB")
    print("Transcribing...")

    t0 = time.time()
    result = TranscriptionService.transcribe(audio_path, model_name=model_name)
    total_time = time.time() - t0

    mem_after = process.memory_info().rss / (1024 * 1024)
    duration = result.get("duration", 0.0)
    rtf = total_time / duration if duration > 0 else 0.0

    print("\n" + "-" * 55)
    print(" Benchmark Results:")
    print("-" * 55)
    print(f"Audio Duration:      {duration:.2f} s")
    print(f"Inference Time:      {result.get('processing_time', 0.0):.2f} s")
    print(f"Total Wall Time:     {total_time:.2f} s")
    print(f"Real-Time Factor:    {rtf:.3f}x  (lower is faster; < 1.0x is faster than real time)")
    print(f"Detected Language:   {result.get('language')} ({result.get('language_probability', 0.0):.2%})")
    print(f"Peak Process Memory: {mem_after:.1f} MB  (delta: +{mem_after - mem_before:.1f} MB)")
    print("=" * 55 + "\n")

    if temp_created and Path(audio_path).exists():
        try:
            Path(audio_path).unlink()
        except OSError:
            pass

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="LocalVoice AI Whisper Benchmark")
    parser.add_argument("--audio", type=str, default=None, help="Path to audio file (optional)")
    parser.add_argument("--model", type=str, default="base", help="Model name (tiny, base, small)")
    args = parser.parse_args()

    run_benchmark(audio_path=args.audio, model_name=args.model)
