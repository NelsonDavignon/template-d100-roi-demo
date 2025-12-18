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

  constructor() {
    this.synth = window.speechSynthesis;
    if (typeof window !== 'undefined') {
        // Force load voices for iOS
        const loadVoices = () => { this.voices = this.synth.getVoices(); };
        this.synth.onvoiceschanged = loadVoices;
        loadVoices(); 
    }
  }

  // --- IPHONE FIX: UNLOCK AUDIO ---
  // This plays a silent sound instantly to keep the speakers open
  unlockAudio() {
    if (typeof window === 'undefined') return;
    
    // 1. Wake up the Speech Synthesis
    const utterance = new SpeechSynthesisUtterance(" "); // Silent space
    utterance.volume = 0; // Silent
    this.synth.speak(utterance);
    this.synth.cancel(); // Reset it immediately

    // 2. Wake up the AudioContext (for the visualizer)
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContext) {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0; // Silent
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(0);
        osc.stop(0.1);
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
    // STEP 1: UNLOCK IPHONE AUDIO IMMEDIATELY
    this.unlockAudio();

    await this.findWorkingModel();

    // RESET MEMORY
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
        const responseText = await this.askGoogleWithHistory(text);
        if (responseText) this.speak(responseText);
      } catch (error) {}
    };

    this.recognition.onend = () => {
        setTimeout(() => { try { this.recognition.start(); } catch (e) {} }, 100);
    };

    this.recognition.start();
    
    // DELAY THE GREETING SLIGHTLY (To ensure iOS handles the transition)
    setTimeout(() => {
        this.speak(activeConfig.firstMessage);
    }, 500);
    
    return true; 
  }

  async askGoogleWithHistory(userText: string) {
    if (!this.modelUrl) return "I'm having trouble connecting.";

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
    this.synth.cancel(); // Critical for iOS: Stop any previous sound
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    if (this.voices.length > 0) {
        const targetGender = (activeConfig as any).voiceGender || 'female';
        let bestVoice;

        if (targetGender === 'male') {
            bestVoice = 
                this.voices.find(v => v.name.includes("Male") && v.name.includes("English")) ||
                this.voices.find(v => v.name.includes("David")) || 
                this.voices.find(v => v.name.includes("Mark"));
        } else {
            bestVoice = 
                this.voices.find(v => v.name.includes("Natural") && v.name.includes("English") && !v.name.includes("Male")) || 
                this.voices.find(v => v.name.includes("Google US English")) || 
                this.voices.find(v => v.name.includes("Samantha")) || // Common iOS Voice
                this.voices.find(v => v.name.includes("Female"));
        }
        if (bestVoice) utterance.voice = bestVoice;
    }
    
    utterance.rate = 1.0; 
    this.synth.speak(utterance);
  }

  async stop() {
    if (this.recognition) this.recognition.stop();
    if (this.synth) this.synth.cancel();
  }
}
