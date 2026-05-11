<div align="center">
  <img src="logo-circle.svg" alt="DuplexMe! Logo" width="128" height="128" />
  <h1>DuplexMe!</h1>
  <p>A minimalist, browser-based PDF utility for perfect manual duplex printing.</p>
</div>

## Overview
Manual duplex printing can be a nightmare of upside-down pages, backward books, and wasted paper. **DuplexMe!** runs entirely in your browser, splitting your PDFs into a perfectly collated **Side 1** and **Side 2** based on your specific printer hardware.

## Features
- **Hardware Calibration:** Automatically adjusts page orders and rotations for Face-Up, Face-Down, and different binding orientations.
- **Privacy First:** 100% Client-side processing using `pdf-lib`. Your documents are never uploaded to any server.
- **Zero Configuration:** Simple drag-and-drop interface with a beautiful, responsive Dark/Light mode UI.
- **PWA Ready:** Lightweight and lightning fast.

## Usage
1. Open the app and drop your PDF file.
2. Complete the one-time Printer Calibration (auto-saves to local storage).
3. Print **Side 1**.
4. Take the stack, put it back in the tray, and print **Side 2**.
5. Staple and enjoy your perfect book!

## Development
```bash
npm install
npm run dev
```

## License
ISC
