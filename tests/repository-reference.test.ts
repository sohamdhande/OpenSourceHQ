import { describe, expect, it } from "vitest";
import { parseGitHubRepositoryReference } from "@/features/repositories/repository-reference";

describe("parseGitHubRepositoryReference", () => {
  it.each([
    ["openmrs/openmrs-core", { owner: "openmrs", name: "openmrs-core" }],
    ["sugarlabs/sugar", { owner: "sugarlabs", name: "sugar" }],
    ["https://github.com/OpenMRS/openmrs-core", { owner: "OpenMRS", name: "openmrs-core" }],
    ["https://github.com/sugarlabs/sugar.git", { owner: "sugarlabs", name: "sugar" }],
    ["  owner/repo  ", { owner: "owner", name: "repo" }],
  ])("parses %s", (input, expected) => {
    expect(parseGitHubRepositoryReference(input)).toEqual(expected);
  });

  it.each([
    "",
    "owner",
    "owner/repo/extra",
    "owner/",
    "owner/.git",
    "owner/..git",
    "https://github.com/owner/repo/issues",
    "https://github.com/owner/repo?tab=readme",
    "https://github.com.evil.test/owner/repo",
    "https://user:pass@github.com/owner/repo",
    "git@github.com:owner/repo.git",
    "javascript:alert(1)",
  ])("rejects unsafe or incomplete reference %s", (input) => {
    expect(parseGitHubRepositoryReference(input)).toBeNull();
  });
});
