# RFQ Word Package Extraction

Extracts GM-style RFQ Word packages (embedded PDF, Excel, nested Word) on **Windows** with Microsoft Word/Excel.

## UI (Next.js — same stack as `D:\RFQ\rfq\rfq-ui`)

```powershell
cd d:\RFQ_EXTRACTION
py -m pip install -r requirements.txt
run_ui.bat
```

Open **http://localhost:3000** → sign in → **Word extract** (`/extraction`) or **Baseline RFQ object** (`/baseline`).

- Upload `.doc` / `.docx`
- Clear output & databases (retest)
- Browse sections / content from `output/extraction.json`

The UI calls the Python engine in this repo (`extract_rfq.py`); workbook/PDF agent flows from the copied rfq-ui remain on the main dashboard.

## Python CLI

```powershell
py extract_rfq.py your-rfq.doc -o output --load-db --normalize
py build_rfq_object.py   # curated field/value + source document (also runs after normalize)
```

## Legacy Streamlit viewer

```powershell
run_viewer.bat
```

Prefer **run_ui.bat** for new work.

## Layout

| Path | Role |
|------|------|
| `extract_rfq.py`, `extractors/` | Extraction engine |
| `output/` | `extraction.json`, `normalized.json`, `rfq_objects.json`, `rfq.db`, `rfq_normalized.db`, `rfq_baseline.db` |
| `rfq-ui/` | Next.js UI (from rfq-ui stack) |
| `uploads/` | Word files uploaded via UI |

Optional env vars for the UI server:

- `RFQ_ENGINE_ROOT` — default: parent of `rfq-ui` (this repo root)
- `RFQ_PYTHON` — default: `py`
- `RFQ_OUTPUT_DIR` / `RFQ_UPLOADS_DIR` — override output/upload paths
