import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { CLIENT_CONFIG } from '../constants';

// Helper for Audio Processing
export const floatTo16BitPCM = (float32Array: Float32Array): ArrayBuffer => {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return buffer;
};

export const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

export class GeminiLiveService {
  private ai: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private audioContext: AudioContext | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private nextStartTime = 0;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async start(
    onAudioData: (analyser: AnalyserNode) => void,
    onClose: () => void
  ) {
    // 1. Setup Audio Context
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 24000 // Output sample rate
    });

    const outputAnalyser = this.audioContext.createAnalyser();
    outputAnalyser.fftSize = 256;
    outputAnalyser.connect(this.audioContext.destination);

    // 2. Connect to Gemini Live
    this.sessionPromise = this.ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: CLIENT_CONFIG.agent.voiceName } }
        },
        systemInstruction: CLIENT_CONFIG.agent.systemInstruction,
      },
      callbacks: {
        onopen: async () => {
          console.log("Gemini Live Session Opened");
          await this.startMicrophoneStream();
          // Trigger the model to speak first by sending a silent "start" signal
          this.sendText("Hello! Please introduce yourself as per instructions.");
        },
        onmessage: async (message: LiveServerMessage) => {
          // Handle Audio Output
          const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          
          if (base64Audio && this.audioContext) {
            const audioData = base64ToArrayBuffer(base64Audio);
            
            const pcmData = new Int16Array(audioData);
            const floatData = new Float32Array(pcmData.length);
            for (let i = 0; i < pcmData.length; i++) {
                floatData[i] = pcmData[i] / 32768.0;
            }

            const buffer = this.audioContext.createBuffer(1, floatData.length, 24000);
            buffer.getChannelData(0).set(floatData);

            const source = this.audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(outputAnalyser); // Connect to analyser for visuals
            
            // Scheduling
            this.nextStartTime = Math.max(this.audioContext.currentTime, this.nextStartTime);
            source.start(this.nextStartTime);
            this.nextStartTime += buffer.duration;
            
            // Trigger visualizer update
            onAudioData(outputAnalyser);
          }
        },
        onclose: () => {
          console.log("Session Closed");
          onClose();
        },
        onerror: (err) => {
          console.error("Gemini Error:", err);
          onClose();
        }
      }
    });

    await this.sessionPromise;
  }

  private sendText(text: string) {
    this.sessionPromise?.then(session => {
        session.sendRealtimeInput({
            content: {
                role: 'user',
                parts: [{ text: text }]
            }
        });
    });
  }

  private async startMicrophoneStream() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Input context (often 44.1 or 48kHz, need to resample/send)
      const inputContext = new AudioContext({ sampleRate: 16000 });
      this.inputSource = inputContext.createMediaStreamSource(stream);
      this.processor = inputContext.createScriptProcessor(4096, 1, 1);

      this.inputSource.connect(this.processor);
      this.processor.connect(inputContext.destination);

      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32 to Int16 PCM
        const pcmBuffer = floatTo16BitPCM(inputData);
        
        // Encode to Base64
        let binary = '';
        const bytes = new Uint8Array(pcmBuffer);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = window.btoa(binary);

        this.sessionPromise?.then(session => {
          session.sendRealtimeInput({
            media: {
              mimeType: 'audio/pcm;rate=16000',
              data: base64
            }
          });
        });
      };
    } catch (e) {
      console.error("Mic Error:", e);
    }
  }

  disconnect() {
    if (this.processor) {
        this.processor.disconnect();
        this.processor.onaudioprocess = null;
    }
    if (this.inputSource) this.inputSource.disconnect();
    if (this.audioContext) this.audioContext.close();
    // No explicit close method on session object in the snippet, relying on connection drop
  }
}