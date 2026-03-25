# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | ✅        |

## Reporting a Vulnerability

**Please do NOT open a public GitHub Issue for security vulnerabilities.**

If you discover a vulnerability — especially one that could expose personal data (health logs, private notes, authentication tokens, or API keys) — please report it privately.

**Contact:** Report via GitHub's [Private Security Advisory](https://github.com/ashishworkacc/fluentpm/security/advisories/new) feature, or email `[your-email]` with the subject line `[SECURITY] FluentPM Vulnerability Report`.

### What to include

- A clear description of the vulnerability
- Steps to reproduce
- Potential impact (what data or systems are at risk)
- Any suggested mitigations, if you have them

### What to expect

- **Acknowledgement** within 48 hours
- **Status update** within 7 days
- **Resolution target** within 90 days for confirmed vulnerabilities
- You will be credited in the release notes (unless you prefer anonymity)

## Scope

Issues in scope:
- API key exposure or leakage
- Authentication bypass (Firebase Auth)
- Firestore security rule misconfigurations allowing unauthorized data access
- XSS vulnerabilities in AI-generated content rendering

Out of scope:
- Issues requiring physical access to a device
- Social engineering attacks
- Bugs unrelated to security (please open a regular Issue)

## Responsible Disclosure

We ask that you give us reasonable time to address the issue before any public disclosure. We are committed to working with security researchers in good faith.
