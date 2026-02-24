import { GoogleGenAI, Type } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not set. Translation features will be disabled.");
      return null;
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export async function translateText(text: string, targetLang: 'am' | 'en') {
  if (!text) return "";
  
  const ai = getAI();
  if (!ai) return text;
  
  const prompt = targetLang === 'en' 
    ? `Translate the following Amharic text to English. Return ONLY the translated text: "${text}"`
    : `Translate the following English text to Amharic. Return ONLY the translated text: "${text}"`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text?.trim() || text;
  } catch (error) {
    console.error("Translation error:", error);
    return text;
  }
}

export async function translateForm(data: any, sourceLang: 'am' | 'en') {
  const targetLang = sourceLang === 'am' ? 'en' : 'am';
  const fields = ['full_name', 'rank', 'responsibility'];
  
  const results: any = { ...data };
  
  for (const field of fields) {
    const value = data[`${field}_${sourceLang}`];
    if (value) {
      results[`${field}_${targetLang}`] = await translateText(value, targetLang);
    }
  }
  
  return results;
}
