# Olympic NP Permit Checker - Aug 14-17, 2026

## Quick Start (2 min)

```bash
# Make executable
chmod +x scripts/olympic-permit-checker.js
chmod +x scripts/run-permit-checker.sh

# Run single check
node scripts/olympic-permit-checker.js

# Run automated checks every 2 hours
bash scripts/run-permit-checker.sh
```

## What It Does

✅ Checks recreation.gov for Olympic NP wilderness permits  
✅ Extracts Aug 14-17 availability  
✅ Highlights available sites + walk-up options  
✅ Logs results + detects newly-available campsites  
✅ Mobile-ready 72-char output  

## Output Example

```
📍 OLYMPIC NP PERMITS - Aug 14-17, 2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ZONE | CAMPSITE | 8/14 | 8/15 | 8/16 | 8/17
─────────────────────────────────────────────────────────────────
Sol Duc  | Deer Lake         | ✓ | ✓ | ✓ | ✓
Sol Duc  | High Divide       | ✗ | ✗ | ✗ | ✗
Staircase| Flapjack Lakes    | W | W | W | ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ = Available  |  W = Walk-up  |  ✗ = Sold Out
```

## Zones Checked (Priority Order)

1. **Sol Duc** - High Divide/Seven Lakes (BEST ALPINE LAKES)
2. **Staircase** - Flapjack Lakes (EASIER ACCESS)
3. **Dosewallips** - Lake Constance (ACCESSIBLE)
4. **Coastal** - Third Beach/Oil City (VARIETY)

## Logs

- **Location**: `.permits-log.json`
- **Keeps**: Last 100 checks
- **Tracks**: Availability history + newly-available sites
- **Format**: JSON (queryable)

## If Scraping Fails

Recreation.gov blocks automated access. Fallback options:

### Option A: Call WIC (Fastest)
**Wilderness Information Center**  
📞 (360) 565-3100  
🕐 Mon-Fri 9am-4pm PT  
💬 Ask about Aug 14-17 availability for 2-person group, lake campsites

### Option B: Check Manually
Visit https://recreation.gov/permits/4098362  
Select August → Filter dates → Check availability calendar

### Option C: Use Browser DevTools
1. Open recreation.gov in Chrome
2. Open DevTools (F12) → Network tab
3. Run checker again to capture API calls
4. Update `olympic-permit-checker.js` with new endpoints

## For Route Planning

Once you have availability data, provide me with:
- Available campsites (name + zone)
- Available dates for each
- Any walk-up options

I'll instantly plan an optimal route with:
- Daily mileage
- Elevation gain
- Water sources + facilities
- Permit cost calculation
- Trip prep checklist

## Advanced: Scheduled Runs

### macOS/Linux (cron)
```bash
# Edit crontab
crontab -e

# Add this line (runs every 2 hours)
0 */2 * * * cd /path/to/my-client-site && node scripts/olympic-permit-checker.js >> .permits-logs/cron.log 2>&1
```

### Windows (Task Scheduler)
1. Open Task Scheduler
2. Create Basic Task → "Permit Checker"
3. Trigger: Every 2 hours
4. Action: `C:\Program Files\nodejs\node.exe` 
5. Arguments: `C:\path\to\scripts\olympic-permit-checker.js`

## Troubleshooting

**"No data available"**
- recreation.gov API may have changed
- Try manual check or call WIC
- Check `.permits-log.json` for error details

**"Connection timeout"**
- Add backoff/retry logic (see `req.setTimeout`)
- Try running during off-peak hours (6am-10am PT)

**"User-Agent blocked"**
- recreation.gov may block specific agents
- Try a different User-Agent string in script

## Contact

For current availability outside automation:  
**Wilderness Information Center**  
📞 (360) 565-3100  
🌐 nps.gov/olym  
📧 olym_wilderness@nps.gov

---

**Next Steps:**
1. Run checker: `node scripts/olympic-permit-checker.js`
2. Share available campsites with me
3. I'll plan your optimal 3-night route
