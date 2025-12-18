import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

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
    
    // FIX 1: Disable Safety Filters (So she doesn't get blocked)
    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ];

    // FIX 2: Try 'gemini-1.5-flash' again (It is faster/better if it works)
    // If this fails, we will see the error in the ALERT.
    const model = this.ai.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      safetySettings: safetySettings 
    });
    
    this.chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: "You are Sarah. Be helpful and brief. Start by saying: 'Hello! Sarah is ready.'" }],
        },
        {
          role: "model",
          parts: [{ text: "Hello! Sarah is ready." }],
        },
      ],
    });
  }

  async start(onAudioData: (analyser: AnalyserNode) => void) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.source = this.audioContext.createMediaStreamSource(stream);
      this.source.connect(this.analyser);
      onAudioData(this.analyser);
    } catch (e) {
      console.error("Mic Access Denied", e);
    }

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

      try {
        const result = await this.chat.sendMessage(text);
        const response = result.response.text();
        this.speak(response);
      } catch (error: any) {
        console.error("Brain Error:", error);
        
        // FIX 3: TELL US THE REAL REASON
        alert("GOOGLE ERROR: " + error.toString());
        this.speak("I am having a connection error.");
      }
    };

    this.recognition.onend = () => {
        setTimeout(() => { try { this.recognition.start(); } catch (e) {} }, 100);
    };

    this.recognition.start();
    this.speak("Hello! Sarah is ready.");
    return true; 
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
    if (this.audioContext) this.audioContext.close();
  }
}
