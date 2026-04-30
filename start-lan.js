'use strict';

const { spawn, exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const INFO_FILE = path.join(PUBLIC_DIR, 'lan-info.json');
const HOST_URL = `http://localhost:${PORT}/host.html`;

function getLanUrls() {
  const urls = [];
  const nets = os.networkInterfaces();
  for (const infos of Object.values(nets)) {
    for (const info of infos || []) {
      if (info.family === 'IPv4' && !info.internal) {
        urls.push(`http://${info.address}:${PORT}`);
      }
    }
  }
  return urls;
}

function openBrowser(url) {
  const escaped = url.replace(/"/g, '\\"');
  let command;
  if (process.platform === 'win32') command = `start "" "${escaped}"`;
  else if (process.platform === 'darwin') command = `open "${escaped}"`;
  else command = `xdg-open "${escaped}"`;
  exec(command, () => {});
}

function writeLanInfo() {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  const lanUrls = getLanUrls();
  const payload = {
    port: PORT,
    localUrl: `http://localhost:${PORT}`,
    hostUrl: HOST_URL,
    lanUrls,
    startedAt: new Date().toISOString()
  };
  fs.writeFileSync(INFO_FILE, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

function printBanner(info) {
  console.log('\n=== Snake Arena LAN Launcher ===');
  console.log(`Host dashboard: ${HOST_URL}`);
  console.log(`Local game:      ${info.localUrl}`);
  if (info.lanUrls.length) {
    console.log('\nShare one of these LAN links with players on the same Wi-Fi/network:');
    for (const url of info.lanUrls) console.log(`  ${url}`);
  } else {
    console.log('\nNo LAN IPv4 address was detected. Check Wi-Fi/network adapter settings.');
  }
  console.log('\nKeep this window open while playing. Press Ctrl+C to stop the server.\n');
}

const info = writeLanInfo();
printBanner(info);

const child = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT) },
  stdio: 'inherit'
});

setTimeout(() => openBrowser(HOST_URL), 900);

child.on('exit', code => {
  process.exit(code ?? 0);
});

process.on('SIGINT', () => {
  child.kill('SIGINT');
});
