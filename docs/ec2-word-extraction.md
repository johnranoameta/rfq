# Running Word RFQ extraction on AWS EC2 (Windows Server)

GM-style RFQ packages (legacy `.doc` with embedded PDF/Excel/Word) use **Microsoft Word and Excel COM** (`pywin32` / `pythoncom`). Use a **Windows Server** EC2 instance — Amazon Linux cannot run this extractor.

## Supported production layout

Use a **Windows Server EC2** instance as the app + extraction host (single box is simplest).

| Component | Requirement |
|-----------|-------------|
| OS | Windows Server 2019/2022 |
| Microsoft Office | Word + Excel (desktop, licensed) |
| Python | 3.9+ (`py` launcher or `python`) |
| Node.js | 20+ for `rfq-ui` |
| Repo | `git clone` → `rfq-ui` includes bundled `word-extract/` |

Linux EC2 is fine for **other** parts of the stack only if you split architecture (see below). The extraction API must execute on Windows for full fidelity.

## Windows EC2 setup (summary)

1. Launch **Windows Server** EC2 (e.g. `t3.large` or larger; extraction is CPU/RAM heavy).
2. Open security group: HTTP/HTTPS (3000 or 80/443 behind reverse proxy), RDP for admin.
3. RDP into the instance.
4. Install **Microsoft Office** (Word + Excel).
5. Install **Python 3** and **Node.js 20+**.
6. Clone and build:

   ```powershell
   cd C:\apps
   git clone https://github.com/johnranoameta/rfq.git rfq-ui
   cd rfq-ui
   py -m pip install -r word-extract\requirements.txt
   npm ci
   npm run build
   ```

7. Create `.env.local`:

   ```env
   RFQ_PYTHON=py
   OPENAI_API_KEY=your-key
   ```

   `RFQ_ENGINE_ROOT` is optional; defaults to `word-extract` inside the repo.

8. Run production server:

   ```powershell
   npm run start
   # or: npx pm2 start ecosystem.config.cjs --env production
   ```

9. Smoke test CLI:

   ```powershell
   cd word-extract
   py extract_rfq.py C:\path\to\sample.doc -o output --normalize
   ```

## Environment variables

| Variable | Windows EC2 | Notes |
|----------|---------------|-------|
| `RFQ_PYTHON` | `py` or full path to `python.exe` | Required if `py` is not on PATH for the Node process |
| `RFQ_ENGINE_ROOT` | Optional | Defaults to `<repo>/word-extract` |
| `RFQ_OUTPUT_DIR` / `RFQ_UPLOADS_DIR` | Optional | Override output/upload dirs |

## Optional: Linux front-end + Windows worker

If you must keep a **Linux** EC2 for the public website:

- Linux: Next.js UI + static/API except extraction.
- Windows EC2 (private subnet): runs `extract_rfq.py` only; share `word-extract/output` and `uploads` via EFS/S3 or an internal HTTP job API.

That still means extraction runs on **Windows EC2**, not on Linux.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `spawn py ENOENT` | Set `RFQ_PYTHON=py` or full path in `.env.local`; restart Node |
| `can't open file ... extract_rfq.py` | `git pull`; ensure `word-extract/extract_rfq.py` exists |
| `No module named 'pythoncom'` | Host is Linux — move extraction to Windows EC2 |
| Word dialog / hung COM | Use dedicated Windows Server; avoid RDS session conflicts; restart Word |
