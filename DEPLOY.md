# Deployment Guide

This document explains how to bump the project version and ship new builds of the Go client, the auth Lambda/API Gateway stack, and the Chrome extension.

## 1. Prerequisites
- Node.js 18+, npm
- Go 1.20+
- Terraform 1.7+
- AWS credentials with access to the deployment account (set via `TF_VAR_aws_profile` or equivalent)
- Chrome Web Store developer access (for publishing the extension)

## 2. Update Version Metadata
All components read their version from `VERSION.txt`.

1. Pick the new semantic version (for example `1.3.5`).
2. Update the version file and propagate it everywhere:
   ```bash
   echo "1.3.5" > VERSION.txt
   node scripts/update-version.js
   ```
3. Run the automated test suites before continuing:
   ```bash
   npm test --prefix auth-server
   (cd go-client && go test ./...)
   npm test --prefix extension   # optional but recommended
   ```

> The helper script rewrites the extension manifest, Go constants, README copy, Terraform defaults, and Lambda fallbacks. Commit the changes after verifying the diff.

## 3. Build and Release the Go Client
1. Build the binaries you plan to distribute (repeat per target platform as needed):
   ```bash
   cd go-client
   mkdir -p dist
   go build -o dist/trunecord ./cmd
   ```
2. Run smoke tests locally:
   ```bash
   ./dist/trunecord --help
   ```
3. Create or update the GitHub Release:
   - Tag the release, e.g. `git tag v1.3.5 && git push origin v1.3.5`.
   - Upload the compiled binaries plus release notes.
4. Update the Terraform variables or `.tfvars` file with the new download URL if it differs from the default (`https://github.com/cahlchang/trunecord/releases/latest`).

## 4. Build and Deploy the Auth Lambda / API Gateway
1. Ensure the desired AWS profile is active (for example via `direnv` or manual export of `TF_VAR_aws_profile`).
2. Generate the Lambda bundle (the Terraform plan will reuse it):
   ```bash
   npm run build:lambda --prefix auth-server
   ```
3. Verify Terraform parameters (override defaults in `terraform.tfvars` as necessary):
   - `go_client_latest_version`, `go_client_min_version`
   - `extension_latest_version`, `extension_min_version`
   - Download URLs / release notes
4. Run Terraform:
   ```bash
   terraform -chdir=terraform init
   terraform -chdir=terraform plan
   terraform -chdir=terraform apply
   ```
5. After apply succeeds, validate:
   ```bash
   curl https://<new-rest-id>.execute-api.ap-northeast-1.amazonaws.com/prod/api/version
   ```
   Confirm the response matches the expected versions and URLs.

## 5. Publish the Chrome Extension Update
1. Install dependencies and run tests:
   ```bash
   cd extension
   npm install
   npm test
   ```
2. Produce the upload package (script excludes `node_modules`, tests, coverage by default):
   ```bash
   npm run build:zip
   ```
3. Open the Chrome Web Store Developer Dashboard, replace the package with `trunecord-extension.zip`, and submit the new version (the manifest already carries the version from `VERSION.txt`).
4. Record the published extension ID and store listing link if they changed (they normally remain the same).

## 6. Post-Deployment Checklist
- [ ] Confirm `/api/version` returns the new version metadata.
- [ ] Start the Go client locally; ensure the UI card and status API show “Up to date”.
- [ ] Install the updated extension (from store or developer mode) and verify the popup does not show an outdated warning.
- [ ] Update the Discord Developer Portal OAuth2 redirect URIs so that `https://<rest-id>.execute-api.ap-northeast-1.amazonaws.com/prod/api/callback` is registered.
- [ ] Update any release notes, documentation, or announcement channels.
- [ ] Tag and push the release branch/commit.

## 7. Rollback Notes
- To roll back Lambda/API Gateway changes, use `terraform -chdir=terraform apply` with the previous state or `terraform destroy` on the new stack if necessary.
- For the Go client and Chrome extension, redeploy the previous binaries/CRX using the same steps but the older version from `VERSION.txt`.

Keep this guide alongside the repo so future deploys follow the same checklist.
