# Network and Domain Report — OpenSourceHQ Audit

**Inspection Timestamp:** 2026-11-24T21:21:50Z  
**Target Domain:** `https://org.nstsdc.org`

---

## 1. Host Network Topology (`nst-n1`)

| Interface / Route | Observed Value | Confidence | Evidence |
| :--- | :--- | :--- | :--- |
| **Primary NIC (`enp2s0`)** | `192.168.136.145/20` and `192.168.128.10/20` (Campus private LAN) | VERIFIED | `ip -brief addr` |
| **Default Gateway** | `192.168.128.1` via `enp2s0` | VERIFIED | `ip route` |
| **Observed Egress Public IP** | `49.206.122.42` (Campus NAT) | VERIFIED | `curl -s https://api.ipify.org` |
| **Overlay Network (`flannel.1` / `cni0`)** | `10.42.0.1/24` local pod CIDR; Flannel routes for `10.42.1.0/24`..`10.42.11.0/24` | VERIFIED | `ip addr`, `ip route` |
| **Cloudflare WARP (`CloudflareWARP`)** | `100.96.0.3/32` | VERIFIED | `ip addr` |
| **DNS Resolver** | `systemd-resolved` stub `127.0.0.53` | VERIFIED | `/etc/resolv.conf` |

---

## 2. Outbound Internet & Registry Connectivity

| Destination | DNS Resolution | HTTPS Result | Confidence |
| :--- | :--- | :--- | :--- |
| `https://api.github.com` | `20.207.73.85` | HTTP `200` | VERIFIED |
| `https://github.com` | `135.235.149.144` | HTTP `200` | VERIFIED |
| `https://registry.npmjs.org` | IPv6 `2606:4700::6810:*` | HTTP `200` | VERIFIED |
| `https://ghcr.io` | `20.207.73.86` | HTTP `301` | VERIFIED |
| `https://org.nstsdc.org` | `2606:4700:3036::ac43:d89e`, `2606:4700:3033::6815:3b3e` (Cloudflare) | HTTP `404` | VERIFIED |

---

## 3. Ingress, Reverse Proxy, and TLS Findings

| Component | State | Confidence | Evidence |
| :--- | :--- | :--- | :--- |
| **Public Ingress Path** | `org.nstsdc.org` resolves to Cloudflare Edge IPs and is routed over `cloudflared.service` (`2026.11.0`) on `nst-n1`. | VERIFIED | `getent hosts org.nstsdc.org`, `/etc/cloudflared/config.yml` |
| **Why `org.nstsdc.org` Returns `404`** | `/etc/cloudflared/config.yml` routes `nstsdc.org` and `www.nstsdc.org` to `http://localhost:80` and `nst-n1.nstsdc.org` to `ssh://localhost:22`, falling back to `http_status:404` for unlisted hostnames such as `org.nstsdc.org`. | VERIFIED | `grep ... /etc/cloudflared/config.yml` |
| **Host Reverse Proxy (Nginx)** | `nginx/1.28.3` listens on `0.0.0.0:80` / `[::]:80` with `kaizen`, `nstsdc.org`, `querit.nstsdc.org` enabled. Port `443` is NOT listening on `nst-n1`. | VERIFIED | `ss -tuln`, `/etc/nginx/sites-enabled` |
| **Cluster Ingress (Traefik)** | `traefik` process observed running (`ps`), but K3s `Ingress` objects and Traefik service ports are `BLOCKED` (`kubectl` unauthorized). | VERIFIED / BLOCKED | `ps`, `kubectl get ingress -A` |
| **Campus Inbound NAT / Firewall** | Node sits behind campus RFC1918 NAT (`192.168.128.10` -> `49.206.122.42`). Direct inbound ports `80`/`443` from the internet to `49.206.122.42` are `UNKNOWN` (and unnecessary if using Cloudflare Tunnel). | UNKNOWN | `ip addr`, `curl ipify` |
| **TLS Termination & Certbot** | Public TLS for `org.nstsdc.org` is terminated at Cloudflare Edge. Host `certbot.timer` is active, but `/etc/letsencrypt/live` is unreadable (`permission denied`). | VERIFIED / BLOCKED | `systemctl`, `ls -la /etc/letsencrypt/live` |

---

## 4. Recommended Secure Exposure Path

1. **Cloudflare Tunnel + Nginx (Zero Inbound Campus Firewall Changes Needed):** Add a `hostname: org.nstsdc.org` ingress rule in `/etc/cloudflared/config.yml` pointing to `http://localhost:80` (or directly to the K3s Traefik/Service endpoint), and configure an Nginx server block on `nst-n1` (or K3s Ingress) forwarding `Host`, `X-Real-IP`, `X-Forwarded-For`, and `X-Forwarded-Proto: https` to OpenSourceHQ.
2. **Cloudflare SSL Mode:** Ensure Cloudflare SSL/TLS mode is set to **Full** or **Full (Strict)** (if Origin CA cert is placed on Nginx/Traefik) and enable **WebSockets** in Cloudflare if future real-time streams are added.

