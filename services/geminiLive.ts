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
    
    // Setup Brain
    const model = this.ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    this.chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: "You are Sarah. Reply in 1 short sentence." }] },
        { role: "model", parts: [{ text: "Hi! I'm Sarah." }] },
      ],
    });
  }

  async start(onAudioData: (analyser: AnalyserNode) => void) {
    // 1. Check Browser Support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("ERROR: This browser does not support speech. Please use Google Chrome.");
      return;
    }

    // 2. Setup Visualizer (Mic Input)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.source = this.audioContext.createMediaStreamSource(stream);
      this.source.connect(this.analyser);
      onAudioData(this.analyser);
    } catch (e) {
      alert("Microphone Error: Access Denied. Please allow mic permissions.");
      console.error(e);
      return;
    }

    // 3. Setup Ears (Speech Recognition)
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US'; // Force English

    // --- CRITICAL ERROR CATCHER ---
    this.recognition.onerror = (event: any) => {
      console.error("Speech Recognition Error:", event.error);
      
      // THIS WILL TELL US THE PROBLEM
      if (event.error === 'not-allowed') alert("ERROR: Mic blocked. Check Chrome settings.");
      else if (event.error === 'no-speech') console.log("No speech detected (Normal silence)");
      else if (event.error === 'network') alert("ERROR: Network issue blocked speech.");
      else alert("SPEECH ERROR: " + event.error);
    };

    this.recognition.onstart = () => {
      console.log("Sarah is listening...");
    };

    this.recognition.onresult = async (event: any) => {
      const last = event.results.length - 1;
      const text = event.results[last][0].transcript;
      console.log("HEARD:", text);

      // Simple visual feedback
      // alert("I heard: " + text); // Uncomment if you doubt she hears you

      try {
        const result = await this.chat.sendMessage(text);
        const response = result.response.text();
        this.speak(response);
      } catch (error: any) {
        // THIS WILL SHOW THE REAL REASON
        alert("REAL ERROR: " + error.toString()); 
        console.error(error);
      }
    };

    // Auto-restart logic
    this.recognition.onend = () => {
       setTimeout(() => { try { this.recognition.start(); } catch(e){} }, 100);
    };

    this.recognition.start();
    this.speak("Hi! Sarah is online.");
    return true; 
  }
  
  speak(text: string) {
    this.synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    // Try to find a nice voice
    const voices = this.synth.getVoices();
    const goodVoice = voices.find(v => v.name.includes("Google US English"));
    if (goodVoice) utterance.voice = goodVoice;
    this.synth.speak(utterance);
  }

  async stop() {
    if (this.recognition) this.recognition.stop();
    if (this.synth) this.synth.cancel();
    if (this.audioContext) this.audioContext.close();
  }
}
