"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {createRuntime} = require("../windows/runtime.cjs");
const ROOT = "https://one.google.com/g1-sku-report";
const TWENTY = "g1.ios.20tb.m.v2";
function setup(t) {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),"g1-windows-test-"));
  t.after(()=>{
    assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));
    assert(path.basename(directory).startsWith("g1-windows-test-"));
    fs.rmSync(directory,{recursive:true});
  });
  const runtime=createRuntime(directory);
  const json=()=>JSON.parse(runtime.run({kind:"report",request:{url:ROOT+"?format=json"}}).response.body);
  const post=fields=>runtime.run({kind:"report",request:{url:ROOT,method:"POST",headers:{Origin:"https://one.google.com","Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams(fields).toString()}}).response;
  return {directory,runtime,json,post};
}
test("Windows host shares source logic, uses durable verified files and survives worker recreation",t=>{
  const h=setup(t);
  assert.equal(h.post({action:"preset",revision:h.json().mappingConfig.revision,preset:"ultra-75p"}).status,303);
  const result=h.runtime.run({kind:"response",request:{url:"https://one.google.com/ai?test=1"},body:JSON.stringify({sku:TWENTY,price:2250000,label:"Ưu đãi"})});
  assert.deepEqual(JSON.parse(result.body),{sku:"g1.20tb.3months_ip_75p.acq",price:2250000,label:"Ưu đãi"});
  const restarted=createRuntime(h.directory);
  const report=JSON.parse(restarted.run({kind:"report",request:{url:ROOT+"?format=json"}}).response.body);
  assert.equal(report.test.status,"rewritten");
  assert.equal(report.test.mappingRevision,report.mappingConfig.revision);
  assert.equal(report.scan.scannedResponses,1);
  assert.equal(fs.readdirSync(h.directory).length,3);
});
test("Windows report is local, labels its host and rejects cross-origin edits and stale forms",t=>{
  const h=setup(t);
  const original=h.json().mappingConfig.revision;
  const html=h.runtime.run({kind:"report",request:{url:ROOT}}).response;
  assert(html.body.includes("G1 Windows · g1-windows-v1.0.0"));
  assert.equal(html.headers["X-G1-Runtime"],"g1-windows-v1.0.0");
  assert.equal(h.post({action:"preset",revision:original,preset:"ultra-75p"}).status,303);
  assert.equal(h.post({action:"reset",revision:original}).status,409);
  const denied=h.runtime.run({kind:"report",request:{url:ROOT,method:"POST",headers:{Origin:"https://evil.test"},body:"action=reset"}}).response;
  assert.equal(denied.status,403);
});
test("Windows handles storage failures without silently choosing defaults and excludes other hosts",t=>{
  const h=setup(t);
  assert.deepEqual(h.runtime.run({kind:"response",request:{url:"https://evil.test/ai?"},body:TWENTY}),{});
  fs.writeFileSync(path.join(h.directory,"g1.sku.mappings.v1.json"),"");
  const result=h.runtime.run({kind:"response",request:{url:"https://one.google.com/ai?"},body:TWENTY});
  assert.deepEqual(result,{});
  assert.equal(h.json().mappingConfig.status,"unavailable");
  assert.equal(h.json().test.status,"config-error");
});
test("Windows report is not counted; binary and no-match responses retain original data",t=>{
  const h=setup(t);
  assert.deepEqual(h.runtime.run({kind:"response",request:{url:ROOT},body:TWENTY}),{});
  assert.deepEqual(h.runtime.run({kind:"response",request:{url:"https://one.google.com/ai?"},body:null}),{});
  assert.equal(h.json().test.status,"non-text");
  assert.deepEqual(h.runtime.run({kind:"response",request:{url:"https://one.google.com/ai?"},body:"no SKU"}),{});
  assert.equal(h.json().test.status,"no-match");
});
