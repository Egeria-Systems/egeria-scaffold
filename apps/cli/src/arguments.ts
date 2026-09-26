import {
  applicationEnvironmentAnalyticsSettingsSchema,
  applicationEnvironmentBookingSettingsSchema,
  type ApplicationEnvironmentAnalyticsSettings,
  type ApplicationEnvironmentBookingSettings,
  analyticsSettingsSchema,
  calendlyBookingSettingsSchema,
  web3FormsContactSettingsSchema,
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
      kind: "plan-upgrade";
      directory: string;
      capability: "site-routing" | "standards";
      toVersion: "0.4.0";
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
      kind: "apply-upgrade";
      directory: string;
      capability: "site-routing" | "standards";
      toVersion: "0.4.0";
      approvedPlanFingerprint: string;
    }>
  | Readonly<{
      kind: "apply-profile-transition";
      directory: string;
      toProfile: "site" | "app";
      approvedPlanFingerprint: string;
    }>;

export type ApplicationEnvironmentCliCommand =
  | Readonly<Omit<Extract<CliCommand, { kind: "create" }>, "analytics" | "bookingCalendly" | "contactFormWeb3Forms"> & {
      analytics?: ApplicationEnvironmentAnalyticsSettings;
      bookingCalendly?: ApplicationEnvironmentBookingSettings;
      contactFormWeb3Forms?: true;
    }>
  | Readonly<{ kind: "infer" | "doctor"; directory: string }>
  | (Readonly<{ kind: "plan-add"; directory: string }> | Readonly<{ kind: "apply-add"; directory: string; approvedPlanFingerprint: string }>) & (
      Readonly<{ capability: "contact-form-web3forms"; settings?: never }> |
      Readonly<{ capability: "booking-calendly"; settings: ApplicationEnvironmentBookingSettings }> |
      Readonly<{ capability: "analytics"; settings: ApplicationEnvironmentAnalyticsSettings }>
    )
  | (Extract<CliCommand, { kind: "plan-remove" | "apply-remove" }> & Readonly<{
      capability: "analytics" | "contact-form-web3forms" | "booking-calendly";
      persistenceRemovalPath?: never;
      persistenceRemovalHumanReviewPath?: never;
    }>);

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
  return applicationEnvironmentAnalyticsSettingsSchema.safeParse({
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
      ...(values["microsoft-clarity-id"] === undefined &&
        values["microsoft-clarity-audience"] === undefined
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
  schemaVersion: "1.0.0" | "2.0.0",
): ValidationResult<CliCommand | ApplicationEnvironmentCliCommand> {
  const environmentMode = schemaVersion === "2.0.0";
  try {
    const { values, tokens } = parseArgs({
      args: [...arguments_],
      options: {
        profile: { type: "string" },
        name: { type: "string" },
        "display-name": { type: "string" },
        directory: { type: "string" },
        "calendly-url": { type: "string" },
        "web3forms-access-key": { type: "string" },
        "calendly-mode": { type: "string" },
        multilingual: { type: "boolean" },
        "application-persistence": { type: "boolean" },
        "transactional-email-resend": { type: "boolean" },
        "background-job-delivery": { type: "boolean" },
        ...analyticsOptionDefinitions,
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
    if (environmentMode) {
      const profileResult = profileIdentifierSchema.safeParse(profile);
      const nameResult = projectFields.name.safeParse(projectName);
      const displayResult = projectFields.displayName.safeParse(displayName);
      const hasBooking = values["booking-calendly"] === true;
      const mode = values["calendly-mode"];
      const booking = hasBooking ? applicationEnvironmentBookingSettingsSchema.safeParse({ mode }) : undefined;
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
    }
    const calendlyUrl = values["calendly-url"];
    const calendlyMode = values["calendly-mode"];
    const multilingual = values.multilingual;
    const applicationPersistence = values["application-persistence"];
    const transactionalEmailResend = values["transactional-email-resend"];
    const backgroundJobDelivery = values["background-job-delivery"];
    const parsedContact = values["web3forms-access-key"] === undefined ? undefined
      : web3FormsContactSettingsSchema.safeParse({ accessKey: values["web3forms-access-key"] });
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
      ...(applicationPersistence === true ? ["application-persistence"] : []),
      ...(transactionalEmailResend === true ? ["transactional-email-resend"] : []),
      ...(backgroundJobDelivery === true ? ["background-job-delivery"] : []),
      ...(parsedContact === undefined ? [] : ["web3forms-access-key"]),
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
      (parsedContact !== undefined && !parsedContact.success) ||
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
        ...(parsedContact?.success === true ? { contactFormWeb3Forms: parsedContact.data } : {}),
        ...(multilingual === true ? { multilingual: true } : {}),
        ...(applicationPersistence === true ? { applicationPersistence: true } : {}),
        ...(transactionalEmailResend === true ? { transactionalEmailResend: true } : {}),
        ...(backgroundJobDelivery === true ? { backgroundJobDelivery: true } : {}),
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
  schemaVersion: "1.0.0" | "2.0.0",
): ValidationResult<CliCommand | ApplicationEnvironmentCliCommand> {
  try {
    const applying = kind === "apply-add";
    const { values, tokens } = parseArgs({
      args: [...arguments_],
      options: {
        directory: { type: "string" },
        capability: { type: "string" },
        "calendly-url": { type: "string" },
        "web3forms-access-key": { type: "string" },
        "calendly-mode": { type: "string" },
        ...analyticsOptionDefinitions,
        ...applicationEnvironmentOptionDefinitions,
        ...(applying ? approvedPlanOptionDefinitions : {}),
      },
      strict: true,
      allowPositionals: false,
      tokens: true,
    });
    const directory = values.directory;
    const capability = values.capability;
    if (schemaVersion === "2.0.0" && capability !== "contact-form-web3forms" && capability !== "booking-calendly" && capability !== "analytics") return invalidArguments();
    const approvedPlanFingerprint = values["approved-plan"];
    const settings = calendlyBookingSettingsSchema.safeParse({
      destination: values["calendly-url"],
      mode: values["calendly-mode"],
    });
    const environmentSettings = applicationEnvironmentBookingSettingsSchema.safeParse({ mode: values["calendly-mode"] });
    const analyticsSettings = parseAnalyticsSettings(values);
    const environmentAnalyticsSettings = parseEnvironmentAnalyticsSettings(values);
    const calendlySelection = capability === "booking-calendly";
    const analyticsSelection = capability === "analytics";
    const contactSelection = capability === "contact-form-web3forms";
    const contactSettings = web3FormsContactSettingsSchema.safeParse({ accessKey: values["web3forms-access-key"] });
    const multilingualSelection = capability === "multilingual";
    const persistenceSelection = capability === "application-persistence";
    const capabilityOptions = calendlySelection
      ? schemaVersion === "2.0.0" ? ["calendly-mode"] : ["calendly-url", "calendly-mode"]
      : analyticsSelection
        ? schemaVersion === "2.0.0" ? environmentAnalyticsOptionNames.filter((name) => values[name] !== undefined) : selectedAnalyticsOptions(values)
        : contactSelection && schemaVersion === "1.0.0" ? ["web3forms-access-key"] : [];
    const expectedOptions = [
      "directory",
      "capability",
      ...capabilityOptions,
      ...(applying ? ["approved-plan"] : []),
    ];

    if (
      !hasExactOptions(tokens, expectedOptions) ||
      !validDirectory(directory) ||
      (!analyticsSelection && !calendlySelection &&
        !multilingualSelection && !persistenceSelection && !contactSelection && capability !== "transactional-email-resend" && capability !== "background-job-delivery") ||
      (calendlySelection && !(schemaVersion === "2.0.0" ? environmentSettings.success : settings.success)) ||
      (contactSelection && schemaVersion === "1.0.0" && !contactSettings.success) ||
      (analyticsSelection && (schemaVersion === "2.0.0" ? environmentAnalyticsSettings?.success !== true : analyticsSettings?.success !== true)) ||
      (schemaVersion === "2.0.0" && (values["microsoft-clarity"] === true) !== (values["microsoft-clarity-audience"] !== undefined))
    ) {
      return invalidArguments();
    }

    if (schemaVersion === "2.0.0") {
      const selection = capability === "booking-calendly" && environmentSettings.success
        ? { capability, settings: environmentSettings.data } as const
        : capability === "analytics" && environmentAnalyticsSettings?.success === true
          ? { capability, settings: environmentAnalyticsSettings.data } as const
          : { capability: "contact-form-web3forms" } as const;
      if (kind === "apply-add") {
        if (!validApprovedPlanFingerprint(approvedPlanFingerprint)) return invalidArguments();
        return { ok: true, value: { kind, directory, ...selection, approvedPlanFingerprint } };
      }
      return { ok: true, value: { kind, directory, ...selection } };
    }

    const parsedSettings = calendlySelection && settings.success
      ? { settings: settings.data }
      : analyticsSelection && analyticsSettings?.success === true
        ? { settings: analyticsSettings.data }
        : contactSelection && contactSettings.success ? { settings: contactSettings.data } : {};

    if (kind === "apply-add") {
      if (!validApprovedPlanFingerprint(approvedPlanFingerprint)) {
        return invalidArguments();
      }

      return {
        ok: true,
        value: {
          kind,
          directory,
          capability,
          ...parsedSettings,
          approvedPlanFingerprint,
        },
      };
    }

    return {
      ok: true,
      value: { kind, directory, capability, ...parsedSettings },
    };
  } catch {
    return invalidArguments();
  }
}

function parseRemove(
  kind: "plan-remove" | "apply-remove",
  arguments_: readonly string[],
  schemaVersion: "1.0.0" | "2.0.0",
): ValidationResult<CliCommand> {
  try {
    const applying = kind === "apply-remove";
    const { values, tokens } = parseArgs({
      args: [...arguments_],
      options: {
        directory: { type: "string" },
        capability: { type: "string" },
        "persistence-removal": { type: "string" },
        "job-removal": { type: "string" },
        ...(applying
          ? { "persistence-human-review": { type: "string" } as const, "job-human-review": { type: "string" } as const }
          : {}),
        ...(applying ? approvedPlanOptionDefinitions : {}),
      },
      strict: true,
      allowPositionals: false,
      tokens: true,
    });
    const directory = values.directory;
    const capability = values.capability;
    if (schemaVersion === "2.0.0" && capability !== "contact-form-web3forms" && capability !== "booking-calendly" && capability !== "analytics") return invalidArguments();
    const approvedPlanFingerprint = values["approved-plan"];
    const persistenceSelection = capability === "application-persistence";
    const jobSelection = capability === "background-job-delivery";
    const jobRemovalPath = values["job-removal"];
    const jobHumanReviewOption = values["job-human-review"];
    const jobRemovalHumanReviewPath = typeof jobHumanReviewOption === "string" ? jobHumanReviewOption : undefined;
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
        ...(jobSelection ? ["job-removal"] : []),
        ...(jobSelection && applying ? ["job-human-review"] : []),
        ...(persistenceSelection && applying ? ["persistence-human-review"] : []),
        ...(applying ? ["approved-plan"] : []),
      ]) ||
      !validDirectory(directory) ||
      (jobSelection && !validDirectory(jobRemovalPath)) ||
      (jobSelection && applying && !validDirectory(jobRemovalHumanReviewPath)) ||
      (persistenceSelection && !validDirectory(persistenceRemovalPath)) ||
      (persistenceSelection && applying && !validDirectory(persistenceRemovalHumanReviewPath)) ||
      (capability !== "analytics" &&
        capability !== "booking-calendly" &&
        capability !== "multilingual" &&
        capability !== "application-persistence" && capability !== "transactional-email-resend" && capability !== "contact-form-web3forms" && capability !== "background-job-delivery")
    ) {
      return invalidArguments();
    }

    const persistenceInput = {
      ...(persistenceSelection && validDirectory(persistenceRemovalPath) ? { persistenceRemovalPath } : {}),
      ...(jobSelection && validDirectory(jobRemovalPath) ? { jobRemovalPath } : {}),
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
          ...(jobSelection && validDirectory(jobRemovalHumanReviewPath) ? { jobRemovalHumanReviewPath } : {}),
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

function parseUpgrade(
  kind: "plan-upgrade" | "apply-upgrade",
  arguments_: readonly string[],
): ValidationResult<CliCommand> {
  try {
    const applying = kind === "apply-upgrade";
    const { values, tokens } = parseArgs({
      args: [...arguments_],
      options: {
        directory: { type: "string" },
        capability: { type: "string" },
        "to-version": { type: "string" },
        ...(applying ? approvedPlanOptionDefinitions : {}),
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
        ...(applying ? ["approved-plan"] : []),
      ]) ||
      !validAbsoluteDirectory(directory) ||
      (capability !== "standards" && capability !== "site-routing") ||
      toVersion !== "0.4.0"
    ) {
      return invalidArguments();
    }

    if (kind === "apply-upgrade") {
      if (!validApprovedPlanFingerprint(approvedPlanFingerprint)) {
        return invalidArguments();
      }

      return {
        ok: true,
        value: {
          kind,
          directory,
          capability,
          toVersion,
          approvedPlanFingerprint,
        },
      };
    }

    return {
      ok: true,
      value: { kind, directory, capability, toVersion },
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

export function parseCliArguments(arguments_: readonly string[], schemaVersion: "2.0.0"): ValidationResult<ApplicationEnvironmentCliCommand>;
export function parseCliArguments(arguments_: readonly string[]): ValidationResult<CliCommand>;
export function parseCliArguments(
  arguments_: readonly string[],
  schemaVersion: "1.0.0" | "2.0.0" = "1.0.0",
): ValidationResult<CliCommand | ApplicationEnvironmentCliCommand> {
  const [command, ...commandArguments] = arguments_;
  if (schemaVersion === "2.0.0" && command !== "create" && command !== "infer" && command !== "doctor" && command !== "plan-add" && command !== "apply-add" && command !== "plan-remove" && command !== "apply-remove") {
    return invalidArguments();
  }

  switch (command) {
    case "create":
      return parseCreate(commandArguments, schemaVersion);
    case "infer":
    case "doctor":
    case "diff":
      return parseReadOnly(command, commandArguments);
    case "plan-add":
    case "apply-add":
      return parseAdd(command, commandArguments, schemaVersion);
    case "plan-remove":
    case "apply-remove":
      return parseRemove(command, commandArguments, schemaVersion);
    case "plan-upgrade":
    case "apply-upgrade":
      return parseUpgrade(command, commandArguments);
    case "plan-profile-transition":
    case "apply-profile-transition":
      return parseProfileTransition(command, commandArguments);
    default:
      return invalidArguments();
  }
}
