# 🔫 Mac Port Kill ⚡

A sleek, macOS-style desktop app to instantly find and terminate processes running on specific ports. Built for speed, focused on developer productivity.

![Port Kill App Icon](./assets/icon.png)

## 🚀 Features

- **⚡ Spotlight Mode**: Toggle a mini-bar from anywhere with `Shift + Cmd + P`.
- **🔍 Live Preview**: Instantly see which process is using a port as you type.
- **🔪 Search & Destroy**: Type the port and press `Enter`. The process is killed, and the app auto-hides.
- **🛡️ Sudo Support**: Native macOS password/TouchID prompt for system-protected ports.
- **🌗 Theme Aware**: Intelligent glassmorphism that matches Light and Dark macOS modes.
- **🔥 Kill on Exit**: Optional mode to auto-cleanup all listener ports when you quit the app.
- **📊 Dashboard**: Full dashboard to view all active ports, PIDs, and protocols at a glance.

## 🛠️ Tech Stack

- **Framework**: Electron
- **Core**: Node.js & Vanilla JavaScript
- **Styling**: Premium CSS Glassmorphism
- **Shell**: Native `lsof` and `kill` integration

## 📦 Installation (Self-Build)

1. Clone the repo:
   ```bash
   git clone https://github.com/skfaiz1930/Mac-port-kill.git
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run in development:
   ```bash
   npm start
   ```
4. Build the macOS `.app`:
   ```bash
   npm run build
   ```

## ⌨️ Shortcuts

| Action | Shortcut |
|--------|----------|
| **Toggle Mini Bar** | `Shift + Cmd + P` |
| **Kill Port** | `Enter` (inside Mini Bar) |
| **Close / Hide** | `Escape` |

## 🌓 Themes

Port Kill supports macOS native themes. It uses `vibrancy` and `backdrop-filter` to ensure it fits perfectly into your desktop environment, whether you prefer Light or Dark mode.

---

Built with ⚡ by [skfaiz1930](https://github.com/skfaiz1930)
