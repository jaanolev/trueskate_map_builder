// ========================================
// TRUE SKATE MAP MAKER - Main Application
// ========================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ========================================
// GLOBAL STATE
// ========================================

const state = {
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    raycaster: new THREE.Raycaster(),
    mouse: new THREE.Vector2(),
    objects: [],
    selectedObject: null,
    placingObject: null,
    groundPlane: null,
    gridHelper: null,
    mode: 'SELECT' // SELECT, PLACE
};

// ========================================
// OBJECT DEFINITIONS
// ========================================

const OBJECT_DEFINITIONS = {
    // Ground pieces
    'ground-flat': {
        name: 'Flat Ground',
        create: () => {
            const geo = new THREE.BoxGeometry(10, 0.5, 10);
            const mat = new THREE.MeshStandardMaterial({ 
                color: 0x404045,
                roughness: 0.8,
                metalness: 0.1
            });
            return new THREE.Mesh(geo, mat);
        }
    },
    'ground-slope': {
        name: 'Slope',
        create: () => {
            const shape = new THREE.Shape();
            shape.moveTo(0, 0);
            shape.lineTo(5, 0);
            shape.lineTo(5, 2);
            shape.lineTo(0, 0);
            
            const extrudeSettings = { depth: 5, bevelEnabled: false };
            const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            geo.rotateY(Math.PI / 2);
            geo.translate(-2.5, 0, 2.5);
            
            const mat = new THREE.MeshStandardMaterial({ 
                color: 0x505055,
                roughness: 0.7
            });
            return new THREE.Mesh(geo, mat);
        }
    },
    
    // Ramps
    'quarter-pipe': {
        name: 'Quarter Pipe',
        create: () => {
            const curve = new THREE.QuadraticBezierCurve(
                new THREE.Vector2(0, 0),
                new THREE.Vector2(0, 3),
                new THREE.Vector2(3, 3)
            );
            const points = curve.getPoints(16);
            const shape = new THREE.Shape();
            shape.moveTo(0, 0);
            points.forEach(p => shape.lineTo(p.x, p.y));
            shape.lineTo(3, 0);
            shape.lineTo(0, 0);
            
            const extrudeSettings = { depth: 6, bevelEnabled: false };
            const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            geo.rotateY(Math.PI / 2);
            geo.translate(-3, 0, 1.5);
            
            const mat = new THREE.MeshStandardMaterial({ 
                color: 0x666670,
                roughness: 0.5
            });
            return new THREE.Mesh(geo, mat);
        }
    },
    'half-pipe': {
        name: 'Half Pipe',
        create: () => {
            const group = new THREE.Group();
            
            // Create two quarter pipes facing each other
            const curve = new THREE.QuadraticBezierCurve(
                new THREE.Vector2(0, 0),
                new THREE.Vector2(0, 3),
                new THREE.Vector2(3, 3)
            );
            const points = curve.getPoints(16);
            const shape = new THREE.Shape();
            shape.moveTo(0, 0);
            points.forEach(p => shape.lineTo(p.x, p.y));
            shape.lineTo(3, 0);
            shape.lineTo(0, 0);
            
            const extrudeSettings = { depth: 8, bevelEnabled: false };
            const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            
            const mat = new THREE.MeshStandardMaterial({ 
                color: 0x666670,
                roughness: 0.5
            });
            
            const qp1 = new THREE.Mesh(geo.clone(), mat);
            qp1.rotation.y = Math.PI / 2;
            qp1.position.set(-3, 0, 4);
            
            const qp2 = new THREE.Mesh(geo.clone(), mat);
            qp2.rotation.y = -Math.PI / 2;
            qp2.position.set(9, 0, -4);
            
            // Flat bottom
            const flatGeo = new THREE.BoxGeometry(6, 0.2, 8);
            const flat = new THREE.Mesh(flatGeo, mat);
            flat.position.set(3, 0.1, 0);
            
            group.add(qp1, qp2, flat);
            return group;
        }
    },
    'kicker': {
        name: 'Kicker Ramp',
        create: () => {
            const curve = new THREE.QuadraticBezierCurve(
                new THREE.Vector2(0, 0),
                new THREE.Vector2(1.5, 0),
                new THREE.Vector2(2, 1.5)
            );
            const points = curve.getPoints(12);
            const shape = new THREE.Shape();
            shape.moveTo(0, 0);
            points.forEach(p => shape.lineTo(p.x, p.y));
            shape.lineTo(2, 0);
            shape.lineTo(0, 0);
            
            const extrudeSettings = { depth: 3, bevelEnabled: false };
            const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            geo.rotateY(Math.PI / 2);
            geo.translate(-1.5, 0, 1);
            
            const mat = new THREE.MeshStandardMaterial({ 
                color: 0x885533,
                roughness: 0.6
            });
            return new THREE.Mesh(geo, mat);
        }
    },
    'pyramid': {
        name: 'Pyramid',
        create: () => {
            const geo = new THREE.ConeGeometry(3, 2, 4);
            geo.rotateY(Math.PI / 4);
            geo.translate(0, 1, 0);
            
            const mat = new THREE.MeshStandardMaterial({ 
                color: 0x555560,
                roughness: 0.6
            });
            return new THREE.Mesh(geo, mat);
        }
    },
    
    // Rails & Ledges
    'rail-flat': {
        name: 'Flat Rail',
        create: () => {
            const group = new THREE.Group();
            
            // Rail bar
            const railGeo = new THREE.CylinderGeometry(0.08, 0.08, 6, 8);
            railGeo.rotateZ(Math.PI / 2);
            const railMat = new THREE.MeshStandardMaterial({ 
                color: 0xaaaaaa,
                metalness: 0.8,
                roughness: 0.2
            });
            const rail = new THREE.Mesh(railGeo, railMat);
            rail.position.y = 0.8;
            
            // Supports
            const supportGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8);
            const support1 = new THREE.Mesh(supportGeo, railMat);
            support1.position.set(-2.5, 0.4, 0);
            const support2 = new THREE.Mesh(supportGeo, railMat);
            support2.position.set(2.5, 0.4, 0);
            
            group.add(rail, support1, support2);
            return group;
        }
    },
    'rail-down': {
        name: 'Down Rail',
        create: () => {
            const group = new THREE.Group();
            
            // Angled rail
            const railGeo = new THREE.CylinderGeometry(0.08, 0.08, 7, 8);
            railGeo.rotateZ(Math.PI / 2);
            const railMat = new THREE.MeshStandardMaterial({ 
                color: 0xaaaaaa,
                metalness: 0.8,
                roughness: 0.2
            });
            const rail = new THREE.Mesh(railGeo, railMat);
            rail.rotation.z = -0.25;
            rail.position.set(0, 1.2, 0);
            
            // Supports
            const supportGeo1 = new THREE.CylinderGeometry(0.05, 0.05, 1.8, 8);
            const support1 = new THREE.Mesh(supportGeo1, railMat);
            support1.position.set(-3, 0.9, 0);
            
            const supportGeo2 = new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8);
            const support2 = new THREE.Mesh(supportGeo2, railMat);
            support2.position.set(3, 0.3, 0);
            
            group.add(rail, support1, support2);
            return group;
        }
    },
    'ledge': {
        name: 'Ledge',
        create: () => {
            const geo = new THREE.BoxGeometry(5, 0.6, 0.8);
            geo.translate(0, 0.3, 0);
            const mat = new THREE.MeshStandardMaterial({ 
                color: 0x666666,
                roughness: 0.7
            });
            const mesh = new THREE.Mesh(geo, mat);
            
            // Add metal edge
            const edgeGeo = new THREE.BoxGeometry(5, 0.05, 0.05);
            const edgeMat = new THREE.MeshStandardMaterial({ 
                color: 0xcccccc,
                metalness: 0.9,
                roughness: 0.1
            });
            const edge = new THREE.Mesh(edgeGeo, edgeMat);
            edge.position.set(0, 0.6, 0.4);
            
            const group = new THREE.Group();
            group.add(mesh, edge);
            return group;
        }
    },
    'manual-pad': {
        name: 'Manual Pad',
        create: () => {
            const geo = new THREE.BoxGeometry(4, 0.3, 2);
            geo.translate(0, 0.15, 0);
            const mat = new THREE.MeshStandardMaterial({ 
                color: 0x555555,
                roughness: 0.6
            });
            return new THREE.Mesh(geo, mat);
        }
    },
    
    // Stairs
    'stairs-3': {
        name: '3 Stair',
        create: () => createStairs(3)
    },
    'stairs-5': {
        name: '5 Stair',
        create: () => createStairs(5)
    },
    'stairs-hubba': {
        name: 'Hubba Ledge',
        create: () => {
            const group = new THREE.Group();
            
            // Stairs
            const stairs = createStairs(4);
            group.add(stairs);
            
            // Hubba ledge on top
            const hubbaGeo = new THREE.BoxGeometry(0.5, 0.8, 4.5);
            const hubbaMat = new THREE.MeshStandardMaterial({ 
                color: 0x777777,
                roughness: 0.6
            });
            const hubba = new THREE.Mesh(hubbaGeo, hubbaMat);
            hubba.rotation.x = Math.atan2(1.6, 4);
            hubba.position.set(1.5, 1.2, -2);
            
            group.add(hubba);
            return group;
        }
    },
    
    // Props
    'bench': {
        name: 'Bench',
        create: () => {
            const group = new THREE.Group();
            
            // Seat
            const seatGeo = new THREE.BoxGeometry(2, 0.1, 0.5);
            const woodMat = new THREE.MeshStandardMaterial({ 
                color: 0x8B4513,
                roughness: 0.8
            });
            const seat = new THREE.Mesh(seatGeo, woodMat);
            seat.position.y = 0.5;
            
            // Legs
            const legGeo = new THREE.BoxGeometry(0.1, 0.5, 0.5);
            const metalMat = new THREE.MeshStandardMaterial({ 
                color: 0x333333,
                metalness: 0.5
            });
            const leg1 = new THREE.Mesh(legGeo, metalMat);
            leg1.position.set(-0.8, 0.25, 0);
            const leg2 = new THREE.Mesh(legGeo, metalMat);
            leg2.position.set(0.8, 0.25, 0);
            
            group.add(seat, leg1, leg2);
            return group;
        }
    },
    'trash-can': {
        name: 'Trash Can',
        create: () => {
            const geo = new THREE.CylinderGeometry(0.3, 0.25, 0.8, 12);
            geo.translate(0, 0.4, 0);
            const mat = new THREE.MeshStandardMaterial({ 
                color: 0x2244aa,
                roughness: 0.4
            });
            return new THREE.Mesh(geo, mat);
        }
    }
};

// Helper function to create stairs
function createStairs(numSteps) {
    const group = new THREE.Group();
    const stepHeight = 0.4;
    const stepDepth = 1;
    const stepWidth = 3;
    
    const mat = new THREE.MeshStandardMaterial({ 
        color: 0x555560,
        roughness: 0.7
    });
    
    for (let i = 0; i < numSteps; i++) {
        const geo = new THREE.BoxGeometry(stepWidth, stepHeight, stepDepth);
        const step = new THREE.Mesh(geo, mat);
        step.position.set(0, stepHeight * (i + 0.5), -stepDepth * i);
        group.add(step);
    }
    
    return group;
}

// ========================================
// INITIALIZATION
// ========================================

function init() {
    // Scene
    state.scene = new THREE.Scene();
    state.scene.background = new THREE.Color(0x1a1a22);
    
    // Camera
    const canvas = document.getElementById('canvas');
    const aspect = canvas.clientWidth / canvas.clientHeight;
    state.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    state.camera.position.set(15, 15, 15);
    state.camera.lookAt(0, 0, 0);
    
    // Renderer
    state.renderer = new THREE.WebGLRenderer({ 
        canvas: canvas, 
        antialias: true 
    });
    state.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    state.renderer.setPixelRatio(window.devicePixelRatio);
    state.renderer.shadowMap.enabled = true;
    state.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Controls
    state.controls = new OrbitControls(state.camera, state.renderer.domElement);
    state.controls.enableDamping = true;
    state.controls.dampingFactor = 0.05;
    state.controls.screenSpacePanning = false;
    state.controls.minDistance = 3;
    state.controls.maxDistance = 100;
    state.controls.maxPolarAngle = Math.PI / 2;
    
    // Lighting
    setupLighting();
    
    // Grid and ground
    setupGround();
    
    // Event listeners
    setupEventListeners();
    
    // Start render loop
    animate();
    
    console.log('🛹 True Skate Map Maker initialized!');
}

function setupLighting() {
    // Ambient light
    const ambient = new THREE.AmbientLight(0x404050, 0.6);
    state.scene.add(ambient);
    
    // Main directional light (sun)
    const sun = new THREE.DirectionalLight(0xffffee, 1.2);
    sun.position.set(20, 30, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 100;
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    state.scene.add(sun);
    
    // Fill light
    const fill = new THREE.DirectionalLight(0x8888ff, 0.3);
    fill.position.set(-10, 10, -10);
    state.scene.add(fill);
    
    // Hemisphere light for nice ambient
    const hemi = new THREE.HemisphereLight(0x87CEEB, 0x444444, 0.4);
    state.scene.add(hemi);
}

function setupGround() {
    // Grid helper
    state.gridHelper = new THREE.GridHelper(100, 100, 0x444455, 0x222233);
    state.scene.add(state.gridHelper);
    
    // Invisible ground plane for raycasting
    const groundGeo = new THREE.PlaneGeometry(100, 100);
    const groundMat = new THREE.MeshBasicMaterial({ 
        visible: false 
    });
    state.groundPlane = new THREE.Mesh(groundGeo, groundMat);
    state.groundPlane.rotation.x = -Math.PI / 2;
    state.groundPlane.name = 'ground';
    state.scene.add(state.groundPlane);
}

// ========================================
// EVENT LISTENERS
// ========================================

function setupEventListeners() {
    const canvas = document.getElementById('canvas');
    
    // Window resize
    window.addEventListener('resize', onWindowResize);
    
    // Mouse events
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('click', onCanvasClick);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // Palette items
    document.querySelectorAll('.palette-item').forEach(item => {
        item.addEventListener('click', () => selectPaletteItem(item));
    });
    
    // Property inputs
    document.getElementById('pos-x').addEventListener('input', updateSelectedPosition);
    document.getElementById('pos-y').addEventListener('input', updateSelectedPosition);
    document.getElementById('pos-z').addEventListener('input', updateSelectedPosition);
    document.getElementById('rot-y').addEventListener('input', updateSelectedRotation);
    document.getElementById('scale').addEventListener('input', updateSelectedScale);
    
    // Buttons
    document.getElementById('btn-delete').addEventListener('click', deleteSelectedObject);
    document.getElementById('btn-duplicate').addEventListener('click', duplicateSelectedObject);
    document.getElementById('btn-new').addEventListener('click', clearScene);
    document.getElementById('btn-export').addEventListener('click', exportToTrueSkate);
    
    // Keyboard
    window.addEventListener('keydown', onKeyDown);
}

function onWindowResize() {
    const canvas = document.getElementById('canvas');
    const container = document.getElementById('viewport');
    
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    
    state.camera.aspect = canvas.width / canvas.height;
    state.camera.updateProjectionMatrix();
    state.renderer.setSize(canvas.width, canvas.height);
}

function onMouseMove(event) {
    const canvas = document.getElementById('canvas');
    const rect = canvas.getBoundingClientRect();
    
    state.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    state.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Update cursor position in status bar
    state.raycaster.setFromCamera(state.mouse, state.camera);
    const intersects = state.raycaster.intersectObject(state.groundPlane);
    
    if (intersects.length > 0) {
        const point = intersects[0].point;
        document.getElementById('cursor-pos').textContent = 
            `X: ${point.x.toFixed(1)} | Y: ${point.y.toFixed(1)} | Z: ${point.z.toFixed(1)}`;
        
        // Move placing preview
        if (state.placingObject) {
            state.placingObject.position.x = Math.round(point.x * 2) / 2;
            state.placingObject.position.z = Math.round(point.z * 2) / 2;
        }
    }
}

function onCanvasClick(event) {
    if (state.mode === 'PLACE' && state.placingObject) {
        // Place the object
        placeObject();
    } else {
        // Try to select an object
        selectObjectAtMouse();
    }
}

function onKeyDown(event) {
    if (event.key === 'Escape') {
        cancelPlacing();
        deselectObject();
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
        if (state.selectedObject) {
            deleteSelectedObject();
        }
    } else if (event.key === 'r' || event.key === 'R') {
        if (state.selectedObject) {
            state.selectedObject.rotation.y += Math.PI / 4;
            updatePropertiesPanel();
        } else if (state.placingObject) {
            state.placingObject.rotation.y += Math.PI / 4;
        }
    }
}

// ========================================
// OBJECT MANAGEMENT
// ========================================

function selectPaletteItem(item) {
    // Remove previous selection
    document.querySelectorAll('.palette-item').forEach(i => i.classList.remove('selected'));
    item.classList.add('selected');
    
    // Cancel any existing placement
    cancelPlacing();
    
    // Create preview object
    const objectType = item.dataset.object;
    const definition = OBJECT_DEFINITIONS[objectType];
    
    if (definition) {
        state.placingObject = definition.create();
        state.placingObject.userData.type = objectType;
        state.placingObject.userData.name = definition.name;
        
        // Make it semi-transparent
        setObjectOpacity(state.placingObject, 0.5);
        
        state.scene.add(state.placingObject);
        setMode('PLACE');
    }
}

function setObjectOpacity(object, opacity) {
    object.traverse((child) => {
        if (child.isMesh) {
            child.material = child.material.clone();
            child.material.transparent = true;
            child.material.opacity = opacity;
        }
    });
}

function placeObject() {
    if (!state.placingObject) return;
    
    // Make it solid
    setObjectOpacity(state.placingObject, 1);
    
    // Enable shadows
    state.placingObject.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
    
    // Add to objects list
    state.objects.push(state.placingObject);
    
    // Create new preview
    const objectType = state.placingObject.userData.type;
    const definition = OBJECT_DEFINITIONS[objectType];
    
    state.placingObject = definition.create();
    state.placingObject.userData.type = objectType;
    state.placingObject.userData.name = definition.name;
    setObjectOpacity(state.placingObject, 0.5);
    state.scene.add(state.placingObject);
    
    updateObjectCount();
}

function cancelPlacing() {
    if (state.placingObject) {
        state.scene.remove(state.placingObject);
        state.placingObject = null;
    }
    
    document.querySelectorAll('.palette-item').forEach(i => i.classList.remove('selected'));
    setMode('SELECT');
}

function selectObjectAtMouse() {
    state.raycaster.setFromCamera(state.mouse, state.camera);
    
    // Get all meshes from objects
    const meshes = [];
    state.objects.forEach(obj => {
        obj.traverse((child) => {
            if (child.isMesh) {
                meshes.push(child);
            }
        });
    });
    
    const intersects = state.raycaster.intersectObjects(meshes);
    
    if (intersects.length > 0) {
        // Find the root object
        let selected = intersects[0].object;
        while (selected.parent && !state.objects.includes(selected)) {
            selected = selected.parent;
        }
        
        if (state.objects.includes(selected)) {
            selectObject(selected);
        }
    } else {
        deselectObject();
    }
}

function selectObject(object) {
    deselectObject();
    
    state.selectedObject = object;
    
    // Add highlight
    object.traverse((child) => {
        if (child.isMesh) {
            child.userData.originalMaterial = child.material;
            child.material = child.material.clone();
            child.material.emissive = new THREE.Color(0xff3c00);
            child.material.emissiveIntensity = 0.3;
        }
    });
    
    updatePropertiesPanel();
}

function deselectObject() {
    if (state.selectedObject) {
        state.selectedObject.traverse((child) => {
            if (child.isMesh && child.userData.originalMaterial) {
                child.material = child.userData.originalMaterial;
            }
        });
        state.selectedObject = null;
    }
    
    document.getElementById('no-selection').classList.remove('hidden');
    document.getElementById('object-properties').classList.add('hidden');
}

function deleteSelectedObject() {
    if (!state.selectedObject) return;
    
    state.scene.remove(state.selectedObject);
    state.objects = state.objects.filter(o => o !== state.selectedObject);
    state.selectedObject = null;
    
    deselectObject();
    updateObjectCount();
}

function duplicateSelectedObject() {
    if (!state.selectedObject) return;
    
    const objectType = state.selectedObject.userData.type;
    const definition = OBJECT_DEFINITIONS[objectType];
    
    if (definition) {
        const clone = definition.create();
        clone.userData.type = objectType;
        clone.userData.name = definition.name;
        clone.position.copy(state.selectedObject.position);
        clone.position.x += 2;
        clone.rotation.copy(state.selectedObject.rotation);
        clone.scale.copy(state.selectedObject.scale);
        
        clone.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        state.scene.add(clone);
        state.objects.push(clone);
        
        selectObject(clone);
        updateObjectCount();
    }
}

function clearScene() {
    if (state.objects.length > 0 && !confirm('Clear all objects?')) return;
    
    state.objects.forEach(obj => state.scene.remove(obj));
    state.objects = [];
    deselectObject();
    cancelPlacing();
    updateObjectCount();
}

// ========================================
// UI UPDATES
// ========================================

function setMode(mode) {
    state.mode = mode;
    document.getElementById('mode-indicator').textContent = `MODE: ${mode}`;
    document.body.classList.toggle('placing-mode', mode === 'PLACE');
}

function updateObjectCount() {
    document.getElementById('object-count').textContent = `Objects: ${state.objects.length}`;
}

function updatePropertiesPanel() {
    if (!state.selectedObject) return;
    
    document.getElementById('no-selection').classList.add('hidden');
    document.getElementById('object-properties').classList.remove('hidden');
    
    document.getElementById('pos-x').value = state.selectedObject.position.x.toFixed(1);
    document.getElementById('pos-y').value = state.selectedObject.position.y.toFixed(1);
    document.getElementById('pos-z').value = state.selectedObject.position.z.toFixed(1);
    document.getElementById('rot-y').value = (state.selectedObject.rotation.y * 180 / Math.PI).toFixed(0);
    
    const scale = state.selectedObject.scale.x;
    document.getElementById('scale').value = scale;
    document.getElementById('scale-value').textContent = `${scale.toFixed(1)}x`;
}

function updateSelectedPosition() {
    if (!state.selectedObject) return;
    
    state.selectedObject.position.x = parseFloat(document.getElementById('pos-x').value) || 0;
    state.selectedObject.position.y = parseFloat(document.getElementById('pos-y').value) || 0;
    state.selectedObject.position.z = parseFloat(document.getElementById('pos-z').value) || 0;
}

function updateSelectedRotation() {
    if (!state.selectedObject) return;
    
    const degrees = parseFloat(document.getElementById('rot-y').value) || 0;
    state.selectedObject.rotation.y = degrees * Math.PI / 180;
}

function updateSelectedScale() {
    if (!state.selectedObject) return;
    
    const scale = parseFloat(document.getElementById('scale').value) || 1;
    state.selectedObject.scale.set(scale, scale, scale);
    document.getElementById('scale-value').textContent = `${scale.toFixed(1)}x`;
}

// ========================================
// TRUE SKATE FORMAT EXPORT
// ========================================

// Geometry generators for True Skate format
const TS_SCALE = 100.0; // True Skate uses larger coordinates

function generateBoxGeometry(width, height, depth, offsetX = 0, offsetY = 0, offsetZ = 0) {
    const hw = width / 2, hh = height / 2, hd = depth / 2;
    const vertices = [];
    const indices = [];
    
    // 8 corners
    const corners = [
        [-hw + offsetX, -hh + offsetY, -hd + offsetZ],
        [hw + offsetX, -hh + offsetY, -hd + offsetZ],
        [hw + offsetX, hh + offsetY, -hd + offsetZ],
        [-hw + offsetX, hh + offsetY, -hd + offsetZ],
        [-hw + offsetX, -hh + offsetY, hd + offsetZ],
        [hw + offsetX, -hh + offsetY, hd + offsetZ],
        [hw + offsetX, hh + offsetY, hd + offsetZ],
        [-hw + offsetX, hh + offsetY, hd + offsetZ],
    ];
    
    // Faces with normals
    const faces = [
        [[0, 1, 2, 3], [0, 0, -1]],
        [[5, 4, 7, 6], [0, 0, 1]],
        [[4, 0, 3, 7], [-1, 0, 0]],
        [[1, 5, 6, 2], [1, 0, 0]],
        [[3, 2, 6, 7], [0, 1, 0]],
        [[4, 5, 1, 0], [0, -1, 0]],
    ];
    
    for (const [faceCorners, normal] of faces) {
        const base = vertices.length;
        for (let i = 0; i < 4; i++) {
            const c = corners[faceCorners[i]];
            vertices.push({
                x: c[0], y: c[1], z: c[2],
                nx: normal[0], ny: normal[1], nz: normal[2],
                u: (i === 1 || i === 2) ? 1 : 0,
                v: (i === 2 || i === 3) ? 1 : 0
            });
        }
        indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    
    return { vertices, indices };
}

function generateQuarterPipeGeometry(radius = 3.0, width = 6.0, segments = 12) {
    const vertices = [];
    const indices = [];
    
    // Curved surface
    for (let i = 0; i <= segments; i++) {
        const angle = (Math.PI / 2) * (i / segments);
        const x = radius * (1 - Math.cos(angle));
        const y = radius * Math.sin(angle);
        const nx = -Math.cos(angle);
        const ny = Math.sin(angle);
        
        vertices.push({
            x: x - radius, y: y, z: -width / 2,
            nx: nx, ny: ny, nz: 0,
            u: i / segments, v: 0
        });
        vertices.push({
            x: x - radius, y: y, z: width / 2,
            nx: nx, ny: ny, nz: 0,
            u: i / segments, v: 1
        });
    }
    
    for (let i = 0; i < segments; i++) {
        const base = i * 2;
        indices.push(base, base + 2, base + 3, base, base + 3, base + 1);
    }
    
    // Side panels
    const sideStart = vertices.length;
    for (let i = 0; i <= segments; i++) {
        const angle = (Math.PI / 2) * (i / segments);
        const x = radius * (1 - Math.cos(angle));
        const y = radius * Math.sin(angle);
        vertices.push({ x: x - radius, y: y, z: -width / 2, nx: 0, ny: 0, nz: -1, u: x / radius, v: y / radius });
    }
    vertices.push({ x: -radius, y: 0, z: -width / 2, nx: 0, ny: 0, nz: -1, u: 0, v: 0 });
    const bottomLeft = vertices.length - 1;
    for (let i = 0; i < segments; i++) {
        indices.push(bottomLeft, sideStart + i, sideStart + i + 1);
    }
    
    const rightStart = vertices.length;
    for (let i = 0; i <= segments; i++) {
        const angle = (Math.PI / 2) * (i / segments);
        const x = radius * (1 - Math.cos(angle));
        const y = radius * Math.sin(angle);
        vertices.push({ x: x - radius, y: y, z: width / 2, nx: 0, ny: 0, nz: 1, u: x / radius, v: y / radius });
    }
    vertices.push({ x: -radius, y: 0, z: width / 2, nx: 0, ny: 0, nz: 1, u: 0, v: 0 });
    const bottomRight = vertices.length - 1;
    for (let i = 0; i < segments; i++) {
        indices.push(bottomRight, rightStart + i + 1, rightStart + i);
    }
    
    return { vertices, indices };
}

function generatePyramidGeometry(baseRadius = 3.0, height = 2.0) {
    const vertices = [];
    const indices = [];
    
    const corners = [
        [-baseRadius, 0, -baseRadius],
        [baseRadius, 0, -baseRadius],
        [baseRadius, 0, baseRadius],
        [-baseRadius, 0, baseRadius],
    ];
    const apex = [0, height, 0];
    
    const calcNormal = (p1, p2, p3) => {
        const ax = p2[0] - p1[0], ay = p2[1] - p1[1], az = p2[2] - p1[2];
        const bx = p3[0] - p1[0], by = p3[1] - p1[1], bz = p3[2] - p1[2];
        const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        return len > 0 ? [nx / len, ny / len, nz / len] : [0, 1, 0];
    };
    
    const faces = [[0, 1], [1, 2], [2, 3], [3, 0]];
    for (const [c1, c2] of faces) {
        const p1 = corners[c1], p2 = corners[c2], p3 = apex;
        const normal = calcNormal(p1, p2, p3);
        const base = vertices.length;
        vertices.push({ x: p1[0], y: p1[1], z: p1[2], nx: normal[0], ny: normal[1], nz: normal[2], u: 0, v: 0 });
        vertices.push({ x: p2[0], y: p2[1], z: p2[2], nx: normal[0], ny: normal[1], nz: normal[2], u: 1, v: 0 });
        vertices.push({ x: p3[0], y: p3[1], z: p3[2], nx: normal[0], ny: normal[1], nz: normal[2], u: 0.5, v: 1 });
        indices.push(base, base + 1, base + 2);
    }
    
    // Bottom
    const base = vertices.length;
    for (const c of corners) {
        vertices.push({ x: c[0], y: c[1], z: c[2], nx: 0, ny: -1, nz: 0, u: (c[0] + baseRadius) / (2 * baseRadius), v: (c[2] + baseRadius) / (2 * baseRadius) });
    }
    indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
    
    return { vertices, indices };
}

function generateStairsGeometry(numSteps = 3, stepHeight = 0.4, stepDepth = 1.0, stepWidth = 3.0) {
    const allVertices = [];
    const allIndices = [];
    
    for (let i = 0; i < numSteps; i++) {
        const box = generateBoxGeometry(stepWidth, stepHeight, stepDepth, 0, stepHeight * (i + 0.5), -stepDepth * i);
        const baseIdx = allVertices.length;
        allVertices.push(...box.vertices);
        allIndices.push(...box.indices.map(idx => idx + baseIdx));
    }
    
    return { vertices: allVertices, indices: allIndices };
}

function generateRailGeometry(length = 6.0, height = 0.8, radius = 0.08) {
    const vertices = [];
    const indices = [];
    const segments = 8;
    
    // Main rail
    for (let i = 0; i < segments; i++) {
        const angle1 = 2 * Math.PI * i / segments;
        const angle2 = 2 * Math.PI * (i + 1) / segments;
        const y1 = height + radius * Math.cos(angle1);
        const z1 = radius * Math.sin(angle1);
        const y2 = height + radius * Math.cos(angle2);
        const z2 = radius * Math.sin(angle2);
        
        const base = vertices.length;
        vertices.push({ x: -length / 2, y: y1, z: z1, nx: 0, ny: Math.cos(angle1), nz: Math.sin(angle1), u: 0, v: i / segments });
        vertices.push({ x: -length / 2, y: y2, z: z2, nx: 0, ny: Math.cos(angle2), nz: Math.sin(angle2), u: 0, v: (i + 1) / segments });
        vertices.push({ x: length / 2, y: y1, z: z1, nx: 0, ny: Math.cos(angle1), nz: Math.sin(angle1), u: 1, v: i / segments });
        vertices.push({ x: length / 2, y: y2, z: z2, nx: 0, ny: Math.cos(angle2), nz: Math.sin(angle2), u: 1, v: (i + 1) / segments });
        indices.push(base, base + 1, base + 3, base, base + 3, base + 2);
    }
    
    return { vertices, indices };
}

function generateLedgeGeometry(length = 5.0, height = 0.6, depth = 0.8) {
    return generateBoxGeometry(length, height, depth, 0, height / 2, 0);
}

function generateKickerGeometry(length = 2.0, height = 1.5, width = 3.0) {
    const vertices = [];
    const indices = [];
    const segments = 8;
    
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const x = (1 - t) * (1 - t) * 0 + 2 * (1 - t) * t * (length * 0.75) + t * t * length;
        const y = t * t * height;
        const dx = 2 * (1 - t) * (length * 0.75) + 2 * t * (length - length * 0.75);
        const dy = 2 * t * height;
        const len = Math.sqrt(dx * dx + dy * dy);
        const nx = len > 0 ? -dy / len : 0;
        const ny = len > 0 ? dx / len : 1;
        
        vertices.push({ x: x, y: y, z: -width / 2, nx: nx, ny: ny, nz: 0, u: t, v: 0 });
        vertices.push({ x: x, y: y, z: width / 2, nx: nx, ny: ny, nz: 0, u: t, v: 1 });
    }
    
    for (let i = 0; i < segments; i++) {
        const base = i * 2;
        indices.push(base, base + 2, base + 3, base, base + 3, base + 1);
    }
    
    // Bottom and back faces
    let base = vertices.length;
    vertices.push({ x: 0, y: 0, z: -width / 2, nx: 0, ny: -1, nz: 0, u: 0, v: 0 });
    vertices.push({ x: 0, y: 0, z: width / 2, nx: 0, ny: -1, nz: 0, u: 0, v: 1 });
    vertices.push({ x: length, y: 0, z: width / 2, nx: 0, ny: -1, nz: 0, u: 1, v: 1 });
    vertices.push({ x: length, y: 0, z: -width / 2, nx: 0, ny: -1, nz: 0, u: 1, v: 0 });
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    
    base = vertices.length;
    vertices.push({ x: length, y: 0, z: -width / 2, nx: 1, ny: 0, nz: 0, u: 0, v: 0 });
    vertices.push({ x: length, y: 0, z: width / 2, nx: 1, ny: 0, nz: 0, u: 1, v: 0 });
    vertices.push({ x: length, y: height, z: width / 2, nx: 1, ny: 0, nz: 0, u: 1, v: 1 });
    vertices.push({ x: length, y: height, z: -width / 2, nx: 1, ny: 0, nz: 0, u: 0, v: 1 });
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    
    return { vertices, indices };
}

function generateGroundGeometry(size = 50.0) {
    return generateBoxGeometry(size, 0.5, size, 0, -0.25, 0);
}

function generateSlopeGeometry(length = 5.0, height = 2.0, width = 5.0) {
    const vertices = [];
    const indices = [];
    
    // Top surface
    vertices.push({ x: 0, y: 0, z: -width / 2, nx: 0, ny: 0.894, nz: -0.447, u: 0, v: 0 });
    vertices.push({ x: 0, y: 0, z: width / 2, nx: 0, ny: 0.894, nz: -0.447, u: 0, v: 1 });
    vertices.push({ x: length, y: height, z: width / 2, nx: 0, ny: 0.894, nz: -0.447, u: 1, v: 1 });
    vertices.push({ x: length, y: height, z: -width / 2, nx: 0, ny: 0.894, nz: -0.447, u: 1, v: 0 });
    indices.push(0, 1, 2, 0, 2, 3);
    
    // Bottom
    let base = vertices.length;
    vertices.push({ x: 0, y: 0, z: -width / 2, nx: 0, ny: -1, nz: 0, u: 0, v: 0 });
    vertices.push({ x: 0, y: 0, z: width / 2, nx: 0, ny: -1, nz: 0, u: 0, v: 1 });
    vertices.push({ x: length, y: 0, z: width / 2, nx: 0, ny: -1, nz: 0, u: 1, v: 1 });
    vertices.push({ x: length, y: 0, z: -width / 2, nx: 0, ny: -1, nz: 0, u: 1, v: 0 });
    indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
    
    // Back
    base = vertices.length;
    vertices.push({ x: length, y: 0, z: -width / 2, nx: 1, ny: 0, nz: 0, u: 0, v: 0 });
    vertices.push({ x: length, y: 0, z: width / 2, nx: 1, ny: 0, nz: 0, u: 1, v: 0 });
    vertices.push({ x: length, y: height, z: width / 2, nx: 1, ny: 0, nz: 0, u: 1, v: 1 });
    vertices.push({ x: length, y: height, z: -width / 2, nx: 1, ny: 0, nz: 0, u: 0, v: 1 });
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    
    // Sides
    base = vertices.length;
    vertices.push({ x: 0, y: 0, z: -width / 2, nx: 0, ny: 0, nz: -1, u: 0, v: 0 });
    vertices.push({ x: length, y: 0, z: -width / 2, nx: 0, ny: 0, nz: -1, u: 1, v: 0 });
    vertices.push({ x: length, y: height, z: -width / 2, nx: 0, ny: 0, nz: -1, u: 1, v: 1 });
    indices.push(base, base + 1, base + 2);
    
    base = vertices.length;
    vertices.push({ x: 0, y: 0, z: width / 2, nx: 0, ny: 0, nz: 1, u: 0, v: 0 });
    vertices.push({ x: length, y: height, z: width / 2, nx: 0, ny: 0, nz: 1, u: 1, v: 1 });
    vertices.push({ x: length, y: 0, z: width / 2, nx: 0, ny: 0, nz: 1, u: 1, v: 0 });
    indices.push(base, base + 1, base + 2);
    
    return { vertices, indices };
}

function generateManualPadGeometry() {
    return generateBoxGeometry(4, 0.3, 2, 0, 0.15, 0);
}

function generateBenchGeometry() {
    const allVertices = [];
    const allIndices = [];
    
    // Seat
    const seat = generateBoxGeometry(2.0, 0.1, 0.5, 0, 0.5, 0);
    allVertices.push(...seat.vertices);
    allIndices.push(...seat.indices);
    
    // Legs
    for (const xOff of [-0.8, 0.8]) {
        const base = allVertices.length;
        const leg = generateBoxGeometry(0.1, 0.5, 0.5, xOff, 0.25, 0);
        allVertices.push(...leg.vertices);
        allIndices.push(...leg.indices.map(i => i + base));
    }
    
    return { vertices: allVertices, indices: allIndices };
}

function generateTrashCanGeometry() {
    return generateBoxGeometry(0.6, 0.8, 0.6, 0, 0.4, 0);
}

const GEOMETRY_GENERATORS = {
    'ground-flat': generateGroundGeometry,
    'ground-slope': generateSlopeGeometry,
    'quarter-pipe': generateQuarterPipeGeometry,
    'half-pipe': generateQuarterPipeGeometry,
    'kicker': generateKickerGeometry,
    'pyramid': generatePyramidGeometry,
    'rail-flat': generateRailGeometry,
    'rail-down': generateRailGeometry,
    'ledge': generateLedgeGeometry,
    'manual-pad': generateManualPadGeometry,
    'stairs-3': () => generateStairsGeometry(3),
    'stairs-5': () => generateStairsGeometry(5),
    'stairs-hubba': () => generateStairsGeometry(4),
    'bench': generateBenchGeometry,
    'trash-can': generateTrashCanGeometry,
};

function transformVertex(v, pos, rotY, scale) {
    let x = v.x * scale;
    let y = v.y * scale;
    let z = v.z * scale;
    
    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);
    const newX = x * cos - z * sin;
    const newZ = x * sin + z * cos;
    const newNx = v.nx * cos - v.nz * sin;
    const newNz = v.nx * sin + v.nz * cos;
    
    return {
        x: (newX + pos.x) * TS_SCALE,
        y: (y + pos.y) * TS_SCALE,
        z: (newZ + pos.z) * TS_SCALE,
        nx: newNx, ny: v.ny, nz: newNz,
        u: v.u, v: v.v
    };
}

function generateTrueSkateGeometryFile(meshes) {
    const lines = [];
    
    // Header
    lines.push('84', '65', '83', '75', '1003 #Version', '<VIS ', '17');
    
    // Textures
    lines.push('1 #Num Textures', 'concrete_gray');
    
    // Materials - full format matching True Skate
    const materials = [
        [128, 128, 130], [100, 100, 105], [85, 85, 90],
        [180, 180, 180], [136, 85, 51], [139, 69, 19]
    ];
    lines.push(`${materials.length} #Num Materials`);
    
    for (const [r, g, b] of materials) {
        lines.push('#Material');
        lines.push('1 #Material Type (Solid)');
        lines.push('#Color');
        lines.push(String(r), String(g), String(b), '255');
        lines.push('1.000000 #Specular');
        lines.push('5.500000 #G Blend Sharpness');
        lines.push('0.800000 #G Blend Level');
        lines.push('0.500000 #G Blend Mode');
        lines.push('#G Shadow Color');
        lines.push('180', '180', '180', '255');
        lines.push('#G Highlight Color');
        lines.push('255', '255', '255', '255');
        lines.push('0.000000 #G Ignore Base Color');
        lines.push('0.300000 #G Specular');
        lines.push('5.500000 #B Blend Sharpness');
        lines.push('0.800000 #B Blend Level');
        lines.push('0.500000 #B Blend Mode');
        lines.push('#B Shadow Color');
        lines.push('200', '200', '200', '255');
        lines.push('#B Highlight Color');
        lines.push('255', '255', '255', '255');
        lines.push('0.000000 #B Ignore Base Color');
        lines.push('0.300000 #B Specular');
        lines.push('1 #Num Layers');
        lines.push('0 #Texture index');
    }
    
    // Total vertices and mesh count
    const totalVerts = meshes.reduce((sum, m) => sum + m.vertices.length, 0);
    lines.push(`${totalVerts} #Num Vertices`);
    lines.push(`${meshes.length}`);  // Number of meshes
    
    // Mesh headers - #Mesh comes BEFORE each mesh's data
    for (const mesh of meshes) {
        lines.push('#Mesh');
        lines.push(`${mesh.indices.length} #Num Indices`, `${mesh.vertices.length} #Num Vertices`);
        lines.push('#Normals (Flags |= 0x1)', '1 #Flags', '2 #Num Colour Sets', '2 #Num Uv Sets');
    }
    
    // Vertex data
    for (const mesh of meshes) {
        for (const v of mesh.vertices) {
            lines.push(v.nx.toFixed(6), v.ny.toFixed(6), v.nz.toFixed(6));
            lines.push(v.x.toFixed(6), v.y.toFixed(6), v.z.toFixed(6));
            lines.push(v.u.toFixed(6), v.v.toFixed(6), v.u.toFixed(6), v.v.toFixed(6));
            lines.push('255', '255', '255', '255', '255', '255', '255', '255');
        }
    }
    
    // Indices
    for (const mesh of meshes) {
        for (const idx of mesh.indices) {
            lines.push(String(idx));
        }
    }
    
    // Close VIS section
    lines.push('>');
    
    // COL section - Collision geometry (same as visual for skating)
    lines.push('<COL ');
    lines.push(`${totalVerts} #Num Vertices`);
    
    // Collision vertices (simplified - just positions)
    for (const mesh of meshes) {
        for (const v of mesh.vertices) {
            lines.push(v.x.toFixed(6));
            lines.push(v.y.toFixed(6));
            lines.push(v.z.toFixed(6));
        }
    }
    
    // Collision indices
    const totalIndices = meshes.reduce((sum, m) => sum + m.indices.length, 0);
    lines.push(`${totalIndices / 3} #Num Triangles`);
    
    let indexOffset = 0;
    for (const mesh of meshes) {
        for (let i = 0; i < mesh.indices.length; i += 3) {
            lines.push(String(mesh.indices[i] + indexOffset));
            lines.push(String(mesh.indices[i + 1] + indexOffset));
            lines.push(String(mesh.indices[i + 2] + indexOffset));
            lines.push('0'); // Material/flag
        }
        indexOffset += mesh.vertices.length;
    }
    
    lines.push('>');
    
    // EDGE section
    lines.push('<EDGE');
    lines.push('0 #Num Edges');
    lines.push('>');
    
    // VOLU section  
    lines.push('<VOLU');
    lines.push('0');
    lines.push('>');
    
    return lines.join('\n');
}

function generateModJson(name) {
    return `"modWorldInfo":
{
\t"name":"${name}",
\t"fileName":"${name.replace(/\s+/g, '_').toLowerCase()}.txt"
\t"startPositions":
\t[
\t\t\t"startPosition":
\t\t\t{ 
\t\t\t\t"x":0.0, 
\t\t\t\t"y":0.0, 
\t\t\t\t"z":5.0
\t\t\t\t"angle":0.0
\t\t\t}
\t\t\t"startPosition":
\t\t\t{ 
\t\t\t\t"x":10.0, 
\t\t\t\t"y":0.0, 
\t\t\t\t"z":0.0
\t\t\t\t"angle":90.0
\t\t\t}
\t],
\t"skyBoxUp":"sky_top.jpg"
\t"skyBoxForward":"sky_front.jpg"
\t"skyBoxBack":"sky_back.jpg"
\t"skyBoxLeft":"sky_left.jpg"
\t"skyBoxRight":"sky_right.jpg"

\t"specularBoxUp":"sky_top.jpg"
\t"specularBoxForward":"sky_front.jpg"
\t"specularBoxBack":"sky_back.jpg"
\t"specularBoxLeft":"sky_left.jpg"
\t"specularBoxRight":"sky_right.jpg"
\t"specularBoxDown":"sky_bottom.jpg"

\t"skyAngle":90.0
\t"gamma":1.0

\t"colorBackground": { "r": 0.5, "g": 0.7, "b": 1.0 },
\t"colorLightingDirect": { "r": 1.0, "g": 0.95, "b": 0.9},
\t"colorLightingAmbient": { "r": 0.4, "g": 0.45, "b": 0.5},
\t"lightDirection": { "x": 45.0, "y": 60.0, "z":180.0 }
}`;
}

// Simple gray texture as base64 data URL
function generateGrayTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 256, 256);
    // Add some noise for texture
    for (let i = 0; i < 1000; i++) {
        const x = Math.random() * 256;
        const y = Math.random() * 256;
        const gray = 120 + Math.random() * 30;
        ctx.fillStyle = `rgb(${gray},${gray},${gray})`;
        ctx.fillRect(x, y, 2, 2);
    }
    return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
}

function generateSkyTexture(color) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, '#ffffff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
    return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
}

async function exportToTrueSkate() {
    if (state.objects.length === 0) {
        alert('Add some objects first!');
        return;
    }
    
    const parkName = prompt('Enter skatepark name:', 'My Skatepark');
    if (!parkName) return;
    
    const safeName = parkName.replace(/\s+/g, '_').toLowerCase();
    
    // Show loading
    document.getElementById('btn-export').textContent = 'EXPORTING...';
    document.getElementById('btn-export').disabled = true;
    
    try {
        // Generate meshes
        const meshes = [];
        
        // Ground plane first
        const groundGeo = generateGroundGeometry(50);
        meshes.push({
            vertices: groundGeo.vertices.map(v => transformVertex(v, { x: 0, y: -0.25, z: 0 }, 0, 1)),
            indices: groundGeo.indices
        });
        
        // User objects
        for (const obj of state.objects) {
            const generator = GEOMETRY_GENERATORS[obj.userData.type];
            if (generator) {
                const geo = generator();
                meshes.push({
                    vertices: geo.vertices.map(v => transformVertex(v, obj.position, obj.rotation.y, obj.scale.x)),
                    indices: geo.indices
                });
            }
        }
        
        // Generate files
        const geometryFile = generateTrueSkateGeometryFile(meshes);
        const modJson = generateModJson(parkName);
        
        // Create zip
        const zip = new JSZip();
        zip.file(`${safeName}.txt`, geometryFile);
        zip.file('_mod.json', modJson);
        zip.file('concrete_gray.jpg', generateGrayTexture(), { base64: true });
        zip.file('sky_top.jpg', generateSkyTexture('#87CEEB'), { base64: true });
        zip.file('sky_front.jpg', generateSkyTexture('#ADD8E6'), { base64: true });
        zip.file('sky_back.jpg', generateSkyTexture('#ADD8E6'), { base64: true });
        zip.file('sky_left.jpg', generateSkyTexture('#ADD8E6'), { base64: true });
        zip.file('sky_right.jpg', generateSkyTexture('#ADD8E6'), { base64: true });
        zip.file('sky_bottom.jpg', generateGrayTexture(), { base64: true });
        
        // Download
        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeName}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        
        alert(`Exported "${parkName}" with ${state.objects.length} objects!\n\nUpload the .zip file to mod.io to play it on your phone!`);
        
    } catch (error) {
        console.error('Export error:', error);
        alert('Export failed: ' + error.message);
    } finally {
        document.getElementById('btn-export').textContent = 'EXPORT';
        document.getElementById('btn-export').disabled = false;
    }
}

// ========================================
// RENDER LOOP
// ========================================

function animate() {
    requestAnimationFrame(animate);
    
    state.controls.update();
    state.renderer.render(state.scene, state.camera);
}

// ========================================
// START
// ========================================

// Wait for DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

