"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const readline = require("node:readline");

const ROOT = path.resolve(__dirname, "..");
const KEYS = ["g1.sku.scan.v1", "g1.pro.annual.test.v1", "g1.sku.mappings.v1"];
const reportPattern = /^https:\/\/one\.google\.com\/g1-sku-report\/?(?:\?|$)/;
const runtimeVersion = "g1-windows-v1.0.0";

function createRuntime(directory) {
  directory = path.resolve(directory);
  fs.mkdirSync(directory, { recursive: true });
  function filename(key) {
    if (!KEYS.includes(key)) throw new Error("Unknown state key");
    return path.join(directory, key + ".json");
  }
  const storage = {
    read(key) {
      try {
        const value = fs.readFileSync(filename(key), "utf8");
        if (!value.length) throw new Error("Empty state file");
        return value;
      } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
      }
    },
    write(value, key) {
      const destination = filename(key);
      const temporary = destination + ".tmp";
      try {
        fs.writeFileSync(temporary, value, { encoding: "utf8", mode: 0o600 });
        fs.renameSync(temporary, destination);
        return fs.readFileSync(destination, "utf8") === value;
      } catch {
        return false;
      }
    }
  };
  const responseScript = new vm.Script(fs.readFileSync(path.join(ROOT, "g1-acq.js"), "utf8"), { filename: "g1-acq.js" });
  const reportSource = fs.readFileSync(path.join(ROOT, "g1-sku-report.js"), "utf8")
    .replaceAll("Shadowrocket", "G1 Windows").replaceAll("小火箭", "G1 Windows")
    .replace("本机脚本已接管 · ", "本机脚本已接管 · G1 Windows · " + runtimeVersion + " · ");
  const reportScript = new vm.Script(reportSource, { filename: "g1-sku-report.js" });

  function run(message) {
    const request = message.request || {};
    const url = request.url;
    if (!/^https:\/\/one\.google\.com\//.test(url || "")) return {};
    const isReport = reportPattern.test(url);
    if (message.kind === "response" && isReport) return {};
    if (message.kind !== "report" && message.kind !== "response") throw new Error("Invalid worker operation");
    if (message.kind === "report" && !isReport) throw new Error("Invalid report URL");
    let result;
    let completions = 0;
    const context = vm.createContext({
      $request: request,
      $response: { body: message.body },
      $persistentStore: storage,
      $done: value => { result = value; completions++; },
      console: { log() {} }
    }, { codeGeneration: { strings: false, wasm: false } });
    (isReport ? reportScript : responseScript).runInContext(context, { timeout: 2000 });
    if (completions !== 1) throw new Error("Invalid script completion");
    const output = JSON.parse(JSON.stringify(result));
    if (output.response) output.response.headers["X-G1-Runtime"] = runtimeVersion;
    return output;
  }
  return { run, storage };
}

if (require.main === module) {
  const directory = process.argv[2];
  if (!directory) throw new Error("Usage: node windows/runtime.cjs STATE_DIRECTORY");
  const runtime = createRuntime(directory);
  readline.createInterface({ input: process.stdin, crlfDelay: Infinity }).on("line", line => {
    try {
      const message = JSON.parse(line);
      const result = runtime.run(message);
      process.stdout.write(JSON.stringify({ id: message.id, result }) + "\n");
    } catch {
      process.stdout.write(JSON.stringify({ error: "G1 runtime failed; inspect local configuration and retry" }) + "\n");
    }
  });
}

module.exports = { createRuntime, reportPattern, runtimeVersion };
