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
// EXPORT
// ========================================

function exportToTrueSkate() {
    if (state.objects.length === 0) {
        alert('Add some objects first!');
        return;
    }
    
    // For now, export as JSON that we can later convert
    const exportData = {
        version: '1.0',
        name: 'My Skatepark',
        objects: state.objects.map(obj => ({
            type: obj.userData.type,
            name: obj.userData.name,
            position: {
                x: obj.position.x,
                y: obj.position.y,
                z: obj.position.z
            },
            rotation: {
                y: obj.rotation.y
            },
            scale: obj.scale.x
        }))
    };
    
    // Download as JSON
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'skatepark.json';
    a.click();
    URL.revokeObjectURL(url);
    
    console.log('Exported:', exportData);
    alert(`Exported ${state.objects.length} objects!\n\nNote: Full True Skate format export coming soon.`);
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

