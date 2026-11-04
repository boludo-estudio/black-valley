import http.server, functools, sys, os, re
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'max-age=3600'); self.send_header('Accept-Ranges', 'bytes'); super().end_headers()
    def log_message(self, *a): pass
    def send_head(self):
        m = re.match(r'bytes=(\d*)-(\d*)$', self.headers.get('Range', ''))
        path = self.translate_path(self.path)
        if not m or not os.path.isfile(path): return super().send_head()
        size = os.path.getsize(path); a = int(m[1]) if m[1] else max(0, size - int(m[2] or 0)); b = int(m[2]) if m[1] and m[2] else size - 1
        b = min(b, size - 1)
        if a > b: self.send_error(416); return None
        f = open(path, 'rb'); f.seek(a)
        self.send_response(206); self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Range', f'bytes {a}-{b}/{size}'); self.send_header('Content-Length', str(b - a + 1)); self.end_headers()
        self._left = b - a + 1; return f
    def copyfile(self, src, dst):
        left = getattr(self, '_left', None)
        if left is None: return super().copyfile(src, dst)
        while left > 0:
            chunk = src.read(min(65536, left))
            if not chunk: break
            dst.write(chunk); left -= len(chunk)
class S(http.server.ThreadingHTTPServer): request_queue_size = 128; daemon_threads = True
S(('127.0.0.1', int(sys.argv[1])), functools.partial(H, directory='.')).serve_forever()
