#!/bin/bash
# Double-clickable: refresh the Current Events data files with live data.
cd "$(dirname "$0")"
node scripts/refresh-current-events.mjs
echo ""
read -n 1 -s -r -p "Press any key to close…"
echo ""
