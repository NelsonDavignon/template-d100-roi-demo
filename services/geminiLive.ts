// SECURE MODE (RESTORED): The version that worked + Safe Voice Fixes.

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
    
    // SAFE VOICE LOADER: Listens for when voices are actually ready
    if (typeof window !== 'undefined') {
        const loadVoices = () => {
            this.voices = this.synth.getVoices();
            console.log("Voices loaded:", this.voices.length);
        };
        this.synth.onvoiceschanged = loadVoices;
        loadVoices(); // Try immediately too
    }
  }

  // --- BRAIN FINDER ---
  async findWorkingModel() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        if (!response.ok) throw new Error("Key Rejected");
        const data = await response.json();
        const validModel = data.models?.find((m: any) => 
            m.name.includes("gemini") && 
            m.supportedGenerationMethods.includes("generateContent")
        );
        if (validModel) {
            this.modelUrl = `https://generativelanguage.googleapis.com/v1beta/${validModel.name}:generateContent?key=${API_KEY}`;
            return true;
        }
    } catch (e) {
        console.error("Connection failed", e);
    }
    return false;
  }

  async start(onAudioData: (analyser: AnalyserNode) => void) {
    // Connect to Brain
    await this.findWorkingModel();

    // Setup Mic
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      onAudioData(analyser);
    } catch (e) {
      console.error("Mic Error", e);
    }

    // Setup Ears
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

      // --- THE LOOP FIX ---
      // Ignore empty silence or super short noises
      if (!text || text.trim().length < 2) return; 

      try {
        const responseText = await this.askGoogleDirectly(text);
        if (responseText) this.speak(responseText);
      } catch (error) {
        console.error("API Error", error);
      }
    };

    // Keep her alive
    this.recognition.onend = () => {
        setTimeout(() => { try { this.recognition.start(); } catch (e) {} }, 100);
    };

    this.recognition.start();
    this.speak("System Online. I am listening.");
    return true; 
  }

  async askGoogleDirectly(userText: string) {
    if (!this.modelUrl) return "I am currently offline.";

    // THE PERSONA: Short, Human, Helpful.
    const systemPrompt = "You are Sarah, a home renovation expert. Be warm and brief (1 sentence max).";
    
    const response = await fetch(this.modelUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ text: systemPrompt + " User says: " + userText }] 
        }]
      })
    });

    const data = await response.json();
    if (data.candidates && data.candidates[0]) {
        return data.candidates[0].content.parts[0].text;
    }
    return "";
  }
  
  speak(text: string) {
    this.synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    // SAFE VOICE SELECTOR: Doesn't crash if list is empty
    if (this.voices.length > 0) {
        const bestVoice = 
            this.voices.find(v => v.name.includes("Natural") && v.name.includes("English")) || 
            this.voices.find(v => v.name.includes("Google US English")) || 
            this.voices.find(v => v.name.includes("Female"));
            
        if (bestVoice) utterance.voice = bestVoice;
    }
    
    // Slight slowdown for realism
    utterance.rate = 0.95;
    this.synth.speak(utterance);
  }

  async stop() {
    if (this.recognition) this.recognition.stop();
    if (this.synth) this.synth.cancel();
  }
}
