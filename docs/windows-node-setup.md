# Windows setup for AISpace prerequisites

This guide explains how to install Node.js 20, npm 9 or newer, Firebase CLI, and Git on Windows. It focuses on two scenarios: installing Node.js via the official installer and using **nvm-windows** to manage multiple Node versions.

## Install Node.js 20 (official installer)

1. Download the **LTS** Windows installer for Node.js 20 from [nodejs.org](https://nodejs.org/).
2. Run the installer and follow the prompts. Keep the default options that add Node.js to your `PATH`.
3. Close and reopen any terminals to pick up the new `PATH`.
4. Verify the installation:

   ```powershell
   node -v
   npm -v
   ```

   You should see Node `v20.x.x` and npm `9.x` or later.

## Install nvm-windows (optional, for version management)

`nvm` commands are not available by default on Windows. Install the community-maintained **nvm-windows** project if you need to switch Node versions frequently.

1. Download the latest `nvm-setup.exe` release from the [nvm-windows GitHub repository](https://github.com/coreybutler/nvm-windows/releases).
2. Run the installer as an administrator. Accept the default installation directories or customise them as needed.
3. Close and reopen PowerShell or Command Prompt to ensure the `nvm` command is available.
4. Install and activate Node.js 20:

   ```powershell
   nvm install 20
   nvm use 20
   ```

5. Confirm the active version:

   ```powershell
   node -v
   npm -v
   ```

If the `nvm` command is still unrecognised, ensure the installation directory (usually `C:\Program Files\nvm`) and the Node symlink directory are added to the `PATH`. Restarting your terminal or signing out/in typically resolves the issue.

## Install Firebase CLI

After Node.js is available, install the Firebase CLI globally via npm:

```powershell
npm install -g firebase-tools
```

Use `firebase login` to authenticate the CLI with your Google account. If corporate proxies block the installation, configure npm with your proxy settings or install the CLI from an environment with open access.

## Install Git

Download the latest Git for Windows installer from [git-scm.com](https://git-scm.com/download/win), run it, and accept the defaults. Restart your terminal and verify the installation:

```powershell
git --version
```

With these prerequisites installed, you can clone the AISpace repository and follow the project setup instructions in the main [README](../README.md).
