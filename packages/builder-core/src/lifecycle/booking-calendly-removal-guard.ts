import { posix } from "node:path";

import ts from "typescript";

import { safeRelativePathSchema } from "../contracts/identifiers.js";
import type { GeneratedFile } from "../generation/render-skeleton.js";
import type { RepositoryReader } from "../repository/repository-reader.js";
import type {
  GitRepositoryInventoryEntry,
  GitRepositoryInventoryInspection,
} from "./git-worktree-inspection.js";

const maximumScannedTextBytes = 32 * 1024 * 1024;
const lifecycleControlPrefix = ".egeria/";
const sourceExtensions = [
  ".cjs",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
] as const;
const parsedExtensions = new Set([...sourceExtensions, ".json"]);
const exactConfigurationAndScriptExtensions = new Set([
  ".bash",
  ".json",
  ".jsonc",
  ".sh",
  ".toml",
  ".yaml",
  ".yml",
  ".zsh",
]);
const virtualRepositoryRoot = "/repository";
const moduleResolutionOptions: ts.CompilerOptions = {
  allowJs: true,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  resolveJsonModule: true,
};
const referenceToken = /(?:booking-calendly|calendly)/iu;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

export type CapabilityRemovalReferenceWarning = Readonly<{
  code:
    | "CAPABILITY_REMOVAL_DYNAMIC_REFERENCE_POSSIBLE"
    | "CAPABILITY_REMOVAL_HEURISTIC_REFERENCE_POSSIBLE"
    | "CAPABILITY_REMOVAL_REFERENCE_COVERAGE_INCOMPLETE";
  path?: string;
}>;

export type BookingCalendlyRemovalGuardResult =
  | Readonly<{
      ok: true;
      warnings: readonly CapabilityRemovalReferenceWarning[];
    }>
  | Readonly<{
      ok: false;
      conflicts: readonly string[];
    }>;

type ProjectedAction = Readonly<{
  kind:
    | "delete-file"
    | "preserve-file-and-eject"
    | "replace-file"
    | "replace-project-configuration";
  path: string;
}>;

type RepositoryModuleResolution = Readonly<{
  files: ReadonlySet<string>;
  directories: ReadonlySet<string>;
}>;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function warningKey(warning: CapabilityRemovalReferenceWarning): string {
  return `${warning.code}\0${warning.path ?? ""}`;
}

function sortedWarnings(
  warnings: readonly CapabilityRemovalReferenceWarning[],
): readonly CapabilityRemovalReferenceWarning[] {
  return [...new Map(warnings.map((warning) => [warningKey(warning), warning])).values()]
    .sort((left, right) => {
      const codeComparison = compareText(left.code, right.code);
      return codeComparison === 0
        ? compareText(left.path ?? "", right.path ?? "")
        : codeComparison;
    });
}

function scriptKind(path: string): ts.ScriptKind {
  switch (posix.extname(path).toLowerCase()) {
    case ".cjs":
    case ".js":
    case ".mjs":
      return ts.ScriptKind.JS;
    case ".jsx":
      return ts.ScriptKind.JSX;
    case ".json":
      return ts.ScriptKind.JSON;
    case ".tsx":
      return ts.ScriptKind.TSX;
    default:
      return ts.ScriptKind.TS;
  }
}

function localSpecifierBase(
  sourcePath: string,
  specifier: string,
): string | undefined {
  const suffixIndex = specifier.search(/[?#]/u);
  const pathSpecifier = suffixIndex < 0
    ? specifier
    : specifier.slice(0, suffixIndex);
  let candidate: string;

  if (pathSpecifier.startsWith("@/")) {
    candidate = posix.join("apps/web", pathSpecifier.slice(2));
  } else if (
    pathSpecifier.startsWith("./") ||
    pathSpecifier.startsWith("../")
  ) {
    candidate = posix.join(posix.dirname(sourcePath), pathSpecifier);
  } else if (pathSpecifier.startsWith("/")) {
    candidate = pathSpecifier.slice(1);
  } else if (pathSpecifier.startsWith("apps/")) {
    candidate = pathSpecifier;
  } else {
    return undefined;
  }

  const normalized = posix.normalize(candidate);
  return safeRelativePathSchema.safeParse(normalized).success
    ? normalized
    : undefined;
}

function repositoryModuleResolution(
  entries: readonly GitRepositoryInventoryEntry[],
): RepositoryModuleResolution {
  const files = new Set<string>();
  const directories = new Set([virtualRepositoryRoot]);

  for (const entry of entries) {
    if (entry.kind !== "file") {
      continue;
    }

    files.add(posix.join(virtualRepositoryRoot, entry.path));
    let directory = posix.dirname(entry.path);
    while (directory !== ".") {
      directories.add(posix.join(virtualRepositoryRoot, directory));
      directory = posix.dirname(directory);
    }
  }

  return { files, directories };
}

function resolvesToDeletedPath(
  sourcePath: string,
  specifier: string,
  deletedPaths: ReadonlySet<string>,
  resolution: RepositoryModuleResolution,
  resolveWithBundler: boolean,
): boolean {
  const base = localSpecifierBase(sourcePath, specifier);
  if (base === undefined) {
    return false;
  }
  if (deletedPaths.has(base)) {
    return true;
  }
  if (!resolveWithBundler) {
    return false;
  }

  const containingFile = posix.join(virtualRepositoryRoot, sourcePath);
  const target = posix.join(virtualRepositoryRoot, base);
  const relativeTarget = posix.relative(posix.dirname(containingFile), target);
  const localSpecifier = relativeTarget.startsWith(".")
    ? relativeTarget
    : `./${relativeTarget}`;
  const resolved = ts.resolveModuleName(
    localSpecifier,
    containingFile,
    moduleResolutionOptions,
    {
      fileExists: (path) => resolution.files.has(posix.normalize(path)),
      readFile: () => undefined,
      directoryExists: (path) =>
        resolution.directories.has(posix.normalize(path)),
      realpath: (path) => path,
    },
  ).resolvedModule?.resolvedFileName;

  if (resolved === undefined) {
    return false;
  }

  const repositoryPath = posix.relative(
    virtualRepositoryRoot,
    posix.normalize(resolved),
  );
  return safeRelativePathSchema.safeParse(repositoryPath).success &&
    deletedPaths.has(repositoryPath);
}

function literalText(expression: ts.Expression | undefined): string | undefined {
  return expression !== undefined &&
    (ts.isStringLiteral(expression) ||
      ts.isNoSubstitutionTemplateLiteral(expression))
    ? expression.text
    : undefined;
}

function isRequireCall(expression: ts.LeftHandSideExpression): boolean {
  return (
    (ts.isIdentifier(expression) && expression.text === "require") ||
    (ts.isPropertyAccessExpression(expression) &&
      ts.isIdentifier(expression.expression) &&
      expression.expression.text === "require" &&
      expression.name.text === "resolve")
  );
}

function analyzeParsedSource(input: Readonly<{
  path: string;
  source: string;
  deletedPaths: ReadonlySet<string>;
  resolution: RepositoryModuleResolution;
}>): Readonly<{ exact: boolean; dynamic: boolean }> {
  const sourceFile = ts.createSourceFile(
    input.path,
    input.source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(input.path),
  );
  let exact = false;
  let dynamic = false;

  function inspectSpecifier(
    value: string,
    resolveWithBundler: boolean,
  ): void {
    if (
      resolvesToDeletedPath(
        input.path,
        value,
        input.deletedPaths,
        input.resolution,
        resolveWithBundler,
      )
    ) {
      exact = true;
    }
  }

  function visit(node: ts.Node): void {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      inspectSpecifier(node.moduleSpecifier.text, true);
    }

    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteralLike(node.argument.literal)
    ) {
      inspectSpecifier(node.argument.literal.text, true);
    }

    if (ts.isCallExpression(node)) {
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = isRequireCall(node.expression);

      if (isDynamicImport || isRequire) {
        const value = literalText(node.arguments[0]);
        if (value === undefined) {
          dynamic = true;
        } else {
          inspectSpecifier(value, isDynamicImport);
        }
      }
    }

    if (ts.isStringLiteralLike(node)) {
      inspectSpecifier(node.text, false);
    }

    ts.forEachChild(node, visit);
  }

  for (const reference of [
    ...sourceFile.referencedFiles,
    ...sourceFile.typeReferenceDirectives,
    ...sourceFile.libReferenceDirectives,
  ]) {
    inspectSpecifier(reference.fileName, true);
  }
  for (const dependency of sourceFile.amdDependencies) {
    inspectSpecifier(dependency.path, true);
  }

  visit(sourceFile);
  return { exact, dynamic };
}

function projectedContent(input: Readonly<{
  entry: GitRepositoryInventoryEntry;
  replacements: ReadonlyMap<string, string>;
  deletedPaths: ReadonlySet<string>;
}>): Readonly<{ kind: "deleted" | "inventory" }> | Readonly<{
  kind: "replacement";
  content: string;
}> {
  if (input.deletedPaths.has(input.entry.path)) {
    return { kind: "deleted" };
  }

  const replacement = input.replacements.get(input.entry.path);
  return replacement === undefined
    ? { kind: "inventory" }
    : { kind: "replacement", content: replacement };
}

function coverageWarning(path?: string): CapabilityRemovalReferenceWarning {
  return {
    code: "CAPABILITY_REMOVAL_REFERENCE_COVERAGE_INCOMPLETE",
    ...(path === undefined ? {} : { path }),
  };
}

export async function guardBookingCalendlyRemovalReferences(input: Readonly<{
  reader: RepositoryReader;
  inventory: Extract<GitRepositoryInventoryInspection, Readonly<{ ok: true }>>["value"];
  actions: readonly ProjectedAction[];
  desiredFiles: readonly GeneratedFile[];
}>): Promise<BookingCalendlyRemovalGuardResult> {
  const desiredFiles = new Map(
    input.desiredFiles.map((file) => [file.path, file.content]),
  );
  const deletedPaths = new Set(
    input.actions.flatMap((action) =>
      action.kind === "delete-file" ? [action.path] : [],
    ),
  );
  const replacements = new Map<string, string>();

  for (const action of input.actions) {
    if (action.kind !== "replace-file") {
      continue;
    }

    const replacementBytes = desiredFiles.get(action.path);
    if (replacementBytes === undefined) {
      return { ok: true, warnings: [coverageWarning(action.path)] };
    }
    try {
      replacements.set(action.path, decoder.decode(replacementBytes));
    } catch {
      return { ok: true, warnings: [coverageWarning(action.path)] };
    }
  }

  const moduleResolution = repositoryModuleResolution(input.inventory.entries);
  const conflicts = new Set<string>();
  const warnings: CapabilityRemovalReferenceWarning[] = input.inventory.truncated
    ? [coverageWarning()]
    : [];
  let scannedBytes = 0;

  for (const entry of input.inventory.entries) {
    if (entry.path.startsWith(lifecycleControlPrefix)) {
      continue;
    }

    const projected = projectedContent({ entry, replacements, deletedPaths });
    if (projected.kind === "deleted") {
      continue;
    }

    if (entry.kind !== "file") {
      warnings.push(coverageWarning(entry.path));
      continue;
    }

    const read = projected.kind === "replacement"
      ? { kind: "file" as const, content: projected.content }
      : await input.reader.readText(entry.path);

    if (read.kind !== "file" || read.content.includes("\0")) {
      warnings.push(coverageWarning(entry.path));
      continue;
    }

    const size = encoder.encode(read.content).length;
    if (scannedBytes + size > maximumScannedTextBytes) {
      warnings.push(coverageWarning());
      break;
    }
    scannedBytes += size;

    if (parsedExtensions.has(posix.extname(entry.path).toLowerCase())) {
      const analysis = analyzeParsedSource({
        path: entry.path,
        source: read.content,
        deletedPaths,
        resolution: moduleResolution,
      });
      if (analysis.exact) {
        conflicts.add(entry.path);
      }
      if (analysis.dynamic) {
        warnings.push({
          code: "CAPABILITY_REMOVAL_DYNAMIC_REFERENCE_POSSIBLE",
          path: entry.path,
        });
      }
    }

    if (
      exactConfigurationAndScriptExtensions.has(
        posix.extname(entry.path).toLowerCase(),
      ) &&
      [...deletedPaths].some((path) => read.content.includes(path))
    ) {
      conflicts.add(entry.path);
    }

    if (referenceToken.test(read.content) && !conflicts.has(entry.path)) {
      warnings.push({
        code: "CAPABILITY_REMOVAL_HEURISTIC_REFERENCE_POSSIBLE",
        path: entry.path,
      });
    }
  }

  return conflicts.size > 0
    ? { ok: false, conflicts: [...conflicts].sort(compareText) }
    : { ok: true, warnings: sortedWarnings(warnings) };
}
