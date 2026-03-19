---
name: feature-flag-status
description: "Gives a full status report for a feature flag — which environments it's active in, its current targeting rules, and whether it's been killed. Use this before deploying or debugging a flag."
---

## Step 1 — Resolve the flag name and workspace

If the user provided a flag name (e.g. `/feature-flag-status my-flag`), use it directly.

If no flag name was given, ask: "Which feature flag do you want to check?"

If no workspace is specified, call `list_workspaces` and use the first result, or ask if there are multiple.

## Step 2 — Get flag metadata

Call `get_feature_flag` with the workspace ID and flag name to get:

- Flag description and tags
- Default treatment
- Creation date

## Step 3 — List environments

Call `list_environments` with the workspace ID to get all available environments (e.g. production, staging, development).

## Step 4 — Get flag definition per environment

For each environment, call `get_flag_definition` with the workspace ID, environment ID, and flag name to get:

- Whether the flag is killed
- Targeting rules (which users/segments see which treatment)
- Default rule

## Step 5 — Present the status report

Structure the output as:

```
### Feature Flag: <flag-name>

**Workspace**: <workspace name>
**Default treatment**: <treatment>
**Tags**: <tags or "none">

#### Environment Status

| Environment | Status | Default Treatment |
|-------------|--------|-------------------|
| production  | ✅ Active / 🔴 Killed | <treatment> |
| staging     | ✅ Active / 🔴 Killed | <treatment> |
| ...         | ...    | ...               |

#### Targeting Rules (<environment>)

<describe who gets what — e.g. "10% of users get treatment ON, rest get OFF">
```

Flag every environment where the flag is **killed** prominently.

## Step 6 — Offer actions (optional)

If the flag is killed in an environment, offer to restore it via `restore_feature_flag`.
If the flag appears to be fully rolled out everywhere, offer to note it as a candidate for cleanup.
