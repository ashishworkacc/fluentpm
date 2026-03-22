import { useEffect, useRef } from "react";

/**
 * Real-time microphone amplitude visualiser using Web Audio API.
 * Shows animated frequency bars while the user is recording.
 * Fails silently — if getUserMedia is unavailable, nothing renders.
 */
export default function MicWaveform({ isRecording, barCount = 20, width = 200, height = 40 }) {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);
  const ctxRef    = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (!isRecording) {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (ctxRef.current?.state !== "closed") ctxRef.current?.close();
      return;
    }

    let analyser, dataArray, audioCtx;

    navigator.mediaDevices
      .getUserMedia({ audio: true, video: false })
      .then(stream => {
        streamRef.current = stream;
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        ctxRef.current = audioCtx;
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        audioCtx.createMediaStreamSource(stream).connect(analyser);

        const draw = () => {
          rafRef.current = requestAnimationFrame(draw);
          if (!canvasRef.current) return;
          analyser.getByteFrequencyData(dataArray);
          const canvas = canvasRef.current;
          const c = canvas.getContext("2d");
          c.clearRect(0, 0, canvas.width, canvas.height);
          const barW = canvas.width / barCount;
          for (let i = 0; i < barCount; i++) {
            const val = dataArray[i] / 255;
            const h   = Math.max(3, val * canvas.height);
            c.fillStyle = `rgba(99, 102, 241, ${0.35 + val * 0.65})`;
            c.beginPath();
            c.roundRect(i * barW + 1, (canvas.height - h) / 2, barW - 2, h, 2);
            c.fill();
          }
        };
        draw();
      })
      .catch(() => {}); // No waveform if mic permission denied — STT still works

    return () => {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (audioCtx?.state !== "closed") audioCtx?.close();
    };
  }, [isRecording]);

  if (!isRecording) return null;
  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ borderRadius: 8, display: "block" }}
    />
  );
}
