import { execFileSync } from "node:child_process";

const canonicalRevisionPattern = /^[0-9a-f]{40}$/u;

function revisionIsApproved() {
  if (process.argv.length !== 2) return false;

  const expectedRevision = process.env.EXPECTED_REVISION;
  const eventRevision = process.env.GITHUB_SHA;
  if (
    process.env.GITHUB_REF !== "refs/heads/main" ||
    typeof expectedRevision !== "string" ||
    !canonicalRevisionPattern.test(expectedRevision) ||
    eventRevision !== expectedRevision
  ) {
    return false;
  }

  const checkedOutRevision = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  return checkedOutRevision === eventRevision;
}

try {
  if (!revisionIsApproved()) {
    process.stderr.write("Approved revision admission failed.\n");
    process.exitCode = 1;
  }
} catch {
  process.stderr.write("Approved revision admission failed.\n");
  process.exitCode = 1;
}
