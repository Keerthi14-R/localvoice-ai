import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AudioRecorder } from '../components/AudioRecorder';

describe('AudioRecorder Component', () => {
  it('renders record controls and prompt', () => {
    const mockSubmit = vi.fn();
    render(<AudioRecorder onStartTranscription={mockSubmit} isSubmitting={false} />);

    expect(screen.getByText(/Record from Microphone/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Transcribe Recording/i })).toBeDisabled();
  });

  it('displays error if microphone access is not available', async () => {
    // Navigator mediaDevices undefined
    Object.defineProperty(navigator, 'mediaDevices', {
      value: undefined,
      configurable: true,
    });

    const mockSubmit = vi.fn();
    render(<AudioRecorder onStartTranscription={mockSubmit} isSubmitting={false} />);

    const micButton = screen.getByRole('button', { name: '' });
    fireEvent.click(micButton);

    expect(await screen.findByText(/Audio recording is not supported in this browser/i)).toBeInTheDocument();
  });
});
