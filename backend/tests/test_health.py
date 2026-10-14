def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["whisper_engine"] == "faster-whisper"
    assert data["device"] == "cpu"
    assert data["compute_type"] == "int8"
    assert "ffmpeg_installed" in data
    assert "cached_models" in data

def test_settings(client):
    response = client.get("/api/settings")
    assert response.status_code == 200
    data = response.json()
    assert data["app_name"] == "LocalVoice AI"
    assert data["max_upload_mb"] > 0
    assert "available_models" in data
    assert "tiny" in data["available_models"]
    assert "base" in data["available_models"]
