#!/usr/bin/env bash
# Sets up and starts Veritrace on an Ubuntu EC2 instance (see docs/deployment.md).
# Run it again after a `git pull` to rebuild and restart with the new code.
#
#   deploy/ec2/setup.sh                  serve at https://<public-ip-with-dashes>.sslip.io
#   deploy/ec2/setup.sh my.duckdns.org   serve at another hostname that points here
#   deploy/ec2/setup.sh :80              plain HTTP, no certificate
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
die() { echo "setup.sh: $*" >&2; exit 1; }

[[ -f "$ROOT/backend/.env" ]] || die "backend/.env is missing; copy it here with scp (docs/deployment.md, step 4)."

if ! command -v docker >/dev/null; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi
DOCKER=(docker)
docker info >/dev/null 2>&1 || DOCKER=(sudo docker) # group membership applies from the next login

# Swap, so a memory spike slows the backend down instead of killing it.
if ! swapon --show | grep -q .; then
  echo "Adding 2 GB of swap..."
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

# Pull and rebuild at every boot (deploy/ec2/update.sh).
unit=/etc/systemd/system/veritrace-update.service
wanted="$(sed -e "s|^User=USER|User=$USER|" -e "s|REPO/|$ROOT/|" "$HERE/veritrace-update.service")"
if [[ "$(cat "$unit" 2>/dev/null)" != "$wanted" ]]; then
  echo "$wanted" | sudo tee "$unit" >/dev/null
  sudo systemctl daemon-reload
  sudo systemctl enable veritrace-update.service >/dev/null 2>&1
fi

SITE="${1:-}"
if [[ -z "$SITE" ]]; then
  # The instance metadata service (IMDSv2) knows the public IP, which should be an Elastic IP.
  token="$(curl -fsS -X PUT http://169.254.169.254/latest/api/token \
    -H 'X-aws-ec2-metadata-token-ttl-seconds: 60')" || die "not on EC2; pass the hostname as an argument."
  ip="$(curl -fsS -H "X-aws-ec2-metadata-token: $token" \
    http://169.254.169.254/latest/meta-data/public-ipv4)" || die "the instance has no public IP; attach an Elastic IP."
  SITE="${ip//./-}.sslip.io"
fi
echo "SITE_ADDRESS=$SITE" > "$HERE/.env"

echo "Building and starting (the first build takes about 15 minutes)..."
cd "$HERE"
"${DOCKER[@]}" compose up -d --build
"${DOCKER[@]}" image prune -f >/dev/null # old images from earlier builds fill the disk

if [[ "$SITE" == :* ]]; then url="http://localhost${SITE#:80}"; else url="https://$SITE"; fi
echo
echo "Veritrace is starting at $url"
echo "The backend takes about a minute to load its models. Logs: cd deploy/ec2 && docker compose logs -f"
