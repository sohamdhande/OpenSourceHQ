# Backup and Disaster Recovery Audit — OpenSourceHQ

**Inspection Timestamp:** 2026-11-24T21:21:50Z  
**Target Objectives:** RPO = 15 minutes | RTO = 4 hours

---

## 1. Discovered Backup & Storage Infrastructure

| Resource | Observed State | Confidence | Evidence |
| :--- | :--- | :--- | :--- |
| **Local Disk (`nst-n1`)** | Single NVMe `/dev/nvme0n1p2` (`233G` total, `124G` free). No RAID/mirroring visible (`lsblk`). | VERIFIED | `lsblk`, `df -hT` |
| **NAS / NFS / External Mounts** | None mounted under `/mnt` or `/media` | VERIFIED | `mount`, `ls -la /mnt /media` |
| **Off-Site Sync Service (`rclone`)** | `rclone.service` is `active running` on `nst-n1`. Destination, bucket, capacity, and credentials are unreadable to user `soham`. | VERIFIED / BLOCKED | `systemctl list-units` |
| **Cluster `/srv/files`** | Directory `/srv/files` owned by `clusteradmin` (`drwx------`), inaccessible to `soham`. | BLOCKED | `ls -la /srv` |
| **Automated PostgreSQL Backups** | No PostgreSQL backup scripts observed in `/etc/cron.d`, `/etc/cron.daily`, or `/etc/cron.weekly`. | VERIFIED | `ls -la /etc/cron.*` |

---

## 2. RPO / RTO Feasibility Assessment

| Objective | Target | Can Current Infrastructure Meet Target? | Gap Explanation |
| :--- | :--- | :--- | :--- |
| **RPO (15 minutes)** | Max 15 min data loss | **NO (Gap)** | No WAL archiving (`archive_mode = off`), no 15-minute incremental snapshot/WAL push, and no verified off-site object storage destination accessible to OpenSourceHQ. |
| **RTO (4 hours)** | Full service restoration < 4h | **PARTIAL / AT RISK** | Single NVMe disk on `nst-n1` is a single point of failure. Restoring from a hardware failure requires provisioning a new host, PostgreSQL 18, Nginx/`cloudflared` config, and restoring dumps from off-site storage. |

---

## 3. Recommended Backup & DR Architecture

1. **Daily Full PostgreSQL Backups:** Automated `pg_dump -Fc` (custom compressed format) or `pgBackRest` full backup daily at `02:00 UTC`, encrypted with `age` or GPG/SSE-KMS before leaving the node.
2. **Continuous WAL Archiving (for 15-min RPO):** Enable `wal_level = replica`, `archive_mode = on`, and `archive_timeout = 900` (15 minutes) pushing encrypted WAL segments via `pgBackRest` or `wal-g` to S3-compatible off-site object storage (e.g., Cloudflare R2 / institutional S3 / NAS) using dedicated write-only-append IAM credentials.
3. **Config & Migration Artifacts:** Store encrypted `.env` secrets in a password manager / K8s SealedSecrets/ExternalSecrets vault, and keep `prisma/migrations/` + deployment manifests in version-controlled Git.
4. **Retention Policy:** 7 daily full backups + 4 weekly backups + 3 monthly backups; WAL retention matching 7-day PITR window.
5. **Verification:** Automated weekly restore test into an isolated temporary PostgreSQL database (`pg_restore` + row-count/schema sanity check) with failure alerting.

