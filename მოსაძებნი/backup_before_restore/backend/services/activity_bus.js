const { seedMonotonic } = require('../utils/activity_store');

const clients = new Set(); // {res, id, lastEventId}
let lastTs = 0, counter = 0;
try { const s = seedMonotonic(); if (s.ts) { lastTs = s.ts; counter = s.ctr; } } catch {}

function generateId() {
  const now = Date.now();
  if (now === lastTs) counter++; else { lastTs = now; counter = 0; }
  return `${now}-${counter}`;
}
function formatSSE(evt){ return `id: ${evt.id}\nevent: activity\ndata: ${JSON.stringify(evt)}\n\n`; }

const subscribers = {
  add(res, lastEventId) { const c = { res, id: generateId(), lastEventId }; clients.add(c); return c; },
  remove(c) { clients.delete(c); }
};

function heartbeat() {
  const payload = `event: heartbeat\ndata: {"type":"heartbeat","timestamp":"${new Date().toISOString()}","connections":${clients.size}}\n\n`;
  const deadClients = [];
  
  for (const c of clients) { 
    try { 
      if (c.res.writable) {
        c.res.write(payload); 
      } else {
        deadClients.push(c);
      }
    } catch (err) {
      console.log('[SSE] Dead client detected during heartbeat');
      deadClients.push(c);
    }
  }
  
  // Clean up dead clients
  deadClients.forEach(c => clients.delete(c));
}
let hbTimer=null;
function startHeartbeat(ms=+process.env.ACTIVITY_HEARTBEAT_MS||25000){ clearInterval(hbTimer); hbTimer=setInterval(heartbeat, ms); }

const store = require('../utils/activity_store');
function logActivity(activityData){
  const evt = { id: activityData.id || generateId(), ...activityData, timestamp: activityData.timestamp || new Date().toISOString() };
  
  // Force storage for test activities (regardless of ENABLE_ACTIVITY_PERSIST)
  if (store.append) {
    try { 
      store.append(evt); 
      console.log('📝 Activity stored:', evt.actionType);
    } catch (error) {
      console.error('❌ Activity storage failed:', error.message);
    }
  }
  
  // Send to SSE clients immediately
  const payload = formatSSE(evt);
  for (const c of clients) { 
    try { 
      if (c.res.writable) {
        c.res.write(payload); 
        console.log('📡 Activity sent to SSE client');
      }
    } catch (error) {
      console.error('📡 SSE send failed:', error.message);
    }
  }
  return evt;
}

// შევქმნათ test activity events startup-ზე
function seedInitialActivities() {
  console.log('🌱 Activity Bus: Seeding initial test activities...');
  
  const testActivities = [
    {
      author: { name: 'SUPER_ADMIN', type: 'USER' },
      actionType: 'SYSTEM_STATUS',
      summary: 'AI Developer Console ჩაირთო',
      details: { description: 'SUPER_ADMIN მომხმარებელმა აირჩია AI Developer Panel' }
    },
    {
      author: { name: 'Replit Agent', type: 'EXTERNAL_AI' },
      actionType: 'CODE_EXTRACTION',
      summary: 'ExplorerPanel.tsx წარმატებით გამოყოფილია',
      details: { 
        file: 'src/components/ExplorerPanel.tsx',
        description: 'Explorer ფუნქციონალობა გამოყოფილია ცალკე კომპონენტად STRICT PATCH MODE-ით'
      }
    },
    {
      author: { name: 'AI Assistant', type: 'EXTERNAL_AI' },
      actionType: 'AI_MODEL_UPDATE',
      summary: 'Groq AI მოდელი განახლდა',
      details: { 
        description: 'llama3-8b-8192 → llama-3.1-8b-instant (deprecated model fixed)'
      }
    },
    {
      author: { name: 'SUPER_ADMIN', type: 'USER' },
      actionType: 'AUTHENTICATION',
      summary: 'SUPER_ADMIN წვდომა აღდგენილია',
      details: { description: 'WebAuthn სესია და backend authentication გამოსწორდა' }
    }
  ];

  testActivities.forEach(activity => {
    try {
      logActivity(activity);
      console.log(`✅ Test activity logged: ${activity.summary}`);
    } catch (error) {
      console.error(`❌ Failed to log test activity: ${activity.summary}`, error);
    }
  });
}

// Startup-ზე seed activities (გაშვება მყისიერად)
console.log('🚀 Activity Bus: Module loaded, seeding activities...');
seedInitialActivities();

// Backup activity generation after 5 seconds
setTimeout(() => {
  console.log('🔄 Activity Bus: Backup seeding attempt...');
  seedInitialActivities();
}, 5000);

module.exports = { subscribers, logActivity, startHeartbeat, seedInitialActivities };