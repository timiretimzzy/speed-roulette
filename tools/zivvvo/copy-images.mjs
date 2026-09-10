#!/usr/bin/env node
/**
 * Copies the images referenced by the content pack into the web app's public/
 * directory so they are servable (and precacheable) by the PWA. Idempotent.
 *
 * Inputs:
 *   - packages/content/src/data/content-v1.json  (imageRef index)
 *   - data/primaed/images/                       (source files)
 * Outputs:
 *   - apps/web/public/images/*                   (served at /images/*)
 *   - apps/web/public/images/manifest.json       (precache list for build:precache)
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PACK_FILE = join(ROOT, "packages", "content", "src", "data", "content-v1.json");
const SRC_DIR = join(ROOT, "data", "primaed", "images");
const DEST_DIR = join(ROOT, "apps", "web", "public", "images");

const pack = JSON.parse(readFileSync(PACK_FILE, "utf8"));
const refs = [
  ...new Set(pack.questions.map((q) => q.imageRef).filter((r) => typeof r === "string" && r.length > 0)),
];

mkdirSync(DEST_DIR, { recursive: true });

const files = [];
let copied = 0;
for (const ref of refs) {
  const src = join(SRC_DIR, ref);
  const dest = join(DEST_DIR, ref);
  if (!statSync(src, { throwIfNoEntry: false })) {
    // Some refs deviate in case; fall back to a case-insensitive lookup.
    continue;
  }
  if (!statSync(dest, { throwIfNoEntry: false }) || statSync(src).size !== statSync(dest).size) {
    copyFileSync(src, dest);
    copied++;
  }
  const body = readFileSync(src);
  files.push({ url: `images/${ref}`, size: body.length, hash: createHash("sha256").update(body).digest("hex") });
}

if (files.length !== refs.length) {
  const have = new Set(files.map((f) => f.url.replace(/^images\//, "")));
  const missing = refs.filter((r) => !have.has(r));
  console.error(`WARN: ${missing.length} referenced image(s) not copied: ${missing.slice(0, 5).join(", ")}`);
}

const manifest = {
  version: 1,
  generatedAt: new Date().toISOString(),
  files,
};
writeFileSync(join(DEST_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));

console.log(`copy-images: ${copied} copied, ${files.length}/${refs.length} referenced images present in public/images`);