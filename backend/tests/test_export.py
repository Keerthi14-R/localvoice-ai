from app.services.exportservice import (
    format_timestamp_srt,
    format_timestamp_vtt,
    export_to_txt,
    export_to_srt,
    export_to_vtt,
)

def test_timestamp_formatting():
    # 0 seconds
    assert format_timestamp_srt(0.0) == "00:00:00,000"
    assert format_timestamp_vtt(0.0) == "00:00:00.000"

    # 65.432 seconds = 1 minute 5 seconds 432 ms
    assert format_timestamp_srt(65.432) == "00:01:05,432"
    assert format_timestamp_vtt(65.432) == "00:01:05.432"

    # 3661.05 seconds = 1 hr 1 min 1 sec 50 ms
    assert format_timestamp_srt(3661.05) == "01:01:01,050"
    assert format_timestamp_vtt(3661.05) == "01:01:01.050"

def test_export_txt():
    orig = "Hello world"
    edited = "Hello modern world"
    assert export_to_txt(orig).strip() == "Hello world"
    assert export_to_txt(orig, edited).strip() == "Hello modern world"

def test_export_srt_and_vtt_with_unicode():
    segments = [
        {"start": 0.0, "end": 2.5, "text": "नमस्ते दुनिया (Hello world)"},
        {"start": 2.5, "end": 5.0, "text": "音声認識テスト (Speech test)"}
    ]

    srt_out = export_to_srt(segments)
    assert "1\n00:00:00,000 --> 00:00:02,500\nनमस्ते दुनिया (Hello world)" in srt_out
    assert "2\n00:00:02,500 --> 00:00:05,000\n音声認識テスト (Speech test)" in srt_out

    vtt_out = export_to_vtt(segments)
    assert vtt_out.startswith("WEBVTT\n")
    assert "00:00:00.000 --> 00:00:02.500" in vtt_out
    assert "नमस्ते दुनिया" in vtt_out
