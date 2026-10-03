# Dev server: python serve.py [port] [--lan]
#
# By default the server listens only on 127.0.0.1. Pass --lan to bind all
# interfaces (e.g. to open the game from another device on the LAN).
#
# Bulletproof against stale ES-module caches: every served .html/.js file has
# its module imports rewritten on the fly to include ?v=<max js mtime>. Any
# source change yields new URLs, so browsers can never serve outdated modules
# regardless of their cache heuristics. Plus Cache-Control: no-cache.
import functools
import os
import re
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import unquote

ROOT = os.path.realpath(os.path.dirname(os.path.abspath(__file__)))

FROM_RE = re.compile(r"(from\s+['\"])(\.{0,2}/[^'\"]+?\.js)(['\"])")
SRC_RE = re.compile(r'(src=["\'])([^"\']+?\.js)(["\'])')


def bust_token(root=ROOT):
    newest = 0
    js_dir = os.path.join(root, 'js')
    for name in os.listdir(js_dir):
        if name.endswith('.js'):
            newest = max(newest, os.stat(os.path.join(js_dir, name)).st_mtime_ns)
    return str(newest)


def resolve_inside(root, url_path):
    """Map a URL path to a file path inside root, or None if it escapes root."""
    rel = unquote(url_path).lstrip('/')
    if '\0' in rel:
        return None
    fs_path = os.path.realpath(os.path.join(root, rel.replace('/', os.sep)))
    try:
        if os.path.commonpath([root, fs_path]) != root:
            return None
    except ValueError:  # e.g. different drives on Windows
        return None
    return fs_path


class DevHandler(SimpleHTTPRequestHandler):
    root = ROOT

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def do_GET(self):
        clean = unquote(self.path.split('?', 1)[0])
        if clean == '/':
            clean = '/index.html'
        if clean.endswith('.js') or clean.endswith('.html'):
            fs_path = resolve_inside(self.root, clean)
            if fs_path is None:
                self.send_error(403)
                return
            if os.path.isfile(fs_path):
                v = bust_token(self.root)
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


def make_server(port, host='127.0.0.1', root=ROOT):
    """Create the dev server; static files are always served from root."""
    root = os.path.realpath(root)
    handler = type('Handler', (DevHandler,), {'root': root})
    return HTTPServer((host, port), functools.partial(handler, directory=root))


if __name__ == '__main__':
    args = sys.argv[1:]
    lan = '--lan' in args
    positional = [a for a in args if not a.startswith('--')]
    port = int(positional[0]) if positional else 8123
    host = '0.0.0.0' if lan else '127.0.0.1'
    if lan:
        print('WARNING: --lan binds all network interfaces; anyone on your network can read the served files.')
    print(f'Serving on http://{host}:{port}')
    make_server(port, host).serve_forever()
