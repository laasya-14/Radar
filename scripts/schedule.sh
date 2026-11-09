#!/bin/bash
# Install / remove the macOS LaunchAgents that keep Radar running:
#   com.radar.pipeline  collects + scores at 07:00 and 19:00; builds a digest every ~2 days
#   com.radar.web       serves the UI at http://localhost:4747 (always on)
# Usage: scripts/schedule.sh install | uninstall | status
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
AGENTS="$HOME/Library/LaunchAgents"
PATH_VALUE="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
mkdir -p "$DIR/data/logs" "$AGENTS"

plist_pipeline() {
cat <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.radar.pipeline</string>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>-lc</string><string>npm run pipeline</string></array>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>$PATH_VALUE</string><key>RADAR_LOG</key><string>data/logs/pipeline.log</string></dict>
  <key>StartCalendarInterval</key><array>
    <dict><key>Hour</key><integer>7</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>19</integer><key>Minute</key><integer>0</integer></dict>
  </array>
  <key>StandardOutPath</key><string>$DIR/data/logs/pipeline.log</string>
  <key>StandardErrorPath</key><string>$DIR/data/logs/pipeline.log</string>
</dict></plist>
EOF
}

plist_web() {
cat <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.radar.web</string>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>-lc</string><string>npm run start</string></array>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>$PATH_VALUE</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$DIR/data/logs/web.log</string>
  <key>StandardErrorPath</key><string>$DIR/data/logs/web.log</string>
</dict></plist>
EOF
}

case "${1:-}" in
  install)
    (cd "$DIR" && npm run build >/dev/null)
    for name in pipeline web; do
      f="$AGENTS/com.radar.$name.plist"
      launchctl bootout "gui/$(id -u)/com.radar.$name" 2>/dev/null || true
      for _ in 1 2 3 4 5; do launchctl print "gui/$(id -u)/com.radar.$name" >/dev/null 2>&1 || break; sleep 1; done
      "plist_$name" > "$f"
      launchctl bootstrap "gui/$(id -u)" "$f"
    done
    echo "Installed. UI: http://localhost:4747 — pipeline runs at 07:00 and 19:00."
    TS=/Applications/Tailscale.app/Contents/MacOS/Tailscale
    if [ -x "$TS" ]; then
      "$TS" serve --bg --https=4747 http://127.0.0.1:4747 >/dev/null && echo "Tailnet: https://$("$TS" status --json | /usr/bin/python3 -c 'import json,sys;print(json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))'):4747"
    fi
    ;;
  uninstall)
    /Applications/Tailscale.app/Contents/MacOS/Tailscale serve --https=4747 off 2>/dev/null || true
    for name in pipeline web; do
      launchctl bootout "gui/$(id -u)/com.radar.$name" 2>/dev/null || true
      rm -f "$AGENTS/com.radar.$name.plist"
    done
    echo "Removed."
    ;;
  status)
    launchctl list | grep com.radar || echo "not installed"
    ;;
  *) echo "usage: $0 install | uninstall | status"; exit 1 ;;
esac
