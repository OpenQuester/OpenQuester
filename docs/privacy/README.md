# Cloudflare Pages Configuration

## Privacy Policy Hosting

This directory contains the static site for OpenQuester's privacy policy, hosted on Cloudflare Pages.

### Project Structure

```
docs/privacy/
├── index.html         # Main HTML page with embedded markdown renderer
├── _headers           # Security headers configuration
├── _redirects         # URL redirects configuration
└── PRIVACY_POLICY.md  # Privacy policy content (copied from root)
```

### Setup Instructions

1. **Create Cloudflare Pages Project**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → Pages
   - Create a new project named `openquester-privacy`
   - Choose "Direct Upload" method (GitHub Actions will handle deployment)

2. **Configure GitHub Secrets**
   Add the following secrets to your GitHub repository:
   - `CLOUDFLARE_API_TOKEN`: Your Cloudflare API token with Pages permissions
   - `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID

   To get these values:
   - **API Token**: Cloudflare Dashboard → My Profile → API Tokens → Create Token
     - Use template: "Edit Cloudflare Workers"
     - Or create custom token with permissions: `Account.Cloudflare Pages:Edit`
   - **Account ID**: Cloudflare Dashboard → Pages → Account ID (in the URL or sidebar)

3. **Deploy**
   - The workflow automatically deploys on:
     - Push to `main` branch affecting privacy policy files
     - Manual workflow dispatch
   - Access at: `https://openquester-privacy.pages.dev`

4. **Custom Domain (Optional)**
   - In Cloudflare Pages project settings, add custom domain
   - Example: `privacy.openquester.com`
   - Configure DNS records as instructed by Cloudflare

### Security Features

- **Content Security Policy**: Restricts resource loading
- **X-Frame-Options**: Prevents clickjacking
- **X-Content-Type-Options**: Prevents MIME-type sniffing
- **Referrer Policy**: Controls referrer information
- **X-XSS-Protection**: Enables XSS filtering

### Local Development

To test locally:

```bash
# Simple HTTP server
cd docs/privacy
python3 -m http.server 8000
# Visit http://localhost:8000
```

Or use any static file server.

### Maintenance

- Update privacy policy: Edit `/PRIVACY_POLICY.md` in the repository root
- Changes automatically deploy via GitHub Actions
- HTML template updates: Edit `docs/privacy/index.html`

### Troubleshooting

**Issue**: Deployment fails with authentication error
- **Solution**: Verify `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets are correctly set

**Issue**: Privacy policy content not loading
- **Solution**: Check that PRIVACY_POLICY.md is being copied correctly in the workflow

**Issue**: Custom domain not working
- **Solution**: Verify DNS records and SSL/TLS settings in Cloudflare dashboard
