
const fileService = require('./fileService');
const { askGroq } = require('./groq_service');

async function explainPricing() {
  try {
    console.log('💰 Starting pricing logic analysis...');
    
    // ფასების ლოგიკის ფაილების წაკითხვა
    const cottagePricing = await fileService.getFileContext('src/utils/pricing.ts');
    const vehiclePricing = await fileService.getFileContext('src/utils/vehiclePricing.ts');
    
    const prompt = `
შენ ხარ senior software engineer. გადაანალიზე ქვემოთ მოცემული TypeScript ფაილების ფასების ლოგიკა და ახსენი ის ბუნებრივ ქართულ ენაზე. 

==== PRICING.TS ====
${cottagePricing.content || cottagePricing}

==== VEHICLE_PRICING.TS ====  
${vehiclePricing.content || vehiclePricing}

ახსენი დეტალურად:
1. როგორ ითვლება ღამეების ღირებულება
2. როგორ ემატება დამატებითი სტუმრების საფასური  
3. როგორ მუშაობს კომუნალური პრივილეგია
4. როგორ ითვლება სეზონური ფასები
5. როგორ მუშაობს ფასდაკლებები
6. რა არის წინასწარი გადახდის პროცენტები

მაგალითი: თუ კოტეჯის ღამეზე ფასი 100 ლარია, 3 ღამით, 5 ადამიანით, მაშინ როგორ ითვლება საბოლოო ფასი?

პასუხი უნდა იყოს ბუნებრივ ქართულ ენაზე, დეტალური და გამართული.
    `;

    const messages = [
      {
        role: 'system',
        content: 'შენ ხარ გამოცდილი software engineer, რომელიც ახსნის კოდის ლოგიკას ქართულ ენაზე ისე, რომ უტექნიკურო ადამიანებმაც მიხვდნენ.'
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    const response = await askGroq(messages);
    const explanation = response.choices[0].message.content.trim();
    
    console.log('💰 Pricing logic analysis completed');
    return explanation;
    
  } catch (error) {
    console.error('💰 Error in pricing explanation:', error);
    throw new Error(`ფასების ფორმულის ანალიზში შეცდომა: ${error.message}`);
  }
}

module.exports = { explainPricing };
