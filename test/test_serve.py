"""Regression tests for serve.py (dev server): no path traversal, cache busting kept."""
import os
import re
import socket
import sys
import tempfile
import threading
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import serve  # noqa: E402

SECRET = 'const SECRET = "do-not-leak";'


def raw_get(port, target):
    """Send a request line verbatim (no client-side normalisation of '..')."""
    with socket.create_connection(('127.0.0.1', port), timeout=5) as sock:
        sock.sendall(f'GET {target} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n'.encode())
        data = b''
        while True:
            chunk = sock.recv(65536)
            if not chunk:
                break
            data += chunk
    head, _, body = data.partition(b'\r\n\r\n')
    status = int(head.split(b' ', 2)[1])
    return status, body.decode('utf-8', 'replace')


class ServeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        base = os.path.realpath(cls.tmp.name)
        cls.root = os.path.join(base, 'app')
        os.makedirs(os.path.join(cls.root, 'js'))
        with open(os.path.join(base, 'secret.js'), 'w') as fh:
            fh.write(SECRET)
        with open(os.path.join(base, 'secret.html'), 'w') as fh:
            fh.write('<p>do-not-leak</p>')
        with open(os.path.join(base, 'secret.txt'), 'w') as fh:
            fh.write('do-not-leak')
        with open(os.path.join(cls.root, 'index.html'), 'w') as fh:
            fh.write('<script src="js/main.js"></script>')
        with open(os.path.join(cls.root, 'js', 'main.js'), 'w') as fh:
            fh.write("import { a } from './a.js';\n")
        with open(os.path.join(cls.root, 'js', 'a.js'), 'w') as fh:
            fh.write('export const a = 1;\n')
        with open(os.path.join(cls.root, 'plain.txt'), 'w') as fh:
            fh.write('plain')
        cls.server = serve.make_server(0, root=cls.root)
        cls.port = cls.server.server_address[1]
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.tmp.cleanup()

    def test_dotdot_does_not_leak_files_outside_root(self):
        targets = [
            '/../secret.js',
            '/../secret.html',
            '/%2e%2e/secret.js',
            '/%2E%2E/secret.js',
            '/..%2fsecret.js',
            '/%2e%2e%2fsecret.js',
            '/js/../../secret.js',
            '/js/%2e%2e/%2e%2e/secret.js',
            '/../secret.txt',
            '/%2e%2e/secret.txt',
            '/../secret.js?v=1',
        ]
        for target in targets:
            with self.subTest(target=target):
                status, body = raw_get(self.port, target)
                self.assertIn(status, (400, 403, 404))
                self.assertNotIn('do-not-leak', body)

    def test_legitimate_files_are_served(self):
        status, body = raw_get(self.port, '/index.html')
        self.assertEqual(status, 200)
        self.assertIn('<script', body)
        status, body = raw_get(self.port, '/')
        self.assertEqual(status, 200)
        status, body = raw_get(self.port, '/plain.txt')
        self.assertEqual(status, 200)
        self.assertEqual(body, 'plain')

    def test_cache_busting_token_is_added_to_js_and_html(self):
        status, html = raw_get(self.port, '/index.html')
        self.assertEqual(status, 200)
        self.assertRegex(html, r'src="js/main\.js\?v=\d+"')
        status, js = raw_get(self.port, '/js/main.js?v=123')
        self.assertEqual(status, 200)
        self.assertRegex(js, r"from './a\.js\?v=\d+'")
        token = re.search(r'\?v=(\d+)', js).group(1)
        self.assertEqual(token, serve.bust_token(self.root))

    def test_resolve_inside(self):
        self.assertEqual(serve.resolve_inside(self.root, '/js/a.js'), os.path.join(self.root, 'js', 'a.js'))
        self.assertIsNone(serve.resolve_inside(self.root, '/../secret.js'))
        self.assertIsNone(serve.resolve_inside(self.root, '/%2e%2e/secret.js'))
        self.assertIsNone(serve.resolve_inside(self.root, '/js/a.js\x00.png'))

    def test_default_bind_is_loopback(self):
        self.assertEqual(self.server.server_address[0], '127.0.0.1')


if __name__ == '__main__':
    unittest.main()
