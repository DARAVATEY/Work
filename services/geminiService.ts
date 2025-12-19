
import { GoogleGenAI, Type } from "@google/genai";

export const verifyIdentityMatch = async (base64Image: string, userName: string) => {
  // Always create a new GoogleGenAI instance right before making an API call 
  // to ensure it uses the most up-to-date API key (e.g. from a user dialog if applicable).
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { text: `Verify if this user image matches the identity of "${userName}". This is a simulated identity check for a professional job platform called "Work" based in Cambodia. Respond with a boolean for match and a short reason.` },
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isMatch: { type: Type.BOOLEAN },
            confidence: { type: Type.NUMBER },
            reason: { type: Type.STRING }
          },
          required: ['isMatch', 'reason']
        }
      }
    });

    // Access the text property directly as per the @google/genai guidelines.
    const jsonStr = response.text || '{}';
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Identity Verification Error:", error);
    return { isMatch: false, reason: "Verification system busy." };
  }
};
