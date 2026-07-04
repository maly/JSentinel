# Dev server: python serve.py [port]
#
# Bulletproof against stale ES-module caches: every served .html/.js file has
# its module imports rewritten on the fly to include ?v=<max js mtime>. Any
# source change yields new URLs, so browsers can never serve outdated modules
# regardless of their cache heuristics. Plus Cache-Control: no-cache.
import os
import re
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

ROOT = os.path.dirname(os.path.abspath(__file__))

FROM_RE = re.compile(r"(from\s+['\"])(\.{0,2}/[^'\"]+?\.js)(['\"])")
SRC_RE = re.compile(r'(src=["\'])([^"\']+?\.js)(["\'])')


def bust_token():
    newest = 0
    js_dir = os.path.join(ROOT, 'js')
    for name in os.listdir(js_dir):
        if name.endswith('.js'):
            newest = max(newest, os.stat(os.path.join(js_dir, name)).st_mtime_ns)
    return str(newest)


class DevHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def do_GET(self):
        clean = self.path.split('?', 1)[0]
        if clean == '/':
            clean = '/index.html'
        if clean.endswith('.js') or clean.endswith('.html'):
            fs_path = os.path.join(ROOT, clean.lstrip('/').replace('/', os.sep))
            if os.path.isfile(fs_path):
                v = bust_token()
                with open(fs_path, 'r', encoding='utf-8') as fh:
                    text = fh.read()
                stamp = rf"\g<1>\g<2>?v={v}\g<3>"
                text = FROM_RE.sub(stamp, text)
                if clean.endswith('.html'):
                    text = SRC_RE.sub(stamp, text)
                body = text.encode('utf-8')
                ctype = 'text/javascript' if clean.endswith('.js') else 'text/html'
                self.send_response(200)
                self.send_header('Content-Type', f'{ctype}; charset=utf-8')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
        super().do_GET()

    def log_message(self, *args):
        pass  # keep the console quiet


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
    print(f'Serving on http://localhost:{port}')
    HTTPServer(('127.0.0.1', port), DevHandler).serve_forever()
