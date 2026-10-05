# Temporary npm audit exception — GHSA-vfj7-8cjw-p6xm

Approved on 2026-10-05 and automatically expires after 2026-10-19.

The exception covers only `GHSA-vfj7-8cjw-p6xm` / `CVE-2026-93687` in
`braces`. GitHub reports no patched release. It does not lower the audit
severity and does not accept any other advisory.

Dependency paths:

- production: `@daytona/sdk -> fast-glob -> micromatch -> braces`;
- development/build: `tailwindcss -> chokidar|fast-glob|micromatch -> braces`;
- development/lint: `eslint-config-next -> @next/eslint-plugin-next -> fast-glob -> micromatch -> braces`.

NØLINE does not import `braces`, `micromatch`, or `fast-glob`. Tailwind and
ESLint consume trusted repository configuration during build and development.
The Daytona SDK loads `fast-glob` only from `Image.extractCopySources` for
Dockerfile `COPY` sources; the NØLINE runtime uses `Daytona` and `Sandbox`
operations and never calls this image helper. Forge `search_code` invokes `rg`
with normalized literal terms and bounded paths/extensions, so mission input,
repository filenames, and repository content do not reach `braces`.

Removal condition: when a compatible patched `braces` version is published,
upgrade the relevant dependency and lockfile, remove the policy entry, and
restore zero accepted advisories. Renewal after expiry requires a new explicit
review and date change.
