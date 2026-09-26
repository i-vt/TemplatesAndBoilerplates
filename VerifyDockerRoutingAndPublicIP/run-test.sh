#!/usr/bin/env bash
# Run this ON THE DOCKER HOST. It compares the egress IP seen by:
#   1) the host itself
#   2) a default bridge container
#   3) a host-network container (control)
#
# Run it once with WireGuard UP and once with it DOWN, then compare:
#   sudo wg-quick down wg0   ->   ./run-test.sh   (baseline: ISP IP)
#   sudo wg-quick up wg0     ->   ./run-test.sh   (does bridge-test follow?)
set -u
cd "$(dirname "$0")"

host_ip() {
  for url in https://ifconfig.me https://icanhazip.com https://checkip.amazonaws.com; do
    ip=$(curl -4 -sS --max-time 8 "$url" 2>/dev/null | tr -d '[:space:]')
    [ -n "$ip" ] && { echo "$ip"; return; }
  done
  echo "unknown"
}

echo "== WireGuard status =="
if command -v wg >/dev/null 2>&1 && [ -n "$(wg show interfaces 2>/dev/null)" ]; then
  echo "   UP on interface(s): $(wg show interfaces | tr '\n' ' ')"
else
  echo "   no WireGuard interface up (or wireguard-tools not installed)"
fi

echo
echo "== Host egress IPv4: $(host_ip)"
echo

echo "== Container: default bridge =="
docker compose run --rm bridge-test

echo "== Container: host network (control) =="
docker compose run --rm host-test

echo
echo "Interpretation:"
echo "  - bridge-test IP == host IP with WG up   -> containers follow the tunnel"
echo "  - bridge-test IP == your ISP IP while host shows the VPN IP"
echo "    -> containers bypass the tunnel (check your ip rules / AllowedIPs)"
