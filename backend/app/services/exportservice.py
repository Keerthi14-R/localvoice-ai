import json
from typing import List, Dict, Any, Optional

def format_timestamp_srt(seconds: float) -> str:
    """Format seconds into SRT timestamp HH:MM:SS,mmm"""
    if seconds < 0:
        seconds = 0.0
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int(round((seconds - int(seconds)) * 1000))
    if millis >= 1000:
        secs += 1
        millis -= 1000
    return f"{hrs:02d}:{mins:02d}:{secs:02d},{millis:03d}"

def format_timestamp_vtt(seconds: float) -> str:
    """Format seconds into WebVTT timestamp HH:MM:SS.mmm"""
    if seconds < 0:
        seconds = 0.0
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int(round((seconds - int(seconds)) * 1000))
    if millis >= 1000:
        secs += 1
        millis -= 1000
    return f"{hrs:02d}:{mins:02d}:{secs:02d}.{millis:03d}"

def export_to_txt(text: str, edited_text: Optional[str] = None) -> str:
    """Export transcript as clean UTF-8 text, prioritizing edited text if available."""
    content = edited_text if (edited_text is not None and edited_text.strip()) else text
    return (content or "").strip() + "\n"

def export_to_srt(segments: List[Dict[str, Any]], fallback_text: str = "") -> str:
    """Generate compliant SubRip (.srt) subtitle string preserving UTF-8 / Unicode."""
    if not segments:
        if fallback_text.strip():
            return f"1\n00:00:00,000 --> 00:00:05,000\n{fallback_text.strip()}\n"
        return ""

    lines = []
    for idx, seg in enumerate(segments, start=1):
        start_ts = format_timestamp_srt(float(seg.get("start", 0.0)))
        end_ts = format_timestamp_srt(float(seg.get("end", 0.0)))
        text = str(seg.get("text", "")).strip()
        lines.append(f"{idx}\n{start_ts} --> {end_ts}\n{text}\n")
    
    return "\n".join(lines)

def export_to_vtt(segments: List[Dict[str, Any]], fallback_text: str = "") -> str:
    """Generate compliant WebVTT (.vtt) subtitle string preserving UTF-8 / Unicode."""
    out = ["WEBVTT\n"]
    if not segments:
        if fallback_text.strip():
            out.append(f"1\n00:00:00.000 --> 00:00:05.000\n{fallback_text.strip()}\n")
        return "\n".join(out)

    for idx, seg in enumerate(segments, start=1):
        start_ts = format_timestamp_vtt(float(seg.get("start", 0.0)))
        end_ts = format_timestamp_vtt(float(seg.get("end", 0.0)))
        text = str(seg.get("text", "")).strip()
        out.append(f"{idx}\n{start_ts} --> {end_ts}\n{text}\n")

    return "\n".join(out)
