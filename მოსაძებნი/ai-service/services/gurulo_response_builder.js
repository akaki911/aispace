'use strict';

const path = require('path');

function safeLoadLocale(locale) {
  try {
    const localePath = path.resolve(__dirname, '..', '..', 'src', 'i18n', 'locales', `${locale}.json`);
    // eslint-disable-next-line global-require, import/no-dynamic-require
    return require(localePath);
  } catch (error) {
    return {};
  }
}

const kaTranslations = safeLoadLocale('ka');
const enTranslations = safeLoadLocale('en');

const QUICK_PICKS = {
  ka: [
    { label: 'შემდეგი შაბათ-კვირა', value: 'შემდეგი შაბათ-კვირა' },
    { label: 'მომდევნო 7 დღე', value: 'მომდევნო 7 დღე' },
  ],
  en: [
    { label: 'Next weekend', value: 'Next weekend' },
    { label: 'Next 7 days', value: 'Next 7 days' },
  ],
};

const CTA_LABEL_FALLBACK = {
  availability: {
    ka: 'ნახე ხელმისაწვდომობა',
    en: 'Check availability',
  },
  pricing: {
    ka: 'ფასების წესები',
    en: 'Pricing rules',
  },
  weather: {
    ka: 'ამინდის დეტალური ნახვა',
    en: 'View detailed weather',
  },
  tripPlan: {
    ka: 'გეგმა 3 ნაბიჯში',
    en: 'Plan in 3 steps',
  },
};

const AVAILABILITY_PARAMS_FALLBACK = {
  ka: 'მომაწოდე ჩასვლის და გასვლის თარიღები და სტუმრების რაოდენობა, რომ ხელმისაწვდომობა შეგიმოწმო.',
  en: 'Let me know arrival and departure dates plus guest count so I can check availability.',
};

const GUARD_FALLBACK = {
  ka: 'მე გიდგავარ გვერდში სტუმრის თემებზე — ბახმაროს კოტეჯები, ფასები, ამინდი, გზები, მარშრუტები. ტექნიკურ კითხვებზე პასუხს ვერ გაგიტარებ.',
  en: "I'm here to help with guest topics only—Bakhmaro cottages, pricing, weather, routes, and tours. I can't assist with technical questions.",
};

const GUARD_CTA_FALLBACK = {
  ka: 'დამიწერე თარიღები და ხალხის რაოდენობა',
  en: 'Share dates and guest count',
};

const CTA_ROUTES = {
  availability: '/cottages',
  pricing: '/cottages#pricing',
  weather: '/cottages#weather',
  tripPlan: '/cottages#plan',
  policies: '/cottages#policies',
  contact: '/contact',
  transport: '/cottages#transport',
  attractions: '/cottages#attractions',
  details: '/cottages#details',
};

const PUBLIC_AUDIENCE = 'public_front';
const ADMIN_AUDIENCE = 'admin_dev';

const PUBLIC_RESPONSE_FALLBACK = {
  ka: 'გურულო მზადაა დაგეხმაროს — მომაწოდე თარიღები და სტუმრების რაოდენობა.',
  en: 'Gurulo is ready to help — share your dates and guest count to get started.',
};

const getChatRoot = (language) => {
  const source = language === 'en' ? enTranslations : kaTranslations;
  return source && typeof source === 'object' ? source.chat : undefined;
};

const resolveChatValue = (language, keyPath, fallback) => {
  const segments = keyPath.split('.');
  let current = getChatRoot(language);

  for (const segment of segments) {
    if (!current || typeof current !== 'object') {
      return fallback;
    }
    current = current[segment];
  }

  return typeof current === 'string' && current.trim() ? current : fallback;
};

const getCtaLabels = (language) => ({
  availability: resolveChatValue(language, 'availability.cta', CTA_LABEL_FALLBACK.availability[language]),
  availabilityAsk: resolveChatValue(language, 'availability.askParams', AVAILABILITY_PARAMS_FALLBACK[language]),
  pricing: resolveChatValue(language, 'pricing.cta', CTA_LABEL_FALLBACK.pricing[language]),
  weather: resolveChatValue(language, 'weather.cta', CTA_LABEL_FALLBACK.weather[language]),
  tripPlan: resolveChatValue(language, 'tripPlan.cta', CTA_LABEL_FALLBACK.tripPlan[language]),
});

const getGuardCopy = (language) => ({
  message: resolveChatValue(language, 'guard.onlyConsumerTopics', GUARD_FALLBACK[language]),
  cta: resolveChatValue(language, 'guard.retryAskDates', GUARD_CTA_FALLBACK[language]),
});

const formatCta = (label, href) => `${label} → ${href}`;

const resolveAudience = (metadata = {}, options = {}) => {
  const optionAudience =
    options && typeof options.audience === 'string' ? options.audience : undefined;
  if (optionAudience === PUBLIC_AUDIENCE || optionAudience === ADMIN_AUDIENCE) {
    return optionAudience;
  }

  if (metadata && typeof metadata === 'object') {
    const metadataAudience = metadata.audience;
    if (metadataAudience === PUBLIC_AUDIENCE || metadataAudience === ADMIN_AUDIENCE) {
      return metadataAudience;
    }
  }

  return ADMIN_AUDIENCE;
};

const flattenSectionToPlain = (section) => {
  if (!section || typeof section !== 'object') {
    return [];
  }

  const record = section;
  const lines = [];

  if (typeof record.title === 'string' && record.title.trim()) {
    lines.push(record.title.trim());
  }

  if (Array.isArray(record.bullets)) {
    for (const bullet of record.bullets) {
      if (typeof bullet === 'string' && bullet.trim()) {
        lines.push(bullet.trim());
      }
    }
  }

  if (typeof record.cta === 'string' && record.cta.trim()) {
    lines.push(record.cta.trim());
  }

  return lines;
};

const extractPlainTextResponse = (response, language) => {
  if (response == null) {
    return '';
  }

  if (typeof response === 'string') {
    return response;
  }

  if (Array.isArray(response)) {
    const lines = [];
    for (const block of response) {
      if (!block || typeof block !== 'object') {
        continue;
      }
      const sections = Array.isArray(block.sections) ? block.sections : [];
      for (const section of sections) {
        lines.push(...flattenSectionToPlain(section));
      }
    }
    return lines.filter(Boolean).join('\n');
  }

  if (typeof response === 'object') {
    if (Array.isArray(response.sections)) {
      return response.sections
        .map((section) => flattenSectionToPlain(section))
        .flat()
        .filter(Boolean)
        .join('\n');
    }

    if (response.response) {
      return extractPlainTextResponse(response.response, language);
    }

    const prioritizedKeys = ['text', 'content', 'message', 'body', 'value'];
    for (const key of prioritizedKeys) {
      if (typeof response[key] === 'string' && response[key].trim()) {
        return response[key];
      }
    }
  }

  return '';
};

const finalizeAudiencePayload = (payload, language, metadata = {}, options = {}) => {
  const audience = resolveAudience(metadata, options);
  if (audience === PUBLIC_AUDIENCE) {
    const plainCandidate =
      typeof payload.plainText === 'string' && payload.plainText.trim()
        ? payload.plainText.trim()
        : extractPlainTextResponse(payload.response, language);

    const normalizedPlain = plainCandidate && plainCandidate.trim().length ? plainCandidate.trim() : '';
    const responseText =
      normalizedPlain ||
      (typeof payload.response === 'string' && payload.response.trim() ? payload.response.trim() : '') ||
      PUBLIC_RESPONSE_FALLBACK[language] ||
      PUBLIC_RESPONSE_FALLBACK.ka;

    const result = {
      response: responseText,
    };

    if (Array.isArray(payload.quickPicks) && payload.quickPicks.length) {
      result.quickPicks = payload.quickPicks;
    }

    return result;
  }

  return payload;
};

function determineLanguage(metadata = {}) {
  if (metadata.language === 'en') return 'en';
  if (metadata.language === 'ka') return 'ka';
  return 'ka';
}

function createStructuredBlock(language, sections) {
  return [
    {
      language,
      sections,
    },
  ];
}

function pickGreetingTemplate(language) {
  const chat = (language === 'en' ? enTranslations : kaTranslations)?.chat;
  const reply = chat?.greeting?.reply;
  if (!reply) {
    return {
      text:
        language === 'en'
          ? 'Hello from Gurulo! Ready to guide you through Bakhmaro.'
          : 'გამარჯობა გურულოსგან! მზად ვარ დაგეხმარო ბახმაროს დაგეგმვაში.',
      actions: QUICK_PICKS[language],
    };
  }

  return {
    text: typeof reply.text === 'string' ? reply.text : '',
    actions: Array.isArray(reply.actions) && reply.actions.length ? reply.actions : QUICK_PICKS[language],
  };
}

function buildGreetingResponse(metadata = {}, options = {}) {
  const language = determineLanguage(metadata);
  const template = pickGreetingTemplate(language);
  const ctas = getCtaLabels(language);

  const sections = [
    {
      title: language === 'en' ? 'Warm welcome' : 'თბილი მისალმება',
      bullets: [template.text],
      cta: formatCta(ctas.availability, CTA_ROUTES.availability),
    },
    {
      title: language === 'en' ? 'Quick actions' : 'სწრაფი მოქმედებები',
      bullets: template.actions.map((action) => `• ${action.label}`),
      cta: formatCta(ctas.tripPlan, CTA_ROUTES.tripPlan),
    },
  ];

  return finalizeAudiencePayload(
    {
      response: createStructuredBlock(language, sections),
      telemetry: {
        intent_detected: 'greeting',
        param_missing: [],
        cta_shown: true,
        recommendations_shown: false,
      },
      quickPicks: QUICK_PICKS[language],
    },
    language,
    metadata,
    options,
  );
}

function buildSmalltalkResponse(metadata = {}, options = {}) {
  const language = determineLanguage(metadata);
  const ctas = getCtaLabels(language);
  const message = language === 'en'
    ? 'Happy to chat! Ask me about cottages, prices, or planning your stay.'
    : 'სასიამოვნოა საუბარი! მკითხე კოტეჯებზე, ფასებზე ან ბახმაროს გეგმაზე.';

  const sections = [
    {
      title: language === 'en' ? 'Friendly note' : 'მეგობრული მისალმება',
      bullets: [message],
      cta: formatCta(ctas.availability, CTA_ROUTES.availability),
    },
  ];

  return finalizeAudiencePayload(
    {
      response: createStructuredBlock(language, sections),
      telemetry: {
        intent_detected: 'smalltalk',
        param_missing: [],
        cta_shown: true,
        recommendations_shown: false,
      },
    },
    language,
    metadata,
    options,
  );
}

function buildParamRequestResponse(missingParams = [], metadata = {}, options = {}) {
  const language = determineLanguage(metadata);
  const ctas = getCtaLabels(language);
  const bullets = [];
  bullets.push(ctas.availabilityAsk);

  const missingMap = {
    from: language === 'en' ? 'Share the check-in date.' : 'მიკარნახე ჩასვლის თარიღი.',
    to: language === 'en' ? 'Tell me the checkout date.' : 'მომაწოდე გასვლის თარიღი.',
    guests: language === 'en' ? 'How many guests are traveling?' : 'რამდენი სტუმარია ჯამში?',
  };

  missingParams.forEach((param) => {
    if (missingMap[param]) {
      bullets.push(`• ${missingMap[param]}`);
    }
  });

  const sections = [
    {
      title: language === 'en' ? 'Need a bit more detail' : 'დამჭირდება პატარა დეტალი',
      bullets,
      cta: formatCta(ctas.availability, CTA_ROUTES.availability),
    },
    {
      title: language === 'en' ? 'Popular ranges' : 'პოპულარული შერჩევა',
      bullets: QUICK_PICKS[language].map((pick) => `• ${pick.label}`),
      cta: formatCta(ctas.tripPlan, CTA_ROUTES.tripPlan),
    },
  ];

  return finalizeAudiencePayload(
    {
      response: createStructuredBlock(language, sections),
      telemetry: {
        intent_detected: 'check_availability',
        param_missing: missingParams,
        cta_shown: true,
        recommendations_shown: false,
      },
      quickPicks: QUICK_PICKS[language],
    },
    language,
    metadata,
    options,
  );
}

const SAMPLE_AVAILABILITY = [
  {
    id: 'pine-haven',
    name: 'პაინ ჰეივენი / Pine Haven',
    capacity: 4,
    nightlyPrice: 180,
    highlights: ['კამინდარი', 'პანორამული ხედები'],
  },
  {
    id: 'misty-valley',
    name: 'ნისლიანი ხეობა / Misty Valley',
    capacity: 6,
    nightlyPrice: 220,
    highlights: ['სპა აბანო', 'ორ დონიანი ტერასა'],
  },
  {
    id: 'alpine-nest',
    name: 'ალპური ბუდე / Alpine Nest',
    capacity: 2,
    nightlyPrice: 140,
    highlights: ['უსაზღვრო ხედები', 'საუზმე საწოლში'],
  },
];

function calculateNights(from, to) {
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 1;
  }
  const diff = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
  return diff;
}

function buildAvailabilityResults(params, metadata = {}, options = {}) {
  const language = determineLanguage(metadata);
  const ctas = getCtaLabels(language);
  const nights = calculateNights(params.from, params.to);
  const filtered = SAMPLE_AVAILABILITY.filter((item) => !params.guests || item.capacity >= params.guests).slice(0, 3);

  const bullets = filtered.map((item) => {
    const totalPrice = item.nightlyPrice * nights;
    const priceLine = language === 'en'
      ? `${nights} nights • ₾${totalPrice}`
      : `${nights} ღამე • ₾${totalPrice}`;
    const highlightLine = item.highlights.length
      ? `${language === 'en' ? 'Highlights' : 'მახასიათებლები'}: ${item.highlights.join(', ')}`
      : '';
    return `• ${item.name} — ${priceLine}${highlightLine ? ` • ${highlightLine}` : ''}`;
  });

  if (bullets.length === 0) {
    bullets.push(
      language === 'en'
        ? 'No cottages match that capacity. Try adjusting dates or guest count.'
        : 'ამ მოცულობაზე კოტეჯი ვერ ვიპოვე. სცადე თარიღების ან სტუმრების რაოდენობის შეცვლა.'
    );
  }

  const query = new URLSearchParams();
  if (params.from) {
    query.set('from', params.from);
  }
  if (params.to) {
    query.set('to', params.to);
  }
  if (params.guests) {
    query.set('guests', String(params.guests));
  }

  const href = query.toString() ? `${CTA_ROUTES.availability}?${query.toString()}` : CTA_ROUTES.availability;

  const sections = [
    {
      title: language === 'en' ? 'Available cottages' : 'თავისუფალი კოტეჯები',
      bullets,
      cta: formatCta(ctas.availability, href),
    },
    {
      title: language === 'en' ? 'Need pricing help?' : 'გჭირდება ფასებზე დახმარება?',
      bullets: [
        language === 'en'
          ? 'Share preferred budget or cabin type and I will outline the options.'
          : 'მითხარი ბიუჯეტი ან კოტეჯის ტიპი და ჩამოვთვლი შეთავაზებებს.'
      ],
      cta: formatCta(ctas.pricing, CTA_ROUTES.pricing),
    },
  ];

  return finalizeAudiencePayload(
    {
      response: createStructuredBlock(language, sections),
      telemetry: {
        intent_detected: 'check_availability',
        param_missing: [],
        cta_shown: true,
        recommendations_shown: false,
      },
    },
    language,
    metadata,
    options,
  );
}

function buildPricingInfoResponse(metadata = {}, options = {}) {
  const language = determineLanguage(metadata);
  const ctas = getCtaLabels(language);
  const sections = [
    {
      title: language === 'en' ? 'Pricing overview' : 'ფასების მიმოხილვა',
      bullets: [
        language === 'en'
          ? 'Nightly rates vary from ₾140 for cozy couples stays up to ₾260 for family cottages with full amenities.'
          : 'ღამის ფასები იწყება ₾140-დან წყვილისთვის და აღწევს ₾260-მდე ოჯახური კოტეჯებისთვის სრულ მომსახურებით.'
      ],
      cta: formatCta(ctas.pricing, CTA_ROUTES.pricing),
    },
  ];

  return finalizeAudiencePayload(
    {
      response: createStructuredBlock(language, sections),
      telemetry: {
        intent_detected: 'pricing_info',
        param_missing: [],
        cta_shown: true,
        recommendations_shown: false,
      },
    },
    language,
    metadata,
    options,
  );
}

function buildWeatherInfoResponse(metadata = {}, options = {}) {
  const language = determineLanguage(metadata);
  const ctas = getCtaLabels(language);
  const sections = [
    {
      title: language === 'en' ? 'Current weather' : 'ამჟამინდელი ამინდი',
      bullets: [
        language === 'en'
          ? 'Mountain mornings hover around 12°C in summer, with crisp evenings ideal for fireplaces.'
          : 'ზაფხულში დილის ტემპერატურა საშუალოდ 12°C-ია, საღამოს კი მთის ჰავა ბუხართან გამთბარ გარემოს ქმნის.'
      ],
      cta: formatCta(ctas.weather, CTA_ROUTES.weather),
    },
  ];

  return finalizeAudiencePayload(
    {
      response: createStructuredBlock(language, sections),
      telemetry: {
        intent_detected: 'weather_info',
        param_missing: [],
        cta_shown: true,
        recommendations_shown: false,
      },
    },
    language,
    metadata,
    options,
  );
}

function buildTripPlanResponse(metadata = {}, options = {}) {
  const language = determineLanguage(metadata);
  const ctas = getCtaLabels(language);
  const bullets = language === 'en'
    ? [
        'Day 1 – Arrival and sunset walk through the spruce forest.',
        'Day 2 – Morning horseback ride, afternoon picnic near the ridge.',
        'Day 3 – Local breakfast, souvenir stops, smooth checkout.',
      ]
    : [
        'დღე 1 – ჩამოსვლა და სერპანტინზე გასეირნება მზის ჩასვლამდე.',
        'დღე 2 – დილას ცხენით სვლა, შუადღეს პიკნიკი ქედის მახლობლად.',
        'დღე 3 – ადგილობრივი საუზმე, სუვენირების შეძენა და მშვიდი გამშვები.',
      ];

  const sections = [
    {
      title: language === 'en' ? 'Plan in 3 steps' : 'გეგმა 3 ნაბიჯში',
      bullets,
      cta: formatCta(ctas.tripPlan, CTA_ROUTES.tripPlan),
    },
  ];

  return finalizeAudiencePayload(
    {
      response: createStructuredBlock(language, sections),
      telemetry: {
        intent_detected: 'trip_plan',
        param_missing: [],
        cta_shown: true,
        recommendations_shown: false,
      },
    },
    language,
    metadata,
    options,
  );
}

function buildPoliciesFaqResponse(metadata = {}, options = {}) {
  const language = determineLanguage(metadata);
  const ctas = getCtaLabels(language);
  const sections = [
    {
      title: language === 'en' ? 'House rules' : 'სახლის წესები',
      bullets: [
        language === 'en'
          ? 'Bookings are confirmed with a 30% deposit, refundable up to 14 days before arrival.'
          : 'დაჯავშნა დადასტურდება 30%-იანი დეპოზიტით, რომელიც ბრუნდება ჩასვლამდე 14 დღით ადრე გაუქმების შემთხვევაში.'
      ],
      cta: formatCta(ctas.pricing, CTA_ROUTES.policies),
    },
  ];

  return finalizeAudiencePayload(
    {
      response: createStructuredBlock(language, sections),
      telemetry: {
        intent_detected: 'policies_faq',
        param_missing: [],
        cta_shown: true,
        recommendations_shown: false,
      },
    },
    language,
    metadata,
    options,
  );
}

function buildContactSupportResponse(metadata = {}, options = {}) {
  const language = determineLanguage(metadata);
  const sections = [
    {
      title: language === 'en' ? 'Need direct help?' : 'გჭირდება პირდაპირი დახმარება?',
      bullets: [
        language === 'en'
          ? 'Our concierge team replies 10:00–20:00. Call +995 555 123 456 or send a WhatsApp message.'
          : 'ჩვენი კონსიერჟის გუნდი პასუხობს 10:00-20:00. დარეკე +995 555 123 456 ან მოგვწერე WhatsApp-ზე.'
      ],
      cta: formatCta(language === 'en' ? 'Contact support' : 'დაგვიკავშირდი', CTA_ROUTES.contact),
    },
  ];

  return finalizeAudiencePayload(
    {
      response: createStructuredBlock(language, sections),
      telemetry: {
        intent_detected: 'contact_support',
        param_missing: [],
        cta_shown: true,
        recommendations_shown: false,
      },
    },
    language,
    metadata,
    options,
  );
}

function buildTransportResponse(metadata = {}, options = {}) {
  const language = determineLanguage(metadata);
  const sections = [
    {
      title: language === 'en' ? 'Getting to Bakhmaro' : 'მოგზაურობა ბახმაროში',
      bullets: [
        language === 'en'
          ? 'Summer access: 4x4 from Chokhatauri in 90 minutes. Winter trips require guided snowcat transfer.'
          : 'ზაფხულში ჩოხატაურიდან 90 წუთში 4x4 მანქანით. ზამთარში აუცილებელია გიდის მიერ ორგანიზებული სნოუკათის ტრანსფერი.'
      ],
      cta: formatCta(language === 'en' ? 'See transport tips' : 'ტრანსპორტის რჩევები', CTA_ROUTES.transport),
    },
  ];

  return finalizeAudiencePayload(
    {
      response: createStructuredBlock(language, sections),
      telemetry: {
        intent_detected: 'transport',
        param_missing: [],
        cta_shown: true,
        recommendations_shown: false,
      },
    },
    language,
    metadata,
    options,
  );
}

function buildLocalAttractionsResponse(metadata = {}, options = {}) {
  const language = determineLanguage(metadata);
  const sections = [
    {
      title: language === 'en' ? 'Things to do' : 'რას გააკეთებ?',
      bullets: [
        language === 'en'
          ? 'Sunrise decks, star-gazing platforms, guided mushroom foraging, and horseback trails await nearby.'
          : 'მზის ასვლის ტერასები, ვარსკვლავების სანახავი პლატფორმები, სოკოს გიდიანი შეგროვება და ცხენით ბილიკები ახლოს გელოდება.'
      ],
      cta: formatCta(language === 'en' ? 'Explore attractions' : 'გაეცანი ატრაქციონებს', CTA_ROUTES.attractions),
    },
  ];

  return finalizeAudiencePayload(
    {
      response: createStructuredBlock(language, sections),
      telemetry: {
        intent_detected: 'local_attractions',
        param_missing: [],
        cta_shown: true,
        recommendations_shown: false,
      },
    },
    language,
    metadata,
    options,
  );
}

function buildCottageDetailsResponse(metadata = {}, options = {}) {
  const language = determineLanguage(metadata);
  const sections = [
    {
      title: language === 'en' ? 'Cottage highlights' : 'კოტეჯის მახასიათებლები',
      bullets: [
        language === 'en'
          ? 'All cabins include mountain Wi-Fi, wood-burning stoves, heated floors, and panoramic balconies.'
          : 'ყველა კოტეჯი აღჭურვილია მთის Wi-Fi-ით, შეშის ბუხრით, გათბობილი იატაკით და პანორამული აივნით.'
      ],
      cta: formatCta(language === 'en' ? 'View cottage details' : 'იხილე კოტეჯის დეტალები', CTA_ROUTES.details),
    },
  ];

  return finalizeAudiencePayload(
    {
      response: createStructuredBlock(language, sections),
      telemetry: {
        intent_detected: 'cottage_details',
        param_missing: [],
        cta_shown: true,
        recommendations_shown: false,
      },
    },
    language,
    metadata,
    options,
  );
}

function buildOffTopicResponse(metadata = {}, options = {}) {
  const language = determineLanguage(metadata);
  const guard = getGuardCopy(language);

  const sections = [
    {
      title: language === 'en' ? 'Let’s stay on guest topics' : 'მივყვეთ სტუმრის თემებს',
      bullets: [guard.message],
      cta: guard.cta,
    },
  ];

  return finalizeAudiencePayload(
    {
      response: createStructuredBlock(language, sections),
      telemetry: {
        intent_detected: 'off_topic_consumer_block',
        param_missing: [],
        cta_shown: Boolean(guard.cta && guard.cta.trim()),
        recommendations_shown: false,
        blocked_off_topic: true,
      },
    },
    language,
    metadata,
    options,
  );
}

module.exports = {
  buildGreetingResponse,
  buildSmalltalkResponse,
  buildParamRequestResponse,
  buildAvailabilityResults,
  buildPricingInfoResponse,
  buildWeatherInfoResponse,
  buildTripPlanResponse,
  buildPoliciesFaqResponse,
  buildContactSupportResponse,
  buildTransportResponse,
  buildLocalAttractionsResponse,
  buildCottageDetailsResponse,
  buildOffTopicResponse,
};

