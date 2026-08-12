#!/usr/bin/env node

/**
 * Olympic National Park Wilderness Permit Availability Checker
 * Checks recreation.gov for Aug 14-17, 2026 availability
 * Usage: node olympic-permit-checker.js
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PERMIT_ID = '4098362'; // Olympic NP
const CHECK_DATES = ['2026-08-14', '2026-08-15', '2026-08-16', '2026-08-17'];
const LOG_FILE = path.join(__dirname, '../.permits-log.json');

// Zones to prioritize
const PRIORITY_ZONES = {
  'Sol Duc Zone': ['High Divide', 'Seven Lakes', 'Deer Lake', 'Heart Lake', 'Lunch Lake'],
  'Staircase Zone': ['Flapjack Lakes', 'Staircase Camp'],
  'Dosewallips Zone': ['Lake Constance', 'Dosewallips Camp'],
  'Coastal': ['Third Beach', 'Oil City']
};

// Fetch from recreation.gov API
async function fetchPermitData() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.recreation.gov',
      path: `/api/camps/availability/campground/${PERMIT_ID}/month?month=2026-08-01`,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse response'));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000);
    req.end();
  });
}

// Parse availability data
function parseAvailability(data) {
  const results = [];

  if (!data.campsites) {
    return null;
  }

  Object.values(data.campsites).forEach(campsite => {
    const site = {
      name: campsite.site,
      zone: campsite.loop || 'Unknown',
      dates: {}
    };

    CHECK_DATES.forEach(date => {
      const availability = campsite.availabilities?.[date];
      if (availability === '2') site.dates[date] = '✓ AVAILABLE';
      else if (availability === '1') site.dates[date] = 'W WALK-UP';
      else site.dates[date] = '✗ SOLD OUT';
    });

    results.push(site);
  });

  return results;
}

// Format output table (72 chars max)
function formatTable(sites) {
  if (!sites || sites.length === 0) {
    return '\n⚠️  No data available. Try:\n1. Check recreation.gov directly\n2. Call WIC: (360) 565-3100\n';
  }

  let output = '\n📍 OLYMPIC NP PERMITS - Aug 14-17, 2026\n';
  output += '━'.repeat(72) + '\n';
  output += 'ZONE | CAMPSITE | 8/14 | 8/15 | 8/16 | 8/17\n';
  output += '─'.repeat(72) + '\n';

  const grouped = {};
  sites.forEach(site => {
    if (!grouped[site.zone]) grouped[site.zone] = [];
    grouped[site.zone].push(site);
  });

  Object.entries(PRIORITY_ZONES).forEach(([zone, keywords]) => {
    if (grouped[zone]) {
      grouped[zone].forEach(site => {
        const name = site.name.substring(0, 18).padEnd(18);
        const line = `${zone.substring(0, 8).padEnd(8)} | ${name} | ${site.dates['2026-08-14']?.substring(0, 1) || '?'} | ${site.dates['2026-08-15']?.substring(0, 1) || '?'} | ${site.dates['2026-08-16']?.substring(0, 1) || '?'} | ${site.dates['2026-08-17']?.substring(0, 1) || '?'}`;
        if (line.length <= 72) output += line + '\n';
      });
    }
  });

  output += '━'.repeat(72) + '\n';
  output += '✓ = Available  |  W = Walk-up  |  ✗ = Sold Out\n\n';
  return output;
}

// Log results
function logResults(sites, timestamp) {
  let log = [];
  if (fs.existsSync(LOG_FILE)) {
    try {
      log = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
    } catch (e) {
      log = [];
    }
  }

  log.push({
    timestamp,
    sites: sites || [],
    status: sites ? 'SUCCESS' : 'FAILED'
  });

  // Keep last 100 checks
  log = log.slice(-100);
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
}

// Detect cancellations
function detectCancellations(currentSites, previousRun) {
  if (!previousRun || !previousRun.sites) return [];

  const available = currentSites.filter(s =>
    Object.values(s.dates).some(d => d?.includes('✓'))
  );

  const previousAvailable = previousRun.sites.filter(s =>
    Object.values(s.dates).some(d => d?.includes('✓'))
  );

  const newlyAvailable = available.filter(site =>
    !previousAvailable.find(p => p.name === site.name)
  );

  return newlyAvailable;
}

// Main
async function main() {
  console.log('🔍 Checking Olympic NP permit availability...\n');

  try {
    const data = await fetchPermitData();
    const sites = parseAvailability(data);
    const timestamp = new Date().toISOString();

    logResults(sites, timestamp);

    // Check for newly available
    let log = [];
    if (fs.existsSync(LOG_FILE)) {
      log = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
    }
    const previousRun = log[log.length - 2];
    const newlyAvailable = sites ? detectCancellations(sites, previousRun) : [];

    console.log(formatTable(sites));

    if (newlyAvailable.length > 0) {
      console.log('🎉 NEWLY AVAILABLE!\n');
      newlyAvailable.forEach(site => {
        console.log(`  ✓ ${site.name} - ${site.zone}`);
      });
      console.log('\n⚡ Act fast! Head to recreation.gov now.\n');
    }

    console.log(`⏰ Last checked: ${new Date(timestamp).toLocaleString()}`);
    console.log(`📊 Logs saved to: ${LOG_FILE}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\nℹ️  Recreation.gov may have anti-bot protection.');
    console.log('   Fallback: Call WIC at (360) 565-3100\n');
    logResults(null, new Date().toISOString());
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
