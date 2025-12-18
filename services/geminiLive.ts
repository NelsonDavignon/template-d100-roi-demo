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
  
  // STATE FLAGS
  private isListening: boolean = false; 
  private isAgentSpeaking: boolean = false;

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

    // 1. MOBILE UNLOCK (Silent)
    // We cancel immediately to just "wake" the audio driver
    const utterance = new SpeechSynthesisUtterance(" ");
    this.synth.speak(utterance);
    this.synth.cancel();

    await this.findWorkingModel();

    // 2. RESET MEMORY
    this.history = [
        { role: "user", parts: [{ text: activeConfig.systemPrompt }] },
        { role: "model", parts: [{ text: activeConfig.firstMessage }] }
    ];

    // 3. SETUP MIC
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      onAudioData(analyser);
    } catch (e) { console.error("Mic Error", e); }

    // 4. SETUP EARS
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    this.recognition = new SpeechRecognition();
    
    // DETECT DEVICE
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    // IMPORTANT: On Mobile, we do NOT use continuous. We restart manually.
    this.recognition.continuous = !isMobile; 
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = async (event: any) => {
      // IF AGENT IS SPEAKING, IGNORE INPUT (Fixes "Gotcha" loop)
      if (this.isAgentSpeaking) return;

      const last = event.results.length - 1;
      const text = event.results[last][0].transcript;
      
      if (!text || text.trim().length < 2) return; // Ignore noises

      console.log("User said:", text);
      
      // Stop mic while thinking
      this.stopMic(); 

      try {
        const responseText = await this.askGoogleWithHistory(text);
        if (responseText) this.speak(responseText);
      } catch (error) {
        // If error, restart mic so user can try again
        this.startMic();
      }
    };

    // KEEP ALIVE LOOP
    this.recognition.onend = () => {
        // Only restart if we are supposed to be listening AND agent is NOT talking
        if (this.isListening && !this.isAgentSpeaking) {
            try { this.recognition.start(); } catch (e) {} 
        }
    };

    // START LISTENING
    this.startMic();

    // SAY HELLO (With a slight delay to ensure audio is ready)
    setTimeout(() => {
        this.speak(activeConfig.firstMessage);
    }, 800);
    
    return true; 
  }

  // --- HELPER: MIC CONTROL ---
  startMic() {
    if (!this.recognition || this.isAgentSpeaking) return;
    try { this.recognition.start(); } catch (e) {}
  }

  stopMic() {
    if (!this.recognition) return;
    try { this.recognition.stop(); } catch (e) {}
  }

  async askGoogleWithHistory(userText: string) {
    if (!this.modelUrl) return "I lost connection.";
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
    // 1. SILENCE THE MIC (Crucial step)
    this.isAgentSpeaking = true;
    this.stopMic();
    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // VOICE SELECTION
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
    
    // 2. WHEN FINISHED SPEAKING
    utterance.onend = () => {
        this.isAgentSpeaking = false;
        
        // 3. WAIT 0.5s BEFORE LISTENING (Prevents Echo/"Gotcha")
        setTimeout(() => {
            if (this.isListening) {
                this.startMic();
            }
        }, 500); 
    };

    this.synth.speak(utterance);
  }

  async stop() {
    this.isListening = false;
    this.isAgentSpeaking = false;
    if (this.recognition) this.recognition.stop();
    if (this.synth) this.synth.cancel();
  }
}
