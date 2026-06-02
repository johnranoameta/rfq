# Word extraction on Amazon Linux EC2 (same server)

The app can run extraction on **Linux EC2** without Microsoft Word, using:

- **LibreOffice headless** — converts `.doc` → `.docx` for body text and tables
- **python-docx** — reads converted `.docx`
- **olefile** — pulls PDF payloads from legacy `.doc` ObjectPool

Windows still uses **Word COM** (full GM embed fidelity). Linux is a **best-effort** path on one server.

## One-time server setup

```bash
# LibreOffice (required)
sudo dnf install -y libreoffice-headless libreoffice-writer

# Verify
which soffice || which libreoffice
soffice --version

cd /home/ec2-user/files/rfq/rfq-ui
git pull origin main

# Python deps (no pywin32 on Linux)
python3 -m pip install -r word-extract/requirements-linux.txt

# App env
cat >> .env.local << 'EOF'
RFQ_PYTHON=python3
EOF

npm ci
npm run build
pm2 restart rfq-ui
```

Optional: `RFQ_SOFFICE=/usr/bin/soffice` if not on PATH for the Node process.

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
| `LibreOffice not found` | `sudo dnf install libreoffice-headless`; set `RFQ_SOFFICE` |
| `No module named 'docx'` | `pip install -r word-extract/requirements-linux.txt` |
| `export_skipped` in JSON | Expected on Linux for some OLE embeds; PDFs still extract |
