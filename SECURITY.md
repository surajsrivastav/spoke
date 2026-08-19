# Security Policy

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
