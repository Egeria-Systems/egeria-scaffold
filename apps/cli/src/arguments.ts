import {
  analyticsSettingsSchema,
  calendlyBookingSettingsSchema,
  type Web3FormsContactSettings,
  profileIdentifierSchema,
  projectConfigurationSchema,
  type AnalyticsSettings,
  type CalendlyBookingSettings,
  type ValidationResult,
} from "@egeria-systems/builder-core";
import { parseArgs } from "node:util";
import { isAbsolute } from "node:path";

export type CliCommand =
  | Readonly<{
      kind: "create";
      profile: ReturnType<typeof profileIdentifierSchema.parse>;
      projectName: string;
      displayName: string;
      directory: string;
      bookingCalendly?: CalendlyBookingSettings;
      analytics?: AnalyticsSettings;
      multilingual?: true;
      applicationPersistence?: true;
      transactionalEmailResend?: true;
      backgroundJobDelivery?: true;
      contactFormWeb3Forms?: Web3FormsContactSettings;
    }>
  | Readonly<{
      kind: "infer" | "doctor" | "diff";
      directory: string;
    }>
  | Readonly<{
      kind: "plan-add";
      directory: string;
      capability:
        | "analytics"
        | "booking-calendly"
        | "multilingual"
        | "application-persistence"
        | "transactional-email-resend"
        | "contact-form-web3forms"
        | "background-job-delivery";
      settings?: AnalyticsSettings | CalendlyBookingSettings | Web3FormsContactSettings;
    }>
  | Readonly<{
      kind: "plan-remove";
      directory: string;
      capability:
        | "analytics"
        | "booking-calendly"
        | "multilingual"
        | "application-persistence"
        | "transactional-email-resend"
        | "contact-form-web3forms"
        | "background-job-delivery";
      persistenceRemovalPath?: string;
      jobRemovalPath?: string;
    }>
  | Readonly<{
      kind: "plan-profile-transition";
      directory: string;
      toProfile: "site" | "app";
    }>
  | Readonly<{
      kind: "apply-add";
      directory: string;
      capability:
        | "analytics"
        | "booking-calendly"
        | "multilingual"
        | "application-persistence"
        | "transactional-email-resend"
        | "contact-form-web3forms"
        | "background-job-delivery";
      settings?: AnalyticsSettings | CalendlyBookingSettings | Web3FormsContactSettings;
      approvedPlanFingerprint: string;
    }>
  | Readonly<{
      kind: "apply-remove";
      directory: string;
      capability:
        | "analytics"
        | "booking-calendly"
        | "multilingual"
        | "application-persistence"
        | "transactional-email-resend"
        | "contact-form-web3forms"
        | "background-job-delivery";
      persistenceRemovalPath?: string;
      jobRemovalPath?: string;
      persistenceRemovalHumanReviewPath?: string;
      jobRemovalHumanReviewPath?: string;
      approvedPlanFingerprint: string;
    }>
  | Readonly<{
      kind: "apply-profile-transition";
      directory: string;
      toProfile: "site" | "app";
      approvedPlanFingerprint: string;
    }>;

const applicationEnvironmentOptionDefinitions = {
  "contact-form-web3forms": { type: "boolean" },
  "booking-calendly": { type: "boolean" },
  "cloudflare-web-analytics": { type: "boolean" },
  "google-analytics-4": { type: "boolean" },
  "microsoft-clarity": { type: "boolean" },
  "google-search-console": { type: "boolean" },
  "microsoft-clarity-audience": { type: "string" },
  "looker-studio": { type: "boolean" },
} as const;

const environmentAnalyticsOptionNames = [
  "cloudflare-web-analytics", "google-analytics-4", "microsoft-clarity",
  "google-search-console", "microsoft-clarity-audience", "looker-studio",
] as const;

type EnvironmentAnalyticsOptionValues = Readonly<{
  "cloudflare-web-analytics"?: boolean;
  "google-analytics-4"?: boolean;
  "microsoft-clarity"?: boolean;
  "google-search-console"?: boolean;
  "microsoft-clarity-audience"?: string;
  "looker-studio"?: boolean;
}>;

function parseEnvironmentAnalyticsSettings(values: EnvironmentAnalyticsOptionValues) {
  if (!environmentAnalyticsOptionNames.some((name) => values[name] !== undefined)) return undefined;
  return analyticsSettingsSchema.safeParse({
    consent: { policy: "explicit-opt-in" },
    providers: {
      ...(values["cloudflare-web-analytics"] === true ? { cloudflareWebAnalytics: true } : {}),
      ...(values["google-analytics-4"] === true ? { googleAnalytics4: true } : {}),
      ...(values["microsoft-clarity"] === true ? { microsoftClarity: { audience: values["microsoft-clarity-audience"] } } : {}),
    },
    operationalIntegrations: {
      ...(values["google-search-console"] === true ? { googleSearchConsole: true } : {}),
      ...(values["looker-studio"] === true ? { lookerStudio: { connector: "google-analytics-4" } } : {}),
    },
  });
}

const projectFields = projectConfigurationSchema
  .unwrap()
  .shape.project.unwrap().shape;

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
        "calendly-mode": { type: "string" },
        multilingual: { type: "boolean" },
        "application-persistence": { type: "boolean" },
        "transactional-email-resend": { type: "boolean" },
        "background-job-delivery": { type: "boolean" },
        ...applicationEnvironmentOptionDefinitions,
      },
      strict: true,
      allowPositionals: false,
      tokens: true,
    });
    const profile = values.profile;
    const projectName = values.name;
    const displayName = values["display-name"];
    const directory = values.directory;
    const profileResult = profileIdentifierSchema.safeParse(profile);
    const nameResult = projectFields.name.safeParse(projectName);
    const displayResult = projectFields.displayName.safeParse(displayName);
    const hasBooking = values["booking-calendly"] === true;
    const mode = values["calendly-mode"];
    const booking = hasBooking ? calendlyBookingSettingsSchema.safeParse({ mode }) : undefined;
    const analytics = parseEnvironmentAnalyticsSettings(values);
    const expectedOptions = ["profile", "name", "display-name", "directory",
      ...(hasBooking ? ["calendly-mode"] : []),
      ...Object.keys(applicationEnvironmentOptionDefinitions).filter((name) => values[name as keyof typeof values] !== undefined),
      ...["multilingual", "application-persistence", "transactional-email-resend", "background-job-delivery"].filter((name) => values[name as keyof typeof values] === true),
    ];
    if (!hasExactOptions(tokens, expectedOptions) || !profileResult.success || !nameResult.success || !displayResult.success || !validDirectory(directory) ||
      hasBooking !== (mode !== undefined) || (booking !== undefined && !booking.success) || (analytics !== undefined && !analytics.success) ||
      (values["microsoft-clarity"] === true) !== (values["microsoft-clarity-audience"] !== undefined)) {
      return invalidArguments();
    }
    return { ok: true, value: {
      kind: "create", profile: profileResult.data, projectName: nameResult.data, displayName: displayResult.data, directory,
      ...(booking?.success === true ? { bookingCalendly: booking.data } : {}),
      ...(analytics?.success === true ? { analytics: analytics.data } : {}),
      ...(values["contact-form-web3forms"] === true ? { contactFormWeb3Forms: true } : {}),
      ...(values.multilingual === true ? { multilingual: true } : {}),
      ...(values["application-persistence"] === true ? { applicationPersistence: true } : {}),
      ...(values["transactional-email-resend"] === true ? { transactionalEmailResend: true } : {}),
      ...(values["background-job-delivery"] === true ? { backgroundJobDelivery: true } : {}),
    } };
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

const approvedPlanOptionDefinitions = {
  "approved-plan": { type: "string" },
} as const;

function validApprovedPlanFingerprint(
  value: string | boolean | undefined,
): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value);
}

function parseAdd(
  kind: "plan-add" | "apply-add",
  arguments_: readonly string[],
): ValidationResult<CliCommand> {
  try {
    const applying = kind === "apply-add";
    const { values, tokens } = parseArgs({
      args: [...arguments_],
      options: {
        directory: { type: "string" }, capability: { type: "string" },
        "calendly-mode": { type: "string" },
        ...applicationEnvironmentOptionDefinitions,
        ...(applying ? approvedPlanOptionDefinitions : {}),
      },
      strict: true, allowPositionals: false, tokens: true,
    });
    const directory = values.directory;
    const capability = values.capability;
    if (capability !== "contact-form-web3forms" && capability !== "booking-calendly" && capability !== "analytics" &&
        capability !== "multilingual" && capability !== "application-persistence" && capability !== "transactional-email-resend" && capability !== "multilingual") return invalidArguments();
    const booking = calendlyBookingSettingsSchema.safeParse({ mode: values["calendly-mode"] });
    const analytics = parseEnvironmentAnalyticsSettings(values);
    const capabilityOptions = capability === "booking-calendly" ? ["calendly-mode"]
      : capability === "analytics" ? environmentAnalyticsOptionNames.filter(name => values[name] !== undefined) : [];
    if (!hasExactOptions(tokens, ["directory", "capability", ...capabilityOptions, ...(applying ? ["approved-plan"] : [])]) ||
        !validDirectory(directory) || (capability === "booking-calendly" && !booking.success) ||
        (capability === "analytics" && analytics?.success !== true) ||
        (values["microsoft-clarity"] === true) !== (values["microsoft-clarity-audience"] !== undefined)) return invalidArguments();
    const settings = capability === "booking-calendly" && booking.success ? { settings: booking.data }
      : capability === "analytics" && analytics?.success ? { settings: analytics.data } : {};
    if (applying) {
      const approvedPlanFingerprint = values["approved-plan"];
      if (!validApprovedPlanFingerprint(approvedPlanFingerprint)) return invalidArguments();
      return { ok: true, value: { kind: "apply-add", directory, capability, ...settings, approvedPlanFingerprint } };
    }
    return { ok: true, value: { kind: "plan-add", directory, capability, ...settings } };
  } catch {
    return invalidArguments();
  }
}

function parseRemove(
  kind: "plan-remove" | "apply-remove",
  arguments_: readonly string[],
): ValidationResult<CliCommand> {
  try {
    const applying = kind === "apply-remove";
    const { values, tokens } = parseArgs({
      args: [...arguments_],
      options: {
        directory: { type: "string" },
        capability: { type: "string" },
        "persistence-removal": { type: "string" },
        ...(applying
          ? { "persistence-human-review": { type: "string" } as const }
          : {}),
        ...(applying ? approvedPlanOptionDefinitions : {}),
      },
      strict: true,
      allowPositionals: false,
      tokens: true,
    });
    const directory = values.directory;
    const capability = values.capability;
    if (capability !== "contact-form-web3forms" && capability !== "booking-calendly" && capability !== "analytics" && capability !== "application-persistence" && capability !== "transactional-email-resend" && capability !== "multilingual") return invalidArguments();
    const approvedPlanFingerprint = values["approved-plan"];
    const persistenceSelection = capability === "application-persistence";
    const persistenceRemovalPath = values["persistence-removal"];
    const humanReviewOption = values["persistence-human-review"];
    const persistenceRemovalHumanReviewPath = typeof humanReviewOption === "string"
      ? humanReviewOption
      : undefined;

    if (
      !hasExactOptions(tokens, [
        "directory",
        "capability",
        ...(persistenceSelection ? ["persistence-removal"] : []),
        ...(persistenceSelection && applying ? ["persistence-human-review"] : []),
        ...(applying ? ["approved-plan"] : []),
      ]) ||
      !validDirectory(directory) ||
      (persistenceSelection && !validDirectory(persistenceRemovalPath)) ||
      (persistenceSelection && applying && !validDirectory(persistenceRemovalHumanReviewPath))
    ) {
      return invalidArguments();
    }

    const persistenceInput = {
      ...(persistenceSelection && validDirectory(persistenceRemovalPath) ? { persistenceRemovalPath } : {}),
    };

    if (kind === "apply-remove") {
      if (!validApprovedPlanFingerprint(approvedPlanFingerprint)) {
        return invalidArguments();
      }

      return {
        ok: true,
        value: {
          kind,
          directory,
          capability,
          approvedPlanFingerprint,
          ...persistenceInput,
          ...(persistenceSelection && validDirectory(persistenceRemovalHumanReviewPath)
            ? { persistenceRemovalHumanReviewPath }
            : {}),
        },
      };
    }

    return {
      ok: true,
      value: { kind, directory, capability, ...persistenceInput },
    };
  } catch {
    return invalidArguments();
  }
}

function parseProfileTransition(
  kind: "plan-profile-transition" | "apply-profile-transition",
  arguments_: readonly string[],
): ValidationResult<CliCommand> {
  try {
    const applying = kind === "apply-profile-transition";
    const { values, tokens } = parseArgs({
      args: [...arguments_],
      options: {
        directory: { type: "string" },
        "to-profile": { type: "string" },
        ...(applying ? approvedPlanOptionDefinitions : {}),
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
        ...(applying ? ["approved-plan"] : []),
      ]) ||
      !validAbsoluteDirectory(directory) ||
      (toProfile !== "site" && toProfile !== "app")
    ) {
      return invalidArguments();
    }

    if (kind === "apply-profile-transition") {
      if (!validApprovedPlanFingerprint(approvedPlanFingerprint)) {
        return invalidArguments();
      }

      return {
        ok: true,
        value: { kind, directory, toProfile, approvedPlanFingerprint },
      };
    }

    return {
      ok: true,
      value: { kind, directory, toProfile },
    };
  } catch {
    return invalidArguments();
  }
}

export function parseCliArguments(arguments_: readonly string[]): ValidationResult<CliCommand> {
  const [command, ...commandArguments] = arguments_;

  switch (command) {
    case "create":
      return parseCreate(commandArguments);
    case "infer":
    case "doctor":
    case "diff":
      return parseReadOnly(command, commandArguments);
    case "plan-add":
    case "apply-add":
      return parseAdd(command, commandArguments);
    case "plan-remove":
    case "apply-remove":
      return parseRemove(command, commandArguments);
    case "plan-profile-transition":
    case "apply-profile-transition":
      return parseProfileTransition(command, commandArguments);
    default:
      return invalidArguments();
  }
}
