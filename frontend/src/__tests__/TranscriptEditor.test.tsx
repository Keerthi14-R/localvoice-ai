import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TranscriptEditor } from '../components/TranscriptEditor';
import { Job } from '../types';

describe('TranscriptEditor Component', () => {
  const sampleJob: Job = {
    id: 'test-job-uuid-1234',
    filename: 'interview.wav',
    display_name: 'Interview Audio',
    status: 'completed',
    progress: 100,
    model: 'base',
    language_detected: 'en',
    language_probability: 0.99,
    duration: 12.5,
    processing_time: 1.8,
    real_time_factor: 0.144,
    text: 'Hello world, this is a local voice test.',
    edited_text: null,
    has_audio: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    segments: [
      { id: 0, start: 0.0, end: 2.5, text: 'Hello world,' },
      { id: 1, start: 2.5, end: 5.0, text: 'this is a local voice test.' }
    ],
  };

  it('renders transcript segments with timestamps and metrics', () => {
    const mockUpdate = vi.fn();
    render(<TranscriptEditor job={sampleJob} onJobUpdated={mockUpdate} />);

    expect(screen.getByText('Interview Audio')).toBeInTheDocument();
    expect(screen.getByText(/Hello world,/i)).toBeInTheDocument();
    expect(screen.getByText(/this is a local voice test./i)).toBeInTheDocument();
    expect(screen.getByText('TXT')).toBeInTheDocument();
    expect(screen.getByText('SRT')).toBeInTheDocument();
    expect(screen.getByText('VTT')).toBeInTheDocument();
  });

  it('allows switching to full editable text mode', () => {
    const mockUpdate = vi.fn();
    render(<TranscriptEditor job={sampleJob} onJobUpdated={mockUpdate} />);

    const textTab = screen.getByRole('button', { name: /Full Editable Text/i });
    fireEvent.click(textTab);

    const textarea = screen.getByPlaceholderText(/Edit your transcript here.../i);
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue('Hello world, this is a local voice test.');
  });
});
