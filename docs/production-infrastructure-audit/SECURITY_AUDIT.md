# Security Audit — OpenSourceHQ College Cluster

**Inspection Timestamp:** 2026-11-24T21:21:50Z  
**Audit Mode:** Read-Only (No privilege escalation, no secret dumping)

---

## 1. Host & Access Control Findings

| Control | Observed State | Confidence | Evidence |
| :--- | :--- | :--- | :--- |
| **SSH Password Auth** | Disabled (`PasswordAuthentication no`, `KbdInteractiveAuthentication no`) | VERIFIED | `/etc/ssh/sshd_config`, `10-nst-cockpit.conf` |
| **SSH Public Key Auth** | Enabled (`PubkeyAuthentication yes`) | VERIFIED | `10-nst-cockpit.conf` |
| **SSH Root Login** | Disabled (`PermitRootLogin no`) | VERIFIED | `10-nst-cockpit.conf` |
| **Brute-Force Protection** | `fail2ban.service` active & running (`fail2ban-client status` requires root) | VERIFIED / BLOCKED | `systemctl`, `fail2ban-client` |
| **Host Firewall (`ufw`)** | `ufw.service` active & enabled (rules require root to inspect) | VERIFIED / BLOCKED | `systemctl`, `ufw status` |
| **Kernel / System Auditing** | `auditd.service` active & running | VERIFIED | `systemctl` |
| **Automatic Security Patching** | `unattended-upgrades.service` active & running | VERIFIED | `systemctl` |
| **Multi-User Shared Host** | Multiple student/admin users (`soham`, UID `1015`, `1042`, `prabhav`, `codemaverick`, `purple`) share `nst-n1` | VERIFIED | `systemctl` (`user@*`), `/opt`, `mount` |

---

## 2. Kubernetes & Secrets Isolation Findings

| Control | Observed State | Confidence | Evidence |
| :--- | :--- | :--- | :--- |
| **Kubeconfig Access** | `/etc/rancher/k3s/k3s.yaml` is root-only; user `~/.kube/config` is unauthorized/expired | VERIFIED | `kubectl auth can-i --list` |
| **RBAC / Namespace Isolation / NetworkPolicies** | Cannot be verified without authorized cluster-reader kubeconfig | BLOCKED | `kubectl` unauthorized |
| **Secrets Management** | No Vault/ExternalSecrets observed on host; K8s Secrets encryption-at-rest state `UNKNOWN` | UNKNOWN | `systemctl`, `kubectl` blocked |
| **Disk Encryption (LUKS)** | Root partition `/dev/nvme0n1p2` is unencrypted `ext4` directly on NVMe (no `crypt` layer in `lsblk`) | VERIFIED | `lsblk` |

---

## 3. Mandatory Security Controls Before Production

1. **Dedicated Service User / Isolated K8s Namespace:** OpenSourceHQ must run under a dedicated non-root UID/namespace (`opensourcehq`) with strict file permissions (`chmod 600` on env files) so other shell users on `nst-n1` (`nst-students`) cannot read `AUTH_SECRET`, `APP_ENCRYPTION_KEY`, `DATABASE_URL`, or `GITHUB_APP_PRIVATE_KEY`.
2. **Database Network & Role Isolation:** Create a dedicated PostgreSQL role `opensourcehq_app` with access restricted to the `opensourcehq` database only, enforcing `scram-sha-256` and TLS (`sslmode=require`).
3. **Firewall Verification:** Confirm with college IT (`sudo ufw status`) that ports `5432` (PostgreSQL), `3306` (MySQL), `27017` (MongoDB), `6443` (K3s API), and `11434` (Ollama) are NOT exposed to untrusted public interfaces.
4. **Secret Rotation & Non-Prod Separation:** Generate fresh 32+ character `AUTH_SECRET`, `APP_ENCRYPTION_KEY`, `CRON_SECRET`, and `GITHUB_WEBHOOK_SECRET` distinct from any local development `.env`.
5. **Cloudflare Origin Protection:** Ensure Nginx/Traefik only accepts traffic from `cloudflared` (`127.0.0.1`) or Cloudflare IP ranges so attackers cannot bypass Cloudflare WAF/DDoS protection.

