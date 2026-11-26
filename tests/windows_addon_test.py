import concurrent.futures
import gzip
import json
from pathlib import Path
import sys
import tempfile
import unittest

from mitmproxy import connection, http

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "windows"))
from mitmproxy_addon import G1Windows, Worker


class AddonTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="g1-addon-test-")
        self.worker = Worker(self.directory.name)
        self.addon = G1Windows(self.worker)

    def tearDown(self):
        self.worker.stop()
        self.directory.cleanup()

    @staticmethod
    def flow(url, body="", method="GET", headers=None):
        flow = http.HTTPFlow(connection.Client(peername=("127.0.0.1", 50100), sockname=("127.0.0.1", 18080)),
                             connection.Server(address=("one.google.com", 443)))
        flow.request = http.Request.make(method, url, body, headers or {})
        return flow

    def report(self):
        flow = self.flow("https://one.google.com/g1-sku-report?format=json")
        self.addon.request(flow)
        self.assertEqual(flow.response.status_code, 200)
        return json.loads(flow.response.text)

    def test_real_worker_report_post_and_gzip_response(self):
        before = self.report()
        flow = self.flow("https://one.google.com/g1-sku-report", "action=preset&preset=ultra-75p&revision=" + before["mappingConfig"]["revision"],
                         "POST", {"Origin":"https://one.google.com", "Content-Type":"application/x-www-form-urlencoded", "Cookie":"must-not-be-copied"})
        self.assertNotIn("cookie", self.addon.request_metadata(flow.request)["headers"])
        self.addon.request(flow)
        self.assertEqual(flow.response.status_code, 303)
        flow = self.flow("https://one.google.com/ai?fixture=1")
        text = json.dumps({"sku":"g1.ios.20tb.m.v2", "name":"Ưu đãi 日本語", "price":2250000}, ensure_ascii=False)
        # Response.make accepts decoded content and applies Content-Encoding.
        flow.response = http.Response.make(200, text.encode(), {"Content-Type":"application/json; charset=utf-8", "Content-Encoding":"gzip"})
        self.assertEqual(gzip.decompress(flow.response.raw_content).decode(), text)
        self.addon.response(flow)
        actual = json.loads(flow.response.text)
        self.assertEqual(actual["sku"], "g1.20tb.3months_ip_75p.acq")
        self.assertEqual(actual["name"], "Ưu đãi 日本語")
        self.assertEqual(actual["price"], 2250000)
        self.assertEqual(int(flow.response.headers["Content-Length"]), len(flow.response.raw_content))
        self.assertEqual(json.loads(gzip.decompress(flow.response.raw_content))["sku"], actual["sku"])
        self.assertEqual(self.report()["test"]["status"], "rewritten")

    def test_local_report_error_never_reaches_upstream(self):
        class Broken:
            def call(self, message):
                raise RuntimeError("unavailable")
        flow = self.flow("https://one.google.com/g1-sku-report", "action=reset", "POST")
        G1Windows(Broken()).request(flow)
        self.assertEqual(flow.response.status_code, 503)

    def test_other_hosts_and_binary_remain_unchanged(self):
        flow = self.flow("https://example.com/ai?")
        flow.response = http.Response.make(200, b"g1.ios.20tb.m.v2", {"Content-Type":"text/plain"})
        self.addon.response(flow)
        self.assertEqual(flow.response.content, b"g1.ios.20tb.m.v2")
        flow = self.flow("https://one.google.com/ai?fixture=1")
        binary = bytes([0, 255, 128, 1])
        flow.response = http.Response.make(200, binary, {"Content-Type":"application/octet-stream"})
        self.addon.response(flow)
        self.assertEqual(flow.response.content, binary)
        self.assertEqual(self.report()["test"]["status"], "non-text")

    def test_actual_worker_serializes_concurrent_calls_and_retains_state_after_restart(self):
        message = {"kind":"response", "request":{"url":"https://one.google.com/ai?fixture=1"}, "body":"g1.ios.20tb.m.v2"}
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            results = list(pool.map(lambda _: self.worker.call(message), range(20)))
        self.assertTrue(all(result["body"] == "g1.20tb.3months_ip_75p.acq" for result in results))
        self.worker.stop()
        self.assertEqual(self.report()["scan"]["scannedResponses"], 20)


if __name__ == "__main__":
    unittest.main()
