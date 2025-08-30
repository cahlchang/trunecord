# macOS Code Signing Guide for trunecord

## Current Issue
The macOS release binaries are not code-signed, which causes Gatekeeper to block the app with the message "trunecord is damaged and can't be opened."

## Temporary Workarounds for Users

### Option 1: System Settings
1. Open **System Settings** → **Privacy & Security**
2. Look for the message about trunecord being blocked
3. Click **Open Anyway**

### Option 2: Right-click to Open
1. Right-click (or Control-click) on trunecord.app
2. Select **Open** from the context menu
3. Click **Open** in the warning dialog

### Option 3: Remove Quarantine via Terminal
```bash
xattr -cr /Applications/trunecord.app
```

## Permanent Solution: Code Signing

### Requirements
1. **Apple Developer Account** ($99/year)
2. **Developer ID Application Certificate**
3. **Developer ID Installer Certificate** (for DMG)

### Implementation Steps

#### 1. Create Certificates
```bash
# List available certificates
security find-identity -v -p codesigning

# You should see something like:
# "Developer ID Application: Your Name (TEAMID)"
```

#### 2. Update Release Workflow
Add code signing to `.github/workflows/release.yml`:

```yaml
- name: Code Sign App Bundle
  if: runner.os == 'macOS'
  env:
    MACOS_CERTIFICATE: ${{ secrets.MACOS_CERTIFICATE }}
    MACOS_CERTIFICATE_PWD: ${{ secrets.MACOS_CERTIFICATE_PWD }}
    MACOS_IDENTITY: ${{ secrets.MACOS_IDENTITY }}
  run: |
    # Import certificate
    echo $MACOS_CERTIFICATE | base64 --decode > certificate.p12
    security create-keychain -p actions temp.keychain
    security import certificate.p12 -k temp.keychain -P $MACOS_CERTIFICATE_PWD -T /usr/bin/codesign
    security set-key-partition-list -S apple-tool:,apple: -s -k actions temp.keychain
    
    # Sign the app
    codesign --force --deep --sign "$MACOS_IDENTITY" \
      --options runtime \
      --entitlements entitlements.plist \
      "$APP_BUNDLE"
    
    # Verify
    codesign --verify --verbose "$APP_BUNDLE"
```

#### 3. Notarization (Optional but Recommended)
After signing, notarize the app for the best user experience:

```yaml
- name: Notarize App
  env:
    APPLE_ID: ${{ secrets.APPLE_ID }}
    APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
    TEAM_ID: ${{ secrets.TEAM_ID }}
  run: |
    # Create ZIP for notarization
    ditto -c -k --keepParent "$APP_BUNDLE" "trunecord.zip"
    
    # Submit for notarization
    xcrun notarytool submit trunecord.zip \
      --apple-id "$APPLE_ID" \
      --password "$APPLE_PASSWORD" \
      --team-id "$TEAM_ID" \
      --wait
    
    # Staple the notarization
    xcrun stapler staple "$APP_BUNDLE"
```

### GitHub Secrets Required
Add these secrets to your GitHub repository:
- `MACOS_CERTIFICATE`: Base64-encoded .p12 certificate
- `MACOS_CERTIFICATE_PWD`: Certificate password
- `MACOS_IDENTITY`: "Developer ID Application: Name (TEAMID)"
- `APPLE_ID`: Your Apple ID email
- `APPLE_PASSWORD`: App-specific password
- `TEAM_ID`: Your Apple Developer Team ID

### Creating an Entitlements File
Create `go-client/entitlements.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.security.network.server</key>
    <true/>
</dict>
</plist>
```

## Alternative: Ad-hoc Signing (Free)
For testing purposes, you can use ad-hoc signing (no Developer Account required):

```bash
# Ad-hoc sign (works on the same machine only)
codesign --force --deep -s - "$APP_BUNDLE"
```

This removes the "damaged" message but still shows "unidentified developer" warning.

## Resources
- [Apple Developer - Notarizing macOS Software](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [GitHub Actions - Code Signing](https://docs.github.com/en/actions/deployment/deploying-xcode-applications/installing-an-apple-certificate-on-macos-runners-for-xcode-development)