// --- START OF FILE script.js ---

"use strict";

// --- Constants ---
const CUBE_SIZE = 1; // Base size of a single cubie
const SPACING = 0.05; // Spacing between cubies
const DEFAULT_CUBE_N = 3; // Default cube size (3x3)
const SHUFFLE_MOVES_FACTOR = 10; // Moves per dimension (e.g., 3x3 -> 30 moves)
const VIBRATION_DURATION = 35; // ms for vibration feedback
const COIN_AWARD_MANUAL_SOLVE = 100; // Coins for solving after shuffle manually

// Colors
const COLORS = {
    white: 0xffffff, yellow: 0xffff00, blue: 0x0000ff, green: 0x00ff00,
    red: 0xff0000, orange: 0xffa500, black: 0x1a1a1a
};

// Simple Bad Word Filter (customize as needed)
const BAD_WORDS = ["fuck", "shit", "cunt", "asshole", "bitch", "piss"]; // Lowercase

// --- Global Variables ---
let scene, camera, renderer, controls;
let cubeGroup;
let cubies = [];
let raycaster, mouse;
let intersectedObject = null, startPoint = null, dragNormal = null;
let isDragging = false, isAnimating = false, isSequenceAnimating = false;
let stopSequenceRequested = false;
let lastScrambleSequence = [];

// Settings & State
let MOVE_DURATION = 200;
let vibrationEnabled = true;
let currentTheme = 'light';
let currentCubeSize = DEFAULT_CUBE_N; // N value (2, 3, or 4)

// User Data
let username = null;
let rubixCoins = 0;
let purchasedItems = {
    'cube_2x2': false, // Example item ID
    'cube_4x4': false
};

// Solve State Tracking
let wasShuffledSinceLastSolve = false;
let manualMoveOccurredAfterShuffle = false;
let isSolved = true; // Cube starts solved


// --- DOM Elements ---
// Buttons
const solveButton = document.getElementById('solve-button');
const shuffleButton = document.getElementById('shuffle-button');
const stopButton = document.getElementById('stop-button');
const settingsButton = document.getElementById('settings-button');
const storeButton = document.getElementById('store-button');
const closeSettingsButton = document.getElementById('close-settings-button');
const closeStoreButton = document.getElementById('close-store-button');
const modalCancelButton = document.getElementById('modal-cancel');
const modalConfirmButton = document.getElementById('modal-confirm');
const saveUsernameButton = document.getElementById('save-username-button');
const deleteAccountButton = document.getElementById('delete-account-button');
const deleteModalCancelButton = document.getElementById('delete-modal-cancel');
const deleteModalConfirmButton = document.getElementById('delete-modal-confirm');

// Panels & Modals
const settingsPanel = document.getElementById('settings-panel');
const storePanel = document.getElementById('store-panel');
const solveModal = document.getElementById('solve-confirm-modal');
const usernameModal = document.getElementById('username-modal');
const deleteConfirmModal = document.getElementById('delete-confirm-modal');
const cubeContainer = document.getElementById('cube-container');

// Displays & Inputs
const speedSlider = document.getElementById('animation-speed-slider');
const speedDisplay = document.getElementById('speed-value-display');
const themeRadios = document.querySelectorAll('input[name="theme"]');
const vibrationToggle = document.getElementById('vibration-toggle');
const usernameInput = document.getElementById('username-input');
const usernameError = document.getElementById('username-error');
const userInfoDisplay = document.getElementById('user-info');
const usernameDisplay = document.getElementById('username-display');
const coinAmountDisplay = document.getElementById('coin-amount');
const currentCubeDisplay = document.getElementById('current-cube-display');
const welcomeUsernameDisplay = document.getElementById('welcome-username');
const solveModalTitle = document.getElementById('solve-modal-title');
const solveModalText = document.getElementById('solve-modal-text');


// --- Initialization ---
function init() {
    loadUserData(); // Load username, coins, purchases, selected cube first
    loadSettings(); // Load theme, speed, vibration

    if (!cubeContainer) {
        console.error("Cube container not found!");
        return;
    }

    // Basic THREE.js setup
    scene = new THREE.Scene();
    const aspect = cubeContainer.clientWidth / cubeContainer.clientHeight;
    camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
    camera.position.set(5, 5, 7); // Initial position, adjust in createCube if needed
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(cubeContainer.clientWidth, cubeContainer.clientHeight);
    renderer.setClearColor(0x000000, 0); // Transparent background
    cubeContainer.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    // Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.screenSpacePanning = false;
    controls.minDistance = 4;
    controls.maxDistance = 30; // Increased max distance slightly
    controls.minPolarAngle = Math.PI / 6;
    controls.maxPolarAngle = Math.PI - (Math.PI / 6);
    controls.rotateSpeed = 0.8;

    // Raycasting for interaction
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    createCube(currentCubeSize); // Create the initial cube based on loaded/default size
    lastScrambleSequence = []; // Ensure scramble sequence is empty initially

    setupUsernameModal(); // Handle username prompt if needed
    setupStorePanel(); // Setup store listeners and initial state
    setupDeleteAccount(); // Setup delete listeners
    addEventListeners(); // Add common listeners
    animate(); // Start the render loop
}

// --- User Data Management ---
function loadUserData() {
    username = localStorage.getItem('rubixUsername');
    rubixCoins = parseInt(localStorage.getItem('rubixCoins') || '0', 10);
    const savedPurchases = localStorage.getItem('rubixPurchases');
    if (savedPurchases) {
        try {
            purchasedItems = JSON.parse(savedPurchases);
            // Ensure default items exist if saved data is old
            if (purchasedItems.cube_2x2 === undefined) purchasedItems.cube_2x2 = false;
            if (purchasedItems.cube_4x4 === undefined) purchasedItems.cube_4x4 = false;
        } catch (e) {
            console.error("Error parsing purchases from localStorage", e);
            // Reset to default if parsing fails
            purchasedItems = { 'cube_2x2': false, 'cube_4x4': false };
            localStorage.setItem('rubixPurchases', JSON.stringify(purchasedItems));
        }
    }
    currentCubeSize = parseInt(localStorage.getItem('rubixSelectedCube') || DEFAULT_CUBE_N.toString(), 10);

    updateUserUIDisplay(); // Update header/welcome message
}

function saveUserData() {
    if (username) localStorage.setItem('rubixUsername', username);
    localStorage.setItem('rubixCoins', rubixCoins.toString());
    localStorage.setItem('rubixPurchases', JSON.stringify(purchasedItems));
    localStorage.setItem('rubixSelectedCube', currentCubeSize.toString());
    // Note: Theme, speed, vibration are saved in their respective handlers
}

function updateUserUIDisplay() {
    if (username) {
        if (userInfoDisplay) userInfoDisplay.style.display = 'flex';
        if (usernameDisplay) usernameDisplay.textContent = username;
        if (coinAmountDisplay) coinAmountDisplay.textContent = rubixCoins;
        if (currentCubeDisplay) currentCubeDisplay.textContent = `(${currentCubeSize}x${currentCubeSize})`;
        if (welcomeUsernameDisplay) welcomeUsernameDisplay.textContent = ` Welcome, ${username}!`;
    } else {
        if (userInfoDisplay) userInfoDisplay.style.display = 'none';
        if (welcomeUsernameDisplay) welcomeUsernameDisplay.textContent = ''; // Clear welcome message if no user
    }
}

function updateCoinDisplay() {
    if (coinAmountDisplay) coinAmountDisplay.textContent = rubixCoins;
    // Also update store button availability if the store panel is open
    if (storePanel && storePanel.classList.contains('active')) {
        updateStoreUI();
    }
}

function awardCoins(amount) {
    if (!username) return; // Don't award coins if not logged in
    rubixCoins += amount;
    console.log(`Awarded ${amount} Rubix Coins! New balance: ${rubixCoins}`);
    updateCoinDisplay();
    saveUserData(); // Save new coin amount
    // Add visual feedback here if desired (e.g., toast message)
}

// --- Settings Management ---
function loadSettings() {
    // Animation Speed
    const savedSpeed = localStorage.getItem('rubiksAnimationSpeed');
    MOVE_DURATION = savedSpeed ? parseInt(savedSpeed, 10) : 200;
    if (speedSlider) speedSlider.value = MOVE_DURATION;
    if (speedDisplay) speedDisplay.textContent = `${MOVE_DURATION}ms`;

    // Theme
    const savedTheme = localStorage.getItem('rubiksTheme');
    currentTheme = savedTheme || 'light'; // Use loaded theme or default to light
    applyTheme(currentTheme);
    const themeRadio = document.querySelector(`input[name="theme"][value="${currentTheme}"]`);
    if (themeRadio) themeRadio.checked = true;

    // Vibration
    const savedVibration = localStorage.getItem('rubiksVibrationEnabled');
    vibrationEnabled = (savedVibration === null) ? true : (savedVibration === 'true');
    if (vibrationToggle) vibrationToggle.checked = vibrationEnabled;
}

function handleSpeedChange(event) {
    MOVE_DURATION = parseInt(event.target.value, 10);
    if (speedDisplay) speedDisplay.textContent = `${MOVE_DURATION}ms`;
    localStorage.setItem('rubiksAnimationSpeed', MOVE_DURATION);
}

function handleThemeChange(event) {
    currentTheme = event.target.value;
    applyTheme(currentTheme);
    localStorage.setItem('rubiksTheme', currentTheme);
}

function applyTheme(themeName) {
    document.body.classList.toggle('dark-theme', themeName === 'dark');
}

function handleVibrationChange(event) {
    vibrationEnabled = event.target.checked;
    localStorage.setItem('rubiksVibrationEnabled', vibrationEnabled);
    if (vibrationEnabled) vibrate(VIBRATION_DURATION / 2);
}

function vibrate(duration) {
    if (vibrationEnabled && navigator.vibrate) {
        try {
            navigator.vibrate(duration);
        } catch (e) {
            console.warn("Vibration failed:", e);
            // Vibration might be blocked by browser settings or unsupported
            // You could potentially disable the toggle if vibration fails consistently
            // For now, just log the warning.
        }
    }
}

function toggleSettingsPanel() {
    if (storePanel && storePanel.classList.contains('active')) {
        toggleStorePanel(); // Close store if open
    }
    if (settingsPanel) settingsPanel.classList.toggle('active');
}

// --- Username Modal ---
function setupUsernameModal() {
    if (username) {
        if (usernameModal) usernameModal.classList.remove('initial-modal', 'active'); // Hide if user exists
        updateUserUIDisplay();
    } else {
        if (usernameModal) usernameModal.classList.add('active'); // Show if no user
        if (saveUsernameButton) saveUsernameButton.addEventListener('click', handleUsernameSave);
        if (usernameInput) usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleUsernameSave();
        });
    }
}

function handleUsernameSave() {
    if (!usernameInput || !usernameError) return;
    const enteredUsername = usernameInput.value.trim();

    // Validation
    usernameError.textContent = ''; // Clear previous errors
    usernameError.style.display = 'none';

    if (!enteredUsername) {
        usernameError.textContent = 'Username cannot be empty.';
        usernameError.style.display = 'block';
        return;
    }
    if (enteredUsername.length > 16) {
        // Input should enforce maxlength, but double-check
        usernameError.textContent = 'Username cannot exceed 16 characters.';
        usernameError.style.display = 'block';
        return;
    }
    // Basic Bad Word Check (case-insensitive)
    if (BAD_WORDS.some(word => enteredUsername.toLowerCase().includes(word))) {
         usernameError.textContent = 'Please choose a different username.';
         usernameError.style.display = 'block';
         return;
    }

    // Save username
    username = enteredUsername;
    saveUserData(); // Save the new username
    if (usernameModal) usernameModal.classList.remove('active', 'initial-modal');
    updateUserUIDisplay(); // Update header etc.
    console.log("Username saved:", username);

    // Maybe re-initialize parts of the UI that depend on the username
    updateStoreUI(); // Update store button states now that user/coins exist
}

// --- Store Panel ---
function toggleStorePanel() {
    if (settingsPanel && settingsPanel.classList.contains('active')) {
        toggleSettingsPanel(); // Close settings if open
    }
    if (storePanel) {
        storePanel.classList.toggle('active');
        if (storePanel.classList.contains('active')) {
            updateStoreUI(); // Refresh store state when opened
        }
    }
}

function setupStorePanel() {
    if (storeButton) storeButton.addEventListener('click', toggleStorePanel);
    if (closeStoreButton) closeStoreButton.addEventListener('click', toggleStorePanel);

    // Add event listeners for Buy/Use buttons (using event delegation)
    if (storePanel) {
        storePanel.addEventListener('click', (event) => {
            const target = event.target;
            if (target.classList.contains('buy-button')) {
                handleBuyItem(target.dataset.itemId, parseInt(target.dataset.price, 10));
            } else if (target.classList.contains('use-button')) {
                handleUseItem(parseInt(target.dataset.cubeSize, 10));
            }
        });
    }
}

function updateStoreUI() {
    if (!storePanel) return;

    const storeItems = storePanel.querySelectorAll('.store-item[data-item-id]');

    storeItems.forEach(item => {
        const itemId = item.dataset.itemId;
        const isOwned = purchasedItems[itemId];
        const price = parseInt(item.querySelector('.buy-button')?.dataset.price || '0', 10);

        const buyButton = item.querySelector('.buy-button');
        const useButton = item.querySelector('.use-button');
        const ownedStatus = item.querySelector('.item-status.owned');
        const priceDisplay = item.querySelector('.item-price'); // Keep price visible

        if (buyButton) {
            buyButton.style.display = isOwned ? 'none' : 'inline-flex';
            buyButton.disabled = (!username || rubixCoins < price); // Disable if not logged in or not enough coins
        }
        if (useButton) {
            const cubeSize = parseInt(useButton.dataset.cubeSize, 10);
            useButton.style.display = isOwned ? 'inline-flex' : 'none';
            useButton.disabled = (cubeSize === currentCubeSize); // Disable if already selected
            useButton.textContent = (cubeSize === currentCubeSize) ? 'Selected' : 'Use';
        }
        if (ownedStatus) {
            ownedStatus.style.display = isOwned ? 'inline-block' : 'none';
        }
    });

    // Update the default 3x3 'Use' button state
    const defaultUseButton = storePanel.querySelector('.use-button[data-cube-size="3"]');
    if (defaultUseButton) {
        defaultUseButton.disabled = (currentCubeSize === 3);
        defaultUseButton.textContent = (currentCubeSize === 3) ? 'Selected' : 'Use';
    }
}


function handleBuyItem(itemId, price) {
    if (!username) {
        console.warn("Cannot buy item: No user logged in.");
        // Maybe show a message prompting login?
        return;
    }
    if (purchasedItems[itemId]) {
        console.warn("Item already purchased:", itemId);
        return;
    }
    if (rubixCoins >= price) {
        rubixCoins -= price;
        purchasedItems[itemId] = true;
        console.log(`Purchased ${itemId} for ${price} coins. Balance: ${rubixCoins}`);
        awardCoins(0); // Just to update display and save
        updateStoreUI(); // Update buttons immediately
        saveUserData(); // Persist purchases
    } else {
        console.log("Not enough coins to buy:", itemId);
        // Optionally show a message to the user
    }
}

function handleUseItem(newSize) {
    if (newSize === currentCubeSize) return; // Do nothing if already selected

    // Check if the selected size is owned (default 3x3 is always owned)
    let isOwned = true;
    if (newSize === 2 && !purchasedItems['cube_2x2']) isOwned = false;
    if (newSize === 4 && !purchasedItems['cube_4x4']) isOwned = false;

    if (!isOwned) {
        console.error(`Cannot use ${newSize}x${newSize} cube: Not owned.`);
        return;
    }

    console.log("Switching cube size to:", newSize);
    switchCubeSize(newSize);
    updateStoreUI(); // Update button states in the store
    // Optionally close the store panel after selection
    // toggleStorePanel();
}

function switchCubeSize(newSize) {
    if (isAnimating || isSequenceAnimating) {
        console.warn("Cannot switch cube size during animation.");
        return;
    }
    currentCubeSize = newSize;
    if (currentCubeDisplay) currentCubeDisplay.textContent = `(${currentCubeSize}x${currentCubeSize})`;
    saveUserData(); // Save the new selection
    createCube(currentCubeSize); // Recreate the cube with the new size
    lastScrambleSequence = []; // Clear scramble history for the new cube size
    resetSolveStateFlags(); // Reset flags for the new cube
}


// --- Delete Account ---
function setupDeleteAccount() {
    if (deleteAccountButton) deleteAccountButton.addEventListener('click', showDeleteConfirmation);
    if (deleteModalCancelButton) deleteModalCancelButton.addEventListener('click', hideDeleteConfirmation);
    if (deleteModalConfirmButton) deleteModalConfirmButton.addEventListener('click', handleDeleteAccountConfirm);
}

function showDeleteConfirmation() {
    if (deleteConfirmModal) deleteConfirmModal.classList.add('active');
}

function hideDeleteConfirmation() {
     if (deleteConfirmModal) deleteConfirmModal.classList.remove('active');
}

function handleDeleteAccountConfirm() {
    console.log("Deleting account data...");
    // Clear all relevant localStorage items
    localStorage.removeItem('rubixUsername');
    localStorage.removeItem('rubixCoins');
    localStorage.removeItem('rubixPurchases');
    localStorage.removeItem('rubixSelectedCube');
    // Keep theme/speed/vibration? Optional, let's clear them too for a full reset.
    localStorage.removeItem('rubiksTheme');
    localStorage.removeItem('rubiksAnimationSpeed');
    localStorage.removeItem('rubiksVibrationEnabled');

    // Reload the page to force username prompt and reset state
    location.reload();
}


// --- Cube Creation & Logic ---
function createCube(N) { // N is the size (e.g., 3 for 3x3)
    if (isAnimating || isSequenceAnimating) {
        console.warn("Cannot create cube during animation.");
        return;
    }

    // Clear previous cube
    if (cubeGroup) scene.remove(cubeGroup);
    cubeGroup = new THREE.Group();
    cubies = []; // Clear the array of cubies

    const offset = (N - 1) / 2.0; // Centering offset
    const cubieSize = CUBE_SIZE; // Maintain base cubie size
    const totalSpacing = SPACING * (N - 1);
    const totalCubeSize = N * cubieSize + totalSpacing;

    // Adjust camera distance based on cube size for better framing
    const cameraDistance = N * 2.0 + 3.0; // Simple heuristic
    camera.position.set(cameraDistance, cameraDistance * 0.8, cameraDistance * 1.2);
    camera.lookAt(0, 0, 0);
    if (controls) {
        controls.minDistance = N + 1; // Adjust min distance
        controls.maxDistance = N * 10; // Adjust max distance
        controls.update();
    }


    const geometry = new THREE.BoxGeometry(cubieSize, cubieSize, cubieSize);

    for (let x = 0; x < N; x++) {
        for (let y = 0; y < N; y++) {
            for (let z = 0; z < N; z++) {
                // Skip inner cubies that are never visible
                if (N > 2 && x > 0 && x < N - 1 && y > 0 && y < N - 1 && z > 0 && z < N - 1) continue;

                // Determine face colors (only show colors on outer faces)
                 const materials = [
                    new THREE.MeshStandardMaterial({ color: x === N - 1 ? COLORS.orange : COLORS.black, roughness: 0.7, metalness: 0.1 }), // Right (+X)
                    new THREE.MeshStandardMaterial({ color: x === 0     ? COLORS.red    : COLORS.black, roughness: 0.7, metalness: 0.1 }), // Left (-X)
                    new THREE.MeshStandardMaterial({ color: y === N - 1 ? COLORS.yellow : COLORS.black, roughness: 0.7, metalness: 0.1 }), // Top (+Y)
                    new THREE.MeshStandardMaterial({ color: y === 0     ? COLORS.white  : COLORS.black, roughness: 0.7, metalness: 0.1 }), // Bottom (-Y)
                    new THREE.MeshStandardMaterial({ color: z === N - 1 ? COLORS.blue   : COLORS.black, roughness: 0.7, metalness: 0.1 }), // Front (+Z)
                    new THREE.MeshStandardMaterial({ color: z === 0     ? COLORS.green  : COLORS.black, roughness: 0.7, metalness: 0.1 })  // Back (-Z)
                ];

                const cubie = new THREE.Mesh(geometry, materials);
                cubie.position.set(
                    (x - offset) * (cubieSize + SPACING),
                    (y - offset) * (cubieSize + SPACING),
                    (z - offset) * (cubieSize + SPACING)
                );
                // Store initial logical position AND current logical position
                // Initial is needed for checkIfSolved
                cubie.userData.initialLogicalPosition = new THREE.Vector3(x, y, z);
                cubie.userData.logicalPosition = new THREE.Vector3(x, y, z); // Current position starts as initial

                cubeGroup.add(cubie);
                cubies.push(cubie);
            }
        }
    }
    scene.add(cubeGroup);
    resetSolveStateFlags(); // Reset flags when a new cube is created/reset
    isSolved = true; // A newly created cube is solved
    console.log(`Created ${N}x${N} cube.`);
}

// Reset flags related to solving state
function resetSolveStateFlags() {
    wasShuffledSinceLastSolve = false;
    manualMoveOccurredAfterShuffle = false;
    isSolved = false; // Assume not solved until checked or created
}

// Check if the cube is currently in the solved state
function checkIfSolved() {
    if (cubies.length === 0) return false; // No cube exists

    for (const cubie of cubies) {
        // Check if the current logical position matches the initial one
        if (!cubie.userData.logicalPosition.equals(cubie.userData.initialLogicalPosition)) {
           // console.log("Cubie mismatch found:", cubie.userData.logicalPosition, cubie.userData.initialLogicalPosition); // DEBUG
           isSolved = false;
           return false; // Found a misplaced cubie
        }
    }

    // If loop completes, all cubies are in their initial logical positions
    // isSolved = true; // Don't set here, set just before check

    // --- Check flags ONLY if the loop completed (cube is solved) ---
    console.log("Cube is SOLVED!");
    isSolved = true; // Now set the flag

    // *** ADDED DIAGNOSTIC LOG ***
    console.log(`checkIfSolved: Detected SOLVED state. Flags - wasShuffled: ${wasShuffledSinceLastSolve}, manualMove: ${manualMoveOccurredAfterShuffle}`);

    // Check if conditions met for coin award
    if (wasShuffledSinceLastSolve && manualMoveOccurredAfterShuffle) {
        console.log("Manual solve detected after shuffle! Awarding coins.");
        awardCoins(COIN_AWARD_MANUAL_SOLVE);
        // Reset flags after awarding coins to prevent awarding again immediately
        wasShuffledSinceLastSolve = false;
        manualMoveOccurredAfterShuffle = false;
    } else if (isSolved) {
        // If it's solved, but conditions not met (e.g., not shuffled first, or auto-solved)
        // ensure flags are reset anyway so the state is clean.
        // But don't reset if it was *just* awarded above.
        if (!(wasShuffledSinceLastSolve && manualMoveOccurredAfterShuffle)) { // Check if it wasn't just awarded
             // console.log("Cube solved, but coin conditions not met. Resetting flags if needed.");
             // wasShuffledSinceLastSolve = false; // Let flags persist until next shuffle/reset? Maybe. Let's keep this reset for now.
             // manualMoveOccurredAfterShuffle = false;
             // Reconsider: If solved manually *without* shuffling first, flags should naturally be false.
             // If solved via auto-solve, applyMovesAnimated handles the reset.
             // Let's only reset the flags *after* awarding.
        }
    }

    return true;
}



// --- Interaction & Rotation ---
function getIntersect(event) {
    if (!renderer || !raycaster || !camera || isAnimating || isSequenceAnimating) return null;

    const bounds = renderer.domElement.getBoundingClientRect();
    // Adjust mouse coordinates calculation if necessary based on touch vs mouse event
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;

    mouse.x = ((clientX - bounds.left) / bounds.width) * 2 - 1;
    mouse.y = -((clientY - bounds.top) / bounds.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(cubies, true); // Intersect cubies recursively

    if (intersects.length > 0) {
        const intersection = intersects[0];
        // Only allow interaction with non-black faces
        const faceMaterialIndex = intersection.face.materialIndex;
        if (intersection.object.material[faceMaterialIndex].color.getHex() !== COLORS.black) {
            return intersection;
        }
    }
    return null;
}


function onPointerDown(event) {
     // Prevent default touch behavior like scrolling
    if (event.pointerType === 'touch') {
       // event.preventDefault(); // Be careful with preventDefault, might break OrbitControls panning? Test this.
    }

    if (isAnimating || isSequenceAnimating || event.button !== 0) return; // Only allow primary button clicks

    const intersection = getIntersect(event);
    if (intersection) {
        isDragging = true;
        if (controls) controls.enabled = false; // Disable camera control during drag
        intersectedObject = intersection.object;
        startPoint = intersection.point.clone(); // Point in world space where drag started
        // Get the normal of the face clicked, in world space
        dragNormal = intersection.face.normal.clone();
        dragNormal.transformDirection(intersectedObject.matrixWorld).round();

        if (renderer.domElement) renderer.domElement.style.cursor = 'grabbing';
    } else {
        isDragging = false;
        if (renderer.domElement) renderer.domElement.style.cursor = 'grab'; // Or 'default' if preferred
    }
}

function onPointerMove(event) {
    // Update cursor style on hover even if not dragging
    if (!isDragging && renderer.domElement) {
         const intersection = getIntersect(event);
         renderer.domElement.style.cursor = intersection ? 'grab' : 'default';
    }

    // No need to do anything else here if not dragging
    // Drag calculation happens in onPointerUp
}


function onPointerUp(event) {
    if (renderer.domElement) {
        renderer.domElement.style.cursor = getIntersect(event) ? 'grab' : 'default'; // Reset cursor based on current hover
    }

    if (!isDragging || !startPoint || isAnimating || isSequenceAnimating || event.button !== 0) {
        if (isDragging && controls) controls.enabled = true; // Re-enable controls if drag started but wasn't valid
        resetDragState();
        return;
    }

    isDragging = false; // Set dragging false

    const bounds = renderer.domElement.getBoundingClientRect();
    // Use changedTouches for touch end, or clientX/Y for mouse up
    const clientX = event.changedTouches ? event.changedTouches[0].clientX : event.clientX;
    const clientY = event.changedTouches ? event.changedTouches[0].clientY : event.clientY;

    const endMouse = new THREE.Vector2(
        ((clientX - bounds.left) / bounds.width) * 2 - 1,
        -((clientY - bounds.top) / bounds.height) * 2 + 1
    );
    const startScreen = startPoint.clone().project(camera); // Project world start point to screen
    const dragVector = endMouse.clone().sub(startScreen); // Vector of the drag in screen space

    // Increase threshold slightly maybe? Test sensitivity.
    if (dragVector.lengthSq() < 0.0025) { // Check if drag was significant enough
        if (controls) controls.enabled = true;
        resetDragState();
        return;
    }

    // Determine the rotation based on drag
    const rotation = determineRotation(dragNormal, dragVector);

    if (rotation) {
        // First manual move after shuffle clears the automatic solve sequence
        // AND sets the flag that a manual move occurred.
        if (wasShuffledSinceLastSolve && !manualMoveOccurredAfterShuffle) {
            console.log("First manual move detected after shuffle. Setting flag and clearing auto-solve sequence.");
            lastScrambleSequence = []; // Clear potential auto-solve
            manualMoveOccurredAfterShuffle = true; // Mark that a manual move has occurred
        } else if (!wasShuffledSinceLastSolve) {
            // If a manual move occurs *before* any shuffle, ensure manual flag is set
            // (though it doesn't matter for coins until *after* a shuffle)
             manualMoveOccurredAfterShuffle = true;
        }
         // If wasShuffledSinceLastSolve is true AND manualMoveOccurredAfterShuffle is already true,
         // just proceed with the move.

        rotateLayer(rotation.axis, rotation.layer, rotation.angle)
            .then(() => { if (controls) controls.enabled = true; }) // Re-enable controls after animation
            .catch(() => { if (controls) controls.enabled = true; }); // Also re-enable on error/rejection
    } else {
        // If no valid rotation determined, re-enable controls
        if (controls) controls.enabled = true;
    }

    resetDragState(); // Clear dragging state variables
}


function resetDragState() {
    intersectedObject = null;
    startPoint = null;
    dragNormal = null;
    isDragging = false;
    // Cursor is reset in onPointerMove/Up based on hover
}

function onWindowResize() {
    if (!camera || !renderer || !cubeContainer) return;
    camera.aspect = cubeContainer.clientWidth / cubeContainer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(cubeContainer.clientWidth, cubeContainer.clientHeight);
}

// Determine the axis, layer, and angle from the drag gesture
function determineRotation(faceNormal, dragVectorScreen) {
    if (!camera || !intersectedObject || !startPoint) return null;

    // Calculate camera-relative right and up vectors on the clicked face
    // Using camera's world up vector might be more stable than camera.up
    const cameraWorldUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    let rightDir = new THREE.Vector3().crossVectors(cameraWorldUp, faceNormal).normalize();
    // If faceNormal is parallel to world up (top/bottom faces), use camera's right vector instead
    if (rightDir.lengthSq() < 0.1) {
        rightDir.set(1,0,0).applyQuaternion(camera.quaternion);
    }
    const upDir = new THREE.Vector3().crossVectors(faceNormal, rightDir).normalize();

    // Project these directions to screen space to compare with drag vector
    const startPointWorld = startPoint.clone();
    const rightPointWorld = startPointWorld.clone().add(rightDir);
    const upPointWorld = startPointWorld.clone().add(upDir);

    const startPointScreen = startPointWorld.project(camera);
    const rightPointScreen = rightPointWorld.project(camera);
    const upPointScreen = upPointWorld.project(camera);

    const rightScreenVec = new THREE.Vector2().subVectors(rightPointScreen, startPointScreen).normalize();
    const upScreenVec = new THREE.Vector2().subVectors(upPointScreen, startPointScreen).normalize();

    // Determine dominant drag direction
    const dotRight = dragVectorScreen.dot(rightScreenVec);
    const dotUp = dragVectorScreen.dot(upScreenVec);

    let rotationAxis = new THREE.Vector3();
    let rotationSign = 1;

    if (Math.abs(dotRight) > Math.abs(dotUp)) { // Dragged more horizontally (relative to face)
        rotationAxis.copy(upDir); // Rotate around the face's up vector
        rotationSign = Math.sign(dotRight);
    } else { // Dragged more vertically
        rotationAxis.copy(rightDir); // Rotate around the face's right vector
        rotationSign = -Math.sign(dotUp); // Invert sign for up/down drag relative to face
    }

    // Snap the rotation axis to the nearest world axis (X, Y, Z)
    rotationAxis.x = Math.abs(rotationAxis.x) > 0.7 ? Math.sign(rotationAxis.x) : 0;
    rotationAxis.y = Math.abs(rotationAxis.y) > 0.7 ? Math.sign(rotationAxis.y) : 0;
    rotationAxis.z = Math.abs(rotationAxis.z) > 0.7 ? Math.sign(rotationAxis.z) : 0;
    rotationAxis.normalize(); // Ensure it's a unit vector

    if (rotationAxis.lengthSq() < 0.5) return null; // Invalid axis determined

    // Determine layer index based on the clicked cubie's position and the rotation axis
    const logicalPos = intersectedObject.userData.logicalPosition;
    let layerIndex = 0;
    if (Math.abs(rotationAxis.x) > 0.5) layerIndex = Math.round(logicalPos.x);
    else if (Math.abs(rotationAxis.y) > 0.5) layerIndex = Math.round(logicalPos.y);
    else if (Math.abs(rotationAxis.z) > 0.5) layerIndex = Math.round(logicalPos.z);

    const angle = rotationSign * Math.PI / 2;

    // --- DEBUGGING ---
    // console.log("Face Normal:", faceNormal.toArray().map(n => n.toFixed(1)));
    // console.log("Drag Vector (Screen):", dragVectorScreen.toArray().map(n => n.toFixed(2)));
    // console.log("Rotation Axis (World):", rotationAxis.toArray().map(n => n.toFixed(1)));
    // console.log("Layer Index:", layerIndex);
    // console.log("Angle:", (angle * 180 / Math.PI).toFixed(0));
    // --- /DEBUGGING ---

    return { axis: rotationAxis, layer: layerIndex, angle: angle };
}


function rotateLayer(axis, layerIndex, angle) {
    return new Promise((resolve, reject) => {
        if (isAnimating) {
            reject("Animation in progress");
            return;
        }
        isAnimating = true;
        isSolved = false; // Any rotation makes the cube potentially unsolved (until checked)

        const pivot = new THREE.Group();
        scene.add(pivot);
        const layerCubies = [];
        // Use a small tolerance for comparing positions due to float inaccuracies
        const tolerance = 0.1;
        const N = currentCubeSize; // Use current cube size
        const offset = (N - 1) / 2.0; // Define offset here for logical update later

        cubies.forEach(cubie => {
            const pos = cubie.userData.logicalPosition;
            let belongsToLayer = false;
            if (Math.abs(axis.x) > 0.5 && Math.abs(pos.x - layerIndex) < tolerance) belongsToLayer = true;
            else if (Math.abs(axis.y) > 0.5 && Math.abs(pos.y - layerIndex) < tolerance) belongsToLayer = true;
            else if (Math.abs(axis.z) > 0.5 && Math.abs(pos.z - layerIndex) < tolerance) belongsToLayer = true;

            if (belongsToLayer) {
                // Convert world position to be relative to the pivot before attaching
                //pivot.worldToLocal(cubie.position); // This might not be needed if pivot is at origin
                pivot.attach(cubie); // Attach cubie to pivot, preserving world transform
                layerCubies.push(cubie);
            }
        });

        if (layerCubies.length === 0) {
            console.warn("No cubies found for rotation:", axis.toArray(), layerIndex);
            isAnimating = false;
            scene.remove(pivot);
            resolve();
            return;
        }

        const startQuaternion = pivot.quaternion.clone();
        const endQuaternion = new THREE.Quaternion().setFromAxisAngle(axis, angle).multiply(startQuaternion);
        const startTime = performance.now();

        // Logical rotation matrix (applied after animation)
        const rotationMatrix = new THREE.Matrix4().makeRotationAxis(axis, angle);
        //const offset = (N - 1) / 2.0; // Moved definition up

        function animateRotation() {
            const elapsedTime = performance.now() - startTime;
            const fraction = Math.min(elapsedTime / MOVE_DURATION, 1);
            // Ease in-out cubic easing function
            const easedFraction = fraction < 0.5 ? 4 * fraction * fraction * fraction : 1 - Math.pow(-2 * fraction + 2, 3) / 2;

            // Interpolate quaternion for smooth rotation
            pivot.quaternion.slerpQuaternions(startQuaternion, endQuaternion, easedFraction);

            if (fraction < 1) {
                requestAnimationFrame(animateRotation);
            } else {
                // --- Finalization ---
                pivot.quaternion.copy(endQuaternion); // Ensure exact final state

                // Detach cubies and update logical positions
                layerCubies.forEach(cubie => {
                    // Update world matrix before detaching
                    cubie.updateMatrixWorld();
                    // Reattach to main cube group, preserving world transform
                    cubeGroup.attach(cubie);

                    // -------- START: FIX FOR LOGICAL POSITION UPDATE --------
                    // Create a temporary vector for calculation
                    const currentLogicalPos = cubie.userData.logicalPosition;
                    const newLogicalPos = currentLogicalPos.clone();

                    // 1. Translate to center origin
                    newLogicalPos.subScalar(offset);
                    // 2. Apply the rotation matrix
                    newLogicalPos.applyMatrix4(rotationMatrix);
                    // 3. Translate back from center origin
                    newLogicalPos.addScalar(offset);
                    // 4. Round the FINAL result to snap to the integer grid
                    newLogicalPos.round();

                    // 5. Update the cubie's logical position
                    currentLogicalPos.copy(newLogicalPos);
                    // -------- END: FIX FOR LOGICAL POSITION UPDATE --------
                });

                scene.remove(pivot); // Clean up the pivot group
                isAnimating = false;
                vibrate(VIBRATION_DURATION); // Haptic feedback

                // Check if solved ONLY after the animation completes
                checkIfSolved(); // <<< THIS IS THE CRITICAL CALL

                resolve(); // Resolve the promise
            }
        }
        animateRotation(); // Start the animation loop
    });
}


// --- Shuffle & Solve ---
async function applyMovesAnimated(moves, isSolving = false) {
    if (isSequenceAnimating) return;
    isSequenceAnimating = true;
    stopSequenceRequested = false;
    setButtonsEnabled(false); // Disable main buttons during sequence

    if (stopButton) {
        stopButton.style.display = 'inline-flex';
        stopButton.disabled = false;
        stopButton.title = "Stop Animation";
    }
    // Close side panels if open
    if (settingsPanel && settingsPanel.classList.contains('active')) toggleSettingsPanel();
    if (storePanel && storePanel.classList.contains('active')) toggleStorePanel();

    try {
        for (const move of moves) {
            if (stopSequenceRequested) {
                console.log("Animation sequence stopped by user.");
                break;
            }
            await rotateLayer(move.axis, move.layerIndex, move.angle);
        }
    } catch (error) {
        console.error("Error during move sequence:", error);
        // Consider how to handle errors - maybe try to reset the cube?
    } finally {
        // Cleanup happens here
        isSequenceAnimating = false;
        stopSequenceRequested = false;
        setButtonsEnabled(true); // Re-enable buttons
        if (stopButton) stopButton.style.display = 'none';

        // If we just finished solving automatically, ensure state is correct
        if (isSolving) {
           isSolved = true; // Mark as solved after auto-solve finishes
           wasShuffledSinceLastSolve = false; // Reset shuffle flag
           manualMoveOccurredAfterShuffle = false; // Reset manual move flag
           lastScrambleSequence = []; // Clear sequence after solving it
           console.log("Automatic solve finished. Flags reset.");
        }
         // If we finished shuffling, update state
         else if (!isSolving && moves.length > 0 && !stopSequenceRequested) { // Check moves.length > 0 and not stopped early
             wasShuffledSinceLastSolve = true; // Set shuffle flag
             manualMoveOccurredAfterShuffle = false; // Ensure manual flag is false after shuffle
             isSolved = false; // Mark as unsolved after shuffling
             console.log("Shuffle finished. Flags set: wasShuffled=true, manualMove=false");
         } else if (stopSequenceRequested) {
             // If sequence was stopped, check the state but don't assume flags
             console.log("Animation stopped. Checking current solve state.");
             checkIfSolved(); // Check if stopping solved it accidentally / left it solved
         }


        // Final check if solved (might be solved if stopped early, or if shuffle was short)
        // checkIfSolved(); // This check is now redundant as it happens in rotateLayer or above checks
        console.log("Move sequence finished or stopped.");
    }
}

function setButtonsEnabled(enabled) {
    if (solveButton) solveButton.disabled = !enabled;
    if (shuffleButton) shuffleButton.disabled = !enabled;
    if (settingsButton) settingsButton.disabled = !enabled;
    if (storeButton) storeButton.disabled = !enabled; // Also disable store button during animation
    // Stop button state is managed separately
}

function showSolveConfirmation() {
    if (isSequenceAnimating || isAnimating || !solveModal) return;

    // Update modal text based on whether a reversible sequence exists AND no manual moves occurred
    if (lastScrambleSequence.length > 0 && !manualMoveOccurredAfterShuffle) { // Added !manualMove check
        if (solveModalTitle) solveModalTitle.textContent = "Solve Cube?";
        if (solveModalText) solveModalText.textContent = `This will animate the cube back to the state before the last ${lastScrambleSequence.length}-move shuffle.`;
        if (modalConfirmButton) modalConfirmButton.textContent = "Solve!";
    } else {
        if (solveModalTitle) solveModalTitle.textContent = "Reset Cube?";
        if (solveModalText) solveModalText.textContent = isSolved ? "The cube is already solved. Reset anyway?" : "Cannot auto-solve after manual moves or without a shuffle history. Reset to solved state?";
        if (modalConfirmButton) modalConfirmButton.textContent = "Reset";
    }
    solveModal.classList.add('active');
}


function hideSolveConfirmation() {
    if (solveModal) solveModal.classList.remove('active');
}

function requestStopSequence() {
    if (isSequenceAnimating && stopButton) {
        stopSequenceRequested = true;
        stopButton.disabled = true; // Disable stop button immediately
        stopButton.title = "Stopping...";
        console.log("Stop requested...");
    }
}

// Handles the confirmation click from the solve/reset modal
async function handleSolveConfirm() {
    hideSolveConfirmation();
    if (isAnimating || isSequenceAnimating) return;

    // Allow auto-solve only if there's a sequence AND no manual moves happened since shuffle
    if (lastScrambleSequence.length > 0 && !manualMoveOccurredAfterShuffle) {
        // Solve by reversing the last recorded scramble sequence
        console.log("Solving Cube by reversing last scramble...");
        const solveSequence = lastScrambleSequence.map(move => ({
            axis: move.axis,
            layerIndex: move.layerIndex,
            angle: -move.angle // Reverse angle
        })).reverse(); // Reverse sequence order

        // applyMovesAnimated (with isSolving=true) will clear lastScrambleSequence
        // and reset flags in its finally block.
        await applyMovesAnimated(solveSequence, true); // Pass true for isSolving flag
        console.log("Automatic solve animation finished.");

    } else {
        // No sequence to reverse, or manual moves invalidated it. Just reset the cube.
        if (lastScrambleSequence.length > 0 && manualMoveOccurredAfterShuffle) {
             console.log("Resetting cube: Auto-solve sequence invalidated by manual moves.");
        } else {
             console.log("Resetting cube to solved state...");
        }
        createCube(currentCubeSize); // Instantly reset
        // Ensure flags are correct after reset (createCube calls resetSolveStateFlags and sets isSolved=true)
        lastScrambleSequence = []; // Ensure sequence is clear
        console.log("Cube reset to solved state.");
    }
}


function shuffleCubeAnimated() {
    if (isAnimating || isSequenceAnimating) return;
    console.log(`Shuffling ${currentCubeSize}x${currentCubeSize} Cube Animated...`);
    resetSolveStateFlags(); // Reset flags before shuffling (sets wasShuffled=false, manualMove=false)

    const N = currentCubeSize;
    const moves = [];
    const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
    const angles = [Math.PI / 2, -Math.PI / 2];
    let lastAxisIndex = -1; // Track index to prevent immediate same-axis moves
    let lastLayer = -1;
    const numMoves = N * SHUFFLE_MOVES_FACTOR; // Adjust shuffle length based on size

    for (let i = 0; i < numMoves; i++) {
        let axisIndex, axis, layerIndex, angle;
        do {
           axisIndex = Math.floor(Math.random() * 3);
           axis = axes[axisIndex];
           // Layer index from 0 to N-1
           layerIndex = Math.floor(Math.random() * N);
           angle = angles[Math.floor(Math.random() * 2)];
           // Avoid immediate move repetition (e.g., R R') or same layer on same axis (e.g. R R)
           // This simple check isn't perfect but prevents trivial non-scrambling moves.
        } while (axisIndex === lastAxisIndex && layerIndex === lastLayer);

        moves.push({ axis, layerIndex, angle });
        lastAxisIndex = axisIndex;
        lastLayer = layerIndex;
    }

    lastScrambleSequence = [...moves]; // Store the sequence for potential solve
    console.log(`Generated ${lastScrambleSequence.length} shuffle moves.`);
    // applyMovesAnimated will set wasShuffledSinceLastSolve = true and manualMove..=false in its finally block
    applyMovesAnimated(moves, false); // Pass false for isSolving flag
}


// --- Event Listeners ---
function addEventListeners() {
    // Pointer events for cube interaction
    if (renderer && renderer.domElement) {
        renderer.domElement.addEventListener('pointerdown', onPointerDown);
        renderer.domElement.addEventListener('pointermove', onPointerMove);
        renderer.domElement.addEventListener('pointerup', onPointerUp);
        renderer.domElement.addEventListener('pointerleave', () => { // Reset cursor when leaving canvas
            if (!isDragging && renderer.domElement) renderer.domElement.style.cursor = 'default';
            // We might also want to cancel drag if pointer leaves?
            if (isDragging) {
                 if (controls) controls.enabled = true;
                 resetDragState();
                 console.log("Drag cancelled due to pointer leaving canvas.");
            }
        });
         // Add touch event listeners as well for broader compatibility
        renderer.domElement.addEventListener('touchstart', (e) => { onPointerDown(e); }, { passive: false }); // passive:false MAY be needed for preventDefault, test
        renderer.domElement.addEventListener('touchmove', (e) => { onPointerMove(e); }, { passive: false });
        renderer.domElement.addEventListener('touchend', (e) => { onPointerUp(e); });
        renderer.domElement.addEventListener('touchcancel', (e) => { // Handle cancelled touches
            if (isDragging) {
                 if (controls) controls.enabled = true;
                 resetDragState();
                 console.log("Drag cancelled due to touch cancel.");
            }
        });
    }
    window.addEventListener('resize', onWindowResize);

    // Button Clicks
    if (solveButton) solveButton.addEventListener('click', showSolveConfirmation);
    if (shuffleButton) shuffleButton.addEventListener('click', shuffleCubeAnimated);
    if (stopButton) stopButton.addEventListener('click', requestStopSequence);
    if (settingsButton) settingsButton.addEventListener('click', toggleSettingsPanel);
    // Store button listener added in setupStorePanel
    if (closeSettingsButton) closeSettingsButton.addEventListener('click', toggleSettingsPanel);
    // Close store button listener added in setupStorePanel

    // Modals
    if (modalCancelButton) modalCancelButton.addEventListener('click', hideSolveConfirmation);
    if (modalConfirmButton) modalConfirmButton.addEventListener('click', handleSolveConfirm); // Use new handler
    // Username save button listener added in setupUsernameModal
    // Delete modal listeners added in setupDeleteAccount

    // Settings Inputs
    if (speedSlider) speedSlider.addEventListener('input', handleSpeedChange);
    if (themeRadios) themeRadios.forEach(radio => radio.addEventListener('change', handleThemeChange));
    if (vibrationToggle) vibrationToggle.addEventListener('change', handleVibrationChange);

    // Close side panels/modals on outside click/escape key
    document.addEventListener('click', (event) => {
        // Close Settings Panel
        if (settingsPanel && settingsPanel.classList.contains('active') &&
            !settingsPanel.contains(event.target) &&
            event.target !== settingsButton && !settingsButton?.contains(event.target)) {
            toggleSettingsPanel();
        }
         // Close Store Panel
        if (storePanel && storePanel.classList.contains('active') &&
            !storePanel.contains(event.target) &&
            event.target !== storeButton && !storeButton?.contains(event.target)) {
            toggleStorePanel();
        }
        // Close Modals (click on overlay)
        if (solveModal && solveModal.classList.contains('active') && event.target === solveModal) {
             hideSolveConfirmation();
        }
        if (deleteConfirmModal && deleteConfirmModal.classList.contains('active') && event.target === deleteConfirmModal) {
            hideDeleteConfirmation();
        }
         // Note: Username modal should probably not close on outside click
    });

    document.addEventListener('keydown', (event) => {
        // Escape key closes modals/panels
        if (event.key === 'Escape') {
            if (solveModal && solveModal.classList.contains('active')) hideSolveConfirmation();
            if (deleteConfirmModal && deleteConfirmModal.classList.contains('active')) hideDeleteConfirmation();
            if (settingsPanel && settingsPanel.classList.contains('active')) toggleSettingsPanel();
            if (storePanel && storePanel.classList.contains('active')) toggleStorePanel();
            // Don't close username modal with Esc? Or allow it? User decision.
            // if (usernameModal && usernameModal.classList.contains('active')) // ... hide it
        }
        // Enter key confirms modals (be careful which one is active)
        else if (event.key === 'Enter') {
             if (solveModal && solveModal.classList.contains('active') && modalConfirmButton) {
                 modalConfirmButton.click();
             } else if (deleteConfirmModal && deleteConfirmModal.classList.contains('active') && deleteModalConfirmButton) {
                 deleteModalConfirmButton.click();
             } else if (usernameModal && usernameModal.classList.contains('active') && saveUsernameButton) {
                 saveUsernameButton.click();
             }
        }
    });
}

// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);
    if (controls) controls.update(); // Required for damping
    if (renderer && scene && camera) renderer.render(scene, camera);
}

// --- Start Application ---
// Wait for DOM to be fully loaded before initializing
document.addEventListener('DOMContentLoaded', init);

// --- END OF FILE script.js ---