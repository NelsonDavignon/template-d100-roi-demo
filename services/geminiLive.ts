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
  private history: { role: string; parts: { text: string }[] }[] = [];
  private isListening: boolean = false; 

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
    this.isListening = true;

    // 1. LIGHT IPHONE WAKE-UP
    const utterance = new SpeechSynthesisUtterance(" ");
    this.synth.speak(utterance);

    await this.findWorkingModel();

    // 2. RESET MEMORY
    this.history = [
        { role: "user", parts: [{ text: activeConfig.systemPrompt }] },
        { role: "model", parts: [{ text: activeConfig.firstMessage }] }
    ];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      onAudioData(analyser);
    } catch (e) { console.error("Mic Error", e); }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    this.recognition = new SpeechRecognition();
    
    // HYBRID MODE: Continuous on Desktop, Single-Shot on Mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    this.recognition.continuous = !isMobile; 
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = async (event: any) => {
      const last = event.results.length - 1;
      const text = event.results[last][0].transcript;
      if (!text || text.trim().length < 1) return; 

      console.log("Heard:", text);
      
      // Stop listening on mobile while processing to avoid bugs
      if (isMobile) this.recognition.stop(); 

      try {
        const responseText = await this.askGoogleWithHistory(text);
        if (responseText) this.speak(responseText);
      } catch (error) {}
    };

    // RESTART LOOP
    this.recognition.onend = () => {
        if (this.isListening && !this.synth.speaking) {
            try { this.recognition.start(); } catch (e) {} 
        }
    };

    try { this.recognition.start(); } catch (e) {}

    setTimeout(() => {
        this.speak(activeConfig.firstMessage);
    }, 100);
    
    return true; 
  }

  async askGoogleWithHistory(userText: string) {
    if (!this.modelUrl) return "Connection lost.";
    this.history.push({ role: "user", parts: [{ text: userText }] });

    const response = await fetch(this.modelUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: this.history })
    });

    const data = await response.json();
    if (data.candidates && data.candidates[0]) {
        const answer = data.candidates[0].content.parts[0].text;
        this.history.push({ role: "model", parts: [{ text: answer }] });
        return answer;
    }
    return "";
  }
  
  speak(text: string) {
    this.synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    if (this.voices.length > 0) {
        const targetGender = (activeConfig as any).voiceGender || 'female';
        let bestVoice;

        if (targetGender === 'male') {
            bestVoice = 
                this.voices.find(v => v.name.includes("Male") && v.name.includes("English")) ||
                this.voices.find(v => v.name.includes("Daniel")) || 
                this.voices.find(v => v.name.includes("David"));   
        } else {
            bestVoice = 
                this.voices.find(v => v.name.includes("Samantha")) || 
                this.voices.find(v => v.name.includes("Google US English")) || 
                this.voices.find(v => v.name.includes("Natural") && !v.name.includes("Male"));
        }
        if (bestVoice) utterance.voice = bestVoice;
    }
    
    utterance.rate = 1.0; 
    
    utterance.onend = () => {
        if (this.isListening) {
            try { this.recognition.start(); } catch (e) {}
        }
    };

    this.synth.speak(utterance);
  }

  async stop() {
    this.isListening = false;
    if (this.recognition) this.recognition.stop();
    if (this.synth) this.synth.cancel();
  }
}
