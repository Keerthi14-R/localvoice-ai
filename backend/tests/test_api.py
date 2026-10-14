import io
import json
from unittest.mock import patch
from app.db.models import Job

def test_create_and_manage_transcription_job(client, db_session):
    # Mock Faster-Whisper to avoid actual download during automated test suite
    mock_result = {
        "language": "en",
        "language_probability": 0.98,
        "duration": 3.5,
        "processing_time": 0.5,
        "real_time_factor": 0.14,
        "segments": [
            {"id": 0, "start": 0.0, "end": 3.5, "text": "This is a local voice test."}
        ],
        "text": "This is a local voice test."
    }

    # Simulate valid RIFF WAV header
    wav_content = b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x44\xac\x00\x00" + b"\x00" * 40
    fake_file = io.BytesIO(wav_content)

    # 1. Post transcription job
    with patch("app.services.transcription.TranscriptionService.transcribe", return_value=mock_result):
        resp = client.post(
            "/api/transcriptions",
            files={"file": ("test_speech.wav", fake_file, "audio/wav")},
            data={"language": "en", "model": "base"}
        )
        assert resp.status_code == 202
        job_data = resp.json()
        job_id = job_data["id"]
        assert job_data["filename"] == "test_speech.wav"
        assert job_data["status"] == "queued"

    # 2. Get job details
    get_resp = client.get(f"/api/transcriptions/{job_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == job_id

    # 3. Simulate completion in DB for testing export and edit
    job = db_session.query(Job).filter(Job.id == job_id).first()
    job.status = "completed"
    job.text = "This is a local voice test."
    job.segments = json.dumps(mock_result["segments"])
    db_session.commit()

    # 4. Result endpoint
    res_resp = client.get(f"/api/transcriptions/{job_id}/result")
    assert res_resp.status_code == 200
    assert res_resp.json()["text"] == "This is a local voice test."

    # 5. Patch job (rename / edit transcript)
    patch_resp = client.patch(
        f"/api/transcriptions/{job_id}",
        json={"display_name": "Updated Title", "edited_text": "This is edited text."}
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["display_name"] == "Updated Title"
    assert patch_resp.json()["edited_text"] == "This is edited text."

    # 6. Export TXT
    export_txt = client.get(f"/api/transcriptions/{job_id}/export?format=txt")
    assert export_txt.status_code == 200
    assert "This is edited text." in export_txt.text

    # 7. Export SRT
    export_srt = client.get(f"/api/transcriptions/{job_id}/export?format=srt")
    assert export_srt.status_code == 200
    assert "00:00:00,000 --> 00:00:03,500" in export_srt.text

    # 8. List jobs
    list_resp = client.get("/api/transcriptions")
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] >= 1

    # 9. Delete job
    del_resp = client.delete(f"/api/transcriptions/{job_id}")
    assert del_resp.status_code == 200

    # 10. Verify 404 after deletion
    assert client.get(f"/api/transcriptions/{job_id}").status_code == 404
