"use strict";

const CUBE_SIZE = 1;
const SPACING = 0.05;
const N = 3;
const SHUFFLE_MOVES = 30;
const VIBRATION_DURATION = 35;

const COLORS = {
    white: 0xffffff,
    yellow: 0xffff00,
    blue: 0x0000ff,
    green: 0x00ff00,
    red: 0xff0000,
    orange: 0xffa500,
    black: 0x1a1a1a
};

let scene, camera, renderer, controls;
let cubeGroup;
let cubies = [];
let raycaster, mouse;
let intersectedObject = null, startPoint = null, dragNormal = null;
let isDragging = false, isAnimating = false, isSequenceAnimating = false;
let stopSequenceRequested = false;
let lastScrambleSequence = [];

let MOVE_DURATION = 200;
let vibrationEnabled = true;

const solveButton = document.getElementById('solve-button');
const shuffleButton = document.getElementById('shuffle-button');
const stopButton = document.getElementById('stop-button');
const settingsButton = document.getElementById('settings-button');
const settingsPanel = document.getElementById('settings-panel');
const closeSettingsButton = document.getElementById('close-settings-button');
const speedSlider = document.getElementById('animation-speed-slider');
const speedDisplay = document.getElementById('speed-value-display');
const themeRadios = document.querySelectorAll('input[name="theme"]');
const solveModal = document.getElementById('solve-confirm-modal');
const modalCancelButton = document.getElementById('modal-cancel');
const modalConfirmButton = document.getElementById('modal-confirm');
const cubeContainer = document.getElementById('cube-container');
const solveModalTitle = document.getElementById('solve-modal-title');
const solveModalText = document.getElementById('solve-modal-text');
const vibrationToggle = document.getElementById('vibration-toggle');

function init() {
    loadSettings();

    if (!cubeContainer) {
        console.error("Cube container not found!");
        return;
    }

    scene = new THREE.Scene();

    const aspect = cubeContainer.clientWidth / cubeContainer.clientHeight;
    camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
    camera.position.set(5, 5, 7);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(cubeContainer.clientWidth, cubeContainer.clientHeight);
    renderer.setClearColor(0x000000, 0);
    cubeContainer.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.screenSpacePanning = false;
    controls.minDistance = 4;
    controls.maxDistance = 25;
    controls.minPolarAngle = Math.PI / 6;
    controls.maxPolarAngle = Math.PI - (Math.PI / 6);
    controls.rotateSpeed = 0.8;

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    createCube();
    lastScrambleSequence = [];

    addEventListeners();
    animate();
}

function loadSettings() {
    const savedSpeed = localStorage.getItem('rubiksAnimationSpeed');
    MOVE_DURATION = savedSpeed ? parseInt(savedSpeed, 10) : 200;
    if (speedSlider) speedSlider.value = MOVE_DURATION;
    if (speedDisplay) speedDisplay.textContent = `${MOVE_DURATION}ms`;

    const savedTheme = localStorage.getItem('rubiksTheme');
    const defaultTheme = 'light';
    const currentTheme = savedTheme || defaultTheme;
    applyTheme(currentTheme);
    const themeRadio = document.querySelector(`input[name="theme"][value="${currentTheme}"]`);
    if (themeRadio) themeRadio.checked = true;


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
    const newTheme = event.target.value;
    applyTheme(newTheme);
    localStorage.setItem('rubiksTheme', newTheme);
}

function applyTheme(themeName) {
    document.body.classList.toggle('dark-theme', themeName === 'dark');
}

function toggleSettingsPanel() {
    if (settingsPanel) settingsPanel.classList.toggle('active');
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
        }
    }
}

function createCube() {
    if (cubeGroup) scene.remove(cubeGroup);
    cubeGroup = new THREE.Group();
    cubies = [];
    const offset = (N - 1) / 2;
    const geometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);

    for (let x = 0; x < N; x++) {
        for (let y = 0; y < N; y++) {
            for (let z = 0; z < N; z++) {
                if (x > 0 && x < N - 1 && y > 0 && y < N - 1 && z > 0 && z < N - 1) continue;

                const materials = [
                    new THREE.MeshStandardMaterial({ color: x === N - 1 ? COLORS.orange : COLORS.black, roughness: 0.7, metalness: 0.1 }),
                    new THREE.MeshStandardMaterial({ color: x === 0     ? COLORS.red    : COLORS.black, roughness: 0.7, metalness: 0.1 }),
                    new THREE.MeshStandardMaterial({ color: y === N - 1 ? COLORS.yellow : COLORS.black, roughness: 0.7, metalness: 0.1 }),
                    new THREE.MeshStandardMaterial({ color: y === 0     ? COLORS.white  : COLORS.black, roughness: 0.7, metalness: 0.1 }),
                    new THREE.MeshStandardMaterial({ color: z === N - 1 ? COLORS.blue   : COLORS.black, roughness: 0.7, metalness: 0.1 }),
                    new THREE.MeshStandardMaterial({ color: z === 0     ? COLORS.green  : COLORS.black, roughness: 0.7, metalness: 0.1 })
                ];
                const cubie = new THREE.Mesh(geometry, materials);
                cubie.position.set(
                    (x - offset) * (CUBE_SIZE + SPACING),
                    (y - offset) * (CUBE_SIZE + SPACING),
                    (z - offset) * (CUBE_SIZE + SPACING)
                );
                cubie.userData.logicalPosition = new THREE.Vector3(x, y, z);
                cubeGroup.add(cubie);
                cubies.push(cubie);
            }
        }
    }
    scene.add(cubeGroup);
}

function getIntersect(event) {
    if (!renderer || !raycaster || !camera) return null;
    const bounds = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    mouse.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(cubies);

    if (intersects.length > 0) {
        const intersection = intersects[0];
        const faceMaterialIndex = intersection.face.materialIndex;
        if (intersection.object.material[faceMaterialIndex].color.getHex() !== COLORS.black) {
            return intersection;
        }
    }
    return null;
}

function onPointerDown(event) {
    if (isAnimating || isSequenceAnimating) return;
    const intersection = getIntersect(event);
    if (intersection) {
        isDragging = true;
        if (controls) controls.enabled = false;
        intersectedObject = intersection.object;
        startPoint = intersection.point.clone();
        dragNormal = intersection.face.normal.clone();
        dragNormal.transformDirection(intersectedObject.matrixWorld).round(); // Get world normal
        renderer.domElement.style.cursor = 'grabbing';
    } else {
        isDragging = false;
        renderer.domElement.style.cursor = 'grab';
    }
}

function onPointerMove(event) {
    if (!isDragging) {
         const intersection = getIntersect(event);
         renderer.domElement.style.cursor = intersection ? 'grab' : 'default';
    }
}

function onPointerUp(event) {
    renderer.domElement.style.cursor = getIntersect(event) ? 'grab' : 'default'; // Reset cursor based on hover

    if (!isDragging || !startPoint || isAnimating || isSequenceAnimating) {
        if (isDragging && controls) controls.enabled = true;
        isDragging = false;
        return;
    }

    isDragging = false; // Set dragging false immediately

    const bounds = renderer.domElement.getBoundingClientRect();
    const endMouse = new THREE.Vector2(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1
    );
    const startScreen = startPoint.clone().project(camera);
    const dragVector = endMouse.clone().sub(startScreen);

    if (dragVector.lengthSq() < 0.002) { // Adjusted threshold for sensitivity
        if (controls) controls.enabled = true;
        resetDragState();
        return;
    }

    const rotation = determineRotation(dragNormal, dragVector);

    if (rotation) {
        rotateLayer(rotation.axis, rotation.layer, rotation.angle)
            .then(() => { if (controls) controls.enabled = true; })
            .catch(() => { if (controls) controls.enabled = true; });
    } else {
        if (controls) controls.enabled = true;
    }

    resetDragState();
}

function resetDragState() {
    intersectedObject = null;
    startPoint = null;
    dragNormal = null;
    isDragging = false; // Ensure isDragging is false here too
}

function onWindowResize() {
    if (!camera || !renderer || !cubeContainer) return;
    camera.aspect = cubeContainer.clientWidth / cubeContainer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(cubeContainer.clientWidth, cubeContainer.clientHeight);
}

function determineRotation(faceNormal, dragVectorScreen) {
    if (!camera || !intersectedObject || !startPoint) return null;

    const rightDir = new THREE.Vector3().crossVectors(camera.up, faceNormal).normalize();
    const upDir = new THREE.Vector3().crossVectors(faceNormal, rightDir).normalize(); // Camera-relative up on the face

    const startPointWorld = startPoint.clone();
    const rightPointWorld = startPointWorld.clone().add(rightDir);
    const upPointWorld = startPointWorld.clone().add(upDir);

    const startPointScreen = startPointWorld.project(camera);
    const rightPointScreen = rightPointWorld.project(camera);
    const upPointScreen = upPointWorld.project(camera);

    const rightScreenVec = new THREE.Vector2().subVectors(rightPointScreen, startPointScreen).normalize();
    const upScreenVec = new THREE.Vector2().subVectors(upPointScreen, startPointScreen).normalize();

    const dotRight = dragVectorScreen.dot(rightScreenVec);
    const dotUp = dragVectorScreen.dot(upScreenVec);

    let rotationAxis = new THREE.Vector3();
    let rotationSign = 1;

    if (Math.abs(dotRight) > Math.abs(dotUp)) {
        rotationAxis.copy(upDir); // Drag along rightScreen means rotate around upDir
        rotationSign = Math.sign(dotRight);
    } else {
        rotationAxis.copy(rightDir); // Drag along upScreen means rotate around rightDir
        rotationSign = -Math.sign(dotUp); // Invert sign for up/down drag
    }

    // Snap axis to the nearest world axis (X, Y, Z)
    let maxComponent = Math.max(Math.abs(rotationAxis.x), Math.abs(rotationAxis.y), Math.abs(rotationAxis.z));
    rotationAxis.x = (Math.abs(rotationAxis.x) / maxComponent > 0.5) ? Math.sign(rotationAxis.x) : 0;
    rotationAxis.y = (Math.abs(rotationAxis.y) / maxComponent > 0.5) ? Math.sign(rotationAxis.y) : 0;
    rotationAxis.z = (Math.abs(rotationAxis.z) / maxComponent > 0.5) ? Math.sign(rotationAxis.z) : 0;

    if (rotationAxis.lengthSq() < 0.5) return null; // Invalid axis

    const angle = rotationSign * Math.PI / 2;
    const logicalPos = intersectedObject.userData.logicalPosition;
    let layerIndex = 0;

    if (Math.abs(rotationAxis.x) > 0.5) layerIndex = logicalPos.x;
    else if (Math.abs(rotationAxis.y) > 0.5) layerIndex = logicalPos.y;
    else if (Math.abs(rotationAxis.z) > 0.5) layerIndex = logicalPos.z;

    return { axis: rotationAxis, layer: layerIndex, angle: angle };
}

function rotateLayer(axis, layerIndex, angle) {
    if (!isSequenceAnimating && lastScrambleSequence.length > 0) {
        //console.log("Manual move detected, clearing scramble history for solve.");
        lastScrambleSequence = []; // Clear history on manual move if a scramble existed
    }

    return new Promise((resolve, reject) => {
        if (isAnimating) {
            reject("Animation in progress");
            return;
        }
        isAnimating = true;

        const pivot = new THREE.Group();
        scene.add(pivot);
        const layerCubies = [];
        const rotationMatrix = new THREE.Matrix4().makeRotationAxis(axis, angle);

        cubies.forEach(cubie => {
            const pos = cubie.userData.logicalPosition;
            let belongsToLayer = false;
            if (Math.abs(axis.x) > 0.5 && pos.x === layerIndex) belongsToLayer = true;
            else if (Math.abs(axis.y) > 0.5 && pos.y === layerIndex) belongsToLayer = true;
            else if (Math.abs(axis.z) > 0.5 && pos.z === layerIndex) belongsToLayer = true;

            if (belongsToLayer) {
                pivot.attach(cubie);
                layerCubies.push(cubie);
            }
        });

        if (layerCubies.length === 0) {
            isAnimating = false;
            scene.remove(pivot);
            resolve();
            return;
        }

        const startQuaternion = pivot.quaternion.clone();
        const endQuaternion = new THREE.Quaternion().setFromAxisAngle(axis, angle).multiply(startQuaternion);
        const startTime = performance.now();

        function animateRotation() {
            const elapsedTime = performance.now() - startTime;
            const fraction = Math.min(elapsedTime / MOVE_DURATION, 1);
            const easedFraction = fraction < 0.5 ? 4 * fraction * fraction * fraction : 1 - Math.pow(-2 * fraction + 2, 3) / 2; // Ease in-out cubic

            pivot.quaternion.slerpQuaternions(startQuaternion, endQuaternion, easedFraction);

            if (fraction < 1) {
                requestAnimationFrame(animateRotation);
            } else {
                pivot.quaternion.copy(endQuaternion); // Ensure final state

                layerCubies.forEach(cubie => {
                    cubeGroup.attach(cubie); // Reattach to main group
                    const logicalPos = cubie.userData.logicalPosition;
                    const offset = (N - 1) / 2;
                    logicalPos.subScalar(offset); // Center for rotation
                    logicalPos.applyMatrix4(rotationMatrix); // Apply logical rotation
                    logicalPos.round(); // Snap to grid
                    logicalPos.addScalar(offset); // Move back
                });

                scene.remove(pivot);
                isAnimating = false;
                vibrate(VIBRATION_DURATION);
                resolve();
            }
        }
        animateRotation();
    });
}

async function applyMovesAnimated(moves, shouldCleanup = true) {
    if (isSequenceAnimating) return;
    isSequenceAnimating = true;
    stopSequenceRequested = false;
    setButtonsEnabled(false);
    if (stopButton) {
        stopButton.style.display = 'inline-flex'; // Use inline-flex for consistency
        stopButton.disabled = false;
        stopButton.title = "Stop Animation";
    }
    if (settingsPanel && settingsPanel.classList.contains('active')) {
        toggleSettingsPanel(); // Close settings if open
    }

    try {
        for (const move of moves) {
            if (stopSequenceRequested) {
                //console.log("Animation sequence stopped by user.");
                break;
            }
            await rotateLayer(move.axis, move.layerIndex, move.angle);
        }
    } catch (error) {
        console.error("Error during move sequence:", error);
    } finally {
        if (shouldCleanup) {
            isSequenceAnimating = false;
            stopSequenceRequested = false;
            setButtonsEnabled(true);
            if (stopButton) stopButton.style.display = 'none';
            //console.log("Move sequence finished or stopped.");
        }
    }
}

function setButtonsEnabled(enabled) {
    if (solveButton) solveButton.disabled = !enabled;
    if (shuffleButton) shuffleButton.disabled = !enabled;
    if (settingsButton) settingsButton.disabled = !enabled;
    // Stop button state is managed separately by applyMovesAnimated
}

function showSolveConfirmation() {
    if (isSequenceAnimating || isAnimating || !solveModal) return;

    if (lastScrambleSequence.length > 0) {
        if (solveModalTitle) solveModalTitle.textContent = "Solve Cube?";
        if (solveModalText) solveModalText.textContent = "This will animate the cube back to the solved state by reversing the last shuffle.";
        if (modalConfirmButton) modalConfirmButton.textContent = "Go!";
    } else {
        if (solveModalTitle) solveModalTitle.textContent = "Reset Cube?";
        if (solveModalText) solveModalText.textContent = "The cube is already solved or was moved manually. Reset to solved state?";
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
        stopButton.disabled = true; // Disable stop button immediately after click
        stopButton.title = "Stopping...";
        //console.log("Stop requested...");
    }
}

async function solveCubeAnimated() {
    if (isAnimating || isSequenceAnimating) return;

    if (lastScrambleSequence.length > 0) {
        //console.log("Solving Cube by reversing last scramble...");
        const solveSequence = lastScrambleSequence.map(move => ({
            axis: move.axis,
            layerIndex: move.layerIndex,
            angle: -move.angle
        })).reverse();

        const sequenceToSolve = [...solveSequence];
        lastScrambleSequence = []; // Clear history *before* starting solve

        await applyMovesAnimated(sequenceToSolve, true);
        //console.log("Solve animation finished.");
    } else {
        //console.log("No valid scramble sequence found. Resetting cube...");
        createCube(); // Instantly reset if no sequence
        lastScrambleSequence = []; // Ensure it's clear
        //console.log("Cube reset to solved state.");
    }
}

function shuffleCubeAnimated() {
    if (isAnimating || isSequenceAnimating) return;
    //console.log("Shuffling Cube Animated...");

    const moves = [];
    const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
    const angles = [Math.PI / 2, -Math.PI / 2];
    let lastAxis = null;

    for (let i = 0; i < SHUFFLE_MOVES; i++) {
        let axis, layerIndex, angle;
        do {
           axis = axes[Math.floor(Math.random() * axes.length)];
           layerIndex = Math.floor(Math.random() * N);
           angle = angles[Math.floor(Math.random() * angles.length)];
           // Avoid redundant moves (like F F') or immediate inverse (F F') - simple check
        } while (axis === lastAxis && moves.length > 0 && moves[moves.length-1].layerIndex === layerIndex);

        moves.push({ axis, layerIndex, angle });
        lastAxis = axis;
    }

    lastScrambleSequence = [...moves];
    //console.log(`Stored ${lastScrambleSequence.length} moves for potential solve.`);
    applyMovesAnimated(moves, true);
}

function addEventListeners() {
    if (renderer && renderer.domElement) {
        renderer.domElement.addEventListener('pointerdown', onPointerDown);
        renderer.domElement.addEventListener('pointermove', onPointerMove);
        renderer.domElement.addEventListener('pointerup', onPointerUp);
        renderer.domElement.addEventListener('pointerleave', () => { // Reset cursor when leaving canvas
            if (!isDragging) renderer.domElement.style.cursor = 'default';
        });
    }
    window.addEventListener('resize', onWindowResize);

    if (solveButton) solveButton.addEventListener('click', showSolveConfirmation);
    if (shuffleButton) shuffleButton.addEventListener('click', shuffleCubeAnimated);
    if (stopButton) stopButton.addEventListener('click', requestStopSequence);
    if (settingsButton) settingsButton.addEventListener('click', toggleSettingsPanel);
    if (closeSettingsButton) closeSettingsButton.addEventListener('click', toggleSettingsPanel);
    if (modalCancelButton) modalCancelButton.addEventListener('click', hideSolveConfirmation);
    if (modalConfirmButton) modalConfirmButton.addEventListener('click', () => { hideSolveConfirmation(); solveCubeAnimated(); });
    if (speedSlider) speedSlider.addEventListener('input', handleSpeedChange);
    if (themeRadios) themeRadios.forEach(radio => radio.addEventListener('change', handleThemeChange));
    if (vibrationToggle) vibrationToggle.addEventListener('change', handleVibrationChange);

    // Close settings panel if clicking outside
    document.addEventListener('click', (event) => {
        if (settingsPanel && settingsPanel.classList.contains('active') &&
            !settingsPanel.contains(event.target) &&
            event.target !== settingsButton && !settingsButton.contains(event.target)) {
            toggleSettingsPanel();
        }
    });
     // Close modal if clicking outside
    if (solveModal) {
        solveModal.addEventListener('click', (event) => {
             if (event.target === solveModal) { // Only if clicking the overlay itself
                hideSolveConfirmation();
            }
        });
    }

     // Keyboard accessibility for modal
    document.addEventListener('keydown', (event) => {
        if (solveModal && solveModal.classList.contains('active')) {
            if (event.key === 'Escape') {
                hideSolveConfirmation();
            } else if (event.key === 'Enter') {
                 if (modalConfirmButton) modalConfirmButton.click();
            }
        }
         if (settingsPanel && settingsPanel.classList.contains('active')) {
             if (event.key === 'Escape') {
                toggleSettingsPanel();
            }
         }
    });
}

function animate() {
    requestAnimationFrame(animate);
    if (controls) controls.update(); // Only required if damping or auto-rotation is enabled
    if (renderer && scene && camera) renderer.render(scene, camera);
}

// --- Start ---
// Ensure DOM is fully loaded before initializing Three.js and accessing elements
document.addEventListener('DOMContentLoaded', init);