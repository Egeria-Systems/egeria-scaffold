import { constants } from "node:fs";
import { lstat, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const manifestName = "packet-files.txt";
const recordName = "packet.md";
const scratchNames = new Set([
  ".git",
  "node_modules",
  ".pnpm",
  ".pnpm-store",
  "pnpm-store",
  ".next",
  ".open-next",
  ".wrangler",
  "dist",
  "playwright-browsers",
  "native-browsers",
  "ms-playwright",
]);
const storeEntries = new Set(["files", "index", "index.db", "projects"]);
const archiveSuffix = /\.(?:zip|tar|gz|tgz|xz|bz2|zst|7z|rar|dmg|pkg)$/iu;

class PacketRefusal extends Error {}

function refuse(relativePath, reason) {
  const displayPath = relativePath.length > 240
    ? relativePath.slice(0, 237) + "..."
    : relativePath;
  throw new PacketRefusal(JSON.stringify(displayPath) + " " + reason);
}

function relativeComponents(path) {
  if (/[\u0000-\u001f\u007f\\]/u.test(path) || /^[a-z]:/iu.test(path)) {
    return null;
  }
  const components = path.split("/");
  return components.some((part) => part === "" || part === "." || part === "..")
    ? null
    : components;
}

async function inspect(relativePath, operation) {
  try {
    return await operation();
  } catch (error) {
    refuse(relativePath, "could not be inspected (" + (error.code ?? "unknown error") + ").");
  }
}

async function resolvePacketDirectory(components) {
  let target = process.cwd();
  for (const component of components) {
    target = join(target, component);
    const entry = await inspect(".", () => lstat(target));
    if (!entry.isDirectory()) {
      refuse(".", "requires real directories along the packet path.");
    }
  }
  return target;
}

async function readInventory(packetDirectory) {
  const manifest = join(packetDirectory, manifestName);
  const entry = await inspect(manifestName, () => lstat(manifest));
  if (!entry.isFile()) {
    refuse(manifestName, "must be a regular file.");
  }

  const content = await inspect(manifestName, () => readFile(manifest, {
    encoding: "utf8",
    flag: constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
  }));
  const lines = content.replace(/\r\n/gu, "\n").split("\n");
  if (lines.at(-1) === "") lines.pop();

  const files = new Set([manifestName]);
  const directories = new Set();
  for (const [index, relativePath] of lines.entries()) {
    const components = relativeComponents(relativePath);
    if (!components || components[0].toLowerCase() === manifestName || files.has(relativePath)) {
      refuse(manifestName, "has an invalid or duplicate file path on line " + (index + 1) + ".");
    }

    const names = components.map((component) => component.toLowerCase());
    const disposablePath = names.some((name, offset) => {
      const child = names[offset + 1];
      const isPnpmCache = child === "pnpm" && (
        name === "cache" || name === ".cache" ||
        (name === "caches" && names[offset - 1] === "library")
      );
      return scratchNames.has(name) ||
        isPnpmCache ||
        (name === "store" && /^v\d+$/u.test(child ?? "") && storeEntries.has(names[offset + 2]));
    });
    if (disposablePath) {
      refuse(relativePath, "is part of a disposable installation, cache, build or checkout.");
    }
    if (archiveSuffix.test(relativePath)) {
      refuse(relativePath, "is an archive. Preserve exact archives in their approved private location.");
    }

    files.add(relativePath);
    for (let count = 1; count < components.length; count++) {
      directories.add(components.slice(0, count).join("/"));
    }
  }

  if (!files.has(recordName)) {
    refuse(recordName, "must be declared in " + manifestName + ".");
  }
  return { files, directories };
}

async function checkContents(packetDirectory, { files, directories }) {
  const pendingDirectories = [""];
  let fileCount = 0;
  let logicalBytes = 0;

  while (pendingDirectories.length > 0) {
    const relativeDirectory = pendingDirectories.pop();
    const directory = join(packetDirectory, relativeDirectory);
    const entries = await inspect(relativeDirectory || ".", () => readdir(directory));
    for (const name of entries.sort()) {
      const relativePath = relativeDirectory ? relativeDirectory + "/" + name : name;
      const expectsFile = files.has(relativePath);
      const expectsDirectory = directories.has(relativePath);
      if (!expectsFile && !expectsDirectory) {
        refuse(relativePath, "was not declared in " + manifestName + ".");
      }

      const entry = await inspect(relativePath, () => lstat(join(directory, name)));
      if (expectsFile && entry.isFile()) {
        files.delete(relativePath);
        fileCount++;
        logicalBytes += entry.size;
      } else if (expectsDirectory && entry.isDirectory()) {
        pendingDirectories.push(relativePath);
      } else {
        refuse(relativePath, "has the wrong entry type. Use regular files and real directories.");
      }
    }
  }

  if (files.size > 0) {
    refuse(files.values().next().value, "is declared but missing.");
  }
  return { fileCount, logicalBytes };
}

async function main(args) {
  const components = args.length === 1 ? relativeComponents(args[0]) : null;
  if (!components || components.length < 3 || components[0] !== "docs" || components[1] !== "review-packets") {
    process.stderr.write("Usage: node scripts/check-review-packet.mjs docs/review-packets/<packet>\n");
    process.exitCode = 2;
    return;
  }

  try {
    const packetDirectory = await resolvePacketDirectory(components);
    const inventory = await readInventory(packetDirectory);
    const { fileCount, logicalBytes } = await checkContents(packetDirectory, inventory);
    process.stdout.write("Review packet accepted (" + fileCount + " files, " + logicalBytes + " logical bytes).\n");
  } catch (error) {
    const detail = error instanceof PacketRefusal ? error.message : "inspection failed.";
    process.stderr.write("Review packet rejected. " + detail + "\n");
    process.exitCode = 1;
  }
}

await main(process.argv.slice(2));
