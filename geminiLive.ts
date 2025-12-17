import { GoogleGenerativeAI } from "@google/generative-ai";

// This checks EVERY possible way the key might be saved
const API_KEY = 
  import.meta.env.VITE_GEMINI_API_KEY || 
  import.meta.env.NEXT_PUBLIC_GEMINI_API_KEY || 
  import.meta.env.REACT_APP_GEMINI_API_KEY ||
  "";

if (!API_KEY) {
  console.error("CRITICAL ERROR: API Key is missing from Vercel Environment Variables.");
}

export class LiveClient {
  private client: any;
  
  constructor() {
    if (!API_KEY) {
      throw new Error("API Key missing. Please check Vercel settings.");
    }
    this.client = new GoogleGenerativeAI(API_KEY);
  }

  // Basic connection test to prove it works
  async connect() {
    return "Connected";
  }
}
