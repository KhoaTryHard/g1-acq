/* ProxyPin 1.4+ host adapter. Bundled with the original g1-acq sources. */
var G1_PROXY_PIN_VERSION = "g1-proxypin-v1.0.0";
var G1_PROXY_PIN_ROOT = "https://one.google.com/g1-sku-report";

function g1ProxyPinIsReport(url) {
  return typeof url === "string" && /^https:\/\/one\.google\.com\/g1-sku-report\/?(?:\?|$)/.test(url);
}

function g1ProxyPinIsGoogleOne(url) {
  return typeof url === "string" && /^https:\/\/one\.google\.com\//.test(url);
}

function g1ProxyPinStore(directory) {
  if (typeof directory !== "string" || !directory) throw new Error("Application support directory unavailable");
  var keys = ["g1.sku.scan.v1", "g1.pro.annual.test.v1", "g1.sku.mappings.v1"];
  function file(key) {
    if (keys.indexOf(key) < 0) throw new Error("Unknown G1 storage key");
    return File(directory.replace(/[\\\/]$/, "") + "/" + key + ".json");
  }
  function sync(value) {
    if (value && typeof value.then === "function") throw new Error("Synchronous File API required");
    return value;
  }
  // No await between read/modify/write: the iOS JavaScriptCore/File bridge runs
  // these callbacks synchronously on ProxyPin's Dart isolate. Never cache state
  // in context.session: response scripts and Request Mapping have separate pools.
  return {
    read: function (key) {
      var target = file(key);
      var exists = sync(target.existsSync());
      if (typeof exists !== "boolean") throw new Error("File availability could not be verified");
      if (!exists) return null;
      var value = sync(target.readAsStringSync());
      if (typeof value !== "string" || value.length === 0) throw new Error("Empty or unreadable G1 state file");
      return value;
    },
    write: function (value, key) {
      if (typeof value !== "string") throw new Error("G1 state must be text");
      var target = file(key);
      sync(target.writeAsStringSync(value, false));
      return sync(target.readAsStringSync()) === value;
    }
  };
}

function g1ProxyPinStorageUnavailable() {
  return {
    read: function () { throw new Error("ProxyPin storage unavailable"); },
    write: function () { return false; }
  };
}

async function g1ProxyPinOpenStore() {
  try {
    return g1ProxyPinStore(await getApplicationSupportDirectory());
  } catch (error) {
    console.log("[g1-proxypin] application storage unavailable");
    return g1ProxyPinStorageUnavailable();
  }
}

function g1ProxyPinRemoveHeader(headers, name) {
  Object.keys(headers || {}).forEach(function (key) {
    if (key.toLowerCase() === name) delete headers[key];
  });
}

function g1ProxyPinLocalError(context, status) {
  return {
    scriptContext: context,
    statusCode: status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store",
      "X-G1-ProxyPin-Version": G1_PROXY_PIN_VERSION },
    body: "G1 ProxyPin: local report unavailable. Check the script console and storage; retry after recovery."
  };
}
