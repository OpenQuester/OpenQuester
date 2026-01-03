# Google Play Store Internal Testing Setup

This document guides the setup for automated uploads to Google Play Store's internal testing track.

## Prerequisites

1. **Google Play Developer Account** with access to OpenQuester app
2. **Service Account** in Google Cloud Console with Play Developer API access
3. **GitHub Repository Secrets** configured

## Step-by-Step Setup

### 1. Create Google Cloud Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable **Google Play Developer API**:

   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Play Developer API"
   - Click "Enable"

4. Create Service Account:

   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "Service Account"
   - Fill in account details (e.g., `openquester-ci`)
   - Click "Create and Continue"
   - Skip optional steps, click "Done"

5. Create Service Account Key:
   - Click on the created service account
   - Go to "Keys" tab
   - Click "Add Key" > "Create new key"
   - Choose **JSON** format
   - Click "Create" (JSON file will download automatically)

### 2. Grant Play Console Access

1. Go to [Google Play Console](https://play.google.com/console/)
2. Select your app (OpenQuester)
3. Go to **Settings** > **Users and Permissions**
4. Click **Invite User**
5. Enter the service account email (looks like `openquester-ci@project-id.iam.gserviceaccount.com`)
6. Grant necessary permissions:
   - ✅ **Release management** (required)
   - ✅ **View app information** (required)
   - Optionally: View financial data, Manage release notes, etc.
7. Click "Send invitation"

### 3. Configure GitHub Secret

1. Go to your GitHub repository
2. Navigate to **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret**
4. Name: `PLAY_STORE_SERVICE_ACCOUNT_JSON`
5. Value: Copy the entire contents of the JSON file downloaded in step 1.5
6. Click "Add secret"

### 4. Configure Package Name

The workflow uses the package name `com.openquester.openquester`. If your app uses a different package name, update it in [build_client.yml](./.github/workflows/build_client.yml):

```yaml
packageName: YOUR_ACTUAL_PACKAGE_NAME # e.g., com.mycompany.myapp
```

## Workflow Behavior

- ✅ **Triggered on**: Pushes to `main` branch only
- ✅ **Builds**: Creates Android App Bundle (AAB)
- ✅ **Uploads to**: Play Store internal testing track
- ✅ **In-App Update Priority**: Set to 3 (standard priority)
- ✅ **Status**: Marked as "Completed"

## Testing the Setup

### Manual Trigger

1. Go to **Actions** > **Build Client**
2. Click **Run workflow**
3. Select branch: `main`
4. Click **Run workflow**
5. Monitor the build progress

### View Uploads in Play Console

1. Go to [Google Play Console](https://play.google.com/console/)
2. Select your app
3. Go to **Testing** > **Internal testing**
4. Latest build should appear here after successful upload

## Troubleshooting

### Upload Fails: "Permission denied"

- **Cause**: Service account doesn't have sufficient permissions
- **Fix**: Check in Play Console that service account has "Release management" permission

### Upload Fails: "Invalid package name"

- **Cause**: Package name doesn't match your app in Play Store
- **Fix**: Update `packageName` in workflow to match your app's actual package name

### Build Fails: "AAB not found"

- **Cause**: Keystore credentials are incorrect
- **Fix**: Verify `ANDROID_KEYSTORE_PASSWORD` and `ANDROID_KEY_PASSWORD` secrets are set correctly

### Service Account JSON Not Recognized

- **Cause**: Secret value is incomplete or corrupted
- **Fix**: Delete and recreate the secret, ensuring the full JSON is pasted

## Security Notes

- 🔒 Never commit `PLAY_STORE_SERVICE_ACCOUNT_JSON` to version control
- 🔒 Store service account JSON securely; GitHub Actions keeps secrets encrypted
- 🔒 Consider restricting service account permissions to only Play Developer API
- 🔒 Regularly audit service account usage in Google Cloud logs

## References

- [Google Play Developer API Docs](https://developers.google.com/play/developer/api)
- [GitHub Actions - Using Secrets](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions)
- [r0adkll/upload-google-play Action](https://github.com/r0adkll/upload-google-play)
