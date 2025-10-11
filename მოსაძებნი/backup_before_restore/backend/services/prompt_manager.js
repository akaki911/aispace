/**
 * Specialized Prompt Manager for Bakhmaro AI Assistant
 * ზუსტად მიზანმიმართული პრომპტები სხვადასხვა ტიპის კითხვებისთვის
 */

class PromptManager {
  constructor() {
    this.prompts = {
      // საიტის მოკლე შეჯამება - bullet point ფორმატში
      site_overview: {
        system: `შენ ხარ ბახმაროს პლატფორმის ექსპერტი. მიეცი მოკლე, ზუსტი შეჯამება bullet point ფორმატში. მხოლოდ ძირითადი კატეგორიები და ფუნქციები. არაუმეტეს 200 სიტყვისა.`,
        template: (context) => `აღწერე ბახმაროს პლატფორმა bullet point ფორმატში:
• კატეგორიები (კოტეჯები, სასტუმროები, ტრანსპორტი)  
• ძირითადი ფუნქციები (ჯავშნა, ფასები, ადმინ პანელი)
• ტექნოლოგიები
${context ? `კონტექსტი: ${context.substring(0, 100)}` : ''}`
      },

      // კონკრეტული მოდულის ახსნა
      module_explanation: {
        system: `შენ ხარ senior developer. ანალიზი გაუკეთე კოდს და ახსენი ის ბუნებრივ ქართულ ენაზე. ფოკუსი გაიმიჯნო ფუნქციებზე, ტიპებზე და მუშაობის პრინციპზე.`,
        template: (moduleName, codeContent) => `ახსენი როგორ მუშაობს "${moduleName}":

${codeContent ? `კოდი:\n\`\`\`\n${codeContent.substring(0, 1500)}\n\`\`\`` : ''}

ახსენი:
1. ძირითადი ფუნქციები
2. Input/Output
3. ბიზნეს ლოგიკა
4. დამოკიდებულებები`
      },

      // მარტივი მისალმება
      greeting: {
        system: `შენ ხარ მეგობრული AI ასისტენტი ბახმაროს პლატფორმისთვის. მოკლე, თბილი მისალმება და კითხვა - რით დაეხმარო.`,
        template: (message) => `მისალმება: "${message}"`
      },

      // კოდის ანალიზი და გაუმჯობესება
      code_analysis: {
        system: `შენ ხარ expert code reviewer. ანალიზი გაუკეთე კოდს, მოძებნე შესაძლო გაუმჯობესებები და ახსენი ის ქართულად.`,
        template: (query, codeSnippets) => `კოდის ანალიზი: "${query}"

${codeSnippets ? `კოდი:\n${codeSnippets}` : ''}

გაიმიჯნე:
1. რას აკეთებს კოდი
2. შესაძლო გაუმჯობესებები  
3. პერფორმანსის რჩევები
4. უსაფრთხოების ასპექტები`
      },

      // ტექნიკური დოკუმენტაცია
      technical_docs: {
        system: `შენ ხარ technical writer. შექმენი მოკლე, მკაფიო ახსნა ტექნიკური პროცესისთვის. გამოიყენე ნუმერაცია და სტრუქტურული ფორმატი.`,
        template: (process, details) => `ტექნიკური პროცესი: "${process}"

${details ? `დეტალები:\n${details}` : ''}

ნაბიჯები:
1. [ჩამოთვალე ნაბიჯები]
2. [კონკრეტული ინსტრუქციები]
3. [შედეგი]`
      },

      // გამოთვლები და ფორმულები
      calculation: {
        system: `შენ ხარ მათემატიკური კალკულატორი. მიეცი ზუსტი პასუხი გამოთვლისთვის და ახსენი პროცესი.`,
        template: (expression) => `გამოთვალე: ${expression}`
      },

      // ერრორის დიაგნოსტიკა
      error_diagnosis: {
        system: `შენ ხარ debugging expert. ანალიზი გაუკეთე error-ს და მიეცი კონკრეტული გადაწყვეტის გზები.`,
        template: (errorMessage, context) => `Error ანალიზი:
${errorMessage}

${context ? `კონტექსტი: ${context}` : ''}

მიეცი:
1. შესაძლო მიზეზები
2. გადაწყვეტის ნაბიჯები
3. შემდეგ რა უნდა შევამოწმოთ`
      }
    };
  }

  // მთავარი მეთოდი - პრომპტის მიღება ტიპის მიხედვით
  getPrompt(queryType, additionalData = {}) {
    const promptConfig = this.prompts[queryType];

    if (!promptConfig) {
      console.warn(`⚠️ Unknown prompt type: ${queryType}`);
      return this.prompts.site_overview; // default fallback
    }

    return {
      system: promptConfig.system,
      userMessage: promptConfig.template(
        additionalData.message,
        additionalData.context,
        additionalData.codeContent
      )
    };
  }

  // პრომპტის ოპტიმიზაცია token limit-ის მიხედვით
  optimizeForTokens(promptData, maxTokens = 150) {
    if (!promptData.userMessage) return promptData;

    const estimatedTokens = promptData.userMessage.length / 4; // rough estimation

    if (estimatedTokens > maxTokens) {
      const targetLength = maxTokens * 4;
      promptData.userMessage = promptData.userMessage.substring(0, targetLength) + '...';
      console.log(`🔧 Prompt optimized: ${estimatedTokens} -> ${maxTokens} tokens`);
    }

    return promptData;
  }

  // კლასიფიკაცია query-ის მიხედვით
  classifyAndGetPrompt(message, context = {}) {
    const lowerMessage = message.toLowerCase();

    // Greeting detection
    if (/გამარჯობა|სალამი|hello|hi|გამარჯობათ/i.test(message)) {
      return this.getPrompt('greeting', { message });
    }

    // Error detection
    if (/error|შეცდომა|ერორი|failed|ვერ/i.test(message)) {
      return this.getPrompt('error_diagnosis', { 
        message, 
        context: context.errorContext 
      });
    }

    // Calculation detection
    if (lowerMessage.includes('+') || lowerMessage.includes('-') || 
        lowerMessage.includes('*') || lowerMessage.includes('/') || 
        lowerMessage.includes('რამდენია') || lowerMessage.includes('გამოითვალე')) {
      return this.getPrompt('calculation', { message });
    }

    // Code analysis detection
    if (/რომელი?\s*(კოდი|ფაილი|ფუნქცია)|რა\s*(აქვს|არის|მუშაობს)/i.test(message)) {
      return this.getPrompt('code_analysis', { 
        message, 
        codeSnippets: context.codeSnippets 
      });
    }

    // Module explanation detection
    if (/როგორ\s*(მუშაობს|ფუნქციონირებს|იმუშავებს)/i.test(message)) {
      return this.getPrompt('module_explanation', { 
        message, 
        context: context.moduleContext 
      });
    }

    // Technical documentation
    if (/დოკუმენტაცია|ახსენი|instruction|ინსტრუქცია/i.test(message)) {
      return this.getPrompt('technical_docs', { 
        message, 
        context: context.technicalContext 
      });
    }

    // Site overview detection (bullet points)
    if (/მოკლე\s*(აღწერა|შეჯამება)|საიტის\s*აღწერა|რა\s*არის\s*ეს/i.test(message)) {
      return this.getPrompt('site_overview_bullet', { context: context.siteContext });
    }

    // General how it works detection  
    if (/როგორ\s*მუშაობს\s*(საიტი|სისტემა)|როგორ\s*ფუნქციონირებს/i.test(message)) {
      return this.getPrompt('general_how_it_works', { context: context.siteContext });
    }

    // Default: site overview
    return this.getPrompt('site_overview', { context: context.siteContext });
  }

  // სტატისტიკა - რომელი პრომპტები იყენება ყველაზე ხშირად
  getUsageStats() {
    return {
      availablePrompts: Object.keys(this.prompts),
      totalPrompts: Object.keys(this.prompts).length,
      recommendedForPerformance: ['greeting', 'calculation', 'site_overview'],
      recommendedForAccuracy: ['module_explanation', 'code_analysis', 'technical_docs']
    };
  }
}

module.exports = new PromptManager();