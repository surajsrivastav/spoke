# Changelog

## Unreleased

- Upgrade Next.js to the patched 15.5 line and adapt asynchronous route params;
  update Hono and constrain vulnerable transitive dependencies to patched versions.

- Add CI quality checks, real Docker sandbox smoke testing, container builds,
  dependency update configuration, ownership, and a PR template.
- Pin the development/build toolchain and frozen dependency installation.
- Separate default infrastructure from opt-in application containers, use Docker
  service addresses, bind published ports to loopback, and load the root local environment.
- Preserve verification failures and stop when dependency installation fails.
- Pass agent commands directly to Docker without evaluation by a host shell;
  quote file paths/git arguments and clean up failed sandbox provisioning.
- Clarify experimental beta scope, security boundaries, and release acceptance checks.
