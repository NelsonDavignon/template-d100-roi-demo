// UNIVERSAL MODE: Using the stable 'v1' endpoint and 'gemini-pro' model.

// PASTE YOUR NEW TIER 1 KEY HERE
const API_KEY = "AIzaSyBDZDS3qHCuJ_7PF8Kr9ro1EY0ZAuayekg";

export class GeminiLiveService {
  private synth: SpeechSynthesis;
  private recognition: any;
  
  constructor() {
    this.synth = window.speechSynthesis;
    if (API_KEY.includes("PASTE_YOUR")) {
       alert("CRITICAL: You forgot to paste the API Key!");
    }
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

      // 3. SEND TO GOOGLE MANUALLY (Universal Endpoint)
      try {
        const responseText = await this.askGoogleDirectly(text);
        this.speak(responseText);
      } catch (error: any) {
        console.error("API Error:", error);
        alert("FINAL ERROR: " + error.message);
      }
    };

    // Auto-restart to keep listening
    this.recognition.onend = () => {
        setTimeout(() => { try { this.recognition.start(); } catch (e) {} }, 100);
    };

    this.recognition.start();
    this.speak("System Online. I am listening.");
    return true; 
  }

  // --- THE STABLE CONNECTION ---
  async askGoogleDirectly(userText: string) {
    // CHANGE: Using 'v1' instead of 'v1beta' and 'gemini-pro' instead of 'flash'
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${API_KEY}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ text: "You are Sarah, a home renovation expert. Be helpful and brief (1 sentence). User says: " + userText }] 
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "Unknown API Error");
    }

    const data = await response.json();
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        return data.candidates[0].content.parts[0].text;
    } else {
        return "I heard you, but I don't have an answer.";
    }
  }
  
  speak(text: string) {
    this.synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = this.synth.getVoices();
    const bestVoice = voices.find(v => v.name.includes("Google US English")) || voices.find(v => v.name.includes("Female"));
    if (bestVoice) utterance.voice = bestVoice;
    this.synth.speak(utterance);
  }

  async stop() {
    if (this.recognition) this.recognition.stop();
    if (this.synth) this.synth.cancel();
  }
}
