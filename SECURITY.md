# Security Policy

## Beta deployment boundaries

This release is for trusted operators on a dedicated local machine or VM.
Do not deploy it as a public API, a multi-tenant service, or on a host holding
unrelated production credentials.

- The orchestrator controls Docker (directly in host development, via a mounted
  Docker socket in Compose). Docker-daemon access is a host-level privilege.
  Task containers are a process/filesystem boundary, not a hardened boundary
  against malicious repositories or agents. They currently run as root with
  network access and no per-container CPU/memory limits.
- `AUTH_ENABLED=false` is for local development only. Existing SSO/RBAC protects
  selected operations, but not all task, trace, event, and cost routes. Setting
  it to `true` does not make the entire API safe to expose. Compose publishes
  ports only on `127.0.0.1`; keep them private until route authorization is complete.
- Cancellation is cooperative and checked between workflow activities. It does
  not immediately interrupt a running shell command or model request. For an
  emergency, stop the affected Docker container and worker yourself.
- Agent tasks execute repository scripts and make outbound requests. Use test
  repositories and least-privilege credentials; repository scripts and logs may
  expose credentials. Do not attach organization-wide tokens.
- The WhatsApp scaffold does not validate incoming POST signatures and does not
  enqueue tasks. It is opt-in and must not be publicly deployed in this release.
- Verification checks command exit status; it does not prove correctness or
  detect an agent weakening its own tests. Review every PR before merging.

Complete route authorization, credential redaction, resource/network limits,
and immediate cancellation before offering an internet-facing deployment.

## Supported versions

The project currently accepts security reports for the latest main branch.

## Reporting a vulnerability

Please do not open a public GitHub issue for security vulnerabilities.

Instead, use the GitHub Security Advisory flow for this repository:

https://github.com/surajsrivastav/spoke/security/advisories/new

If you are unable to use GitHub Security Advisories, reach out to the maintainers through a private channel and share a clear report including:

- a description of the vulnerability
- affected code paths or files
- reproduction steps, if known
- potential impact
- suggested mitigation, if available

## Disclosure expectations

We aim to acknowledge reports promptly and work toward a fix in a reasonable timeframe. We appreciate responsible disclosure and will coordinate with reporters before making sensitive details public.

## Security best practices

- Do not commit credentials, tokens, or secret material to the repository.
- Rotate any leaked credentials immediately.
- Use local-only environment files and never include `.env.local` in a pull request.
