# VSCode Workspace Configuration

This directory contains VSCode workspace configuration files that help streamline development for the OpenQuester project.

## Files

### `extensions.json`

Lists recommended extensions for this project. When you open the workspace, VSCode will prompt you to install any missing recommended extensions.

**Key Extensions:**

- **Backend**: ESLint, TypeScript support
- **Database**: PostgreSQL, Redis clients
- **API**: REST Client, OpenAPI support
- **Productivity**: GitLens, Error Lens, Todo Highlight

### `tasks.json`

Predefined tasks for common development operations. Access via:

- Command Palette: `Tasks: Run Task`
- Keyboard: `Ctrl+Shift+B` (build tasks)

**Available Tasks:**

#### Web Tasks

- `Web: Install Dependencies` runs `npm ci`.
- `Web: Dev` runs `npm run dev`.
- `Web: Build` runs `npm run build`.
- `Web: Typecheck` runs `npm run typecheck`.
- `Web: Lint` runs `npm run lint`.
- `Web: Test` runs `npm test`.
- `Web: Generate API` runs `npm run gen:api`.
- `Web: Check API` runs `npm run check:api`.

#### Server Tasks

- `Server: Install Dependencies` - Install npm packages
- `Server: Start Dev` - Start development server (default build task)
- `Server: Build` - Build for production
- `Server: Lint` - Run ESLint
- `Server: Test` - Run Jest tests
- `Server: Validate OpenAPI Schema` - Check OpenAPI spec
- `Server: Clean` - Remove dist folder

#### Docker Tasks

- `Docker: Compose Up` - Start Docker services
- `Docker: Compose Down` - Stop Docker services
- `Docker: Compose Restart` - Restart Docker services

#### Combined Tasks

- `Setup: All Dependencies` - Install all project dependencies
- `Test: All` - Run all tests (web and server)
- `Lint: All` - Run all linters

### `settings.json`

Workspace-specific VSCode settings that override user settings.

**Key Configurations:**

- Auto-formatting on save for TypeScript, JSON
- ESLint integration and auto-fix
- File exclusions for better performance
- Custom file associations (`.oq` files)
- Spell checker with project-specific words

### `launch.json`

Debug configurations for running and debugging the application.

## Getting Started

1. **Install Recommended Extensions**

   - Open the Extensions view (`Ctrl+Shift+X`)
   - Look for the "Recommended" section
   - Click "Install All" or install individually

2. **Run Initial Setup**

   - Press `Ctrl+Shift+P`
   - Type "Tasks: Run Task"
   - Select `Setup: All Dependencies`

3. **Start Development**
   - For the browser app: Run `Web: Dev`
   - For Server: Press `Ctrl+Shift+B` (runs `Server: Start Dev` by default)
   - For Docker services: Run `Docker: Compose Up`

## Customization

These settings are designed to work for most contributors. If you need different settings:

1. **Personal settings**: Edit your User Settings (not workspace settings)
2. **Team settings**: Discuss changes and update these files via PR

## Notes

- Some extensions provide additional features when installed (Error Lens, Todo Highlight, etc.)
- Tasks can be chained together using `dependsOn` for complex workflows
