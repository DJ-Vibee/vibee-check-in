# Jotform Downloader Script
#
# This script downloads file uploads from Jotform submissions, organizes them by hotel and room,
# and logs the results. It pulls form IDs from a Google Sheet, fetches submissions via the Jotform API,
# and writes per-hotel logs and a summary file for each form.

import os, re, csv, html, time, json, threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urlparse, unquote
import requests
from bs4 import BeautifulSoup
# Note: Google Sheets workflow removed; no Google API imports required

# === Configuration ===
API_KEY = 'e1a6244860ef0e6def48b0b98f295817'  # Jotform API key
#BASE_FOLDER = Path(r'G:\Shared drives\Biz Ops\Properties\Jotform Downloads')  # Where downloads/logs are stored
BASE_FOLDER = Path(r'G:\Shared drives\Properties\VE\Hotels\New Hotel Images')  # Where downloads/logs are stored
DRY_RUN = False  # If True, simulate downloads without saving files
RETRY_LIMIT = 2  # Number of times to retry failed downloads
MAX_WORKERS = 8  # Number of threads for parallel downloads
BASE_API = 'https://vibee.jotform.com/API'  # Jotform API base URL
HEADERS = {'APIKEY': API_KEY}  # Headers for Jotform API requests
ALLOWED_EXT = ('.jpg', '.jpeg', '.png', '.pdf', '.webp', '.gif')  # Allowed file types
LOCK = threading.Lock()  # Thread lock for safe updates to shared data

MARKET_FORMS = [
    ("Amsterdam", "252926398638979"),
    ("London", "252935569279980"),
    ("Sao Paulo", "252935271108961"),
    ("Mexico City", "252935748443972"),
    ("New York", "252935471877976"),
    ("Melbourne", "252926736062966"),
    ("Sydney", "252927338105963"),
    ("Toronto", "252935176631966"),
    ("Austin", "252935065497973"),
    ("Chicago", "252935153593968"),
    ("Los Angeles", "252935200726959"),
    ("Berlin", "252935290996977"),
    ("Paris", "252935037349968"),
]

# Normalization helper for matching question labels reliably
def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or '').strip().lower())

def _parse_matrix_labels(raw, with_ids=False):
    """Parse matrix rows/columns from either pipe-delimited strings or JSON arrays."""
    if not raw:
        return []
    if isinstance(raw, str) and raw.strip().startswith('['):
        try:
            arr = json.loads(raw)
            if with_ids:
                return [{'text': item.get('text', ''), 'id': str(item.get('id', '') or '')} for item in arr if isinstance(item, dict)]
            return [item.get('text', '') for item in arr if isinstance(item, dict)]
        except Exception:
            return []
    if isinstance(raw, str):
        parts = [p.strip() for p in raw.split('|') if p.strip()]
        if with_ids:
            return [{'text': p, 'id': ''} for p in parts]
        return parts
    return []

def discover_room_matrices(questions):
    """Identify matrix questions that contain the 'Room Type as Listed on Website' column.
    Returns a list of mappings describing which question/row/column yields the room name.
    """
    matrices = []
    target_norm = _norm('Room Type as Listed on Website')
    for qid, q in (questions or {}).items():
        if q.get('type') != 'control_matrix':
            continue
        cols_raw = q.get('dcolumns') or q.get('mcolumns')
        rows_raw = q.get('drows') or q.get('mrows')
        cols_meta = _parse_matrix_labels(cols_raw, with_ids=True)
        rows_meta = _parse_matrix_labels(rows_raw, with_ids=True) or [{'text': '', 'id': ''}]
        cols = [_norm(c['text'] if isinstance(c, dict) else c) for c in cols_meta]
        rows = [_norm(r['text'] if isinstance(r, dict) else r) for r in rows_meta]
        if not cols:
            continue
        try:
            col_idx = cols.index(target_norm)
        except ValueError:
            continue  # this matrix does not hold the room name column
        for r_idx, row_label in enumerate(rows):
            m = re.search(r'room\s*type\s*(\d+)', row_label)
            room_idx = int(m.group(1)) if m else (r_idx + 1)
            matrices.append({
                'qid': str(qid),
                'row_index': r_idx,
                'col_index': col_idx,
                'room_index': room_idx,
                'row_label': rows_meta[r_idx].get('text', '') if isinstance(rows_meta[r_idx], dict) else rows_meta[r_idx],
                'col_id': cols_meta[col_idx].get('id', '') if isinstance(cols_meta[col_idx], dict) else '',
                'row_id': rows_meta[r_idx].get('id', '') if isinstance(rows_meta[r_idx], dict) else '',
            })
    return matrices

# --- Utility Functions ---
def sanitize(name):
    """Sanitize a string for use as a folder or file name (alphanumeric, dash, underscore, max 80 chars)."""
    return re.sub(r'[^\w\-]', '_', name.strip())[:80] or 'Unnamed'

def simplify_room(value):
    """Extract a short, readable room name from a text field (first sentence, up to 5 words)."""
    txt = html.unescape(BeautifulSoup(value or '', 'html.parser').get_text())
    first = re.split(r'[.:;\n]', txt)[0]
    return '_'.join(first.strip().split()[:5]) or 'Room'

def extract_file_urls(value):
    """Return a list of file URLs from a Jotform answer which may be a list or a string.
    - If it's already a list of URLs, normalize and filter by allowed extensions.
    - If it's a string, split on whitespace/commas and take tokens that look like URLs, then normalize/filter.
    """
    from urllib.parse import urlsplit, urlunsplit, quote

    def normalize_url(u: str) -> str:
        u = (u or '').strip().strip('"').strip('\'')
        try:
            sp = urlsplit(u)
            # Percent-encode spaces and special chars in path only
            path = quote(sp.path, safe='/:@')
            return urlunsplit((sp.scheme, sp.netloc, path, sp.query, sp.fragment))
        except Exception:
            return u.replace(' ', '%20')

    def allowed(u: str) -> bool:
        try:
            suf = Path(unquote(urlparse(u).path)).suffix.lower()
            return bool(suf) and suf in ALLOWED_EXT
        except Exception:
            return False

    if not value:
        return []

    urls: list[str] = []
    if isinstance(value, list):
        for v in value:
            if isinstance(v, str) and v.strip():
                nu = normalize_url(v)
                if allowed(nu):
                    urls.append(nu)
    elif isinstance(value, str):
        # Split by common delimiters (space, newline, comma)
        tokens = re.split(r'[\s,]+', value)
        for t in tokens:
            if t.startswith('http://') or t.startswith('https://'):
                nu = normalize_url(t)
                if allowed(nu):
                    urls.append(nu)
    # Deduplicate while preserving order
    seen = set()
    out = []
    for u in urls:
        if u not in seen:
            out.append(u); seen.add(u)
    return out

def extract_room_name(value):
    """Extract the room name string from various answer shapes (string, list, dict)."""

    def clean(text: str) -> str:
        if not text:
            return ''
        txt = html.unescape(BeautifulSoup(str(text), 'html.parser').get_text())
        return txt.strip()

    if isinstance(value, str):
        return clean(value)

    if isinstance(value, dict):
        # Prefer fields that explicitly reference the website room name
        for key, val in value.items():
            if isinstance(val, str) and 'room type' in str(key).lower() and 'listed on website' in str(key).lower():
                cleaned = clean(val)
                if cleaned:
                    return cleaned
        # Otherwise return the first non-empty string value encountered recursively
        for val in value.values():
            extracted = extract_room_name(val)
            if extracted:
                return extracted
        return ''

    if isinstance(value, list):
        # Jotform matrix answers can be nested lists; walk depth-first
        for item in value:
            extracted = extract_room_name(item)
            if extracted:
                return extracted
        return ''

    return ''

def extract_room_name_from_matrix(answer, qid, room_index, room_matrix_specs):
    """Pull the room name from a matrix answer using discovered column metadata."""
    target_specs = [s for s in room_matrix_specs if s['qid'] == str(qid) and s['room_index'] == room_index]
    rows = answer if isinstance(answer, list) else [answer]

    def pick_from_row(row, spec):
        name_value = None
        if isinstance(row, dict):
            if spec.get('col_id') and spec['col_id'] in row:
                name_value = row.get(spec['col_id'])
            else:
                vals = list(row.values())
                if spec['col_index'] < len(vals):
                    name_value = vals[spec['col_index']]
        elif isinstance(row, list):
            if spec['col_index'] < len(row):
                name_value = row[spec['col_index']]
        else:
            name_value = row
        return extract_room_name(name_value)

    # Prefer discovered spec; fallback to 4th column (index 3) if present
    if target_specs and rows:
        for spec in target_specs:
            if spec['row_index'] < len(rows):
                name = pick_from_row(rows[spec['row_index']], spec)
                if name:
                    return name
    if rows:
        row0 = rows[0]
        if isinstance(row0, list) and len(row0) >= 4:
            name = extract_room_name(row0[3])
            if name:
                return name
        if isinstance(row0, dict):
            vals = list(row0.values())
            if len(vals) >= 4:
                name = extract_room_name(vals[3])
                if name:
                    return name
    return ''

def sheet_form_ids():
    """Deprecated: previously used to read form IDs from Google Sheets. Not used now."""
    return [fid for _, fid in MARKET_FORMS]

def form_title(fid):
    """Fetch the title of a Jotform form by its ID."""
    r = requests.get(f'{BASE_API}/form/{fid}', headers=HEADERS, timeout=15).json()
    return sanitize(r.get('content', {}).get('title', f'Form_{fid}'))

def form_questions(fid):
    """Fetch all question metadata for a form (used to map matrix columns dynamically)."""
    r = requests.get(f'{BASE_API}/form/{fid}/questions', headers=HEADERS, timeout=15).json()
    return r.get('content', {})

def download_worker(url, dest, hotel, room, form_logs, summary):
    """Download a file from a URL to the destination folder, update logs and summary."""
    fname = unquote(Path(urlparse(url).path).name)
    path = dest / fname
    if path.exists():
        status = 'SKIPPED'  # File already exists
    elif DRY_RUN:
        status = 'DRY_RUN'  # Simulate download
    else:
        ok = False
        for _ in range(RETRY_LIMIT):
            try:
                r = requests.get(url, headers=HEADERS, timeout=30)
                if r.status_code == 200:
                    path.write_bytes(r.content)
                    ok = True
                    break
            except Exception:
                time.sleep(2)  # Wait before retrying
        status = 'DOWNLOADED' if ok else 'FAILED'
    with LOCK:
        form_logs[hotel].append([hotel, room, fname, status])
        summary[status] = summary.get(status, 0) + 1
    indicator = 'OK' if status == 'DOWNLOADED' else 'SKIP'
    print(f"[{indicator}] {fname} -> {room} ({status})")

def process_form(fid, market_label):
    """Process all submissions for a given form: organize downloads, log results, and write summary."""
    title = form_title(fid)
    root = BASE_FOLDER / sanitize(market_label)
    root.mkdir(parents=True, exist_ok=True)
    print(f'\n======== {market_label} ({fid}) ========')
    print(f'Form title: {title}')

    # --- Fetch all submissions for the form ---
    subs, off, lim = [], 0, 100
    while True:
        r = requests.get(f'{BASE_API}/form/{fid}/submissions', headers=HEADERS, params={'offset':off,'limit':lim}, timeout=30).json()
        chunk = r.get('content', [])
        if not chunk: break
        subs.extend(chunk); off += lim
    print(f'Submissions found: {len(subs)}')

    # --- Prepare for parallel downloads and dynamic lookups ---
    questions = form_questions(fid)
    room_matrix_specs = discover_room_matrices(questions)
    form_logs = {}  # Per-hotel logs
    summary = {}    # Download status summary

    # Define the labels we expect for hotel images and room sections
    HOTEL_IMAGES_LABEL = _norm('Hotel Images - ie, Primary Hotel Image + lobby, gym, exterior, pool/outdoor space, restaurant/bar, etc.')
    ROOM_NAME_LABELS = {
        1: {
            _norm('The following section is where you will submit your room block and provide all information about each room. This information should be exactly the same as what can be found on your Hotel\'s website. NOTE: WE DO NOT OFFER A ROH ROOM CATEGORY. >> Room Type 1 >> Room Type as Listed on Website'),
            _norm('Room Type 1 Information >> Room Type 1 >> Room Type as Listed on Website'),
            _norm('Room Type 1 >> Room Type as Listed on Website'),
        },
        2: {
            _norm('Room Type 2 Information >> Room Type 2 >> Room Type as Listed on Website'),
            _norm('Room Type 2 >> Room Type as Listed on Website'),
        },
        3: {
            _norm('Room Type 3 Information >> Room Type 3 >> Room Type as Listed on Website'),
            _norm('Room Type 3 >> Room Type as Listed on Website'),
        },
        4: {
            _norm('Room Type 4 Information >> Room Type 4 >> Room Type as Listed on Website'),
            _norm('Room Type 4 >> Room Type as Listed on Website'),
        },
        5: {
            _norm('Room Type 5 Information >> Room Type 5 >> Room Type as Listed on Website'),
            _norm('Room Type 5 >> Room Type as Listed on Website'),
        },
    }
    ROOM_ASSET_LABELS = {i: _norm(f'Please upload images of the Room Type {i}.') for i in range(1,6)}

    # Baseline question IDs (used when metadata is missing)
    QID_HOTEL_NAME = '33'
    QID_HOTEL_IMAGES = '393'
    QID_ROOM_ASSETS = {1:'378', 2:'384', 3:'385', 4:'392', 5:'388'}
    QID_ROOM_MATRIX = {1:'427', 2:'431', 3:'432', 4:'433', 5:'434'}

    # Dynamic lookups discovered from live question metadata
    hotel_name_qids = {QID_HOTEL_NAME}
    hotel_image_qids = {QID_HOTEL_IMAGES}
    room_asset_qids = {i: {q for q in [QID_ROOM_ASSETS.get(i, '')] if q} for i in range(1,6)}
    for qid, meta in (questions or {}).items():
        norm_label = _norm(meta.get('text', ''))
        sqid = str(qid)
        if 'hotel name' in norm_label:
            hotel_name_qids.add(sqid)
        if 'hotel images' in norm_label or 'primary hotel image' in norm_label:
            hotel_image_qids.add(sqid)
        for i in range(1,6):
            if f'room type {i}' in norm_label and (('upload' in norm_label) or ('image' in norm_label) or ('photo' in norm_label)):
                room_asset_qids[i].add(sqid)

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futs = []
        for sub in subs:
            ans = sub.get('answers', {})
            hotel = None
            room_names = {}   # i -> raw name text
            room_assets = {}  # i -> list of urls
            hotel_images = [] # list of urls

            # Parse answers to extract hotel name, hotel images, room names and assets
            for qid, v in ans.items():
                sqid = str(qid)
                label_raw = v.get('text', '')
                label = _norm(label_raw)
                answer = v.get('answer', '')

                # Hotel name detection (fallback: substring match)
                if (sqid in hotel_name_qids or 'hotel name' in label) and not hotel:
                    hotel = sanitize(str(answer) or 'Unknown_Hotel')

                # Hotel images upload
                if sqid in hotel_image_qids or label == HOTEL_IMAGES_LABEL:
                    hotel_images.extend(extract_file_urls(answer))

                # Room names and assets
                for i in range(1,6):
                    label_match = label in ROOM_NAME_LABELS.get(i, set()) or ('room type' in label and str(i) in label and 'listed on website' in label)
                    if sqid == QID_ROOM_MATRIX.get(i) or label_match:
                        if answer:
                            name = extract_room_name_from_matrix(answer, sqid, i, room_matrix_specs)
                            if name:
                                room_names[i] = name
                    if sqid in room_asset_qids.get(i, set()) or sqid == QID_ROOM_ASSETS.get(i) or label == ROOM_ASSET_LABELS.get(i):
                        room_assets[i] = extract_file_urls(answer)

            # Pull room names from matrix columns (handles forms with varying column layouts)
            for spec in room_matrix_specs:
                idx = spec['room_index']
                if room_names.get(idx):
                    continue  # already resolved via direct label
                v = ans.get(spec['qid'])
                if not v:
                    continue
                rows = v.get('answer')
                if not rows:
                    continue
                rows_list = rows if isinstance(rows, list) else [rows]
                if spec['row_index'] >= len(rows_list):
                    continue
                row_data = rows_list[spec['row_index']]
                name_value = None
                if isinstance(row_data, dict):
                    # Prefer column ID when available, otherwise fall back to positional ordering
                    if spec.get('col_id') and spec['col_id'] in row_data:
                        name_value = row_data.get(spec['col_id'])
                    else:
                        vals = list(row_data.values())
                        if spec['col_index'] < len(vals):
                            name_value = vals[spec['col_index']]
                elif isinstance(row_data, list):
                    if spec['col_index'] < len(row_data):
                        name_value = row_data[spec['col_index']]
                else:
                    name_value = row_data
                cleaned = extract_room_name(name_value)
                if cleaned:
                    room_names[idx] = cleaned

            hotel = hotel or 'Unknown_Hotel'
            form_logs.setdefault(hotel, [])
            hotel_dir = root / hotel
            hotel_dir.mkdir(exist_ok=True)

            # Save hotel-level images
            if hotel_images:
                hotel_img_dir = hotel_dir / 'Hotel_Images'
                hotel_img_dir.mkdir(exist_ok=True)
                # Enqueue all hotel image URLs for download
                for url in hotel_images:
                    futs.append(pool.submit(download_worker, url, hotel_img_dir, hotel, 'Hotel_Images', form_logs, summary))

            # For each room index, download all files
            seen = {}
            for i in range(1,6):
                urls = room_assets.get(i, [])
                # Determine room folder name
                raw_name = (room_names.get(i, '') or '').strip()
                has_label = bool(raw_name)
                base = sanitize(raw_name) if has_label else f'RoomType_{i}'
                previous_base = sanitize(simplify_room(raw_name)) if has_label else ''
                n = seen.get(base, 0) + 1
                seen[base] = n
                room_name = f'{base}_{n}' if n > 1 else base

                # If we previously created default folders (RoomType_X[_n]) rename them when the true name becomes available
                fallback_names = []
                fallback_names.append(f'RoomType_{i}' if n == 1 else f'RoomType_{i}_{n}')
                if previous_base and previous_base != base:
                    fallback_names.append(f'{previous_base}_{n}' if n > 1 else previous_base)
                room_dir = hotel_dir / room_name
                if has_label:
                    for legacy in fallback_names:
                        legacy_dir = hotel_dir / legacy
                        if not legacy_dir.exists() or legacy_dir == room_dir:
                            continue
                        if not room_dir.exists():
                            legacy_dir.rename(room_dir)
                        else:
                            for item in legacy_dir.iterdir():
                                target = room_dir / item.name
                                if not target.exists():
                                    item.rename(target)
                            try:
                                legacy_dir.rmdir()
                            except OSError:
                                pass
                        break

                room_dir.mkdir(exist_ok=True)

                if not urls:
                    if not DRY_RUN:
                        (room_dir/'No uploads.txt').write_text('No files submitted.')
                    with LOCK:
                        form_logs[hotel].append([hotel, room_name, 'N/A', 'NO_UPLOADS'])
                        summary['NO_UPLOADS'] = summary.get('NO_UPLOADS', 0) + 1
                    continue

                # Enqueue all room asset URLs for download
                for url in urls:
                    futs.append(pool.submit(download_worker, url, room_dir, hotel, room_name, form_logs, summary))

        for _ in as_completed(futs):
            pass  # Wait for all downloads to finish

    # --- Write per-hotel logs and summary ---
    hotel_log_paths = []
    for h, rows in form_logs.items():
        log_path = root / h / 'download_log.csv'
        with log_path.open('w', newline='', encoding='utf-8') as f:
            csv.writer(f).writerows([['Hotel','Room','Filename','Status']]+rows)
        hotel_log_paths.append(log_path)
    ts = time.strftime('%Y%m%d_%H%M%S')
    summ_path = root / f'summary_{ts}.txt'
    with summ_path.open('w', encoding='utf-8') as f:
        f.write('=== Download result counts ===\n')
        for k, v in summary.items():
            f.write(f'{k}: {v}\n')
        f.write('\n=== Per-hotel log locations ===\n')
        for p in hotel_log_paths:
            f.write(str(p) + '\n')
    print(f'Logs written. Summary -> {summ_path}')

def main():
    """Main entry point: process the configured Jotform forms."""
    for market_label, fid in MARKET_FORMS:
        try:
            process_form(fid, market_label)
        except Exception as exc:
            print(f'WARNING: Failed to process {market_label} ({fid}): {exc}')
    print('\n====== Forms processed ======')

if __name__ == '__main__':
    main()
