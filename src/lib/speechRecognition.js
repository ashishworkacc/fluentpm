export function startRecognition(onTranscript, onEnd) {
  if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
    return { supported: false };
  }
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.lang = "en-IN";
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map(r => r[0].transcript)
      .join("");
    const isFinal = event.results[event.results.length - 1].isFinal;
    onTranscript(transcript, isFinal);
  };
  recognition.onend = () => onEnd();
  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event.error);
    onEnd();
  };
  recognition.start();
  return { supported: true, stop: () => recognition.stop() };
}
