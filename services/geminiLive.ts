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
  
  // MEMORY STORAGE
  private history: { role: string; parts: { text: string }[] }[] = [];

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

    // RESET MEMORY ON START
    this.history = [
        {
            role: "user",
            parts: [{ text: activeConfig.systemPrompt }] // The "God Rule" is always first
        },
        {
            role: "model",
            parts: [{ text: activeConfig.firstMessage }] // She knows she just said this
        }
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
    this.speak(activeConfig.firstMessage); 
    return true; 
  }

  // NEW FUNCTION: Sends the whole history, not just the last sentence
  async askGoogleWithHistory(userText: string) {
    if (!this.modelUrl) return "I'm having trouble connecting.";

    // 1. Add User's new message to history
    this.history.push({ role: "user", parts: [{ text: userText }] });

    // 2. Send the WHOLE history to Google
    const response = await fetch(this.modelUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: this.history
      })
    });

    const data = await response.json();
    if (data.candidates && data.candidates[0]) {
        const answer = data.candidates[0].content.parts[0].text;
        
        // 3. Add AI's answer to history (so she remembers she said it)
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
                this.voices.find(v => v.name.includes("David")) || 
                this.voices.find(v => v.name.includes("Mark"));
        } else {
            bestVoice = 
                this.voices.find(v => v.name.includes("Natural") && v.name.includes("English") && !v.name.includes("Male")) || 
                this.voices.find(v => v.name.includes("Google US English")) || 
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
