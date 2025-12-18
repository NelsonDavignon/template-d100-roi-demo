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
  private isListening: boolean = false; // Flag to control the loop

  constructor() {
    this.synth = window.speechSynthesis;
    // Load voices immediately
    if (typeof window !== 'undefined') {
        const loadVoices = () => { this.voices = this.synth.getVoices(); };
        this.synth.onvoiceschanged = loadVoices;
        loadVoices(); 
    }
  }

  // --- BRAIN CONNECTION ---
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

  // --- START FUNCTION ---
  async start(onAudioData: (analyser: AnalyserNode) => void) {
    this.isListening = true;

    // 1. MOBILE FIX: Play a silent sound to wake up the speakers
    // We only do this lightly so we don't break Desktop
    const utterance = new SpeechSynthesisUtterance(" ");
    this.synth.speak(utterance);

    await this.findWorkingModel();

    // 2. RESET MEMORY
    this.history = [
        { role: "user", parts: [{ text: activeConfig.systemPrompt }] },
        { role: "model", parts: [{ text: activeConfig.firstMessage }] }
    ];

    // 3. SETUP MIC (Visualizer)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      onAudioData(analyser);
    } catch (e) { console.error("Mic access denied", e); }

    // 4. SETUP EARS (Recognition)
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    this.recognition = new SpeechRecognition();
    
    // CRITICAL FIX FOR IPHONE:
    // iPhone breaks if 'continuous' is true. We must use 'false' and manual restart.
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    this.recognition.continuous = !isMobile; // False on iPhone, True on Desktop
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = async (event: any) => {
      const last = event.results.length - 1;
      const text = event.results[last][0].transcript;
      if (!text || text.trim().length < 1) return; 

      console.log("Heard:", text);
      
      // Stop listening while thinking to prevent hearing herself
      if (isMobile) this.recognition.stop(); 

      try {
        const responseText = await this.askGoogleWithHistory(text);
        if (responseText) this.speak(responseText);
      } catch (error) {}
    };

    // THE RESTART LOOP (Keeps it alive)
    this.recognition.onend = () => {
        if (this.isListening && !this.synth.speaking) {
            try { this.recognition.start(); } catch (e) {} 
        }
    };

    try { this.recognition.start(); } catch (e) {}

    // Greet the user
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
    this.synth.cancel(); // Stop any previous speech
    const utterance = new SpeechSynthesisUtterance(text);
    
    // BETTER VOICE SELECTION
    if (this.voices.length > 0) {
        const targetGender = (activeConfig as any).voiceGender || 'female';
        let bestVoice;

        if (targetGender === 'male') {
            bestVoice = 
                this.voices.find(v => v.name.includes("Male") && v.name.includes("English")) ||
                this.voices.find(v => v.name.includes("Daniel")) || // Good iPhone Male
                this.voices.find(v => v.name.includes
