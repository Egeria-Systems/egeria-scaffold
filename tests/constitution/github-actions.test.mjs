import assert from "node:assert/strict";
import test from "node:test";

import { isPinnedGitHubActionReference } from "../helpers/github-actions.mjs";

test("live workflow actions require the expected repository and a full lowercase commit SHA", () => {
  assert.equal(
    isPinnedGitHubActionReference(
      "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
      "actions/checkout",
    ),
    true,
  );
  assert.equal(
    isPinnedGitHubActionReference(
      "actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803",
      "actions/checkout",
    ),
    true,
  );

  for (const reference of [
    "actions/checkout@v7",
    "actions/checkout@3d3c42e",
    "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90bg",
    "actions/checkout@3D3C42E5AAC5BA805825DA76410C181273BA90B1",
    "actions/setup-node@3d3c42e5aac5ba805825da76410c181273ba90b1",
    undefined,
  ]) {
    assert.equal(
      isPinnedGitHubActionReference(reference, "actions/checkout"),
      false,
    );
  }
});
