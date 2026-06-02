# Word extraction on Amazon Linux EC2 (same server)

The app can run extraction on **Linux EC2** without Microsoft Word, using:

- **LibreOffice headless** — converts `.doc` → `.docx` for body text and tables
- **python-docx** — reads converted `.docx`
- **olefile** — pulls PDF payloads from legacy `.doc` ObjectPool

Windows still uses **Word COM** (full GM embed fidelity). Linux is a **best-effort** path on one server.

## One-time server setup

```bash
cd /home/ec2-user/files/rfq/rfq-ui
git pull origin main

# Amazon Linux 2023 has NO libreoffice in dnf — script downloads official RPMs (~300MB)
bash scripts/ec2-install-libreoffice.sh .env.local

# Manual docs: https://docs.aws.amazon.com/linux/al2023/ug/al2023-libreoffice.html
# After RPM install, soffice is usually: /opt/libreoffice25.2/program/soffice

# Python deps (no pywin32 on Linux)
python3 -m pip install -r word-extract/requirements-linux.txt

# App env (if not already set)
grep -q '^RFQ_PYTHON=' .env.local 2>/dev/null || echo 'RFQ_PYTHON=python3' >> .env.local

npm ci
npm run build
pm2 restart rfq-ui
```

Verify on the **remote server** (SSH):

```bash
/usr/lib/libreoffice/program/soffice --version
grep RFQ_ /home/ec2-user/files/rfq/rfq-ui/.env.local
curl -s http://127.0.0.1:3000/api/extraction/preflight | python3 -m json.tool
```

`preflight` should show `"ready": true` and `python_find_soffice.stdout` with the soffice path.

## Limits on Linux (same server)

| Feature | Windows COM | Linux LibreOffice |
|---------|-------------|-------------------|
| Legacy `.doc` body/sections | Full | Via DOCX conversion |
| PDF embeds from ObjectPool | Full | Yes |
| Excel/Word OLE embeds repack | Full | Often skipped |
| Nested embedded `.doc` via Word | Full | Partial |

For **full** GM package parity, run extraction on a Windows machine and sync `word-extract/output/` — or accept Linux partial results.

## Troubleshooting

| Error | Fix |
|-------|-----|
| `LibreOffice not found` | Run `bash scripts/ec2-install-libreoffice.sh` (RPM install on AL2023) |
| `No match for argument: libreoffice` | Normal on AL2023 — use the install script, not raw `dnf install libreoffice` |
| `No module named 'docx'` | `pip install -r word-extract/requirements-linux.txt` |
| `export_skipped` in JSON | Expected on Linux for some OLE embeds; PDFs still extract |
