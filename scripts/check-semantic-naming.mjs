import { execFile } from "node:child_process";
import { readFile as readFileFromDisk } from "node:fs/promises";
import { basename, isAbsolute, resolve } from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

const execFileAsync = promisify(execFile);
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

const namedSequencePrefixes = Object.freeze([
  "phase",
  "task",
  "stage",
  "step",
  "part",
  "milestone",
  "gate",
  "wave",
  "workstream",
  "sprint",
  "iteration",
  "increment",
  "epic",
  "story",
]);

const provenancePathPrefixes = Object.freeze([
  "docs/roadmaps/",
  "docs/superpowers/plans/",
  "docs/superpowers/specs/",
  "docs/implementation-evidence/",
  "docs/review-packets/",
  "docs/compatibility/",
]);

const authoredPathPrefixes = Object.freeze([
  ".github/",
  "apps/",
  "packages/",
  "proofs/",
  "scripts/",
  "tests/",
  "fixtures/",
]);

const generatedPathSegments = Object.freeze([
  ".next",
  ".open-next",
  ".wrangler",
  "coverage",
  "dist",
  "node_modules",
]);

const binaryExtensions = Object.freeze([
  ".eot",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".pdf",
  ".png",
  ".ttf",
  ".wasm",
  ".webp",
  ".woff",
  ".woff2",
  ".zip",
]);

const documentaryBasenames = new Set([
  "AGENTS.md",
  "CONTRIBUTING.md",
  "README.md",
]);

const lockfileBasenames = new Set([
  "npm-shrinkwrap.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
]);

const rootAuthoredFiles = new Set([
  ".gitignore",
  ".npmrc",
  ".nvmrc",
  "eslint.config.mjs",
  "package.json",
  "pnpm-workspace.yaml",
  "tsconfig.json",
]);

const codePointCompare = (left, right) => {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
};

const escapeRegularExpression = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const caseInsensitiveLiteralPattern = (value) =>
  [...value]
    .map((character) => {
      const lower = character.toLowerCase();
      const upper = character.toUpperCase();
      return lower === upper
        ? escapeRegularExpression(character)
        : `[${escapeRegularExpression(lower)}${escapeRegularExpression(upper)}]`;
    })
    .join("");

const boundaryAfterOrdinal = String.raw`(?=$|[^A-Za-z0-9]|\p{Lu})`;
const strictBoundaryAfterOrdinal = String.raw`(?=$|[^A-Za-z0-9])`;
const numericOrdinal = String.raw`\d+(?:\.\d+)*`;
const ordinalPattern = [
  String.raw`[xX]${boundaryAfterOrdinal}`,
  String.raw`${numericOrdinal}[A-Z]${boundaryAfterOrdinal}`,
  String.raw`${numericOrdinal}[a-z]${strictBoundaryAfterOrdinal}`,
  String.raw`${numericOrdinal}${boundaryAfterOrdinal}`,
].join("|");
const namedPrefixPattern = namedSequencePrefixes
  .map(caseInsensitiveLiteralPattern)
  .join("|");
const titleCasePrefixPattern = namedSequencePrefixes
  .map((prefix) => `${prefix[0].toUpperCase()}${prefix.slice(1)}`)
  .join("|");
const compactPattern = new RegExp(
  String.raw`(?:(?<![A-Za-z0-9])[pP]|(?<=[a-z0-9])P)(?:${ordinalPattern})`,
  "gu",
);
const namedPattern = new RegExp(
  String.raw`(?:(?<![A-Za-z0-9])(?:${namedPrefixPattern})|(?<=[a-z0-9])(?:${titleCasePrefixPattern}))[\s._-]*(?:${ordinalPattern})`,
  "gu",
);

const findNamedPrefix = (value) => {
  const normalized = value.toLowerCase();
  return namedSequencePrefixes.find((prefix) => normalized.startsWith(prefix));
};

const findMatches = (value, expression, family) => {
  expression.lastIndex = 0;
  return [...value.matchAll(expression)].map((match) => {
    const finding = {
      family,
      index: match.index,
      value: match[0],
    };
    if (family === "named-sequence") {
      return {
        ...finding,
        prefix: findNamedPrefix(match[0]),
      };
    }
    return finding;
  });
};

export function findSequencingLabels(value) {
  if (typeof value !== "string") {
    throw new TypeError("SEMANTIC_NAMING_VALUE_INVALID");
  }

  return [
    ...findMatches(value, compactPattern, "compact-phase"),
    ...findMatches(value, namedPattern, "named-sequence"),
  ].sort(
    (left, right) =>
      left.index - right.index ||
      codePointCompare(left.family, right.family) ||
      codePointCompare(left.value, right.value),
  );
}

const isWithinPath = (path, prefix) =>
  path === prefix.slice(0, -1) || path.startsWith(prefix);

const hasGeneratedPathSegment = (path) => {
  const segments = path.split("/");
  return segments.some((segment) => generatedPathSegments.includes(segment));
};

const isProductMarkdown = (path) =>
  path.startsWith("fixtures/") || path.includes("/templates/");

const hasBinaryExtension = (path) => {
  const normalized = path.toLowerCase();
  return binaryExtensions.some((extension) => normalized.endsWith(extension));
};

export function classifySemanticNamingPath(path) {
  const pathPolicy = provenancePathPrefixes.some((prefix) =>
    isWithinPath(path, prefix),
  )
    ? "allow-sequencing-labels"
    : "require-semantic-name";

  if (
    path.startsWith("docs/") ||
    hasGeneratedPathSegment(path) ||
    hasBinaryExtension(path) ||
    lockfileBasenames.has(basename(path))
  ) {
    return { contentPolicy: "skip", pathPolicy };
  }

  if (documentaryBasenames.has(basename(path)) && !isProductMarkdown(path)) {
    return { contentPolicy: "skip", pathPolicy };
  }

  const contentPolicy =
    rootAuthoredFiles.has(path) ||
    authoredPathPrefixes.some((prefix) => isWithinPath(path, prefix))
      ? "scan"
      : "skip";
  return { contentPolicy, pathPolicy };
}

const defaultRunGit = async ({ args, command, cwd }) => {
  const { stdout } = await execFileAsync(command, args, {
    cwd,
    encoding: "buffer",
    maxBuffer: 16 * 1024 * 1024,
  });
  return stdout;
};

const decodeUtf8 = (value, errorCode) => {
  if (typeof value === "string") {
    return value;
  }
  try {
    return utf8Decoder.decode(value);
  } catch {
    throw new TypeError(errorCode);
  }
};

export async function listRepositoryPaths({ root, runGit = defaultRunGit }) {
  const call = {
    args: [
      "ls-files",
      "-z",
      "--cached",
      "--others",
      "--exclude-standard",
    ],
    command: "git",
    cwd: root,
  };
  const result = await runGit(call);
  const output = result?.stdout ?? result;
  const decoded = decodeUtf8(output, "SEMANTIC_NAMING_GIT_OUTPUT_INVALID");
  return decoded
    .split("\0")
    .filter((path) => path.length > 0)
    .sort(codePointCompare);
}

const validateRepositoryPath = (path) => {
  const segments = path.split("/");
  if (
    typeof path !== "string" ||
    path.length === 0 ||
    isAbsolute(path) ||
    path.includes("\\") ||
    /[\0-\x1f\x7f]/u.test(path) ||
    segments.some(
      (segment) =>
        segment.length === 0 || segment === "." || segment === "..",
    )
  ) {
    throw new TypeError("SEMANTIC_NAMING_PATH_INVALID");
  }
};

const sourceLocation = (source, index) => {
  const precedingSource = source.slice(0, index);
  const lines = precedingSource.split("\n");
  return {
    column: lines.at(-1).length + 1,
    line: lines.length,
  };
};

const findingCompare = (left, right) =>
  codePointCompare(left.path, right.path) ||
  left.line - right.line ||
  left.column - right.column ||
  codePointCompare(left.family, right.family) ||
  codePointCompare(left.value, right.value) ||
  codePointCompare(left.kind, right.kind);

export async function scanRepository({
  root,
  paths,
  readFile = readFileFromDisk,
}) {
  const repositoryPaths = paths ?? (await listRepositoryPaths({ root }));
  const sortedPaths = [...new Set(repositoryPaths)].sort(codePointCompare);
  for (const path of sortedPaths) {
    validateRepositoryPath(path);
  }

  const findings = [];
  for (const path of sortedPaths) {
    const classification = classifySemanticNamingPath(path);
    if (classification.pathPolicy === "require-semantic-name") {
      for (const match of findSequencingLabels(path)) {
        findings.push({
          column: match.index + 1,
          family: match.family,
          kind: "path",
          line: 1,
          path,
          value: match.value,
        });
      }
    }

    if (classification.contentPolicy !== "scan") {
      continue;
    }

    let content;
    try {
      content = await readFile(resolve(root, path));
    } catch {
      throw new TypeError(`SEMANTIC_NAMING_READ_FAILED:${path}`);
    }
    const source = decodeUtf8(content, `SEMANTIC_NAMING_TEXT_INVALID:${path}`);
    for (const match of findSequencingLabels(source)) {
      findings.push({
        ...sourceLocation(source, match.index),
        family: match.family,
        kind: "content",
        path,
        value: match.value,
      });
    }
  }

  return findings.sort(findingCompare);
}

const run = async () => {
  const root = resolve(import.meta.dirname, "..");
  const findings = await scanRepository({ root });
  for (const finding of findings) {
    process.stderr.write(
      `${finding.path}:${finding.line}:${finding.column} [${finding.family}] sequencing label is not allowed\n`,
    );
  }
  if (findings.length > 0) {
    process.exitCode = 1;
  }
};

const isDirectInvocation =
  process.argv[1] !== undefined &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isDirectInvocation) {
  run().catch((error) => {
    const message =
      error instanceof Error ? error.message : "SEMANTIC_NAMING_CHECK_FAILED";
    process.stderr.write(`semantic naming check failed: ${message}\n`);
    process.exitCode = 1;
  });
}
