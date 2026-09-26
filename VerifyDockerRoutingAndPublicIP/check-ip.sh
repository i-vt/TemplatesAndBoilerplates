#!/bin/sh
# Prints everything needed to decide whether THIS container's egress
# traffic follows the host's WireGuard tunnel.
set -u

NAME="${TEST_NAME:-container}"

echo "============================================================"
echo " IP test: $NAME"
echo "============================================================"

echo ">> Container interface addresses:"
ip -4 addr show | awk '/inet /{print "   " $2 " on " $NF}'

echo ">> Default route inside container:"
ip route show default | sed 's/^/   /' || echo "   (none)"

echo ">> Resolver(s) in use:"
awk '/^nameserver/{print "   " $2}' /etc/resolv.conf

get_public_ip() {
  for url in https://ifconfig.me https://icanhazip.com https://checkip.amazonaws.com https://ipinfo.io/ip; do
    ip=$(curl -4 -sS --max-time 8 "$url" 2>/dev/null | tr -d '[:space:]')
    if [ -n "$ip" ]; then
      echo "$ip"
      return 0
    fi
  done
  return 1
}

echo ">> Egress (public) IPv4 seen from THIS container:"
if PUB=$(get_public_ip); then
  echo "   $PUB"
  echo ">> Who owns that IP (ipinfo.io):"
  curl -4 -sS --max-time 8 "https://ipinfo.io/$PUB/json" 2>/dev/null \
    | jq -r '"   \(.ip)  |  \(.org)  |  \(.city), \(.country)"' 2>/dev/null || true
else
  echo "   FAILED to determine public IP (check DNS / connectivity)"
fi
echo
