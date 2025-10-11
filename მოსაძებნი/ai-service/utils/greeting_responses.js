const MORNING_GREETINGS = [
  'დილა მშვიდობისა! ☀️ მე ვარ ბახმაროს AI ასისტენტი. რით შემიძლია დაგეხმარო?',
  'დილა მშვიდობისა! 👋 დღისთვის რაიმე დავალებას ხომ არ გეგმავ?',
  'დილა მშვიდობისა! 🌅 მზად ვარ მოგეხმარო ბახმაროს პროექტებში.'
];

const AFTERNOON_GREETINGS = [
  'შუადღე მშვიდობისა! 👋 როგორ გავაგრძელოთ მუშაობა?',
  'შუადღე მშვიდობისა! ☀️ მზად ვარ ნებისმიერი ტექნიკური თემისთვის.',
  'შუადღე მშვიდობისა! 💡 რა საკითხზე გჭირდება დახმარება?' 
];

const EVENING_GREETINGS = [
  'საღამო მშვიდობისა! 🌆 რა თემებზე მუშაობთ ახლა?',
  'საღამო მშვიდობისა! 👋 გჭირდება დღის შეჯამება ან დახმარება?',
  'საღამო მშვიდობისა! ✨ მზად ვარ ბოლო დავალებებში დაგეხმარო.'
];

const NIGHT_GREETINGS = [
  'ღამე მშვიდობისა! 🌙 თუ ისევ მუშაობ, მე აქ ვარ დასახმარებლად.',
  'ღამე მშვიდობისა! 🌌 მზად ვარ ღამის სესიაზეც დაგეხმარო.',
  'ღამე მშვიდობისა! 💫 ნებისმიერ დროს შეგიძლია მკითხო.'
];

const TIME_BASED_GREETINGS = {
  morning: MORNING_GREETINGS,
  afternoon: AFTERNOON_GREETINGS,
  evening: EVENING_GREETINGS,
  night: NIGHT_GREETINGS,
};

const GREETING_RESPONSES = [
  ...MORNING_GREETINGS,
  ...AFTERNOON_GREETINGS,
  ...EVENING_GREETINGS,
  ...NIGHT_GREETINGS,
];

function getTimePeriod(date = new Date()) {
  const georgianHour = (date.getUTCHours() + 4) % 24;
  if (georgianHour >= 5 && georgianHour < 12) {
    return 'morning';
  }
  if (georgianHour >= 12 && georgianHour < 18) {
    return 'afternoon';
  }
  if (georgianHour >= 18 && georgianHour < 23) {
    return 'evening';
  }
  return 'night';
}

function getRandomGreeting(date = new Date()) {
  const period = getTimePeriod(date);
  const options = TIME_BASED_GREETINGS[period] || EVENING_GREETINGS;
  return options[Math.floor(Math.random() * options.length)];
}

module.exports = {
  GREETING_RESPONSES,
  getRandomGreeting,
  getTimePeriod
};
