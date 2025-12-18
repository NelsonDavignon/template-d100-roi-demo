// RAW MODE: No Libraries. Direct connection.

// PASTE YOUR KEY HERE IF IT IS NOT ALREADY
const API_KEY = "AIzaSyAo8W7oXa-eBC0-9T-zN_RmvvisLDNxSxK";

export class GeminiLiveService {
  private synth: SpeechSynthesis;
  private recognition: any;
  
  constructor() {
    this.synth = window.speechSynthesis;
    // Simple verification log
    console.log("Sarah Raw Mode: Initialized");
  }

  async start(onAudioData: (analyser: AnalyserNode) => void) {
    // 1. Setup Mic
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      onAudioData(analyser);
    } catch (e) {
      console.error("Mic Error", e);
    }

    // 2. Setup Ears
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = async (event: any) => {
      const last = event.results.length - 1;
      const text = event.results[last][0].transcript;
      console.log("Sarah Heard:", text);

      if (!text) return;

      // 3. THE RAW BRAIN (No Library)
      try {
        const responseText = await this.askGoogleDirectly(text);
        this.speak(responseText);
      } catch (error: any) {
        console.error("API Error:", error);
        alert("GOOGLE REJECTED THE KEY: " + error.message);
      }
    };

    // Auto-restart
    this.recognition.onend = () => {
        setTimeout(() => { try { this.recognition.start(); } catch (e) {} }, 100);
    };

    this.recognition.start();
    this.speak("System Online. Waiting for input.");
    return true; 
  }

  // --- DIRECT CONNECTION (Bypasses the library) ---
  async askGoogleDirectly(userText: string) {
    // We try the standard "gemini-pro" endpoint directly
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "You are Sarah. Be helpful and brief (1 sentence). User says: " + userText }] }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "Unknown API Error");
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }
  
  speak(text: string) {
    this.synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = this.synth.getVoices();
    // Try to find a nice female voice
    const bestVoice = voices.find(v => v.name.includes("Google US English")) || voices.find(v => v.name.includes("Female"));
    if (bestVoice) utterance.voice = bestVoice;
    this.synth.speak(utterance);
  }

  async stop() {
    if (this.recognition) this.recognition.stop();
    if (this.synth) this.synth.cancel();
  }
}
