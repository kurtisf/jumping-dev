// ============================================================================
// JUMPING DEV - Main Game File
// A jumping jack simulator game built with Phaser 3
// ============================================================================

// Game configuration
const config = {
    type: Phaser.AUTO,
    width: 1000,
    height: 800,
    parent: 'game-area',
    backgroundColor: '#87CEEB',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 2000 },
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

// Game state variables
let game;
let character = {};
let keys = {};
let previousKeyStates = {}; // Track previous frame key states for press detection
let gameState = 'idle'; // idle, jumping, landing, waiting_for_reset
let messageText = null;
let ouchText = null; // Separate text for OUCH message
let jumpData = {
    isJumping: false,
    jumpStartTime: 0,
    wKeyPressTime: 0, // Track when W was first pressed
    jumpChargeTime: 0, // How long W was held
    maxHeight: 0,
    currentHeight: 0,
    leftArmMaxAngle: 0,
    rightArmMaxAngle: 0,
    leftLegMaxSpread: 0,
    rightLegMaxSpread: 0,
    leftArmPeakedInAir: false,
    rightArmPeakedInAir: false,
    legsSpreading: false,
    limbsMoved: { leftArm: false, rightArm: false, leftLeg: false, rightLeg: false },
    didSplits: false
};

// Game scoring
let totalScore = 0;
let currentJumpNumber = 0;
let jumpScores = [];
let lastJumpBreakdown = null;

// Difficulty settings
let isHardMode = false;
let difficultyMultiplier = 1.0;

// Character physics constants (base values)
const BASE_JUMP_VELOCITY = -800;
const JUMP_MAX_HEIGHT = 200;
const BASE_ARM_ROTATION_SPEED = 0.5; // Faster arm movement
const BASE_ARM_FALL_SPEED = 0.3; // Ragdoll-like falling
const ARM_GRAVITY = 0.015; // Gravity acceleration for arms
const BASE_LEG_ROTATION_SPEED = 0.975; // 30% faster (0.75 * 1.3)
const BASE_LEG_RETURN_SPEED = 1.17; // 30% faster (0.9 * 1.3)
const MAX_ARM_ANGLE = 210; // degrees (arms can go past vertical and touch overhead)
const MAX_LEG_ANGLE = 60; // degrees (legs spread - allow splits)

// Active physics values (modified by difficulty)
let JUMP_VELOCITY = BASE_JUMP_VELOCITY;
let ARM_ROTATION_SPEED = BASE_ARM_ROTATION_SPEED;
let ARM_FALL_SPEED = BASE_ARM_FALL_SPEED;
let LEG_ROTATION_SPEED = BASE_LEG_ROTATION_SPEED;
let LEG_RETURN_SPEED = BASE_LEG_RETURN_SPEED;

// Ground and character positioning
let groundY;
let characterGroundY;
let targetMarkers = { left: null, right: null };

// Fireworks particles
let fireworksParticles = [];

// ============================================================================
// PHASER LIFECYCLE FUNCTIONS
// ============================================================================

function preload() {
    // No external assets needed - we'll draw everything programmatically
}

function create() {
    groundY = this.cameras.main.height * 0.8;
    // Position character in middle of grass area (10% from bottom = 90% from top)
    characterGroundY = this.cameras.main.height * 0.9;

    // Create background layers
    createBackground(this);

    // Create character
    createCharacter(this);

    // Create target markers
    createTargetMarkers(this);

    // Setup keyboard input
    setupInput(this);

    // Create OUCH message text (5% from top, red, centered)
    ouchText = this.add.text(
        this.cameras.main.width / 2,
        this.cameras.main.height * 0.05,
        '',
        {
            fontSize: '48px',
            fontFamily: 'Arial',
            color: '#FF0000',
            fontStyle: 'bold',
            stroke: '#FFFFFF',
            strokeThickness: 6
        }
    );
    ouchText.setOrigin(0.5, 0.5);
    ouchText.setVisible(false);

    // Create general message text (30% from top, black, centered)
    messageText = this.add.text(
        this.cameras.main.width / 2,
        this.cameras.main.height * 0.3,
        '',
        {
            fontSize: '28px',
            fontFamily: 'Arial',
            color: '#000000',
            fontStyle: 'bold',
            stroke: '#FFFFFF',
            strokeThickness: 4,
            align: 'center'
        }
    );
    messageText.setOrigin(0.5, 0.5);
    messageText.setVisible(false);

    // Create footer text at bottom of game area
    const footerText = this.add.text(
        this.cameras.main.width / 2,
        this.cameras.main.height - 15,
        'Made 100% with Claude Code. Click here for the code',
        {
            fontSize: '14px',
            fontFamily: 'Arial',
            color: '#FFFFFF',
            alpha: 0.7
        }
    );
    footerText.setOrigin(0.5, 1);

    // Make "here" clickable (simulate link appearance)
    footerText.setInteractive({ useHandCursor: true });
    footerText.on('pointerover', () => {
        footerText.setColor('#00ff88');
    });
    footerText.on('pointerout', () => {
        footerText.setColor('#FFFFFF');
    });
    footerText.on('pointerdown', () => {
        window.open('https://github.com/kurtisf/jumping-dev', '_blank');
    });

    // Initialize UI
    updateScoreDisplay();
}

function update(time, delta) {
    // Always check for input (includes waiting_for_reset and splits states)
    if (gameState === 'idle' || gameState === 'jumping' || gameState === 'waiting_for_reset' || gameState === 'splits') {
        handleInput(delta);
    }

    if (gameState === 'idle' || gameState === 'jumping') {
        updateCharacterPhysics(delta);

        if (gameState === 'jumping') {
            trackJumpData();
        }
    }

    // Handle splits animation
    if (gameState === 'splits') {
        updateSplitsAnimation(delta);
    }

    // Update animations (but not legs if in waiting_for_reset state)
    updateAnimations(delta);

    // Update fireworks particles
    updateFireworks(delta);
}

// ============================================================================
// BACKGROUND CREATION
// ============================================================================

function createBackground(scene) {
    const width = scene.cameras.main.width;
    const height = scene.cameras.main.height;

    // Sky (top 60%) - Already set via backgroundColor

    // Add clouds
    createClouds(scene);

    // Add flying crow
    createCrow(scene);

    // Add sun
    createSun(scene);

    // Bushes layer - moved down 10% more (70% -> 80% from top)
    const bushY = height * 0.8;
    createBushes(scene, bushY);

    // Grass layer (bottom 20%)
    createGrass(scene, groundY);
}

function createClouds(scene) {
    const clouds = [];
    const cloudCount = 8; // Increased from 4 to 8

    for (let i = 0; i < cloudCount; i++) {
        const cloud = scene.add.graphics();
        cloud.fillStyle(0xFFFFFF, 0.7);

        // Draw fluffy cloud shape with randomized sizes
        const cloudScale = 0.7 + Math.random() * 0.6; // Vary cloud sizes

        cloud.fillCircle(0, 0, 25 * cloudScale);
        cloud.fillCircle(20 * cloudScale, -5 * cloudScale, 30 * cloudScale);
        cloud.fillCircle(40 * cloudScale, 0, 25 * cloudScale);
        cloud.fillCircle(20 * cloudScale, 10 * cloudScale, 20 * cloudScale);

        // Spread clouds more evenly across the width with more spacing
        const x = (i * scene.cameras.main.width * 1.5) / cloudCount;
        const y = 50 + Math.random() * 200; // More vertical variation

        cloud.setPosition(x, y);
        cloud.cloudSpeed = 0.15 + Math.random() * 0.25; // Slightly varied speeds
        clouds.push(cloud);
    }

    // Animate clouds
    scene.time.addEvent({
        delay: 50,
        callback: () => {
            clouds.forEach(cloud => {
                cloud.x -= cloud.cloudSpeed;
                if (cloud.x < -100) {
                    cloud.x = scene.cameras.main.width + 100;
                }
            });
        },
        loop: true
    });
}

function createCrow(scene) {
    // Create crow that flies across screen periodically
    const crow = scene.add.graphics();
    crow.fillStyle(0x000000, 1);

    // Draw simple crow silhouette
    // Body
    crow.fillEllipse(0, 0, 12, 8);
    // Head
    crow.fillCircle(-6, -3, 5);
    // Beak
    crow.fillTriangle(-10, -3, -13, -2, -10, -1);
    // Wing (will animate)
    crow.wingUp = false;

    const redrawCrow = (wingUp) => {
        crow.clear();
        crow.fillStyle(0x000000, 1);
        // Body
        crow.fillEllipse(0, 0, 12, 8);
        // Head
        crow.fillCircle(-6, -3, 5);
        // Beak
        crow.fillTriangle(-10, -3, -13, -2, -10, -1);
        // Wings
        if (wingUp) {
            crow.fillEllipse(-3, -6, 10, 4);
            crow.fillEllipse(3, -6, 10, 4);
        } else {
            crow.fillEllipse(-3, 2, 10, 4);
            crow.fillEllipse(3, 2, 10, 4);
        }
    };

    // Start off screen (right side)
    const screenWidth = scene.cameras.main.width;
    crow.setPosition(screenWidth * 3, 100); // Start 3 screen widths away
    crow.setScale(1.5);

    // Animate crow flying across (3 screen widths total, on screen for 1/3 of time)
    const totalDistance = screenWidth * 3;
    const duration = 45000; // 45 seconds for full journey

    scene.tweens.add({
        targets: crow,
        x: -screenWidth,
        duration: duration,
        repeat: -1,
        ease: 'Linear',
        onRepeat: () => {
            // Reset to start position
            crow.setPosition(screenWidth * 3, 80 + Math.random() * 100);
        }
    });

    // Flap wings
    scene.time.addEvent({
        delay: 200,
        callback: () => {
            crow.wingUp = !crow.wingUp;
            redrawCrow(crow.wingUp);
        },
        loop: true
    });

    redrawCrow(false);
}

function createSun(scene) {
    const sunX = scene.cameras.main.width - 100;
    const sunY = 80;

    // Rotating sun body
    const sunBody = scene.add.graphics();
    sunBody.lineStyle(4, 0xFFAA00, 1);
    sunBody.fillStyle(0xFFDD00, 1);
    sunBody.fillCircle(0, 0, 40);

    // Draw sun rays
    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const x1 = Math.cos(angle) * 45;
        const y1 = Math.sin(angle) * 45;
        const x2 = Math.cos(angle) * 60;
        const y2 = Math.sin(angle) * 60;
        sunBody.lineBetween(x1, y1, x2, y2);
    }

    sunBody.setPosition(sunX, sunY);

    // Static face
    const sunFace = scene.add.graphics();
    sunFace.fillStyle(0x000000, 1);
    // Eyes
    sunFace.fillCircle(-12, -5, 4);
    sunFace.fillCircle(12, -5, 4);
    // Smile
    sunFace.lineStyle(3, 0x000000, 1);
    sunFace.arc(0, 5, 15, 0, Math.PI, false);
    sunFace.strokePath();
    sunFace.setPosition(sunX, sunY);

    // Rotate sun body (60 seconds per rotation)
    scene.tweens.add({
        targets: sunBody,
        angle: 360,
        duration: 60000,
        repeat: -1,
        ease: 'Linear'
    });
}

function createBushes(scene, y) {
    const bushes = [];
    const bushCount = 10;

    for (let i = 0; i < bushCount; i++) {
        const bushContainer = scene.add.container();
        const bushGraphics = [];

        // Randomize bush shape - each bush is unique
        const numCircles = 4 + Math.floor(Math.random() * 3); // 4-6 circles per bush
        const bushHeight = 60;
        const bushWidth = 50 + Math.random() * 30;

        for (let j = 0; j < numCircles; j++) {
            const circle = scene.add.graphics();
            circle.fillStyle(0x228B22, 1);

            const offsetX = (Math.random() - 0.5) * bushWidth * 0.8;
            // Circles only go upward from bottom (flat bottom)
            const offsetY = -Math.random() * bushHeight;
            const radius = 15 + Math.random() * 20;

            circle.fillCircle(offsetX, offsetY, radius);
            bushContainer.add(circle);
            bushGraphics.push({ graphics: circle, offsetX, offsetY, radius });
        }

        // Add flat bottom base - wider light colored portion, upside down bowl dark portion
        const baseGraphics = scene.add.graphics();

        // Light colored base (wider, draw first at bottom)
        baseGraphics.fillStyle(0x228B22, 1);
        baseGraphics.fillEllipse(0, 0, bushWidth * 1.2, 18);

        // Dark portion - rounded upside down bowl going upward from middle
        baseGraphics.fillStyle(0x1a6b1a, 1);
        // Use fillEllipse to create rounded bowl shape, positioned to go upward
        baseGraphics.fillEllipse(0, -10, bushWidth * 0.8, 20); // Centered higher, 20px tall (half of 40)

        bushContainer.add(baseGraphics);

        // Position bushes with bottom touching grass line
        const baseX = (i * scene.cameras.main.width) / bushCount + (Math.random() - 0.5) * 50;
        bushContainer.setPosition(baseX, y);
        bushContainer.baseX = baseX;
        bushContainer.baseY = y;
        bushContainer.swayOffset = i * 0.5;
        bushContainer.bushGraphics = bushGraphics;
        bushes.push(bushContainer);
    }

    // Animate bush swaying - wind effect (top moves more than bottom)
    let swayTime = 0;
    scene.time.addEvent({
        delay: 50,
        callback: () => {
            swayTime += 0.03;
            bushes.forEach(bush => {
                // Base sway at bottom
                const baseSway = Math.sin(swayTime + bush.swayOffset) * 2;

                // Update each circle with varying sway based on height
                bush.bushGraphics.forEach(item => {
                    const heightRatio = Math.abs(item.offsetY) / 60; // 0 at bottom, 1 at top
                    const sway = baseSway * (1 + heightRatio * 2); // Top moves 3x more than bottom

                    item.graphics.clear();
                    item.graphics.fillStyle(0x228B22, 1);
                    item.graphics.fillCircle(item.offsetX + sway, item.offsetY, item.radius);
                });
            });
        },
        loop: true
    });
}

function createGrass(scene, y) {
    const grass = scene.add.graphics();
    grass.fillStyle(0x32CD32, 1);
    grass.fillRect(0, y, scene.cameras.main.width, scene.cameras.main.height - y);

    // Add grass texture details - positioned lower in the grass area
    grass.lineStyle(2, 0x228B22, 0.5);
    const grassHeight = scene.cameras.main.height - y;
    for (let i = 0; i < 100; i++) {
        const x = Math.random() * scene.cameras.main.width;
        // Position grass stalks in lower 60% of grass area
        const grassY = y + grassHeight * 0.4 + Math.random() * (grassHeight * 0.6);
        grass.lineBetween(x, grassY, x + Math.random() * 10 - 5, grassY - 10 - Math.random() * 10);
    }
}

// ============================================================================
// CHARACTER CREATION
// ============================================================================

function createCharacter(scene) {
    const centerX = scene.cameras.main.width / 2;
    const characterHeight = scene.cameras.main.height * 0.5;

    // Character proportions - shorter torso
    const torsoHeight = characterHeight * 0.3; // Reduced from 0.5 to 0.3
    const headSize = characterHeight * 0.075; // Half the previous size
    const armLength = characterHeight * 0.35;
    const legLength = characterHeight * 0.45; // Increased to be more visible

    // Create character container
    character.container = scene.add.container(centerX, characterGroundY);

    // Create legs (draw first so they're behind body)
    character.leftLeg = createLeg(scene, -15, -legLength, legLength, true);
    character.rightLeg = createLeg(scene, 15, -legLength, legLength, false);

    // Create torso
    character.torso = scene.add.graphics();
    character.torso.fillStyle(0x808080, 1); // Heather gray hoodie
    character.torso.fillRoundedRect(-40, -legLength - torsoHeight, 80, torsoHeight, 10);

    // Hoodie details - two drawstrings on each side of neck
    character.torso.lineStyle(2, 0x505050, 1);
    // Left drawstring
    character.torso.lineBetween(-8, -legLength - torsoHeight + 5, -8, -legLength - torsoHeight + 20);
    // Right drawstring
    character.torso.lineBetween(8, -legLength - torsoHeight + 5, 8, -legLength - torsoHeight + 20);
    // Small knots at the end
    character.torso.fillStyle(0x505050, 1);
    character.torso.fillCircle(-8, -legLength - torsoHeight + 20, 3);
    character.torso.fillCircle(8, -legLength - torsoHeight + 20, 3);

    // Create head
    character.head = scene.add.graphics();
    character.head.fillStyle(0xFFDBAC, 1); // Skin tone
    character.head.fillCircle(0, -legLength - torsoHeight - headSize, headSize);

    // Placeholder face (simple features for now)
    character.face = scene.add.graphics();
    character.face.fillStyle(0x000000, 1);
    // Eyes
    character.face.fillCircle(-8, -legLength - torsoHeight - headSize, 3);
    character.face.fillCircle(8, -legLength - torsoHeight - headSize, 3);
    // Smile
    character.face.lineStyle(2, 0x000000, 1);
    character.face.arc(0, -legLength - torsoHeight - headSize + 5, 10, 0, Math.PI, false);
    character.face.strokePath();

    // Create arms (draw last so they're in front)
    // Arms attach at shoulders (top of torso)
    character.leftArm = createArm(scene, -40, -legLength - torsoHeight + 10, armLength, true);
    character.rightArm = createArm(scene, 40, -legLength - torsoHeight + 10, armLength, false);

    // Add all parts to container
    character.container.add([
        character.leftLeg.container,
        character.rightLeg.container,
        character.torso,
        character.leftArm.container,
        character.rightArm.container,
        character.head,
        character.face
    ]);

    // Store initial position for reset
    character.initialY = characterGroundY;
    character.velocity = 0;
}

function createArm(scene, x, y, length, isLeft) {
    const arm = {
        container: scene.add.container(x, y),
        angle: 0,
        targetAngle: 0,
        isMovingUp: false,
        velocity: 0, // For ragdoll physics
        isLeft: isLeft
    };

    // Upper arm (hoodie sleeve)
    const upperArm = scene.add.graphics();
    upperArm.fillStyle(0x808080, 1);
    upperArm.fillRoundedRect(-8, 0, 16, length * 0.6, 5);

    // Lower arm (skin)
    const lowerArm = scene.add.graphics();
    lowerArm.fillStyle(0xFFDBAC, 1);
    lowerArm.fillRoundedRect(-7, length * 0.6, 14, length * 0.4, 5);

    // Hand
    const hand = scene.add.graphics();
    hand.fillStyle(0xFFDBAC, 1);
    hand.fillCircle(0, length, 10);

    arm.container.add([upperArm, lowerArm, hand]);
    arm.graphics = { upperArm, lowerArm, hand };

    return arm;
}

function createLeg(scene, x, y, length, isLeft) {
    const leg = {
        container: scene.add.container(x, y),
        angle: 0,
        targetAngle: 0,
        isSpreading: false
    };

    // Upper leg (jeans)
    const upperLeg = scene.add.graphics();
    upperLeg.fillStyle(0x4169E1, 1); // Blue jeans
    upperLeg.fillRoundedRect(-10, 0, 20, length * 0.55, 5);

    // Lower leg (jeans)
    const lowerLeg = scene.add.graphics();
    lowerLeg.fillStyle(0x4169E1, 1);
    lowerLeg.fillRoundedRect(-9, length * 0.55, 18, length * 0.45, 5);

    // Shoe (white high-top)
    const shoe = scene.add.graphics();
    shoe.fillStyle(0xFFFFFF, 1);
    shoe.fillRoundedRect(-12, length, 24, 15, 3);
    shoe.lineStyle(2, 0xCCCCCC, 1);
    shoe.strokeRoundedRect(-12, length, 24, 15, 3);

    leg.container.add([upperLeg, lowerLeg, shoe]);
    leg.graphics = { upperLeg, lowerLeg, shoe };

    return leg;
}

// ============================================================================
// TARGET MARKERS
// ============================================================================

function createTargetMarkers(scene) {
    const centerX = scene.cameras.main.width / 2;
    const markerWidth = 39; // 30% wider (30 * 1.3 = 39)
    const markerDistance = 84; // 40% further apart (60 * 1.4 = 84)

    // Left marker - positioned at character's foot level
    targetMarkers.left = scene.add.graphics();
    targetMarkers.left.lineStyle(3, 0xFFFFFF, 0.8);
    targetMarkers.left.strokeRect(-markerWidth / 2, -5, markerWidth, 10);
    targetMarkers.left.setPosition(centerX - markerDistance, characterGroundY + 5);
    targetMarkers.leftX = centerX - markerDistance;

    // Right marker - positioned at character's foot level
    targetMarkers.right = scene.add.graphics();
    targetMarkers.right.lineStyle(3, 0xFFFFFF, 0.8);
    targetMarkers.right.strokeRect(-markerWidth / 2, -5, markerWidth, 10);
    targetMarkers.right.setPosition(centerX + markerDistance, characterGroundY + 5);
    targetMarkers.rightX = centerX + markerDistance;

    targetMarkers.tolerance = markerWidth * 0.1; // 10% tolerance (more forgiving)
    targetMarkers.maxOvershoot = 35; // Absolute pixel distance from marker before splits
    targetMarkers.markerWidth = markerWidth;
}

// ============================================================================
// INPUT HANDLING
// ============================================================================

function setupInput(scene) {
    keys.W = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    keys.Q = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    keys.E = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    keys.Z = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    keys.X = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    keys.SPACE = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    keys.H = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.H);
    keys.ESC = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
}

function handleInput(delta) {
    // Helper function to detect if a key was just pressed (not held)
    const wasJustPressed = (key) => {
        const keyName = key;
        const isDown = keys[keyName].isDown;
        const wasDown = previousKeyStates[keyName] || false;
        return isDown && !wasDown;
    };

    // Update previous key states at end of function
    const updatePreviousStates = () => {
        previousKeyStates.W = keys.W.isDown;
        previousKeyStates.Q = keys.Q.isDown;
        previousKeyStates.E = keys.E.isDown;
        previousKeyStates.Z = keys.Z.isDown;
        previousKeyStates.X = keys.X.isDown;
        previousKeyStates.SPACE = keys.SPACE.isDown;
    };

    // Reset from waiting_for_reset or splits state with SPACEBAR only
    if (gameState === 'waiting_for_reset' || gameState === 'splits') {
        if (wasJustPressed('SPACE')) {
            resetCharacter();
            updatePreviousStates();
            return;
        }
    }

    // Start game on first key press
    if (gameState === 'idle') {
        if (keys.W.isDown || keys.Q.isDown || keys.E.isDown || keys.Z.isDown || keys.X.isDown) {
            startJump();
        }
    }

    if (gameState === 'jumping') {
        // Jump control (W key) - starts immediately, continues while held
        if (character.container.y === character.initialY && character.velocity === 0) {
            // On ground - check if W was just pressed to start jump
            if (keys.W.isDown && jumpData.wKeyPressTime === 0) {
                // Start jump immediately
                jumpData.wKeyPressTime = Date.now();
                character.velocity = JUMP_VELOCITY * 0.3; // Initial 30% velocity
                jumpData.jumpStartTime = Date.now();
            }
        } else if (character.container.y < character.initialY) {
            // In air - apply continued upward force while W is held (if not released)
            if (keys.W.isDown && jumpData.wKeyPressTime > 0) {
                const holdDuration = Date.now() - jumpData.wKeyPressTime;
                // Apply additional upward velocity while W is held (up to 300ms for 60% of original max height)
                if (holdDuration < 300) {
                    // Add upward force while held - shorter duration limits max height to 60%
                    character.velocity -= 50; // Strong upward boost per frame
                }
            } else if (jumpData.wKeyPressTime > 0) {
                // W was released - mark it so we don't accept W input until reset
                jumpData.wKeyPressTime = -1; // -1 means "released, awaiting reset"
            }
        }

        // Left arm (Q key)
        if (keys.Q.isDown) {
            character.leftArm.isMovingUp = true;
            character.leftArm.targetAngle = MAX_ARM_ANGLE;
            jumpData.limbsMoved.leftArm = true;
        } else {
            character.leftArm.isMovingUp = false;
        }

        // Right arm (E key)
        if (keys.E.isDown) {
            character.rightArm.isMovingUp = true;
            character.rightArm.targetAngle = MAX_ARM_ANGLE;
            jumpData.limbsMoved.rightArm = true;
        } else {
            character.rightArm.isMovingUp = false;
        }

        // Left leg (Z key) - only works in air - spreads outward to the left
        if (keys.Z.isDown && character.container.y < character.initialY) {
            character.leftLeg.isSpreading = true;
            character.leftLeg.targetAngle = MAX_LEG_ANGLE; // Positive angle spreads left
            jumpData.limbsMoved.leftLeg = true;
        } else {
            character.leftLeg.isSpreading = false;
            character.leftLeg.targetAngle = 0;
        }

        // Right leg (X key) - only works in air - spreads outward to the right
        if (keys.X.isDown && character.container.y < character.initialY) {
            character.rightLeg.isSpreading = true;
            character.rightLeg.targetAngle = -MAX_LEG_ANGLE; // Negative angle spreads right
            jumpData.limbsMoved.rightLeg = true;
        } else {
            character.rightLeg.isSpreading = false;
            character.rightLeg.targetAngle = 0;
        }
    }

    // Always update previous key states at end
    updatePreviousStates();
}

// ============================================================================
// CHARACTER PHYSICS & ANIMATION
// ============================================================================

function updateSplitsAnimation(delta) {
    // Animate legs spreading to 180 degrees from wherever they currently are
    const targetSplits = 90; // Each leg goes 90 degrees (total 180)
    const splitsSpeed = 2.0; // Fast animation

    // Spread legs outward from current position to 90 degrees
    // Left leg spreads outward (positive direction)
    if (character.leftLeg.angle < targetSplits) {
        character.leftLeg.angle += splitsSpeed * (delta / 16);
        if (character.leftLeg.angle > targetSplits) {
            character.leftLeg.angle = targetSplits;
        }
    }
    // Right leg spreads outward (negative direction)
    if (character.rightLeg.angle > -targetSplits) {
        character.rightLeg.angle -= splitsSpeed * (delta / 16);
        if (character.rightLeg.angle < -targetSplits) {
            character.rightLeg.angle = -targetSplits;
        }
    }

    // Lower character all the way down - torso should be ON the ground level (full splits)
    const targetY = characterGroundY + 150; // Much lower - full splits on ground
    if (character.container.y < targetY) {
        character.container.y += 300 * (delta / 1000); // Descend faster
        if (character.container.y > targetY) {
            character.container.y = targetY;
        }
    }

    // Update leg rotations
    character.leftLeg.container.setRotation(Phaser.Math.DegToRad(character.leftLeg.angle));
    character.rightLeg.container.setRotation(Phaser.Math.DegToRad(character.rightLeg.angle));

    // Once fully in splits and on ground, score and wait for reset
    if (character.leftLeg.angle >= targetSplits &&
        character.rightLeg.angle <= -targetSplits &&
        character.container.y >= targetY) {
        // Score the splits jump with all 1's (only do this once)
        if (gameState === 'splits') {
            const breakdown = calculateScore();
            lastJumpBreakdown = breakdown;
            const totalJumpScore = breakdown.total;
            jumpScores.push(totalJumpScore);
            totalScore += totalJumpScore;
            updateScoreDisplay();
            updateBreakdownDisplay(breakdown);

            // Now stay in splits, waiting for user to reset
            gameState = 'waiting_for_reset';
            // Show regular jump complete message in black
            messageText.setText('Jump Complete\n\nPress Space to Reset');
            messageText.setVisible(true);
            // Keep OUCH visible at the top
        }
    }
}

function updateCharacterPhysics(delta) {
    // Apply gravity to character
    if (character.velocity !== 0 || character.container.y < character.initialY) {
        character.velocity += 2000 * (delta / 1000);
        character.container.y += character.velocity * (delta / 1000);

        // Check landing
        if (character.container.y >= character.initialY) {
            character.container.y = character.initialY;
            character.velocity = 0;

            if (gameState === 'jumping') {
                // Freeze arms in their current position
                character.leftArm.velocity = 0;
                character.rightArm.velocity = 0;
                character.leftArm.isMovingUp = false;
                character.rightArm.isMovingUp = false;

                landJump();
            }
            // Splits scoring now happens in updateSplitsAnimation when animation completes
        }
    }
}

function updateAnimations(delta) {
    // Animate arms
    updateArmRotation(character.leftArm, delta);
    updateArmRotation(character.rightArm, delta);

    // Animate legs
    updateLegRotation(character.leftLeg, delta);
    updateLegRotation(character.rightLeg, delta);
}

function updateArmRotation(arm, delta) {
    // Freeze arms in landing and waiting_for_reset states
    if (gameState === 'landing' || gameState === 'waiting_for_reset') {
        arm.container.setRotation(Phaser.Math.DegToRad(arm.angle));
        return;
    }

    // Arms swing outward: left arm goes counter-clockwise (negative), right arm goes clockwise (positive)
    const direction = arm.isLeft ? 1 : -1; // Direction for rotation

    if (arm.isMovingUp) {
        // Swing arm up with velocity
        arm.velocity += ARM_ROTATION_SPEED * (delta / 16);
    } else {
        // Ragdoll physics - gravity pulls arm down
        arm.velocity -= ARM_FALL_SPEED * (delta / 16);
    }

    // Apply velocity to angle
    arm.angle += arm.velocity * direction;

    // Left arm swings from 0 to +200 (counter-clockwise, outward and up)
    // Right arm swings from 0 to -200 (clockwise, outward and up)
    if (arm.isLeft) {
        if (arm.angle > MAX_ARM_ANGLE) {
            arm.angle = MAX_ARM_ANGLE;
            arm.velocity = 0;
        }
        if (arm.angle < 0) {
            arm.angle = 0;
            arm.velocity = 0;
        }
    } else {
        if (arm.angle < -MAX_ARM_ANGLE) {
            arm.angle = -MAX_ARM_ANGLE;
            arm.velocity = 0;
        }
        if (arm.angle > 0) {
            arm.angle = 0;
            arm.velocity = 0;
        }
    }

    arm.container.setRotation(Phaser.Math.DegToRad(arm.angle));
}

function updateLegRotation(leg, delta) {
    // Freeze legs in landing position during waiting_for_reset state
    if (gameState === 'waiting_for_reset') {
        // Don't update leg angle, keep it frozen
        leg.container.setRotation(Phaser.Math.DegToRad(leg.angle));
        return;
    }

    // During splits animation, let updateSplitsAnimation handle leg movement
    if (gameState === 'splits') {
        // Don't interfere with splits animation
        return;
    }

    // Only allow leg movement if character is in the air
    if (character.container.y < character.initialY) {
        if (leg.isSpreading) {
            // Spread leg
            const diff = leg.targetAngle - leg.angle;
            leg.angle += Math.sign(diff) * LEG_ROTATION_SPEED * (delta / 16);

            if (Math.abs(leg.angle - leg.targetAngle) < 0.5) {
                leg.angle = leg.targetAngle;
            }
        } else {
            // Return to center
            leg.angle -= Math.sign(leg.angle) * LEG_RETURN_SPEED * (delta / 16);

            if (Math.abs(leg.angle) < 0.5) {
                leg.angle = 0;
            }
        }
    } else {
        // On ground - force legs to be straight (except in waiting_for_reset)
        leg.angle = 0;
    }

    leg.container.setRotation(Phaser.Math.DegToRad(leg.angle));
}

// ============================================================================
// JUMP TRACKING & SCORING
// ============================================================================

function startJump() {
    gameState = 'jumping';
    currentJumpNumber++;

    // Clear last score immediately when starting a new jump
    document.getElementById('lastScore').textContent = '-';
    document.getElementById('lastStars').textContent = '';

    // Reset jump data
    jumpData = {
        isJumping: true,
        jumpStartTime: Date.now(),
        wKeyPressTime: 0,
        jumpChargeTime: 0,
        maxHeight: 0,
        currentHeight: 0,
        leftArmMaxAngle: 0,
        rightArmMaxAngle: 0,
        leftLegMaxSpread: 0,
        rightLegMaxSpread: 0,
        leftArmPeakedInAir: false,
        rightArmPeakedInAir: false,
        legsSpreading: false,
        limbsMoved: { leftArm: false, rightArm: false, leftLeg: false, rightLeg: false },
        didSplits: false
    };

    updateScoreDisplay();
}

function trackJumpData() {
    // Track height
    jumpData.currentHeight = character.initialY - character.container.y;
    if (jumpData.currentHeight > jumpData.maxHeight) {
        jumpData.maxHeight = jumpData.currentHeight;
    }

    // Track arm angles
    const leftArmAngle = Math.abs(character.leftArm.angle);
    const rightArmAngle = Math.abs(character.rightArm.angle);

    if (leftArmAngle > jumpData.leftArmMaxAngle) {
        jumpData.leftArmMaxAngle = leftArmAngle;
    }
    if (rightArmAngle > jumpData.rightArmMaxAngle) {
        jumpData.rightArmMaxAngle = rightArmAngle;
    }

    // Check if arms peaked while in air
    if (character.container.y < character.initialY) {
        if (leftArmAngle > 80) jumpData.leftArmPeakedInAir = true;
        if (rightArmAngle > 80) jumpData.rightArmPeakedInAir = true;
    }

    // Track leg spread
    const leftLegSpread = Math.abs(character.leftLeg.angle);
    const rightLegSpread = Math.abs(character.rightLeg.angle);

    if (leftLegSpread > jumpData.leftLegMaxSpread) {
        jumpData.leftLegMaxSpread = leftLegSpread;
    }
    if (rightLegSpread > jumpData.rightLegMaxSpread) {
        jumpData.rightLegMaxSpread = rightLegSpread;
    }

    // Splits detection removed from here - now happens in landJump() only once
}

function landJump() {
    // Check for splits FIRST before changing state
    const leftLegAngleRad = Phaser.Math.DegToRad(character.leftLeg.angle);
    const rightLegAngleRad = Phaser.Math.DegToRad(character.rightLeg.angle);

    // Calculate foot positions at landing
    const leftFootX = (character.container.x - 15) - Math.sin(leftLegAngleRad) * 140;
    const rightFootX = (character.container.x + 15) - Math.sin(rightLegAngleRad) * 140;

    // Check distance from markers
    const leftDistance = Math.abs(leftFootX - targetMarkers.leftX);
    const rightDistance = Math.abs(rightFootX - targetMarkers.rightX);

    console.log('SPLITS CHECK AT LANDING:', {
        leftFootX: leftFootX,
        rightFootX: rightFootX,
        markerLeftX: targetMarkers.leftX,
        markerRightX: targetMarkers.rightX,
        leftDistance: leftDistance,
        rightDistance: rightDistance,
        maxOvershoot: targetMarkers.maxOvershoot,
        leftLegAngle: character.leftLeg.angle,
        rightLegAngle: character.rightLeg.angle
    });

    // Check if player did the splits
    // Splits = either leg angle is beyond safe threshold (over 30 degrees)
    const leftLegAngleAbs = Math.abs(character.leftLeg.angle);
    const rightLegAngleAbs = Math.abs(character.rightLeg.angle);
    const SPLITS_ANGLE_THRESHOLD = 30; // degrees

    console.log('SPLITS ANGLE CHECK:', {
        leftLegAngle: leftLegAngleAbs,
        rightLegAngle: rightLegAngleAbs,
        threshold: SPLITS_ANGLE_THRESHOLD
    });

    // Splits if either leg is spread beyond 30 degrees
    if (leftLegAngleAbs > SPLITS_ANGLE_THRESHOLD || rightLegAngleAbs > SPLITS_ANGLE_THRESHOLD) {
        console.log('SPLITS TRIGGERED!');
        jumpData.didSplits = true;
        gameState = 'splits'; // Change to splits state instead of landing
        ouchText.setText('OUCH!');
        ouchText.setVisible(true);
        // Don't show normal landing message or score yet - splits animation will handle it
        return;
    }

    gameState = 'landing';

    // Show "Jump Complete" and "Press Space to Reset" messages together
    messageText.setText('Jump Complete\n\nPress Space to Reset');
    messageText.setVisible(true);

    // Check for perfect landings and create fireworks
    checkForFireworks();

    // Score immediately on landing
    scoreJump();
}

function checkForFireworks() {
    const markerWidth = targetMarkers.markerWidth || 30;
    const scene = game.scene.scenes[0];

    // Calculate foot positions
    const leftFootX = (character.container.x - 15) - Math.sin(Phaser.Math.DegToRad(character.leftLeg.angle)) * 140;
    const rightFootX = (character.container.x + 15) - Math.sin(Phaser.Math.DegToRad(character.rightLeg.angle)) * 140;
    const footY = characterGroundY + 5;

    // Gold fireworks for feet landing in markers
    const leftDistance = Math.abs(leftFootX - targetMarkers.leftX);
    if (leftDistance <= markerWidth / 2) {
        createFireworks(scene, leftFootX, footY, '#FFD700');
    }

    const rightDistance = Math.abs(rightFootX - targetMarkers.rightX);
    if (rightDistance <= markerWidth / 2) {
        createFireworks(scene, rightFootX, footY, '#FFD700');
    }

    // Pink fireworks for arms in perfect range (192-198 degrees)
    const leftArmAngle = Math.abs(character.leftArm.angle);
    const rightArmAngle = Math.abs(character.rightArm.angle);

    if (leftArmAngle >= 192 && leftArmAngle <= 198 && rightArmAngle >= 192 && rightArmAngle <= 198) {
        const shoulderY = character.initialY - 180;
        const handY = shoulderY - 150;
        const handX = character.container.x;
        createFireworks(scene, handX, handY, '#FF69B4');
    }
}

function createFireworks(scene, x, y, color) {
    // Create 8-12 particles radiating outward
    const particleCount = 8 + Math.floor(Math.random() * 5);

    for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2;
        const speed = 2 + Math.random() * 2;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;

        const particle = scene.add.graphics();
        particle.fillStyle(Phaser.Display.Color.HexStringToColor(color).color, 1);
        particle.fillCircle(0, 0, 3);
        particle.setPosition(x, y);

        fireworksParticles.push({
            graphics: particle,
            x: x,
            y: y,
            vx: vx,
            vy: vy,
            life: 1.0, // 0 to 1
            decay: 0.02 // How fast it fades
        });
    }
}

function updateFireworks(delta) {
    for (let i = fireworksParticles.length - 1; i >= 0; i--) {
        const p = fireworksParticles[i];

        // Update position
        p.x += p.vx * (delta / 16);
        p.y += p.vy * (delta / 16);

        // Apply gravity and friction
        p.vy += 0.1 * (delta / 16);
        p.vx *= 0.98;
        p.vy *= 0.98;

        // Update graphics (particles persist until reset)
        p.graphics.setPosition(p.x, p.y);
        p.graphics.setAlpha(1.0);
    }
}

function scoreJump() {
    const breakdown = calculateScore();
    lastJumpBreakdown = breakdown;

    const totalJumpScore = breakdown.total;
    jumpScores.push(totalJumpScore);
    totalScore += totalJumpScore;

    // Update UI immediately
    updateScoreDisplay();
    updateBreakdownDisplay(breakdown);

    // Check if game is over
    if (currentJumpNumber >= 10) {
        // Enter waiting_for_reset state, show final score when user presses space
        gameState = 'waiting_for_reset';
    } else {
        // Enter waiting_for_reset state - player holds landing pose
        gameState = 'waiting_for_reset';
    }
}

function calculateScore() {
    const breakdown = {
        arms: 0,
        legs: 0,
        height: 0,
        timing: 0,
        total: 0
    };

    // If player did the splits, give minimum score
    if (jumpData.didSplits) {
        breakdown.arms = 1;
        breakdown.legs = 1;
        breakdown.height = 1;
        breakdown.timing = 1;
        breakdown.total = 4;
        return breakdown;
    }

    // ARM SCORING (40 points max)
    const leftArmAngle = Math.abs(character.leftArm.angle);
    const rightArmAngle = Math.abs(character.rightArm.angle);
    const leftArmScore = scoreArmAngle(leftArmAngle);
    const rightArmScore = scoreArmAngle(rightArmAngle);
    breakdown.arms = Math.min(leftArmScore + rightArmScore, 40);

    // LEG SCORING (30 points max)
    const leftLegBaseX = character.container.x - 15;
    const rightLegBaseX = character.container.x + 15;
    const leftFootX = leftLegBaseX - Math.sin(Phaser.Math.DegToRad(character.leftLeg.angle)) * 140;
    const rightFootX = rightLegBaseX - Math.sin(Phaser.Math.DegToRad(character.rightLeg.angle)) * 140;

    const leftLegLandingSpread = Math.abs(character.leftLeg.angle);
    const rightLegLandingSpread = Math.abs(character.rightLeg.angle);

    const leftFootScore = scoreFootLanding(leftFootX, targetMarkers.leftX, leftLegLandingSpread);
    const rightFootScore = scoreFootLanding(rightFootX, targetMarkers.rightX, rightLegLandingSpread);
    breakdown.legs = leftFootScore + rightFootScore;

    // Symmetry bonus (5 points)
    const legDiff = Math.abs(leftLegLandingSpread - rightLegLandingSpread);
    const legsActuallyMoved = leftLegLandingSpread > 2 || rightLegLandingSpread > 2;
    if (legDiff < 10 && legsActuallyMoved) {
        breakdown.legs += 5;
    }
    breakdown.legs = Math.min(breakdown.legs, 30);

    // HEIGHT SCORING (15 points max)
    const maxAchievableHeight = 96;
    const heightPercent = jumpData.maxHeight / maxAchievableHeight;

    if (heightPercent >= 0.95) {
        breakdown.height = 15;
    } else if (heightPercent >= 0.75) {
        breakdown.height = 12;
    } else if (heightPercent >= 0.55) {
        breakdown.height = 9;
    } else if (heightPercent >= 0.35) {
        breakdown.height = 6;
    } else if (heightPercent >= 0.15) {
        breakdown.height = 3;
    } else {
        breakdown.height = 1;
    }

    // TIMING & COORDINATION (15 points max)
    let timingScore = 0;

    // All 4 limbs moved (5 pts)
    const allLimbsMoved = Object.values(jumpData.limbsMoved).every(moved => moved);
    if (allLimbsMoved) {
        timingScore += 5;
    }

    // Arms peaked in air (5 pts)
    if (jumpData.leftArmPeakedInAir && jumpData.rightArmPeakedInAir) {
        timingScore += 5;
    }

    // Legs spread at apex (5 pts)
    const legsSpreadWell = jumpData.leftLegMaxSpread > 20 && jumpData.rightLegMaxSpread > 20;
    if (legsSpreadWell) {
        timingScore += 5;
    }

    breakdown.timing = timingScore;

    // TOTAL
    breakdown.total = breakdown.arms + breakdown.legs + breakdown.height + breakdown.timing;

    return breakdown;
}

function scoreArmAngle(angle) {
    // Arm scoring based purely on angle
    // 0° (down) = 0.5 pts
    // 0° to 180°: Interpolates 1 to 10 pts
    // 180° to 195°: Interpolates 10 to 20 pts
    // 195° (hands meet at center): 20 pts (perfect!)
    // 195° to 210° (max): Interpolates 20 back down to 10 pts

    // Check if arm barely moved
    if (angle < 2) {
        return 0.5; // Straight down = 0.5 points
    }

    // From 0° to 180° (down to straight up)
    if (angle <= 180) {
        // Interpolate from 1 pt to 10 pts
        const progress = angle / 180;
        return 1 + progress * 9; // 1 to 10 points
    }

    // From 180° to 195° (straight up to perfect position)
    if (angle <= 195) {
        // Interpolate from 10 pts to 20 pts
        const progress = (angle - 180) / 15; // 0 to 1 over 15 degrees
        return 10 + progress * 10; // 10 to 20 points
    }

    // From 195° to 210° (perfect position to max rotation)
    if (angle <= 210) {
        // Interpolate from 20 pts down to 10 pts
        const progress = (angle - 195) / 15; // 0 to 1 over 15 degrees
        return 20 - progress * 10; // 20 down to 10 points
    }

    // Past max rotation (shouldn't happen, but handle it)
    return 10;
}

function scoreFootLanding(footX, targetX, legMaxSpread) {
    // Simplified foot scoring based on marker bounding box
    // Check if foot X coordinate is within the marker's bounds

    const markerWidth = targetMarkers.markerWidth || 39;
    const markerHalfWidth = markerWidth / 2;

    // Marker bounding box
    const markerLeft = targetX - markerHalfWidth;
    const markerRight = targetX + markerHalfWidth;

    // Check if foot is within marker bounds
    if (footX >= markerLeft && footX <= markerRight) {
        // Foot is inside the marker - score based on distance from center
        const distanceFromCenter = Math.abs(footX - targetX);
        const maxDistanceInMarker = markerHalfWidth;

        // Perfect center = 15 pts, edge of marker = 10 pts
        // Linear interpolation
        const score = 15 - (distanceFromCenter / maxDistanceInMarker) * 5;
        return Math.max(score, 10); // Clamp to minimum 10 if inside marker
    }

    // Foot is outside marker - score based on how far outside
    const distanceOutside = footX < markerLeft ?
        (markerLeft - footX) : (footX - markerRight);

    // Outside by 0-30 pixels: interpolate from 9 down to 1
    if (distanceOutside <= 30) {
        return 9 - (distanceOutside / 30) * 8; // 9 down to 1
    }

    // Very far outside = minimum score
    return 0.5;
}

function resetCharacter() {
    // Check if game is over (completed 10 jumps)
    if (currentJumpNumber >= 10) {
        messageText.setVisible(false);
        ouchText.setVisible(false);
        endGame();
        return;
    }

    // Hide both messages
    messageText.setVisible(false);
    ouchText.setVisible(false);

    // Clear all fireworks particles
    for (let i = fireworksParticles.length - 1; i >= 0; i--) {
        fireworksParticles[i].graphics.destroy();
    }
    fireworksParticles = [];

    // Reset character position
    character.container.y = character.initialY;
    character.velocity = 0;

    // Reset arm physics
    character.leftArm.angle = 0;
    character.rightArm.angle = 0;
    character.leftArm.velocity = 0;
    character.rightArm.velocity = 0;
    character.leftArm.isMovingUp = false;
    character.rightArm.isMovingUp = false;

    // Reset leg positions
    character.leftLeg.angle = 0;
    character.rightLeg.angle = 0;
    character.leftLeg.targetAngle = 0;
    character.rightLeg.targetAngle = 0;

    // Reset splits flag (critical for scoring!)
    jumpData.didSplits = false;

    // Immediately ready for next jump
    gameState = 'idle';
}

// ============================================================================
// UI UPDATES
// ============================================================================

function updateScoreDisplay() {
    document.getElementById('totalScore').textContent = Math.round(totalScore);
    document.getElementById('currentJump').textContent = currentJumpNumber;

    if (jumpScores.length > 0) {
        const lastScore = jumpScores[jumpScores.length - 1];
        document.getElementById('lastScore').textContent = Math.round(lastScore) + ' pts';
        document.getElementById('lastStars').textContent = getStarRating(lastScore);
    }
}

function updateBreakdownDisplay(breakdown) {
    // Update progress bars
    updateProgressBar('armsProgress', 'armsValue', breakdown.arms, 40);
    updateProgressBar('legsProgress', 'legsValue', breakdown.legs, 30);
    updateProgressBar('heightProgress', 'heightValue', breakdown.height, 15);
    updateProgressBar('timingProgress', 'timingValue', breakdown.timing, 15);
}

function updateProgressBar(barId, valueId, score, max) {
    const percent = (score / max) * 100;
    const roundedScore = Math.round(score);
    document.getElementById(barId).style.width = percent + '%';
    document.getElementById(valueId).textContent = roundedScore + '/' + max;
}

function getStarRating(score) {
    if (score >= 90) return '⭐⭐⭐⭐';
    if (score >= 70) return '⭐⭐⭐';
    if (score >= 50) return '⭐⭐';
    if (score >= 25) return '⭐';
    return '';
}

function endGame() {
    gameState = 'gameOver';

    // Calculate stats
    const perfectJumps = jumpScores.filter(score => score === 100).length;
    const bestJump = Math.max(...jumpScores);
    const averageScore = Math.round(jumpScores.reduce((a, b) => a + b, 0) / jumpScores.length);
    const percentage = ((totalScore / 1000) * 100).toFixed(1);

    // Determine grade
    let grade = 'F';
    if (percentage >= 90) grade = 'A';
    else if (percentage >= 80) grade = 'B';
    else if (percentage >= 70) grade = 'C';
    else if (percentage >= 60) grade = 'D';

    // Update game over modal
    document.getElementById('finalScore').textContent = Math.round(totalScore);
    document.getElementById('finalProgress').style.width = percentage + '%';
    document.getElementById('finalPercentage').textContent = percentage + '%';
    document.getElementById('finalGrade').textContent = grade;
    document.getElementById('perfectJumps').textContent = perfectJumps;
    document.getElementById('bestJump').textContent = Math.round(bestJump);
    document.getElementById('averageScore').textContent = averageScore;

    // Show modal
    document.getElementById('gameOverModal').style.display = 'block';
}

function restartGame() {
    // Reset all game state
    totalScore = 0;
    currentJumpNumber = 0;
    jumpScores = [];
    gameState = 'idle';

    // Reset character
    character.container.y = character.initialY;
    character.velocity = 0;
    character.leftArm.angle = 0;
    character.rightArm.angle = 0;
    character.leftArm.velocity = 0;
    character.rightArm.velocity = 0;
    character.leftArm.isMovingUp = false;
    character.rightArm.isMovingUp = false;
    character.leftLeg.angle = 0;
    character.rightLeg.angle = 0;

    // Reset UI
    updateScoreDisplay();
    document.getElementById('lastScore').textContent = '-';
    document.getElementById('lastStars').textContent = '';

    // Reset breakdown
    updateProgressBar('armsProgress', 'armsValue', 0, 40);
    updateProgressBar('legsProgress', 'legsValue', 0, 30);
    updateProgressBar('heightProgress', 'heightValue', 0, 15);
    updateProgressBar('timingProgress', 'timingValue', 0, 15);

    document.getElementById('armsValue').textContent = '-/40';
    document.getElementById('legsValue').textContent = '-/30';
    document.getElementById('heightValue').textContent = '-/15';
    document.getElementById('timingValue').textContent = '-/15';

    // Hide modal
    document.getElementById('gameOverModal').style.display = 'none';
}

// ============================================================================
// MODAL CONTROLS
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Help modal
    const helpButton = document.getElementById('helpButton');
    const helpModal = document.getElementById('helpModal');
    const closeModal = document.getElementById('closeModal');

    helpButton.addEventListener('click', () => {
        helpModal.style.display = 'block';
    });

    closeModal.addEventListener('click', () => {
        helpModal.style.display = 'none';
    });

    // Restart button
    const restartButton = document.getElementById('restartButton');
    restartButton.addEventListener('click', restartGame);

    // Difficulty toggle
    const difficultyToggle = document.getElementById('difficultyToggle');
    const difficultyText = document.getElementById('difficultyText');

    difficultyToggle.addEventListener('change', (e) => {
        isHardMode = e.target.checked;

        if (isHardMode) {
            difficultyMultiplier = 2.0;
            difficultyText.textContent = 'Hard Mode';
            // Apply hard mode speeds (2x multiplier)
            JUMP_VELOCITY = BASE_JUMP_VELOCITY * difficultyMultiplier;
            ARM_ROTATION_SPEED = BASE_ARM_ROTATION_SPEED * difficultyMultiplier;
            ARM_FALL_SPEED = BASE_ARM_FALL_SPEED * difficultyMultiplier;
            LEG_ROTATION_SPEED = BASE_LEG_ROTATION_SPEED * difficultyMultiplier;
            LEG_RETURN_SPEED = BASE_LEG_RETURN_SPEED * difficultyMultiplier;
        } else {
            difficultyMultiplier = 1.0;
            difficultyText.textContent = 'Easy Mode';
            // Restore easy mode speeds
            JUMP_VELOCITY = BASE_JUMP_VELOCITY;
            ARM_ROTATION_SPEED = BASE_ARM_ROTATION_SPEED;
            ARM_FALL_SPEED = BASE_ARM_FALL_SPEED;
            LEG_ROTATION_SPEED = BASE_LEG_ROTATION_SPEED;
            LEG_RETURN_SPEED = BASE_LEG_RETURN_SPEED;
        }

        // Reset game to jump 0
        restartGame();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'h' || e.key === 'H') {
            if (helpModal.style.display === 'block') {
                helpModal.style.display = 'none';
            } else {
                helpModal.style.display = 'block';
            }
        }

        if (e.key === 'Escape') {
            helpModal.style.display = 'none';
        }

        if (e.key === ' ' && gameState === 'gameOver') {
            restartGame();
        }
    });

    // Click outside modal to close
    window.addEventListener('click', (e) => {
        if (e.target === helpModal) {
            helpModal.style.display = 'none';
        }
    });

    // Initialize Phaser game
    game = new Phaser.Game(config);
});
