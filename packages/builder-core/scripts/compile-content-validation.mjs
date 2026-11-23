import { readFile, mkdir, writeFile } from "node:fs/promises";
import ts from "typescript";
// Compile only this fixed set of builder-owned templates. Generated clients
// keep their existing source bytes; no repository-supplied module is executed.
const root = new URL("../", import.meta.url);
const localizedContentImports = [
  ['"../content/content-schema"', '"../content-schema.js"'],
  ['"./locale"', '"../locale.js"'],
];
const modules = [
  ["common/apps/web/src/content/content-schema.ts", "content-schema.js", []],
  ["multilingual/apps/web/src/i18n/locale.ts", "locale.js", []],
  ["site/apps/web/src/routing/routing-content-schema.ts", "routing-content-schema.js", [
    ['"../content/content-schema"', '"./content-schema.js"'],
  ]],
  ["site/application-environments/public-content-and-routing/apps/web/src/routing/routing-content-schema.ts", "site-routing-model.js", [
    ['"../content/content-schema"', '"./content-schema.js"'],
  ]],
  ["multilingual/site/application-environments/public-content-and-routing/apps/web/src/i18n/localized-profile.ts", "site/localized-profile.js", [
    ['"../routing/routing-content-schema"', '"../site-routing-model.js"'],
  ]],
  ["multilingual/portfolio/apps/web/src/i18n/localized-profile.ts", "portfolio/localized-profile.js", []],
  ["multilingual/site/apps/web/src/i18n/localized-profile.ts", "site/retained-localized-profile.js", []],
  ["booking-calendly/application-environments/apps/web/src/integrations/booking-calendly/booking-content.ts", "booking-content.js", [
    ['"../../content/content-schema"', '"./content-schema.js"'],
  ], ["frenchBookingContentSource", "bookingContentSource", "readBookingContent"]],
  ["analytics/application-environments/apps/web/src/integrations/analytics/analytics-content.ts", "analytics-content.js", [
    ['"../../content/content-schema"', '"./content-schema.js"'],
  ], ["englishAnalyticsContentSource", "frenchAnalyticsContentSource", "contentByLocale", "readAnalyticsContent"]],
  ["common/apps/web/src/infrastructure/observability/error-copy.ts", "error-copy.js", [
    ['"../../content/content-schema"', '"./content-schema.js"'],
  ], ["observabilityCopySource", "readErrorFallbackCopy"]],
  ...["portfolio", "site"].flatMap((profile) => [
    ["multilingual/application-environments/apps/web/src/i18n/localized-content.ts", `${profile}/retained-localized-content.js`, [
      ...localizedContentImports,
      ['"./localized-profile"', profile === "site" ? '"./retained-localized-profile.js"' : '"./localized-profile.js"'],
    ]],
    ["multilingual/application-environments/public-content-and-routing/apps/web/src/i18n/localized-content.ts", `${profile}/localized-content.js`, [
      ...localizedContentImports,
      ['"./localized-profile"', '"./localized-profile.js"'],
    ]],
  ]),
];
for (const [source, destination, imports, omittedNames = []] of modules) {
  let text = await readFile(new URL(`templates/${source}`, root), "utf8");
  for (const [before, after] of imports) {
    if (text.split(before).length !== 2) {
      throw new Error("CONTENT_VALIDATION_IMPORT_INVALID");
    }
    text = text.replace(before, after);
  }
  // These three reader modules also import raw YAML. Exclude only their
  // explicitly named I/O bindings; retain canonical parser declarations.
  if (omittedNames.length > 0) {
    const parsed = ts.createSourceFile(source, text, ts.ScriptTarget.Latest, true);
    const remaining = new Set(omittedNames);
    const statements = parsed.statements.filter(statement => {
      const name = ts.isImportDeclaration(statement) ? statement.importClause?.name?.text
        : ts.isFunctionDeclaration(statement) ? statement.name?.text
        : ts.isVariableStatement(statement) && statement.declarationList.declarations.length === 1
          && ts.isIdentifier(statement.declarationList.declarations[0].name)
          ? statement.declarationList.declarations[0].name.text : undefined;
      return name === undefined || !remaining.delete(name);
    });
    if (remaining.size !== 0) throw new Error("CONTENT_VALIDATION_READER_INVALID");
    text = ts.createPrinter().printFile(ts.factory.updateSourceFile(parsed, statements));
  }
  const result = ts.transpileModule(text, {
    fileName: source,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    reportDiagnostics: true,
  });
  if (result.diagnostics?.some(({ category }) => category === ts.DiagnosticCategory.Error)) {
    throw new Error("CONTENT_VALIDATION_COMPILE_FAILED");
  }
  const output = new URL(`dist/content-validation/${destination}`, root);
  await mkdir(new URL("./", output), { recursive: true });
  await writeFile(output, result.outputText);
}
