'use client';

/**
 * QrScanner — reads a deal-code QR with the laptop or phone camera (PUR-2). Frames are
 * decoded with jsQR (approved 9 Nov 2026) a few times a second; the first code found is
 * passed up and the camera stops. The camera is released when the scanner closes.
 * Typing the code is always available as a fallback.
 */
import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { CameraOff, X } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';

const SCAN_EVERY_MS = 250;

/**
 * @param {{ onCode: (text: string) => void, onClose: () => void }} props
 * @returns {JSX.Element}
 */
export default function QrScanner({ onCode, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let stream = null;
    let timer = null;
    let stopped = false;

    const scan = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (stopped || !video || !canvas || video.readyState < 2) return;
      const width = video.videoWidth;
      const height = video.videoHeight;
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(video, 0, 0, width, height);
      const result = jsQR(context.getImageData(0, 0, width, height).data, width, height, {
        inversionAttempts: 'dontInvert',
      });
      if (result?.data) {
        stopped = true;
        onCode(result.data);
      }
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser cannot use the camera. Type the code instead.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (stopped) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        timer = setInterval(scan, SCAN_EVERY_MS);
      } catch {
        setError('Camera access was blocked. Allow the camera in your browser, or type the code.');
      }
    };
    start();

    return () => {
      stopped = true;
      clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [onCode]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-card bg-ink">
        {error ? (
          <div className="flex aspect-video flex-col items-center justify-center gap-2 p-6 text-center text-white">
            <CameraOff className="size-8" strokeWidth={2} aria-hidden="true" />
          </div>
        ) : (
          <>
            <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
            {/* Aiming frame */}
            <div
              className="pointer-events-none absolute inset-0 m-auto size-48 rounded-card border-4 border-white/80"
              aria-hidden="true"
            />
          </>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>
      {error ? (
        <Alert tone="warning">{error}</Alert>
      ) : (
        <p className="text-sm text-muted">Hold the buyer&apos;s deal-code QR inside the frame.</p>
      )}
      <Button variant="secondary" onClick={onClose} className="self-start">
        <X className="size-4" strokeWidth={2} aria-hidden="true" />
        Close camera
      </Button>
    </div>
  );
}
