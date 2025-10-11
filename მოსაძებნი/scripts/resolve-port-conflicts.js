#!/usr/bin/env node
const { inspectPorts, terminateProcess } = require('./utils/portInspector');

const TARGET_PORTS = [3000, 5000, 5001, 5002];

const formatProcessInfo = (process) => {
  const command = process.command || 'unknown command';
  return `PID ${process.pid}${command ? ` (${command})` : ''}`;
};

const printStatus = (portStatus) => {
  const header = `Port ${portStatus.port}`;
  if (portStatus.status === 'available') {
    console.log(`✅ ${header}: თავისუფალია`);
    return;
  }

  console.log(`🚨 ${header}: კონფლიქტშია`);
  for (const proc of portStatus.processes) {
    console.log(`   ↳ ${formatProcessInfo(proc)}`);
  }
};

const resolveConflicts = async (statuses) => {
  const conflicted = statuses.filter((status) => status.status === 'in_use');
  if (conflicted.length === 0) {
    console.log('\n🎉 კონფლიქტი არ დაფიქსირდა.');
    return statuses;
  }

  console.log('\n🛠️  კონფლიქტური პროცესების გაჩერების მცდელობა...');

  for (const status of conflicted) {
    for (const proc of status.processes) {
      console.log(`   • Port ${status.port}-ზე გაშვებულია ${formatProcessInfo(proc)} — მცდელობა გაჩერებაზე`);
      const result = await terminateProcess(proc.pid);
      if (result.success) {
        console.log(`     ✅ PID ${proc.pid} გაჩერდა (${result.signal})`);
      } else {
        const reason = result.error ? result.error.message : 'უცნობი შეცდომა';
        console.log(`     ❌ PID ${proc.pid} ვერ გაჩერდა: ${reason}`);
      }
    }
  }

  console.log('\n🔁 სტატუსის ხელახალი შემოწმება...');
  const refreshed = inspectPorts(TARGET_PORTS);
  for (const status of refreshed) {
    printStatus(status);
  }

  return refreshed;
};

(async () => {
  console.log('🔍 Port-ის სტატუსების შემოწმება...\n');
  const initialStatuses = inspectPorts(TARGET_PORTS);
  for (const status of initialStatuses) {
    printStatus(status);
  }

  const finalStatuses = await resolveConflicts(initialStatuses);

  const remainingConflicts = finalStatuses.filter((status) => status.status === 'in_use');
  if (remainingConflicts.length === 0) {
    console.log('\n✅ ყველა მონიტორინგებული port ჯანმრთელია.');
    process.exit(0);
  }

  console.log('\n⚠️  დარჩა კონფლიქტური port-ები. ხელით ჩარევა შეიძლება გახდეს საჭირო.');
  process.exit(1);
})();
