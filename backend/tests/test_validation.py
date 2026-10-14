import pytest
from pathlib import Path
from fastapi import HTTPException
from app.utils.filevalidation import (
    sanitize_filename,
    validate_file_extension,
    SUPPORTED_EXTENSIONS
)

def test_sanitize_filename():
    assert sanitize_filename("test.wav") == "test.wav"
    assert sanitize_filename("../../../etc/passwd.mp3") == "passwd.mp3"
    assert sanitize_filename("C:\\Windows\\system32\\cmd.flac") == "cmd.flac"
    assert sanitize_filename("my recording @!#$.wav") == "my recording .wav"
    assert sanitize_filename("") == "unnamed_audio"

def test_validate_supported_extensions():
    for ext in SUPPORTED_EXTENSIONS:
        assert validate_file_extension(f"sample{ext}") == ext

def test_validate_unsupported_extensions():
    with pytest.raises(HTTPException) as exc_info:
        validate_file_extension("malware.exe")
    assert exc_info.value.status_code == 400
    assert "Unsupported file format" in exc_info.value.detail

    with pytest.raises(HTTPException):
        validate_file_extension("document.pdf")
