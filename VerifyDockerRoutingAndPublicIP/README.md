# WireGuard / Docker egress-IP test

A minimal project to answer: **"Does my Docker container's traffic go through
the host's WireGuard tunnel?"** — by printing the public egress IP seen from
inside containers using different network modes, and comparing it with the host.

## Does Docker respect WireGuard? (background)

| Container network mode | Follows the host's WireGuard? | Why |
|---|---|---|
| `bridge` (default) | **Yes, in most setups** | Egress is forwarded + masqueraded by the host, so the host's routing policy database decides. `wg-quick`'s rules (`ip rule add not fwmark <mark> table <n>`) match forwarded packets too, so a full tunnel (`AllowedIPs = 0.0.0.0/0`) carries container traffic. With split-tunnel `AllowedIPs`, only matching destinations use the tunnel. |
| `host` | **Yes** | The container shares the host's network namespace — identical behavior to the host. |
| `macvlan` / `ipvlan` | **No** | Traffic leaves directly via the parent interface, bypassing host routing and NAT. Host WireGuard never sees it. |
| WireGuard as a sidecar container (e.g. gluetun) | Only for containers joined to it via `network_mode: service:<wg>` | Other containers keep their own (unaffected) networking. |

Caveats:

- **Policy rules that match only local traffic** (e.g. `ip rule from <host-lan-ip>`,
  owner/cgroup-based routing) exclude forwarded container traffic — containers then
  bypass the tunnel.
- **DNS can leak** even when traffic is tunneled: containers use Docker's embedded
  resolver (127.0.0.11) which forwards to the host's resolvers. Pin a resolver in
  compose (`dns: [9.9.9.9]`) if that matters.
- **Inbound published ports can break** when a full tunnel is up: replies from the
  container get policy-routed into the tunnel (asymmetric path). Classic fix in the
  wg-quick config:
  ```
  PostUp   = ip rule add from 172.17.0.0/16 lookup main priority 100
  PreDown  = ip rule del from 172.17.0.0/16 lookup main priority 100
  ```
  (adjust to your docker bridge subnet; use a separate rule per LAN source range
  you need to keep working).
- **MTU**: WireGuard links usually have MTU 1420, docker0 defaults to 1500.
  Symptoms are hangs/stalls on some sites, not a wrong IP. Fix by setting
  `"mtu": 1420` in `/etc/docker/daemon.json` (or per-network in compose).

## Files

- `docker-compose.yml` — two services: `bridge-test` (default NAT networking) and
  `host-test` (`network_mode: host`, the control). A commented gluetun-style
  sidecar example is included.
- `Dockerfile` — Alpine + curl/jq/iproute2/dig.
- `check-ip.sh` — container entrypoint: prints interfaces, default route,
  resolvers, and the public egress IP (with org/location from ipinfo.io).
- `run-test.sh` — host-side driver: shows WireGuard status, host egress IP, then
  runs both container tests.

## Usage

```bash
# 1. Baseline with the tunnel DOWN
sudo wg-quick down wg0
./run-test.sh          # note the IPs (your ISP address everywhere)

# 2. Tunnel UP
sudo wg-quick up wg0
./run-test.sh          # compare
```

Quick one-liner alternative (no project needed):

```bash
docker run --rm curlimages/curl -s https://ifconfig.me; echo
```

## Reading the results

- `bridge-test` IP **== the host's WG IP** → containers follow the tunnel. ✅
- `bridge-test` IP **== your ISP IP** while the host shows the VPN IP →
  containers bypass the tunnel: check `ip rule` / `ip route` on the host and your
  `AllowedIPs` scope.
- `host-test` should **always** match the host — it's the control. If it doesn't,
  the test environment itself is off (proxy, multiple interfaces, etc.).
- If `bridge-test` shows the VPN IP but the **org/location** still looks like your
  ISP's DNS region, you have a DNS leak, not a routing leak.

If containers bypass a full-tunnel wg-quick setup, the usual cause is custom
policy routing that only covers locally generated traffic; make sure your rules
don't restrict matching to `from <host-ip>` or to the `lo` interface.
