type UnknownRecord = Record<string, unknown>;

export interface ProofFact {
  identifier: string;
  label: string;
  value: string;
}

export interface ProofPageCopy {
  eyebrow: string;
  heading: string;
  summary: string;
  facts: readonly ProofFact[];
  runtimeReportLink: string;
}

export interface ProofCopy {
  metadata: {
    title: string;
    description: string;
  };
  page: ProofPageCopy;
}

function readRecord(value: unknown, path: string): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }

  return value as UnknownRecord;
}

function readNonEmptyString(
  record: UnknownRecord,
  key: string,
  path: string,
): string {
  const value = record[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${path}.${key} must be a non-empty string`);
  }

  return value;
}

function readFacts(value: unknown): readonly ProofFact[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("page.facts must be a non-empty array");
  }

  const identifiers = new Set<string>();

  return value.map((candidate, index) => {
    const path = `page.facts[${index}]`;
    const fact = readRecord(candidate, path);
    const identifier = readNonEmptyString(fact, "identifier", path);

    if (identifiers.has(identifier)) {
      throw new Error(`duplicate fact identifier: ${identifier}`);
    }

    identifiers.add(identifier);

    return {
      identifier,
      label: readNonEmptyString(fact, "label", path),
      value: readNonEmptyString(fact, "value", path),
    };
  });
}

export function parseProofCopy(input: unknown): ProofCopy {
  const root = readRecord(input, "copy");
  const metadata = readRecord(root.metadata, "metadata");
  const page = readRecord(root.page, "page");

  return {
    metadata: {
      title: readNonEmptyString(metadata, "title", "metadata"),
      description: readNonEmptyString(metadata, "description", "metadata"),
    },
    page: {
      eyebrow: readNonEmptyString(page, "eyebrow", "page"),
      heading: readNonEmptyString(page, "heading", "page"),
      summary: readNonEmptyString(page, "summary", "page"),
      facts: readFacts(page.facts),
      runtimeReportLink: readNonEmptyString(
        page,
        "runtimeReportLink",
        "page",
      ),
    },
  };
}
