import { useCallback, useEffect, useRef, useState } from 'react';

interface UseAudioRecorderResult {
  isRecording: boolean;
  recordingBlob: Blob | null;
  recordingUrl: string | null;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  resetRecording: () => void;
}

/**
 * Lightweight browser microphone recorder based on MediaRecorder.
 * Keeps everything client-side – no uploads – and returns a Blob + object URL
 * that can be passed to AI analysis or played back locally.
 */
export function useAudioRecorder(): UseAudioRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanupStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const resetRecording = useCallback(() => {
    setRecordingBlob(null);
    if (recordingUrl) {
      URL.revokeObjectURL(recordingUrl);
      setRecordingUrl(null);
    }
  }, [recordingUrl]);

  const startRecording = useCallback(async () => {
    if (isRecording) return;

    resetRecording();
    setError(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Microphone is not available in this browser.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setRecordingBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordingUrl(url);
        setIsRecording(false);
        cleanupStream();
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (e) {
      console.error('Failed to start recording', e);
      setError('Could not access microphone. Please check browser permissions.');
      cleanupStream();
    }
  }, [isRecording, resetRecording]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  }, [isRecording]);

  // Cleanup URL + stream on unmount
  useEffect(() => {
    return () => {
      cleanupStream();
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    isRecording,
    recordingBlob,
    recordingUrl,
    error,
    startRecording,
    stopRecording,
    resetRecording,
  };
}

