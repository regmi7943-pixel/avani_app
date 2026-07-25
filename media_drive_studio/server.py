import os
import sys
import json
import urllib.request
import urllib.parse
import ssl
from http.server import HTTPServer, SimpleHTTPRequestHandler
from socketserver import ThreadingMixIn
from concurrent.futures import ThreadPoolExecutor

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import scraper

PORT = 8050
DIR_PATH = os.path.dirname(os.path.abspath(__file__))

SUPABASE_URL = "https://zcxhzmdyahmkkkxyzvif.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjeGh6bWR5YWhta2treHl6dmlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MjAzMTUsImV4cCI6MjA5MjE5NjMxNX0.q_SkdaEYHdcdT-88VrhID_38Npzg20Er7AxrTkHGKI8"

ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE


class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    """Handle each request in a new thread so image proxying doesn't block."""
    daemon_threads = True


def fetch_supabase_items():
    url = f"{SUPABASE_URL}/rest/v1/marketplace_items?select=*&order=created_at.asc"
    req = urllib.request.Request(url, headers={
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': f'Bearer {SUPABASE_ANON_KEY}',
        'Content-Type': 'application/json'
    })
    with urllib.request.urlopen(req, context=ssl_context) as resp:
        return json.loads(resp.read().decode('utf-8'))


def update_supabase_item_image(item_id: str, new_image_url: str):
    try:
        url = f"{SUPABASE_URL}/rest/v1/marketplace_items?id=eq.{item_id}"
        data = json.dumps({'image_url': new_image_url}).encode('utf-8')
        req = urllib.request.Request(url, data=data, method='PATCH', headers={
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': f'Bearer {SUPABASE_ANON_KEY}',
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        })
        with urllib.request.urlopen(req, context=ssl_context) as resp:
            resp.read()
            return True
    except Exception as e:
        print(f"[Supabase Update Error] {item_id}: {e}")
        return False


def upload_image_to_cloudinary(image_url, cloud_name, api_key="", api_secret="", upload_preset="", folder="avani_marketplace"):
    try:
        if upload_preset and cloud_name:
            endpoint = f"https://api.cloudinary.com/v1_1/{cloud_name}/image/upload"
            payload = {'file': image_url, 'upload_preset': upload_preset, 'folder': folder}
            data = urllib.parse.urlencode(payload).encode('utf-8')
            req = urllib.request.Request(endpoint, data=data, headers={'Content-Type': 'application/x-www-form-urlencoded'})
            with urllib.request.urlopen(req, context=ssl_context) as resp:
                res = json.loads(resp.read().decode('utf-8'))
                return res.get('secure_url') or res.get('url') or image_url
        elif cloud_name and api_key and api_secret:
            import cloudinary, cloudinary.uploader
            cloudinary.config(cloud_name=cloud_name, api_key=api_key, api_secret=api_secret, secure=True)
            res = cloudinary.uploader.upload(image_url, folder=folder)
            return res.get('secure_url') or res.get('url') or image_url
        return image_url
    except Exception as e:
        print(f"[Cloudinary Error] {image_url}: {e}")
        return image_url


class MediaDriveHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR_PATH, **kwargs)

    def log_message(self, format, *args):
        # quieter logging — only log API calls, not static files
        path = args[0] if args else ""
        if '/api/' in str(path):
            super().log_message(format, *args)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)

        if parsed.path == '/api/items':
            try:
                items = fetch_supabase_items()
                self._send_json({'success': True, 'count': len(items), 'items': items})
            except Exception as e:
                self._send_json({'success': False, 'error': str(e)}, status=500)
            return

        if parsed.path == '/api/proxy-image':
            qs = urllib.parse.parse_qs(parsed.query)
            image_url = qs.get('url', [''])[0]
            if not image_url:
                self._send_placeholder("No URL")
                return
            try:
                req = urllib.request.Request(image_url, headers=scraper.HEADERS)
                with urllib.request.urlopen(req, context=ssl_context, timeout=10) as resp:
                    ct = resp.headers.get('Content-Type', 'image/jpeg')
                    body = resp.read()
                self.send_response(200)
                self.send_header('Content-Type', ct)
                self.send_header('Cache-Control', 'public, max-age=86400')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(body)
            except Exception:
                self._send_placeholder("Error")
            return

        super().do_GET()

    def _send_placeholder(self, text):
        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250">
        <rect width="400" height="250" fill="#151c2c"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
              fill="#6b7280" font-family="sans-serif" font-size="14">{text}</text></svg>'''
        self.send_response(200)
        self.send_header('Content-Type', 'image/svg+xml')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(svg.encode())

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        cl = int(self.headers.get('Content-Length', 0))
        raw = self.rfile.read(cl).decode('utf-8') if cl else '{}'
        try:
            body = json.loads(raw)
        except Exception:
            body = {}

        if parsed.path == '/api/scrape-item':
            cands = scraper.scrape_item_candidates(body.get('name', ''), body.get('category', ''), body.get('description', ''))
            self._send_json({'success': True, 'name': body.get('name'), 'candidates': cands})
            return

        if parsed.path == '/api/scrape-batch':
            items = body.get('items', [])
            results = {}
            def _scrape(it):
                return it.get('id'), scraper.scrape_item_candidates(it.get('name', ''), it.get('category', ''), it.get('description', ''))
            with ThreadPoolExecutor(max_workers=5) as pool:
                for item_id, cands in pool.map(lambda it: _scrape(it), items):
                    results[item_id] = cands
            self._send_json({'success': True, 'results': results})
            return

        if parsed.path == '/api/submit-selections':
            sels = body.get('selections', [])
            cn = body.get('cloud_name', '')
            ak = body.get('api_key', '')
            ase = body.get('api_secret', '')
            up = body.get('upload_preset', '')
            updated = 0
            details = []
            for s in sels:
                sid, surl, scat = s.get('id'), s.get('image_url'), s.get('category', '')
                if not sid or not surl:
                    continue
                
                urls_to_process = surl if isinstance(surl, list) else [surl]
                final_urls = []
                for u in urls_to_process:
                    if cn and (up or (ak and ase)):
                        c_url = upload_image_to_cloudinary(u, cn, ak, ase, up, f"avani_marketplace/{scat.lower()}")
                        final_urls.append(c_url)
                    else:
                        final_urls.append(u)

                primary_final = final_urls[0] if final_urls else ""
                if update_supabase_item_image(sid, primary_final):
                    updated += 1
                    details.append({'id': sid, 'name': s.get('name'), 'url': primary_final, 'all_urls': final_urls})
            self._send_json({'success': True, 'updated_count': updated, 'details': details})
            return

        self._send_json({'error': 'Not found'}, 404)

    def _send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()


if __name__ == '__main__':
    print(f"\n  Avani Media Drive Studio")
    print(f"  http://localhost:{PORT}\n")
    server = ThreadedHTTPServer(('0.0.0.0', PORT), MediaDriveHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
        server.server_close()
