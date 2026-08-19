#!/usr/bin/env python3
"""Static file server for local dev, with caching fully disabled.

Plain `python -m http.server` relies on Last-Modified/ETag revalidation,
which is easy to get stale responses from during active development. This
always sends Cache-Control: no-store so every reload picks up fresh files.
"""
import http.server
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()


if __name__ == "__main__":
    http.server.test(HandlerClass=NoCacheHandler, port=PORT)
