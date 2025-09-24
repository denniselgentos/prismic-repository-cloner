# Prismic Respository Cloner

With this tool you can clone and duplicate a Prismic repository easily and automatically. It uses the Prismic Migration API under the hood.

Here's a YouTube video on how to use the tool (kept as a reference):

[![youtube video on how to use the tool](https://img.youtube.com/vi/MXtQtTnjM6I/0.jpg)](https://www.youtube.com/watch?v=MXtQtTnjM6I)

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Overview

This app migrates from a source Prismic repository to a destination repository:

- Fetch assets from the source repo and download them locally
- Upload assets to the destination repo
- Build a robust asset ID mapping from source → destination (by filename, with smart fallbacks)
- Check if destination repo already contains required assets and enable document migration
- Migrate documents using Prismic's Migration API (with rate limit handling and better logging)
- Validate and guide language (locale) configuration between repos

## Features

- Assets flow and checks:
  - Get asset list from source
  - Download assets locally (skips ones already downloaded)
  - Upload assets to destination
  - Check if all assets already exist in destination
- Asset ID mapping for documents:
  - If upload occurs in this session, use returned `newAssets` (source→dest IDs)
  - Otherwise, auto-build a mapping by normalized filename, preferring exact extension and falling back to common conversions (jpg/png → webp)
  - Detailed logs for ambiguous matches and unmapped assets
- Document migration:
  - Safe title extraction, request validation, robust error logs
  - Handles 429 with exponential backoff, configurable delay between requests
  - Continues after failures and reports counts
- Language (locales) guidance:
  - Detects languages used in documents and compares with destination repo
  - Provides clear instructions to add missing languages (via Prismic Dashboard)

## Prerequisites

- Node.js 18+
- Access to the source and destination Prismic repositories
- Prismic Write API Key for the destination repo (for assets)
- Prismic Migration API key (for documents)

## Environment Variables

Create a `.env.local` file and set the following variables:

- `Source_Repo` — source repository name (e.g. `my-source-repo`)
- `Destination_Repo` — destination repository name (e.g. `my-destination-repo`)
- `Project_Path` — absolute path to the project root on your machine (used for asset file reads during upload)
- `Prismic_Write_API_Key` — write API key for the destination repository (assets upload and checks)
- `Migration_Api_Key` — Prismic Migration API key (documents migration)
- `Repo_Login_Email` — email for authenticating read access (source)
- `Repo_Login_Password` — password for authenticating read access (source)
- `Prismic_Email` — email for authenticating destination (fallback when needed)
- `Prismic_Password` — password for authenticating destination (fallback when needed)

Notes:

- Languages (locales) must be added via the Prismic Dashboard; there is no API to add locales programmatically.
- The app can detect missing languages and tell you exactly which to add.

## Getting Started

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open `http://localhost:3000` to start the migration flow.

## Usage (UI Flow)

1. Get Assets List

- Fetches the source assets and enables “Download assets”.
- Also checks if all assets already exist in the destination and, if yes, enables “Migrate All Documents”.

2. Download Assets

- Downloads assets locally into the `images/` directory (skips existing files).

3. Upload Assets

- Uploads assets to destination. When upload completes, the app has an in-session `newAssets` mapping of `prevID` (source) → `id` (destination).
- If assets were already uploaded previously, the app detects this and enables “Migrate All Documents”.

4. Migrate All Documents

- If `newAssets` is not present, the app automatically builds a filename-based mapping using the Asset API from both repos.
- Replaces all source asset IDs inside document payloads (deep traversal of strings/arrays/objects), then calls the Migration API.
- Handles 429 Too Many Requests with backoff and logs errors (400 Bad Request) with details.

5. Language Check (optional but recommended)

- Use the “Check Languages” button to verify missing locales in destination.
- If missing, follow instructions to add locales via Prismic Dashboard: Settings → Translations & Locales.

## Asset Mapping Details

When `newAssets` is not provided (e.g., you already uploaded assets earlier), the app:

- Fetches `id` and `filename` for source and destination assets
- Normalizes filenames (lowercase, trims, removes diacritics, collapses separators)
- Matches by normalized basename (ignoring extension)
- Prefers same extension, then common conversions (jpg/png → webp), then first fallback
- Logs ambiguous filename matches and a sample of unmapped assets

Limitations:

- If filenames were changed between repos, those assets won’t auto-map. You’ll see them logged as unmapped; rename or re-upload to resolve.

## Troubleshooting

- 400 Bad Request (Assets not found):
  - Caused by source asset IDs present in documents but not found in destination. Ensure assets exist and allow the mapping to replace IDs. Check logs for remaining unmapped assets.
- 400 Bad Request (Custom type errors):
  - Ensure your destination repo has the same custom types and fields. The app migrates types and slices before documents, but field mismatches will still surface.
- 400 Bad Request (Non-repeatable type already exists):
  - The destination already has a document of that non-repeatable type; adjust your data or skip duplicates.
- 400 Bad Request (Language invalid):
  - Add the missing language in destination (Dashboard → Settings → Translations & Locales).
- 429 Too Many Requests:
  - The app waits and retries automatically. You can increase delays if needed.

## API Routes (for reference)

- `GET /api/assets` — fetch source assets (raw text JSON)
- `POST /api/assets` — download assets locally
- `PUT /api/assets` — upload assets to destination (returns `newAssets` mapping)
- `POST /api/assets/check-uploaded` — returns `{ allUploaded }` by checking destination assets
- `POST /api/documents` — migrates documents (uses `newAssets` or filename mapping)
- `GET /api/languages` — compares languages between repos and provides instructions
- `GET /api/test-languages` — developer test endpoint for language detection

## License

MIT
