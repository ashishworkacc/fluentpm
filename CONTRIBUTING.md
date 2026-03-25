# Contributing to FluentPM

Thank you for your interest in contributing! This document explains how to set up the development environment, run the project locally, and submit changes.

---

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

---

## Development Setup

### Prerequisites

- **Node.js** 20+ (check with `node --version`)
- **npm** 9+ (check with `npm --version`)
- A **Firebase** project with Firestore and Google Auth enabled
- An **OpenRouter** API key

### 1. Fork & Clone

```bash
git clone https://github.com/YOUR_USERNAME/fluentpm.git
cd fluentpm
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Copy the example env file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your Firebase config and OpenRouter key. **Never commit this file.**

### 4. Run the Dev Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## Before Submitting a PR

### Lint

```bash
npm run lint
```

Fix any ESLint errors before opening a PR. PRs with lint failures will not be merged.

### Build Check

```bash
npm run build
```

Make sure the production build passes with zero errors.

---

## Submitting a Pull Request

1. **Branch naming:** `feat/short-description`, `fix/short-description`, or `chore/short-description`
2. **One concern per PR** — keep changes focused and reviewable
3. **No direct pushes to `main`** — all changes must go through a PR
4. **Describe your change** in the PR body: what problem it solves, how it was tested, any screenshots for UI changes
5. **Reference any related Issues** using `Closes #123` or `Fixes #123`

---

## Project Structure

```
src/
  components/     # React screen components
  data/           # Static data (scenarios, phrases, opponents)
  hooks/          # Custom React hooks
  lib/            # Utilities (Firebase, OpenRouter, Speech APIs)
```

---

## Questions?

Open a [GitHub Discussion](https://github.com/ashishworkacc/fluentpm/discussions) for general questions, or open an [Issue](https://github.com/ashishworkacc/fluentpm/issues) for bugs and feature requests.
