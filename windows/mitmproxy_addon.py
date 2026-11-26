"""Run unchanged g1-acq sources in a serial Node worker behind mitmproxy."""
import json
import logging
import os
from pathlib import Path
import queue
import shutil
import subprocess
import threading

from mitmproxy import http

ROOT = Path(__file__).resolve().parent.parent


class Worker:
    def __init__(self, directory=None):
        self.directory = Path(directory or ROOT / ".git" / "g1-windows-state")
        self.process = None
        self.responses = queue.Queue()
        self.lock = threading.RLock()
        self.sequence = 0

    def start(self):
        if self.process is not None and self.process.poll() is None:
            return
        executable = shutil.which("node")
        if not executable:
            raise RuntimeError("Node.js is required")
        self.responses = queue.Queue()
        self.process = subprocess.Popen(
            [executable, str(ROOT / "windows" / "runtime.cjs"), str(self.directory)],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            text=True, encoding="utf-8", bufsize=1,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
        process, responses = self.process, self.responses

        def read_responses():
            try:
                for line in process.stdout:
                    responses.put(json.loads(line))
            except (OSError, ValueError):
                pass
            finally:
                responses.put({"error": "Node worker stopped"})

        threading.Thread(target=read_responses, daemon=True).start()

    def call(self, message):
        with self.lock:
            self.start()
            self.sequence += 1
            message = dict(message, id=self.sequence)
            try:
                self.process.stdin.write(json.dumps(message, ensure_ascii=False) + "\n")
                self.process.stdin.flush()
                result = self.responses.get(timeout=8)
                if "error" in result or result.get("id") != self.sequence:
                    raise RuntimeError("Invalid Node worker response")
                return result["result"]
            except Exception:
                self.stop()
                raise

    def stop(self):
        if self.process is not None:
            process, self.process = self.process, None
            if process.poll() is None:
                process.kill()
            process.wait(timeout=3)
            for stream in (process.stdin, process.stdout):
                stream.close()


class G1Windows:
    def __init__(self, worker=None):
        self.worker = worker or Worker()

    @staticmethod
    def is_report(request):
        return request.scheme == "https" and request.host == "one.google.com" and (
            request.path.split("?", 1)[0] in ("/g1-sku-report", "/g1-sku-report/")
        )

    @staticmethod
    def request_metadata(request):
        # Only metadata used by the local form controller; never copy auth/cookies.
        headers = {key: request.headers[key] for key in ("origin", "content-type", "sec-fetch-site")
                   if key in request.headers}
        return {"url": request.pretty_url, "method": request.method, "headers": headers,
                "body": request.get_text(strict=False)}

    def request(self, flow: http.HTTPFlow):
        if not self.is_report(flow.request):
            return
        try:
            result = self.worker.call({"kind": "report", "request": self.request_metadata(flow.request)})
            response = result["response"]
            flow.response = http.Response.make(response["status"], response.get("body", "").encode("utf-8"),
                                               response["headers"])
        except Exception:
            # Fail locally: never forward a report/form to Google's server.
            flow.response = http.Response.make(503, b"G1 Windows: local report unavailable; retry after recovery.",
                                               {"Content-Type": "text/plain", "Cache-Control": "no-store"})
            logging.getLogger(__name__).warning("[g1-windows] local report unavailable")

    def response(self, flow: http.HTTPFlow):
        if flow.request.scheme != "https" or flow.request.host != "one.google.com" or self.is_report(flow.request):
            return
        content_type = flow.response.headers.get("content-type", "").lower()
        is_text = not content_type or any(value in content_type for value in
                                         ("text/", "json", "javascript", "xml", "urlencoded"))
        try:
            body = flow.response.get_text(strict=False) if is_text else None
            result = self.worker.call({"kind": "response", "request": {"url": flow.request.pretty_url}, "body": body})
            if "body" in result:
                # mitmproxy re-encodes compression and recalculates Content-Length.
                flow.response.text = result["body"]
        except Exception:
            logging.getLogger(__name__).warning("[g1-windows] script unavailable; original response retained")

    def done(self):
        self.worker.stop()


addons = [G1Windows()]
