const fs = require('fs');
const path = require('path');

const PROC_ROOT = '/proc';
const SOCKET_LINK_REGEX = /^socket:\[(\d+)\]$/;
const TCP_STATE_LISTEN = '0A';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseCmdline = (pid) => {
  try {
    const cmdline = fs.readFileSync(path.join(PROC_ROOT, String(pid), 'cmdline'));
    return cmdline
      .toString()
      .split('\u0000')
      .filter(Boolean)
      .join(' ');
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'EACCES') {
      console.warn(`⚠️  [portInspector] Failed to read cmdline for PID ${pid}:`, error.message);
    }
    return null;
  }
};

const collectPortInodes = (targetPorts) => {
  const portInodes = new Map();
  const addEntry = (port, inode, protocol) => {
    if (!portInodes.has(port)) {
      portInodes.set(port, []);
    }
    portInodes.get(port).push({ inode, protocol });
  };

  const parseFile = (filePath, protocol) => {
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(`⚠️  [portInspector] Unable to read ${filePath}:`, error.message);
      }
      return;
    }

    const lines = content.trim().split('\n');
    lines.shift();

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 10) continue;

      const localAddress = parts[1];
      const state = parts[3];
      const inode = parts[9];

      const [addressHex, portHex] = localAddress.split(':');
      if (!portHex) continue;

      const port = parseInt(portHex, 16);
      if (!targetPorts.has(port)) continue;

      if (state !== TCP_STATE_LISTEN && protocol.startsWith('tcp')) {
        continue;
      }

      addEntry(port, inode, protocol);
    }
  };

  parseFile('/proc/net/tcp', 'tcp4');
  parseFile('/proc/net/tcp6', 'tcp6');
  parseFile('/proc/net/udp', 'udp4');
  parseFile('/proc/net/udp6', 'udp6');

  return portInodes;
};

const mapInodesToProcesses = (portInodes) => {
  const inodeToPorts = new Map();
  for (const [port, entries] of portInodes.entries()) {
    for (const entry of entries) {
      inodeToPorts.set(entry.inode, { port, protocol: entry.protocol });
    }
  }

  const results = new Map();
  for (const [port] of portInodes.entries()) {
    results.set(port, []);
  }

  let procEntries = [];
  try {
    procEntries = fs.readdirSync(PROC_ROOT, { withFileTypes: true });
  } catch (error) {
    console.warn('⚠️  [portInspector] Unable to read /proc directory:', error.message);
    return results;
  }

  for (const dirent of procEntries) {
    if (!dirent.isDirectory()) continue;
    if (!/^[0-9]+$/.test(dirent.name)) continue;

    const pid = parseInt(dirent.name, 10);
    const fdPath = path.join(PROC_ROOT, dirent.name, 'fd');

    let fdList;
    try {
      fdList = fs.readdirSync(fdPath);
    } catch (error) {
      continue;
    }

    for (const fd of fdList) {
      const linkPath = path.join(fdPath, fd);
      let link;
      try {
        link = fs.readlinkSync(linkPath);
      } catch (error) {
        continue;
      }

      const match = SOCKET_LINK_REGEX.exec(link);
      if (!match) continue;

      const inode = match[1];
      const portInfo = inodeToPorts.get(inode);
      if (!portInfo) continue;

      const command = parseCmdline(pid);
      results.get(portInfo.port).push({ pid, command, protocol: portInfo.protocol });
    }
  }

  return results;
};

const inspectPorts = (ports) => {
  const targetPorts = new Set(ports);
  const portInodes = collectPortInodes(targetPorts);
  const processMap = mapInodesToProcesses(portInodes);

  const results = ports.map((port) => {
    const processes = processMap.get(port) || [];
    return {
      port,
      status: processes.length > 0 ? 'in_use' : 'available',
      processes,
    };
  });

  return results;
};

const terminateProcess = async (pid, { gracefulTimeout = 1500, forceTimeout = 1500 } = {}) => {
  const signals = ['SIGTERM', 'SIGKILL'];

  for (const signal of signals) {
    try {
      process.kill(pid, signal);
    } catch (error) {
      if (error.code === 'ESRCH') {
        return { success: true, signal, alreadyExited: true };
      }
      return { success: false, signal, error };
    }

    const timeout = signal === 'SIGTERM' ? gracefulTimeout : forceTimeout;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      try {
        process.kill(pid, 0);
        await sleep(100);
      } catch (error) {
        if (error.code === 'ESRCH') {
          return { success: true, signal };
        }
        return { success: false, signal, error };
      }
    }
  }

  try {
    process.kill(pid, 0);
    return { success: false, signal: 'SIGKILL', error: new Error('Process still alive after forced termination') };
  } catch (error) {
    if (error.code === 'ESRCH') {
      return { success: true, signal: 'SIGKILL' };
    }
    return { success: false, signal: 'SIGKILL', error };
  }
};

module.exports = {
  inspectPorts,
  terminateProcess,
};
