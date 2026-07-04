# Dev server: python serve.py [port]
# Same as `python -m http.server`, but sends Cache-Control: no-cache so the
# browser always revalidates ES modules — stale-module bugs cost us hours.
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, *args):
        pass  # keep the console quiet


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
    print(f'Serving on http://localhost:{port}')
    HTTPServer(('127.0.0.1', port), NoCacheHandler).serve_forever()
