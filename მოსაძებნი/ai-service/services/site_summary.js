/**
 * Bakhmaro Booking Platform - Static Site Information
 * ხელით მომზადებული ბაზისური ინფორმაცია ზუსტი პასუხებისთვის
 */

const BAKHMARO_PLATFORM_INFO = {
  title: "ბახმაროს ბუკინგ პლატფორმა",
  description: "ბუნებრივი განსვენების ადგილების ონლაინ ჯავშნის სისტემა",

  // ძირითადი კატეგორიები
  categories: {
    cottages: {
      name: "კოტეჯები",
      description: "ძირითადი დასვენების ნაგებობები",
      features: ["სამზარეულო", "საძინებელი", "კომფორტული ავეჯი", "კერძო ტერიტორია"]
    },
    hotels: {
      name: "სასტუმროები", 
      description: "სასტუმრო ტიპის განთავსება",
      features: ["მომსახურება", "კვება", "დასუფთავება", "მიმღები"]
    },
    vehicles: {
      name: "სატრანსპორტო საშუალებები",
      description: "მგზავრობისთვის ტრანსპორტი",
      features: ["ATV", "ბიციკლები", "ჯიპები", "ტურისტული ავტობუსები"]
    },
    horses: {
      name: "ცხენები",
      description: "ცხენოსნობის სერვისი",
      features: ["ცხენით ტური", "ცხენოსნობის ტრენინგები", "ექსკურსიები"]
    },
    snowmobiles: {
      name: "თოვლმობილები",
      description: "ზამთრის ტრანსპორტი",
      features: ["სკი ტრასებზე მგზავრობა", "ზამთრის ტურები", "ექსტრემალური სპორტი"]
    }
  },

  // ტექნიკური სისტემები
  technical_systems: {
    booking: {
      name: "ჯავშნის სისტემა",
      process: [
        "მომხმარებელი ირჩევს კატეგორიას",
        "ასრჩევს თარიღებს და ადამიანების რაოდენობას", 
        "ვალიდაცია ხდება ხელმისაწვდომობისა",
        "ფასის გამოთვლა ტარიფების მიხედვით",
        "გადახდის პროცესი",
        "დადასტურება და ნოტიფიკაცია"
      ]
    },
    pricing: {
      name: "ფასების სისტემა",
      components: [
        "ბაზისური ფასები ყოველ კატეგორიაზე",
        "სეზონური ფასები (ზაფხული/ზამთარი)",
        "დღეების მიხედვით (შაბათ-კვირა/სხვა)",
        "ხანგრძლივობის ფასდაკლებები",
        "სპეციალური ოფერები"
      ]
    },
    user_management: {
      name: "მომხმარებლების მართვა",
      roles: [
        "Customer - ჩვეულებრივი მომხმარებელი",
        "Provider - მომსახურების პროვაიდერი", 
        "Admin - ადმინისტრატორი",
        "Super Admin - სუპერ ადმინისტრატორი"
      ]
    }
  },

  // ადმინისტრაციული სისტემები
  admin_features: {
    dashboard: "მთავარი დაფა სტატისტიკით",
    bookings: "ჯავშნების მართვა და მონიტორინგი",
    users: "მომხმარებლების მართვა და როლების განაწილება",
    providers: "პროვაიდერების მართვა და კომისიები",
    pricing: "ფასების კონფიგურაცია",
    notifications: "შეტყობინებების სისტემა",
    reports: "ანალიტიკა და რეპორტები"
  },

  // ტექნოლოგიები
  technologies: {
    frontend: "React + TypeScript + Tailwind CSS",
    backend: "Node.js + Express + Firebase",
    database: "Firestore (NoSQL)",
    auth: "Firebase Authentication", 
    ai: "Groq API (Llama models)",
    deployment: "Replit Platform"
  },

  // ძირითადი ფუნქციები
  core_features: [
    "რეალ-დროის ხელმისაწვდომობის შემოწმება",
    "ავტომატური ფასების გამოთვლა",
    "მრავალენოვანი მხარდაჭერა (ქართული/ინგლისური)", 
    "მობაილზე ოპტიმიზებული დიზაინი",
    "განახლებადი თემა (მუქი/ღია რეჟიმი)",
    "AI ასისტენტი ტექნიკური მხარდაჭერისთვის",
    "შეტყობინებების სისტემა",
    "გადახდის ინტეგრაცია"
  ]
};

// Enhanced განსაზღვრული შაბლონები RAG ოპტიმიზაციისთვის
const RESPONSE_TEMPLATES = {
  platform_overview: () => {
    return `🏔️ **ბახმაროს ბუკინგ პლატფორმა**

📋 **ძირითადი კატეგორიები:**
• 🏠 კოტეჯები - ძირითადი დასვენების ნაგებობები
• 🏨 სასტუმროები - სასტუმრო ტიპის განთავსება  
• 🚗 სატრანსპორტო საშუალებები - ATV, ბიციკლები, ჯიპები
• 🐎 ცხენები - ცხენოსნობის სერვისი და ტურები
• 🛷 თოვლმობილები - ზამთრის ტრანსპორტი

⚙️ **ტექნიკური სისტემები:**
• ჯავშნის სისტემა - რეალ-დროის ხელმისაწვდომობა
• ფასების სისტემა - სეზონური და ავტომატური გამოთვლა
• მომხმარებლების მართვა - 4 ტიპის როლი
• AI ასისტენტი - ტექნიკური მხარდაჭერა

🔧 **ტექნოლოგიები:**
• Frontend: React + TypeScript + Tailwind CSS
• Backend: Node.js + Express + Firebase
• Database: Firestore (NoSQL)
• AI: Groq API (Llama models)
• Deployment: Replit Platform`;
  },

  // NEW: Multi-stage project structure template
  project_structure_detailed: () => {
    return `🏗️ **პროექტის დეტალური სტრუქტურა:**

📁 **Frontend Structure (src/):**
• components/ - UI კომპონენტები და ვიჯეტები
  - BookingModal.tsx, Calendar.tsx, PricingManager.tsx
  - AIAssistantEnhanced.tsx, ThemeToggle.tsx
• pages/ - მთავარი გვერდების კომპონენტები
  - MainPage.tsx, UserDashboard.tsx, AdminPages
• services/ - ბიზნეს ლოგიკის სერვისები
  - bookingService.ts, userService.ts, priceCodeService.ts
• utils/ - დამხმარე ფუნქციები და ვალიდაცია
• types/ - TypeScript ტიპების განსაზღვრები

📁 **Backend Structure (backend/):**
• services/ - სერვისების ლეიერი
  - ai_controller.js, codeAnalyzer.js, groq_service.js
• routes/ - API endpoints და routing
• controllers/ - ბიზნეს ლოგიკის კონტროლერები
• utils/ - ქართული ენის ვალიდაცია და სხვა დამხმარე ფუნქციები
• middleware/ - ავთენტიფიკაცია და error handling

📁 **Configuration & Assets:**
• public/ - სტატიკური ფაილები
• functions/ - Firebase Cloud Functions
• attached_assets/ - ფაილების მიმაგრება და ტესტები`;
  },

  // NEW: Component mapping template
  component_mapping: () => {
    return `🧩 **კომპონენტების რუკა:**

📋 **ძირითადი UI კომპონენტები:**
• BookingModal.tsx - ჯავშნის მთავარი ფანჯარა
• Calendar.tsx - თარიღების არჩევის კალენდარი
• PricingManager.tsx - ფასების მართვა და კალკულაცია
• AIAssistantEnhanced.tsx - AI ასისტენტის ინტერფეისი

📋 **ადმინისტრაციული კომპონენტები:**
• AdminCottages.tsx - კოტეჯების მართვა
• AdminUsers.tsx - მომხმარებლების მართვა
• MainDashboard.tsx - ადმინისტრაციული დაშბორდი

📋 **სერვისების ლეიერი:**
• bookingService.ts - ჯავშნის ყველა ლოგიკა
• userService.ts - მომხმარებლების მართვა
• priceCodeService.ts - ფასების კალკულაცია
• notificationService.ts - შეტყობინებების სისტემა

📋 **Backend API:**
• ai_controller.js - AI ასისტენტის მთავარი კონტროლერი
• index.js - Express server-ის entry point
• memory_controller.js - AI მეხსიერების მართვა`;
  },

  // NEW: Key files mapping for RAG
  key_files_mapping: () => {
    return `🗂️ **მნიშვნელოვანი ფაილების რუკა:**

🔴 **Critical Core Files:**
• src/App.tsx - მთავარი React აპლიკაცია
• src/MainPage.tsx - ლენდინგ გვერდი
• backend/index.js - Backend server
• backend/ai_controller.js - AI სისტემის ძირითადი ლოგიკა

🟡 **Business Logic Files:**
• src/services/bookingService.ts - ჯავშნის სრული ლოგიკა
• src/utils/pricing.ts - ფასების გამოთვლის ალგორითმები
• backend/services/groq_service.js - AI მოდელის ინტეგრაცია
• src/components/BookingModal.tsx - ჯავშნის UI

🟢 **Supporting Files:**
• src/firebaseConfig.ts - Firebase კონფიგურაცია
• src/components/Calendar.tsx - თარიღების ლოგიკა
• backend/memory_controller.js - AI კონტექსტის მართვა
• src/services/userService.ts - მომხმარებლების API

🔵 **Configuration Files:**
• package.json - Dependencies
• tsconfig.json - TypeScript კონფიგურაცია
• vite.config.mts - Build კონფიგურაცია
• firebase.json - Firebase deployment settings`;
  },

  booking_process: () => {
    return `📝 **ჯავშნის პროცესი:**

1️⃣ **კატეგორიის არჩევა** - კოტეჯი, სასტუმრო, ტრანსპორტი
2️⃣ **თარიღების მითითება** - Check-in/Check-out დროები
3️⃣ **პარამეტრების დაყენება** - ადამიანების რაოდენობა, სპეციალური მოთხოვნები
4️⃣ **ხელმისაწვდომობის შემოწმება** - რეალ-დროის მონაცემებიდან
5️⃣ **ფასის გამოთვლა** - სეზონური ტარიფები + მოსაკრებლები
6️⃣ **გადახდის პროცესი** - უსაფრთხო ონლაინ გადახდა
7️⃣ **დადასტურება** - ავტომატური ნოტიფიკაცია`;
  },

  admin_panel: () => {
    return `👨‍💼 **ადმინისტრაციული პანელი:**

📊 **მთავარი დაფა:**
• სტატისტიკა და ანალიტიკა
• რეალ-დროის ჯავშნების მონიტორინგი
• შემოსავლის ანგარიშები

🏠 **განთავსების მართვა:**
• კოტეჯების, სასტუმროების დამატება/რედაქტირება
• ფოტოების და ფასების განახლება
• ხელმისაწვდომობის კალენდარი

👥 **მომხმარებლების მართვა:**
• Customer, Provider, Admin როლები
• აქტივობის მონიტორინგი
• კომისიების განაწილება

📧 **შეტყობინებების სისტემა:**
• რეალ-დროის ნოტიფიკაციები
• ადმინ-პროვაიდერ კომუნიკაცია
• ავტომატური შეტყობინებები`;
  },

  pricing_system: () => {
    return `💰 **ფასების სისტემა:**

📈 **ფასების ტიპები:**
• ბაზისური ფასები - თითოეული კატეგორიისთვის
• სეზონური ფასები - ზაფხული (მაისი-სექტემბერი) / ზამთარი
• კვირის დღეების ფასები - შაბათ-კვირა / სამუშაო დღეები
• ხანგრძლივობის ფასდაკლება - 3+ დღისთვის

⚙️ **ავტომატური გამოთვლა:**
• დღეების რაოდენობა × ბაზისური ფასი
• სეზონური კოეფიციენტი (1.2-1.5x)
• ადამიანების რაოდენობის მიხედვით
• მოსაკრებლები და გადასახადები

🎯 **სპეციალური ოფერები:**
• ადრეული ჯავშნის ფასდაკლება
• ჯგუფური ჯავშნის ფასდაკლება
• ლოიალური მომხმარებლების ფასდაკლება`;
  }
};

const COMPONENT_SUMMARIES = {
  // Booking related components
  'BookingModal': 'ბრონირების მოდალური ფანჯარა - ნომრების ბრონირებისთვის, ასევე ფასის გამოთვლა და ვალიდაცია',
  'BookingForm': 'ბრონირების ფორმა - მონაცემების შეყვანისთვის, თარიღების შერჩევა და ტერმინების დადასტურება',
  'BookingAuth': 'ბრონირების ავტორიზაცია - მომხმარებლის შესვლა/რეგისტრაცია ბრონირების პროცესში',
  'VehicleBookingForm': 'ტრანსპორტის ბრონირების ფორმა - მანქანების, ატვების ბრონირება',
  'HotelBookingForm': 'სასტუმროს ბრონირების ფორმა - ოთახების ბრონირება სასტუმროებში',

  // Admin components  
  'AdminBookings': 'ადმინისტრატორის ბრონირების მართვა - ყველა ბრონირების ნახვა/რედაქტირება',
  'AdminUsers': 'მომხმარებლების მართვა - როლების შეცვლა, სტატისტიკა',
  'AdminCommission': 'კომისიის მართვა - პროვაიდერების კომისიის გამოთვლა და გადახდა',
};

// Topic to modules mapping for targeted RAG analysis
const topicToModules = {
  booking: [
    'BookingService.ts', 'bookingService.ts', 'BookingForm.tsx', 
    'BookingModal.tsx', 'BookingAuth.tsx', 'UserBookingsSection.tsx',
    'AdminProviderBookings.tsx', 'ProviderBookings.tsx'
  ],
  pricing: [
    'pricing.ts', 'priceCodeService.ts', 'vehiclePricing.ts',
    'PriceBreakdownCard.tsx', 'PricingManager.tsx', 'PriceTag.tsx'
  ],
  admin: [
    'AdminCottages.tsx', 'AdminUsers.tsx', 'AdminHotels.tsx',
    'AdminProviders.tsx', 'MainDashboard.tsx'
  ],
  cottage: [
    'CottageForm.tsx', 'CottagePage.tsx', 'CottagesList.tsx'
  ],
  messaging: [
    'MessagingSystem.tsx', 'EnhancedMessagingSystem.tsx',
    'AdminMessagingDashboard.tsx', 'messagingService.ts'
  ]
};

class SiteSummary {
  // Get modules for specific topic
  static getModulesForTopic(topic) {
    return topicToModules[topic] || [];
  }

  // Get all available topics
  static getAvailableTopics() {
    return Object.keys(topicToModules);
  }

  // Check if query is asking for static information
  isStaticInfoQuery(message) {
    const staticQueries = [
      'საიტის სრული ინფორმაცია',
      'პლატფორმის დეტალები', 
      'განსაზღვრული ინფორმაცია',
      'ჩემი საიტის აღწერა',
      'როგორ მუშაობს ჩემი საიტი',
      'პლატფორმის სტრუქტურა',
      'ბახმაროს სისტემა',
      'მოკლე შეჯამება',
      'bullet point ინფორმაცია'
    ];

    const lowerMessage = message.toLowerCase();
    return staticQueries.some(query => lowerMessage.includes(query.toLowerCase()));
  }
}

// Enhanced ძირითადი ექსპორტი RAG ოპტიმიზაციისთვის
module.exports = {
  BAKHMARO_PLATFORM_INFO,
  RESPONSE_TEMPLATES,

  // Enhanced Helper ფუნქცია კონკრეტული ინფორმაციისთვის
  getStaticResponse: (queryType) => {
    const templates = RESPONSE_TEMPLATES;

    switch (queryType.toLowerCase()) {
      case 'platform_overview':
      case 'site_info':
      case 'full_info':
        return templates.platform_overview();

      case 'project_structure_detailed':
      case 'project_structure':
      case 'structure_detailed':
        return templates.project_structure_detailed();

      case 'component_mapping':
      case 'components_overview':
        return templates.component_mapping();

      case 'key_files_mapping':
      case 'important_files':
        return templates.key_files_mapping();

      case 'booking_process':
      case 'booking_system':
        return templates.booking_process();

      case 'admin_panel':
      case 'admin_features':
        return templates.admin_panel();

      case 'pricing_system':
      case 'pricing_info':
        return templates.pricing_system();

      default:
        return null;
    }
  },

  // NEW: RAG-specific query classification helper
  classifyForRAG: (message) => {
    const lowerMessage = message.toLowerCase();

    const ragPatterns = {
      'needs_multi_stage': [
        'მთელი საიტის შესახებ', 'სრული დეტალური ინფორმაცია', 'ყველაფერი რაც არის',
        'პროექტის სრული ანალიზი', 'მთლიანი სისტემის აღწერა'
      ],
      'needs_structure_focus': [
        'სტრუქტურა', 'არქიტექტურა', 'ორგანიზაცია', 'დირექტორიები',
        'ფოლდერები', 'ფაილების განლაგება'
      ],
      'needs_component_focus': [
        'კომპონენტები', 'მოდულები', 'სერვისები', 'React კომპონენტები',
        'ფუნქციონალი', 'UI ელემენტები'
      ],
      'needs_code_analysis': [
        'კოდის ანალიზი', 'ფუნქციები', 'იმპლემენტაცია', 'ალგორითმები',
        'ლოგიკა', 'როგორ მუშაობს კონკრეტულად'
      ]
    };

    for (const [type, patterns] of Object.entries(ragPatterns)) {
      if (patterns.some(pattern => lowerMessage.includes(pattern))) {
        return type;
      }
    }

    return 'general_rag';
  },

  // NEW: Get pre-built context for specific file types
  getPreBuiltContextForFiles: (fileTypes) => {
    const fileContexts = {
      'booking': {
        description: 'ჯავშნის სისტემის ფაილები - BookingService.ts, BookingModal.tsx',
        keyFeatures: ['რეალ-დროის ხელმისაწვდომობა', 'ავტომატური ფასების გამოთვლა', 'კალენდარის ინტეგრაცია'],
        relatedFiles: ['src/services/bookingService.ts', 'src/components/BookingModal.tsx', 'src/components/Calendar.tsx']
      },
      'pricing': {
        description: 'ფასების სისტემის ფაილები - სეზონური და ავტომატური გამოთვლა',
        keyFeatures: ['სეზონური ფასები', 'კვირის დღეების ფასები', 'ხანგრძლივობის ფასდაკლება'],
        relatedFiles: ['src/utils/pricing.ts', 'src/utils/vehiclePricing.ts', 'src/components/PricingManager.tsx']
      },
      'admin': {
        description: 'ადმინისტრაციული სისტემის ფაილები',
        keyFeatures: ['მომხმარებლების მართვა', 'კომისიების სისტემა', 'სტატისტიკა'],
        relatedFiles: ['src/AdminUsers.tsx', 'src/AdminCottages.tsx', 'src/MainDashboard.tsx']
      },
      'ai': {
        description: 'AI ასისტენტის სისტემის ფაილები',
        keyFeatures: ['Groq API ინტეგრაცია', 'ქართული ენის ვალიდაცია', 'კოდის ანალიზი'],
        relatedFiles: ['backend/ai_controller.js', 'backend/services/groq_service.js', 'src/components/AIAssistantEnhanced.tsx']
      }
    };

    return fileTypes.map(type => fileContexts[type]).filter(Boolean);
  },

  // NEW: Get token-optimized summary
  getTokenOptimizedSummary: (maxTokens = 500) => {
    const baseInfo = BAKHMARO_PLATFORM_INFO;
    let summary = `🏔️ ბახმაროს ბუკინგ პლატფორმა\n\n`;

    if (maxTokens > 200) {
      summary += `📋 კატეგორიები: კოტეჯები, სასტუმროები, ტრანსპორტი, ცხენები, თოვლმობილები\n`;
      summary += `⚙️ ტექნოლოგიები: React/TypeScript + Node.js/Express + Firebase\n`;
      summary += `🤖 AI: Groq API (Llama models) + ქართული ენის მხარდაჭერა\n`;
    }

    if (maxTokens > 300) {
      summary += `🔧 ძირითადი ფუნქციები: რეალ-დროის ჯავშნა, ავტომატური ფასები, ადმინ პანელი\n`;
    }

    if (maxTokens > 400) {
      summary += `📊 როლები: Customer, Provider, Admin, Super Admin\n`;
      summary += `🏗️ დეპლოიმენტი: Replit Platform\n`;
    }

    return summary;
  },

  // ზოგადი პლატფორმის ინფორმაცია
  getPlatformInfo: () => BAKHMARO_PLATFORM_INFO,

  // Enhanced შემოწმება - არის თუ არა კითხვა "სტატიკური" ტიპის
  isStaticInfoQuery: (message) => {
    const staticQueries = [
      'საიტის სრული ინფორმაცია',
      'პლატფორმის დეტალები', 
      'განსაზღვრული ინფორმაცია',
      'ჩემი საიტის აღწერა',
      'როგორ მუშაობს ჩემი საიტი',
      'პლატფორმის სტრუქტურა',
      'ბახმაროს სისტემა',
      'მოკლე შეჯამება',
      'bullet point ინფორმაცია'
    ];

    const lowerMessage = message.toLowerCase();
    return staticQueries.some(query => lowerMessage.includes(query.toLowerCase()));
  },

  // NEW: Check if query requires multi-stage processing
  requiresMultiStageRAG: (message) => {
    const multiStageIndicators = [
      'მთელი საიტის შესახებ დაწვრილებითი ინფორმაცია',
      'სრული პროექტის ანალიზი',
      'ყველაფერი რაც არის',
      'დეტალური აღწერა მთელი პლატფორმის',
      'კომპლექსური ანალიზი',
      'comprehensive analysis'
    ];

    const lowerMessage = message.toLowerCase();
    return multiStageIndicators.some(indicator => lowerMessage.includes(indicator));
  },
  
  // Get modules for specific topic
  getModulesForTopic: (topic) => {
    return SiteSummary.getModulesForTopic(topic);
  },

  // Get all available topics
  getAvailableTopics: () => {
    return SiteSummary.getAvailableTopics();
  }
};