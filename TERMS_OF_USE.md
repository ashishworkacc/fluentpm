# Terms of Use & Ethical Disclosure

FluentPM is open-sourced to contribute to the builder community and to showcase the architecture of an AI-powered communication training tool. While the code is available under the [AGPL-3.0 License](LICENSE), the following ethical guidelines apply to its use.

---

## 1. Non-Commercial Personal Use

This system is designed for individual self-improvement and skill development. Commercial redistribution — including selling "FluentPM as a Service" or using this specific logic to power a paid productivity or coaching platform without significant functional transformation — is strictly prohibited under the terms of the AGPL-3.0 license.

## 2. Attribution & Derivative Works

If you use this architecture or a substantial portion of the logic in your own public repository:

- **Mandatory Credit:** You must provide a visible link back to this original repository.
- **No Impersonation:** You may not use the branding, "FluentPM" naming conventions, or UI design in a way that suggests an official affiliation with the original creator.
- **Share-Alike:** Per AGPL-3.0, if you run a modified version as a network service, you must make the modified source code available to your users.

## 3. Data Sovereignty & Anti-Exploitation

- **No Scraping:** Using this code to build tools that scrape or aggregate data from third-party services in a way that violates their respective Terms of Service is a violation of this project's intent.
- **Security First:** This code is provided "as-is." If you find a vulnerability that could expose personal user data, please report it via the instructions in [SECURITY.md](SECURITY.md) rather than exploiting it or disclosing it publicly.
- **User Data:** This app stores user session data in Firebase Firestore under each user's own authenticated account. Do not modify the security rules to allow cross-user data access.

## 4. Limitation of Liability

The creator is not responsible for:
- Any API costs incurred (Firebase, OpenRouter, etc.) resulting from deployment of this stack
- Data loss resulting from misconfiguration or deployment errors
- Any use of this software that violates the terms of third-party services (Firebase, OpenRouter, Google)

Always use the provided [`.env.example`](.env.example) to ensure your private keys are never committed to your own forks.

## 5. Intended Use Statement

> This project is intended for personal productivity, language learning, and educational purposes. It is built for individuals — particularly non-native English speakers in professional roles — who want to improve their spoken communication skills through AI-assisted practice.

Massive automated usage, commercial redistribution, or use as a backend for third-party applications without attribution is discouraged and may violate the license terms.

---

*These terms supplement, but do not replace, the [AGPL-3.0 License](LICENSE). In any conflict, the license governs.*
