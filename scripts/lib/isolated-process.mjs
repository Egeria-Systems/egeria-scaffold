import { lstat, rm } from "node:fs/promises";

const inheritedEnvironmentKeys = Object.freeze([
  "PATH",
  "SystemRoot",
  "ComSpec",
  "PATHEXT",
  "LANG",
]);

export const isolatedProcessOptions = Object.freeze({
  encoding: "utf8",
  maxBuffer: 1024 * 1024,
  shell: false,
  windowsHide: true,
});

function findEnvironmentValue(name) {
  const normalizedName = name.toLowerCase();
  return Object.entries(process.env).find(
    ([key, value]) =>
      key.toLowerCase() === normalizedName && value !== undefined,
  )?.[1];
}

export function createIsolatedProcessEnvironment(additions = {}) {
  const environment = {};

  for (const key of inheritedEnvironmentKeys) {
    const value = findEnvironmentValue(key);
    if (value !== undefined) {
      environment[key] = value;
    }
  }
  if (process.platform === "darwin") {
    environment.__CF_USER_TEXT_ENCODING = "0x0:0x0:0x0";
  }

  return {
    ...environment,
    CI: "true",
    NEXT_TELEMETRY_DISABLED: "1",
    ...additions,
  };
}

export async function readPathIdentity(path) {
  const stats = await lstat(path, { bigint: true });

  return {
    path,
    device: stats.dev,
    inode: stats.ino,
    isDirectory: stats.isDirectory(),
    isSymbolicLink: stats.isSymbolicLink(),
  };
}

export async function pathIdentityMatches(identity) {
  try {
    const currentIdentity = await readPathIdentity(identity.path);
    return (
      !currentIdentity.isSymbolicLink &&
      currentIdentity.isDirectory &&
      currentIdentity.device === identity.device &&
      currentIdentity.inode === identity.inode
    );
  } catch {
    return false;
  }
}

export async function cleanupOwnedDirectory(identity) {
  if (!(await pathIdentityMatches(identity))) {
    return false;
  }

  try {
    await rm(identity.path, { recursive: true });
    return true;
  } catch {
    return false;
  }
}
