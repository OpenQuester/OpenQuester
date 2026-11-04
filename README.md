<div align="center">

# 🎮 OpenQuester

### Open-Source Multiplayer Quiz Game

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/OpenQuester/OpenQuester)](https://github.com/OpenQuester/OpenQuester/releases/latest)
[![GitHub stars](https://img.shields.io/github/stars/OpenQuester/OpenQuester)](https://github.com/OpenQuester/OpenQuester/stargazers)
[![Discord](https://img.shields.io/badge/Discord-Coming%20Soon-7289da)](https://github.com/OpenQuester/OpenQuester/discussions)

**OpenQuester** is a free, open-source multiplayer quiz game inspired by [SIGame](https://github.com/VladimirKhil/SI). Play engaging quiz sessions with friends, create custom question packages, and enjoy a modern, cross-platform experience.

[🌐 Website](https://web.openquester.app) • [📚 Docs](https://docs.openquester.app) • [✨ Features](#-features) • [📸 Screenshots](#-screenshots) • [🛠️ Tech Stack](#️-tech-stack) • [🤝 Contributing](#-contributing)

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

- **Responsive UI** - Browser interface for phones, tablets, and desktops
- **Real-time Sync** - Low-latency gameplay with Socket.IO
- **Media Support** - Rich content with images, audio, and video
- **Dark/Light Themes** - Customizable appearance
- **Multilingual** - Support for multiple languages

---

## 📸 Screenshots

> **Note:** Screenshots will be added here soon!

<div align="center">

### Main Menu

_Main menu screenshot coming soon_

### Game Lobby

_Game lobby screenshot coming soon_

### Active Gameplay

_Gameplay screenshot coming soon_

### Question Display

_Question display screenshot coming soon_

### Final Round

_Final round screenshot coming soon_

### Package Browser

_Package browser screenshot coming soon_

</div>

---

## 🛠️ Tech Stack

### Frontend

- React, TypeScript, and Vite

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

[Play OpenQuester in your browser](https://openquester-web.pages.dev/). Join or create a game room.

### For Developers

#### Prerequisites

- Node.js and npm. For the backend use `server/.node-version`. For the browser app use Node 22.22.2 or later in the Node 22 line.
- Docker with Docker Compose for the local backend services.

#### Quick setup

See [backend environment examples](server/docs/env_examples/env.example.md) to create `server/.env`. Then run:

```bash
cd server
npm ci
docker compose up -d
npm run start:dev
```

In a separate terminal at the repository root:

```bash
cd web
npm ci
npm run dev
```

See [web development guidance](web/AGENTS.md) for frontend checks and local proxy configuration.

---

## 📚 Documentation

- **[Online Documentation](https://docs.openquester.app)** - Complete documentation site
- **[API Documentation](server/docs/)** - Backend API reference
- **[Game Flow](server/docs/game-action-executor.md)** - Understanding the game mechanics
- **[Final Round](server/docs/final-round-flow.md)** - Final round implementation details
- **[Media Sync](server/docs/media-download-sync.md)** - Media synchronization system

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

---

## 📊 Project Status

**Status:** 🚧 Active Development (Beta)

| Component      | Status         | Notes                             |
| -------------- | -------------- | --------------------------------- |
| Core Gameplay  | ✅ Complete    | Fully functional multiplayer quiz |
| Frontend (Web) | ✅ Complete    | Browser-based gameplay            |
| Backend API    | ✅ Complete    | RESTful + WebSocket               |
| Package System | ✅ Complete    | Native `.oq` format               |
| SIGame Import  | 🚧 In Progress | `.siq` compatibility              |
| Matchmaking    | 📅 Planned     | Public game discovery             |
| Achievements   | 📅 Planned     | Player progression system         |

---

## 📜 License

OpenQuester is open-source software licensed under the [MIT License](LICENSE).

This means you can freely use, modify, and distribute this software, even for commercial purposes, as long as you include the original copyright and license notice.

---

## 🙏 Acknowledgments

- **[SIGame](https://github.com/VladimirKhil/SI)** - Inspiration for gameplay mechanics
- **Open Source Community** - For all the incredible tools and libraries
- **Contributors** - Everyone who has helped build OpenQuester

---

<div align="center">

**Made with ❤️ by the OpenQuester Team**

⭐ **Star this repository** if you find it useful!

[Report Bug](https://github.com/OpenQuester/OpenQuester/issues) • [Request Feature](https://github.com/OpenQuester/OpenQuester/issues) • [Join Discussion](https://github.com/OpenQuester/OpenQuester/discussions)

</div>
