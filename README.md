<div align="center">

# 🎮 OpenQuester

### Open-Source Multiplayer Quiz Game

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/OpenQuester/OpenQuester)](https://github.com/OpenQuester/OpenQuester/releases/latest)
[![GitHub stars](https://img.shields.io/github/stars/OpenQuester/OpenQuester)](https://github.com/OpenQuester/OpenQuester/stargazers)
[![Discord](https://img.shields.io/badge/Discord-Coming%20Soon-7289da)](https://github.com/OpenQuester/OpenQuester/discussions)

**OpenQuester** is a free, open-source multiplayer quiz game inspired by [SIGame](https://github.com/VladimirKhil/SI). Play engaging quiz sessions with friends, create custom question packages, and enjoy a modern, cross-platform experience.

[🌐 Website](https://web.openquester.app) • [📚 Docs](https://docs.openquester.app) • [📥 Download](#-download) • [✨ Features](#-features) • [📸 Screenshots](#-screenshots) • [🛠️ Tech Stack](#️-tech-stack) • [🤝 Contributing](#-contributing)

</div>

---

## 🎯 Features

### 🎮 How It Works

You'll need at least 2 players (4+ is best) to start a game. Each round brings different question types to keep things interesting:

- **Regular Questions** - Hit the buzzer first to answer. Right answer? Earn the points. Wrong? Lose them.
- **Stake Questions** - Bet your own points before you see the question. Go safe or risk it all.
- **Secret Questions** - These can be passed to any player you choose. Use it wisely.
- **No Risk Questions** - No penalties here. Great for trying your best without the pressure.

### 🎪 Game Structure

- **Regular Rounds** - Players take turns picking themes and questions from the board. Quick reflexes and smart strategy win points.
- **Final Round** - The climax. First eliminate themes you don't want, then bid on how confident you are, and finally submit your answer against the clock.

### 👥 Multiple Ways to Participate

Join games in the role that suits you best:

- **Showman (Host)** - Control the game's pace, validate player answers, award or deduct points, and ensure fair play
- **Player** - Buzz in to answer, manage your points, make strategic bids, and compete for the top score
- **Spectator** - Enjoy the action and test your knowledge without affecting the game outcome

### 📦 Community Content

- **Package System** - Play community-created question packages on any topic
- **SIGame Compatibility** - Import `.siq` packages from SIGame _(Work in Progress)_
- **Create Your Own** - Build and share custom packages with the community

### 🎨 Modern Experience

- **Responsive UI** - Beautiful, intuitive interface built with Flutter
- **Real-time Sync** - Low-latency gameplay with Socket.IO
- **Media Support** - Rich content with images, audio, and video
- **Dark/Light Themes** - Customizable appearance
- **Multilingual** - Support for multiple languages

---

## 📸 Screenshots

> **Note:** Screenshots will be added here soon!

<div align="center">

### Main Menu

<!-- ![Main Menu](assets/screenshots/main-menu.png) -->

_Main menu screenshot coming soon_

### Game Lobby

<!-- ![Game Lobby](assets/screenshots/game-lobby.png) -->

_Game lobby screenshot coming soon_

### Active Gameplay

<!-- ![Active Gameplay](assets/screenshots/gameplay.png) -->

_Gameplay screenshot coming soon_

### Question Display

<!-- ![Question Display](assets/screenshots/question.png) -->

_Question display screenshot coming soon_

### Final Round

<!-- ![Final Round](assets/screenshots/final-round.png) -->

_Final round screenshot coming soon_

### Package Browser

<!-- ![Package Browser](assets/screenshots/packages.png) -->

_Package browser screenshot coming soon_

</div>

---

## 📥 Download

### Latest Release

Download the latest version for your platform from the [**Releases Page**](https://github.com/OpenQuester/OpenQuester/releases/latest).

#### Available Platforms

- **Web**: [Browser version](https://web.openquester.app)
- **Windows**: `.exe` installer
- **Linux**: `.AppImage`, `.flatpak`, or `.tar.gz`
- **macOS**: macOS support _(Work in Progress)_
- **Android**: `.apk` or Google Play Store _(Coming Soon)_
- **iOS**: iOS support _(Coming Soon)_

### Installation Instructions

#### Windows

1. Download the `.exe` installer from the [Releases Page](https://github.com/OpenQuester/OpenQuester/releases/latest)
2. Double-click the installer and follow the installation wizard
3. Launch OpenQuester from the Start Menu or Desktop shortcut
4. **(Optional)** For package encoding features, install [FFmpeg](https://ffmpeg.org/download.html) and add it to your system PATH

#### Linux

**Option 1: AppImage (Recommended)**
```bash
# Download the AppImage
wget https://github.com/OpenQuester/OpenQuester/releases/latest/download/OpenQuester-x86_64.AppImage

# Make it executable
chmod +x OpenQuester-x86_64.AppImage

# Run the application
./OpenQuester-x86_64.AppImage

# (Optional) Install FFmpeg for package encoding
sudo apt install ffmpeg  # Debian/Ubuntu
sudo dnf install ffmpeg  # Fedora
sudo pacman -S ffmpeg    # Arch Linux
```

**Option 2: Flatpak**
```bash
# Install from local flatpak bundle
flatpak install openquester.flatpak

# Run the application
flatpak run com.asion.openquester

# Note: FFmpeg is included in the Flatpak bundle
```

**Option 3: Extract tar.gz**
```bash
# Download and extract
wget https://github.com/OpenQuester/OpenQuester/releases/latest/download/openquester-linux-x64.tar.gz
tar -xzf openquester-linux-x64.tar.gz

# Run the application
cd bundle
./openquester

# (Optional) Install FFmpeg for package encoding
sudo apt install ffmpeg  # Debian/Ubuntu
sudo dnf install ffmpeg  # Fedora
sudo pacman -S ffmpeg    # Arch Linux
```

### Running OpenQuester

After installation, you can:

1. **Create a Game**: Click "Host Game" to create a new game room
2. **Join a Game**: Enter a game code to join an existing game
3. **Select Role**: Choose to be a Showman (host), Player, or Spectator
4. **Upload Packages**: Import custom `.oq` or `.siq` question packages (requires FFmpeg for media encoding)
5. **Start Playing**: Follow the on-screen instructions to play!

### Development Builds

For the latest features and updates, check our [GitHub Actions](https://github.com/OpenQuester/OpenQuester/actions) for development builds.

---

## 🛠️ Tech Stack

### Frontend

- **[Flutter](https://flutter.dev/)** - Cross-platform UI framework
- **[Dart](https://dart.dev/)** - Programming language optimized for UI
- **[Auto Route](https://pub.dev/packages/auto_route)** - Navigation and routing
- **[GetIt](https://pub.dev/packages/get_it)** - Dependency injection

### Backend

- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe JavaScript
- **[Node.js](https://nodejs.org/)** - JavaScript runtime
- **[Express](https://expressjs.com/)** - Web application framework
- **[Socket.IO](https://socket.io/)** - Real-time bidirectional communication
- **[TypeORM](https://typeorm.io/)** - Object-relational mapping
- **[PostgreSQL](https://www.postgresql.org/)** - Relational database
- **[Redis](https://redis.io/)** - In-memory data structure store
- **[MinIO](https://min.io/)** - S3-compatible object storage

### DevOps & Tools

- **[Docker](https://www.docker.com/)** - Containerization
- **[GitHub Actions](https://github.com/features/actions)** - CI/CD pipelines
- **[MinIO](https://min.io/)** - Object storage (S3)
- **[Jest](https://jestjs.io/)** - Backend testing framework
- **[ESLint](https://eslint.org/)** - Code linting

---

## 🚀 Getting Started

### For Players

See the [Installation Instructions](#installation-instructions) above for detailed steps on how to download, install, and run OpenQuester on your platform.

Quick steps:
1. **Download** the application from the [Releases Page](https://github.com/OpenQuester/OpenQuester/releases/latest)
2. **Install** following the platform-specific instructions
3. **Launch** OpenQuester
4. **Join or Create** a game room
5. **Play** and enjoy!

### For Developers

#### Prerequisites

- **Node.js** 18+ and npm/yarn
- **Flutter** 3.24+
- **Docker** and Docker Compose (for backend development)
- **PostgreSQL** 14+ (or use Docker)
- **Redis** 7+ (or use Docker)
- **FFmpeg** (for package encoding support)
  - Windows: Download from [ffmpeg.org](https://ffmpeg.org/download.html) and add to PATH
  - Linux: `sudo apt install ffmpeg` (Debian/Ubuntu), `sudo dnf install ffmpeg` (Fedora)
  - macOS: `brew install ffmpeg`

#### Quick Setup

```bash
# Clone the repository
git clone https://github.com/OpenQuester/OpenQuester.git
cd OpenQuester

# Backend setup
cd server
npm install
cp docs/env_examples/.env.example .env
# Edit .env with your configuration
docker compose up -d  # Start PostgreSQL, Redis, MinIO
npm run dev

# Frontend setup (in a new terminal)
cd client
flutter pub get
flutter run
```

For detailed setup instructions, see:

- [Frontend Setup Guide](client/README.md)

---

## 📚 Documentation

- **[Online Documentation](https://docs.openquester.app)** - Complete documentation site
- **[API Documentation](server/docs/)** - Backend API reference
- **[Game Flow](server/docs/game-action-executor.md)** - Understanding the game mechanics
- **[Final Round](server/docs/final-round-flow.md)** - Final round implementation details
- **[Media Sync](server/docs/media-download-sync.md)** - Media synchronization system
- **[Package Format](docs/package-format.md)** - Creating custom packages _(Coming Soon)_

---

## 🤝 Contributing

We welcome contributions from developers, designers, translators, and quiz enthusiasts!

### How to Contribute

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'feat: add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Contribution Guidelines

- Follow the existing code style and conventions
- Write meaningful commit messages (use [Conventional Commits](https://www.conventionalcommits.org/))
- Add tests for new backend features
- Update documentation as needed
- Ensure all tests pass before submitting PR

### Areas We Need Help

- 🐛 Bug fixes and testing
- ✨ New features and enhancements
- 🎨 UI/UX improvements
- 🌍 Translations and localization
- 📝 Documentation improvements
- 📦 Question package creation
- 🎮 Game balance and mechanics

---

## 💬 Community & Support

- **[GitHub Discussions](https://github.com/OpenQuester/OpenQuester/discussions)** - Ask questions, share ideas
- **[GitHub Issues](https://github.com/OpenQuester/OpenQuester/issues)** - Report bugs, request features
- **Discord DM** - `sukui_` or `asion.desu`
- **Discord Server** - Chat with the community and developers _(Coming Soon)_

---

## 🔒 Privacy & Security

We take your privacy seriously. OpenQuester collects minimal data necessary for gameplay.

- **[Privacy Policy](PRIVACY_POLICY.md)** - Full privacy policy
- **[Security Policy](SECURITY.md)** - Report security vulnerabilities _(Coming Soon)_

---

## 📊 Project Status

**Status:** 🚧 Active Development (Beta)

| Component          | Status         | Notes                             |
| ------------------ | -------------- | --------------------------------- |
| Core Gameplay      | ✅ Complete    | Fully functional multiplayer quiz |
| Frontend (Desktop) | ✅ Complete    | Windows, Linux                    |
| Frontend (Mobile)  | 🚧 In Progress | Android beta, iOS planned         |
| Frontend (Web)     | ✅ Complete    | Browser-based gameplay            |
| Backend API        | ✅ Complete    | RESTful + WebSocket               |
| Package System     | ✅ Complete    | Native `.oq` format               |
| SIGame Import      | 🚧 In Progress | `.siq` compatibility              |
| Matchmaking        | 📅 Planned     | Public game discovery             |
| Achievements       | 📅 Planned     | Player progression system         |

---

## 📜 License

OpenQuester is open-source software licensed under the [MIT License](LICENSE).

This means you can freely use, modify, and distribute this software, even for commercial purposes, as long as you include the original copyright and license notice.

---

## 🙏 Acknowledgments

- **[SIGame](https://github.com/VladimirKhil/SI)** - Inspiration for gameplay mechanics
- **Flutter Team** - Amazing cross-platform framework
- **Open Source Community** - For all the incredible tools and libraries
- **Contributors** - Everyone who has helped build OpenQuester

---

<div align="center">

**Made with ❤️ by the OpenQuester Team**

⭐ **Star this repository** if you find it useful!

[Report Bug](https://github.com/OpenQuester/OpenQuester/issues) • [Request Feature](https://github.com/OpenQuester/OpenQuester/issues) • [Join Discussion](https://github.com/OpenQuester/OpenQuester/discussions)

</div>
