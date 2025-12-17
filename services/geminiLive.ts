import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = 
  import.meta.env.VITE_GEMINI_API_KEY || 
  import.meta.env.NEXT_PUBLIC_GEMINI_API_KEY || 
  import.meta.env.REACT_APP_GEMINI_API_KEY ||
  "";

export class GeminiLiveService {
  private ai: GoogleGenerativeAI;
  private chat: any;
  private synth: SpeechSynthesis;
  private recognition: any;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  
  constructor() {
    if (!API_KEY) throw new Error("API Key missing.");
    this.ai = new GoogleGenerativeAI(API_KEY);
    this.synth = window.speechSynthesis;
    
    // Setup the Brain (Gemini)
    const model = this.ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    this.chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: "You are Sarah, a warm, professional home renovation coordinator. Keep answers extremely short (1 sentence). Be friendly and enthusiastic." }],
        },
        {
          role: "model",
          parts: [{ text: "Hi! I'm Sarah. I'm excited to hear about your project!" }],
        },
      ],
    });
  }

  async start(onAudioData: (analyser: AnalyserNode) => void) {
    // 1. Setup Audio Visualizer (Connects to YOUR Mic)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.source = this.audioContext.createMediaStreamSource(stream);
      this.source.connect(this.analyser);
      onAudioData(this.analyser); // Connects to the circle UI
    } catch (e) {
      console.error("Mic Access Denied:", e);
    }

    // 2. Setup Speech Recognition (The Ears)
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Please use Google Chrome for this demo.");
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true; // KEEP LISTENING
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = async (event: any) => {
      const last = event.results.length - 1;
      const text = event.results[last][0].transcript;
      console.log("Heard:", text);

      // Send to Gemini
      try {
        const result = await this.chat.sendMessage(text);
        const response = result.response.text();
        this.speak(response);
      } catch (error) {
        console.error("Gemini Brain Error:", error);
      }
    };

    // Auto-restart if it disconnects
    this.recognition.onend = () => {
        try { this.recognition.start(); } catch (e) {}
    };

    this.recognition.start();
    
    // 3. Speak the Greeting
    this.speak("Hi! This is Sarah. How can I help with your project?");
    return true; 
  }
  
  speak(text: string) {
    this.synth.cancel(); // Stop talking if already talking
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0; 
    utterance.pitch = 1.0;

    // --- VOICE HUNTER: Finds the best "Human" voice ---
    const voices = this.synth.getVoices();
    // Prioritize "Google US English" (Very human) or "Samantha" (Mac)
    const bestVoice = voices.find(v => v.name.includes("Google US English")) || 
                      voices.find(v => v.name.includes("Samantha")) ||
                      voices.find(v => v.name.includes("Female"));
    
    if (bestVoice) {
        utterance.voice = bestVoice;
        console.log("Using Voice:", bestVoice.name);
    }
    
    this.synth.speak(utterance);
  }

  async stop() {
    if (this.recognition) this.recognition.stop();
    if (this.synth) this.synth.cancel();
    if (this.audioContext) this.audioContext.close();
    if (this.source) this.source.disconnect();
  }
}
