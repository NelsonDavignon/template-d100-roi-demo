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
    
    const model = this.ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    this.chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: "You are Sarah. Keep answers to 1 sentence." }],
        },
        {
          role: "model",
          parts: [{ text: "Hi! I'm Sarah." }],
        },
      ],
    });
  }

  async start(onAudioData: (analyser: AnalyserNode) => void) {
    // 1. Setup Audio (Visualizer)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.source = this.audioContext.createMediaStreamSource(stream);
      this.source.connect(this.analyser);
      onAudioData(this.analyser);
    } catch (e) {
      console.error("Mic Error:", e);
    }

    // 2. Setup Ears
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true; 
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US'; 

    this.recognition.onstart = () => {
      console.log("DEBUG: Sarah is listening...");
    };

    this.recognition.onresult = async (event: any) => {
      const last = event.results.length - 1;
      const text = event.results[last][0].transcript;
      
      // --- DEBUG POPUP 1: DID SHE HEAR YOU? ---
      // If you see this, the Ears work!
      alert("I HEARD: " + text); 

      try {
        const result = await this.chat.sendMessage(text);
        const response = result.response.text();
        
        // --- DEBUG POPUP 2: DID SHE THINK? ---
        // If you see this, the Brain works!
        console.log("Sarah replying:", response);
        this.speak(response);
      } catch (error) {
        // --- DEBUG POPUP 3: BRAIN DEAD? ---
        alert("GEMINI ERROR: " + error);
      }
    };

    // Force Restart Logic
    this.recognition.onend = () => {
        setTimeout(() => { try { this.recognition.start(); } catch (e) {} }, 100);
    };

    this.recognition.start();
    this.speak("Hi! This is Sarah. Please speak clearly.");
    return true; 
  }
  
  speak(text: string) {
    this.synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    this.synth.speak(utterance);
  }

  async stop() {
    if (this.recognition) this.recognition.stop();
    if (this.synth) this.synth.cancel();
    if (this.audioContext) this.audioContext.close();
  }
}
