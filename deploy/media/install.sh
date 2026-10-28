#!/bin/sh
set -eu
# Run as root with this directory as the current directory after inspecting the diff.
id robot-media >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin --gid caddy robot-media
install -d -m 755 /opt/robot-learning/media-service
install -d -m 750 -o robot-media -g caddy /opt/robot-learning/media
for subdir in videos tmp metadata; do
  install -d -m 750 -o robot-media -g caddy "/opt/robot-learning/media/$subdir"
done
install -m 644 server.mjs /opt/robot-learning/media-service/server.mjs
install -m 644 robot-media.service /etc/systemd/system/robot-media.service
install -m 644 routes.caddy /etc/caddy/snippets/robot-media.caddy
backup="/opt/robot-learning/caddy-before-video-$(date +%Y%m%d%H%M%S)"
cp -p /etc/caddy/Caddyfile "$backup"
python3 - <<'PY'
from pathlib import Path
p = Path('/etc/caddy/Caddyfile')
s = p.read_text()
marker = 'www.nlearn.net {\n'
addition = '    import /etc/caddy/snippets/robot-media.caddy\n'
if addition not in s:
    if s.count(marker) != 1:
        raise SystemExit('Expected one existing HTTPS site; refusing to change config')
    s = s.replace(marker, marker + addition, 1)
frame_rule = '    @nonReportFrames not path /robot-media/reports/*\n    header @nonReportFrames X-Frame-Options DENY\n'
if frame_rule not in s:
    original = '        X-Frame-Options DENY\n'
    if s.count(marker) != 1 or s.count(original) != 1:
        raise SystemExit('Expected one existing frame restriction; refusing to change config')
    s = s.replace(original, '', 1).replace(marker, marker + frame_rule, 1)
p.write_text(s)
PY
if ! caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile; then
  cp -p "$backup" /etc/caddy/Caddyfile
  exit 1
fi
systemctl daemon-reload
systemctl enable robot-media
systemctl restart robot-media
systemctl reload caddy
systemctl is-active robot-media caddy robot-learning
