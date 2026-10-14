import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AudioUploader } from '../components/AudioUploader';

describe('AudioUploader Component', () => {
  it('renders upload area with format information', () => {
    const mockSubmit = vi.fn();
    render(<AudioUploader onStartTranscription={mockSubmit} isSubmitting={false} maxUploadMb={25} />);

    expect(screen.getByText(/Click to upload or drag & drop audio/i)).toBeInTheDocument();
    expect(screen.getByText(/Max 25 MB/i)).toBeInTheDocument();
  });

  it('shows error for unsupported file extensions', () => {
    const mockSubmit = vi.fn();
    render(<AudioUploader onStartTranscription={mockSubmit} isSubmitting={false} maxUploadMb={25} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const fakeFile = new File(['content'], 'document.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [fakeFile] } });

    expect(screen.getByText(/Unsupported format/i)).toBeInTheDocument();
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('accepts supported WAV file and allows submit', () => {
    const mockSubmit = vi.fn().mockResolvedValue(undefined);
    render(<AudioUploader onStartTranscription={mockSubmit} isSubmitting={false} maxUploadMb={25} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const audioFile = new File(['dummy audio content'], 'sample.wav', { type: 'audio/wav' });
    fireEvent.change(input, { target: { files: [audioFile] } });

    expect(screen.getByText('sample.wav')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: /Transcribe Audio/i });
    expect(button).toBeEnabled();

    fireEvent.click(button);
    expect(mockSubmit).toHaveBeenCalledWith(audioFile, 'auto', 'base');
  });
});
