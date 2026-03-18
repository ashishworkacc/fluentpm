export function startRecognition(onTranscript, onEnd) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return { supported: false };

  let finalTranscript = "";
  let isActive = true; // controlled by the caller via .stop()

  function createAndStart() {
    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = true;       // don't stop on pause
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += t + " ";
        } else {
          interim = t;
        }
      }
      onTranscript((finalTranscript + interim).trim(), false);
    };

    recognition.onend = () => {
      // Auto-restart if user hasn't tapped stop yet
      if (isActive) {
        try { recognition.start(); } catch {}
      } else {
        onEnd(finalTranscript.trim());
      }
    };

    recognition.onerror = (e) => {
      // Ignore no-speech errors — just restart
      if (e.error === "no-speech" || e.error === "aborted") {
        if (isActive) {
          try { recognition.start(); } catch {}
        }
        return;
      }
      // Real error
      isActive = false;
      onEnd(finalTranscript.trim());
    };

    try { recognition.start(); } catch {}
    return recognition;
  }

  let rec = createAndStart();

  return {
    supported: true,
    stop: () => {
      isActive = false;
      try { rec.stop(); } catch {}
    },
  };
}
