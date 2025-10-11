
const OpenAI = require('openai');

class AIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.initialized = !!process.env.OPENAI_API_KEY;
  }

  async generateResponse(message, context = {}) {
    // If OpenAI is not configured, use fallback
    if (!this.initialized) {
      return this.generateFallbackResponse(message);
    }

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an AI developer assistant for a Georgian rental platform. Respond in Georgian when appropriate.'
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.error('OpenAI Error:', error);
      return this.generateFallbackResponse(message);
    }
  }

  generateFallbackResponse(message) {
    const lowerMessage = message.toLowerCase();

    // Math calculations
    if (lowerMessage.includes('+') || lowerMessage.includes('-') || 
        lowerMessage.includes('*') || lowerMessage.includes('/') || 
        lowerMessage.includes('რამდენია')) {
      const mathResult = this.calculateMath(message);
      if (mathResult) return mathResult;
    }

    // Greetings
    if (lowerMessage.includes('გამარჯობა') || lowerMessage.includes('hello')) {
      return '🤖 გამარჯობა! მე ვარ AI დეველოპერი. როგორ შემიძლია დაგეხმარო?';
    }

    // Code related
    if (lowerMessage.includes('კოდი') || lowerMessage.includes('code')) {
      return '💻 კოდთან დაკავშირებით რას გჭირდებათ? შემიძლია დაგეხმარო React, TypeScript, ან Firebase-ის კომპონენტებში.';
    }

    // Default response
    return `🤖 მადლობა შეკითხვისთვის: "${message}". AI სისტემა მუშაობს შეზღუდული რეჟიმში. შემიძლია დაგეხმარო ძირითად საკითხებში.`;
  }

  calculateMath(expression) {
    try {
      // Extract math expression
      let cleaned = expression
        .replace(/რამდენია/gi, '')
        .replace(/\s+/g, '')
        .trim();

      const mathMatch = cleaned.match(/(\d+(?:\.\d+)?\s*[\+\-\*\/]\s*\d+(?:\.\d+)?)/);
      if (mathMatch) {
        const expr = mathMatch[1];
        if (/^[\d\+\-\*\/\(\)\.]+$/.test(expr)) {
          const result = eval(expr);
          return `**${expr} = ${result}**\n\nეს არის მათემატიკური გამოთვლა 🧮`;
        }
      }
    } catch (error) {
      console.error('Math calculation error:', error);
    }
    return null;
  }
}

module.exports = new AIService();
