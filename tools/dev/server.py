#!/usr/bin/env python3
"""本機測試用的網頁伺服器：每個回應都加 no-store，改了程式重新整理就是新的。
用法（在專案根目錄）：python3 tools/dev/server.py 8012"""
import http.server, sys
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store'); super().end_headers()
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1]) if len(sys.argv) > 1 else 8012), H).serve_forever()
