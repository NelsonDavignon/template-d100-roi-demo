import { activeConfig } from "../config";

const API_KEY = 
  import.meta.env.VITE_GEMINI_API_KEY || 
  import.meta.env.NEXT_PUBLIC_GEMINI_API_KEY || 
  "";

export class GeminiLiveService {
  private synth: SpeechSynthesis;
  private recognition: any;
  private modelUrl: string = ""; 
  private voices: SpeechSynthesisVoice[] = [];

  constructor() {
    this.synth = window.speechSynthesis;
    if (typeof window !== 'undefined') {
        const loadVoices = () => { this.voices = this.synth.getVoices(); };
        this.synth.onvoiceschanged = loadVoices;
        loadVoices(); 
    }
  }

  async findWorkingModel() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        if (!response.ok) return false;
        const data = await response.json();
        const validModel = data.models?.find((m: any) => 
            m.name.includes("gemini") && 
            m.supportedGenerationMethods.includes("generateContent")
        );
        if (validModel) {
            this.modelUrl = `https://generativelanguage.googleapis.com/v1beta/${validModel.name}:generateContent?key=${API_KEY}`;
            return true;
        }
    } catch (e) { console.error(e); }
    return false;
  }

  async start(onAudioData: (analyser: AnalyserNode) => void) {
    await this.findWorkingModel();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      onAudioData(analyser);
    } catch (e) { console.error(e); }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = async (event: any) => {
      const last = event.results.length - 1;
      const text = event.results[last][0].transcript;
      if (!text || text.trim().length < 2) return; 

      try {
        const responseText = await this.askGoogleDirectly(text);
        if (responseText) this.speak(responseText);
      } catch (error) {}
    };

    this.recognition.onend = () => {
        setTimeout(() => { try { this.recognition.start(); } catch (e) {} }, 100);
    };

    this.recognition.start();
    this.speak(activeConfig.firstMessage); 
    return true; 
  }

  async askGoogleDirectly(userText: string) {
    if (!this.modelUrl) return "I'm having trouble connecting.";
    const systemPrompt = activeConfig.systemPrompt;
    
    const response = await fetch(this.modelUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt + " User says: " + userText }] }]
      })
    });

    const data = await response.json();
    if (data.candidates && data.candidates[0]) {
        return data.candidates[0].content.parts[0].text;
    }
    return "";
  }
  
  // UPDATED: Now supports Gender Selection
  speak(text: string) {
    this.synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    if (this.voices.length > 0) {
        // 1. Get the gender from config (default to female if missing)
        const targetGender = (activeConfig as any).voiceGender || 'female';
        
        let bestVoice;

        if (targetGender === 'male') {
            // TRY TO FIND A MALE VOICE
            bestVoice = 
                this.voices.find(v => v.name.includes("Male") && v.name.includes("English")) ||
                this.voices.find(v => v.name.includes("David")) || // Common Male ID
                this.voices.find(v => v.name.includes("Mark"));    // Common Male ID
        } else {
            // TRY TO FIND A FEMALE VOICE (Natural preferred)
            bestVoice = 
                this.voices.find(v => v.name.includes("Natural") && v.name.includes("English") && !v.name.includes("Male")) || 
                this.voices.find(v => v.name.includes("Google US English")) || 
                this.voices.find(v => v.name.includes("Female"));
        }

        if (bestVoice) utterance.voice = bestVoice;
    }
    
    utterance.rate = 1.0; // Male voices sound better at normal speed
    this.synth.speak(utterance);
  }

  async stop() {
    if (this.recognition) this.recognition.stop();
    if (this.synth) this.synth.cancel();
  }
}
