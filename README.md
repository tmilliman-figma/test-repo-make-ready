# Make-ready import fixture

A dependency-free static app with working `.figma/make` lifecycle scripts. Use it to test importing an existing repository whose development server and static preview are already configured.

## Run locally

Requires Node.js 22 or newer and npm. `.mise.toml` selects Node.js 22 when mise is available.

```sh
./.figma/make/setup
./.figma/make/install
./.figma/make/dev
```

Open `http://localhost:3000` and click **Test interaction**. No environment variables, credentials, backend, or third-party dependencies are required.

## Make lifecycle files

| File | Purpose |
| --- | --- |
| `.figma/make/setup` | Non-interactive Node.js version check |
| `.figma/make/install` | Reproducible npm install from the lockfile |
| `.figma/make/dev` | Start the app on `0.0.0.0:3000`; honors `PORT` and `FIGMA_DEV_SERVER_HOST` |
| `.figma/make/dev.json` | Declare the development port and file watch triggers |
| `.figma/make/deploy-preview` | Build `dist/` and upload it using `figma make deploy-preview` |
| `.figma/make/deploy` | Build `dist/` and publish it using `figma make deploy` |

Deployment scripts require the authenticated `figma` CLI supplied by the Make environment. All app asset URLs are relative, so the static bundle also works under a URL prefix.

## Import test case

1. Import this repository into Figma Make.
2. Wait for development bootstrap and preview verification.
3. Check that the page displays **Ready from the first import.**
4. Click **Test interaction** and check that the click count updates.

When bootstrap verification is enabled, this fixture is intended to exercise the successful verification path: the existing scripts should be sufficient without a setup-agent repair turn. It is not a fixture for missing-script fallback.

## Validate the fixture

```sh
npm test
npm run build
npm run preview
```

The tests exercise setup/install, development serving, static output, and deployment command arguments. They replace the deployment CLI with a local test double and do not publish a site. Actual preview upload and import verification must be checked in Make.
