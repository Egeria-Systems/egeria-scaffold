export function isPinnedGitHubActionReference(
  reference,
  expectedRepository,
) {
  if (typeof reference !== "string") {
    return false;
  }

  const separatorIndex = reference.lastIndexOf("@");

  return (
    separatorIndex > 0 &&
    reference.slice(0, separatorIndex) === expectedRepository &&
    /^[0-9a-f]{40}$/u.test(reference.slice(separatorIndex + 1))
  );
}
