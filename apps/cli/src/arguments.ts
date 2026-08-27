import {
  analyticsSettingsSchema,
  calendlyBookingSettingsSchema,
  profileIdentifierSchema,
  projectConfigurationSchema,
  type AnalyticsSettings,
  type CalendlyBookingSettings,
  type ProfileIdentifier,
  type ValidationResult,
} from "@egeria-systems/builder-core";
import { parseArgs } from "node:util";
import { isAbsolute } from "node:path";

export type CliCommand =
  | Readonly<{
      kind: "create";
      profile: ProfileIdentifier;
      projectName: string;
      displayName: string;
      directory: string;
      bookingCalendly?: CalendlyBookingSettings;
      analytics?: AnalyticsSettings;
      multilingual?: true;
    }>
  | Readonly<{
      kind: "infer" | "doctor" | "diff";
      directory: string;
    }>
  | Readonly<{
      kind: "plan-add";
      directory: string;
      capability: "analytics" | "booking-calendly" | "multilingual";
      settings?: AnalyticsSettings | CalendlyBookingSettings;
    }>
  | Readonly<{
      kind: "plan-remove";
      directory: string;
      capability: "analytics" | "booking-calendly" | "multilingual";
    }>
  | Readonly<{
      kind: "plan-upgrade";
      directory: string;
      capability: "site-routing" | "standards";
      toVersion: "0.4.0";
    }>
  | Readonly<{
      kind: "plan-profile-transition";
      directory: string;
      toProfile: "site";
    }>
  | Readonly<{
      kind: "apply-add";
      directory: string;
      capability: "analytics" | "booking-calendly" | "multilingual";
      settings?: AnalyticsSettings | CalendlyBookingSettings;
      approvedPlanFingerprint: string;
    }>
  | Readonly<{
      kind: "apply-remove";
      directory: string;
      capability: "analytics" | "booking-calendly" | "multilingual";
      approvedPlanFingerprint: string;
    }>
  | Readonly<{
      kind: "apply-upgrade";
      directory: string;
      capability: "site-routing" | "standards";
      toVersion: "0.4.0";
      approvedPlanFingerprint: string;
    }>
  | Readonly<{
      kind: "apply-profile-transition";
      directory: string;
      toProfile: "site";
      approvedPlanFingerprint: string;
    }>;

const projectFields = projectConfigurationSchema
  .unwrap()
  .shape.project.unwrap().shape;

const analyticsOptionDefinitions = {
  "cloudflare-web-analytics-token": { type: "string" },
  "google-analytics-id": { type: "string" },
  "microsoft-clarity-id": { type: "string" },
  "microsoft-clarity-audience": { type: "string" },
  "search-console-verification": { type: "string" },
  "looker-studio": { type: "boolean" },
} as const;

type AnalyticsOptionValues = Readonly<{
  "cloudflare-web-analytics-token"?: string;
  "google-analytics-id"?: string;
  "microsoft-clarity-id"?: string;
  "microsoft-clarity-audience"?: string;
  "search-console-verification"?: string;
  "looker-studio"?: boolean;
}>;

function selectedAnalyticsOptions(values: AnalyticsOptionValues): string[] {
  return [
    ...(values["cloudflare-web-analytics-token"] === undefined
      ? []
      : ["cloudflare-web-analytics-token"]),
    ...(values["google-analytics-id"] === undefined
      ? []
      : ["google-analytics-id"]),
    ...(values["microsoft-clarity-id"] === undefined
      ? []
      : ["microsoft-clarity-id"]),
    ...(values["microsoft-clarity-audience"] === undefined
      ? []
      : ["microsoft-clarity-audience"]),
    ...(values["search-console-verification"] === undefined
      ? []
      : ["search-console-verification"]),
    ...(values["looker-studio"] === true ? ["looker-studio"] : []),
  ];
}

function parseAnalyticsSettings(values: AnalyticsOptionValues) {
  if (selectedAnalyticsOptions(values).length === 0) {
    return undefined;
  }

  return analyticsSettingsSchema.safeParse({
    consent: { policy: "explicit-opt-in" },
    providers: {
      ...(values["cloudflare-web-analytics-token"] === undefined
        ? {}
        : {
            cloudflareWebAnalytics: {
              siteToken: values["cloudflare-web-analytics-token"],
            },
          }),
      ...(values["google-analytics-id"] === undefined
        ? {}
        : {
            googleAnalytics4: {
              measurementId: values["google-analytics-id"],
            },
          }),
      ...(values["microsoft-clarity-id"] === undefined
        ? {}
        : {
            microsoftClarity: {
              projectId: values["microsoft-clarity-id"],
              audience: values["microsoft-clarity-audience"],
            },
          }),
    },
    operationalIntegrations: {
      ...(values["search-console-verification"] === undefined
        ? {}
        : {
            googleSearchConsole: {
              verificationToken: values["search-console-verification"],
            },
          }),
      ...(values["looker-studio"] === true
        ? { lookerStudio: { connector: "google-analytics-4" } }
        : {}),
    },
  });
}

function invalidArguments(): ValidationResult<never> {
  return {
    ok: false,
    issues: [
      {
        code: "CLI_ARGUMENT_INVALID",
        path: [],
        context: { reason: "invalid-arguments" },
      },
    ],
  };
}

function hasExactOptions(
  tokens: readonly Readonly<{ kind: string; name?: string }>[],
  expectedNames: readonly string[],
): boolean {
  const optionNames = tokens.flatMap((token) =>
    token.kind === "option" && token.name !== undefined ? [token.name] : [],
  );

  return (
    optionNames.length === expectedNames.length &&
    new Set(optionNames).size === expectedNames.length &&
    expectedNames.every((name) => optionNames.includes(name))
  );
}

function validDirectory(value: string | undefined): value is string {
  return value !== undefined && value.length > 0 && !value.includes("\0");
}

function validAbsoluteDirectory(value: string | undefined): value is string {
  return validDirectory(value) && isAbsolute(value);
}

function parseCreate(
  arguments_: readonly string[],
): ValidationResult<CliCommand> {
  try {
    const { values, tokens } = parseArgs({
      args: [...arguments_],
      options: {
        profile: { type: "string" },
        name: { type: "string" },
        "display-name": { type: "string" },
        directory: { type: "string" },
        "calendly-url": { type: "string" },
        "calendly-mode": { type: "string" },
        multilingual: { type: "boolean" },
        ...analyticsOptionDefinitions,
      },
      strict: true,
      allowPositionals: false,
      tokens: true,
    });
    const profile = values.profile;
    const projectName = values.name;
    const displayName = values["display-name"];
    const directory = values.directory;
    const calendlyUrl = values["calendly-url"];
    const calendlyMode = values["calendly-mode"];
    const multilingual = values.multilingual;
    const parsedAnalytics = parseAnalyticsSettings(values);
    const parsedProfile = profileIdentifierSchema.safeParse(profile);
    const parsedProjectName = projectFields.name.safeParse(projectName);
    const parsedDisplayName = projectFields.displayName.safeParse(displayName);
    const hasCalendlyUrl = calendlyUrl !== undefined;
    const hasCalendlyMode = calendlyMode !== undefined;
    const hasCalendlySelection = hasCalendlyUrl && hasCalendlyMode;
    const parsedCalendly = hasCalendlySelection
      ? calendlyBookingSettingsSchema.safeParse({
          destination: calendlyUrl,
          mode: calendlyMode,
        })
      : undefined;
    const expectedOptions = [
      "profile",
      "name",
      "display-name",
      "directory",
      ...(hasCalendlySelection
        ? [
            "calendly-url",
            "calendly-mode",
          ]
        : []),
      ...(multilingual === true ? ["multilingual"] : []),
      ...selectedAnalyticsOptions(values),
    ];

    if (
      !hasExactOptions(tokens, expectedOptions) ||
      !parsedProfile.success ||
      !parsedProjectName.success ||
      !parsedDisplayName.success ||
      hasCalendlyUrl !== hasCalendlyMode ||
      (parsedCalendly !== undefined && !parsedCalendly.success) ||
      (parsedAnalytics !== undefined && !parsedAnalytics.success) ||
      !validDirectory(directory)
    ) {
      return invalidArguments();
    }

    return {
      ok: true,
      value: {
        kind: "create",
        profile: parsedProfile.data,
        projectName: parsedProjectName.data,
        displayName: parsedDisplayName.data,
        directory,
        ...(parsedCalendly?.success === true
          ? { bookingCalendly: parsedCalendly.data }
          : {}),
        ...(parsedAnalytics?.success === true
          ? { analytics: parsedAnalytics.data }
          : {}),
        ...(multilingual === true ? { multilingual: true } : {}),
      },
    };
  } catch {
    return invalidArguments();
  }
}

function parseReadOnly(
  kind: "infer" | "doctor" | "diff",
  arguments_: readonly string[],
): ValidationResult<CliCommand> {
  try {
    const { values, tokens } = parseArgs({
      args: [...arguments_],
      options: { directory: { type: "string" } },
      strict: true,
      allowPositionals: false,
      tokens: true,
    });
    const directory = values.directory;

    if (!hasExactOptions(tokens, ["directory"]) || !validDirectory(directory)) {
      return invalidArguments();
    }

    return { ok: true, value: { kind, directory } };
  } catch {
    return invalidArguments();
  }
}

function parsePlanAdd(
  arguments_: readonly string[],
): ValidationResult<CliCommand> {
  try {
    const { values, tokens } = parseArgs({
      args: [...arguments_],
      options: {
        directory: { type: "string" },
        capability: { type: "string" },
        "calendly-url": { type: "string" },
        "calendly-mode": { type: "string" },
        ...analyticsOptionDefinitions,
      },
      strict: true,
      allowPositionals: false,
      tokens: true,
    });
    const directory = values.directory;
    const capability = values.capability;
    const settings = calendlyBookingSettingsSchema.safeParse({
      destination: values["calendly-url"],
      mode: values["calendly-mode"],
    });
    const analyticsSettings = parseAnalyticsSettings(values);
    const calendlySelection = capability === "booking-calendly";
    const analyticsSelection = capability === "analytics";
    const multilingualSelection = capability === "multilingual";
    const expectedOptions = calendlySelection
      ? ["directory", "capability", "calendly-url", "calendly-mode"]
      : analyticsSelection
        ? ["directory", "capability", ...selectedAnalyticsOptions(values)]
        : ["directory", "capability"];

    if (
      !hasExactOptions(tokens, expectedOptions) ||
      !validDirectory(directory) ||
      (!analyticsSelection && !calendlySelection && !multilingualSelection) ||
      (calendlySelection && !settings.success) ||
      (analyticsSelection && analyticsSettings?.success !== true)
    ) {
      return invalidArguments();
    }

    return {
      ok: true,
      value: {
        kind: "plan-add",
        directory,
        capability,
        ...(calendlySelection && settings.success
          ? { settings: settings.data }
          : analyticsSelection && analyticsSettings?.success === true
            ? { settings: analyticsSettings.data }
            : {}),
      },
    };
  } catch {
    return invalidArguments();
  }
}

function parsePlanRemove(
  arguments_: readonly string[],
): ValidationResult<CliCommand> {
  try {
    const { values, tokens } = parseArgs({
      args: [...arguments_],
      options: {
        directory: { type: "string" },
        capability: { type: "string" },
      },
      strict: true,
      allowPositionals: false,
      tokens: true,
    });
    const directory = values.directory;
    const capability = values.capability;

    if (
      !hasExactOptions(tokens, ["directory", "capability"]) ||
      !validDirectory(directory) ||
      capability !== "analytics" &&
      capability !== "booking-calendly" &&
      capability !== "multilingual"
    ) {
      return invalidArguments();
    }

    return {
      ok: true,
      value: { kind: "plan-remove", directory, capability },
    };
  } catch {
    return invalidArguments();
  }
}

function parsePlanUpgrade(
  arguments_: readonly string[],
): ValidationResult<CliCommand> {
  try {
    const { values, tokens } = parseArgs({
      args: [...arguments_],
      options: {
        directory: { type: "string" },
        capability: { type: "string" },
        "to-version": { type: "string" },
      },
      strict: true,
      allowPositionals: false,
      tokens: true,
    });
    const directory = values.directory;
    const capability = values.capability;
    const toVersion = values["to-version"];

    if (
      !hasExactOptions(tokens, ["directory", "capability", "to-version"]) ||
      !validAbsoluteDirectory(directory) ||
      (capability !== "standards" && capability !== "site-routing") ||
      toVersion !== "0.4.0"
    ) {
      return invalidArguments();
    }

    return {
      ok: true,
      value: {
        kind: "plan-upgrade",
        directory,
        capability,
        toVersion,
      },
    };
  } catch {
    return invalidArguments();
  }
}

function parsePlanProfileTransition(
  arguments_: readonly string[],
): ValidationResult<CliCommand> {
  try {
    const { values, tokens } = parseArgs({
      args: [...arguments_],
      options: {
        directory: { type: "string" },
        "to-profile": { type: "string" },
      },
      strict: true,
      allowPositionals: false,
      tokens: true,
    });
    const directory = values.directory;
    const toProfile = values["to-profile"];

    if (
      !hasExactOptions(tokens, ["directory", "to-profile"]) ||
      !validAbsoluteDirectory(directory) ||
      toProfile !== "site"
    ) {
      return invalidArguments();
    }

    return {
      ok: true,
      value: {
        kind: "plan-profile-transition",
        directory,
        toProfile,
      },
    };
  } catch {
    return invalidArguments();
  }
}

function parseApplyAdd(
  arguments_: readonly string[],
): ValidationResult<CliCommand> {
  try {
    const { values, tokens } = parseArgs({
      args: [...arguments_],
      options: {
        directory: { type: "string" },
        capability: { type: "string" },
        "calendly-url": { type: "string" },
        "calendly-mode": { type: "string" },
        "approved-plan": { type: "string" },
        ...analyticsOptionDefinitions,
      },
      strict: true,
      allowPositionals: false,
      tokens: true,
    });
    const directory = values.directory;
    const capability = values.capability;
    const approvedPlanFingerprint = values["approved-plan"];
    const settings = calendlyBookingSettingsSchema.safeParse({
      destination: values["calendly-url"],
      mode: values["calendly-mode"],
    });
    const analyticsSettings = parseAnalyticsSettings(values);
    const calendlySelection = capability === "booking-calendly";
    const analyticsSelection = capability === "analytics";
    const multilingualSelection = capability === "multilingual";
    const expectedOptions = calendlySelection
      ? [
          "directory",
          "capability",
          "calendly-url",
          "calendly-mode",
          "approved-plan",
        ]
      : analyticsSelection
        ? [
            "directory",
            "capability",
            ...selectedAnalyticsOptions(values),
            "approved-plan",
          ]
        : ["directory", "capability", "approved-plan"];

    if (
      !hasExactOptions(tokens, expectedOptions) ||
      !validDirectory(directory) ||
      (!analyticsSelection && !calendlySelection && !multilingualSelection) ||
      (calendlySelection && !settings.success) ||
      (analyticsSelection && analyticsSettings?.success !== true) ||
      approvedPlanFingerprint === undefined ||
      !/^sha256:[a-f0-9]{64}$/u.test(approvedPlanFingerprint)
    ) {
      return invalidArguments();
    }

    return {
      ok: true,
      value: {
        kind: "apply-add",
        directory,
        capability,
        ...(calendlySelection && settings.success
          ? { settings: settings.data }
          : analyticsSelection && analyticsSettings?.success === true
            ? { settings: analyticsSettings.data }
            : {}),
        approvedPlanFingerprint,
      },
    };
  } catch {
    return invalidArguments();
  }
}

function parseApplyRemove(
  arguments_: readonly string[],
): ValidationResult<CliCommand> {
  try {
    const { values, tokens } = parseArgs({
      args: [...arguments_],
      options: {
        directory: { type: "string" },
        capability: { type: "string" },
        "approved-plan": { type: "string" },
      },
      strict: true,
      allowPositionals: false,
      tokens: true,
    });
    const directory = values.directory;
    const capability = values.capability;
    const approvedPlanFingerprint = values["approved-plan"];

    if (
      !hasExactOptions(tokens, [
        "directory",
        "capability",
        "approved-plan",
      ]) ||
      !validDirectory(directory) ||
      (capability !== "analytics" &&
        capability !== "booking-calendly" &&
        capability !== "multilingual") ||
      approvedPlanFingerprint === undefined ||
      !/^sha256:[a-f0-9]{64}$/u.test(approvedPlanFingerprint)
    ) {
      return invalidArguments();
    }

    return {
      ok: true,
      value: {
        kind: "apply-remove",
        directory,
        capability,
        approvedPlanFingerprint,
      },
    };
  } catch {
    return invalidArguments();
  }
}

function parseApplyUpgrade(
  arguments_: readonly string[],
): ValidationResult<CliCommand> {
  try {
    const { values, tokens } = parseArgs({
      args: [...arguments_],
      options: {
        directory: { type: "string" },
        capability: { type: "string" },
        "to-version": { type: "string" },
        "approved-plan": { type: "string" },
      },
      strict: true,
      allowPositionals: false,
      tokens: true,
    });
    const directory = values.directory;
    const capability = values.capability;
    const toVersion = values["to-version"];
    const approvedPlanFingerprint = values["approved-plan"];

    if (
      !hasExactOptions(tokens, [
        "directory",
        "capability",
        "to-version",
        "approved-plan",
      ]) ||
      !validAbsoluteDirectory(directory) ||
      (capability !== "standards" && capability !== "site-routing") ||
      toVersion !== "0.4.0" ||
      approvedPlanFingerprint === undefined ||
      !/^sha256:[a-f0-9]{64}$/u.test(approvedPlanFingerprint)
    ) {
      return invalidArguments();
    }

    return {
      ok: true,
      value: {
        kind: "apply-upgrade",
        directory,
        capability,
        toVersion,
        approvedPlanFingerprint,
      },
    };
  } catch {
    return invalidArguments();
  }
}

function parseApplyProfileTransition(
  arguments_: readonly string[],
): ValidationResult<CliCommand> {
  try {
    const { values, tokens } = parseArgs({
      args: [...arguments_],
      options: {
        directory: { type: "string" },
        "to-profile": { type: "string" },
        "approved-plan": { type: "string" },
      },
      strict: true,
      allowPositionals: false,
      tokens: true,
    });
    const directory = values.directory;
    const toProfile = values["to-profile"];
    const approvedPlanFingerprint = values["approved-plan"];

    if (
      !hasExactOptions(tokens, [
        "directory",
        "to-profile",
        "approved-plan",
      ]) ||
      !validAbsoluteDirectory(directory) ||
      toProfile !== "site" ||
      approvedPlanFingerprint === undefined ||
      !/^sha256:[a-f0-9]{64}$/u.test(approvedPlanFingerprint)
    ) {
      return invalidArguments();
    }

    return {
      ok: true,
      value: {
        kind: "apply-profile-transition",
        directory,
        toProfile,
        approvedPlanFingerprint,
      },
    };
  } catch {
    return invalidArguments();
  }
}

export function parseCliArguments(
  arguments_: readonly string[],
): ValidationResult<CliCommand> {
  const [command, ...commandArguments] = arguments_;

  switch (command) {
    case "create":
      return parseCreate(commandArguments);
    case "infer":
    case "doctor":
    case "diff":
      return parseReadOnly(command, commandArguments);
    case "plan-add":
      return parsePlanAdd(commandArguments);
    case "plan-remove":
      return parsePlanRemove(commandArguments);
    case "plan-upgrade":
      return parsePlanUpgrade(commandArguments);
    case "plan-profile-transition":
      return parsePlanProfileTransition(commandArguments);
    case "apply-add":
      return parseApplyAdd(commandArguments);
    case "apply-remove":
      return parseApplyRemove(commandArguments);
    case "apply-upgrade":
      return parseApplyUpgrade(commandArguments);
    case "apply-profile-transition":
      return parseApplyProfileTransition(commandArguments);
    default:
      return invalidArguments();
  }
}
