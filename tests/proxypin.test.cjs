"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { spawnSync } = require("node:child_process");
const { gzipSync, gunzipSync } = require("node:zlib");
const { test } = require("node:test");
const root = path.resolve(__dirname, "..");
const ROOT = "https://one.google.com/g1-sku-report";
const ORIGIN = "https://one.google.com";
const DIR = "/app/support";
const CONFIG = DIR + "/g1.sku.mappings.v1.json";
const SCAN = DIR + "/g1.sku.scan.v1.json";
const EXECUTION = DIR + "/g1.pro.annual.test.v1.json";
const source = fs.readFileSync(path.join(root, "proxypin/g1-acq-proxypin.js"), "utf8");
const report = fs.readFileSync(path.join(root, "proxypin/g1-report-proxypin.js"), "utf8");
const TWENTY = "g1.ios.20tb.m.v2";
const THIRTY = "g1.ios.30tb.ai.pro.m";
const TARGET20 = "g1.20tb.3months_ip_75p.acq";
const TARGET30 = "g1.ai.ultra.3months_ip_75p.acq";
const plain = value => JSON.parse(JSON.stringify(value));
function host(options = {}) {
  const files = options.files || new Map();
  const reads = [], writes = [], logs = [];
  const sandbox = {
    console: { log: value => logs.push(String(value)) },
    getApplicationSupportDirectory: async () => {
      if (options.directoryError) throw new Error("directory denied");
      return DIR;
    },
    File: filename => {
      assert([CONFIG, SCAN, EXECUTION].includes(filename), "unexpected file access: " + filename);
      return {
        existsSync() { if (options.readError) throw new Error("read denied"); return files.has(filename); },
        readAsStringSync() {
          reads.push(filename);
          if (options.readError) throw new Error("read denied");
          if (options.promiseRead) return Promise.resolve(files.get(filename));
          return files.get(filename);
        },
        writeAsStringSync(value, append) {
          assert.equal(append, false);
          if (options.writeError) throw new Error("write denied");
          writes.push(filename);
          files.set(filename, options.badReadback ? "{}" : value);
        }
      };
    }
  };
  const responseContext = vm.createContext({ ...sandbox });
  const reportContext = vm.createContext({ ...sandbox });
  new vm.Script(source).runInContext(responseContext);
  new vm.Script(report).runInContext(reportContext);
  return {
    files, reads, writes, logs,
    request(url = ORIGIN + "/ai?fixture=1") { return {url, method: "GET", headers: {}, body: "", scriptContext: {session: {}}}; },
    async response(body, url = ORIGIN + "/ai?fixture=1", headers = {}) {
      const request = this.request(url);
      const before = plain(request);
      assert.deepEqual(plain(await responseContext.onRequest(request.scriptContext, request)), before);
      const response = {statusCode: 200, headers, body, scriptContext: request.scriptContext};
      return responseContext.onResponse(request.scriptContext, request, response);
    },
    page(url = ROOT, method = "GET", body = "", headers = {}) {
      return reportContext.onRequest({session: {}}, {url, method, body, headers});
    },
    async json() { return JSON.parse((await this.page(ROOT + "?format=json")).body); },
    async post(fields, headers = {Origin: ORIGIN, "Content-Type": "application/x-www-form-urlencoded"}) {
      return this.page(ROOT, "POST", new URLSearchParams(fields).toString(), headers);
    }
  };
}

test("import packages use ProxyPin's actual URL parsing and embed self-contained local scripts", () => {
  const scripts = JSON.parse(fs.readFileSync(path.join(root, "proxypin/g1-scripts.json")));
  const maps = JSON.parse(fs.readFileSync(path.join(root, "proxypin/g1-request-map.json")));
  assert.equal(scripts.length, 1);
  assert.equal(maps.length, 1);
  assert.equal(scripts[0].script, source);
  assert.equal(maps[0].item.script, report);
  assert.equal(maps[0].type, "script");
  const scriptMatch = new RegExp(scripts[0].url.replaceAll("*", ".*"));
  const mapMatch = new RegExp(maps[0].url.replaceAll("*", ".*").replace("?", "\\?"));
  // ProxyPin HttpRequest.domainPath is remoteDomain() + path; remoteDomain()
  // includes the scheme (pinned ProxyPin v1.4.0 network/http/http.dart).
  assert(scriptMatch.test("https://one.google.com/ai"));
  assert(scriptMatch.test("https://one.google.com/plans"));
  assert(!scriptMatch.test("https://evil.one.google.com/ai"));
  assert(!scriptMatch.test("http://one.google.com/ai"));
  assert(!scriptMatch.test("https://oneXgoogleXcom/ai"));
  for (const suffix of ["", "/", "?", "?format=json", "/?format=json"]) assert(mapMatch.test(ROOT + suffix), suffix);
  for (const url of [ROOT + "evil", ORIGIN + "/ai?x=1", "https://evil.test/g1-sku-report", "https://oneXgoogleXcom/g1-sku-report"]) assert(!mapMatch.test(url), url);
  assert(!scripts[0].remoteUrl);
});

test("Ultra rewrite collects original SKU and changes only full tokens, preserving UTF-8 and prices", async () => {
  const h = host();
  const body = JSON.stringify({name:"Ultra tiếng Việt 日本語", sku:[TWENTY, THIRTY, "x" + TWENTY], price:123.45, renewal:999.99});
  const headers = {"Content-Type":"application/json; charset=utf-8", "Content-Encoding":"gzip", "content-length":"123", "Set-Cookie":["a=1", "b=2"]};
  const result = await h.response(body, undefined, headers);
  assert.equal(result.body, body.replace('"' + TWENTY + '"', '"' + TARGET20 + '"').replace('"' + THIRTY + '"', '"' + TARGET30 + '"'));
  assert.deepEqual(result.headers["Set-Cookie"], ["a=1", "b=2"]);
  assert(!Object.keys(result.headers).some(k => /content-encoding|content-length/i.test(k)));
  const data = await h.json();
  assert.equal(data.test.hitCount, 2);
  assert.equal(data.test.version, "g1-acq-v7.11-mappings");
  assert.equal(data.test.status, "rewritten");
  assert(h.files.get(SCAN).includes(TWENTY));
  assert(!h.files.get(SCAN).includes(TARGET20));
});

test("unmatched domains and report traffic are untouched and never access storage", async () => {
  const h = host();
  for (const url of ["https://evil.test/ai?", "https://one.google.com.evil.test/ai?", "http://one.google.com/ai?", ROOT, ROOT + "/?format=json"]) {
    assert.equal((await h.response(TWENTY, url)).body, TWENTY);
  }
  assert.equal(h.reads.length, 0);
  assert.equal(h.writes.length, 0);
  assert.equal((await h.page("https://evil.test/report")).statusCode, 404);
});

test("decoded compressed response can be returned as correct UTF-8 bytes without stale encoding metadata", async () => {
  const h = host();
  const original = JSON.stringify({sku:TWENTY, label:"Ưu đãi Ultra 日本語", price:999.99});
  // ProxyPin calls decodeBodyString before onResponse and encodes according to
  // the response charset afterwards; model that boundary with real gzip bytes.
  const wire = gzipSync(Buffer.from(original, "utf8"));
  const response = await h.response(gunzipSync(wire).toString("utf8"), undefined,
    {"Content-Type":"application/json; charset=utf-8", "Content-Encoding":"gzip", "Content-Length":String(wire.length)});
  const client = JSON.parse(Buffer.from(response.body,"utf8").toString("utf8"));
  assert.equal(client.sku,TARGET20);
  assert.equal(client.label,"Ưu đãi Ultra 日本語");
  assert.equal(client.price,999.99);
  assert.equal(response.headers["Content-Encoding"],undefined);
  assert.equal(response.headers["Content-Length"],undefined);
});

test("nontext, no-match and other Google One paths retain content and record actual status", async () => {
  const h = host();
  const binary = [0,255,128,1];
  assert.strictEqual((await h.response(binary)).body, binary);
  assert.equal((await h.json()).test.status, "non-text");
  assert.equal((await h.response("plain text")).body, "plain text");
  assert.equal((await h.json()).test.status, "no-match");
  assert.equal((await h.response(TWENTY, ORIGIN + "/plans")).body, TWENTY);
});

test("native report GET/JSON, preset POST/303 and response share durable files across independent hosts", async () => {
  const h = host();
  const page = await h.page();
  assert.equal(page.statusCode, 200);
  assert(page.body.includes("ProxyPin · g1-proxypin-v1.0.0"));
  assert.equal(page.headers["X-G1-ProxyPin-Version"], "g1-proxypin-v1.0.0");
  assert.equal(h.writes.length, 0);
  const before = await h.json();
  const saved = await h.post({action:"preset", revision:before.mappingConfig.revision, preset:"ultra-75p"});
  assert.equal(saved.statusCode, 303);
  assert.equal(saved.headers.Location, ROOT + "?notice=preset");
  const current = await h.json();
  assert.equal(current.mappingConfig.mode, "custom");
  const restarted = host({files:h.files});
  await restarted.response(TWENTY);
  const next = await restarted.json();
  assert.equal(next.test.mappingRevision, current.mappingConfig.revision);
  assert.equal(next.test.matchedFrom[0].to, TARGET20);
  assert.equal((await restarted.post({action:"reset", revision:before.mappingConfig.revision})).statusCode, 409);
});

test("all four presets, manual rules, disable/delete/reset and form origin checks work through actual host hooks", async () => {
  const h = host();
  for (const preset of ["pro-1yuan","tr-ultra-30tb","ultra-75p","pro-12months-90p"]) {
    const data = await h.json();
    assert.equal((await h.post({action:"preset", revision:data.mappingConfig.revision, preset})).statusCode, 303);
  }
  assert.equal((await h.post({action:"reset", revision:(await h.json()).mappingConfig.revision}, {Origin:"https://evil.test","Content-Type":"application/x-www-form-urlencoded"})).statusCode, 403);
  const data = await h.json();
  const fields = {action:"upsert", revision:data.mappingConfig.revision, id:"", match:"exact", from:TWENTY, to:"g1.custom.offer", enabled:"1"};
  // Update the existing exact rule, preserving its ID.
  fields.id = data.mappingConfig.rules.find(rule => rule.from === TWENTY).id;
  assert.equal((await h.post(fields)).statusCode, 303);
  assert.equal((await h.response(TWENTY)).body, "g1.custom.offer");
  const updated = await h.json();
  delete fields.enabled;
  fields.revision = updated.mappingConfig.revision;
  assert.equal((await h.post(fields)).statusCode, 303);
  assert.equal((await h.response(TWENTY)).body, TWENTY);
  assert.equal((await h.post({action:"delete", id:fields.id, revision:(await h.json()).mappingConfig.revision})).statusCode, 303);
  assert.equal((await h.post({action:"reset", revision:(await h.json()).mappingConfig.revision})).statusCode, 303);
  assert.equal((await h.json()).mappingConfig.mode, "discount75");
});

test("storage read/write/readback failures are visible and never silently select default rules", async () => {
  for (const options of [{directoryError:true}, {readError:true}, {files:new Map([[CONFIG, ""]])}, {files:new Map([[CONFIG,"{}"]]), promiseRead:true}]) {
    const h = host(options);
    assert.equal((await h.response(TWENTY)).body, TWENTY);
    const data = await h.json();
    assert.equal(data.mappingConfig.status, "unavailable");
    assert.equal(data.mappingConfig.rules.length, 0);
  }
  for (const options of [{writeError:true}, {badReadback:true}]) {
    const h = host(options);
    const result = await h.post({action:"preset", revision:"defaults-75p-v1", preset:"ultra-75p"});
    assert.equal(result.statusCode, 503);
    assert(!result.headers.Location);
  }
  const h = host({files:new Map([[CONFIG,"invalid json"]])});
  assert.equal((await h.response(TWENTY)).body, TWENTY);
  assert.equal((await h.json()).mappingConfig.status, "invalid");
});

test("overlapping hooks read fresh files and a stale form cannot overwrite a newly saved rule", async () => {
  const h = host();
  await Promise.all(Array.from({length:20}, () => host({files:h.files}).response(TWENTY)));
  const data = await h.json();
  assert.equal(data.scan.scannedResponses, 20);
  assert.equal(data.scan.recentResponses.length, 10);
  const fields = {action:"preset", revision:data.mappingConfig.revision, preset:"ultra-75p"};
  const results = await Promise.all([h.post(fields), h.post(fields)]);
  assert.deepEqual(results.map(r=>r.statusCode), [303,409]);
  assert(h.files.has(CONFIG));
});

test("generated artifacts stay synchronized and check mode is read-only", () => {
  const filenames = ["proxypin/g1-acq-proxypin.js","proxypin/g1-report-proxypin.js","proxypin/g1-scripts.json","proxypin/g1-request-map.json"];
  const before = filenames.map(f=>fs.readFileSync(path.join(root,f)));
  const result = spawnSync(process.execPath, ["tools/build-proxypin.cjs","--check"], {cwd:root, encoding:"utf8"});
  assert.equal(result.status, 0, result.stderr);
  filenames.forEach((f,i)=>assert.deepEqual(fs.readFileSync(path.join(root,f)),before[i]));
});
