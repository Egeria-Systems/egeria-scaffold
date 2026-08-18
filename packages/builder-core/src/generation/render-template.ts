import { safeRelativePathSchema } from "../contracts/identifiers.js";
import type {
  ContractIssue,
  ValidationResult,
} from "../contracts/result.js";

const templateLayers = new Set([
  "booking-calendly",
  "common",
  "portfolio",
  "site",
]);
const templateTokenNames = new Set([
  "projectName",
  "displayNameJson",
  "workerName",
  "githubWorkflowExpression",
  "githubRefExpression",
  "githubShaExpression",
  "githubExpectedRevisionExpression",
  "githubDeployUrlExpression",
  "githubCloudflareAccountIdExpression",
  "githubCloudflareApiTokenExpression",
  "calendlyDestinationJson",
  "calendlyModeJson",
]);
const templateTokenPattern =
  /{{(projectName|displayNameJson|workerName|githubWorkflowExpression|githubRefExpression|githubShaExpression|githubExpectedRevisionExpression|githubDeployUrlExpression|githubCloudflareAccountIdExpression|githubCloudflareApiTokenExpression|calendlyDestinationJson|calendlyModeJson)}}/g;
const completeTokenPattern = /{{([^{}]*)}}/g;
const bookingCalendlySettingsSource =
  "booking-calendly/apps/web/src/integrations/booking-calendly/booking-settings.ts.template";
const bookingCalendlyTokenNames = new Set([
  "calendlyDestinationJson",
  "calendlyModeJson",
]);
const fixedTemplateTokens = {
  githubWorkflowExpression: "${{ github.workflow }}",
  githubRefExpression: "${{ github.ref }}",
  githubShaExpression: "${{ github.sha }}",
  githubExpectedRevisionExpression: "${{ inputs.expected_revision }}",
  githubDeployUrlExpression: "${{ vars.DEPLOY_URL }}",
  githubCloudflareAccountIdExpression:
    "${{ secrets.CLOUDFLARE_ACCOUNT_ID }}",
  githubCloudflareApiTokenExpression:
    "${{ secrets.CLOUDFLARE_API_TOKEN }}",
} as const;

export type TemplateTokens = Readonly<{
  projectName: string;
  displayNameJson: string;
  workerName: string;
  calendlyDestinationJson?: string;
  calendlyModeJson?: string;
}>;

type TemplateTokenName = keyof TemplateTokens | keyof typeof fixedTemplateTokens;

function resolveTemplateToken(
  token: TemplateTokenName,
  tokens: TemplateTokens,
): string {
  if (token in fixedTemplateTokens) {
    return fixedTemplateTokens[token as keyof typeof fixedTemplateTokens];
  }

  const value = tokens[token as keyof TemplateTokens];
  if (value === undefined) {
    throw new TypeError("TEMPLATE_TOKEN_UNAVAILABLE");
  }

  return value;
}

function templateIssue(code: string, reason: string): ContractIssue {
  return {
    code,
    path: ["source"],
    context: { reason },
  };
}

function invalidSource(reason: string): ValidationResult<never> {
  return {
    ok: false,
    issues: [templateIssue("TEMPLATE_SOURCE_INVALID", reason)],
  };
}

function invalidToken(reason: string): ValidationResult<never> {
  return {
    ok: false,
    issues: [templateIssue("TEMPLATE_TOKEN_INVALID", reason)],
  };
}

function normalizeText(text: string): string {
  return `${text.replaceAll("\r\n", "\n").replaceAll("\r", "\n").replace(/\n*$/, "")}\n`;
}

function containsTemplateSyntax(text: string): boolean {
  return text.includes("{{") || text.includes("}}");
}

function validateTemplateSyntax(
  source: string,
  text: string,
  tokens: TemplateTokens,
): ValidationResult<undefined> {
  let reason:
    | "unknown-token"
    | "malformed-token"
    | "unavailable-token"
    | undefined;
  const unmatched = text.replace(
    completeTokenPattern,
    (_match, token: string): string => {
      if (
        templateTokenNames.has(token) &&
        (!bookingCalendlyTokenNames.has(token) ||
          source === bookingCalendlySettingsSource)
      ) {
        if (
          !(token in fixedTemplateTokens) &&
          tokens[token as keyof TemplateTokens] === undefined
        ) {
          reason = "unavailable-token";
        }
        return "";
      }

      reason =
        bookingCalendlyTokenNames.has(token) &&
        source !== bookingCalendlySettingsSource
          ? "unavailable-token"
          : /^[A-Za-z][A-Za-z0-9]*$/.test(token)
            ? "unknown-token"
            : "malformed-token";
      return "";
    },
  );

  if (reason !== undefined) {
    return invalidToken(reason);
  }

  return containsTemplateSyntax(unmatched)
    ? invalidToken("malformed-token")
    : { ok: true, value: undefined };
}

export function deriveTemplateDestination(
  source: string,
): ValidationResult<string> {
  if (!safeRelativePathSchema.safeParse(source).success) {
    return invalidSource("unsafe-source");
  }

  const [layer, ...destinationSegments] = source.split("/");

  if (layer === undefined || !templateLayers.has(layer)) {
    return invalidSource("unknown-layer");
  }

  const destinationSource = destinationSegments.join("/");
  const destination = destinationSource.endsWith(".template")
    ? destinationSource.slice(0, -".template".length)
    : destinationSource;

  if (!safeRelativePathSchema.safeParse(destination).success) {
    return invalidSource("unsafe-destination");
  }

  return { ok: true, value: destination };
}

export function renderTemplateSource(input: Readonly<{
  source: string;
  text: string;
  tokens: TemplateTokens;
}>): ValidationResult<string> {
  const destinationResult = deriveTemplateDestination(input.source);

  if (!destinationResult.ok) {
    return destinationResult;
  }

  if (!input.source.endsWith(".template")) {
    return containsTemplateSyntax(input.text)
      ? invalidToken("token-in-static-source")
      : { ok: true, value: normalizeText(input.text) };
  }

  const syntaxResult = validateTemplateSyntax(
    input.source,
    input.text,
    input.tokens,
  );
  if (!syntaxResult.ok) {
    return syntaxResult;
  }

  if (Object.values(input.tokens).some(containsTemplateSyntax)) {
    return invalidToken("recursive-token");
  }

  const rendered = input.text.replace(
    templateTokenPattern,
    (_match, token: TemplateTokenName): string =>
      resolveTemplateToken(token, input.tokens),
  );

  return { ok: true, value: normalizeText(rendered) };
}
