# Jumping Dev - Jumping Jack Simulator 🎮

A fun and challenging HTML5 browser game where you perform jumping jacks using keyboard controls. Built with Phaser 3 and designed for static hosting.

## 🚀 Quick Start

### Running the Game Locally

1. **Using VSCode Live Server (Recommended)**
   - Install the "Live Server" extension in VSCode
   - Right-click on `index.html`
   - Select "Open with Live Server"
   - Game will open in your browser at `http://localhost:5500`

2. **Using Python HTTP Server**
   ```bash
   python -m http.server 8000
   ```
   Then visit `http://localhost:8000`

3. **Direct File Open**
   - Simply double-click `index.html`
   - Should work in most modern browsers

## 🎯 How to Play

### Objective
Perform 10 jumping jacks as accurately as possible. Each jump is scored out of 100 points based on:
- **Arm Form** (40 pts)
- **Leg Landing** (30 pts)
- **Jump Height** (15 pts)
- **Timing & Coordination** (15 pts)

**Goal:** Achieve 1000 points total!

### Controls
- **W** - Jump (hold to jump higher, max ~2 feet)
- **Q** - Swing left arm up (release to let it fall)
- **E** - Swing right arm up (release to let it fall)
- **Z** - Spread left leg (only works while in the air)
- **X** - Spread right leg (only works while in the air)
- **H** - Toggle help modal
- **ESC** - Close modals
- **SPACE** - Restart game (after completion)

### Tips for Success
- Coordinate all 5 keys - it's intentionally challenging!
- Raise arms high (>85° for full points)
- Land your feet on the target markers
- Spread legs while in the air
- Arms fall with gravity - time your releases!

## 📁 Project Structure

```
jumping-dev/
├── index.html      # Main HTML file with UI layout
├── styles.css      # All styling for UI panels and modals
├── game.js         # Complete Phaser 3 game logic
└── README.md       # This file
```

## 🎨 Customization

### Adding Your Photo to the Character

The character currently has a simple placeholder face. To add your photo:

1. Take or find a front-facing photo of yourself
2. Crop it to be roughly square
3. Save it as `face.png` in the project folder
4. Add this code to the `createCharacter()` function in `game.js`:

```javascript
// Replace the placeholder face with your photo
character.faceImage = scene.add.image(
    0,
    -torsoHeight - headSize,
    'face'
);
character.faceImage.setDisplaySize(headSize * 2, headSize * 2);
```

5. Load the image in the `preload()` function:

```javascript
function preload() {
    this.load.image('face', 'face.png');
}
```

### Adjusting Difficulty

In `game.js`, you can modify these constants to change difficulty:

```javascript
// Make arms move faster (harder to control)
const ARM_ROTATION_SPEED = 0.15; // Increase for faster

// Make arms fall slower (easier)
const ARM_FALL_SPEED = 0.08; // Decrease for slower

// Change jump height
const JUMP_MAX_HEIGHT = 200; // Increase for higher jumps

// Adjust target marker tolerance
targetMarkers.tolerance = markerWidth * 0.05; // Increase % for easier
```

### Color Scheme

Change the color theme in `styles.css`:

```css
/* Main accent color (currently green) */
--accent-color: #00ff88;

/* Change to blue */
--accent-color: #00b4ff;

/* Change to purple */
--accent-color: #b400ff;
```

## 🌐 Deployment

### GitHub Pages

1. Create a new repository on GitHub
2. Push your code:
   ```bash
   git init
   git add .
   git commit -m "Initial commit - Jumping Dev game"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/jumping-dev.git
   git push -u origin main
   ```
3. Go to repository Settings → Pages
4. Select "main" branch as source
5. Your game will be live at `https://YOUR_USERNAME.github.io/jumping-dev/`

### Cloud Storage (AWS S3, Google Cloud Storage, Azure Blob)

1. **AWS S3:**
   - Create a bucket with public read access
   - Enable static website hosting
   - Upload all files
   - Access via the S3 website endpoint

2. **Google Cloud Storage:**
   - Create a bucket
   - Upload files
   - Make bucket public
   - Enable static website hosting

3. **Azure Blob Storage:**
   - Create a storage account
   - Enable static website hosting
   - Upload files to `$web` container

## 🛠️ Technical Details

### Technologies Used
- **Phaser 3.70.0** - Game framework (loaded via CDN)
- **Pure HTML5/CSS3/JavaScript** - No build process required
- **Arcade Physics** - For gravity and movement
- **Canvas API** - Via Phaser for rendering

### Browser Compatibility
- Chrome/Edge: ✅ Fully supported
- Firefox: ✅ Fully supported
- Safari: ✅ Fully supported
- Mobile browsers: ⚠️ Requires touch controls (not yet implemented)

### Performance
- 60 FPS target
- Lightweight (~50KB total size excluding Phaser CDN)
- No external assets needed
- Instant loading

## 🎮 Game Features

### Implemented
- ✅ Full jumping jack physics simulation
- ✅ 5-key control scheme (W, Q, E, Z, X)
- ✅ Detailed scoring algorithm
- ✅ Real-time score breakdown display
- ✅ 10-jump game loop with final stats
- ✅ Animated background (clouds, sun, swaying bushes)
- ✅ Target markers for foot placement
- ✅ Star rating system
- ✅ Help modal with complete rules
- ✅ Game over screen with statistics
- ✅ Responsive UI panels

### Future Enhancement Ideas
- [ ] Sound effects (jump, landing, scoring)
- [ ] Background music
- [ ] Difficulty levels (Easy/Medium/Hard)
- [ ] Leaderboard (local storage)
- [ ] Achievement system
- [ ] Touch controls for mobile
- [ ] Replay system
- [ ] Custom character creator
- [ ] Multiplayer mode

## 📝 Scoring System

### Breakdown

**Arms (40 points):**
- 20 pts per arm for >85° vertical
- +5 pts for symmetry (both arms within 15° of each other)
- +5 pts if arms peaked before landing

**Legs (30 points):**
- 15 pts per foot for landing on target markers
- +5 pts for symmetrical leg spread

**Height (15 points):**
- 15 pts for reaching 80%+ of max height
- Scaled scoring for lower jumps

**Timing (15 points):**
- 5 pts for moving all 4 limbs
- 5 pts for arms peaking while airborne
- 5 pts for legs spreading at jump apex

### Star Ratings
- ⭐⭐⭐⭐ (90-100 pts) - PERFECT!
- ⭐⭐⭐ (70-89 pts) - Great!
- ⭐⭐ (50-69 pts) - Good
- ⭐ (25-49 pts) - Okay
- (0-24 pts) - Keep trying!

## 🐛 Troubleshooting

### Game won't load
- Check browser console for errors (F12)
- Ensure you're running via a web server (not file://)
- Verify Phaser CDN is accessible

### Controls not responding
- Click on the game canvas first
- Check if help modal is open (press ESC to close)
- Ensure keyboard focus is on the browser window

### Score seems wrong
- Remember: legs only spread while in the air
- Arms need to reach >85° for full points
- Check the breakdown display for details

## 📄 License

This project is open source and free to use for personal and educational purposes.

## 🤝 Contributing

Feel free to fork and modify! Some ideas:
- Add new character outfits
- Create different backgrounds
- Implement new scoring modes
- Add accessibility features

---

**Enjoy your jumping jacks! 🎉**

Created with ❤️ using Claude Code
