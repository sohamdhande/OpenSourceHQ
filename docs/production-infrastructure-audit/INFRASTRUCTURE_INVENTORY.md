# Infrastructure Inventory — OpenSourceHQ College Cluster Audit

**Inspection Timestamp:** 2026-11-24T21:21:50Z (2026-11-25T02:51:50+05:30 IST)  
**Target SSH Endpoint:** `ssh nst` (`nst-n1`, authenticated as non-root user `soham`, uid `1040`)  
**Audit Mode:** Strictly Read-Only

---

## 1. Host & Topology Summary

| Attribute | Value | Confidence | Evidence / Command |
| :--- | :--- | :--- | :--- |
| **Hostname** | `nst-n1` | VERIFIED | `hostname -f` |
| **Environment Type** | Physical bare-metal server (`systemd-detect-virt` = `none`) acting as a K3s control-plane/server node + shared host services | VERIFIED | `systemd-detect-virt`, `systemctl list-units`, `ps` |
| **Operating System** | Ubuntu 26.04.1 LTS (Resolute Raccoon) | VERIFIED | `cat /etc/os-release` |
| **Kernel** | `Linux 7.0.0-43-generic #43-Ubuntu SMP PREEMPT_DYNAMIC x86_64` | VERIFIED | `uname -a` |
| **Uptime & Load** | Up 1 day, 15:14; load avg `1.01, 0.83, 0.68` | VERIFIED | `uptime` |
| **Multi-Node Topology** | Multi-node K3s cluster inferred from Flannel VXLAN routes (`10.42.0.0/24` through `10.42.11.0/24`, `flannel.1`) and Rancher Fleet (`fleetagent`, `fleetcontroller`) | INFERRED | `ip route`, `ps -eo ... comm` |
| **K3s Cluster Internals** | Exact node count, worker specs, pods, namespaces, and PVCs could not be read (`kubectl` unauthorized / `/etc/rancher/k3s/k3s.yaml` permission denied) | BLOCKED | `kubectl get nodes`, `kubectl auth can-i --list` |
| **Shared Workload Status** | Shared with existing college/student workloads: `nginx` (`kaizen.nstsdc.org`, `querit.nstsdc.org`, `nstsdc.org`), `mysql`, `mongod`, `ollama`, `judge0`, `minepanel`, `nst-sandbox`, and K3s/Fleet/GPU workloads | VERIFIED | `/etc/nginx/sites-enabled`, `/opt`, `systemctl list-units`, `ps` |

---

## 2. Compute & Memory Capacity (`nst-n1`)

| Resource | Specification / Current State | Confidence | Evidence |
| :--- | :--- | :--- | :--- |
| **CPU Model** | Intel(R) Core(TM) i7-7700 CPU @ 3.60GHz (1 socket, 4 cores, 8 threads) | VERIFIED | `lscpu` |
| **RAM Capacity** | 14 GiB total (`5.5Gi` used, `5.5Gi` free, `4.3Gi` buff/cache, `9.5Gi` available) | VERIFIED | `free -h` |
| **Swap** | `4.0Gi` total (`0B` used) | VERIFIED | `free -h` |
| **Top Memory Consumers** | `k3s-server` (`19.1%` RAM, `41.4%` CPU), `warp-svc` (`4.6%`), `mysqld` (`3.3%`), `mongod` (`1.5%`), `containerd` (`1.2%`) | VERIFIED | `ps -eo user,pid,%cpu,%mem,comm --sort=-%mem` |
| **Other K3s Worker Nodes** | Allocatable CPU/RAM, pod limits, and eviction events on other nodes | BLOCKED | `kubectl top nodes` / `kubectl get nodes` unauthorized |

---

## 3. Storage & Filesystems (`nst-n1`)

| Mount / Device | Type | Size | Used | Available | Use% | Confidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/` (`/dev/nvme0n1p2`) | `ext4` | `233G` | `98G` | `124G` | `45%` | VERIFIED (`df -hT`) |
| `/boot/efi` (`/dev/nvme0n1p1`) | `vfat` | `1.1G` | `16M` | `1.1G` | `2%` | VERIFIED (`df -hT`) |
| External/NAS Mounts (`/mnt`, `/media`) | None mounted | — | — | — | — | VERIFIED (`mount`, `ls -la /mnt /media`) |
| K3s StorageClasses & PVCs | Cluster storage classes and persistent volumes | — | — | — | — | BLOCKED (`kubectl get sc,pv,pvc` unauthorized) |

---

## 4. Installed Runtimes & Services

| Component | Version / Status | Confidence | Evidence |
| :--- | :--- | :--- | :--- |
| **K3s** | `v1.36.5+k3s1` (`go1.26.8`), `k3s.service` active & enabled | VERIFIED | `k3s --version`, `systemctl is-active k3s` |
| **Helm** | `v4.0.4+g8650e1d` | VERIFIED | `helm version --short` |
| **Node.js** | `v22.22.1` (`/usr/bin/node`) | VERIFIED | `node -v` |
| **PostgreSQL** | `18.6` (`postgresql@18-main.service` active & enabled, listening on `127.0.0.1:5432`) | VERIFIED | `psql --version`, `pg_isready`, `ss -tuln` |
| **Nginx** | `nginx/1.28.3` (`nginx.service` active & enabled, listening on `*:80`) | VERIFIED | `nginx -v`, `ss -tuln` |
| **Cloudflare Tunnel** | `cloudflared 2026.11.0` (`cloudflared.service` active & enabled) | VERIFIED | `cloudflared --version`, `systemctl` |
| **Cloudflare WARP** | `warp-svc.service` active & enabled (`CloudflareWARP` `100.96.0.3/32`) | VERIFIED | `ip -brief addr`, `systemctl` |
| **Other Databases / AI** | `mysql.service`, `mongod.service`, `ollama.service` active & running | VERIFIED | `systemctl list-units`, `ss -tuln` |
| **Docker** | Not installed on host (`containerd` managed by K3s) | VERIFIED | `command -v docker`, `ps` |

