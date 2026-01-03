# OpenQuester Websites

This directory contains the Hugo-based websites for OpenQuester:

- **`docs/`** - Documentation site hosted at `docs.openquester.app`
- **`landing/`** - Landing page hosted at `web.openquester.app`

## Architecture

Both sites are built with Hugo static site generator and deployed to Cloudflare Pages via GitHub Actions.

### Documentation Site (`docs/`)

- **Theme**: [hugo-book](https://github.com/alex-shpak/hugo-book) - Perfect for technical documentation
- **URL**: https://docs.openquester.app
- **Features**:
  - Full-text search
  - Table of contents navigation
  - Dark/light mode auto-switching
  - Mobile-responsive design
  - Organized into sections: Privacy, Game Mechanics, Technical

#### Content Structure

```
websites/docs/content/
├── _index.md                    # Documentation home page
└── docs/
    ├── privacy.md               # Privacy Policy (copied from root PRIVACY_POLICY.md)
    ├── game-mechanics/
    │   ├── _index.md
    │   └── final-round-flow.md
    └── technical/
        ├── _index.md
        ├── game-action-executor.md
        └── media-download-sync.md
```

#### Adding New Documentation

1. Create a new markdown file in the appropriate subdirectory
2. Add front matter with `title` and `weight`:
   ```markdown
   ---
   title: Your Page Title
   weight: 10
   ---
   ```
3. Write your content in markdown
4. Commit and push - GitHub Actions will auto-deploy

### Landing Page (`landing/`)

- **URL**: https://web.openquester.app
- **Type**: Static HTML with inline CSS
- **Features**:
  - Hero section with CTAs
  - Features showcase
  - Platform availability
  - Mobile-responsive design
  - Dark mode support via CSS media queries
  - No JavaScript - pure HTML/CSS

#### Structure

```
websites/landing/
├── static/
│   ├── index.html        # Main landing page
│   ├── _headers          # Security headers for Cloudflare
│   └── _redirects        # Redirect rules
└── hugo.toml             # Hugo configuration
```

## Development

### Prerequisites

- Hugo Extended v0.146.0 or later
- Git

### Local Development

#### Documentation Site

```bash
cd websites/docs

# Copy privacy policy from root
cp ../../PRIVACY_POLICY.md content/docs/privacy.md

# Start Hugo server
hugo server -D

# Visit http://localhost:1313
```

#### Landing Page

```bash
cd websites/landing

# Simple HTTP server
python3 -m http.server 8000 --directory static

# Or use any other static server
# Visit http://localhost:8000
```

### Building

#### Documentation Site

```bash
cd websites/docs
cp ../../PRIVACY_POLICY.md content/docs/privacy.md
hugo --minify
# Output in public/
```

#### Landing Page

Landing page doesn't require building - `static/` directory is deployed as-is.

## Deployment

Both sites deploy automatically via GitHub Actions to Cloudflare Pages:

- **Trigger**: Push to `main` branch when files in respective directories change
- **Workflows**:
  - `.github/workflows/deploy-docs.yml` - Documentation site
  - `.github/workflows/deploy-landing.yml` - Landing page

**Note**: Hugo themes are downloaded during workflow execution and are not committed to the repository.

### Cloudflare Pages Projects

1. **openquester-docs** → `docs.openquester.app`
   - Deploys on changes to: `PRIVACY_POLICY.md`, `websites/docs/`, `server/docs/`
   - Workflow: `.github/workflows/deploy-docs.yml`

2. **openquester-landing** → `web.openquester.app`
   - Deploys on changes to: `websites/landing/`
   - Workflow: `.github/workflows/deploy-landing.yml`

Two projects need to be created in Cloudflare Pages dashboard:

1. **openquester-docs** - for documentation site
   - Custom domain: `docs.openquester.app`
   
2. **openquester-landing** - for landing page
   - Custom domain: `web.openquester.app`

### Required GitHub Secrets

Add these secrets to the repository:

- `CLOUDFLARE_API_TOKEN` - API token with Pages:Edit permission
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID

### Custom Domains

After deployment, configure custom domains in Cloudflare Pages:

1. Go to Cloudflare Pages → Select project → Custom domains
2. Add custom domain (e.g., `docs.openquester.app` or `web.openquester.app`)
3. Follow DNS configuration instructions
4. Wait for SSL certificate provisioning

## Security

Both sites implement security headers via `_headers` files:

- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- `Content-Security-Policy` - Restricts resource loading
- `Referrer-Policy` - Controls referrer information
- `Permissions-Policy` - Restricts browser features

## Privacy Policy Sync

The privacy policy at `/PRIVACY_POLICY.md` (root) is the source of truth:

- **Docs site**: Copied during build via GitHub Actions workflow
- **Never edit** `websites/docs/content/docs/privacy.md` directly
- **Always edit** `/PRIVACY_POLICY.md` at the project root

## Maintenance

### Updating Documentation

1. Edit markdown files in `websites/docs/content/docs/`
2. Commit and push to `main`
3. GitHub Actions automatically deploys

### Updating Landing Page

1. Edit `websites/landing/static/index.html`
2. Commit and push to `main`
3. GitHub Actions automatically deploys

### Updating Privacy Policy

1. Edit `/PRIVACY_POLICY.md` at project root
2. Commit and push to `main`
3. Both GitHub Actions workflows will trigger (docs includes privacy, landing links to it)

### Adding Server Documentation

Server docs in `/server/docs/` should be manually copied to documentation site:

```bash
cp server/docs/new-doc.md websites/docs/content/docs/technical/
# Add front matter to the file
# Commit and push
```

## Troubleshooting

### Hugo build fails

- Check Hugo version: `hugo version` (should be >= 0.146.0 extended)
- Verify theme is present: `websites/docs/themes/hugo-book/`
- Check for markdown syntax errors in content files

### Privacy policy not updating

- Verify `/PRIVACY_POLICY.md` has front matter with `title` and `weight`
- Check that workflow copies file: `.github/workflows/deploy-docs.yml`
- Look at GitHub Actions logs for errors

### Custom domain not working

- Verify DNS records in Cloudflare dashboard
- Check SSL/TLS settings (should be "Full" or "Full (strict)")
- Wait up to 24 hours for DNS propagation

### Dark mode not working

- Both sites use `prefers-color-scheme` CSS media query
- Check browser/OS dark mode settings
- No JavaScript needed - it's automatic

## Theme Customization

### Documentation Site Theme

The hugo-book theme can be customized via:

- `websites/docs/hugo.toml` - Configuration options
- `websites/docs/layouts/` - Override theme templates (not used currently)
- `websites/docs/static/` - Additional assets

### Landing Page Styling

Edit inline CSS in `websites/landing/static/index.html`:

- CSS variables in `:root` - Colors and theming
- Dark mode styles in `@media (prefers-color-scheme: dark)`
- All styles are inline for zero dependencies

## Performance

Both sites are optimized for performance:

- **Documentation**: Hugo generates static HTML, minified output
- **Landing**: No JavaScript, no external dependencies, inline CSS
- **CDN**: Cloudflare Pages provides global CDN automatically
- **Size**: Documentation site ~2MB, landing page ~12KB

## License

Both websites are part of OpenQuester project under MIT license.
