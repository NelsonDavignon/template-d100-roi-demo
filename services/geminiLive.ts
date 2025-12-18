import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

// PASTE YOUR NEW "TIER 1" KEY INSIDE THE QUOTES BELOW
const API_KEY = "AIzaSyBDZDS3qHCuJ_7PF8Kr9ro1EY0ZAuayekg"; 

export class GeminiLiveService {
  private ai: GoogleGenerativeAI;
  private chat: any;
  private synth: SpeechSynthesis;
  private recognition: any;
  // It will try "Flash" first (Fastest), then "Pro" (Most Stable)
  private models = ["gemini-1.5-flash", "gemini-pro"];
  private currentModelIndex = 0;

  constructor() {
    if (API_KEY.includes("PASTE_YOUR")) {
       alert("CRITICAL ERROR: You forgot to paste your API Key in the code!");
       throw new Error("Key missing");
    }
    this.ai = new GoogleGenerativeAI(API_KEY);
    this.synth = window.speechSynthesis;
    this.initChat(); 
  }

  // Setup the brain
  private initChat() {
    const modelName = this.models[this.currentModelIndex];
    console.log("Initializing Brain:", modelName);

    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ];

    const model = this.ai.getGenerativeModel({ 
      model: modelName,
      safetySettings: safetySettings
    });

    this.chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: "You are Sarah. Reply in 1 short sentence. Start by saying: 'Hello! Sarah is online.'" }],
        },
        {
          role: "model",
          parts: [{ text: "Hello! Sarah is online." }],
        },
      ],
    });
  }

  async sendMessageWithFallback(text: string): Promise<string> {
    try {
      const result = await this.chat.sendMessage(text);
      return result.response.text();
    } catch (error: any) {
      console.error(`Model ${this.models[this.currentModelIndex]} Failed:`, error);

      // If the model doesn't exist, try the next one automatically
      if (error.toString().includes("404") || error.toString().includes("not found")) {
        this.currentModelIndex++;
        if (this.currentModelIndex < this.models.length) {
          console.log("Switching to backup model...");
          this.initChat(); 
          return this.sendMessageWithFallback(text); 
        }
      }
      throw error;
    }
  }

  async start(onAudioData: (analyser: AnalyserNode) => void) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      onAudioData(analyser);
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
        const response = await this.sendMessageWithFallback(text);
        this.speak(response);
      } catch (error: any) {
        console.error("Final Error:", error);
        alert("System Error: " + error.toString());
      }
    };

    this.recognition.onend = () => {
        setTimeout(() => { try { this.recognition.start(); } catch (e) {} }, 100);
    };

    this.recognition.start();
    this.speak("Hello! Sarah is online.");
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
  }
}
