# Flock — Android & Windows Apps

Both apps wrap **https://flock-two.vercel.app** so they automatically get every update you deploy. No separate app codebase to maintain.

---

## 📱 Android App (Capacitor)

### One-time setup
```bash
# Already installed — just add the platform:
npx cap add android
```

This creates an `android/` folder with a full Android Studio project.

### Build & install
```bash
# Open in Android Studio to build + sign:
npx cap open android
```
In Android Studio:
1. **Build → Generate Signed Bundle / APK → APK**
2. Create a keystore (first time) → fill in details → Next → Finish
3. Find APK at `android/app/release/app-release.apk`
4. Share that `.apk` file with friends — they sideload it (Settings → Install unknown apps)

### Share the APK
- Upload to Google Drive and share the link
- Or use a service like https://appetize.io for browser-based preview
- Google Play Store upload requires a developer account ($25 one-time)

---

## 🖥️ Windows App (Electron)

### One-time setup
```bash
cd electron
npm install
```

### Run locally (test before building)
```bash
cd electron
npx electron .
```

### Build the installer (.exe)
```bash
cd electron
npm run dist:win
```
Output: `electron/dist/Flock Setup 1.0.0.exe`

**Share this `.exe` with friends** — they double-click to install. Windows may show a SmartScreen warning (unsigned app) — click "More info → Run anyway".

### To code-sign (remove the warning):
- Buy a code signing cert (~$70/yr from Sectigo) OR
- Submit to Microsoft's Trusted App program (free, takes longer)

---

## 🔄 Updating
Since both apps load the live URL, **every `vercel --prod` deploy automatically updates all app users** with no app store submission needed.

