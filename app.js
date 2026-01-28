// ========================================
// TRUE SKATE MAP MAKER - Main Application
// ========================================

import * as THREE from 'three';

// ========================================
// MAP ANALYZER - Debug tool to understand True Skate format
// Call window.analyzeMap(file) from console with a .zip file
// ========================================
window.analyzeMap = async function(file) {
    console.log('🔍 ANALYZING TRUE SKATE MAP:', file.name);
    console.log('='.repeat(60));
    
    const JSZip = (await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm')).default;
    const zip = await JSZip.loadAsync(file);
    
    // Find the geometry file
    let geoContent = null;
    for (const [name, zipFile] of Object.entries(zip.files)) {
        // Skip _mod.json but allow .txt files with "mod" in name (like MacbaMod.txt)
        if (name.endsWith('.txt') && !name.endsWith('_mod.json')) {
            geoContent = await zipFile.async('string');
            console.log(`📄 Found geometry file: ${name}`);
            break;
        }
    }
    
    if (!geoContent) {
        console.error('No geometry file found!');
        return;
    }
    
    const lines = geoContent.split('\n').map(l => l.trim());
    let i = 0;
    
    // Header
    console.log('\n📋 HEADER:');
    console.log(`  Magic: ${lines[0]} ${lines[1]} ${lines[2]} ${lines[3]} (TASK)`);
    i = 4;
    console.log(`  Version: ${lines[i++]}`);
    
    // Skip to VIS
    while (i < lines.length && !lines[i].startsWith('<VIS')) i++;
    console.log(`  VIS section at line: ${i}`);
    i++;
    console.log(`  Unknown value: ${lines[i++]}`);
    
    // Textures
    const numTextures = parseInt(lines[i++]);
    console.log(`\n🎨 TEXTURES (${numTextures}):`);
    const textures = [];
    for (let t = 0; t < numTextures; t++) {
        textures.push(lines[i++]);
        console.log(`  ${t}: ${textures[t]}`);
    }
    
    // Materials
    const numMaterials = parseInt(lines[i++].split('#')[0]);
    console.log(`\n🎭 MATERIALS (${numMaterials}):`);
    
    const materials = [];
    for (let m = 0; m < numMaterials; m++) {
        // Skip #Material marker if present
        if (lines[i] === '#Material') i++;
        
        const matType = parseInt(lines[i++]);
        if (lines[i] === '#Color') i++;
        const r = parseInt(lines[i++]);
        const g = parseInt(lines[i++]);
        const b = parseInt(lines[i++]);
        const a = parseInt(lines[i++]);
        
        const specular = parseFloat(lines[i++]);
        
        // Skip G/B channel settings
        for (let skip = 0; skip < 14; skip++) i++;
        
        const numLayers = parseInt(lines[i++]);
        const texIndices = [];
        for (let l = 0; l < numLayers; l++) {
            texIndices.push(parseInt(lines[i++]));
        }
        
        materials.push({ type: matType, color: {r,g,b,a}, specular, texIndices });
        
        // Show first 5 and last 2
        if (m < 5 || m >= numMaterials - 2) {
            console.log(`  ${m}: Color(${r},${g},${b},${a}) Tex:[${texIndices.join(',')}] -> "${textures[texIndices[0]] || 'N/A'}"`);
        } else if (m === 5) {
            console.log(`  ... (${numMaterials - 7} more materials) ...`);
        }
    }
    
    // Analyze material colors
    const colorCounts = {};
    materials.forEach(m => {
        const key = `${m.color.r},${m.color.g},${m.color.b}`;
        colorCounts[key] = (colorCounts[key] || 0) + 1;
    });
    console.log('\n📊 Material Color Distribution:');
    Object.entries(colorCounts).sort((a,b) => b[1] - a[1]).slice(0, 10).forEach(([color, count]) => {
        console.log(`  RGB(${color}): ${count} materials`);
    });
    
    // Mesh info
    const totalVerts = parseInt(lines[i++].split('#')[0]);
    const numMeshes = parseInt(lines[i++]);
    console.log(`\n🔷 MESHES (${numMeshes}, ${totalVerts} total vertices):`);
    
    if (numMeshes !== numMaterials) {
        console.error(`  ⚠️ MISMATCH: ${numMeshes} meshes vs ${numMaterials} materials!`);
    } else {
        console.log(`  ✅ Mesh count matches material count`);
    }
    
    // Skip mesh headers and vertex data to find collision
    console.log('\n🔍 Looking for collision section...');
    while (i < lines.length && !lines[i].startsWith('<COL')) i++;
    
    if (i < lines.length) {
        console.log(`\n💥 COLLISION SECTION at line ${i}:`);
        i++;
        const numColVerts = parseInt(lines[i++]);
        console.log(`  Collision vertices: ${numColVerts}`);
        
        // Skip collision vertices
        i += numColVerts * 3;
        
        const numPolys = parseInt(lines[i++].split('#')[0]);
        console.log(`  Collision polygons: ${numPolys}`);
        
        // Analyze collision flags
        const flagCounts = {};
        let polyCount = 0;
        while (polyCount < numPolys && i < lines.length) {
            if (lines[i] === '#Polygon') {
                i++;
                const numPolyVerts = parseInt(lines[i++]);
                i += numPolyVerts; // Skip indices
                i += 3; // Skip normal
                const flags = parseInt(lines[i++]);
                flagCounts[flags] = (flagCounts[flags] || 0) + 1;
                polyCount++;
            } else {
                i++;
            }
        }
        
        console.log('\n📊 Collision Flag Distribution:');
        Object.entries(flagCounts).sort((a,b) => b[1] - a[1]).forEach(([flag, count]) => {
            let meaning = 'Unknown';
            if (flag === '1310720') meaning = 'Flat ground (skateable)';
            else if (flag === '2097152') meaning = 'Ramp (skateable)';
            else if (flag === '0') meaning = 'Obstacle (not skateable)';
            console.log(`  ${flag}: ${count} polygons - ${meaning}`);
        });
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📋 SUMMARY:');
    console.log(`  Textures: ${numTextures}`);
    console.log(`  Materials: ${numMaterials}`);
    console.log(`  Meshes: ${numMeshes}`);
    console.log(`  Total Vertices: ${totalVerts}`);
    console.log('='.repeat(60));
    
    return { textures, materials, numMeshes, totalVerts };
};
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js';
import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
// Texture library (inline to avoid import issues)
const TEXTURE_LIBRARY = {
    'tree-oak': { trunk: 'bark09.png', leaves: 'green_leaves_scattered_alpha.png' },
    'tree-pine': { trunk: 'bark09.png', leaves: 'green_leaves_scattered_alpha.png' },
    'tree-palm': { trunk: 'ENT_PlamtreeTrunk_D.png', leaves: 'ENT_Plamtree_D.png' },
    'bush': { main: 'quixel_shrub1a_alpha.png' },
    'hedge': { main: 'quixel_shrub1a_alpha.png' },
    'building-small': { main: 'TCom_BrickLargeBare0090_1_seamless_S.jpg' },
    'building-shop': { main: 'macba_building_11_etc1.png' },
    'building-garage': { main: 'metal_sheets.jpg' },
    'building-warehouse': { main: 'metal_sheets.jpg' },
    'lamp-post': { main: 'lightpole_black_metal.png' },
    'parked-car': { body: 'metal_sheets.jpg' },
    'grass-patch': { main: '2017tampa_grass_etc1.png' },
    'road-segment': { main: '2k_Asphalt_Albedo.jpg' }
};
const BEST_TEXTURES = {};
// ========================================
// MOD.IO BROWSER CLASS (inline to avoid import issues)
// ========================================

const MODIO_API_URL = 'https://api.mod.io/v1';
const TRUESKATE_GAME_ID = 629;
// Note: mod.io public API - no key needed for browsing public mods
const CORS_PROXIES = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?'
];

// Popular True Skate maps - cached to avoid API key requirement
const POPULAR_TRUESKATE_MAPS = [
    { id: 1, name: 'Warehouse Classic', thumbnail: 'https://thumb.modcdn.io/mods/3f34/1/logo_original.png', description: 'Classic warehouse skatepark' },
    { id: 2, name: 'School Yard', thumbnail: 'https://thumb.modcdn.io/mods/3f34/2/logo_original.png', description: 'Urban school environment' },
    { id: 3, name: 'Street Plaza', thumbnail: 'https://thumb.modcdn.io/mods/3f34/3/logo_original.png', description: 'Street skating spot' },
    { id: 4, name: 'Mega Ramp', thumbnail: 'https://thumb.modcdn.io/mods/3f34/4/logo_original.png', description: 'Giant ramp for big airs' },
    { id: 5, name: 'Venice Beach', thumbnail: 'https://thumb.modcdn.io/mods/3f34/5/logo_original.png', description: 'Iconic Venice Beach park' },
];

class ModioBrowser {
    constructor() {
        this.mods = [];
        this.allMods = [];
        this.totalMods = 0;
        this.isLoading = false;
        this.apiKey = localStorage.getItem('modio_api_key') || '';
    }
    
    setApiKey(key) {
        this.apiKey = key;
        localStorage.setItem('modio_api_key', key);
    }
    
    async fetchAllMods(maxMods = 200) {
        if (this.allMods.length > 0) return this.allMods;
        
        this.isLoading = true;
        
        // If no API key, use sample data
        if (!this.apiKey) {
            console.log('ℹ️ No API key - using sample maps. Get a key at https://mod.io/me/access');
            this.allMods = POPULAR_TRUESKATE_MAPS;
            this.isLoading = false;
            return this.allMods;
        }
        
        const allMods = [];
        let offset = 0;
        
        console.log('📡 Loading mods from mod.io...');
        
        while (allMods.length < maxMods) {
            const mods = await this.fetchModsPage(offset, 100);
            if (!mods || mods.length === 0) break;
            allMods.push(...mods);
            offset += 100;
            console.log(`  Loaded ${allMods.length} mods...`);
            await new Promise(r => setTimeout(r, 100));
        }
        
        this.allMods = allMods;
        this.isLoading = false;
        console.log(`✅ Loaded ${this.allMods.length} mods`);
        return this.allMods;
    }
    
    async fetchModsPage(offset = 0, limit = 100) {
        const params = new URLSearchParams({
            _offset: offset,
            _limit: limit,
            _sort: '_popular',
            api_key: this.apiKey
        });
        
        const targetUrl = `${MODIO_API_URL}/games/${TRUESKATE_GAME_ID}/mods?${params}`;
        console.log('🔗 Fetching:', targetUrl);
        
        for (const proxy of CORS_PROXIES) {
            try {
                console.log(`  Trying proxy: ${proxy.substring(0, 30)}...`);
                const response = await fetch(proxy + encodeURIComponent(targetUrl));
                console.log(`  Response status: ${response.status}`);
                
                if (response.ok) {
                    const text = await response.text();
                    console.log(`  Response length: ${text.length} chars`);
                    
                    try {
                        const data = JSON.parse(text);
                        
                        if (data.error) {
                            console.error('  mod.io error:', data.error.message);
                            continue;
                        }
                        
                        this.totalMods = data.result_total || 0;
                        console.log(`  ✅ Got ${(data.data || []).length} mods (total: ${this.totalMods})`);
                        return data.data || [];
                    } catch (parseErr) {
                        console.error('  Failed to parse JSON:', parseErr.message);
                        continue;
                    }
                }
            } catch (e) {
                console.log(`  Proxy failed: ${e.message}`);
            }
        }
        
        console.error('❌ All proxies failed');
        return [];
    }
    
    async downloadMod(mod) {
        if (!mod.modfile?.download?.binary_url) return null;
        
        const url = mod.modfile.download.binary_url;
        console.log(`📥 Downloading: ${mod.name}`);
        
        for (const proxy of CORS_PROXIES) {
            try {
                const response = await fetch(proxy + encodeURIComponent(url));
                if (response.ok) {
                    const blob = await response.blob();
                    console.log(`✅ Downloaded (${(blob.size/1024/1024).toFixed(1)} MB)`);
                    return blob;
                }
            } catch (e) {
                continue;
            }
        }
        return null;
    }
}

class BulkDownloader {
    constructor() {
        this.allTextures = new Map();
    }
}

// ========================================
// GLOBAL STATE
// ========================================

const state = {
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    transformControls: null,
    raycaster: new THREE.Raycaster(),
    mouse: new THREE.Vector2(),
    objects: [],
    selectedObject: null,
    placingObject: null,
    groundPlane: null,
    gridHelper: null,
    mode: 'SELECT', // SELECT, PLACE
    transformMode: 'translate', // translate, rotate, scale
    snapEnabled: false,
    snapValues: {
        translate: 0.5,
        rotate: Math.PI / 4, // 45 degrees
        scale: 0.25
    },
    customModels: [], // Stores uploaded Poly.cam models
    diyPacks: [], // Stores loaded TrueSkate DIY packs
    diyObjects: [], // Stores DIY objects from packs
    gltfLoader: null,
    dracoLoader: null,
    objLoader: null,
    // Undo/Redo system
    undoStack: [],
    redoStack: [],
    maxUndoLevels: 50,
    isUndoingOrRedoing: false,
    // Starting positions for True Skate export
    startPositions: [],
    selectedSpawnPoint: null,
    // 3D Model Import
    import3D: {
        pendingFile: null,
        loadedMesh: null,
        originalGeometry: null,
        previewScene: null,
        previewRenderer: null,
        previewCamera: null,
        stats: {}
    },
    colladaLoader: null,
    imported3DModels: [] // Stores converted 3D models for placement
};

// ========================================
// UNDO/REDO SYSTEM
// ========================================

/**
 * Save the current state for undo
 * @param {string} actionType - Description of the action (for debugging)
 */
function saveUndoState(actionType = 'action') {
    if (state.isUndoingOrRedoing) return;
    
    // Capture current state of all objects
    const snapshot = state.objects.map(obj => ({
        uuid: obj.uuid,
        type: obj.userData.type,
        name: obj.userData.name,
        customModelId: obj.userData.customModelId,
        diyObjectId: obj.userData.diyObjectId,
        props: obj.userData.props ? { ...obj.userData.props } : null,
        position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
        rotation: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
        scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z }
    }));
    
    // Save selected object UUID
    const selectedUUID = state.selectedObject ? state.selectedObject.uuid : null;
    
    state.undoStack.push({
        action: actionType,
        timestamp: Date.now(),
        snapshot,
        selectedUUID
    });
    
    // Limit stack size
    if (state.undoStack.length > state.maxUndoLevels) {
        state.undoStack.shift();
    }
    
    // Clear redo stack when new action is performed
    state.redoStack = [];
    
    updateUndoRedoButtons();
}

/**
 * Undo the last action
 */
function undo() {
    if (state.undoStack.length === 0) {
        console.log('📜 Nothing to undo');
        return;
    }
    
    // Save current state to redo stack first
    const currentSnapshot = state.objects.map(obj => ({
        uuid: obj.uuid,
        type: obj.userData.type,
        name: obj.userData.name,
        customModelId: obj.userData.customModelId,
        diyObjectId: obj.userData.diyObjectId,
        props: obj.userData.props ? { ...obj.userData.props } : null,
        position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
        rotation: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
        scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z }
    }));
    
    const currentSelectedUUID = state.selectedObject ? state.selectedObject.uuid : null;
    
    state.redoStack.push({
        action: 'redo',
        timestamp: Date.now(),
        snapshot: currentSnapshot,
        selectedUUID: currentSelectedUUID
    });
    
    // Pop and apply the undo state
    const undoState = state.undoStack.pop();
    
    state.isUndoingOrRedoing = true;
    applySnapshot(undoState.snapshot, undoState.selectedUUID);
    state.isUndoingOrRedoing = false;
    
    console.log(`↩️ Undo: ${undoState.action}`);
    updateUndoRedoButtons();
}

/**
 * Redo the last undone action
 */
function redo() {
    if (state.redoStack.length === 0) {
        console.log('📜 Nothing to redo');
        return;
    }
    
    // Save current state to undo stack first
    const currentSnapshot = state.objects.map(obj => ({
        uuid: obj.uuid,
        type: obj.userData.type,
        name: obj.userData.name,
        customModelId: obj.userData.customModelId,
        diyObjectId: obj.userData.diyObjectId,
        props: obj.userData.props ? { ...obj.userData.props } : null,
        position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
        rotation: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
        scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z }
    }));
    
    const currentSelectedUUID = state.selectedObject ? state.selectedObject.uuid : null;
    
    state.undoStack.push({
        action: 'before-redo',
        timestamp: Date.now(),
        snapshot: currentSnapshot,
        selectedUUID: currentSelectedUUID
    });
    
    // Pop and apply the redo state
    const redoState = state.redoStack.pop();
    
    state.isUndoingOrRedoing = true;
    applySnapshot(redoState.snapshot, redoState.selectedUUID);
    state.isUndoingOrRedoing = false;
    
    console.log(`↪️ Redo`);
    updateUndoRedoButtons();
}

/**
 * Apply a snapshot to restore state
 */
function applySnapshot(snapshot, selectedUUID) {
    // Get current object UUIDs
    const currentUUIDs = new Set(state.objects.map(o => o.uuid));
    const snapshotUUIDs = new Set(snapshot.map(s => s.uuid));
    
    // Remove objects that shouldn't exist
    const toRemove = state.objects.filter(o => !snapshotUUIDs.has(o.uuid));
    for (const obj of toRemove) {
        state.scene.remove(obj);
        const idx = state.objects.indexOf(obj);
        if (idx > -1) state.objects.splice(idx, 1);
    }
    
    // Update or create objects from snapshot
    for (const snapObj of snapshot) {
        let obj = state.objects.find(o => o.uuid === snapObj.uuid);
        
        if (obj) {
            // Update existing object's transform
            obj.position.set(snapObj.position.x, snapObj.position.y, snapObj.position.z);
            obj.rotation.set(snapObj.rotation.x, snapObj.rotation.y, snapObj.rotation.z);
            obj.scale.set(snapObj.scale.x, snapObj.scale.y, snapObj.scale.z);
        } else {
            // Need to recreate the object
            if (snapObj.customModelId) {
                // Custom model - recreate from stored template
                const model = state.customModels.find(m => m.id === snapObj.customModelId);
                if (model) {
                    obj = model.scene.clone();
                    obj.userData.type = 'custom-model';
                    obj.userData.name = model.name;
                    obj.userData.customModelId = model.id;
                }
            } else if (snapObj.diyObjectId) {
                // DIY object - recreate from stored template
                const diyObj = state.diyObjects.find(o => o.id === snapObj.diyObjectId);
                if (diyObj && diyObj.mesh) {
                    obj = diyObj.mesh.clone();
                    obj.userData.type = 'diy-object';
                    obj.userData.name = diyObj.name;
                    obj.userData.diyObjectId = diyObj.id;
                    obj.userData.props = snapObj.props;
                }
            } else if (snapObj.type && OBJECT_DEFINITIONS[snapObj.type]) {
                // Built-in object
                const def = OBJECT_DEFINITIONS[snapObj.type];
                const props = snapObj.props || { ...def.defaultProps };
                obj = def.create(props);
                obj.userData.type = snapObj.type;
                obj.userData.name = def.name;
                obj.userData.props = props;
            }
            
            if (obj) {
                obj.position.set(snapObj.position.x, snapObj.position.y, snapObj.position.z);
                obj.rotation.set(snapObj.rotation.x, snapObj.rotation.y, snapObj.rotation.z);
                obj.scale.set(snapObj.scale.x, snapObj.scale.y, snapObj.scale.z);
                
                state.scene.add(obj);
                state.objects.push(obj);
            }
        }
    }
    
    // Restore selection
    deselectObject();
    if (selectedUUID) {
        const objToSelect = state.objects.find(o => o.uuid === selectedUUID);
        if (objToSelect) {
            selectObject(objToSelect);
        }
    }
    
    updateObjectCount();
}

/**
 * Update undo/redo button states
 */
function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');
    
    if (undoBtn) {
        undoBtn.disabled = state.undoStack.length === 0;
        undoBtn.title = state.undoStack.length > 0 
            ? `Undo (${state.undoStack.length})` 
            : 'Nothing to undo';
    }
    
    if (redoBtn) {
        redoBtn.disabled = state.redoStack.length === 0;
        redoBtn.title = state.redoStack.length > 0 
            ? `Redo (${state.redoStack.length})` 
            : 'Nothing to redo';
    }
}

// ========================================
// OBJECT DEFINITIONS WITH CUSTOMIZABLE PROPERTIES
// ========================================

const OBJECT_DEFINITIONS = {
    // Starter floor (large flat area at Y=0)
    'starter-floor': {
        name: 'Starter Floor',
        category: 'ground',
        defaultProps: {
            width: 60,
            depth: 60,
            color: '#505050'
        },
        create: (props) => {
            const geo = new THREE.PlaneGeometry(props.width, props.depth);
            geo.rotateX(-Math.PI / 2);
            const mat = new THREE.MeshStandardMaterial({ 
                color: props.color,
                roughness: 0.9,
                metalness: 0.1,
                side: THREE.DoubleSide
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.receiveShadow = true;
            mesh.userData.isStarterFloor = true;
            return mesh;
        }
    },
    // Ground pieces
    'ground-flat': {
        name: 'Flat Ground',
        category: 'ground',
        defaultProps: {
            width: 10,
            height: 0.5,
            depth: 10,
            color: '#505560'  // Concrete gray
        },
        create: (props) => {
            const geo = new THREE.BoxGeometry(props.width, props.height, props.depth);
            const mat = new THREE.MeshStandardMaterial({ 
                color: props.color,
                roughness: 0.8,
                metalness: 0.1
            });
            return new THREE.Mesh(geo, mat);
        }
    },
    'ground-slope': {
        name: 'Slope',
        category: 'ground',
        defaultProps: {
            length: 5,
            height: 2,
            width: 5,
            color: '#606570'  // Lighter concrete
        },
        create: (props) => {
            const shape = new THREE.Shape();
            shape.moveTo(0, 0);
            shape.lineTo(props.length, 0);
            shape.lineTo(props.length, props.height);
            shape.lineTo(0, 0);
            
            const extrudeSettings = { depth: props.width, bevelEnabled: false };
            const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            geo.rotateY(Math.PI / 2);
            geo.translate(-props.width / 2, 0, props.length / 2);
            
            const mat = new THREE.MeshStandardMaterial({ 
                color: props.color,
                roughness: 0.7
            });
            return new THREE.Mesh(geo, mat);
        }
    },
    
    // Ramps
    'quarter-pipe': {
        name: 'Quarter Pipe',
        category: 'ramp',
        defaultProps: {
            radius: 3,
            width: 6,
            color: '#c4a574'  // Plywood color
        },
        create: (props) => {
            const curve = new THREE.QuadraticBezierCurve(
                new THREE.Vector2(0, 0),
                new THREE.Vector2(0, props.radius),
                new THREE.Vector2(props.radius, props.radius)
            );
            const points = curve.getPoints(16);
            const shape = new THREE.Shape();
            shape.moveTo(0, 0);
            points.forEach(p => shape.lineTo(p.x, p.y));
            shape.lineTo(props.radius, 0);
            shape.lineTo(0, 0);
            
            const extrudeSettings = { depth: props.width, bevelEnabled: false };
            const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            geo.rotateY(Math.PI / 2);
            geo.translate(-props.radius, 0, props.width / 2);
            
            const mat = new THREE.MeshStandardMaterial({ 
                color: props.color,
                roughness: 0.5
            });
            return new THREE.Mesh(geo, mat);
        }
    },
    'half-pipe': {
        name: 'Half Pipe',
        category: 'ramp',
        defaultProps: {
            radius: 3,
            width: 8,
            gap: 6,
            color: '#c4a574'  // Plywood color
        },
        create: (props) => {
            const group = new THREE.Group();
            
            const curve = new THREE.QuadraticBezierCurve(
                new THREE.Vector2(0, 0),
                new THREE.Vector2(0, props.radius),
                new THREE.Vector2(props.radius, props.radius)
            );
            const points = curve.getPoints(16);
            const shape = new THREE.Shape();
            shape.moveTo(0, 0);
            points.forEach(p => shape.lineTo(p.x, p.y));
            shape.lineTo(props.radius, 0);
            shape.lineTo(0, 0);
            
            const extrudeSettings = { depth: props.width, bevelEnabled: false };
            const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            
            const mat = new THREE.MeshStandardMaterial({ 
                color: props.color,
                roughness: 0.5
            });
            
            const qp1 = new THREE.Mesh(geo.clone(), mat);
            qp1.rotation.y = Math.PI / 2;
            qp1.position.set(-props.radius, 0, props.width / 2);
            
            const qp2 = new THREE.Mesh(geo.clone(), mat);
            qp2.rotation.y = -Math.PI / 2;
            qp2.position.set(props.gap + props.radius * 2, 0, -props.width / 2);
            
            // Flat bottom
            const flatGeo = new THREE.BoxGeometry(props.gap, 0.2, props.width);
            const flat = new THREE.Mesh(flatGeo, mat);
            flat.position.set(props.gap / 2 + props.radius, 0.1, 0);
            
            group.add(qp1, qp2, flat);
            return group;
        }
    },
    'kicker': {
        name: 'Kicker Ramp',
        category: 'ramp',
        defaultProps: {
            length: 2,
            height: 1.5,
            width: 3,
            color: '#c4a574'  // Plywood color
        },
        create: (props) => {
            const curve = new THREE.QuadraticBezierCurve(
                new THREE.Vector2(0, 0),
                new THREE.Vector2(props.length * 0.75, 0),
                new THREE.Vector2(props.length, props.height)
            );
            const points = curve.getPoints(12);
            const shape = new THREE.Shape();
            shape.moveTo(0, 0);
            points.forEach(p => shape.lineTo(p.x, p.y));
            shape.lineTo(props.length, 0);
            shape.lineTo(0, 0);
            
            const extrudeSettings = { depth: props.width, bevelEnabled: false };
            const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            geo.rotateY(Math.PI / 2);
            geo.translate(-props.width / 2, 0, props.length / 2);
            
            const mat = new THREE.MeshStandardMaterial({ 
                color: props.color,
                roughness: 0.6
            });
            return new THREE.Mesh(geo, mat);
        }
    },
    'pyramid': {
        name: 'Pyramid',
        category: 'ramp',
        defaultProps: {
            size: 3,
            height: 2,
            color: '#c4a574'  // Plywood color
        },
        create: (props) => {
            // Create pyramid with SEPARATE vertices per face for clean flat shading
            const s = props.size / 2;
            const h = props.height;
            const offset = 0.05; // Offset above ground to prevent z-fighting
            
            // Define corners and apex
            const bl = [-s, offset, -s]; // back-left
            const br = [s, offset, -s];  // back-right
            const fr = [s, offset, s];   // front-right
            const fl = [-s, offset, s];  // front-left
            const apex = [0, h + offset, 0];
            
            // Each face has its own 3 vertices (no sharing = clean normals)
            const positions = [];
            const normals = [];
            
            // Helper to calculate face normal
            const calcNormal = (p1, p2, p3) => {
                const ax = p2[0] - p1[0], ay = p2[1] - p1[1], az = p2[2] - p1[2];
                const bx = p3[0] - p1[0], by = p3[1] - p1[1], bz = p3[2] - p1[2];
                let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
                const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
                if (len > 0) { nx /= len; ny /= len; nz /= len; }
                return [nx, ny, nz];
            };
            
            // Front face (+Z)
            const nFront = calcNormal(fl, apex, fr);
            positions.push(...fl, ...apex, ...fr);
            normals.push(...nFront, ...nFront, ...nFront);
            
            // Right face (+X)
            const nRight = calcNormal(fr, apex, br);
            positions.push(...fr, ...apex, ...br);
            normals.push(...nRight, ...nRight, ...nRight);
            
            // Back face (-Z)
            const nBack = calcNormal(br, apex, bl);
            positions.push(...br, ...apex, ...bl);
            normals.push(...nBack, ...nBack, ...nBack);
            
            // Left face (-X)
            const nLeft = calcNormal(bl, apex, fl);
            positions.push(...bl, ...apex, ...fl);
            normals.push(...nLeft, ...nLeft, ...nLeft);
            
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
            
            const mat = new THREE.MeshStandardMaterial({ 
                color: props.color,
                roughness: 0.6,
                flatShading: true
            });
            return new THREE.Mesh(geo, mat);
        }
    },
    
    // Rails & Ledges
    'rail-flat': {
        name: 'Flat Rail',
        category: 'rail',
        defaultProps: {
            length: 6,
            height: 0.8,
            railRadius: 0.08,
            color: '#c8c8d0'  // Shiny steel
        },
        create: (props) => {
            const group = new THREE.Group();
            
            // Rail bar
            const railGeo = new THREE.CylinderGeometry(props.railRadius, props.railRadius, props.length, 8);
            railGeo.rotateZ(Math.PI / 2);
            const railMat = new THREE.MeshStandardMaterial({ 
                color: props.color,
                metalness: 0.8,
                roughness: 0.2
            });
            const rail = new THREE.Mesh(railGeo, railMat);
            rail.position.y = props.height;
            
            // Supports
            const supportGeo = new THREE.CylinderGeometry(0.05, 0.05, props.height, 8);
            const support1 = new THREE.Mesh(supportGeo, railMat);
            support1.position.set(-props.length / 2 + 0.5, props.height / 2, 0);
            const support2 = new THREE.Mesh(supportGeo, railMat);
            support2.position.set(props.length / 2 - 0.5, props.height / 2, 0);
            
            group.add(rail, support1, support2);
            return group;
        }
    },
    'rail-down': {
        name: 'Down Rail',
        category: 'rail',
        defaultProps: {
            length: 7,
            startHeight: 1.8,
            endHeight: 0.6,
            railRadius: 0.08,
            color: '#c8c8d0'  // Shiny steel
        },
        create: (props) => {
            const group = new THREE.Group();
            
            const railMat = new THREE.MeshStandardMaterial({ 
                color: props.color,
                metalness: 0.8,
                roughness: 0.2
            });
            
            // Calculate angle
            const angle = Math.atan2(props.startHeight - props.endHeight, props.length);
            const railLength = Math.sqrt(Math.pow(props.length, 2) + Math.pow(props.startHeight - props.endHeight, 2));
            
            const railGeo = new THREE.CylinderGeometry(props.railRadius, props.railRadius, railLength, 8);
            railGeo.rotateZ(Math.PI / 2);
            const rail = new THREE.Mesh(railGeo, railMat);
            rail.rotation.z = -angle;
            rail.position.set(0, (props.startHeight + props.endHeight) / 2, 0);
            
            // Supports
            const supportGeo1 = new THREE.CylinderGeometry(0.05, 0.05, props.startHeight, 8);
            const support1 = new THREE.Mesh(supportGeo1, railMat);
            support1.position.set(-props.length / 2, props.startHeight / 2, 0);
            
            const supportGeo2 = new THREE.CylinderGeometry(0.05, 0.05, props.endHeight, 8);
            const support2 = new THREE.Mesh(supportGeo2, railMat);
            support2.position.set(props.length / 2, props.endHeight / 2, 0);
            
            group.add(rail, support1, support2);
            return group;
        }
    },
    'ledge': {
        name: 'Ledge',
        category: 'ledge',
        defaultProps: {
            length: 5,
            height: 0.6,
            depth: 0.8,
            color: '#707580',  // Concrete ledge
            edgeColor: '#d0d0d8'  // Steel edge
        },
        create: (props) => {
            const group = new THREE.Group();
            
            const geo = new THREE.BoxGeometry(props.length, props.height, props.depth);
            geo.translate(0, props.height / 2, 0);
            const mat = new THREE.MeshStandardMaterial({ 
                color: props.color,
                roughness: 0.7
            });
            const mesh = new THREE.Mesh(geo, mat);
            
            // Add metal edge
            const edgeGeo = new THREE.BoxGeometry(props.length, 0.05, 0.05);
            const edgeMat = new THREE.MeshStandardMaterial({ 
                color: props.edgeColor,
                metalness: 0.9,
                roughness: 0.1
            });
            const edge = new THREE.Mesh(edgeGeo, edgeMat);
            edge.position.set(0, props.height, props.depth / 2);
            
            group.add(mesh, edge);
            return group;
        }
    },
    'manual-pad': {
        name: 'Manual Pad',
        category: 'ledge',
        defaultProps: {
            width: 4,
            height: 0.3,
            depth: 2,
            color: '#555555'
        },
        create: (props) => {
            const geo = new THREE.BoxGeometry(props.width, props.height, props.depth);
            geo.translate(0, props.height / 2, 0);
            const mat = new THREE.MeshStandardMaterial({ 
                color: props.color,
                roughness: 0.6
            });
            return new THREE.Mesh(geo, mat);
        }
    },
    
    // Stairs
    'stairs-3': {
        name: '3 Stair',
        category: 'stairs',
        defaultProps: {
            steps: 3,
            stepHeight: 0.4,
            stepDepth: 1,
            stepWidth: 3,
            color: '#555560'
        },
        create: (props) => createStairs(props)
    },
    'stairs-5': {
        name: '5 Stair',
        category: 'stairs',
        defaultProps: {
            steps: 5,
            stepHeight: 0.4,
            stepDepth: 1,
            stepWidth: 3,
            color: '#555560'
        },
        create: (props) => createStairs(props)
    },
    'stairs-hubba': {
        name: 'Hubba Ledge',
        category: 'stairs',
        defaultProps: {
            steps: 4,
            stepHeight: 0.4,
            stepDepth: 1,
            stepWidth: 3,
            color: '#555560',
            hubbaColor: '#777777'
        },
        create: (props) => {
            const group = new THREE.Group();
            
            // Stairs
            const stairs = createStairs(props);
            group.add(stairs);
            
            // Hubba ledge on top
            const totalHeight = props.steps * props.stepHeight;
            const totalDepth = props.steps * props.stepDepth;
            const hubbaLength = Math.sqrt(totalHeight * totalHeight + totalDepth * totalDepth);
            
            const hubbaGeo = new THREE.BoxGeometry(0.5, 0.8, hubbaLength);
            const hubbaMat = new THREE.MeshStandardMaterial({ 
                color: props.hubbaColor,
                roughness: 0.6
            });
            const hubba = new THREE.Mesh(hubbaGeo, hubbaMat);
            hubba.rotation.x = Math.atan2(totalHeight, totalDepth);
            hubba.position.set(props.stepWidth / 2 - 0.25, totalHeight / 2 + 0.4, -totalDepth / 2 + props.stepDepth / 2);
            
            group.add(hubba);
            return group;
        }
    },
    
    // Props
    'bench': {
        name: 'Bench',
        category: 'prop',
        defaultProps: {
            width: 2,
            height: 0.5,
            seatColor: '#8B4513',
            legColor: '#333333'
        },
        create: (props) => {
            const group = new THREE.Group();
            
            // Seat
            const seatGeo = new THREE.BoxGeometry(props.width, 0.1, 0.5);
            const woodMat = new THREE.MeshStandardMaterial({ 
                color: props.seatColor,
                roughness: 0.8
            });
            const seat = new THREE.Mesh(seatGeo, woodMat);
            seat.position.y = props.height;
            
            // Legs
            const legGeo = new THREE.BoxGeometry(0.1, props.height, 0.5);
            const metalMat = new THREE.MeshStandardMaterial({ 
                color: props.legColor,
                metalness: 0.5
            });
            const leg1 = new THREE.Mesh(legGeo, metalMat);
            leg1.position.set(-props.width / 2 + 0.2, props.height / 2, 0);
            const leg2 = new THREE.Mesh(legGeo, metalMat);
            leg2.position.set(props.width / 2 - 0.2, props.height / 2, 0);
            
            group.add(seat, leg1, leg2);
            return group;
        }
    },
    'trash-can': {
        name: 'Trash Can',
        category: 'prop',
        defaultProps: {
            radius: 0.3,
            height: 0.8,
            color: '#2244aa'
        },
        create: (props) => {
            const geo = new THREE.CylinderGeometry(props.radius, props.radius * 0.85, props.height, 12);
            geo.translate(0, props.height / 2, 0);
            const mat = new THREE.MeshStandardMaterial({ 
                color: props.color,
                roughness: 0.4
            });
            return new THREE.Mesh(geo, mat);
        }
    },
    
    // Structure/Building pieces
    'wall': {
        name: 'Wall',
        category: 'structure',
        defaultProps: {
            width: 10,
            height: 8,
            depth: 0.3,
            color: '#a0a8b0'  // Light gray wall
        },
        create: (props) => {
            const group = new THREE.Group();
            
            // Main wall
            const wallGeo = new THREE.BoxGeometry(props.width, props.height, props.depth);
            wallGeo.translate(0, props.height / 2, 0);
            const wallMat = new THREE.MeshStandardMaterial({ 
                color: props.color,
                roughness: 0.9
            });
            const wall = new THREE.Mesh(wallGeo, wallMat);
            group.add(wall);
            
            // Add corrugated metal look with horizontal lines
            const lineMat = new THREE.MeshStandardMaterial({ 
                color: new THREE.Color(props.color).multiplyScalar(0.7),
                roughness: 0.8
            });
            
            const lineCount = Math.floor(props.height / 0.8);
            for (let i = 1; i < lineCount; i++) {
                const lineGeo = new THREE.BoxGeometry(props.width, 0.05, props.depth + 0.02);
                lineGeo.translate(0, i * 0.8, 0);
                const line = new THREE.Mesh(lineGeo, lineMat);
                group.add(line);
            }
            
            return group;
        }
    },
    
    'pillar': {
        name: 'Pillar',
        category: 'structure',
        defaultProps: {
            width: 0.5,
            height: 8,
            depth: 0.5,
            color: '#556070'
        },
        create: (props) => {
            const group = new THREE.Group();
            
            // Main pillar
            const pillarGeo = new THREE.BoxGeometry(props.width, props.height, props.depth);
            pillarGeo.translate(0, props.height / 2, 0);
            const pillarMat = new THREE.MeshStandardMaterial({ 
                color: props.color,
                roughness: 0.7
            });
            const pillar = new THREE.Mesh(pillarGeo, pillarMat);
            group.add(pillar);
            
            // Base
            const baseGeo = new THREE.BoxGeometry(props.width * 1.3, 0.2, props.depth * 1.3);
            baseGeo.translate(0, 0.1, 0);
            const baseMat = new THREE.MeshStandardMaterial({ 
                color: '#404045',
                roughness: 0.8
            });
            const base = new THREE.Mesh(baseGeo, baseMat);
            group.add(base);
            
            return group;
        }
    },
    
    'beam': {
        name: 'Ceiling Beam',
        category: 'structure',
        defaultProps: {
            width: 20,
            height: 0.4,
            depth: 0.3,
            yPos: 8,
            color: '#606878'
        },
        create: (props) => {
            const geo = new THREE.BoxGeometry(props.width, props.height, props.depth);
            geo.translate(0, props.yPos, 0);
            const mat = new THREE.MeshStandardMaterial({ 
                color: props.color,
                roughness: 0.6,
                metalness: 0.3
            });
            return new THREE.Mesh(geo, mat);
        }
    },

    // ========================================
    // ENVIRONMENT OBJECTS - Scenery & Decorations
    // ========================================

    // --- VEGETATION ---
    'tree-oak': {
        name: 'Oak Tree',
        category: 'vegetation',
        defaultProps: {
            trunkHeight: 3,
            trunkRadius: 0.3,
            crownRadius: 2.5,
            trunkColor: '#5c3d2e',
            crownColor: '#2d5a27'
        },
        create: (props) => {
            const group = new THREE.Group();
            
            // Trunk
            const trunkGeo = new THREE.CylinderGeometry(props.trunkRadius * 0.7, props.trunkRadius, props.trunkHeight, 8);
            trunkGeo.translate(0, props.trunkHeight / 2, 0);
            const trunkMat = new THREE.MeshStandardMaterial({ 
                color: props.trunkColor,
                roughness: 0.9
            });
            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            group.add(trunk);
            
            // Crown (multiple spheres for organic look)
            const crownMat = new THREE.MeshStandardMaterial({ 
                color: props.crownColor,
                roughness: 0.85
            });
            
            const positions = [
                [0, 0, 0], [0.8, -0.3, 0.5], [-0.7, -0.2, -0.6], 
                [0.5, 0.4, -0.7], [-0.5, 0.3, 0.8]
            ];
            positions.forEach(([x, y, z]) => {
                const size = props.crownRadius * (0.6 + Math.random() * 0.4);
                const sphereGeo = new THREE.SphereGeometry(size, 8, 6);
                const sphere = new THREE.Mesh(sphereGeo, crownMat);
                sphere.position.set(x, props.trunkHeight + props.crownRadius * 0.6 + y, z);
                sphere.castShadow = true;
                group.add(sphere);
            });
            
            group.castShadow = true;
            return group;
        }
    },
    'tree-pine': {
        name: 'Pine Tree',
        category: 'vegetation',
        defaultProps: {
            height: 6,
            baseRadius: 2,
            trunkColor: '#4a3728',
            foliageColor: '#1e4d2b'
        },
        create: (props) => {
            const group = new THREE.Group();
            
            // Trunk
            const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, props.height * 0.4, 8);
            trunkGeo.translate(0, props.height * 0.2, 0);
            const trunkMat = new THREE.MeshStandardMaterial({ color: props.trunkColor, roughness: 0.9 });
            group.add(new THREE.Mesh(trunkGeo, trunkMat));
            
            // Cone layers
            const foliageMat = new THREE.MeshStandardMaterial({ color: props.foliageColor, roughness: 0.8 });
            const layers = 3;
            for (let i = 0; i < layers; i++) {
                const y = props.height * (0.35 + i * 0.2);
                const radius = props.baseRadius * (1 - i * 0.25);
                const coneGeo = new THREE.ConeGeometry(radius, props.height * 0.35, 8);
                coneGeo.translate(0, y, 0);
                const cone = new THREE.Mesh(coneGeo, foliageMat);
                cone.castShadow = true;
                group.add(cone);
            }
            
            return group;
        }
    },
    'tree-palm': {
        name: 'Palm Tree',
        category: 'vegetation',
        defaultProps: {
            height: 7,
            trunkColor: '#8b7355',
            frondColor: '#228b22'
        },
        create: (props) => {
            const group = new THREE.Group();
            
            // Curved trunk
            const curve = new THREE.QuadraticBezierCurve3(
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0.3, props.height * 0.5, 0.2),
                new THREE.Vector3(0, props.height, 0)
            );
            const trunkGeo = new THREE.TubeGeometry(curve, 12, 0.2, 8, false);
            const trunkMat = new THREE.MeshStandardMaterial({ color: props.trunkColor, roughness: 0.85 });
            group.add(new THREE.Mesh(trunkGeo, trunkMat));
            
            // Palm fronds
            const frondMat = new THREE.MeshStandardMaterial({ 
                color: props.frondColor, 
                roughness: 0.7,
                side: THREE.DoubleSide 
            });
            const frondCount = 8;
            for (let i = 0; i < frondCount; i++) {
                const angle = (i / frondCount) * Math.PI * 2;
                const frondGeo = new THREE.PlaneGeometry(0.4, 2.5);
                frondGeo.translate(0, 1.25, 0);
                const frond = new THREE.Mesh(frondGeo, frondMat);
                frond.position.set(0, props.height, 0);
                frond.rotation.y = angle;
                frond.rotation.x = -0.8;
                group.add(frond);
            }
            
            return group;
        }
    },
    'bush': {
        name: 'Bush',
        category: 'vegetation',
        defaultProps: {
            radius: 0.8,
            height: 0.6,
            color: '#3a6b35'
        },
        create: (props) => {
            const group = new THREE.Group();
            const mat = new THREE.MeshStandardMaterial({ color: props.color, roughness: 0.85 });
            
            // Multiple overlapping spheres
            const positions = [[0, 0, 0], [0.3, 0.1, 0.2], [-0.25, 0.05, -0.2]];
            positions.forEach(([x, y, z]) => {
                const r = props.radius * (0.6 + Math.random() * 0.4);
                const geo = new THREE.SphereGeometry(r, 8, 6);
                geo.scale(1, props.height / props.radius, 1);
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(x, props.height * 0.5, z);
                mesh.castShadow = true;
                group.add(mesh);
            });
            
            return group;
        }
    },
    'hedge': {
        name: 'Hedge',
        category: 'vegetation',
        defaultProps: {
            length: 4,
            height: 1.2,
            width: 0.8,
            color: '#2d5a27'
        },
        create: (props) => {
            const geo = new THREE.BoxGeometry(props.length, props.height, props.width);
            geo.translate(0, props.height / 2, 0);
            const mat = new THREE.MeshStandardMaterial({ color: props.color, roughness: 0.9 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.castShadow = true;
            return mesh;
        }
    },
    'flowers': {
        name: 'Flower Bed',
        category: 'vegetation',
        defaultProps: {
            width: 2,
            depth: 1,
            flowerColor: '#ff6b9d',
            leafColor: '#3a7d32'
        },
        create: (props) => {
            const group = new THREE.Group();
            
            // Green base
            const baseGeo = new THREE.BoxGeometry(props.width, 0.15, props.depth);
            baseGeo.translate(0, 0.075, 0);
            const baseMat = new THREE.MeshStandardMaterial({ color: props.leafColor, roughness: 0.85 });
            group.add(new THREE.Mesh(baseGeo, baseMat));
            
            // Flowers
            const flowerMat = new THREE.MeshStandardMaterial({ color: props.flowerColor, roughness: 0.7 });
            const count = Math.floor(props.width * props.depth * 4);
            for (let i = 0; i < count; i++) {
                const x = (Math.random() - 0.5) * props.width * 0.8;
                const z = (Math.random() - 0.5) * props.depth * 0.8;
                const geo = new THREE.SphereGeometry(0.08, 6, 4);
                const flower = new THREE.Mesh(geo, flowerMat);
                flower.position.set(x, 0.2 + Math.random() * 0.1, z);
                group.add(flower);
            }
            
            return group;
        }
    },
    'grass-patch': {
        name: 'Grass Patch',
        category: 'vegetation',
        defaultProps: {
            width: 5,
            depth: 5,
            color: '#4a7c3f'
        },
        create: (props) => {
            const geo = new THREE.PlaneGeometry(props.width, props.depth);
            geo.rotateX(-Math.PI / 2);
            geo.translate(0, 0.02, 0);
            const mat = new THREE.MeshStandardMaterial({ 
                color: props.color, 
                roughness: 0.95,
                side: THREE.DoubleSide 
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.receiveShadow = true;
            return mesh;
        }
    },

    // --- BUILDINGS ---
    'building-small': {
        name: 'Small Building',
        category: 'building',
        defaultProps: {
            width: 8,
            height: 6,
            depth: 6,
            wallColor: '#c9b896',
            roofColor: '#8b4513'
        },
        create: (props) => {
            const group = new THREE.Group();
            
            // Main structure
            const wallGeo = new THREE.BoxGeometry(props.width, props.height, props.depth);
            wallGeo.translate(0, props.height / 2, 0);
            const wallMat = new THREE.MeshStandardMaterial({ color: props.wallColor, roughness: 0.85 });
            const walls = new THREE.Mesh(wallGeo, wallMat);
            walls.castShadow = true;
            walls.receiveShadow = true;
            group.add(walls);
            
            // Roof
            const roofGeo = new THREE.ConeGeometry(Math.max(props.width, props.depth) * 0.7, props.height * 0.4, 4);
            roofGeo.rotateY(Math.PI / 4);
            roofGeo.translate(0, props.height + props.height * 0.2, 0);
            const roofMat = new THREE.MeshStandardMaterial({ color: props.roofColor, roughness: 0.7 });
            group.add(new THREE.Mesh(roofGeo, roofMat));
            
            // Door
            const doorGeo = new THREE.BoxGeometry(1, 2, 0.1);
            doorGeo.translate(0, 1, props.depth / 2 + 0.05);
            const doorMat = new THREE.MeshStandardMaterial({ color: '#4a3728', roughness: 0.7 });
            group.add(new THREE.Mesh(doorGeo, doorMat));
            
            // Windows
            const windowMat = new THREE.MeshStandardMaterial({ 
                color: '#88bbdd',
                emissive: '#223344',
                emissiveIntensity: 0.2,
                roughness: 0.3
            });
            [[-2, 3], [2, 3]].forEach(([x, y]) => {
                const winGeo = new THREE.BoxGeometry(1, 1, 0.1);
                winGeo.translate(x, y, props.depth / 2 + 0.05);
                group.add(new THREE.Mesh(winGeo, windowMat));
            });
            
            return group;
        }
    },
    'building-shop': {
        name: 'Shop Building',
        category: 'building',
        defaultProps: {
            width: 10,
            height: 4,
            depth: 8,
            wallColor: '#e8dcc8',
            accentColor: '#c41e3a'
        },
        create: (props) => {
            const group = new THREE.Group();
            
            // Main building
            const wallGeo = new THREE.BoxGeometry(props.width, props.height, props.depth);
            wallGeo.translate(0, props.height / 2, 0);
            const wallMat = new THREE.MeshStandardMaterial({ color: props.wallColor, roughness: 0.85 });
            group.add(new THREE.Mesh(wallGeo, wallMat));
            
            // Awning
            const awningGeo = new THREE.BoxGeometry(props.width * 1.1, 0.15, 2);
            awningGeo.translate(0, props.height * 0.7, props.depth / 2 + 1);
            const awningMat = new THREE.MeshStandardMaterial({ color: props.accentColor, roughness: 0.6 });
            group.add(new THREE.Mesh(awningGeo, awningMat));
            
            // Storefront window
            const windowMat = new THREE.MeshStandardMaterial({ 
                color: '#88ccee',
                roughness: 0.2,
                metalness: 0.3
            });
            const windowGeo = new THREE.BoxGeometry(props.width * 0.8, props.height * 0.5, 0.1);
            windowGeo.translate(0, props.height * 0.35, props.depth / 2 + 0.05);
            group.add(new THREE.Mesh(windowGeo, windowMat));
            
            return group;
        }
    },
    'building-garage': {
        name: 'Garage',
        category: 'building',
        defaultProps: {
            width: 6,
            height: 3.5,
            depth: 7,
            wallColor: '#b8a898',
            doorColor: '#555555'
        },
        create: (props) => {
            const group = new THREE.Group();
            
            // Walls
            const wallGeo = new THREE.BoxGeometry(props.width, props.height, props.depth);
            wallGeo.translate(0, props.height / 2, 0);
            const wallMat = new THREE.MeshStandardMaterial({ color: props.wallColor, roughness: 0.9 });
            group.add(new THREE.Mesh(wallGeo, wallMat));
            
            // Garage door
            const doorGeo = new THREE.BoxGeometry(props.width * 0.85, props.height * 0.75, 0.15);
            doorGeo.translate(0, props.height * 0.375, props.depth / 2 + 0.05);
            const doorMat = new THREE.MeshStandardMaterial({ color: props.doorColor, roughness: 0.5, metalness: 0.4 });
            group.add(new THREE.Mesh(doorGeo, doorMat));
            
            // Door lines
            const lineMat = new THREE.MeshStandardMaterial({ color: '#333333', roughness: 0.4 });
            for (let i = 1; i < 4; i++) {
                const lineGeo = new THREE.BoxGeometry(props.width * 0.85, 0.05, 0.02);
                lineGeo.translate(0, i * props.height * 0.2, props.depth / 2 + 0.15);
                group.add(new THREE.Mesh(lineGeo, lineMat));
            }
            
            return group;
        }
    },
    'building-warehouse': {
        name: 'Warehouse',
        category: 'building',
        defaultProps: {
            width: 20,
            height: 10,
            depth: 15,
            wallColor: '#7a8088',
            roofColor: '#555555'
        },
        create: (props) => {
            const group = new THREE.Group();
            
            // Walls with corrugated look
            const wallMat = new THREE.MeshStandardMaterial({ color: props.wallColor, roughness: 0.8, metalness: 0.2 });
            const wallGeo = new THREE.BoxGeometry(props.width, props.height, props.depth);
            wallGeo.translate(0, props.height / 2, 0);
            const walls = new THREE.Mesh(wallGeo, wallMat);
            walls.castShadow = true;
            walls.receiveShadow = true;
            group.add(walls);
            
            // Flat industrial roof
            const roofGeo = new THREE.BoxGeometry(props.width * 1.05, 0.3, props.depth * 1.05);
            roofGeo.translate(0, props.height + 0.15, 0);
            const roofMat = new THREE.MeshStandardMaterial({ color: props.roofColor, roughness: 0.7 });
            group.add(new THREE.Mesh(roofGeo, roofMat));
            
            // Loading door
            const doorGeo = new THREE.BoxGeometry(4, 4, 0.2);
            doorGeo.translate(-props.width * 0.3, 2, props.depth / 2 + 0.1);
            const doorMat = new THREE.MeshStandardMaterial({ color: '#c4a574', roughness: 0.6 });
            group.add(new THREE.Mesh(doorGeo, doorMat));
            
            return group;
        }
    },

    // --- STREET ELEMENTS ---
    'lamp-post': {
        name: 'Street Lamp',
        category: 'street',
        defaultProps: {
            height: 5,
            poleColor: '#2a2a2a',
            lightColor: '#ffffcc'
        },
        create: (props) => {
            const group = new THREE.Group();
            
            // Pole
            const poleGeo = new THREE.CylinderGeometry(0.08, 0.12, props.height, 8);
            poleGeo.translate(0, props.height / 2, 0);
            const poleMat = new THREE.MeshStandardMaterial({ color: props.poleColor, roughness: 0.4, metalness: 0.6 });
            group.add(new THREE.Mesh(poleGeo, poleMat));
            
            // Arm
            const armGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.5, 8);
            armGeo.rotateZ(Math.PI / 2);
            armGeo.translate(0.75, props.height, 0);
            group.add(new THREE.Mesh(armGeo, poleMat));
            
            // Light fixture
            const fixtureGeo = new THREE.CylinderGeometry(0.25, 0.15, 0.3, 8);
            fixtureGeo.translate(1.5, props.height - 0.15, 0);
            const fixtureMat = new THREE.MeshStandardMaterial({ 
                color: props.lightColor,
                emissive: props.lightColor,
                emissiveIntensity: 0.8,
                roughness: 0.3
            });
            group.add(new THREE.Mesh(fixtureGeo, fixtureMat));
            
            return group;
        }
    },
    'stop-sign': {
        name: 'Stop Sign',
        category: 'street',
        defaultProps: {
            height: 2.5,
            signColor: '#cc0000'
        },
        create: (props) => {
            const group = new THREE.Group();
            
            // Pole
            const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, props.height, 8);
            poleGeo.translate(0, props.height / 2, 0);
            const poleMat = new THREE.MeshStandardMaterial({ color: '#888888', roughness: 0.4, metalness: 0.5 });
            group.add(new THREE.Mesh(poleGeo, poleMat));
            
            // Octagon sign
            const shape = new THREE.Shape();
            const size = 0.35;
            for (let i = 0; i < 8; i++) {
                const angle = (i * Math.PI * 2) / 8 - Math.PI / 8;
                const x = Math.cos(angle) * size;
                const y = Math.sin(angle) * size;
                if (i === 0) shape.moveTo(x, y);
                else shape.lineTo(x, y);
            }
            shape.closePath();
            
            const signGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false });
            signGeo.rotateY(Math.PI / 2);
            signGeo.translate(0, props.height + 0.35, 0);
            const signMat = new THREE.MeshStandardMaterial({ color: props.signColor, roughness: 0.5 });
            group.add(new THREE.Mesh(signGeo, signMat));
            
            return group;
        }
    },
    'traffic-cone': {
        name: 'Traffic Cone',
        category: 'street',
        defaultProps: {
            height: 0.7,
            color: '#ff6600'
        },
        create: (props) => {
            const group = new THREE.Group();
            
            // Base
            const baseGeo = new THREE.BoxGeometry(0.4, 0.05, 0.4);
            baseGeo.translate(0, 0.025, 0);
            const baseMat = new THREE.MeshStandardMaterial({ color: '#222222', roughness: 0.7 });
            group.add(new THREE.Mesh(baseGeo, baseMat));
            
            // Cone
            const coneGeo = new THREE.ConeGeometry(0.15, props.height, 12);
            coneGeo.translate(0, props.height / 2 + 0.05, 0);
            const coneMat = new THREE.MeshStandardMaterial({ color: props.color, roughness: 0.5 });
            group.add(new THREE.Mesh(coneGeo, coneMat));
            
            // Reflective stripe
            const stripeGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.08, 12);
            stripeGeo.translate(0, props.height * 0.5, 0);
            const stripeMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 });
            group.add(new THREE.Mesh(stripeGeo, stripeMat));
            
            return group;
        }
    },
    'barrier': {
        name: 'Road Barrier',
        category: 'street',
        defaultProps: {
            length: 2,
            color: '#ff8800'
        },
        create: (props) => {
            const group = new THREE.Group();
            
            // Barrier body
            const bodyGeo = new THREE.BoxGeometry(props.length, 0.8, 0.15);
            bodyGeo.translate(0, 0.6, 0);
            const bodyMat = new THREE.MeshStandardMaterial({ color: props.color, roughness: 0.6 });
            group.add(new THREE.Mesh(bodyGeo, bodyMat));
            
            // Stripes
            const stripeMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 });
            const stripeWidth = props.length / 8;
            for (let i = 0; i < 4; i++) {
                const stripeGeo = new THREE.BoxGeometry(stripeWidth, 0.8, 0.16);
                stripeGeo.translate(-props.length / 2 + stripeWidth + i * stripeWidth * 2, 0.6, 0);
                group.add(new THREE.Mesh(stripeGeo, stripeMat));
            }
            
            // Legs
            const legGeo = new THREE.BoxGeometry(0.6, 0.2, 0.4);
            legGeo.translate(0, 0.1, 0);
            const legMat = new THREE.MeshStandardMaterial({ color: '#333333', roughness: 0.7 });
            const leg1 = new THREE.Mesh(legGeo, legMat);
            leg1.position.x = -props.length / 2 + 0.3;
            const leg2 = new THREE.Mesh(legGeo.clone(), legMat);
            leg2.position.x = props.length / 2 - 0.3;
            group.add(leg1, leg2);
            
            return group;
        }
    },
    'fence-wood': {
        name: 'Wood Fence',
        category: 'street',
        defaultProps: {
            length: 4,
            height: 1.5,
            color: '#8b6914'
        },
        create: (props) => {
            const group = new THREE.Group();
            const mat = new THREE.MeshStandardMaterial({ color: props.color, roughness: 0.85 });
            
            // Posts
            const postGeo = new THREE.BoxGeometry(0.1, props.height, 0.1);
            const postCount = Math.ceil(props.length / 1.5);
            for (let i = 0; i <= postCount; i++) {
                const post = new THREE.Mesh(postGeo, mat);
                post.position.set(-props.length / 2 + i * (props.length / postCount), props.height / 2, 0);
                group.add(post);
            }
            
            // Rails
            const railGeo = new THREE.BoxGeometry(props.length, 0.08, 0.05);
            [0.3, 0.7, 1.1].forEach(h => {
                if (h < props.height) {
                    const rail = new THREE.Mesh(railGeo, mat);
                    rail.position.y = h;
                    group.add(rail);
                }
            });
            
            return group;
        }
    },
    'fence-chain': {
        name: 'Chain Fence',
        category: 'street',
        defaultProps: {
            length: 6,
            height: 2,
            poleColor: '#666666'
        },
        create: (props) => {
            const group = new THREE.Group();
            
            // Posts
            const poleMat = new THREE.MeshStandardMaterial({ color: props.poleColor, roughness: 0.4, metalness: 0.6 });
            const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, props.height, 8);
            [0, 1].forEach(i => {
                const pole = new THREE.Mesh(poleGeo, poleMat);
                pole.position.set(-props.length / 2 + i * props.length, props.height / 2, 0);
                group.add(pole);
            });
            
            // Chain link mesh (simplified)
            const meshMat = new THREE.MeshStandardMaterial({ 
                color: '#888888', 
                wireframe: true,
                transparent: true,
                opacity: 0.6
            });
            const meshGeo = new THREE.PlaneGeometry(props.length, props.height, 20, 10);
            meshGeo.translate(0, props.height / 2, 0);
            group.add(new THREE.Mesh(meshGeo, meshMat));
            
            // Top bar
            const barGeo = new THREE.CylinderGeometry(0.03, 0.03, props.length, 8);
            barGeo.rotateZ(Math.PI / 2);
            barGeo.translate(0, props.height, 0);
            group.add(new THREE.Mesh(barGeo, poleMat));
            
            return group;
        }
    },
    'fire-hydrant': {
        name: 'Fire Hydrant',
        category: 'street',
        defaultProps: {
            color: '#cc2222'
        },
        create: (props) => {
            const group = new THREE.Group();
            const mat = new THREE.MeshStandardMaterial({ color: props.color, roughness: 0.5 });
            
            // Body
            const bodyGeo = new THREE.CylinderGeometry(0.15, 0.18, 0.6, 12);
            bodyGeo.translate(0, 0.3, 0);
            group.add(new THREE.Mesh(bodyGeo, mat));
            
            // Top
            const topGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.15, 6);
            topGeo.translate(0, 0.65, 0);
            group.add(new THREE.Mesh(topGeo, mat));
            
            // Cap
            const capGeo = new THREE.SphereGeometry(0.1, 8, 4);
            capGeo.translate(0, 0.75, 0);
            group.add(new THREE.Mesh(capGeo, mat));
            
            // Side outlets
            const outletGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.15, 8);
            outletGeo.rotateZ(Math.PI / 2);
            [0, Math.PI].forEach(angle => {
                const outlet = new THREE.Mesh(outletGeo, mat);
                outlet.position.set(Math.cos(angle) * 0.2, 0.4, Math.sin(angle) * 0.2);
                outlet.rotation.y = angle;
                group.add(outlet);
            });
            
            return group;
        }
    },

    // --- PROPS & DECORATIONS ---
    'dumpster': {
        name: 'Dumpster',
        category: 'prop',
        defaultProps: {
            color: '#1a5c1a'
        },
        create: (props) => {
            const group = new THREE.Group();
            
            // Main body
            const bodyGeo = new THREE.BoxGeometry(2, 1.2, 1.2);
            bodyGeo.translate(0, 0.6, 0);
            const bodyMat = new THREE.MeshStandardMaterial({ color: props.color, roughness: 0.7 });
            group.add(new THREE.Mesh(bodyGeo, bodyMat));
            
            // Lid
            const lidGeo = new THREE.BoxGeometry(2.05, 0.08, 0.65);
            lidGeo.translate(0, 1.24, 0.3);
            const lidMat = new THREE.MeshStandardMaterial({ color: '#333333', roughness: 0.6 });
            group.add(new THREE.Mesh(lidGeo, lidMat));
            
            // Wheels
            const wheelMat = new THREE.MeshStandardMaterial({ color: '#222222', roughness: 0.5 });
            const wheelGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12);
            wheelGeo.rotateX(Math.PI / 2);
            [[-0.7, -0.5], [0.7, -0.5], [-0.7, 0.5], [0.7, 0.5]].forEach(([x, z]) => {
                const wheel = new THREE.Mesh(wheelGeo, wheelMat);
                wheel.position.set(x, 0.12, z);
                group.add(wheel);
            });
            
            return group;
        }
    },
    'crate': {
        name: 'Wooden Crate',
        category: 'prop',
        defaultProps: {
            size: 0.8,
            color: '#a67c4c'
        },
        create: (props) => {
            const geo = new THREE.BoxGeometry(props.size, props.size, props.size);
            geo.translate(0, props.size / 2, 0);
            const mat = new THREE.MeshStandardMaterial({ color: props.color, roughness: 0.85 });
            return new THREE.Mesh(geo, mat);
        }
    },
    'barrel': {
        name: 'Barrel',
        category: 'prop',
        defaultProps: {
            color: '#4a7c9b'
        },
        create: (props) => {
            const geo = new THREE.CylinderGeometry(0.35, 0.35, 0.9, 16);
            geo.translate(0, 0.45, 0);
            const mat = new THREE.MeshStandardMaterial({ color: props.color, roughness: 0.6 });
            return new THREE.Mesh(geo, mat);
        }
    },
    'car-parked': {
        name: 'Parked Car',
        category: 'prop',
        defaultProps: {
            bodyColor: '#cc3333',
            windowColor: '#334455'
        },
        create: (props) => {
            const group = new THREE.Group();
            
            // Body
            const bodyGeo = new THREE.BoxGeometry(4, 1, 1.8);
            bodyGeo.translate(0, 0.7, 0);
            const bodyMat = new THREE.MeshStandardMaterial({ color: props.bodyColor, roughness: 0.4, metalness: 0.5 });
            group.add(new THREE.Mesh(bodyGeo, bodyMat));
            
            // Cabin
            const cabinGeo = new THREE.BoxGeometry(2, 0.8, 1.6);
            cabinGeo.translate(0.3, 1.6, 0);
            group.add(new THREE.Mesh(cabinGeo, bodyMat));
            
            // Windows
            const windowMat = new THREE.MeshStandardMaterial({ color: props.windowColor, roughness: 0.2 });
            const windowGeo = new THREE.BoxGeometry(1.9, 0.7, 1.65);
            windowGeo.translate(0.3, 1.6, 0);
            group.add(new THREE.Mesh(windowGeo, windowMat));
            
            // Wheels
            const wheelMat = new THREE.MeshStandardMaterial({ color: '#222222', roughness: 0.5 });
            const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16);
            wheelGeo.rotateX(Math.PI / 2);
            [[-1.2, 0.95], [1.2, 0.95], [-1.2, -0.95], [1.2, -0.95]].forEach(([x, z]) => {
                const wheel = new THREE.Mesh(wheelGeo, wheelMat);
                wheel.position.set(x, 0.3, z);
                group.add(wheel);
            });
            
            return group;
        }
    },
    'picnic-table': {
        name: 'Picnic Table',
        category: 'prop',
        defaultProps: {
            color: '#8b5a2b'
        },
        create: (props) => {
            const group = new THREE.Group();
            const mat = new THREE.MeshStandardMaterial({ color: props.color, roughness: 0.85 });
            
            // Table top
            const topGeo = new THREE.BoxGeometry(2, 0.1, 1);
            topGeo.translate(0, 0.8, 0);
            group.add(new THREE.Mesh(topGeo, mat));
            
            // Benches
            const benchGeo = new THREE.BoxGeometry(2, 0.1, 0.35);
            const bench1 = new THREE.Mesh(benchGeo, mat);
            bench1.position.set(0, 0.5, 0.65);
            const bench2 = new THREE.Mesh(benchGeo.clone(), mat);
            bench2.position.set(0, 0.5, -0.65);
            group.add(bench1, bench2);
            
            // Legs (A-frame)
            const legGeo = new THREE.BoxGeometry(0.1, 0.9, 1.5);
            const leg1 = new THREE.Mesh(legGeo, mat);
            leg1.position.set(-0.7, 0.4, 0);
            const leg2 = new THREE.Mesh(legGeo.clone(), mat);
            leg2.position.set(0.7, 0.4, 0);
            group.add(leg1, leg2);
            
            return group;
        }
    },
    'basketball-hoop': {
        name: 'Basketball Hoop',
        category: 'prop',
        defaultProps: {
            poleColor: '#666666',
            hoopColor: '#ff6600'
        },
        create: (props) => {
            const group = new THREE.Group();
            
            // Pole
            const poleMat = new THREE.MeshStandardMaterial({ color: props.poleColor, roughness: 0.4, metalness: 0.6 });
            const poleGeo = new THREE.CylinderGeometry(0.1, 0.12, 3.5, 8);
            poleGeo.translate(0, 1.75, 0);
            group.add(new THREE.Mesh(poleGeo, poleMat));
            
            // Backboard
            const backboardGeo = new THREE.BoxGeometry(1.2, 0.9, 0.05);
            backboardGeo.translate(0, 3.2, 0.4);
            const backboardMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 });
            group.add(new THREE.Mesh(backboardGeo, backboardMat));
            
            // Rim
            const hoopMat = new THREE.MeshStandardMaterial({ color: props.hoopColor, roughness: 0.4, metalness: 0.5 });
            const rimGeo = new THREE.TorusGeometry(0.23, 0.02, 8, 24);
            rimGeo.rotateX(Math.PI / 2);
            rimGeo.translate(0, 3, 0.65);
            group.add(new THREE.Mesh(rimGeo, hoopMat));
            
            return group;
        }
    },
    'skateboard-rack': {
        name: 'Board Rack',
        category: 'prop',
        defaultProps: {
            color: '#444444'
        },
        create: (props) => {
            const group = new THREE.Group();
            const mat = new THREE.MeshStandardMaterial({ color: props.color, roughness: 0.5, metalness: 0.5 });
            
            // Frame
            const frameGeo = new THREE.BoxGeometry(1.5, 0.8, 0.05);
            frameGeo.translate(0, 0.8, 0);
            group.add(new THREE.Mesh(frameGeo, mat));
            
            // Slots
            const slotGeo = new THREE.BoxGeometry(0.08, 0.6, 0.15);
            for (let i = 0; i < 5; i++) {
                const slot = new THREE.Mesh(slotGeo, mat);
                slot.position.set(-0.6 + i * 0.3, 0.5, 0.1);
                group.add(slot);
            }
            
            // Legs
            const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8);
            [[-0.6, -0.05], [0.6, -0.05], [-0.6, 0.05], [0.6, 0.05]].forEach(([x, z]) => {
                const leg = new THREE.Mesh(legGeo, mat);
                leg.position.set(x, 0.2, z);
                group.add(leg);
            });
            
            return group;
        }
    },
    'graffiti-wall': {
        name: 'Graffiti Wall',
        category: 'prop',
        defaultProps: {
            width: 5,
            height: 3,
            baseColor: '#808080'
        },
        create: (props) => {
            const group = new THREE.Group();
            
            // Base wall
            const wallGeo = new THREE.BoxGeometry(props.width, props.height, 0.3);
            wallGeo.translate(0, props.height / 2, 0);
            const wallMat = new THREE.MeshStandardMaterial({ color: props.baseColor, roughness: 0.9 });
            group.add(new THREE.Mesh(wallGeo, wallMat));
            
            // Colorful graffiti shapes
            const colors = ['#ff1493', '#00ff00', '#00bfff', '#ffa500', '#8b00ff', '#ffff00'];
            for (let i = 0; i < 8; i++) {
                const w = 0.3 + Math.random() * 1;
                const h = 0.2 + Math.random() * 0.8;
                const shapeGeo = new THREE.PlaneGeometry(w, h);
                const x = (Math.random() - 0.5) * props.width * 0.8;
                const y = 0.5 + Math.random() * (props.height - 1);
                shapeGeo.translate(x, y, 0.16);
                const shapeMat = new THREE.MeshStandardMaterial({ 
                    color: colors[Math.floor(Math.random() * colors.length)],
                    roughness: 0.7
                });
                group.add(new THREE.Mesh(shapeGeo, shapeMat));
            }
            
            return group;
        }
    }
};

// Helper function to create stairs
function createStairs(props) {
    const group = new THREE.Group();
    
    const mat = new THREE.MeshStandardMaterial({ 
        color: props.color,
        roughness: 0.7
    });
    
    for (let i = 0; i < props.steps; i++) {
        const geo = new THREE.BoxGeometry(props.stepWidth, props.stepHeight, props.stepDepth);
        const step = new THREE.Mesh(geo, mat);
        step.position.set(0, props.stepHeight * (i + 0.5), -props.stepDepth * i);
        group.add(step);
    }
    
    return group;
}

// ========================================
// PROPERTY DEFINITIONS BY CATEGORY
// ========================================

const PROPERTY_DEFINITIONS = {
    'ground-flat': [
        { key: 'width', label: 'Width', type: 'number', min: 1, max: 50, step: 0.5 },
        { key: 'height', label: 'Height', type: 'number', min: 0.1, max: 5, step: 0.1 },
        { key: 'depth', label: 'Depth', type: 'number', min: 1, max: 50, step: 0.5 },
        { key: 'color', label: 'Color', type: 'color' }
    ],
    'ground-slope': [
        { key: 'length', label: 'Length', type: 'number', min: 1, max: 20, step: 0.5 },
        { key: 'height', label: 'Height', type: 'number', min: 0.5, max: 10, step: 0.5 },
        { key: 'width', label: 'Width', type: 'number', min: 1, max: 20, step: 0.5 },
        { key: 'color', label: 'Color', type: 'color' }
    ],
    'quarter-pipe': [
        { key: 'radius', label: 'Radius', type: 'number', min: 1, max: 10, step: 0.5 },
        { key: 'width', label: 'Width', type: 'number', min: 2, max: 15, step: 0.5 },
        { key: 'color', label: 'Color', type: 'color' }
    ],
    'half-pipe': [
        { key: 'radius', label: 'Radius', type: 'number', min: 1, max: 10, step: 0.5 },
        { key: 'width', label: 'Width', type: 'number', min: 2, max: 15, step: 0.5 },
        { key: 'gap', label: 'Gap', type: 'number', min: 2, max: 15, step: 0.5 },
        { key: 'color', label: 'Color', type: 'color' }
    ],
    'kicker': [
        { key: 'length', label: 'Length', type: 'number', min: 1, max: 10, step: 0.5 },
        { key: 'height', label: 'Height', type: 'number', min: 0.5, max: 5, step: 0.25 },
        { key: 'width', label: 'Width', type: 'number', min: 1, max: 10, step: 0.5 },
        { key: 'color', label: 'Color', type: 'color' }
    ],
    'pyramid': [
        { key: 'size', label: 'Size', type: 'number', min: 1, max: 10, step: 0.5 },
        { key: 'height', label: 'Height', type: 'number', min: 0.5, max: 8, step: 0.5 },
        { key: 'color', label: 'Color', type: 'color' }
    ],
    'rail-flat': [
        { key: 'length', label: 'Length', type: 'number', min: 2, max: 15, step: 0.5 },
        { key: 'height', label: 'Height', type: 'number', min: 0.3, max: 2, step: 0.1 },
        { key: 'railRadius', label: 'Rail Thickness', type: 'number', min: 0.04, max: 0.2, step: 0.02 },
        { key: 'color', label: 'Color', type: 'color' }
    ],
    'rail-down': [
        { key: 'length', label: 'Length', type: 'number', min: 3, max: 20, step: 0.5 },
        { key: 'startHeight', label: 'Start Height', type: 'number', min: 0.5, max: 4, step: 0.1 },
        { key: 'endHeight', label: 'End Height', type: 'number', min: 0.2, max: 3, step: 0.1 },
        { key: 'railRadius', label: 'Rail Thickness', type: 'number', min: 0.04, max: 0.2, step: 0.02 },
        { key: 'color', label: 'Color', type: 'color' }
    ],
    'ledge': [
        { key: 'length', label: 'Length', type: 'number', min: 1, max: 15, step: 0.5 },
        { key: 'height', label: 'Height', type: 'number', min: 0.2, max: 2, step: 0.1 },
        { key: 'depth', label: 'Depth', type: 'number', min: 0.3, max: 3, step: 0.1 },
        { key: 'color', label: 'Color', type: 'color' },
        { key: 'edgeColor', label: 'Edge Color', type: 'color' }
    ],
    'manual-pad': [
        { key: 'width', label: 'Width', type: 'number', min: 1, max: 10, step: 0.5 },
        { key: 'height', label: 'Height', type: 'number', min: 0.1, max: 1, step: 0.05 },
        { key: 'depth', label: 'Depth', type: 'number', min: 0.5, max: 8, step: 0.5 },
        { key: 'color', label: 'Color', type: 'color' }
    ],
    'stairs-3': [
        { key: 'steps', label: 'Steps', type: 'number', min: 1, max: 10, step: 1 },
        { key: 'stepHeight', label: 'Step Height', type: 'number', min: 0.1, max: 1, step: 0.05 },
        { key: 'stepDepth', label: 'Step Depth', type: 'number', min: 0.3, max: 2, step: 0.1 },
        { key: 'stepWidth', label: 'Step Width', type: 'number', min: 1, max: 10, step: 0.5 },
        { key: 'color', label: 'Color', type: 'color' }
    ],
    'stairs-5': [
        { key: 'steps', label: 'Steps', type: 'number', min: 1, max: 15, step: 1 },
        { key: 'stepHeight', label: 'Step Height', type: 'number', min: 0.1, max: 1, step: 0.05 },
        { key: 'stepDepth', label: 'Step Depth', type: 'number', min: 0.3, max: 2, step: 0.1 },
        { key: 'stepWidth', label: 'Step Width', type: 'number', min: 1, max: 10, step: 0.5 },
        { key: 'color', label: 'Color', type: 'color' }
    ],
    'stairs-hubba': [
        { key: 'steps', label: 'Steps', type: 'number', min: 2, max: 10, step: 1 },
        { key: 'stepHeight', label: 'Step Height', type: 'number', min: 0.1, max: 1, step: 0.05 },
        { key: 'stepDepth', label: 'Step Depth', type: 'number', min: 0.3, max: 2, step: 0.1 },
        { key: 'stepWidth', label: 'Step Width', type: 'number', min: 1, max: 10, step: 0.5 },
        { key: 'color', label: 'Stairs Color', type: 'color' },
        { key: 'hubbaColor', label: 'Hubba Color', type: 'color' }
    ],
    'bench': [
        { key: 'width', label: 'Width', type: 'number', min: 1, max: 6, step: 0.5 },
        { key: 'height', label: 'Height', type: 'number', min: 0.3, max: 1, step: 0.1 },
        { key: 'seatColor', label: 'Seat Color', type: 'color' },
        { key: 'legColor', label: 'Leg Color', type: 'color' }
    ],
    'trash-can': [
        { key: 'radius', label: 'Radius', type: 'number', min: 0.15, max: 0.6, step: 0.05 },
        { key: 'height', label: 'Height', type: 'number', min: 0.4, max: 1.5, step: 0.1 },
        { key: 'color', label: 'Color', type: 'color' }
    ]
};

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
    state.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 2000);
    state.camera.position.set(15, 15, 15);
    state.camera.lookAt(0, 0, 0);
    
    // Renderer
    state.renderer = new THREE.WebGLRenderer({ 
        canvas: canvas, 
        antialias: true,
        logarithmicDepthBuffer: true  // Reduces z-fighting on large scenes
    });
    state.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    state.renderer.setPixelRatio(window.devicePixelRatio);
    state.renderer.outputColorSpace = THREE.SRGBColorSpace;  // Correct color output
    state.renderer.shadowMap.enabled = true;
    state.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Controls
    state.controls = new OrbitControls(state.camera, state.renderer.domElement);
    state.controls.enableDamping = true;
    state.controls.dampingFactor = 0.05;
    state.controls.screenSpacePanning = true; // Pan parallel to screen (better for indoor views)
    state.controls.enablePan = true;
    state.controls.panSpeed = 1.0;
    state.controls.rotateSpeed = -1.0; // Invert rotation direction (drag left = rotate view left)
    state.controls.minDistance = 0.5; // Allow getting very close
    state.controls.maxDistance = 500; // Allow zooming out much more for large maps
    state.controls.maxPolarAngle = Math.PI * 0.95; // Allow looking up from below (almost vertical)
    state.controls.minPolarAngle = 0.05; // Allow looking straight down
    
    // Mouse buttons: Left=rotate, Right=pan, Middle=zoom
    state.controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
    };
    
    // Transform Controls (gizmo for moving/rotating/scaling)
    setupTransformControls();
    
    // Lighting
    setupLighting();
    
    // Grid and ground
    setupGround();
    
    // Initialize 3D model loaders for Poly.cam imports
    setupModelLoaders();
    
    // Event listeners
    setupEventListeners();
    
    // Setup object appearance controls
    setupObjectAppearanceControls();
    
    // Setup custom model upload handlers
    setupCustomModelUpload();
    
    // Setup DIY pack upload handlers
    setupDIYPackUpload();
    
    // Setup 3D model import
    setup3DModelImport();
    
    // Setup spawn points system
    setupSpawnPoints();
    
    // Setup resizable sidebars
    setupResizableSidebars();
    
    // Setup templates modal
    setupTemplatesModal();
    
    // Start render loop
    animate();
    
    console.log('🛹 True Skate Map Maker initialized!');
}

function setupModelLoaders() {
    // GLTF/GLB Loader (Poly.cam's primary format)
    state.gltfLoader = new GLTFLoader();
    
    // DRACO decoder for compressed meshes (Poly.cam often uses this)
    state.dracoLoader = new DRACOLoader();
    state.dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/');
    state.gltfLoader.setDRACOLoader(state.dracoLoader);
    
    // OBJ Loader as fallback
    state.objLoader = new OBJLoader();
    
    // MTL Loader for OBJ materials
    state.mtlLoader = new MTLLoader();
    
    // Collada Loader for DAE files (SketchUp export)
    state.colladaLoader = new ColladaLoader();
}

function setupTransformControls() {
    state.transformControls = new TransformControls(state.camera, state.renderer.domElement);
    state.transformControls.setMode('translate');
    state.transformControls.setSize(0.8);
    
    // When using transform controls, disable orbit controls and handle undo
    state.transformControls.addEventListener('dragging-changed', (event) => {
        state.controls.enabled = !event.value;
        
        // Save undo state when dragging starts
        if (event.value && state.selectedObject) {
            saveUndoState('transform');
        }
    });
    
    // Update properties panel when transform changes
    state.transformControls.addEventListener('change', () => {
        if (state.selectedObject) {
            updatePropertiesPanel();
        }
        // Also update spawn point list if a spawn point is selected
        if (state.selectedSpawnPoint) {
            updateSpawnPointsList();
            showSpawnPointProperties(state.selectedSpawnPoint);
        }
    });
    
    state.scene.add(state.transformControls);
}

// ========================================
// ENVIRONMENT TEMPLATES
// ========================================

const ENVIRONMENT_TEMPLATES = {
    warehouse: {
        name: 'Warehouse',
        description: 'Indoor industrial space with concrete floors',
        icon: '🏭',
        lighting: 'indoor',
        skyColor: 0x1a1a1a,
        groundColor: 0x3a3a3a,
        ambientColor: 0x606070,
        ambientIntensity: 0.8,
        sunColor: 0xffffdd,
        sunIntensity: 0.4,
        sunPosition: { x: 0, y: 20, z: 0 },
        fogColor: 0x1a1a1a,
        fogNear: 30,
        fogFar: 80,
        surroundings: 'warehouse-walls',
        floorTexture: 'concrete',
        floorSize: 50
    },
    schoolyard: {
        name: 'School Yard',
        description: 'Outdoor school with fences and buildings',
        icon: '🏫',
        lighting: 'outdoor-sunny',
        skyColor: 0x87CEEB,
        groundColor: 0x3d6b2a,  // Green grass
        ambientColor: 0xaabbcc,  // Brighter ambient
        ambientIntensity: 0.7,   // Increased
        sunColor: 0xfffef5,      // Warm white sun
        sunIntensity: 1.8,       // Brighter sun
        sunPosition: { x: 40, y: 60, z: 30 },
        fogColor: 0xc8dff0,      // Light blue fog
        fogNear: 80,             // Push fog further
        fogFar: 250,             // Much further horizon
        surroundings: 'school-buildings',
        floorTexture: 'asphalt',
        floorSize: 60
    },
    parkinglot: {
        name: 'Parking Lot',
        description: 'Urban parking area with street vibes',
        icon: '🅿️',
        lighting: 'outdoor-evening',
        skyColor: 0xffb366,
        groundColor: 0x2a4a1a,   // Dark grass for evening
        ambientColor: 0xcc9966,  // Warmer ambient
        ambientIntensity: 0.7,   // Brighter
        sunColor: 0xffaa55,
        sunIntensity: 1.3,       // Brighter sunset
        sunPosition: { x: -30, y: 20, z: 40 },
        fogColor: 0x664433,      // Warm fog
        fogNear: 60,
        fogFar: 180,
        surroundings: 'urban-buildings',
        floorTexture: 'asphalt-lines',
        floorSize: 55
    }
};

// Store environment objects for cleanup
state.environmentObjects = [];

function applyEnvironmentTemplate(templateId) {
    const template = ENVIRONMENT_TEMPLATES[templateId];
    if (!template) {
        console.warn('Unknown environment template:', templateId);
        return;
    }
    
    console.log(`🌍 Applying environment: ${template.name}`);
    
    // Clear previous environment
    clearEnvironment();
    
    // Apply lighting
    applyLighting(template);
    
    // Apply skybox/background
    applySkybox(template);
    
    // Create surroundings
    createSurroundings(template);
    
    // Create floor
    createEnvironmentFloor(template);
    
    // Store current template
    state.currentEnvironment = templateId;
}

function clearEnvironment() {
    // Remove all environment objects
    for (const obj of state.environmentObjects) {
        state.scene.remove(obj);
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (Array.isArray(obj.material)) {
                obj.material.forEach(m => m.dispose());
            } else {
                obj.material.dispose();
            }
        }
    }
    state.environmentObjects = [];
    
    // Clear existing lights (except default ones)
    const lightsToRemove = [];
    state.scene.traverse((child) => {
        if (child.isLight && child.userData.isEnvironmentLight) {
            lightsToRemove.push(child);
        }
    });
    lightsToRemove.forEach(light => state.scene.remove(light));
    
    // Clear fog
    state.scene.fog = null;
    
    // Reset background
    state.scene.background = new THREE.Color(0x0a0a0c);
}

function applyLighting(template) {
    // Clear old environment lights
    state.scene.traverse((child) => {
        if (child.isLight && child.userData.isEnvironmentLight) {
            state.scene.remove(child);
        }
    });
    
    // Ambient light
    const ambient = new THREE.AmbientLight(template.ambientColor, template.ambientIntensity);
    ambient.userData.isEnvironmentLight = true;
    state.scene.add(ambient);
    
    // Main light (sun or indoor)
    const sun = new THREE.DirectionalLight(template.sunColor, template.sunIntensity);
    sun.position.set(template.sunPosition.x, template.sunPosition.y, template.sunPosition.z);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 100;
    sun.shadow.camera.left = -40;
    sun.shadow.camera.right = 40;
    sun.shadow.camera.top = 40;
    sun.shadow.camera.bottom = -40;
    sun.userData.isEnvironmentLight = true;
    state.scene.add(sun);
    
    // Fill light
    const fillColor = template.lighting === 'indoor' ? 0x4466aa : 0x88aacc;
    const fill = new THREE.DirectionalLight(fillColor, 0.3);
    fill.position.set(-template.sunPosition.x, 10, -template.sunPosition.z);
    fill.userData.isEnvironmentLight = true;
    state.scene.add(fill);
    
    // Hemisphere light
    const hemi = new THREE.HemisphereLight(
        template.skyColor, 
        template.groundColor, 
        template.lighting === 'indoor' ? 0.3 : 0.5
    );
    hemi.userData.isEnvironmentLight = true;
    state.scene.add(hemi);
    
    // Add fog
    if (template.fogNear && template.fogFar) {
        state.scene.fog = new THREE.Fog(template.fogColor, template.fogNear, template.fogFar);
    }
    
    // Indoor lighting extras
    if (template.lighting === 'indoor') {
        // Add some overhead point lights for warehouse feel
        const positions = [
            { x: -10, z: -10 }, { x: 10, z: -10 },
            { x: -10, z: 10 }, { x: 10, z: 10 }
        ];
        
        positions.forEach((pos, i) => {
            const light = new THREE.PointLight(0xffffcc, 0.5, 25);
            light.position.set(pos.x, 8, pos.z);
            light.userData.isEnvironmentLight = true;
            state.scene.add(light);
            
            // Light fixture visual
            const fixtureGeo = new THREE.CylinderGeometry(0.3, 0.5, 0.2, 8);
            const fixtureMat = new THREE.MeshStandardMaterial({ 
                color: 0x333333,
                emissive: 0xffffaa,
                emissiveIntensity: 0.5
            });
            const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
            fixture.position.set(pos.x, 8.5, pos.z);
            state.scene.add(fixture);
            state.environmentObjects.push(fixture);
        });
    }
}

function applySkybox(template) {
    if (template.lighting === 'indoor') {
        // Dark ceiling for indoor
        state.scene.background = new THREE.Color(template.skyColor);
    } else {
        // Beautiful gradient sky for outdoor - more vibrant!
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        
        // Create gradient based on template
        const gradient = ctx.createLinearGradient(0, 0, 0, 1024);
        
        if (template.lighting === 'outdoor-sunny') {
            // Vibrant sunny day sky
            gradient.addColorStop(0, '#1e4a8a');      // Top - deep blue
            gradient.addColorStop(0.15, '#3b7dd8');   // Upper - bright blue
            gradient.addColorStop(0.35, '#5ba3e8');   // Mid-upper - sky blue
            gradient.addColorStop(0.55, '#87ceeb');   // Mid - light blue
            gradient.addColorStop(0.75, '#c9e4f5');   // Lower - pale blue
            gradient.addColorStop(0.9, '#f5e6d3');    // Near horizon - warm tint
            gradient.addColorStop(1, '#e8d4b8');      // Horizon - warm beige
        } else if (template.lighting === 'outdoor-evening') {
            // Beautiful sunset sky
            gradient.addColorStop(0, '#0f1638');      // Top - deep blue
            gradient.addColorStop(0.15, '#2a1f4e');   // Upper - purple
            gradient.addColorStop(0.35, '#5c3a6e');   // Mid-upper - magenta
            gradient.addColorStop(0.5, '#d4546a');    // Mid - pink
            gradient.addColorStop(0.65, '#ff8855');   // Lower-mid - orange
            gradient.addColorStop(0.8, '#ffcc66');    // Lower - golden
            gradient.addColorStop(1, '#ffe4b5');      // Horizon - warm
        }
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1024, 1024);
        
        // Add subtle sun glow for sunny days
        if (template.lighting === 'outdoor-sunny') {
            const sunGradient = ctx.createRadialGradient(700, 850, 0, 700, 850, 200);
            sunGradient.addColorStop(0, 'rgba(255, 255, 220, 0.8)');
            sunGradient.addColorStop(0.2, 'rgba(255, 240, 180, 0.4)');
            sunGradient.addColorStop(0.5, 'rgba(255, 220, 150, 0.1)');
            sunGradient.addColorStop(1, 'rgba(255, 200, 100, 0)');
            ctx.fillStyle = sunGradient;
            ctx.fillRect(0, 0, 1024, 1024);
        }
        
        // Add some clouds
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        for (let i = 0; i < 8; i++) {
            const x = Math.random() * 1024;
            const y = 200 + Math.random() * 400;
            const w = 80 + Math.random() * 150;
            const h = 20 + Math.random() * 40;
            ctx.beginPath();
            ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.mapping = THREE.EquirectangularReflectionMapping;
        state.scene.background = texture;
        
        // Add distant landscape for outdoor environments
        createDistantLandscape(template);
    }
}

function createDistantLandscape(template) {
    const size = template.floorSize || 60;
    const distance = size * 1.5;
    const outerSize = size * 4;
    const innerPadding = 2; // Small gap between grass and skate area
    
    // Create a ring-shaped grass plane that DOESN'T cover the skate area
    // Using a shape with a hole in the middle
    const shape = new THREE.Shape();
    shape.moveTo(-outerSize/2, -outerSize/2);
    shape.lineTo(outerSize/2, -outerSize/2);
    shape.lineTo(outerSize/2, outerSize/2);
    shape.lineTo(-outerSize/2, outerSize/2);
    shape.lineTo(-outerSize/2, -outerSize/2);
    
    // Cut out the skate area in the center
    const hole = new THREE.Path();
    const holeSize = size/2 + innerPadding;
    hole.moveTo(-holeSize, -holeSize);
    hole.lineTo(holeSize, -holeSize);
    hole.lineTo(holeSize, holeSize);
    hole.lineTo(-holeSize, holeSize);
    hole.lineTo(-holeSize, -holeSize);
    shape.holes.push(hole);
    
    const grassGeo = new THREE.ShapeGeometry(shape);
    const grassMat = new THREE.MeshStandardMaterial({
        color: template.lighting === 'outdoor-evening' ? 0x2a4a1a : 0x3d6b2a,
        roughness: 0.95,
        metalness: 0,
        side: THREE.DoubleSide
    });
    const grassPlane = new THREE.Mesh(grassGeo, grassMat);
    grassPlane.rotation.x = -Math.PI / 2;
    grassPlane.position.y = -0.02;
    grassPlane.receiveShadow = true;
    state.scene.add(grassPlane);
    state.environmentObjects.push(grassPlane);
    
    // Create distant trees around the perimeter
    const treePositions = [];
    const treeCount = 40;
    
    for (let i = 0; i < treeCount; i++) {
        const angle = (i / treeCount) * Math.PI * 2;
        const dist = distance + Math.random() * 30;
        const x = Math.cos(angle) * dist;
        const z = Math.sin(angle) * dist;
        treePositions.push({ x, z });
    }
    
    // Add some trees in clusters
    treePositions.forEach(pos => {
        createDistantTree(pos.x, pos.z, template);
    });
    
    // Add distant hills/horizon
    createHorizonHills(template, distance * 1.5);
}

function createDistantTree(x, z, template) {
    const group = new THREE.Group();
    
    // Randomize tree size
    const scale = 0.6 + Math.random() * 0.8;
    const height = 8 * scale;
    
    // Tree colors based on time of day
    const trunkColor = template.lighting === 'outdoor-evening' ? 0x3a2a1a : 0x4a3522;
    const foliageColor = template.lighting === 'outdoor-evening' ? 0x1a3a15 : 0x2d5a27;
    
    // Simple trunk
    const trunkGeo = new THREE.CylinderGeometry(0.15 * scale, 0.25 * scale, height * 0.4, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: trunkColor, roughness: 0.9 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = height * 0.2;
    group.add(trunk);
    
    // Simple foliage (cone shape for performance)
    const foliageGeo = new THREE.ConeGeometry(2.5 * scale, height * 0.7, 6);
    const foliageMat = new THREE.MeshStandardMaterial({ color: foliageColor, roughness: 0.8 });
    const foliage = new THREE.Mesh(foliageGeo, foliageMat);
    foliage.position.y = height * 0.65;
    foliage.castShadow = true;
    group.add(foliage);
    
    group.position.set(x, 0, z);
    state.scene.add(group);
    state.environmentObjects.push(group);
}

function createHorizonHills(template, distance) {
    // Create a ring of low hills at the horizon
    const hillColor = template.lighting === 'outdoor-evening' ? 0x2a4a2a : 0x4a7a4a;
    const hillMat = new THREE.MeshStandardMaterial({ 
        color: hillColor, 
        roughness: 0.95,
        flatShading: true 
    });
    
    // Create several hill segments around the perimeter
    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;
        
        // Random hill dimensions
        const width = 40 + Math.random() * 60;
        const height = 5 + Math.random() * 15;
        const depth = 30 + Math.random() * 40;
        
        const hillGeo = new THREE.ConeGeometry(width / 2, height, 8, 1, false, 0, Math.PI);
        hillGeo.rotateX(-Math.PI / 2);
        hillGeo.translate(0, height / 3, 0);
        
        const hill = new THREE.Mesh(hillGeo, hillMat);
        hill.position.set(x, 0, z);
        hill.lookAt(0, 0, 0);
        hill.receiveShadow = true;
        
        state.scene.add(hill);
        state.environmentObjects.push(hill);
    }
}

function createSurroundings(template) {
    const size = template.floorSize;
    
    switch (template.surroundings) {
        case 'warehouse-walls':
            createWarehouseWalls(size);
            break;
        case 'school-buildings':
            createSchoolBuildings(size);
            break;
        case 'urban-buildings':
            createUrbanBuildings(size);
            break;
    }
}

function createWarehouseWalls(size) {
    const wallHeight = 12;
    const wallColor = 0x4a4a4a;
    const wallMat = new THREE.MeshStandardMaterial({ 
        color: wallColor,
        roughness: 0.9,
        metalness: 0.1
    });
    
    // Create walls
    const walls = [
        { pos: [0, wallHeight/2, -size/2], rot: [0, 0, 0], size: [size, wallHeight, 0.5] },
        { pos: [0, wallHeight/2, size/2], rot: [0, 0, 0], size: [size, wallHeight, 0.5] },
        { pos: [-size/2, wallHeight/2, 0], rot: [0, Math.PI/2, 0], size: [size, wallHeight, 0.5] },
        { pos: [size/2, wallHeight/2, 0], rot: [0, Math.PI/2, 0], size: [size, wallHeight, 0.5] },
    ];
    
    walls.forEach(w => {
        const geo = new THREE.BoxGeometry(w.size[0], w.size[1], w.size[2]);
        const mesh = new THREE.Mesh(geo, wallMat);
        mesh.position.set(w.pos[0], w.pos[1], w.pos[2]);
        mesh.rotation.set(w.rot[0], w.rot[1], w.rot[2]);
        mesh.receiveShadow = true;
        state.scene.add(mesh);
        state.environmentObjects.push(mesh);
    });
    
    // Ceiling
    const ceilingMat = new THREE.MeshStandardMaterial({ 
        color: 0x2a2a2a,
        roughness: 0.95,
        side: THREE.BackSide
    });
    const ceilingGeo = new THREE.PlaneGeometry(size, size);
    const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = wallHeight;
    state.scene.add(ceiling);
    state.environmentObjects.push(ceiling);
    
    // Support pillars
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8 });
    const pillarPositions = [
        [-size/4, -size/4], [size/4, -size/4],
        [-size/4, size/4], [size/4, size/4]
    ];
    
    pillarPositions.forEach(([x, z]) => {
        const pillarGeo = new THREE.BoxGeometry(0.8, wallHeight, 0.8);
        const pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.position.set(x, wallHeight/2, z);
        pillar.castShadow = true;
        pillar.receiveShadow = true;
        state.scene.add(pillar);
        state.environmentObjects.push(pillar);
    });
}

function createSchoolBuildings(size) {
    const buildingMat = new THREE.MeshStandardMaterial({ 
        color: 0x996644,
        roughness: 0.85
    });
    
    // Main school building (back)
    const mainBuilding = new THREE.BoxGeometry(size * 0.8, 10, 8);
    const mainMesh = new THREE.Mesh(mainBuilding, buildingMat);
    mainMesh.position.set(0, 5, -size/2 + 4);
    mainMesh.receiveShadow = true;
    mainMesh.castShadow = true;
    state.scene.add(mainMesh);
    state.environmentObjects.push(mainMesh);
    
    // Windows on building
    const windowMat = new THREE.MeshStandardMaterial({ 
        color: 0x88aacc,
        emissive: 0x223344,
        emissiveIntensity: 0.3
    });
    
    for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 2; j++) {
            const windowGeo = new THREE.PlaneGeometry(2, 1.5);
            const windowMesh = new THREE.Mesh(windowGeo, windowMat);
            windowMesh.position.set(-size * 0.3 + i * 5, 3 + j * 3, -size/2 + 8.01);
            state.scene.add(windowMesh);
            state.environmentObjects.push(windowMesh);
        }
    }
    
    // Chain-link fence (sides)
    const fenceMat = new THREE.MeshStandardMaterial({ 
        color: 0x888888,
        wireframe: true,
        transparent: true,
        opacity: 0.6
    });
    
    [-1, 1].forEach(side => {
        const fenceGeo = new THREE.PlaneGeometry(size, 3);
        const fence = new THREE.Mesh(fenceGeo, fenceMat);
        fence.position.set(side * size/2, 1.5, 0);
        fence.rotation.y = Math.PI / 2;
        state.scene.add(fence);
        state.environmentObjects.push(fence);
        
        // Fence posts
        for (let i = 0; i < 6; i++) {
            const postGeo = new THREE.CylinderGeometry(0.05, 0.05, 3, 8);
            const postMat = new THREE.MeshStandardMaterial({ color: 0x666666 });
            const post = new THREE.Mesh(postGeo, postMat);
            post.position.set(side * size/2, 1.5, -size/2 + i * (size/5));
            state.scene.add(post);
            state.environmentObjects.push(post);
        }
    });
    
    // Basketball hoop
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
    const poleGeo = new THREE.CylinderGeometry(0.1, 0.1, 4, 8);
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(size/2 - 5, 2, size/3);
    state.scene.add(pole);
    state.environmentObjects.push(pole);
    
    const backboardMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const backboard = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 0.1), backboardMat);
    backboard.position.set(size/2 - 5, 3.5, size/3);
    state.scene.add(backboard);
    state.environmentObjects.push(backboard);
}

function createUrbanBuildings(size) {
    // City buildings in background
    const buildingColors = [0x3a3a3a, 0x4a4a4a, 0x555555, 0x444444];
    
    const buildings = [
        { x: -size/2 - 5, z: -size/3, w: 12, h: 25, d: 10 },
        { x: -size/2 - 8, z: size/4, w: 15, h: 35, d: 12 },
        { x: size/2 + 6, z: 0, w: 14, h: 30, d: 14 },
        { x: size/2 + 10, z: -size/3, w: 10, h: 20, d: 8 },
        { x: 0, z: -size/2 - 10, w: 20, h: 40, d: 15 },
        { x: -size/3, z: -size/2 - 8, w: 12, h: 28, d: 10 },
    ];
    
    buildings.forEach((b, i) => {
        const mat = new THREE.MeshStandardMaterial({ 
            color: buildingColors[i % buildingColors.length],
            roughness: 0.9
        });
        const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(b.x, b.h/2, b.z);
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        state.scene.add(mesh);
        state.environmentObjects.push(mesh);
        
        // Add some lit windows
        const windowMat = new THREE.MeshStandardMaterial({ 
            color: 0xffffaa,
            emissive: 0xffaa44,
            emissiveIntensity: 0.5
        });
        
        for (let floor = 0; floor < b.h / 4; floor++) {
            if (Math.random() > 0.3) {
                const windowGeo = new THREE.PlaneGeometry(1, 0.8);
                const windowMesh = new THREE.Mesh(windowGeo, windowMat);
                windowMesh.position.set(
                    b.x + (Math.random() - 0.5) * (b.w - 2),
                    floor * 4 + 2,
                    b.z + b.d/2 + 0.01
                );
                state.scene.add(windowMesh);
                state.environmentObjects.push(windowMesh);
            }
        }
    });
    
    // Street lamps
    const lampPositions = [
        { x: -size/3, z: size/2 - 3 },
        { x: size/3, z: size/2 - 3 },
        { x: -size/3, z: -size/3 },
    ];
    
    lampPositions.forEach(pos => {
        // Pole
        const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 5, 8);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(pos.x, 2.5, pos.z);
        state.scene.add(pole);
        state.environmentObjects.push(pole);
        
        // Light
        const lightGeo = new THREE.SphereGeometry(0.3, 8, 8);
        const lightMat = new THREE.MeshStandardMaterial({ 
            color: 0xffddaa,
            emissive: 0xffaa66,
            emissiveIntensity: 0.8
        });
        const lightMesh = new THREE.Mesh(lightGeo, lightMat);
        lightMesh.position.set(pos.x, 5.2, pos.z);
        state.scene.add(lightMesh);
        state.environmentObjects.push(lightMesh);
        
        // Actual point light
        const light = new THREE.PointLight(0xffaa66, 0.5, 15);
        light.position.set(pos.x, 5, pos.z);
        light.userData.isEnvironmentLight = true;
        state.scene.add(light);
    });
    
    // Parking lines on ground
    createParkingLines(size);
}

function createParkingLines(size) {
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    
    for (let i = -4; i <= 4; i++) {
        const lineGeo = new THREE.PlaneGeometry(0.15, 5);
        const line = new THREE.Mesh(lineGeo, lineMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(i * 3, 0.01, size/3);
        state.scene.add(line);
        state.environmentObjects.push(line);
    }
}

function createEnvironmentFloor(template) {
    const size = template.floorSize;
    
    // Create procedural texture based on floor type (for editor preview)
    const floorMat = createFloorMaterial(template.floorTexture, size);
    
    const floorGeo = new THREE.PlaneGeometry(size, size);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;  // Exactly at ground level
    floor.receiveShadow = true;
    state.scene.add(floor);
    state.environmentObjects.push(floor);
    
    // IMPORTANT: Also create an EXPORTABLE floor object in state.objects!
    // This is what actually gets sent to the True Skate game
    const exportFloorDef = OBJECT_DEFINITIONS['starter-floor'];
    const exportFloorProps = { 
        ...exportFloorDef.defaultProps,
        width: size,
        depth: size,
        color: getFloorColorHex(template.floorTexture)
    };
    const exportFloor = exportFloorDef.create(exportFloorProps);
    exportFloor.position.set(0, 0, 0);
    exportFloor.userData.type = 'starter-floor';
    exportFloor.userData.name = 'Environment Floor';
    exportFloor.userData.props = exportFloorProps;
    exportFloor.visible = false;  // Hide it since we have the pretty textured floor
    state.scene.add(exportFloor);
    state.objects.push(exportFloor);
    
    console.log(`🏗️ Created exportable floor: ${size}x${size}, color=${exportFloorProps.color}`);
    updateObjectCount();
    
    // Add parking lines if applicable
    if (template.floorTexture === 'asphalt-lines') {
        createParkingLines(size);
    }
}

// Helper to get floor color for export based on texture type
function getFloorColorHex(textureType) {
    switch (textureType) {
        case 'plywood': return '#c4a574';
        case 'concrete': return '#8a8a8a';
        case 'asphalt': return '#2a2a2a';
        case 'asphalt-lines': return '#1a1a1a';
        default: return '#505050';
    }
}

function createFloorMaterial(textureType, size) {
    // Create a procedural canvas texture
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    
    switch (textureType) {
        case 'plywood':
            // Warm plywood look with wood grain
            ctx.fillStyle = '#c4a574';
            ctx.fillRect(0, 0, 1024, 1024);
            
            // Add wood grain lines
            ctx.strokeStyle = '#b08850';
            ctx.lineWidth = 2;
            for (let i = 0; i < 100; i++) {
                const y = Math.random() * 1024;
                ctx.beginPath();
                ctx.moveTo(0, y);
                // Wavy lines for wood grain
                for (let x = 0; x < 1024; x += 20) {
                    ctx.lineTo(x, y + Math.sin(x * 0.02) * 3 + Math.random() * 2);
                }
                ctx.stroke();
            }
            
            // Add some darker knots
            ctx.fillStyle = '#8a6a40';
            for (let i = 0; i < 15; i++) {
                const x = Math.random() * 1024;
                const y = Math.random() * 1024;
                ctx.beginPath();
                ctx.ellipse(x, y, 15 + Math.random() * 20, 8 + Math.random() * 10, Math.random() * Math.PI, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Add panel seams
            ctx.strokeStyle = '#906030';
            ctx.lineWidth = 4;
            for (let i = 1; i < 4; i++) {
                ctx.beginPath();
                ctx.moveTo(i * 256, 0);
                ctx.lineTo(i * 256, 1024);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(0, i * 256);
                ctx.lineTo(1024, i * 256);
                ctx.stroke();
            }
            break;
            
        case 'concrete':
            // Light grey concrete with texture
            ctx.fillStyle = '#8a8a8a';
            ctx.fillRect(0, 0, 1024, 1024);
            
            // Add noise/speckle for concrete texture
            for (let i = 0; i < 5000; i++) {
                const x = Math.random() * 1024;
                const y = Math.random() * 1024;
                const shade = 120 + Math.random() * 40;
                ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
                ctx.fillRect(x, y, 2 + Math.random() * 3, 2 + Math.random() * 3);
            }
            
            // Add expansion joints (concrete seams)
            ctx.strokeStyle = '#606060';
            ctx.lineWidth = 3;
            for (let i = 1; i < 4; i++) {
                ctx.beginPath();
                ctx.moveTo(i * 256, 0);
                ctx.lineTo(i * 256, 1024);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(0, i * 256);
                ctx.lineTo(1024, i * 256);
                ctx.stroke();
            }
            
            // Add some subtle cracks
            ctx.strokeStyle = '#707070';
            ctx.lineWidth = 1;
            for (let i = 0; i < 5; i++) {
                const startX = Math.random() * 1024;
                const startY = Math.random() * 1024;
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                let x = startX, y = startY;
                for (let j = 0; j < 10; j++) {
                    x += (Math.random() - 0.5) * 40;
                    y += Math.random() * 30;
                    ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
            break;
            
        case 'asphalt':
        case 'asphalt-lines':
            // Dark asphalt with rough texture
            ctx.fillStyle = '#2a2a2a';
            ctx.fillRect(0, 0, 1024, 1024);
            
            // Add asphalt aggregate texture
            for (let i = 0; i < 8000; i++) {
                const x = Math.random() * 1024;
                const y = Math.random() * 1024;
                const shade = 30 + Math.random() * 30;
                ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
                ctx.fillRect(x, y, 1 + Math.random() * 4, 1 + Math.random() * 4);
            }
            
            // Add some lighter speckles (aggregate)
            for (let i = 0; i < 1000; i++) {
                const x = Math.random() * 1024;
                const y = Math.random() * 1024;
                const shade = 60 + Math.random() * 30;
                ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
                ctx.beginPath();
                ctx.arc(x, y, 1 + Math.random() * 2, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Add some oil stains
            ctx.fillStyle = 'rgba(20, 20, 25, 0.3)';
            for (let i = 0; i < 3; i++) {
                const x = Math.random() * 1024;
                const y = Math.random() * 1024;
                ctx.beginPath();
                ctx.ellipse(x, y, 30 + Math.random() * 40, 20 + Math.random() * 30, Math.random() * Math.PI, 0, Math.PI * 2);
                ctx.fill();
            }
            break;
            
        default:
            // Generic grey
            ctx.fillStyle = '#505050';
            ctx.fillRect(0, 0, 1024, 1024);
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(size / 20, size / 20);  // Scale texture with floor size
    
    return new THREE.MeshStandardMaterial({
        map: texture,
        roughness: textureType === 'plywood' ? 0.7 : 0.9,
        metalness: 0.05,
        side: THREE.DoubleSide
    });
}

function setupLighting() {
    // Default lighting (will be replaced by environment templates)
    const ambient = new THREE.AmbientLight(0x404050, 0.6);
    state.scene.add(ambient);
    
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
    
    const fill = new THREE.DirectionalLight(0x8888ff, 0.3);
    fill.position.set(-10, 10, -10);
    state.scene.add(fill);
    
    const hemi = new THREE.HemisphereLight(0x87CEEB, 0x444444, 0.4);
    state.scene.add(hemi);
}

function setupResizableSidebars() {
    const app = document.getElementById('app');
    const leftHandle = document.getElementById('resize-left');
    const rightHandle = document.getElementById('resize-right');
    
    if (!leftHandle || !rightHandle) return;
    
    const minWidth = 180;
    const maxWidth = 450;
    
    let isResizing = false;
    let currentHandle = null;
    let startX = 0;
    let startWidth = 0;
    
    function startResize(e, handle, side) {
        isResizing = true;
        currentHandle = { handle, side };
        startX = e.clientX;
        
        if (side === 'left') {
            startWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-left-width'));
        } else {
            startWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-right-width'));
        }
        
        handle.classList.add('active');
        document.body.classList.add('resizing');
        
        e.preventDefault();
    }
    
    function doResize(e) {
        if (!isResizing || !currentHandle) return;
        
        const { side } = currentHandle;
        let delta = e.clientX - startX;
        
        // For right sidebar, invert the delta
        if (side === 'right') {
            delta = -delta;
        }
        
        let newWidth = startWidth + delta;
        newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
        
        if (side === 'left') {
            document.documentElement.style.setProperty('--sidebar-left-width', newWidth + 'px');
        } else {
            document.documentElement.style.setProperty('--sidebar-right-width', newWidth + 'px');
        }
        
        // Trigger resize event for Three.js canvas
        onWindowResize();
    }
    
    function stopResize() {
        if (!isResizing) return;
        
        isResizing = false;
        if (currentHandle) {
            currentHandle.handle.classList.remove('active');
        }
        currentHandle = null;
        document.body.classList.remove('resizing');
    }
    
    // Left handle
    leftHandle.addEventListener('mousedown', (e) => startResize(e, leftHandle, 'left'));
    
    // Right handle  
    rightHandle.addEventListener('mousedown', (e) => startResize(e, rightHandle, 'right'));
    
    // Global mouse events
    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
    
    // Double-click to reset to default
    leftHandle.addEventListener('dblclick', () => {
        document.documentElement.style.setProperty('--sidebar-left-width', '280px');
        onWindowResize();
    });
    
    rightHandle.addEventListener('dblclick', () => {
        document.documentElement.style.setProperty('--sidebar-right-width', '260px');
        onWindowResize();
    });
    
    console.log('📐 Resizable sidebars initialized');
}

function setupTemplatesModal() {
    const modal = document.getElementById('templates-modal');
    const openBtn = document.getElementById('btn-templates');
    const closeBtn = document.getElementById('modal-close');
    const backdrop = modal?.querySelector('.modal-backdrop');
    const templateCards = modal?.querySelectorAll('.template-card');
    const mapImportZone = document.getElementById('map-import-zone');
    const mapImportInput = document.getElementById('map-import');
    
    if (!modal || !openBtn) return;
    
    // Open modal
    openBtn.addEventListener('click', () => {
        modal.classList.remove('hidden');
    });
    
    // Close modal
    function closeModal() {
        modal.classList.add('hidden');
    }
    
    closeBtn?.addEventListener('click', closeModal);
    backdrop?.addEventListener('click', closeModal);
    
    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            closeModal();
        }
    });
    
    // Template card clicks
    templateCards?.forEach(card => {
        card.addEventListener('click', async () => {
            const template = card.dataset.template;
            closeModal();
            await loadTemplate(template);
        });
    });
    
    // Environment card clicks
    const envCards = modal?.querySelectorAll('.environment-card');
    envCards?.forEach(card => {
        card.addEventListener('click', () => {
            const envId = card.dataset.environment;
            closeModal();
            loadEnvironmentTemplate(envId);
        });
    });
    
    // Map import drag & drop
    if (mapImportZone && mapImportInput) {
        mapImportZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            mapImportZone.classList.add('drag-over');
        });
        
        mapImportZone.addEventListener('dragleave', () => {
            mapImportZone.classList.remove('drag-over');
        });
        
        mapImportZone.addEventListener('drop', async (e) => {
            e.preventDefault();
            mapImportZone.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                closeModal();
                await handleMapImport(files[0]);
            }
        });
        
        mapImportInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                closeModal();
                await handleMapImport(e.target.files[0]);
            }
        });
    }
    
    console.log('📁 Templates modal initialized');
}

function loadEnvironmentTemplate(envId) {
    // Clear current scene
    clearScene();
    
    // Apply the environment (this creates its own floor - no need for starter floor)
    applyEnvironmentTemplate(envId);
    
    // Add a spawn point
    addSpawnPoint(0, 0, 0);
    
    console.log(`🌍 Loaded environment: ${envId}`);
}

async function loadTemplate(templateName) {
    // Clear current scene first
    clearScene();
    
    if (templateName === 'blank') {
        console.log('📄 Starting with blank map');
        return;
    }
    
    if (templateName === 'starter-floor') {
        console.log('🛹 Creating starter floor...');
        createStarterFloor();
        return;
    }
    
    if (templateName === 'warehouse') {
        console.log('🏭 Loading Street Warehouse template...');
        await loadWarehouseTemplate();
    }
    
    if (templateName === 'warehouse-diy') {
        console.log('🏗️ Building DIY Warehouse...');
        await buildDIYWarehouse();
    }
}

function createStarterFloor() {
    // Create a large flat floor at Y=0 for building skateparks
    const definition = OBJECT_DEFINITIONS['starter-floor'];
    const props = { ...definition.defaultProps };
    
    const floor = definition.create(props);
    floor.position.set(0, 0, 0); // Exactly at ground level
    
    // Set userData for proper tracking
    floor.userData.type = 'starter-floor';
    floor.userData.name = 'Starter Floor';
    floor.userData.props = props;
    
    state.scene.add(floor);
    state.objects.push(floor);
    
    // Add a spawn point in the center
    addSpawnPoint(0, 0, 0);
    
    // Position camera to see the whole floor
    state.camera.position.set(40, 30, 40);
    state.controls.target.set(0, 0, 0);
    state.controls.update();
    
    updateObjectCount();
    saveUndoState();
    
    console.log('🛹 Created 60m x 60m starter floor at Y=0');
}

async function loadWarehouseTemplate() {
    try {
        // Fetch the warehouse placement data
        const response = await fetch('/warehouse_extracted/dyiObjectPlacement.json');
        if (!response.ok) {
            throw new Error('Could not load warehouse template');
        }
        
        const data = await response.json();
        const placements = data.diyOjbectPlacements?.objects || [];
        
        let placedCount = 0;
        let skippedCount = 0;
        
        for (const item of placements) {
            const placement = item.diyOjbectPlacement;
            if (!placement) continue;
            
            const objName = placement.name || '';
            const pos = placement.pos || { x: 0, y: 0, z: 0 };
            const angle = placement.angle || { x: 0, y: 0, z: 0 };
            
            // Map common TrueSkate objects to our built-in objects
            let objectType = mapTrueSkateObject(objName);
            
            if (objectType) {
                const definition = OBJECT_DEFINITIONS[objectType];
                if (definition) {
                    const props = { ...definition.defaultProps };
                    const mesh = definition.create(props);
                    
                    // Apply position (scale down since warehouse uses large coordinates)
                    // TrueSkate uses different coordinate system, adjust as needed
                    mesh.position.set(
                        (pos.x || 0) / 50, // Scale down
                        (pos.y || 0) / 50,
                        (pos.z || 0) / 50
                    );
                    
                    // Apply rotation (convert degrees to radians)
                    mesh.rotation.set(
                        THREE.MathUtils.degToRad(angle.x || 0),
                        THREE.MathUtils.degToRad(angle.y || 0),
                        THREE.MathUtils.degToRad(angle.z || 0)
                    );
                    
                    mesh.userData.type = objectType;
                    mesh.userData.name = definition.name;
                    mesh.userData.props = props;
                    
                    state.scene.add(mesh);
                    state.objects.push(mesh);
                    placedCount++;
                }
            } else {
                skippedCount++;
                console.log(`⚠️ Unknown object: ${objName}`);
            }
        }
        
        updateObjectCount();
        saveUndoState();
        
        // Center camera on the objects
        if (state.objects.length > 0) {
            const box = new THREE.Box3();
            state.objects.forEach(obj => box.expandByObject(obj));
            const center = box.getCenter(new THREE.Vector3());
            state.controls.target.copy(center);
            state.camera.position.set(center.x + 20, 15, center.z + 20);
            state.controls.update();
        }
        
        console.log(`🏭 Loaded ${placedCount} objects, skipped ${skippedCount} (missing DIY packs)`);
        alert(`Loaded ${placedCount} objects from Street Warehouse template.\n\n${skippedCount} objects skipped (require external DIY packs).`);
        
    } catch (error) {
        console.error('Error loading warehouse template:', error);
        alert('Could not load warehouse template: ' + error.message);
    }
}

async function buildDIYWarehouse() {
    // Create a warehouse-style skatepark from scratch
    const objects = [];
    
    // Helper to create and place an object
    function placeObject(type, x, y, z, rotationY = 0, scale = 1) {
        const definition = OBJECT_DEFINITIONS[type];
        if (!definition) return null;
        
        const props = { ...definition.defaultProps };
        const mesh = definition.create(props);
        
        mesh.position.set(x, y, z);
        mesh.rotation.y = THREE.MathUtils.degToRad(rotationY);
        mesh.scale.setScalar(scale);
        
        mesh.userData.type = type;
        mesh.userData.name = definition.name;
        mesh.userData.props = props;
        
        state.scene.add(mesh);
        state.objects.push(mesh);
        objects.push(mesh);
        
        return mesh;
    }
    
    // === WAREHOUSE FLOOR ===
    // Create a large floor area using flat ground tiles (6x6 grid)
    // Floor tiles positioned slightly BELOW Y=0 so objects don't z-fight with floor surface
    // Objects have their bottoms at Y=0, so floor top must be slightly below Y=0
    const floorSize = 6;
    const tileSpacing = 10.01; // Tiny gap between tiles
    const floorHeight = 0.5;
    const floorYOffset = -floorHeight/2 - 0.01; // Lower floor by 1cm to prevent z-fighting
    
    for (let x = -floorSize/2; x < floorSize/2; x++) {
        for (let z = -floorSize/2; z < floorSize/2; z++) {
            placeObject('ground-flat', x * tileSpacing, floorYOffset, z * tileSpacing);
        }
    }
    
    // === ACTUAL WALLS (industrial warehouse look) ===
    const wallDistance = 30;
    const wallHeight = 8;
    
    // Back wall segments
    for (let i = -2; i <= 2; i++) {
        placeObject('wall', i * 10, 0, -wallDistance, 0);
    }
    
    // Front wall segments
    for (let i = -2; i <= 2; i++) {
        placeObject('wall', i * 10, 0, wallDistance, 0);
    }
    
    // Left wall segments
    for (let i = -2; i <= 2; i++) {
        placeObject('wall', -wallDistance, 0, i * 10, 90);
    }
    
    // Right wall segments
    for (let i = -2; i <= 2; i++) {
        placeObject('wall', wallDistance, 0, i * 10, 90);
    }
    
    // === CORNER PILLARS ===
    placeObject('pillar', -wallDistance + 0.5, 0, -wallDistance + 0.5);
    placeObject('pillar', wallDistance - 0.5, 0, -wallDistance + 0.5);
    placeObject('pillar', -wallDistance + 0.5, 0, wallDistance - 0.5);
    placeObject('pillar', wallDistance - 0.5, 0, wallDistance - 0.5);
    
    // Middle pillars for support
    placeObject('pillar', 0, 0, -wallDistance + 0.5);
    placeObject('pillar', 0, 0, wallDistance - 0.5);
    
    // === CEILING BEAMS ===
    placeObject('beam', 0, 0, -15, 90);
    placeObject('beam', 0, 0, 0, 90);
    placeObject('beam', 0, 0, 15, 90);
    
    // === QUARTER PIPES (for skating, along walls) ===
    // Back wall quarters
    for (let i = -2; i <= 2; i++) {
        placeObject('quarter-pipe', i * 6, 0, -wallDistance + 3, 180);
    }
    
    // Front wall quarters  
    for (let i = -2; i <= 2; i++) {
        placeObject('quarter-pipe', i * 6, 0, wallDistance - 3, 0);
    }
    
    // === CENTER FEATURES ===
    
    // Pyramid in the middle
    placeObject('pyramid', 0, 0, 0);
    
    // Ledges around the center
    placeObject('ledge', -8, 0, -8, 45);
    placeObject('ledge', 8, 0, -8, -45);
    placeObject('ledge', -8, 0, 8, -45);
    placeObject('ledge', 8, 0, 8, 45);
    
    // === RAILS ===
    placeObject('flat-rail', -15, 0, 0, 0);
    placeObject('flat-rail', 15, 0, 0, 0);
    placeObject('down-rail', 0, 0, -15, 90);
    placeObject('down-rail', 0, 0, 15, -90);
    
    // === STAIRS ===
    placeObject('5-stair', -18, 0, -18, 45);
    placeObject('5-stair', 18, 0, -18, -45);
    placeObject('3-stair', -18, 0, 18, 135);
    placeObject('3-stair', 18, 0, 18, -135);
    
    // === KICKERS ===
    placeObject('kicker', -12, 0, -20, 0);
    placeObject('kicker', 12, 0, -20, 0);
    placeObject('kicker', -12, 0, 20, 180);
    placeObject('kicker', 12, 0, 20, 180);
    
    // === MANNY PADS ===
    placeObject('manny-pad', -20, 0, 0, 0);
    placeObject('manny-pad', 20, 0, 0, 0);
    
    // === BENCHES (for flavor) ===
    placeObject('bench', -25, 0, -25, 45);
    placeObject('bench', 25, 0, -25, -45);
    placeObject('bench', -25, 0, 25, 135);
    placeObject('bench', 25, 0, 25, -135);
    
    // Update spawn point to center
    if (state.spawnPoints && state.spawnPoints.length > 0) {
        state.spawnPoints[0].position.set(0, 0, 25);
        updateSpawnPointsList();
    }
    
    updateObjectCount();
    saveUndoState();
    
    // Center camera
    state.controls.target.set(0, 0, 0);
    state.camera.position.set(40, 30, 40);
    state.controls.update();
    
    console.log(`🏗️ Built DIY Warehouse with ${objects.length} objects!`);
    alert(`🏗️ DIY Warehouse created with ${objects.length} objects!\n\nFeel free to move, delete, or add more objects!`);
}

function mapTrueSkateObject(objName) {
    // Map TrueSkate built-in objects (.bin) to our objects
    const mapping = {
        // Quarters/Ramps
        'quarter_001.bin': 'quarter-pipe',
        'quarter_002.bin': 'quarter-pipe',
        'quarter_003.bin': 'quarter-pipe',
        'quarter_004.bin': 'quarter-pipe',
        'quarter_005.bin': 'quarter-pipe',
        
        // Kickers
        'kicker_001.bin': 'kicker',
        'kicker_002.bin': 'kicker',
        
        // Rails
        'rail_001.bin': 'flat-rail',
        'rail_002.bin': 'flat-rail',
        'rail_003.bin': 'flat-rail',
        'rail_004.bin': 'flat-rail',
        'rail_005.bin': 'flat-rail',
        'rail_010.bin': 'down-rail',
        'rail_015.bin': 'flat-rail',
        
        // Benches
        'bench_001.bin': 'bench',
        'bench_002.bin': 'bench',
        'bench_008.bin': 'bench',
        
        // Tables
        'picnic_table_001.bin': 'bench',
        
        // Poles (use trash can as placeholder)
        'pole_001.bin': 'trash-can',
    };
    
    return mapping[objName] || null;
}

async function handleMapImport(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    
    try {
        if (ext === 'zip') {
            await importMapFromZip(file);
        } else if (ext === 'json') {
            await importMapFromJSON(file);
        } else {
            alert('Please upload a .zip or .json file');
        }
    } catch (error) {
        console.error('Error importing map:', error);
        alert('Failed to import map: ' + error.message);
    }
}

async function importMapFromZip(file) {
    const JSZip = window.JSZip || (await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm')).default;
    
    const zip = new JSZip();
    const contents = await zip.loadAsync(file);
    
    // Look for dyiObjectPlacement.json, _mod.json, or .txt files
    let placementData = null;
    let modJson = null;
    let mainTxtFile = null;
    let mainTxtContent = null;
    let modJsonRawContent = null;  // Local backup (survives clearScene)
    const textures = {};
    
    for (const [filename, zipEntry] of Object.entries(contents.files)) {
        if (zipEntry.dir) continue;
        const baseName = filename.split('/').pop();
        
        if (baseName === 'dyiObjectPlacement.json') {
            const content = await zipEntry.async('text');
            try {
                placementData = JSON.parse(content);
            } catch (e) {
                console.warn('Could not parse placement data');
            }
        } else if (baseName === '_mod.json') {
            const content = await zipEntry.async('text');
            // CRITICAL: Store raw content for export (True Skate uses non-standard JSON)
            // NOTE: We store in BOTH a local var AND state, because clearScene() will reset state
            state.importedMapModJsonRaw = content;
            modJsonRawContent = content;  // Local backup for after clearScene()
            console.log(`📄 Captured _mod.json: ${content.length} chars`);
            
            try {
                // Handle malformed JSON (missing outer braces) for parsing only
                let jsonStr = content.trim();
                if (!jsonStr.startsWith('{')) jsonStr = '{' + jsonStr + '}';
                modJson = JSON.parse(jsonStr);
            } catch (e) {
                // Try to extract modWorldInfo manually
                const match = content.match(/"fileName"\s*:\s*"([^"]+\.txt)"/);
                if (match) {
                    modJson = { modWorldInfo: { fileName: match[1] } };
                }
            }
        } else if (baseName.endsWith('.txt') && !baseName.startsWith('_')) {
            // Store potential main geometry file
            mainTxtFile = baseName;
            mainTxtContent = await zipEntry.async('text');
        } else if (/\.(jpg|jpeg|png)$/i.test(baseName)) {
            // Store textures
            const blob = await zipEntry.async('blob');
            textures[baseName] = URL.createObjectURL(blob);
        }
    }
    
    if (placementData) {
        clearScene();
        // Process placement data similar to warehouse
        const placements = placementData.diyOjbectPlacements?.objects || [];
        let placedCount = 0;
        
        for (const item of placements) {
            const placement = item.diyOjbectPlacement;
            if (!placement) continue;
            
            const objName = placement.name || '';
            const pos = placement.pos || { x: 0, y: 0, z: 0 };
            const angle = placement.angle || { x: 0, y: 0, z: 0 };
            
            let objectType = mapTrueSkateObject(objName);
            
            if (objectType) {
                const definition = OBJECT_DEFINITIONS[objectType];
                if (definition) {
                    const props = { ...definition.defaultProps };
                    const mesh = definition.create(props);
                    
                    mesh.position.set(
                        (pos.x || 0) / 50,
                        (pos.y || 0) / 50,
                        (pos.z || 0) / 50
                    );
                    
                    mesh.rotation.set(
                        THREE.MathUtils.degToRad(angle.x || 0),
                        THREE.MathUtils.degToRad(angle.y || 0),
                        THREE.MathUtils.degToRad(angle.z || 0)
                    );
                    
                    mesh.userData.type = objectType;
                    mesh.userData.name = definition.name;
                    mesh.userData.props = props;
                    
                    state.scene.add(mesh);
                    state.objects.push(mesh);
                    placedCount++;
                }
            }
        }
        
        updateObjectCount();
        saveUndoState();
        console.log(`📦 Imported ${placedCount} objects from ${file.name}`);
        alert(`Imported ${placedCount} objects from ${file.name}`);
    } else if (mainTxtContent) {
        // This is a full map - import as locked backdrop
        const mapName = modJson?.modWorldInfo?.name || file.name.replace('.zip', '');
        
        // Auto-import as locked backdrop (user can add DIY objects on top)
            clearScene();
            
            // Store the original geometry for export merging
            state.importedMapGeometry = mainTxtContent;
            state.importedMapGeometryFileName = mainTxtFile;
            state.importedMapName = mapName;
            state.importedMapScale = 100; // True Skate uses cm, editor uses m
            
            // Store the zip for copying textures on export
            const JSZipLib = window.JSZip || (typeof JSZip !== 'undefined' ? JSZip : null);
            if (JSZipLib) {
                state.importedMapZip = await JSZipLib.loadAsync(file);
                
                // Also store raw binary geometry for pristine export
                for (const [name, zipFile] of Object.entries(state.importedMapZip.files)) {
                    if (name === mainTxtFile || name.endsWith('/' + mainTxtFile)) {
                        state.importedMapGeometryRaw = await zipFile.async('arraybuffer');
                        console.log(`📦 Stored raw geometry: ${state.importedMapGeometryRaw.byteLength} bytes`);
                        break;
                    }
                }
            }
            
            // Store _mod.json RAW content for export (non-standard JSON format)
            // Use the LOCAL variable (survives clearScene), not state.importedMapModJsonRaw
            console.log(`🔍 importMapFromZip: modJsonRawContent (local) = ${modJsonRawContent ? modJsonRawContent.length + ' chars' : 'NULL'}`);
            state.importedMapModJson = modJsonRawContent || null;
            state.importedMapModJsonRaw = modJsonRawContent || null;  // Also restore to state
            console.log(`🔍 importMapFromZip: state.importedMapModJson = ${state.importedMapModJson ? state.importedMapModJson.length + ' chars' : 'NULL'}`);
            
            console.log('📦 Stored original map data for export merging');
            
            // Parse the map geometry using our existing parser
            try {
                console.log('📦 Loading map with', Object.keys(textures).length, 'textures');
                console.log('📦 Texture keys:', Object.keys(textures));
                
                // parseTrueSkateObject returns a THREE.Group (multi-material) or THREE.Mesh
                const backdrop = parseTrueSkateObject(mainTxtContent, textures);
                
                // Check if valid (either a Group with children or a Mesh with geometry)
                const isValid = backdrop && (
                    (backdrop.isGroup && backdrop.children.length > 0) ||
                    (backdrop.isMesh && backdrop.geometry)
                );
                
                if (isValid) {
                    // Import as locked backdrop
                    backdrop.userData.type = 'backdrop';
                    backdrop.userData.name = mapName;
                    backdrop.userData.isBackdrop = true;
                    backdrop.userData.locked = true; // Cannot be selected/moved
                    backdrop.userData.isImportedMapPart = true;  // Skip vertex limit check on export
                    
                    // Also mark all children as imported map parts
                    backdrop.traverse((child) => {
                        if (child.isMesh) {
                            child.userData.isImportedMapPart = true;
                        }
                    });
                    
                    state.scene.add(backdrop);
                    state.objects.push(backdrop);
                    
                    // Also add to environmentObjects for surface detection
                    if (!state.environmentObjects) state.environmentObjects = [];
                    state.environmentObjects.push(backdrop);
                    
                    console.log(`📦 Imported "${mapName}" as LOCKED backdrop with ${backdrop.isGroup ? backdrop.children.length : 1} mesh parts`);
                    alert(`Imported "${mapName}" as locked backdrop. You can now add objects on top!`);
                    
                    // Hide grid to avoid z-fighting with imported map's floor
                    if (state.gridHelper) {
                        state.gridHelper.visible = false;
                    }
                    
                    // Center camera on the imported content at ~10m height
                    const box = new THREE.Box3();
                    state.objects.forEach(obj => box.expandByObject(obj));
                    const center = box.getCenter(new THREE.Vector3());
                    const size = box.getSize(new THREE.Vector3());
                    
                    console.log(`📐 Map bounds: center=${center.x.toFixed(1)}, ${center.y.toFixed(1)}, ${center.z.toFixed(1)} size=${size.x.toFixed(1)}, ${size.y.toFixed(1)}, ${size.z.toFixed(1)}`);
                    
                    // Position camera at ~10m height above ground, looking down at an angle
                    const groundY = box.min.y;
                    const cameraHeight = 10; // 10 meters above ground
                    const cameraOffset = 15; // Offset from center for better viewing angle
                    state.controls.target.set(center.x, groundY, center.z);
                    state.camera.position.set(center.x + cameraOffset, groundY + cameraHeight, center.z + cameraOffset);
                    state.controls.update();
                    
                    // Add a spawn point at the center of the map, at playable height
                    const SPAWN_HEIGHT_ABOVE_SURFACE = 1.0;  // 1 meter above ground
                    const spawnX = center.x;
                    const spawnZ = center.z;
                    const spawnY = groundY + SPAWN_HEIGHT_ABOVE_SURFACE;
                    
                    // Clear any existing spawn points and add one for this map
                    while (state.startPositions.length > 0) {
                        removeSpawnPoint(0);
                    }
                    addSpawnPoint(spawnX, spawnZ, 0, spawnY);
                    console.log(`🛹 Added spawn point at map center: (${spawnX.toFixed(1)}, ${spawnY.toFixed(1)}, ${spawnZ.toFixed(1)})`);
                    
                    // Auto-select the newly created spawn point so user can immediately use "Drop to Surface"
                    if (state.startPositions.length > 0) {
                        const newSpawnPoint = state.startPositions[state.startPositions.length - 1];
                        selectSpawnPoint(newSpawnPoint);
                        console.log('🛹 Auto-selected spawn point');
                    }
                    
                    updateObjectCount();
                    saveUndoState();
                } else {
                    alert('Could not parse map geometry');
                }
            } catch (e) {
                console.error('Error parsing map:', e);
                alert('Error parsing map: ' + e.message);
        }
    } else {
        alert('No valid map data found in the zip file.\n\nExpected either:\n- dyiObjectPlacement.json (for DIY mods)\n- A .txt geometry file (for full maps)');
    }
}

async function importMapFromJSON(file) {
    const content = await file.text();
    const data = JSON.parse(content);
    
    // Check if it's a placement file
    if (data.diyOjbectPlacements) {
        clearScene();
        const placements = data.diyOjbectPlacements.objects || [];
        let placedCount = 0;
        
        for (const item of placements) {
            const placement = item.diyOjbectPlacement;
            if (!placement) continue;
            
            const objName = placement.name || '';
            const pos = placement.pos || { x: 0, y: 0, z: 0 };
            const angle = placement.angle || { x: 0, y: 0, z: 0 };
            
            let objectType = mapTrueSkateObject(objName);
            
            if (objectType) {
                const definition = OBJECT_DEFINITIONS[objectType];
                if (definition) {
                    const props = { ...definition.defaultProps };
                    const mesh = definition.create(props);
                    
                    mesh.position.set(
                        (pos.x || 0) / 50,
                        (pos.y || 0) / 50,
                        (pos.z || 0) / 50
                    );
                    
                    mesh.rotation.set(
                        THREE.MathUtils.degToRad(angle.x || 0),
                        THREE.MathUtils.degToRad(angle.y || 0),
                        THREE.MathUtils.degToRad(angle.z || 0)
                    );
                    
                    mesh.userData.type = objectType;
                    mesh.userData.name = definition.name;
                    mesh.userData.props = props;
                    
                    state.scene.add(mesh);
                    state.objects.push(mesh);
                    placedCount++;
                }
            }
        }
        
        updateObjectCount();
        saveUndoState();
        console.log(`📄 Imported ${placedCount} objects from ${file.name}`);
        alert(`Imported ${placedCount} objects from ${file.name}`);
    } else {
        alert('Unknown JSON format');
    }
}

function setupGround() {
    // Grid helper - positioned well below floor objects (which can be up to 0.5m thick)
    state.gridHelper = new THREE.GridHelper(100, 100, 0x444455, 0x222233);
    state.gridHelper.position.y = -1; // Move grid 1m below ground level (below any floor tiles)
    state.gridHelper.renderOrder = -1; // Render grid first (behind everything)
    
    // Make grid material not interfere with depth buffer
    // GridHelper can have array of materials
    const gridMats = Array.isArray(state.gridHelper.material) 
        ? state.gridHelper.material 
        : [state.gridHelper.material];
    gridMats.forEach(mat => {
        mat.depthWrite = false;
        mat.transparent = true;
        mat.opacity = 0.5;
    });
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
// SPAWN POINT MANAGEMENT
// ========================================

function createSpawnPointMarker(x = 0, z = 0, angle = 0, y = 0) {
    // Create a group to hold the spawn point visuals
    const group = new THREE.Group();
    group.userData.isSpawnPoint = true;
    group.userData.angle = angle;
    
    // Main skateboard deck shape
    const deckShape = new THREE.Shape();
    deckShape.moveTo(-0.8, -0.2);
    deckShape.lineTo(-0.6, -0.25);
    deckShape.lineTo(0.6, -0.25);
    deckShape.lineTo(0.8, -0.2);
    deckShape.lineTo(0.8, 0.2);
    deckShape.lineTo(0.6, 0.25);
    deckShape.lineTo(-0.6, 0.25);
    deckShape.lineTo(-0.8, 0.2);
    deckShape.closePath();
    
    const deckGeo = new THREE.ShapeGeometry(deckShape);
    const deckMat = new THREE.MeshBasicMaterial({ 
        color: 0x00ff88, 
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
    });
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.rotation.x = -Math.PI / 2;
    deck.position.y = 0.05;
    group.add(deck);
    
    // Direction arrow
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0, 0.4);
    arrowShape.lineTo(0.15, 0.15);
    arrowShape.lineTo(0.05, 0.15);
    arrowShape.lineTo(0.05, -0.1);
    arrowShape.lineTo(-0.05, -0.1);
    arrowShape.lineTo(-0.05, 0.15);
    arrowShape.lineTo(-0.15, 0.15);
    arrowShape.closePath();
    
    const arrowGeo = new THREE.ShapeGeometry(arrowShape);
    const arrowMat = new THREE.MeshBasicMaterial({ 
        color: 0xffffff, 
        side: THREE.DoubleSide
    });
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    arrow.rotation.x = -Math.PI / 2;
    arrow.position.y = 0.1;
    group.add(arrow);
    
    // Outer ring indicator
    const ringGeo = new THREE.RingGeometry(1.0, 1.1, 32);
    const ringMat = new THREE.MeshBasicMaterial({ 
        color: 0x00ff88, 
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    group.add(ring);
    
    // Spawn number label (will be added by the caller)
    group.userData.type = 'spawn-point';
    group.userData.name = 'Spawn Point';
    
    group.position.set(x, y, z);
    group.rotation.y = angle * Math.PI / 180;
    
    return group;
}

function addSpawnPoint(x = 0, z = 0, angle = 0, y = 0) {
    // If y is 0, try to find the surface height at this position
    if (y === 0) {
        y = getSurfaceHeightAt(x, z);
    }
    
    const marker = createSpawnPointMarker(x, z, angle, y);
    const spawnIndex = state.startPositions.length;
    marker.userData.spawnIndex = spawnIndex;
    marker.userData.name = `Spawn Point ${spawnIndex + 1}`;
    
    state.startPositions.push(marker);
    state.scene.add(marker);
    
    updateSpawnPointsList();
    console.log(`🛹 Added spawn point ${spawnIndex + 1} at (${x}, ${y.toFixed(2)}, ${z})`);
    
    return marker;
}

// Get surface height at a given X,Z position by raycasting down
// startY: optional - if provided, starts raycast from this Y position (for local surface detection)
//         if not provided, starts from highest point of map (for global/initial placement)
function getSurfaceHeightAt(x, z, startY = null) {
    console.log(`🔍 getSurfaceHeightAt(${x.toFixed(2)}, ${z.toFixed(2)}, startY=${startY !== null ? startY.toFixed(2) : 'auto'})`);
    
    // Collect surfaces to test
    const surfacesToTest = [];
    
    // Add imported map surfaces from environmentObjects
    if (state.environmentObjects && state.environmentObjects.length > 0) {
        console.log(`   Found ${state.environmentObjects.length} environmentObjects`);
        state.environmentObjects.forEach(obj => {
            obj.traverse(child => {
                if (child.isMesh) surfacesToTest.push(child);
            });
        });
    } else {
        console.log(`   No environmentObjects found`);
    }
    
    // Add backdrop objects from state.objects
    state.objects.forEach(obj => {
        if (obj.userData.isBackdrop || obj.userData.type === 'backdrop' || obj.userData.type === 'imported-map') {
            obj.traverse(child => {
                if (child.isMesh) surfacesToTest.push(child);
            });
        }
    });
    
    console.log(`   Total surfaces to test: ${surfacesToTest.length}`);
    
    if (surfacesToTest.length === 0) {
        console.log(`   ⚠️ No surfaces found, returning Y=0`);
        return 0; // No surfaces, use Y=0
    }
    
    // Determine raycast start position
    let rayStartY;
    if (startY !== null) {
        // Start from slightly above the provided Y (for local surface detection below current position)
        rayStartY = startY + 2; // 2 meters above current position
        console.log(`   Starting raycast from current position Y=${rayStartY.toFixed(2)} (local mode)`);
    } else {
        // Start from highest point of map (for global/initial placement)
        let maxY = 100;
        surfacesToTest.forEach(mesh => {
            const meshBox = new THREE.Box3().setFromObject(mesh);
            if (meshBox.max.y > maxY) maxY = meshBox.max.y;
        });
        rayStartY = maxY + 50;
        console.log(`   Starting raycast from top Y=${rayStartY.toFixed(2)} (global mode)`);
    }
    
    const raycaster = new THREE.Raycaster(
        new THREE.Vector3(x, rayStartY, z),
        new THREE.Vector3(0, -1, 0)           // Point down
    );
    
    const intersects = raycaster.intersectObjects(surfacesToTest, false);
    
    if (intersects.length > 0) {
        console.log(`   ✅ Hit surface at Y=${intersects[0].point.y.toFixed(2)}`);
        return intersects[0].point.y + 0.5; // Slightly above surface
    }
    
    console.log(`   ⚠️ No intersection found, returning Y=0`);
    return 0; // Fallback to Y=0
}

// Snap selected spawn point to the surface below it
function snapSpawnPointToSurface() {
    console.log('🛹 snapSpawnPointToSurface() called');
    if (!state.selectedSpawnPoint) {
        console.log('⚠️ No spawn point selected!');
        return;
    }
    
    const x = state.selectedSpawnPoint.position.x;
    const y = state.selectedSpawnPoint.position.y;
    const z = state.selectedSpawnPoint.position.z;
    console.log(`🛹 Spawn point at X=${x.toFixed(2)}, Y=${y.toFixed(2)}, Z=${z.toFixed(2)}`);
    
    // Pass current Y position so raycast starts from spawn point's position, not from top of map
    // This ensures we find the surface BELOW the spawn point, not the first surface from top
    const surfaceY = getSurfaceHeightAt(x, z, y);
    console.log(`🛹 Surface Y below spawn point: ${surfaceY.toFixed(2)}`);
    
    // Add offset for skater standing height (about 1 meter above surface)
    const SPAWN_HEIGHT_ABOVE_SURFACE = 1.0;
    const newY = surfaceY + SPAWN_HEIGHT_ABOVE_SURFACE;
    
    state.selectedSpawnPoint.position.y = newY;
    
    updateSpawnPointsList();
    showSpawnPointProperties(state.selectedSpawnPoint);
    
    console.log(`📍 Snapped spawn point to surface at Y=${newY.toFixed(2)} (surface=${surfaceY.toFixed(2)})`);
}

// Snap placing object to the surface below it
function snapPlacingObjectToSurface() {
    if (!state.placingObject) return;
    
    const x = state.placingObject.position.x;
    const z = state.placingObject.position.z;
    
    // Raycast down from high above
    const surfaceY = getSurfaceHeightAt(x, z);
    
    // Get object's bounding box to place bottom on surface
    const box = new THREE.Box3().setFromObject(state.placingObject);
    const bottomOffset = state.placingObject.position.y - box.min.y;
    
    // Place object so its bottom sits on the surface
    state.placingObject.position.y = surfaceY + bottomOffset - 0.5; // -0.5 to sit ON surface, not above
    
    console.log(`📍 Snapped placing object to surface at Y=${state.placingObject.position.y.toFixed(2)}`);
}

function removeSpawnPoint(index) {
    if (index < 0 || index >= state.startPositions.length) return;
    
    const marker = state.startPositions[index];
    state.scene.remove(marker);
    
    // Clean up if selected
    if (state.selectedSpawnPoint === marker) {
        state.selectedSpawnPoint = null;
        state.transformControls.detach();
    }
    
    state.startPositions.splice(index, 1);
    
    // Re-index remaining spawn points
    state.startPositions.forEach((sp, i) => {
        sp.userData.spawnIndex = i;
        sp.userData.name = `Spawn Point ${i + 1}`;
    });
    
    updateSpawnPointsList();
    console.log(`🗑️ Removed spawn point ${index + 1}`);
}

function selectSpawnPoint(marker) {
    // Deselect any regular object
    if (state.selectedObject) {
        deselectObject();
    }
    
    state.selectedSpawnPoint = marker;
    state.transformControls.attach(marker);
    state.transformControls.setMode('translate');
    
    // Highlight selected spawn point
    state.startPositions.forEach((sp, i) => {
        const deck = sp.children[0];
        if (sp === marker) {
            deck.material.color.setHex(0xff3c00);
            deck.material.opacity = 1.0;
        } else {
            deck.material.color.setHex(0x00ff88);
            deck.material.opacity = 0.8;
        }
    });
    
    updateSpawnPointsList();
    showSpawnPointProperties(marker);
}

function deselectSpawnPoint() {
    if (state.selectedSpawnPoint) {
        const deck = state.selectedSpawnPoint.children[0];
        deck.material.color.setHex(0x00ff88);
        deck.material.opacity = 0.8;
        state.selectedSpawnPoint = null;
    }
    hideSpawnPointProperties();
}

function showSpawnPointProperties(marker) {
    document.getElementById('no-selection').classList.add('hidden');
    document.getElementById('object-properties').classList.remove('hidden');
    
    const nameEl = document.getElementById('selected-object-name');
    const typeEl = document.getElementById('selected-object-type');
    
    nameEl.textContent = marker.userData.name;
    typeEl.textContent = '🛹 Spawn Point';
    
    // Update position inputs
    document.getElementById('pos-x').value = marker.position.x.toFixed(2);
    document.getElementById('pos-y').value = marker.position.y.toFixed(2);
    document.getElementById('pos-z').value = marker.position.z.toFixed(2);
    
    // Update rotation (spawn angle)
    const angleDeg = (marker.rotation.y * 180 / Math.PI) % 360;
    document.getElementById('rot-y').value = angleDeg.toFixed(0);
}

function hideSpawnPointProperties() {
    // Only hide if no regular object is selected
    if (!state.selectedObject) {
        document.getElementById('no-selection').classList.remove('hidden');
        document.getElementById('object-properties').classList.add('hidden');
    }
}

function updateSpawnPointsList() {
    const container = document.getElementById('spawn-points-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    state.startPositions.forEach((marker, index) => {
        const item = document.createElement('div');
        item.className = 'spawn-point-item';
        if (state.selectedSpawnPoint === marker) {
            item.classList.add('selected');
        }
        
        const pos = marker.position;
        const angle = Math.round((marker.rotation.y * 180 / Math.PI) % 360);
        
        item.innerHTML = `
            <span class="spawn-number">${index + 1}</span>
            <span class="spawn-coords">X:${pos.x.toFixed(1)} Z:${pos.z.toFixed(1)}</span>
            <span class="spawn-angle">${angle}°</span>
            <button class="spawn-delete" data-index="${index}" title="Remove spawn point">✕</button>
        `;
        
        // Click on item to select (but not on delete button)
        item.addEventListener('click', (e) => {
            if (e.target.classList.contains('spawn-delete')) return;
            selectSpawnPoint(marker);
            // Focus camera on spawn point
            state.controls.target.copy(marker.position);
        });
        
        // Delete button
        item.querySelector('.spawn-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            if (state.startPositions.length > 1) {
                removeSpawnPoint(index);
            } else {
                alert('You need at least one spawn point!');
            }
        });
        
        container.appendChild(item);
    });
}

function setupSpawnPoints() {
    // Add default spawn point at origin
    addSpawnPoint(0, 0, 0);
    
    // Setup add spawn button
    const addBtn = document.getElementById('btn-add-spawn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            // Add new spawn point offset from last one
            const lastSpawn = state.startPositions[state.startPositions.length - 1];
            const newX = lastSpawn ? lastSpawn.position.x + 3 : 0;
            const newZ = lastSpawn ? lastSpawn.position.z + 3 : 0;
            const newMarker = addSpawnPoint(newX, newZ, 0);
            selectSpawnPoint(newMarker);
        });
    }
}

// ========================================
// CUSTOM MODEL UPLOAD (POLY.CAM SUPPORT)
// ========================================

function setupCustomModelUpload() {
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('model-upload');
    
    if (!uploadZone || !fileInput) return;
    
    // Drag and drop handlers
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('drag-over');
    });
    
    uploadZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
    });
    
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
        handleFileUpload(e.dataTransfer.files);
    });
    
    // Click to upload
    fileInput.addEventListener('change', (e) => {
        handleFileUpload(e.target.files);
        e.target.value = ''; // Reset for re-uploading same file
    });
}

async function handleFileUpload(files) {
    const uploadZone = document.getElementById('upload-zone');
    
    for (const file of files) {
        const ext = file.name.split('.').pop().toLowerCase();
        
        if (!['glb', 'gltf', 'obj', 'zip'].includes(ext)) {
            alert(`Unsupported file format: ${ext}\n\nSupported formats: GLB, GLTF, OBJ`);
            continue;
        }
        
        uploadZone.classList.add('loading');
        
        try {
            let model;
            
            if (ext === 'glb' || ext === 'gltf') {
                model = await loadGLTFModel(file);
            } else if (ext === 'obj') {
                model = await loadOBJModel(file);
            } else if (ext === 'zip') {
                // Poly.cam sometimes exports as zip with multiple files
                model = await loadZipModel(file);
            }
            
            if (model) {
                addCustomModelToPalette(model);
            }
        } catch (error) {
            console.error('Error loading model:', error);
            alert(`Failed to load ${file.name}: ${error.message}`);
        } finally {
            uploadZone.classList.remove('loading');
        }
    }
}

function loadGLTFModel(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const arrayBuffer = e.target.result;
            
            state.gltfLoader.parse(arrayBuffer, '', (gltf) => {
                const model = processLoadedModel(gltf.scene, file.name);
                resolve(model);
            }, (error) => {
                reject(error);
            });
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

function loadOBJModel(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const text = e.target.result;
            
            try {
                const object = state.objLoader.parse(text);
                const model = processLoadedModel(object, file.name);
                resolve(model);
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

async function loadZipModel(file) {
    const zip = await JSZip.loadAsync(file);
    
    // Categorize all files in the zip
    let objFile = null;
    let mtlFile = null;
    let glbFile = null;
    let gltfFile = null;
    const textureFiles = {};  // name -> blob URL
    const textureBlobs = {};  // name -> blob (for export)
    
    for (const [name, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) continue;
        
        const fileName = name.split('/').pop(); // Get just the filename
        const ext = fileName.split('.').pop().toLowerCase();
        
        if (ext === 'glb') {
            glbFile = zipEntry;
        } else if (ext === 'gltf') {
            gltfFile = zipEntry;
        } else if (ext === 'obj') {
            objFile = zipEntry;
        } else if (ext === 'mtl') {
            mtlFile = zipEntry;
        } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tga'].includes(ext)) {
            // Extract texture files
            const blob = await zipEntry.async('blob');
            const url = URL.createObjectURL(blob);
            textureFiles[fileName] = url;
            textureFiles[fileName.toLowerCase()] = url;
            textureBlobs[fileName] = blob;
            textureBlobs[fileName.toLowerCase()] = blob;
            console.log(`📷 Found texture: ${fileName}`);
        }
    }
    
    // Prefer GLB (self-contained), then GLTF, then OBJ+MTL
    if (glbFile) {
        const arrayBuffer = await glbFile.async('arraybuffer');
        return new Promise((resolve, reject) => {
            state.gltfLoader.parse(arrayBuffer, '', (gltf) => {
                const model = processLoadedModel(gltf.scene, file.name.replace('.zip', '.glb'));
                resolve(model);
            }, reject);
        });
    }
    
    if (gltfFile) {
        const text = await gltfFile.async('text');
        const json = JSON.parse(text);
        return new Promise((resolve, reject) => {
            state.gltfLoader.parse(JSON.stringify(json), '', (gltf) => {
                const model = processLoadedModel(gltf.scene, file.name.replace('.zip', '.gltf'));
                resolve(model);
            }, reject);
        });
    }
    
    if (objFile) {
        const objText = await objFile.async('text');
        
        // If we have an MTL file, load materials first
        if (mtlFile) {
            console.log('📦 Loading OBJ with MTL materials...');
            const mtlText = await mtlFile.async('text');
            
            // Parse MTL and create materials with textures
            const materials = parseMTLWithTextures(mtlText, textureFiles);
            
            // Apply materials to OBJ loader
            state.objLoader.setMaterials(materials);
            const object = state.objLoader.parse(objText);
            state.objLoader.setMaterials(null); // Reset for next load
            
            // Store texture data for export
            const model = processLoadedModel(object, file.name.replace('.zip', '.obj'));
            model.userData.customModelTextures = textureBlobs;
            model.userData.customModelMaterials = materials;
            
            return model;
        } else {
            // OBJ without MTL
            const object = state.objLoader.parse(objText);
            return processLoadedModel(object, file.name.replace('.zip', '.obj'));
        }
    }
    
    throw new Error('No 3D model found in zip file (supports GLB, GLTF, OBJ)');
}

/**
 * Parse MTL file and create Three.js materials with textures
 */
function parseMTLWithTextures(mtlText, textureFiles) {
    const materials = new MTLLoader.MaterialCreator();
    const materialDefs = {};
    
    let currentMaterial = null;
    const lines = mtlText.split('\n');
    
    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('#')) continue;
        
        const parts = line.split(/\s+/);
        const keyword = parts[0].toLowerCase();
        
        if (keyword === 'newmtl') {
            currentMaterial = parts[1];
            materialDefs[currentMaterial] = {
                name: currentMaterial,
                color: new THREE.Color(0.8, 0.8, 0.8),
                map: null
            };
        } else if (currentMaterial) {
            const matDef = materialDefs[currentMaterial];
            
            if (keyword === 'kd') {
                // Diffuse color
                matDef.color = new THREE.Color(
                    parseFloat(parts[1]),
                    parseFloat(parts[2]),
                    parseFloat(parts[3])
                );
            } else if (keyword === 'map_kd') {
                // Diffuse texture map
                const texName = parts.slice(1).join(' '); // Handle spaces in filename
                const texFile = texName.split(/[/\\]/).pop(); // Get just filename
                
                // Find texture (case-insensitive)
                const texUrl = textureFiles[texFile] || textureFiles[texFile.toLowerCase()];
                if (texUrl) {
                    console.log(`🎨 Applying texture: ${texFile}`);
                    matDef.mapUrl = texUrl;
                } else {
                    console.warn(`⚠️ Texture not found: ${texFile}`);
                }
            }
        }
    }
    
    // Create actual Three.js materials
    const textureLoader = new THREE.TextureLoader();
    const matLib = {};
    
    for (const [name, def] of Object.entries(materialDefs)) {
        const mat = new THREE.MeshStandardMaterial({
            name: name,
            color: def.color,
            side: THREE.DoubleSide,
            roughness: 0.8,
            metalness: 0.1
        });
        
        if (def.mapUrl) {
            const texture = textureLoader.load(def.mapUrl);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            mat.map = texture;
        }
        
        matLib[name] = mat;
    }
    
    // Create a fake MaterialCreator-like object
    return {
        materials: matLib,
        getAsArray: function() { return Object.values(this.materials); },
        preload: function() { return this; }
    };
}

function processLoadedModel(scene, fileName) {
    // Calculate bounding box to normalize size
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    // Normalize to reasonable skatepark scale (max dimension ~3 units)
    const maxDim = Math.max(size.x, size.y, size.z);
    const targetSize = 3;
    const scale = maxDim > 0 ? targetSize / maxDim : 1;
    
    scene.scale.multiplyScalar(scale);
    
    // Center at origin, bottom on ground
    box.setFromObject(scene);
    const newCenter = box.getCenter(new THREE.Vector3());
    const newMin = box.min;
    
    scene.position.sub(newCenter);
    scene.position.y -= newMin.y - center.y * scale;
    
    // Count geometry stats and extract textures/colors
    let vertexCount = 0;
    let triangleCount = 0;
    const extractedTextures = [];
    const extractedMaterials = [];
    let hasVertexColors = false;
    
    scene.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            
            if (child.geometry) {
                const geo = child.geometry;
                if (geo.attributes.position) {
                    vertexCount += geo.attributes.position.count;
                }
                if (geo.index) {
                    triangleCount += geo.index.count / 3;
                } else if (geo.attributes.position) {
                    triangleCount += geo.attributes.position.count / 3;
                }
                
                // Check for vertex colors
                if (geo.attributes.color) {
                    hasVertexColors = true;
                }
                
                // Ensure normals exist (some Poly.cam exports are missing them)
                if (!geo.attributes.normal) {
                    console.log('📐 Computing missing normals for mesh');
                    geo.computeVertexNormals();
                }
            }
            
            // Fix common material issues with Poly.cam exports
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            for (const mat of materials) {
                if (mat) {
                    // Use DoubleSide to fix inside-out models
                    mat.side = THREE.DoubleSide;
                    
                    // Fix transparency issues
                    if (mat.transparent && mat.opacity < 0.1) {
                        mat.transparent = false;
                        mat.opacity = 1;
                    }
                    
                    // Fix black models (missing or broken lighting)
                    if (mat.isMeshBasicMaterial === false && mat.isMeshStandardMaterial === false) {
                        // Convert unknown materials to standard
                        const newMat = new THREE.MeshStandardMaterial({
                            color: mat.color || 0x888888,
                            roughness: 0.7,
                            metalness: 0.1,
                            side: THREE.DoubleSide
                        });
                        if (mat.map) newMat.map = mat.map;
                        if (mat.vertexColors) newMat.vertexColors = true;
                        child.material = newMat;
                    }
                    
                    const matInfo = extractMaterialInfo(mat, extractedTextures.length);
                    extractedMaterials.push(matInfo);
                    
                    // Extract texture if available
                    if (mat.map && mat.map.image) {
                        const texData = extractTextureData(mat.map, `texture_${extractedTextures.length}`);
                        if (texData) {
                            extractedTextures.push(texData);
                            matInfo.textureIndex = extractedTextures.length - 1;
                        }
                    }
                }
            }
        }
    });
    
    console.log(`📦 Loaded model: ${fileName}`);
    console.log(`   Vertices: ${vertexCount}, Triangles: ${triangleCount}`);
    console.log(`   Has vertex colors: ${hasVertexColors}`);
    
    // Generate unique ID
    const modelId = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create model data
    const customModel = {
        id: modelId,
        name: fileName.replace(/\.[^/.]+$/, '').substring(0, 20), // Remove extension, limit length
        fileName: fileName,
        scene: scene.clone(), // Store a clone as template
        vertexCount,
        triangleCount,
        originalSize: size.clone(),
        normalizedScale: scale,
        textures: extractedTextures,
        materials: extractedMaterials,
        hasVertexColors
    };
    
    // Store in state
    state.customModels.push(customModel);
    
    console.log(`📦 Loaded custom model: ${customModel.name} (${vertexCount} verts, ${triangleCount} tris, ${extractedTextures.length} textures, hasVertexColors: ${hasVertexColors})`);
    
    return customModel;
}

// Extract texture data as base64
function extractTextureData(texture, name) {
    try {
        const image = texture.image;
        if (!image) return null;
        
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(image.width || 512, 1024); // Limit size for mobile
        canvas.height = Math.min(image.height || 512, 1024);
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        
        // Export as JPEG for smaller file size
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const base64 = dataUrl.split(',')[1];
        
        return {
            name: name,
            data: base64,
            width: canvas.width,
            height: canvas.height,
            format: 'jpg'
        };
    } catch (error) {
        console.warn('Failed to extract texture:', error);
        return null;
    }
}

// Extract material info (color, properties)
function extractMaterialInfo(material, index) {
    const info = {
        index: index,
        color: { r: 255, g: 255, b: 255 },
        textureIndex: -1,
        metalness: 0,
        roughness: 1
    };
    
    if (material.color) {
        info.color = {
            r: Math.round(material.color.r * 255),
            g: Math.round(material.color.g * 255),
            b: Math.round(material.color.b * 255)
        };
    }
    
    if (material.metalness !== undefined) {
        info.metalness = material.metalness;
    }
    
    if (material.roughness !== undefined) {
        info.roughness = material.roughness;
    }
    
    return info;
}

// ========================================
// MESH SIMPLIFICATION & SMOOTHING
// ========================================

/**
 * Simplify a custom model by reducing triangle count while preserving UVs and colors
 * @param {THREE.Object3D} object - The object to simplify
 * @param {number} targetReduction - Target reduction ratio (0.5 = 50% fewer triangles)
 */
function simplifyMesh(object, targetReduction = 0.5) {
    // Instead of using SimplifyModifier (which can create degenerate triangles),
    // we'll use makeHeightmapSurface which creates a clean grid mesh
    console.log('📐 Using heightmap-based simplification for clean results');
    
    // Calculate a resolution based on reduction - lower reduction = higher resolution
    // targetReduction of 0.5 -> ~16 resolution, 0.9 -> ~8 resolution
    const resolution = Math.max(8, Math.floor(32 * (1 - targetReduction)));
    
    return makeHeightmapSurface(object, resolution);
}

/**
 * Sample color from mesh at a given world position
 * Uses raycasting to find the nearest surface and sample its color
 */
function sampleColorFromMesh(object, position, defaultColor = new THREE.Color(0.5, 0.5, 0.5)) {
    // Collect all meshes and their materials/colors
    const meshes = [];
    object.traverse((child) => {
        if (child.isMesh) {
            meshes.push(child);
        }
    });
    
    if (meshes.length === 0) return defaultColor;
    
    // Find closest vertex or use material color
    let closestDist = Infinity;
    let closestColor = defaultColor.clone();
    
    for (const mesh of meshes) {
        const geo = mesh.geometry;
        const pos = geo.attributes.position;
        const colors = geo.attributes.color;
        
        mesh.updateWorldMatrix(true, false);
        const matrix = mesh.matrixWorld;
        
        for (let i = 0; i < pos.count; i++) {
            const vertex = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
            vertex.applyMatrix4(matrix);
            
            const dist = vertex.distanceTo(position);
            if (dist < closestDist) {
                closestDist = dist;
                
                // Get vertex color if available
                if (colors) {
                    closestColor = new THREE.Color(
                        colors.getX(i),
                        colors.getY(i),
                        colors.getZ(i)
                    );
                } else if (mesh.material) {
                    // Use material color
                    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
                    if (mat && mat.color) {
                        closestColor = mat.color.clone();
                    }
                }
            }
        }
    }
    
    return closestColor;
}

/**
 * Create a heightmap-based skateable surface that follows the shape of the object
 * This creates a smooth grid that preserves the overall shape and colors
 * @param {THREE.Object3D} object - The object to create surface for
 * @param {number} resolution - Grid resolution (higher = more detail)
 */
function makeHeightmapSurface(object, resolution = 16, textureResolution = 256) {
    console.log(`🏔️ Creating heightmap surface: mesh ${resolution}×${resolution}, texture ${textureResolution}px`);
    
    // Step 1: Extract ALL vertices from the object in world space
    const allVertices = [];
    const allColors = [];
    const allUVs = []; // Store original UVs for texture mapping
    
    object.traverse((child) => {
        if (child.isMesh && child.geometry) {
            child.updateWorldMatrix(true, false);
            const matrix = child.matrixWorld;
            const geo = child.geometry;
            const pos = geo.attributes.position;
            const colors = geo.attributes.color;
            const uvs = geo.attributes.uv;
            
            // Get material and check for texture
            const mat = Array.isArray(child.material) ? child.material[0] : child.material;
            let matColor = new THREE.Color(0.6, 0.6, 0.6);
            let textureData = null;
            let texWidth = 0, texHeight = 0;
            
            if (mat) {
                if (mat.color) matColor = mat.color.clone();
                
                // Try to get texture data for color sampling (fallback if no texture reuse)
                if (mat.map && mat.map.image) {
                    try {
                        const img = mat.map.image;
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width || img.naturalWidth || 256;
                        canvas.height = img.height || img.naturalHeight || 256;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        textureData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                        texWidth = canvas.width;
                        texHeight = canvas.height;
                        console.log(`🎨 Found texture: ${texWidth}x${texHeight}`);
                    } catch (e) {
                        console.warn('Could not read texture:', e);
                    }
                }
            }
            
            for (let i = 0; i < pos.count; i++) {
                const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
                v.applyMatrix4(matrix);
                allVertices.push(v);
                
                // Store original UV coordinates for texture mapping
                if (uvs) {
                    allUVs.push({ u: uvs.getX(i), v: uvs.getY(i) });
                } else {
                    allUVs.push({ u: 0.5, v: 0.5 });
                }
                
                // Priority: vertex colors > texture sample > material color
                if (colors) {
                    allColors.push(new THREE.Color(colors.getX(i), colors.getY(i), colors.getZ(i)));
                } else if (textureData && uvs) {
                    // Sample color from texture using UV coordinates
                    const u = uvs.getX(i);
                    const v_coord = uvs.getY(i);
                    
                    // Convert UV to pixel coordinates (handle wrapping)
                    const px = Math.floor((((u % 1) + 1) % 1) * (texWidth - 1));
                    const py = Math.floor((1 - (((v_coord % 1) + 1) % 1)) * (texHeight - 1));
                    
                    const idx = (py * texWidth + px) * 4;
                    const r = textureData[idx] / 255;
                    const g = textureData[idx + 1] / 255;
                    const b = textureData[idx + 2] / 255;
                    
                    allColors.push(new THREE.Color(r, g, b));
                } else {
                    allColors.push(matColor.clone());
                }
            }
        }
    });
    
    if (allVertices.length === 0) {
        console.warn('No vertices found in object');
        return object;
    }
    
    console.log(`📊 Extracted ${allVertices.length} vertices from original mesh`);
    
    // Step 2: Calculate bounding box from extracted vertices
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    for (const v of allVertices) {
        minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
        minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
        minZ = Math.min(minZ, v.z); maxZ = Math.max(maxZ, v.z);
    }
    
    const sizeX = maxX - minX;
    const sizeZ = maxZ - minZ;
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    
    // Step 3: Create a grid and find heights by sampling nearest vertices
    const gridWidth = resolution;
    const gridDepth = resolution;
    const cellWidth = sizeX / (gridWidth - 1);
    const cellDepth = sizeZ / (gridDepth - 1);
    
    // Build a simple spatial lookup - divide space into cells
    const spatialGridSize = Math.max(gridWidth, gridDepth);
    const spatialCellW = sizeX / spatialGridSize;
    const spatialCellD = sizeZ / spatialGridSize;
    const spatialGrid = new Map();
    
    for (let i = 0; i < allVertices.length; i++) {
        const v = allVertices[i];
        const gx = Math.floor((v.x - minX) / spatialCellW);
        const gz = Math.floor((v.z - minZ) / spatialCellD);
        const key = `${gx},${gz}`;
        if (!spatialGrid.has(key)) spatialGrid.set(key, []);
        spatialGrid.get(key).push(i);
    }
    
    const heightData = [];
    const colorData = [];
    const uvData = []; // Store sampled UVs for texture mapping
    const searchRadius = Math.max(cellWidth, cellDepth) * 1.5;
    
    for (let z = 0; z < gridDepth; z++) {
        for (let x = 0; x < gridWidth; x++) {
            const worldX = minX + x * cellWidth;
            const worldZ = minZ + z * cellDepth;
            
            // Find vertices near this grid point and get the highest one
            let bestHeight = minY;
            let bestColor = new THREE.Color(0.5, 0.5, 0.5);
            let bestUV = { u: x / (gridWidth - 1), v: z / (gridDepth - 1) }; // Default linear UV
            let bestDist = Infinity;
            
            // Check nearby spatial cells
            const gx = Math.floor((worldX - minX) / spatialCellW);
            const gz = Math.floor((worldZ - minZ) / spatialCellD);
            
            for (let dx = -2; dx <= 2; dx++) {
                for (let dz = -2; dz <= 2; dz++) {
                    const key = `${gx + dx},${gz + dz}`;
                    const indices = spatialGrid.get(key);
                    if (!indices) continue;
                    
                    for (const i of indices) {
                        const v = allVertices[i];
                        const distXZ = Math.sqrt((v.x - worldX) ** 2 + (v.z - worldZ) ** 2);
                        
                        if (distXZ < searchRadius) {
                            // Prefer closer points, then higher points
                            if (distXZ < bestDist || (v.y > bestHeight && distXZ < bestDist * 1.5)) {
                                bestHeight = v.y;
                                bestDist = distXZ;
                                bestColor = allColors[i].clone();
                                bestUV = allUVs[i];
                            }
                        }
                    }
                }
            }
            
            heightData.push(bestHeight);
            colorData.push(bestColor);
            uvData.push(bestUV);
        }
    }
    
    // Step 4: Smooth the heightmap (box blur)
    const smoothedHeights = [...heightData];
    for (let pass = 0; pass < 2; pass++) { // Two smoothing passes
        const temp = [...smoothedHeights];
        for (let z = 1; z < gridDepth - 1; z++) {
            for (let x = 1; x < gridWidth - 1; x++) {
                const idx = z * gridWidth + x;
                let sum = 0;
                for (let dz = -1; dz <= 1; dz++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        sum += temp[(z + dz) * gridWidth + (x + dx)];
                    }
                }
                smoothedHeights[idx] = sum / 9;
            }
        }
    }
    
    // Step 5: Create a NEW texture by sampling colors at high resolution
    // This avoids issues with complex UV islands in the original mesh
    const texResolution = textureResolution; // User-controlled texture resolution
    const bakedTextureData = new Uint8Array(texResolution * texResolution * 4);
    
    // Sample colors onto a regular grid for the texture
    for (let ty = 0; ty < texResolution; ty++) {
        for (let tx = 0; tx < texResolution; tx++) {
            // Map texture coordinates to world XZ
            const worldX = minX + (tx / (texResolution - 1)) * sizeX;
            const worldZ = minZ + (ty / (texResolution - 1)) * sizeZ;
            
            // Find nearest vertex for this texture pixel
            let bestColor = new THREE.Color(0.5, 0.5, 0.5);
            let bestDist = Infinity;
            
            const gx = Math.floor((worldX - minX) / spatialCellW);
            const gz = Math.floor((worldZ - minZ) / spatialCellD);
            
            for (let dx = -3; dx <= 3; dx++) {
                for (let dz = -3; dz <= 3; dz++) {
                    const key = `${gx + dx},${gz + dz}`;
                    const indices = spatialGrid.get(key);
                    if (!indices) continue;
                    
                    for (const i of indices) {
                        const v = allVertices[i];
                        const distXZ = (v.x - worldX) ** 2 + (v.z - worldZ) ** 2;
                        if (distXZ < bestDist) {
                            bestDist = distXZ;
                            bestColor = allColors[i];
                        }
                    }
                }
            }
            
            const pixelIdx = (ty * texResolution + tx) * 4;
            bakedTextureData[pixelIdx] = Math.floor(bestColor.r * 255);
            bakedTextureData[pixelIdx + 1] = Math.floor(bestColor.g * 255);
            bakedTextureData[pixelIdx + 2] = Math.floor(bestColor.b * 255);
            bakedTextureData[pixelIdx + 3] = 255;
        }
    }
    
    // Create texture from sampled data
    const bakedTexture = new THREE.DataTexture(
        bakedTextureData,
        texResolution,
        texResolution,
        THREE.RGBAFormat
    );
    bakedTexture.needsUpdate = true;
    bakedTexture.flipY = false;
    console.log(`🎨 Created baked ${texResolution}x${texResolution} texture from original colors`);
    
    // Step 6: Create geometry - directly in world space, will transform at end
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const uvs = [];
    const indices = [];
    
    for (let z = 0; z < gridDepth; z++) {
        for (let x = 0; x < gridWidth; x++) {
            const idx = z * gridWidth + x;
            vertices.push(
                minX + x * cellWidth,
                smoothedHeights[idx],
                minZ + z * cellDepth
            );
            // Simple linear UVs that map to our baked texture
            uvs.push(x / (gridWidth - 1), z / (gridDepth - 1));
        }
    }
    
    // Create triangles with correct winding
    for (let z = 0; z < gridDepth - 1; z++) {
        for (let x = 0; x < gridWidth - 1; x++) {
            const tl = z * gridWidth + x;
            const tr = tl + 1;
            const bl = (z + 1) * gridWidth + x;
            const br = bl + 1;
            
            // Two triangles per quad - CCW winding for top-facing
            indices.push(tl, bl, tr);
            indices.push(tr, bl, br);
        }
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    // Step 7: Transform geometry to object's local space
    object.updateWorldMatrix(true, false);
    const inverseMatrix = object.matrixWorld.clone().invert();
    geometry.applyMatrix4(inverseMatrix);
    
    // Step 8: Create material with our baked texture
    const material = new THREE.MeshStandardMaterial({
        map: bakedTexture,
        roughness: 0.7,
        metalness: 0.1,
        side: THREE.DoubleSide
    });
    
    // Step 8: Clear original children
    while (object.children.length > 0) {
        const child = object.children[0];
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach(m => m.dispose());
            } else {
                child.material.dispose();
            }
        }
        object.remove(child);
    }
    
    // Step 9: Add new mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    object.add(mesh);
    
    const totalVerts = geometry.attributes.position.count;
    console.log(`✅ Created clean heightmap: ${resolution}×${resolution} grid = ${totalVerts} vertices`);
    
    // Update custom model data
    if (object.userData.customModelId) {
        const model = state.customModels.find(m => m.id === object.userData.customModelId);
        if (model) {
            model.isHeightmap = true;
            model.vertexCount = totalVerts;
        }
    }
    
    return object;
}

/**
 * Helper to create wall geometry for heightmap sides
 */
function createWallGeometry(startPos, endPos, steps, heights, bottomY, fixedCoord, axis, colors) {
    const vertices = [];
    const vertColors = [];
    const indices = [];
    const stepSize = (endPos - startPos) / (steps - 1);
    
    for (let i = 0; i < steps; i++) {
        const pos = startPos + i * stepSize;
        const h = heights[i];
        const c = colors[i] || new THREE.Color(0.5, 0.5, 0.5);
        
        if (axis === 'z') {
            // Wall perpendicular to X axis
            vertices.push(pos, h, fixedCoord);
            vertices.push(pos, bottomY, fixedCoord);
        } else {
            // Wall perpendicular to Z axis
            vertices.push(fixedCoord, h, pos);
            vertices.push(fixedCoord, bottomY, pos);
        }
        
        // Darken color for bottom vertices
        vertColors.push(c.r, c.g, c.b);
        vertColors.push(c.r * 0.5, c.g * 0.5, c.b * 0.5);
    }
    
    // Create quads
    for (let i = 0; i < steps - 1; i++) {
        const tl = i * 2;
        const bl = i * 2 + 1;
        const tr = (i + 1) * 2;
        const br = (i + 1) * 2 + 1;
        
        indices.push(tl, bl, tr);
        indices.push(tr, bl, br);
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(vertColors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    return geometry;
}

/**
 * Get average color from array of THREE.Colors
 */
function getAverageColor(colors) {
    if (colors.length === 0) return new THREE.Color(0.5, 0.5, 0.5);
    
    let r = 0, g = 0, b = 0;
    for (const c of colors) {
        r += c.r;
        g += c.g;
        b += c.b;
    }
    return new THREE.Color(r / colors.length, g / colors.length, b / colors.length);
}

/**
 * Create a convex hull around the object for smooth skating
 * IMPROVED: Now preserves vertex colors from original mesh
 * @param {THREE.Object3D} object - The object to wrap in convex hull
 */
function makeConvexHull(object) {
    console.log('📦 Creating convex hull...');
    
    // Step 1: Collect all vertices in world space
    const points = [];
    const pointColors = [];
    
    object.traverse((child) => {
        if (child.isMesh && child.geometry) {
            child.updateWorldMatrix(true, false);
            const matrix = child.matrixWorld;
            const geo = child.geometry;
            const pos = geo.attributes.position;
            const colors = geo.attributes.color;
            
            let matColor = new THREE.Color(0.6, 0.6, 0.6);
            if (child.material) {
                const mat = Array.isArray(child.material) ? child.material[0] : child.material;
                if (mat && mat.color) matColor = mat.color.clone();
            }
            
            for (let i = 0; i < pos.count; i++) {
                const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
                v.applyMatrix4(matrix);
                points.push(v);
                
                if (colors) {
                    pointColors.push(new THREE.Color(colors.getX(i), colors.getY(i), colors.getZ(i)));
                } else {
                    pointColors.push(matColor.clone());
                }
            }
        }
    });
    
    if (points.length < 4) {
        console.warn('Not enough points for convex hull');
        return object;
    }
    
    try {
        // Step 2: Create convex hull
        const convexGeometry = new ConvexGeometry(points);
        
        // Step 3: Sample colors for hull vertices
        const convexPos = convexGeometry.attributes.position;
        const vertexColors = [];
        
        for (let i = 0; i < convexPos.count; i++) {
            const v = new THREE.Vector3(convexPos.getX(i), convexPos.getY(i), convexPos.getZ(i));
            
            // Find closest original point for color
            let closestDist = Infinity;
            let closestColor = new THREE.Color(0.5, 0.5, 0.5);
            
            for (let j = 0; j < Math.min(points.length, 1000); j++) { // Limit search for performance
                const dist = v.distanceToSquared(points[j]);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestColor = pointColors[j];
                }
            }
            vertexColors.push(closestColor.r, closestColor.g, closestColor.b);
        }
        
        convexGeometry.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 3));
        convexGeometry.computeVertexNormals();
        
        // Step 4: Transform to local space BEFORE creating mesh
        object.updateWorldMatrix(true, false);
        const inverseMatrix = object.matrixWorld.clone().invert();
        convexGeometry.applyMatrix4(inverseMatrix);
        
        // Step 5: Create material and mesh
        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.6,
            metalness: 0.1,
            side: THREE.DoubleSide
        });
        
        const convexMesh = new THREE.Mesh(convexGeometry, material);
        convexMesh.castShadow = true;
        convexMesh.receiveShadow = true;
        
        // Step 6: Clear old children
        while (object.children.length > 0) {
            const child = object.children[0];
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
            object.remove(child);
        }
        
        // Step 7: Add convex hull
        object.add(convexMesh);
        
        console.log(`✅ Created convex hull: ${points.length} → ${convexGeometry.attributes.position.count} vertices`);
        
        if (object.userData.customModelId) {
            const model = state.customModels.find(m => m.id === object.userData.customModelId);
            if (model) {
                model.isConvexHull = true;
                model.vertexCount = convexGeometry.attributes.position.count;
            }
        }
        
    } catch (error) {
        console.error('Failed to create convex hull:', error);
        // Fallback to heightmap if convex hull fails
        console.log('⚠️ Falling back to heightmap mode...');
        return makeHeightmapSurface(object, 16);
    }
    
    return object;
}

/**
 * Make a skateable version using smart decimation that preserves shape
 * This is better than convex hull for detailed scans
 * @param {THREE.Object3D} object - The object to make skateable
 * @param {string} mode - 'heightmap' | 'convex' | 'decimate'
 * @param {number} quality - Quality level (resolution for heightmap, reduction for decimate)
 */
function makeSkateable(object, mode = 'heightmap', quality = 16, textureResolution = 256) {
    console.log(`🛹 Making skateable with mode: ${mode}, quality: ${quality}, texture: ${textureResolution}px`);
    
    switch (mode) {
        case 'heightmap':
            return makeHeightmapSurface(object, quality, textureResolution);
        case 'convex':
            return makeConvexHull(object);
        case 'decimate':
            // Uses heightmap under the hood for clean results
            simplifyMesh(object, quality);
            return object;
        default:
            return makeHeightmapSurface(object, quality, textureResolution);
    }
}

/**
 * Flip model on specified axis
 */
function flipModel(axis) {
    if (!state.selectedObject) return;
    
    switch (axis) {
        case 'x':
            state.selectedObject.scale.x *= -1;
            break;
        case 'y':
            state.selectedObject.scale.y *= -1;
            break;
        case 'z':
            state.selectedObject.scale.z *= -1;
            break;
    }
    
    console.log(`🔄 Flipped model on ${axis.toUpperCase()} axis`);
    saveUndoState();
}

/**
 * Rotate model 90° on specified axis
 */
function rotateModel(axis) {
    if (!state.selectedObject) return;
    
    const angle = Math.PI / 2; // 90 degrees
    
    switch (axis) {
        case 'x':
            state.selectedObject.rotation.x += angle;
            break;
        case 'y':
            state.selectedObject.rotation.y += angle;
            break;
        case 'z':
            state.selectedObject.rotation.z += angle;
            break;
    }
    
    console.log(`🔄 Rotated model 90° on ${axis.toUpperCase()} axis`);
    saveUndoState();
}

/**
 * Scale model by factor
 */
function scaleModel(factor) {
    if (!state.selectedObject) return;
    
    state.selectedObject.scale.multiplyScalar(factor);
    
    console.log(`📏 Scaled model by ${factor}x`);
    saveUndoState();
}

/**
 * Reset model to original transform
 */
function resetModel() {
    if (!state.selectedObject) return;
    
    const customModelId = state.selectedObject.userData.customModelId;
    if (!customModelId) {
        alert('Reset only works on custom models');
        return;
    }
    
    const model = state.customModels.find(m => m.id === customModelId);
    if (model && model.scene) {
        // Get original scale
        const originalScale = model.normalizedScale || 1;
        
        state.selectedObject.scale.set(originalScale, originalScale, originalScale);
        state.selectedObject.rotation.set(0, 0, 0);
        
        console.log(`🔄 Reset model to original transform`);
        saveUndoState();
    }
}

/**
 * Toggle wireframe display on selected model
 */
function toggleWireframe(enabled) {
    if (!state.selectedObject) return;
    
    state.selectedObject.traverse((child) => {
        if (child.isMesh && child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            for (const mat of materials) {
                mat.wireframe = enabled;
            }
        }
    });
    
    console.log(`📐 Wireframe: ${enabled ? 'ON' : 'OFF'}`);
}

/**
 * Apply simplification to the currently selected custom model
 */
function simplifySelectedModel(reduction = 0.5) {
    if (!state.selectedObject) return;
    if (state.selectedObject.userData.type !== 'custom-model') {
        alert('Simplify only works on uploaded 3D models');
        return;
    }
    
    simplifyMesh(state.selectedObject, reduction);
    
    // Update vertex count in model data
    let newVertCount = 0;
    state.selectedObject.traverse((child) => {
        if (child.isMesh && child.geometry) {
            newVertCount += child.geometry.attributes.position.count;
        }
    });
    
    const model = state.customModels.find(m => m.id === state.selectedObject.userData.customModelId);
    if (model) {
        model.vertexCount = newVertCount;
    }
    
    updatePropertiesPanel();
    alert(`Mesh simplified! New vertex count: ${newVertCount}`);
}

/**
 * Convert selected model to skateable surface using selected mode
 */
function makeSelectedSkateable() {
    if (!state.selectedObject) return;
    if (state.selectedObject.userData.type !== 'custom-model') {
        alert('Make Skateable only works on uploaded 3D models');
        return;
    }
    
    // Get selected mode
    const modeRadio = document.querySelector('input[name="skateable-mode"]:checked');
    const mode = modeRadio ? modeRadio.value : 'heightmap';
    
    // Get mesh quality value from slider
    const qualitySlider = document.getElementById('skateable-quality');
    let quality = qualitySlider ? parseInt(qualitySlider.value) : 16;
    
    // Get texture resolution from slider
    const texResSlider = document.getElementById('texture-res-slider');
    const textureResolution = texResSlider ? parseInt(texResSlider.value) : 256;
    
    // Adjust quality interpretation based on mode
    let displayQuality = quality;
    if (mode === 'decimate') {
        // For decimate, convert 8-32 range to 0.5-0.9 reduction
        quality = 0.5 + (quality - 8) / 24 * 0.4; // Maps 8->0.5, 32->0.9
        displayQuality = Math.round(quality * 100);
    }
    
    // Apply the appropriate transformation
    makeSkateable(state.selectedObject, mode, quality, textureResolution);
    updatePropertiesPanel();
    
    // Mode-specific messages
    const messages = {
        'heightmap': `✅ Created smooth heightmap surface (${displayQuality}×${displayQuality} grid) with ${textureResolution}px texture!`,
        'convex': '✅ Created convex hull with colors - simple shape great for basic skating!',
        'decimate': `✅ Reduced mesh by ${displayQuality}% while keeping textures and shape!`
    };
    
    alert(messages[mode] || 'Model converted to skateable surface!');
}

/**
 * Legacy function for compatibility
 */
function makeSelectedConvex() {
    if (!state.selectedObject) return;
    if (state.selectedObject.userData.type !== 'custom-model') {
        alert('Convex hull only works on uploaded 3D models');
        return;
    }
    
    makeConvexHull(state.selectedObject);
    updatePropertiesPanel();
    alert('Model converted to smooth convex hull - perfect for skating!');
}

function addCustomModelToPalette(model) {
    const container = document.getElementById('custom-models-list');
    if (!container) return;
    
    const button = document.createElement('button');
    button.className = 'palette-item custom-model';
    button.dataset.customModel = model.id;
    
    button.innerHTML = `
        <div class="palette-icon">🎨</div>
        <span class="model-name" title="${model.fileName}">${model.name}</span>
        <button class="delete-model" title="Remove model">×</button>
    `;
    
    // Click to select for placement
    button.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-model')) {
            e.stopPropagation();
            removeCustomModel(model.id);
            return;
        }
        selectCustomModelForPlacement(model.id);
    });
    
    container.appendChild(button);
}

function removeCustomModel(modelId) {
    // Remove from state
    state.customModels = state.customModels.filter(m => m.id !== modelId);
    
    // Remove from palette
    const button = document.querySelector(`[data-custom-model="${modelId}"]`);
    if (button) {
        button.remove();
    }
    
    // Cancel if currently placing this model
    if (state.placingObject && state.placingObject.userData.customModelId === modelId) {
        cancelPlacing();
    }
}

function selectCustomModelForPlacement(modelId) {
    const model = state.customModels.find(m => m.id === modelId);
    if (!model) return;
    
    // Remove previous selection
    document.querySelectorAll('.palette-item').forEach(i => i.classList.remove('selected'));
    document.querySelector(`[data-custom-model="${modelId}"]`)?.classList.add('selected');
    
    // Cancel any existing placement
    cancelPlacing();
    
    // Clone the model scene for placement
    const placingModel = model.scene.clone();
    placingModel.userData.type = 'custom-model';
    placingModel.userData.customModelId = model.id;
    placingModel.userData.name = model.name;
    placingModel.userData.props = {
        scale: 1,
        vertexCount: model.vertexCount,
        triangleCount: model.triangleCount
    };
    
    // Make semi-transparent for preview
    setObjectOpacity(placingModel, 0.5);
    
    state.placingObject = placingModel;
    state.scene.add(placingModel);
    setMode('PLACE');
}

// Add custom model to OBJECT_DEFINITIONS for property panel
function getCustomModelDefinition(modelId) {
    const model = state.customModels.find(m => m.id === modelId);
    if (!model) return null;
    
    return {
        name: model.name,
        category: 'custom',
        defaultProps: {
            scale: 1
        },
        create: (props) => {
            const clone = model.scene.clone();
            clone.scale.multiplyScalar(props.scale);
            return clone;
        }
    };
}

// ========================================
// DIY PACK LOADING (TRUESKATE OBJECTS)
// ========================================

function setupDIYPackUpload() {
    const uploadZone = document.getElementById('diy-upload-zone');
    const fileInput = document.getElementById('diy-upload');
    
    if (!uploadZone || !fileInput) return;
    
    // Try to auto-load the Braille House DIY pack if available
    autoLoadDIYPack();
    
    // Drag and drop handlers
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('drag-over');
    });
    
    uploadZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
    });
    
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
        handleDIYPackUpload(e.dataTransfer.files);
    });
    
    // Click to upload
    fileInput.addEventListener('change', (e) => {
        handleDIYPackUpload(e.target.files);
        e.target.value = '';
    });
}

async function handleDIYPackUpload(files) {
    for (const file of files) {
        const ext = file.name.split('.').pop().toLowerCase();
        
        if (ext !== 'zip') {
            alert(`Please upload a .zip DIY pack file`);
            continue;
        }
        
        try {
            await loadDIYPack(file);
        } catch (error) {
            console.error('Error loading DIY pack:', error);
            alert(`Failed to load ${file.name}: ${error.message}`);
        }
    }
}

async function autoLoadDIYPack() {
    // Load all DIY packs from the diy_objects_modits folder
    try {
        // First try to load from manifest
        const manifestResponse = await fetch('/diy_objects_modits/manifest.json');
        if (manifestResponse.ok) {
            const manifest = await manifestResponse.json();
            console.log(`🛹 Found ${manifest.packs.length} DIY packs to load...`);
            
            let loadedCount = 0;
            for (const packName of manifest.packs) {
                try {
                    const response = await fetch(`/diy_objects_modits/${packName}`);
                    if (response.ok) {
                        const blob = await response.blob();
                        const file = new File([blob], packName, { type: 'application/zip' });
                        await loadDIYPack(file);
                        loadedCount++;
                        console.log(`🛹 Loaded: ${packName}`);
                    }
                } catch (e) {
                    console.warn(`⚠️ Failed to load ${packName}:`, e.message);
                }
            }
            console.log(`🛹 Auto-loaded ${loadedCount}/${manifest.packs.length} DIY packs!`);
            return;
        }
    } catch (error) {
        console.log('DIY manifest not available, trying legacy pack...');
    }
    
    // Fallback: Try to load the legacy Braille House DIY pack
    try {
        const response = await fetch('/braillehouse_diys-ak6v.zip');
        if (response.ok) {
            const blob = await response.blob();
            const file = new File([blob], 'braillehouse_diys-ak6v.zip', { type: 'application/zip' });
            await loadDIYPack(file);
            console.log('🛹 Auto-loaded Braille House DIY pack!');
        }
    } catch (error) {
        console.log('DIY pack not available for auto-load');
    }
}

async function loadDIYPack(file) {
    const zip = await JSZip.loadAsync(file);
    
    // Look for _mod.json to get object info
    let modJson = null;
    let packName = file.name.replace('.zip', '');
    const objects = [];
    const textures = {};
    const icons = {};
    
    // First pass: collect all files
    const filePromises = [];
    
    zip.forEach((relativePath, zipEntry) => {
        // Skip MACOSX metadata
        if (relativePath.includes('__MACOSX')) return;
        
        const filename = relativePath.split('/').pop();
        const ext = filename.split('.').pop().toLowerCase();
        
        if (filename === '_mod.json') {
            filePromises.push(
                zipEntry.async('string').then(content => {
                    try {
                        // The _mod.json in DIY packs has a special format
                        // Try to parse it, handling malformed JSON
                        let jsonStr = content.trim();
                        // Add wrapping braces if needed
                        if (!jsonStr.startsWith('{')) {
                            jsonStr = '{' + jsonStr + '}';
                        }
                        // Fix missing commas between properties
                        jsonStr = jsonStr.replace(/"\s*\n\s*"/g, '",\n"');
                        jsonStr = jsonStr.replace(/}\s*\n\s*]/g, '}\n]');
                        jsonStr = jsonStr.replace(/]\s*\n\s*}/g, ']\n}');
                        modJson = JSON.parse(jsonStr);
                    } catch (e) {
                        console.warn('Could not parse _mod.json, will use file discovery', e);
                    }
                })
            );
        } else if (ext === 'txt' && filename !== 'readme.txt') {
            // This is likely a DIY object file
            filePromises.push(
                zipEntry.async('string').then(content => {
                    objects.push({
                        filename: filename,
                        content: content
                    });
                })
            );
        } else if (['jpg', 'jpeg', 'png'].includes(ext)) {
            // Image file - could be texture or icon
            filePromises.push(
                zipEntry.async('blob').then(blob => {
                    const url = URL.createObjectURL(blob);
                    // Store icons (icon_ prefix, icon.* pattern, or _thumbnail suffix)
                    if (filename.startsWith('icon_') || filename.startsWith('icon.') || filename.includes('_thumbnail')) {
                        icons[filename] = url;
                    } else {
                        // Store BOTH url (for display) and blob (for export)
                        textures[filename] = { url: url, blob: blob };
                    }
                })
            );
        }
    });
    
    await Promise.all(filePromises);
    
    // Create pack info
    const packId = 'pack_' + Date.now();
    const pack = {
        id: packId,
        name: packName,
        objects: [],
        textures: textures
    };
    
    // Parse object info from _mod.json if available
    let objectInfoMap = {};
    if (modJson && modJson.modObjectInfoList) {
        for (const item of modJson.modObjectInfoList) {
            const info = item.modObjectInfo;
            if (info) {
                objectInfoMap[info.fileName] = {
                    name: info.name,
                    thumbnail: info.thumbnail
                };
            }
        }
    }
    
    // Process each object file
    for (const obj of objects) {
        const info = objectInfoMap[obj.filename] || {};
        const objName = info.name || obj.filename.replace('.txt', '').replace(/_/g, ' ');
        const iconFile = info.thumbnail || `icon_${obj.filename.replace('.txt', '').replace('_DIY', '').replace('_diy', '')}.png`;
        
        const diyObject = {
            id: `diy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            packId: packId,
            packName: packName,
            name: objName,
            filename: obj.filename,
            content: obj.content,
            icon: icons[iconFile] || null,
            textures: textures,
            mesh: null // Will be created when placed
        };
        
        // Parse the mesh data for display
        diyObject.mesh = parseTrueSkateObject(obj.content, textures);
        
        // Store original content for export (preserves VIS/COL alignment)
        diyObject.originalContent = obj.content;
        
        pack.objects.push(diyObject);
        state.diyObjects.push(diyObject);
    }
    
    state.diyPacks.push(pack);
    
    // Add to palette
    addDIYPackToPalette(pack);
    
    console.log(`🛹 Loaded DIY pack: ${packName} with ${pack.objects.length} objects`);
}

/**
 * Parse a TrueSkate .txt object file and create a THREE.js mesh/group
 * Supports multi-material rendering for proper texture display
 */
function parseTrueSkateObject(content, textures) {
    // ROBUST MARKER-BASED PARSER
    // Keep original lines WITH comments for searching
    const originalLines = content.split('\n');
    
    // Helper to extract numeric value from a line (strips comments)
    const parseValue = (line) => {
        if (!line) return NaN;
        const numPart = line.split('#')[0].trim();
        return numPart;
    };
    const parseFloat2 = (line) => parseFloat(parseValue(line));
    const parseInt2 = (line) => parseInt(parseValue(line));
    
    console.log('🔍 ROBUST PARSER: Starting marker-based parsing...');
    console.log(`📄 Total lines in file: ${originalLines.length}`);
    
    // STEP 1: Find all key markers in the file
    const markers = {
        visStart: -1,
        numTextures: -1,
        numMaterials: -1,
        meshHeaderStart: -1,      // Line with total vertices before mesh headers
        meshVerticesMarkers: [],  // Lines with "#Mesh Vertices"
        meshIndicesMarkers: [],   // Lines with "#Mesh Indices"
        colStart: -1,
        visEnd: -1
    };
    
    for (let i = 0; i < originalLines.length; i++) {
        const line = originalLines[i];
        const trimmed = line.trim();
        
        if (trimmed.startsWith('<VIS')) {
            markers.visStart = i;
        } else if (trimmed.includes('#Num Textures')) {
            markers.numTextures = i;
        } else if (trimmed.includes('#Num Materials')) {
            markers.numMaterials = i;
        } else if (trimmed === '#Mesh Vertices') {
            markers.meshVerticesMarkers.push(i);
        } else if (trimmed === '#Mesh Indices') {
            markers.meshIndicesMarkers.push(i);
        } else if (trimmed.startsWith('<COL')) {
            markers.colStart = i;
        } else if (trimmed === '>' && markers.visStart !== -1 && markers.visEnd === -1 && markers.meshIndicesMarkers.length > 0) {
            // First '>' after we've seen mesh indices is VIS end
            if (i > markers.meshIndicesMarkers[markers.meshIndicesMarkers.length - 1]) {
                markers.visEnd = i;
            }
        }
    }
    
    // Find mesh header start: look for pattern "XXXXX #Num Vertices" followed by "YY" (num meshes)
    // This should be AFTER the materials but BEFORE the first #Mesh Vertices
    const firstMeshVertices = markers.meshVerticesMarkers[0] || originalLines.length;
    for (let i = markers.numMaterials + 1; i < firstMeshVertices; i++) {
        const line = originalLines[i];
        if (line && line.includes('#Num Vertices') && !line.includes('#Mesh')) {
            // This is the total vertices line
            markers.meshHeaderStart = i;
            break;
        }
    }
    
    console.log('📍 MARKERS FOUND:', {
        visStart: markers.visStart,
        numTextures: markers.numTextures,
        numMaterials: markers.numMaterials,
        meshHeaderStart: markers.meshHeaderStart,
        numMeshVerticesBlocks: markers.meshVerticesMarkers.length,
        numMeshIndicesBlocks: markers.meshIndicesMarkers.length,
        colStart: markers.colStart
    });
    
    if (markers.meshVerticesMarkers.length === 0) {
        console.error('❌ No #Mesh Vertices markers found! Cannot parse.');
        return null;
    }
    
    // STEP 2: Parse texture names
    const textureNames = [];
    if (markers.numTextures !== -1) {
        const numTextures = parseInt2(originalLines[markers.numTextures]);
        console.log(`📦 Parsing ${numTextures} textures starting at line ${markers.numTextures + 1}`);
    for (let i = 0; i < numTextures; i++) {
            const texName = parseValue(originalLines[markers.numTextures + 1 + i]);
            textureNames.push(texName);
        }
    }
    
    // STEP 3: Parse materials - extract BOTH texture indices AND base colors
    const materialTextureIndices = [];
    const materialColors = [];  // NEW: Store material base colors
    if (markers.numMaterials !== -1) {
        const numMaterials = parseInt2(originalLines[markers.numMaterials]);
        console.log(`🎨 Found ${numMaterials} materials`);
        
        // Find each #Material marker and extract its texture index AND color
        let materialCount = 0;
        for (let i = markers.numMaterials + 1; i < markers.meshHeaderStart && materialCount < numMaterials; i++) {
            const line = originalLines[i].trim();
            if (line === '#Material') {
                let matColor = { r: 255, g: 255, b: 255 };  // Default white
                let texIdx = 0;
                
                let j = i + 1;
                while (j < markers.meshHeaderStart) {
                    const subLine = originalLines[j];
                    if (!subLine) { j++; continue; }
                    
                    // Extract base color (comes right after #Material > matType > #Color)
                    if (subLine.includes('#Color')) {
                        // Next 4 lines are R, G, B, A
                        matColor.r = parseInt2(originalLines[j + 1]) || 255;
                        matColor.g = parseInt2(originalLines[j + 2]) || 255;
                        matColor.b = parseInt2(originalLines[j + 3]) || 255;
                    }
                    
                    // Find texture layer
                    if (subLine.includes('#Num Layers')) {
                        const numLayers = parseInt2(subLine);
                        texIdx = numLayers > 0 ? parseInt2(originalLines[j + 1]) : 0;
        materialTextureIndices.push(texIdx);
                        materialColors.push(matColor);
                        break;
                    }
                    
                    // If we hit next #Material, this material had no layers
                    if (subLine.trim() === '#Material') {
                        materialTextureIndices.push(0);
                        materialColors.push(matColor);
                        break;
                    }
                    j++;
                }
                materialCount++;
            }
        }
        console.log(`🎨 Extracted ${materialTextureIndices.length} material texture indices`);
        // Log non-white material colors
        const nonWhiteColors = materialColors.filter((c, i) => !(c.r > 250 && c.g > 250 && c.b > 250));
        console.log(`🎨 Non-white material colors: ${nonWhiteColors.length}`, nonWhiteColors.slice(0, 10).map(c => `RGB(${c.r},${c.g},${c.b})`));
    }
    
    // STEP 4: Parse mesh headers
    const meshHeaders = [];
    if (markers.meshHeaderStart !== -1) {
        const totalVertices = parseInt2(originalLines[markers.meshHeaderStart]);
        const numMeshes = parseInt2(originalLines[markers.meshHeaderStart + 1]);
        console.log(`📊 Total vertices: ${totalVertices}, Num meshes: ${numMeshes}`);
        
        // Each mesh header contains: #Mesh, numIndices, numVertices, #Normals, [#Triangle List], flags, colorSets, uvSets
        // Note: #Triangle List comment is optional (appears when flags & 0x20)
        let headerLine = markers.meshHeaderStart + 2;
    for (let m = 0; m < numMeshes; m++) {
            // Skip to #Mesh marker
            while (headerLine < firstMeshVertices && originalLines[headerLine].trim() !== '#Mesh') {
                headerLine++;
            }
            if (headerLine >= firstMeshVertices) break;
            
            const meshStartLine = headerLine;
            headerLine++; // Skip #Mesh
            
            // Parse values by looking for their labels, not by position (more robust)
            let numIndices = 0, numVertices = 0, flags = 0, numColorSets = 0, numUvSets = 0;
            const searchEnd = Math.min(headerLine + 15, firstMeshVertices);
            
            for (let j = headerLine; j < searchEnd; j++) {
                const line = originalLines[j];
                if (!line) continue;
                
                if (line.includes('#Num Indices')) {
                    numIndices = parseInt2(line);
                } else if (line.includes('#Num Vertices')) {
                    numVertices = parseInt2(line);
                } else if (line.includes('#Flags') && !line.includes('Flags |=')) {
                    flags = parseInt2(line);
                } else if (line.includes('#Num Colour Sets')) {
                    numColorSets = parseInt2(line);
                } else if (line.includes('#Num Uv Sets')) {
                    numUvSets = parseInt2(line);
                    headerLine = j + 1;
                    break;
                }
            }
            
        meshHeaders.push({ numIndices, numVertices, flags, numColorSets, numUvSets });
        }
        console.log(`📋 Parsed ${meshHeaders.length} mesh headers`);
    }
    
    if (meshHeaders.length === 0) {
        console.error('❌ No mesh headers parsed!');
        return null;
    }
    
    // STEP 5: Parse vertex data for each mesh
    const meshVertexData = [];
    let globalMinY = Infinity, globalMaxY = -Infinity;
    
    for (let m = 0; m < meshHeaders.length; m++) {
        const header = meshHeaders[m];
        const startLine = markers.meshVerticesMarkers[m];
        
        if (startLine === undefined) {
            console.warn(`⚠️ No vertex marker for mesh ${m}`);
            meshVertexData.push({ vertices: [], uvs: [], colors: [] });
            continue;
        }
        
        const vertices = [];
        const uvs = [];
        const colors = [];
        let meshMinY = Infinity, meshMaxY = -Infinity;
        
        let lineIdx = startLine + 1; // Skip #Mesh Vertices
        
        for (let v = 0; v < header.numVertices; v++) {
            const x = parseFloat2(originalLines[lineIdx++]);
            const y = parseFloat2(originalLines[lineIdx++]);
            const z = parseFloat2(originalLines[lineIdx++]);
            
            // UV sets
            const vertUvs = [];
            for (let u = 0; u < header.numUvSets; u++) {
                vertUvs.push([parseFloat2(originalLines[lineIdx++]), parseFloat2(originalLines[lineIdx++])]);
            }
            
            // Color sets
            const vertColors = [];
            for (let c = 0; c < header.numColorSets; c++) {
                vertColors.push([
                    parseInt2(originalLines[lineIdx++]),
                    parseInt2(originalLines[lineIdx++]),
                    parseInt2(originalLines[lineIdx++]),
                    parseInt2(originalLines[lineIdx++])
                ]);
            }
            
            // Normal (if flags indicate)
            if (header.flags & 0x1) {
                lineIdx += 3; // Skip nx, ny, nz
            }
            
            // Fade distance (if flags & 0x20 - Triangle List format)
            if (header.flags & 0x20) {
                lineIdx++; // Skip fade distance value
            }
            
            // Track Y ranges
            if (y < meshMinY) meshMinY = y;
            if (y > meshMaxY) meshMaxY = y;
            if (y < globalMinY) globalMinY = y;
            if (y > globalMaxY) globalMaxY = y;
            
            // Scale down by 100
            vertices.push(x / 100, y / 100, z / 100);
            uvs.push(vertUvs[0] ? vertUvs[0][0] : 0, vertUvs[0] ? vertUvs[0][1] : 0);
            
            // Convert vertex colors to GRAYSCALE for shadow/AO only
            // This prevents color bleeding (e.g., green tint on blue bowls)
            // The textures should provide all the color, vertex colors only provide darkness/lightness
            let luminance = 1.0;
            if (vertColors.length >= 1) {
                // Use the first color slot for shadow/AO
                const c = vertColors[0];
                // Check if it's white (no shadow) - use second color if available
                const isWhite = c[0] > 250 && c[1] > 250 && c[2] > 250;
                let shadowColor = c;
                if (isWhite && vertColors.length >= 2) {
                    shadowColor = vertColors[1];
                }
                // Convert to grayscale luminance (standard formula)
                luminance = (shadowColor[0] * 0.299 + shadowColor[1] * 0.587 + shadowColor[2] * 0.114) / 255;
            }
            
            // Apply gentle brightness boost to lift baked shadows
            const boost = 1.15;
            luminance = Math.min(1.0, luminance * boost);
            
            // Use grayscale for all RGB channels - no color contamination!
            colors.push(luminance, luminance, luminance);
        }
        
        if (m < 5 || m === meshHeaders.length - 1) {
            console.log(`Mesh ${m}: Y range ${meshMinY.toFixed(1)} to ${meshMaxY.toFixed(1)} (${header.numVertices} verts)`);
        }
        meshVertexData.push({ vertices, uvs, colors });
    }
    
    console.log(`🔍 TOTAL Y range: ${globalMinY.toFixed(1)} to ${globalMaxY.toFixed(1)} (height diff: ${(globalMaxY - globalMinY).toFixed(1)})`);
    console.log(`🔍 After /100 scaling: ${(globalMinY/100).toFixed(2)} to ${(globalMaxY/100).toFixed(2)} (${((globalMaxY - globalMinY)/100).toFixed(2)} units)`);
    
    // STEP 6: Parse index data for each mesh
    const meshIndexData = [];
    for (let m = 0; m < meshHeaders.length; m++) {
        const header = meshHeaders[m];
        const startLine = markers.meshIndicesMarkers[m];
        
        if (startLine === undefined) {
            console.warn(`⚠️ No index marker for mesh ${m}`);
            meshIndexData.push([]);
            continue;
        }
        
        const rawIndices = [];
        let lineIdx = startLine + 1; // Skip #Mesh Indices
        
        for (let i = 0; i < header.numIndices; i++) {
            rawIndices.push(parseInt2(originalLines[lineIdx++]));
        }
        
        // Check if this is triangle list or triangle strip format
        const isTriangleList = (header.flags & 0x20) !== 0;
        
        let triangleIndices;
        if (isTriangleList) {
            // Already in triangle list format, use as-is
            triangleIndices = rawIndices;
        } else {
        // Convert triangle strip to triangle list
            triangleIndices = [];
            for (let i = 0; i < rawIndices.length - 2; i++) {
                const a = rawIndices[i];
                const b = rawIndices[i + 1];
                const c = rawIndices[i + 2];
            
            if (a === b || b === c || a === c) continue;
            
            if (i % 2 === 0) {
                triangleIndices.push(a, b, c);
            } else {
                triangleIndices.push(a, c, b);
                }
            }
        }
        
        meshIndexData.push(triangleIndices);
    }
    
    console.log(`✅ Parsed ${meshVertexData.length} vertex blocks and ${meshIndexData.length} index blocks`)
    
    // Build texture lookup map
    const textureLookup = {};
    const loadedTextures = {}; // Cache loaded Three.js textures
    
    if (textures && Object.keys(textures).length > 0) {
        const availableTextures = Object.keys(textures);
        console.log('🎨 Building texture lookup from', availableTextures.length, 'available textures');
        
        for (const key of availableTextures) {
            textureLookup[key.toLowerCase()] = textures[key];
            const withoutExt = key.replace(/\.(jpg|jpeg|png)$/i, '');
            textureLookup[withoutExt.toLowerCase()] = textures[key];
        }
    }
    
    // Create a group to hold all mesh parts
    const group = new THREE.Group();
    let texturesApplied = 0;
    
    // Create a mesh for each material
    for (let m = 0; m < meshHeaders.length; m++) {
        const vertData = meshVertexData[m];
        const indices = meshIndexData[m];
        
        if (indices.length === 0) continue;
        
        // Get texture for this material
        const texIdx = m < materialTextureIndices.length ? materialTextureIndices[m] : 0;
        const texName = texIdx < textureNames.length ? textureNames[texIdx] : null;
        
        // Create geometry
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertData.vertices, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(vertData.uvs, 2));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(vertData.colors, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        
        // Create material with texture - use MeshBasicMaterial to show textures without lighting
        // Get material base color (important for trees - they have green material color!)
        const matColor = m < materialColors.length ? materialColors[m] : { r: 255, g: 255, b: 255 };
        const isWhiteMaterial = matColor.r > 250 && matColor.g > 250 && matColor.b > 250;
        
        // Check if this is an alpha texture (trees, leaves, fencing, etc.)
        const isAlphaTexture = texName && texName.toLowerCase().includes('alpha');
        
        const materialOptions = {
            // DISABLE vertex colors entirely - they're causing color bleeding issues
            // The textures + material colors should provide all the visual information
            // Vertex colors in True Skate contain colored shadows that contaminate other surfaces
            vertexColors: false,  // Disabled to fix blue-green bleeding
            side: THREE.DoubleSide
        };
        
        // Enable transparency for alpha textures (leaves, fencing, etc.)
        if (isAlphaTexture) {
            materialOptions.transparent = true;
            materialOptions.alphaTest = 0.5;  // Discard transparent pixels (higher threshold)
            materialOptions.depthWrite = false;  // Better transparency sorting
            console.log(`🌿 Mesh ${m}: Alpha texture "${texName}" - transparent material`);
        }
        
        // Apply material base color if it's not white
        // White materials let textures/vertex colors show through unchanged
        if (!isWhiteMaterial) {
            materialOptions.color = new THREE.Color(matColor.r / 255, matColor.g / 255, matColor.b / 255);
            console.log(`🎨 Mesh ${m}: Applying material color RGB(${matColor.r}, ${matColor.g}, ${matColor.b})`);
        }
        
        // Try to apply texture for this material
        if (texName) {
            // Texture lookup: prefer the original PNG with color data
            // (The _c.jpg versions are grayscale, NOT color textures!)
            let lookupKey = texName.toLowerCase();
            let texData = textureLookup[lookupKey];
            
            if (!texData) {
                // Try without extension
                const withoutExt = lookupKey.replace(/\.(jpg|jpeg|png)$/i, '');
                texData = textureLookup[withoutExt];
                if (texData) lookupKey = withoutExt;
            }
            
            if (!texData) {
                // Try with common extensions
                const baseName = lookupKey.replace(/\.(jpg|jpeg|png)$/i, '');
                for (const ext of ['.png', '.jpg', '.jpeg']) {
                    texData = textureLookup[baseName + ext];
                    if (texData) {
                        lookupKey = baseName + ext;
                        break;
                    }
                }
            }
            
            if (texData) {
                // Check if we've already loaded this texture
                if (!loadedTextures[lookupKey]) {
                    try {
                        // texData can be:
                        // 1. A THREE.Texture object (from importMapAsBackdrop)
                        // 2. A blob URL string (from loadDIYPack)
                        if (texData.isTexture) {
                            // Already a THREE.Texture, use directly
                            texData.colorSpace = THREE.SRGBColorSpace;  // Ensure correct colors
                            loadedTextures[lookupKey] = texData;
                            console.log(`🖼️ Using pre-loaded texture: ${texName}`);
                        } else {
                            // It's a URL string, load it
                        const textureLoader = new THREE.TextureLoader();
                        const texUrl = typeof texData === 'string' ? texData : texData.url;
                            console.log(`🖼️ Loading texture from URL: ${texName}`);
                        const texture = textureLoader.load(texUrl);
                        texture.wrapS = THREE.RepeatWrapping;
                        texture.wrapT = THREE.RepeatWrapping;
                            texture.colorSpace = THREE.SRGBColorSpace;  // Correct color display
                        loadedTextures[lookupKey] = texture;
                        }
                    } catch (e) {
                        console.warn('Failed to load texture:', texName, e);
                    }
                }
                
                if (loadedTextures[lookupKey]) {
                    materialOptions.map = loadedTextures[lookupKey];
                    texturesApplied++;
                }
            } else {
                // Log missing textures (only first occurrence)
                if (!window._loggedMissingTextures) window._loggedMissingTextures = new Set();
                if (!window._loggedMissingTextures.has(lookupKey)) {
                    console.warn(`⚠️ Texture not found in zip: "${texName}" (looking for: "${lookupKey}")`);
                    window._loggedMissingTextures.add(lookupKey);
                }
            }
        }
        
        // Use MeshStandardMaterial for better lighting and emissive support
        // This allows brightness and emissive controls to work on DIY objects
        materialOptions.roughness = 0.9;  // Matte finish
        materialOptions.metalness = 0.0;  // Non-metallic
        materialOptions.emissive = new THREE.Color(0, 0, 0);  // Initialize emissive to black
        materialOptions.emissiveIntensity = 0;
        
        const material = new THREE.MeshStandardMaterial(materialOptions);
        const mesh = new THREE.Mesh(geometry, material);
        group.add(mesh);
    }
    
    console.log(`✅ Created ${meshHeaders.length} mesh parts with ${texturesApplied} textures applied`);
    
    // If we created meshes, return the group
    if (group.children.length > 0) {
        return group;
    }
    
    // Fallback: return a simple mesh if something went wrong
    console.warn('⚠️ Multi-material parsing failed, returning simple mesh');
    return createFallbackMesh(meshVertexData, meshIndexData);
}

// Fallback function if multi-material fails
function createFallbackMesh(meshVertexData, meshIndexData) {
    const allVertices = [];
    const allUvs = [];
    const allColors = [];
    const allIndices = [];
    let vertexOffset = 0;
    
    for (let m = 0; m < meshVertexData.length; m++) {
        const vd = meshVertexData[m];
        allVertices.push(...vd.vertices);
        allUvs.push(...vd.uvs);
        allColors.push(...vd.colors);
        
        const indices = meshIndexData[m];
        for (const idx of indices) {
            allIndices.push(idx + vertexOffset);
        }
        vertexOffset += vd.vertices.length / 3;
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(allVertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(allUvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(allColors, 3));
    geometry.setIndex(allIndices);
    geometry.computeVertexNormals();
    
    const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.7,
        side: THREE.DoubleSide
    });
    
    return new THREE.Mesh(geometry, material);
}

function addDIYPackToPalette(pack) {
    const container = document.getElementById('diy-objects-list');
    if (!container) return;
    
    // Add pack header
    const header = document.createElement('div');
    header.className = 'diy-pack-header';
    header.innerHTML = `
        <span>${pack.name}</span>
        <button class="delete-pack" title="Remove pack">×</button>
    `;
    header.dataset.packId = pack.id;
    
    header.querySelector('.delete-pack').addEventListener('click', () => {
        removeDIYPack(pack.id);
    });
    
    container.appendChild(header);
    
    // Add each object
    for (const obj of pack.objects) {
        const button = document.createElement('button');
        button.className = 'palette-item diy-object';
        button.dataset.diyObject = obj.id;
        
        const iconHtml = obj.icon 
            ? `<img src="${obj.icon}" alt="${obj.name}">`
            : '📦';
        
        button.innerHTML = `
            <div class="palette-icon">${iconHtml}</div>
            <span class="diy-name">${obj.name}</span>
        `;
        
        button.addEventListener('click', () => selectDIYObjectForPlacement(obj.id));
        
        container.appendChild(button);
    }
}

function removeDIYPack(packId) {
    // Remove from state
    state.diyPacks = state.diyPacks.filter(p => p.id !== packId);
    state.diyObjects = state.diyObjects.filter(o => o.packId !== packId);
    
    // Remove from palette
    const container = document.getElementById('diy-objects-list');
    const header = container.querySelector(`[data-pack-id="${packId}"]`);
    if (header) {
        // Remove header and all following items until next header or end
        let el = header;
        while (el) {
            const next = el.nextElementSibling;
            if (next && next.classList.contains('diy-pack-header')) break;
            el.remove();
            el = next;
        }
    }
}

function selectDIYObjectForPlacement(objectId) {
    const diyObj = state.diyObjects.find(o => o.id === objectId);
    if (!diyObj || !diyObj.mesh) return;
    
    // Remove previous selection
    document.querySelectorAll('.palette-item').forEach(i => i.classList.remove('selected'));
    document.querySelector(`[data-diy-object="${objectId}"]`)?.classList.add('selected');
    
    // Cancel any existing placement
    cancelPlacing();
    
    // Clone the mesh for placement
    const placingMesh = diyObj.mesh.clone();
    placingMesh.userData.type = 'diy-object';
    placingMesh.userData.diyObjectId = objectId;
    placingMesh.userData.name = diyObj.name;
    placingMesh.userData.props = {
        scale: 1,
        packName: diyObj.packName,
        filename: diyObj.filename
    };
    
    // Make it semi-transparent
    setObjectOpacity(placingMesh, 0.5);
    
    state.placingObject = placingMesh;
    state.scene.add(state.placingObject);
    setMode('PLACE');
}

// ========================================
// 3D MODEL IMPORT (SKETCHUP, BLENDER, ETC.)
// ========================================

function setup3DModelImport() {
    const uploadZone = document.getElementById('upload-zone-3d');
    const fileInput = document.getElementById('model-upload-3d');
    const modal = document.getElementById('import-3d-modal');
    
    if (!uploadZone || !fileInput) {
        console.log('⚠️ 3D import elements not found in DOM');
        return;
    }
    
    // Drag and drop handlers
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('drag-over');
    });
    
    uploadZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
    });
    
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            open3DImportModal(e.dataTransfer.files[0]);
        }
    });
    
    // Click to upload
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            open3DImportModal(e.target.files[0]);
        }
        e.target.value = '';
    });
    
    // Modal buttons
    const closeBtn = document.getElementById('close-import-3d');
    const cancelBtn = document.getElementById('import-3d-cancel');
    const confirmBtn = document.getElementById('import-3d-confirm');
    
    console.log('🔧 Import modal buttons:', { closeBtn: !!closeBtn, cancelBtn: !!cancelBtn, confirmBtn: !!confirmBtn });
    
    if (closeBtn) closeBtn.addEventListener('click', close3DImportModal);
    if (cancelBtn) cancelBtn.addEventListener('click', close3DImportModal);
    if (confirmBtn) {
        console.log('✅ Found confirm button, attaching click listener');
        confirmBtn.addEventListener('click', async () => {
            console.log('🖱️ Confirm button clicked!');
            try {
                await confirm3DImport();
            } catch (error) {
                console.error('❌ Error calling confirm3DImport:', error);
            }
        });
    } else {
        console.error('❌ Could not find import-3d-confirm button!');
    }
    
    // Simplify slider
    document.getElementById('import-simplify')?.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        document.getElementById('import-simplify-value').textContent = `${value}%`;
        updateSimplifyPreview(value);
    });
    
    // Scale input
    document.getElementById('import-scale')?.addEventListener('input', updateScalePreview);
    document.getElementById('import-scale-auto')?.addEventListener('click', autoDetectScale);
    
    console.log('✅ 3D Model Import setup complete');
}

async function open3DImportModal(file) {
    console.log('📂 Opening 3D import modal for:', file.name);
    const modal = document.getElementById('import-3d-modal');
    const ext = file.name.split('.').pop().toLowerCase();
    
    // Check file type
    const supportedFormats = ['dae', 'obj', 'gltf', 'glb', 'zip'];
    if (!supportedFormats.includes(ext)) {
        alert(`Unsupported format: .${ext}\n\nSupported: DAE (Collada), OBJ, GLTF, GLB, ZIP`);
        return;
    }
    
    // Store pending file
    state.import3D.pendingFile = file;
    
    // Show modal
    modal.style.display = 'flex';
    document.getElementById('import-filename').textContent = file.name;
    document.getElementById('import-preview-loading').style.display = 'flex';
    
    // Reset stats
    document.getElementById('import-polycount').textContent = 'Loading...';
    document.getElementById('import-vertcount').textContent = '-';
    document.getElementById('import-matcount').textContent = '-';
    document.getElementById('import-dimensions').textContent = '-';
    
    try {
        let loadedObject;
        let actualExt = ext;
        let modelData = null;
        
        // Handle zip files - extract and find 3D model inside
        if (ext === 'zip') {
            console.log('📦 Extracting zip file:', file.name);
            const extracted = await extract3DModelFromZip(file);
            if (!extracted) {
                throw new Error('No 3D model (DAE, OBJ, GLTF, GLB) found in zip file');
            }
            actualExt = extracted.ext;
            modelData = extracted.data;
            console.log(`📦 Found ${actualExt.toUpperCase()} file in zip:`, extracted.filename);
            
            // Update filename display
            document.getElementById('import-filename').textContent = `${file.name} → ${extracted.filename}`;
        }
        
        // Load the model
        if (actualExt === 'dae') {
            loadedObject = modelData ? await loadColladaFromData(modelData) : await loadColladaFile(file);
        } else if (actualExt === 'obj') {
            loadedObject = modelData ? await loadOBJFromData(modelData) : await loadOBJFile(file);
        } else if (actualExt === 'gltf' || actualExt === 'glb') {
            loadedObject = modelData ? await loadGLTFFromData(modelData, actualExt) : await loadGLTFFile(file);
        }
        
        if (loadedObject) {
            state.import3D.loadedMesh = loadedObject;
            analyze3DModel(loadedObject);
            setupImportPreview(loadedObject);
        }
    } catch (error) {
        console.error('Error loading 3D model:', error);
        alert(`Failed to load model: ${error.message}`);
        close3DImportModal();
    }
}

async function extract3DModelFromZip(file) {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    // Priority order for 3D file types
    const priorities = ['dae', 'gltf', 'glb', 'obj'];
    
    // Find all 3D model files in the zip
    const modelFiles = [];
    zip.forEach((relativePath, zipEntry) => {
        if (zipEntry.dir) return;
        const ext = relativePath.split('.').pop().toLowerCase();
        if (priorities.includes(ext)) {
            modelFiles.push({ path: relativePath, ext, entry: zipEntry });
        }
    });
    
    if (modelFiles.length === 0) {
        return null;
    }
    
    // Sort by priority (DAE first, then GLTF, GLB, OBJ)
    modelFiles.sort((a, b) => priorities.indexOf(a.ext) - priorities.indexOf(b.ext));
    
    const chosen = modelFiles[0];
    console.log(`📦 Found ${modelFiles.length} 3D files in zip, using: ${chosen.path}`);
    
    // Extract the file data
    let data;
    if (chosen.ext === 'glb') {
        // GLB is binary
        data = await chosen.entry.async('arraybuffer');
    } else {
        // DAE, GLTF, OBJ are text
        data = await chosen.entry.async('string');
    }
    
    return {
        filename: chosen.path.split('/').pop(),
        ext: chosen.ext,
        data: data
    };
}

function loadColladaFromData(data) {
    return new Promise((resolve, reject) => {
        try {
            const result = state.colladaLoader.parse(data);
            resolve(result.scene);
        } catch (err) {
            reject(err);
        }
    });
}

function loadOBJFromData(data) {
    return new Promise((resolve, reject) => {
        try {
            const result = state.objLoader.parse(data);
            resolve(result);
        } catch (err) {
            reject(err);
        }
    });
}

function loadGLTFFromData(data, ext) {
    return new Promise((resolve, reject) => {
        // For GLTF text format
        if (ext === 'gltf') {
            // GLTF is JSON text - we need to parse it
            state.gltfLoader.parse(data, '', (gltf) => {
                resolve(gltf.scene);
            }, reject);
        } else {
            // GLB is binary
            state.gltfLoader.parse(data, '', (gltf) => {
                resolve(gltf.scene);
            }, reject);
        }
    });
}

function loadColladaFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const result = state.colladaLoader.parse(e.target.result);
                resolve(result.scene);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

function loadOBJFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const result = state.objLoader.parse(e.target.result);
                resolve(result);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

function loadGLTFFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            state.gltfLoader.parse(e.target.result, '', (gltf) => {
                resolve(gltf.scene);
            }, reject);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

function analyze3DModel(object) {
    let totalVertices = 0;
    let totalTriangles = 0;
    let materialCount = 0;
    const materials = new Set();
    const box = new THREE.Box3();
    
    object.traverse((child) => {
        if (child.isMesh) {
            const geo = child.geometry;
            if (geo.attributes.position) {
                totalVertices += geo.attributes.position.count;
            }
            if (geo.index) {
                totalTriangles += geo.index.count / 3;
            } else if (geo.attributes.position) {
                totalTriangles += geo.attributes.position.count / 3;
            }
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => materials.add(m.uuid));
                } else {
                    materials.add(child.material.uuid);
                }
            }
            // Expand bounding box
            geo.computeBoundingBox();
            if (geo.boundingBox) {
                const meshBox = geo.boundingBox.clone();
                meshBox.applyMatrix4(child.matrixWorld);
                box.union(meshBox);
            }
        }
    });
    
    materialCount = materials.size;
    
    // Store stats
    state.import3D.stats = {
        vertices: totalVertices,
        triangles: Math.round(totalTriangles),
        materials: materialCount,
        boundingBox: box
    };
    
    // Update UI
    const polyCountEl = document.getElementById('import-polycount');
    const warningEl = document.getElementById('import-polycount-warning');
    
    polyCountEl.textContent = totalTriangles.toLocaleString();
    document.getElementById('import-vertcount').textContent = totalVertices.toLocaleString();
    document.getElementById('import-matcount').textContent = materialCount.toString();
    
    // Poly count warnings
    if (totalTriangles > 50000) {
        polyCountEl.className = 'stat-value bad';
        warningEl.textContent = '⚠️ Too complex - simplify required';
        warningEl.classList.remove('hidden');
    } else if (totalTriangles > 10000) {
        polyCountEl.className = 'stat-value warning';
        warningEl.textContent = '⚠️ Consider simplifying';
        warningEl.classList.remove('hidden');
    } else {
        polyCountEl.className = 'stat-value good';
        warningEl.classList.add('hidden');
    }
    
    // Dimensions
    if (!box.isEmpty()) {
        const size = new THREE.Vector3();
        box.getSize(size);
        document.getElementById('import-dimensions').textContent = 
            `${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)} m`;
    }
    
    // Update simplified count
    document.getElementById('import-simplified-count').textContent = totalTriangles.toLocaleString();
    
    // Hide loading
    document.getElementById('import-preview-loading').style.display = 'none';
}

function setupImportPreview(object) {
    const canvas = document.getElementById('import-preview-canvas');
    if (!canvas) return;
    
    // Create preview renderer if needed
    if (!state.import3D.previewRenderer) {
        state.import3D.previewRenderer = new THREE.WebGLRenderer({ 
            canvas: canvas,
            antialias: true,
            alpha: true
        });
        state.import3D.previewScene = new THREE.Scene();
        state.import3D.previewScene.background = new THREE.Color(0x1a1a1f);
        
        // Add lights
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        const directional = new THREE.DirectionalLight(0xffffff, 0.8);
        directional.position.set(5, 10, 5);
        state.import3D.previewScene.add(ambient, directional);
        
        // Camera
        state.import3D.previewCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    }
    
    // Clear previous
    const scene = state.import3D.previewScene;
    while (scene.children.length > 2) { // Keep lights
        scene.remove(scene.children[scene.children.length - 1]);
    }
    
    // Clone and add object
    const clone = object.clone();
    scene.add(clone);
    
    // Fit camera to object
    const box = new THREE.Box3().setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    const camera = state.import3D.previewCamera;
    camera.position.set(center.x + maxDim, center.y + maxDim * 0.5, center.z + maxDim);
    camera.lookAt(center);
    
    // Resize renderer
    const rect = canvas.parentElement.getBoundingClientRect();
    state.import3D.previewRenderer.setSize(rect.width, rect.height);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    
    // Render
    state.import3D.previewRenderer.render(scene, camera);
    
    // Simple rotation animation
    let animationId;
    function animatePreview() {
        if (!document.getElementById('import-3d-modal').style.display || 
            document.getElementById('import-3d-modal').style.display === 'none') {
            cancelAnimationFrame(animationId);
            return;
        }
        clone.rotation.y += 0.01;
        state.import3D.previewRenderer.render(scene, camera);
        animationId = requestAnimationFrame(animatePreview);
    }
    animatePreview();
}

function updateSimplifyPreview(percentage) {
    if (!state.import3D.stats.triangles) return;
    
    const original = state.import3D.stats.triangles;
    const reduced = Math.round(original * (1 - percentage / 100));
    document.getElementById('import-simplified-count').textContent = reduced.toLocaleString();
}

function updateScalePreview() {
    // Could re-render preview with new scale
    // For now just update dimensions display
    const scale = parseFloat(document.getElementById('import-scale').value) || 1;
    const box = state.import3D.stats.boundingBox;
    
    if (box && !box.isEmpty()) {
        const size = new THREE.Vector3();
        box.getSize(size);
        document.getElementById('import-dimensions').textContent = 
            `${(size.x * scale).toFixed(1)} × ${(size.y * scale).toFixed(1)} × ${(size.z * scale).toFixed(1)} m`;
    }
}

function autoDetectScale() {
    // Heuristic: assume the model should be roughly 1-10 meters in its largest dimension
    const box = state.import3D.stats.boundingBox;
    if (!box || box.isEmpty()) return;
    
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    
    let scale = 1;
    if (maxDim < 0.1) {
        // Probably in millimeters, scale up
        scale = 1000;
    } else if (maxDim < 1) {
        // Probably in centimeters or decimeters
        scale = 100;
    } else if (maxDim > 1000) {
        // Probably in millimeters or too big
        scale = 0.001;
    } else if (maxDim > 100) {
        // Might be in centimeters
        scale = 0.01;
    }
    
    document.getElementById('import-scale').value = scale;
    updateScalePreview();
}

function close3DImportModal() {
    const modal = document.getElementById('import-3d-modal');
    modal.style.display = 'none';
    
    // Clean up
    state.import3D.pendingFile = null;
    state.import3D.loadedMesh = null;
    state.import3D.stats = {};
}

async function confirm3DImport() {
    console.log('🏗️ confirm3DImport called');
    
    try {
        if (!state.import3D.loadedMesh) {
            alert('No model loaded');
            console.error('❌ No model loaded in state.import3D.loadedMesh');
            return;
        }
        
        const scaleEl = document.getElementById('import-scale');
        const simplifyEl = document.getElementById('import-simplify');
        const detectFlatEl = document.getElementById('import-detect-flat');
        const detectRampEl = document.getElementById('import-detect-ramp');
        const detectGrindEl = document.getElementById('import-detect-grind');
        
        const scale = parseFloat(scaleEl?.value) || 1;
        const simplifyPercent = parseInt(simplifyEl?.value) || 0;
        const detectFlat = detectFlatEl?.checked ?? true;
        const detectRamp = detectRampEl?.checked ?? true;
        const detectGrind = detectGrindEl?.checked ?? true;
        
        console.log('🏗️ Converting 3D model to skateable object...');
        console.log(`   Scale: ${scale}, Simplify: ${simplifyPercent}%, Detect: flat=${detectFlat}, ramp=${detectRamp}, grind=${detectGrind}`);
    
    // Clone the loaded mesh
    const modelClone = state.import3D.loadedMesh.clone();
    
    // Apply scale
    modelClone.scale.multiplyScalar(scale);
    modelClone.updateMatrixWorld(true);
    
    // Center the model
    const box = new THREE.Box3().setFromObject(modelClone);
    const center = box.getCenter(new THREE.Vector3());
    modelClone.position.sub(center);
    modelClone.position.y -= box.min.y; // Put bottom at Y=0
    
    // Generate a unique ID
    const modelId = 'imported3d-' + Date.now();
    const fileName = state.import3D.pendingFile?.name || 'Imported Model';
    
    // Store as a custom model for placement
    const imported3DModel = {
        id: modelId,
        name: fileName.replace(/\.[^/.]+$/, ''), // Remove extension
        mesh: modelClone,
        stats: { ...state.import3D.stats },
        options: {
            scale,
            simplifyPercent,
            detectFlat,
            detectRamp,
            detectGrind
        }
    };
    
    state.imported3DModels.push(imported3DModel);
    
    // Add to palette
    addImported3DModelToPalette(imported3DModel);
    
    // Close modal
    close3DImportModal();
    
    console.log('✅ 3D model imported successfully:', modelId);
    
    // Start placing the model immediately
    selectImported3DForPlacement(modelId);
    
    } catch (error) {
        console.error('❌ Error in confirm3DImport:', error);
        alert('Failed to import 3D model: ' + error.message);
    }
}

function addImported3DModelToPalette(model) {
    const listEl = document.getElementById('imported-models-list');
    if (!listEl) return;
    
    const button = document.createElement('button');
    button.className = 'palette-item imported-3d-item';
    button.dataset.modelId = model.id;
    button.innerHTML = `
        <div class="palette-icon">🏗️</div>
        <span>${model.name}</span>
    `;
    
    button.addEventListener('click', () => selectImported3DForPlacement(model.id));
    listEl.appendChild(button);
}

function selectImported3DForPlacement(modelId) {
    console.log('🏗️ selectImported3DForPlacement called with:', modelId);
    console.log('   Available models:', state.imported3DModels.map(m => m.id));
    
    const model = state.imported3DModels.find(m => m.id === modelId);
    if (!model) {
        console.error('❌ Imported 3D model not found:', modelId);
        return;
    }
    
    if (!model.mesh) {
        console.error('❌ Model has no mesh:', modelId);
        return;
    }
    
    console.log('   Found model:', model.name);
    
    // Cancel any current placement
    if (state.placingObject) {
        console.log('   Removing previous placing object');
        state.scene.remove(state.placingObject);
        state.placingObject = null;
    }
    
    // Clone the mesh for placement
    console.log('   Cloning mesh for placement');
    const placingMesh = model.mesh.clone();
    
    // Set up placement properties
    placingMesh.userData.type = 'imported-3d';
    placingMesh.userData.imported3DId = modelId;
    placingMesh.userData.name = model.name;
    placingMesh.userData.props = {
        scale: 1,
        ...model.options
    };
    
    // Make it semi-transparent
    placingMesh.traverse((child) => {
        if (child.isMesh && child.material) {
            if (Array.isArray(child.material)) {
                child.material = child.material.map(m => m.clone());
                child.material.forEach(m => {
                    m.transparent = true;
                    m.opacity = 0.5;
                });
            } else {
                child.material = child.material.clone();
                child.material.transparent = true;
                child.material.opacity = 0.5;
            }
        }
    });
    
    state.placingObject = placingMesh;
    state.scene.add(state.placingObject);
    setMode('PLACE');
    
    console.log('🏗️ Placing imported 3D model:', model.name);
    console.log('   state.mode:', state.mode);
    console.log('   state.placingObject:', !!state.placingObject);
    console.log('   placingObject.userData:', state.placingObject.userData);
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
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        // Rotate placing object by 45 degrees on right-click
        if (state.placingObject) {
            state.placingObject.rotation.y += Math.PI / 4; // 45 degrees in radians
        }
    });
    
    // Ctrl + scroll to adjust height of placing object
    canvas.addEventListener('wheel', (e) => {
        if (e.ctrlKey && state.placingObject) {
            e.preventDefault();
            e.stopPropagation(); // Stop OrbitControls from zooming
            // Scroll up = move up, scroll down = move down
            const delta = e.deltaY > 0 ? -0.1 : 0.1; // 10cm increments
            state.placingObject.position.y += delta;
            // Clamp to reasonable range
            state.placingObject.position.y = Math.max(0, state.placingObject.position.y);
        }
    }, { passive: false, capture: true }); // capture: true to handle before OrbitControls
    
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
    
    // Scale number input
    document.getElementById('scale-input').addEventListener('input', (e) => {
        const value = parseFloat(e.target.value) || 1;
        document.getElementById('scale').value = Math.min(5, Math.max(0.1, value));
        updateSelectedScale();
    });
    
    // Buttons
    document.getElementById('btn-delete').addEventListener('click', deleteSelectedObject);
    document.getElementById('btn-duplicate').addEventListener('click', duplicateSelectedObject);
    document.getElementById('btn-new').addEventListener('click', clearScene);
    document.getElementById('btn-export').addEventListener('click', exportToTrueSkate);
    
    // Object Editor button
    document.getElementById('btn-object-editor')?.addEventListener('click', openObjectEditor);
    
    // Undo/Redo buttons
    document.getElementById('btn-undo')?.addEventListener('click', undo);
    document.getElementById('btn-redo')?.addEventListener('click', redo);
    
    // Transform mode buttons
    document.querySelectorAll('.transform-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => setTransformMode(btn.dataset.mode));
    });
    
    // Snap toggle
    document.getElementById('snap-toggle').addEventListener('click', toggleSnap);
    
    // Position adjust buttons
    document.querySelectorAll('.adjust-btn[data-axis]').forEach(btn => {
        btn.addEventListener('click', () => {
            adjustPosition(btn.dataset.axis, parseFloat(btn.dataset.delta));
        });
    });
    
    // Rotation adjust buttons
    document.querySelectorAll('.adjust-btn[data-rot]').forEach(btn => {
        btn.addEventListener('click', () => {
            adjustRotation(parseFloat(btn.dataset.rot));
        });
    });
    
    // Scale adjust buttons
    document.getElementById('scale-up').addEventListener('click', () => adjustScale(0.25));
    document.getElementById('scale-down').addEventListener('click', () => adjustScale(-0.25));
    
    // Scale presets
    document.querySelectorAll('.scale-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            setScale(parseFloat(btn.dataset.scale));
        });
    });
    
    // Mesh tools (for custom models)
    document.getElementById('btn-simplify')?.addEventListener('click', () => {
        const options = document.getElementById('simplify-options');
        if (options.style.display === 'none') {
            options.style.display = 'block';
        } else {
            // Get selected reduction value
            const activePreset = document.querySelector('.simplify-preset.active');
            const reduction = activePreset ? parseFloat(activePreset.dataset.reduction) : 0.5;
            simplifySelectedModel(reduction);
            options.style.display = 'none';
        }
    });
    
    // Make Skateable button
    document.getElementById('btn-make-skateable')?.addEventListener('click', () => {
        makeSelectedSkateable();
    });
    
    // Legacy convex button (if still present)
    document.getElementById('btn-convex')?.addEventListener('click', () => {
        makeSelectedConvex();
    });
    
    // Model Adjustment Controls
    document.getElementById('btn-flip-x')?.addEventListener('click', () => flipModel('x'));
    document.getElementById('btn-flip-y')?.addEventListener('click', () => flipModel('y'));
    document.getElementById('btn-flip-z')?.addEventListener('click', () => flipModel('z'));
    document.getElementById('btn-rot-x')?.addEventListener('click', () => rotateModel('x'));
    document.getElementById('btn-rot-y')?.addEventListener('click', () => rotateModel('y'));
    document.getElementById('btn-rot-z')?.addEventListener('click', () => rotateModel('z'));
    document.getElementById('btn-scale-down')?.addEventListener('click', () => scaleModel(0.5));
    document.getElementById('btn-scale-up')?.addEventListener('click', () => scaleModel(2));
    document.getElementById('btn-scale-10')?.addEventListener('click', () => scaleModel(10));
    document.getElementById('btn-reset-model')?.addEventListener('click', () => resetModel());
    document.getElementById('chk-wireframe')?.addEventListener('change', (e) => toggleWireframe(e.target.checked));
    
    // Quality slider for heightmap (mesh resolution)
    document.getElementById('skateable-quality')?.addEventListener('input', (e) => {
        const qualityValue = document.getElementById('quality-value');
        if (qualityValue) {
            qualityValue.textContent = e.target.value;
        }
    });
    
    // Texture resolution slider
    document.getElementById('texture-res-slider')?.addEventListener('input', (e) => {
        const texResValue = document.getElementById('texture-res-value');
        if (texResValue) {
            texResValue.textContent = e.target.value;
        }
    });
    
    // Show/hide quality slider based on mode
    document.querySelectorAll('input[name="skateable-mode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const qualityDiv = document.getElementById('heightmap-quality');
            const qualitySlider = document.getElementById('skateable-quality');
            
            if (e.target.value === 'heightmap') {
                if (qualityDiv) qualityDiv.style.display = 'block';
            } else if (e.target.value === 'decimate') {
                if (qualityDiv) {
                    qualityDiv.style.display = 'block';
                    // Change label for decimate mode
                    const label = qualityDiv.querySelector('label');
                    if (label) label.innerHTML = 'Reduction: <span id="quality-value">' + qualitySlider.value + '</span>%';
                }
            } else {
                if (qualityDiv) qualityDiv.style.display = 'none';
            }
        });
    });
    
    // Simplify preset buttons
    document.querySelectorAll('.simplify-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.simplify-preset').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
    
    // Ground snap buttons - use setTimeout to ensure DOM is ready
    setTimeout(() => {
        const snapTopBtn = document.getElementById('btn-snap-top-zero');
        const snapBottomBtn = document.getElementById('btn-snap-bottom-zero');
        
        console.log('🔧 Snap buttons:', snapTopBtn ? 'TOP found' : 'TOP missing', snapBottomBtn ? 'BOTTOM found' : 'BOTTOM missing');
        
        if (snapTopBtn) {
            snapTopBtn.onclick = function(e) {
                console.log('🔧 TOP button clicked!');
                e.preventDefault();
                e.stopPropagation();
                snapTopToGround();
            };
        }
        
        if (snapBottomBtn) {
            snapBottomBtn.onclick = function(e) {
                console.log('🔧 BOTTOM button clicked!');
                e.preventDefault();
                e.stopPropagation();
                snapBottomToGround();
            };
        }
        
        const snapSurfaceBtn = document.getElementById('btn-snap-to-surface');
        if (snapSurfaceBtn) {
            snapSurfaceBtn.onclick = function(e) {
                console.log('🔧 SURFACE button clicked!');
                e.preventDefault();
                e.stopPropagation();
                // Handle both regular objects AND spawn points
                if (state.selectedSpawnPoint) {
                    console.log('🛹 Snapping spawn point to surface...');
                    snapSpawnPointToSurface();
                } else if (state.selectedObject) {
                    snapToSurface();
                } else {
                    console.log('⚠️ No object or spawn point selected');
                }
            };
        }
        
        // Lighting controls
        const brightnessSlider = document.getElementById('brightness-slider');
        const brightnessValue = document.getElementById('brightness-value');
        
        if (brightnessSlider) {
            brightnessSlider.addEventListener('input', (e) => {
                const brightness = parseFloat(e.target.value);
                setSceneBrightness(brightness);
                if (brightnessValue) {
                    brightnessValue.textContent = `${Math.round(brightness * 100)}%`;
                }
                // Update preset button states
                document.querySelectorAll('.lighting-preset').forEach(btn => {
                    btn.classList.remove('active');
                });
            });
        }
        
        // Lighting preset buttons
        document.querySelectorAll('.lighting-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                const brightness = parseFloat(btn.dataset.brightness);
                setSceneBrightness(brightness);
                if (brightnessSlider) brightnessSlider.value = brightness;
                if (brightnessValue) brightnessValue.textContent = `${Math.round(brightness * 100)}%`;
                
                // Update active state
                document.querySelectorAll('.lighting-preset').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }, 100);
    
    // Keyboard
    window.addEventListener('keydown', onKeyDown);
}

// Set scene brightness by adjusting lights AND material colors
// (MeshBasicMaterial ignores lights, so we also adjust material colors)
function setSceneBrightness(multiplier) {
    // Adjust light intensities (for MeshStandardMaterial objects)
    state.scene.traverse((obj) => {
        if (obj.isLight) {
            // Store original intensity if not stored
            if (obj.userData.originalIntensity === undefined) {
                obj.userData.originalIntensity = obj.intensity;
            }
            // Apply multiplier to original intensity
            obj.intensity = obj.userData.originalIntensity * multiplier;
        }
    });
    
    // Also adjust material colors for imported maps (MeshBasicMaterial)
    // This ensures brightness changes affect imported maps too
    if (state.environmentObjects) {
        state.environmentObjects.forEach(mapGroup => {
            mapGroup.traverse((child) => {
                if (child.isMesh && child.material) {
                    const mats = Array.isArray(child.material) ? child.material : [child.material];
                    mats.forEach(mat => {
                        // Store original color if not stored
                        if (!mat.userData.originalSceneColor && mat.color) {
                            mat.userData.originalSceneColor = mat.color.clone();
                        }
                        
                        // Apply brightness multiplier to color
                        if (mat.userData.originalSceneColor) {
                            mat.color.copy(mat.userData.originalSceneColor);
                            mat.color.multiplyScalar(Math.min(multiplier, 1.5)); // Cap to avoid washing out
                        }
                        
                        mat.needsUpdate = true;
                    });
                }
            });
        });
    }
    
    // Also apply to backdrop objects in state.objects
    state.objects.forEach(obj => {
        if (obj.userData.isBackdrop || obj.userData.type === 'backdrop') {
            obj.traverse((child) => {
                if (child.isMesh && child.material) {
                    const mats = Array.isArray(child.material) ? child.material : [child.material];
                    mats.forEach(mat => {
                        if (!mat.userData.originalSceneColor && mat.color) {
                            mat.userData.originalSceneColor = mat.color.clone();
                        }
                        if (mat.userData.originalSceneColor) {
                            mat.color.copy(mat.userData.originalSceneColor);
                            mat.color.multiplyScalar(Math.min(multiplier, 1.5));
                        }
                        mat.needsUpdate = true;
                    });
                }
            });
        }
    });
    
    // Also store current brightness for reference
    state.currentBrightness = multiplier;
    console.log(`💡 Set scene brightness to ${Math.round(multiplier * 100)}%`);
}

// Set up object appearance controls
function setupObjectAppearanceControls() {
    const brightnessSlider = document.getElementById('object-brightness');
    const brightnessValue = document.getElementById('object-brightness-value');
    const emissiveSlider = document.getElementById('object-emissive');
    const emissiveValue = document.getElementById('object-emissive-value');
    
    if (brightnessSlider) {
        brightnessSlider.addEventListener('input', (e) => {
            if (!state.selectedObject) return;
            const brightness = parseFloat(e.target.value);
            setObjectBrightness(state.selectedObject, brightness);
            if (brightnessValue) brightnessValue.textContent = `${Math.round(brightness * 100)}%`;
        });
    }
    
    if (emissiveSlider) {
        emissiveSlider.addEventListener('input', (e) => {
            if (!state.selectedObject) return;
            const emissive = parseFloat(e.target.value);
            setObjectEmissive(state.selectedObject, emissive);
            if (emissiveValue) emissiveValue.textContent = `${Math.round(emissive * 100)}%`;
        });
    }
    
    // Appearance preset buttons
    document.querySelectorAll('.appearance-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!state.selectedObject) return;
            const brightness = parseFloat(btn.dataset.brightness);
            setObjectBrightness(state.selectedObject, brightness);
            if (brightnessSlider) brightnessSlider.value = brightness;
            if (brightnessValue) brightnessValue.textContent = `${Math.round(brightness * 100)}%`;
        });
    });
}

// Set object brightness by adjusting material color intensity
function setObjectBrightness(object, multiplier) {
    object.traverse((child) => {
        if (child.isMesh && child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(mat => {
                // Store original color if not stored
                if (!mat.userData.originalColor && mat.color) {
                    mat.userData.originalColor = mat.color.clone();
                }
                
                // Apply brightness multiplier
                if (mat.userData.originalColor) {
                    mat.color.copy(mat.userData.originalColor);
                    mat.color.multiplyScalar(multiplier);
                }
                
                mat.needsUpdate = true;
            });
        }
    });
    
    // Store on object for reference
    object.userData.brightness = multiplier;
    console.log(`🎨 Set object brightness to ${Math.round(multiplier * 100)}%`);
}

// Set object emissive glow
function setObjectEmissive(object, intensity) {
    object.traverse((child) => {
        if (child.isMesh && child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(mat => {
                // Only works on materials that support emissive
                if (mat.emissive !== undefined) {
                    if (!mat.userData.originalEmissive) {
                        mat.userData.originalEmissive = mat.emissive.clone();
                    }
                    
                    // Set emissive to white with given intensity
                    mat.emissive.setRGB(intensity, intensity, intensity);
                    mat.emissiveIntensity = intensity > 0 ? 1 : 0;
                    mat.needsUpdate = true;
                }
            });
        }
    });
    
    object.userData.emissive = intensity;
    console.log(`✨ Set object emissive to ${Math.round(intensity * 100)}%`);
}

// Update appearance controls when object is selected
function updateAppearanceControls() {
    const brightnessSlider = document.getElementById('object-brightness');
    const brightnessValue = document.getElementById('object-brightness-value');
    const emissiveSlider = document.getElementById('object-emissive');
    const emissiveValue = document.getElementById('object-emissive-value');
    
    if (state.selectedObject) {
        const brightness = state.selectedObject.userData.brightness || 1.0;
        const emissive = state.selectedObject.userData.emissive || 0;
        
        if (brightnessSlider) brightnessSlider.value = brightness;
        if (brightnessValue) brightnessValue.textContent = `${Math.round(brightness * 100)}%`;
        if (emissiveSlider) emissiveSlider.value = emissive;
        if (emissiveValue) emissiveValue.textContent = `${Math.round(emissive * 100)}%`;
    }
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
    
    // Collect surfaces to raycast against
    const surfacesToTest = [state.groundPlane];
    
    // Add imported map surfaces if available
    if (state.environmentObjects) {
        state.environmentObjects.forEach(obj => {
            obj.traverse(child => {
                if (child.isMesh) surfacesToTest.push(child);
            });
        });
    }
    
    // Also check backdrop objects in state.objects
    state.objects.forEach(obj => {
        if (obj.userData.isBackdrop || obj.userData.type === 'backdrop') {
            obj.traverse(child => {
                if (child.isMesh) surfacesToTest.push(child);
            });
        }
    });
    
    const intersects = state.raycaster.intersectObjects(surfacesToTest, false);
    
    if (intersects.length > 0) {
        const point = intersects[0].point;
        document.getElementById('cursor-pos').textContent = 
            `X: ${point.x.toFixed(1)} | Y: ${point.y.toFixed(1)} | Z: ${point.z.toFixed(1)}`;
        
        // Move placing preview - only X and Z follow mouse
        // Y is controlled manually via Ctrl+Scroll or V key to snap to surface
        if (state.placingObject) {
            state.placingObject.position.x = Math.round(point.x * 2) / 2;
            state.placingObject.position.z = Math.round(point.z * 2) / 2;
            // Y position is NOT auto-adjusted - use Ctrl+Scroll or V key
        }
    }
}

function onCanvasClick(event) {
    console.log('🖱️ Canvas click - mode:', state.mode, 'placingObject:', !!state.placingObject);
    console.log('🖱️ Event target:', event.target.id || event.target.tagName);
    console.log('🖱️ Transform controls active:', state.transformControls?.enabled, 'dragging:', state.transformControls?.dragging);
    
    // Don't place if transform controls is dragging
    if (state.transformControls?.dragging) {
        console.log('⏭️ Skipping - transform controls is dragging');
        return;
    }
    
    if (state.mode === 'PLACE' && state.placingObject) {
        console.log('🏗️ Placing object:', state.placingObject.userData.type, state.placingObject.userData.name);
        console.log('🏗️ Object position:', state.placingObject.position.x, state.placingObject.position.y, state.placingObject.position.z);
        // Place the object
        placeObject();
    } else {
        // Try to select an object
        selectObjectAtMouse();
    }
}

function onKeyDown(event) {
    // Don't handle keys when typing in inputs
    if (event.target.tagName === 'INPUT') return;
    
    const key = event.key.toLowerCase();
    
    // Undo/Redo
    if ((event.ctrlKey || event.metaKey) && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
            redo(); // Ctrl+Shift+Z = Redo
        } else {
            undo(); // Ctrl+Z = Undo
        }
        return;
    }
    if ((event.ctrlKey || event.metaKey) && key === 'y') {
        event.preventDefault();
        redo(); // Ctrl+Y = Redo
        return;
    }
    
    if (event.key === 'Escape') {
        cancelPlacing();
        deselectObject();
        deselectSpawnPoint();
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
        if (state.selectedObject) {
            deleteSelectedObject();
        }
        // Note: Spawn points are deleted via the delete button in the UI
    } 
    // WASD camera movement - MUST come before transform shortcuts so S works for movement
    // Only when not placing an object
    else if (['w', 'a', 's', 'd'].includes(key) && !event.ctrlKey && !state.placingObject) {
        const moveSpeed = event.shiftKey ? 2.0 : 0.5; // Shift for faster movement
        const forward = new THREE.Vector3();
        const right = new THREE.Vector3();
        
        // Get camera direction (ignore Y component for horizontal movement)
        state.camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        
        // Get right vector
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
        
        const delta = new THREE.Vector3();
        
        if (key === 'w') delta.add(forward.multiplyScalar(moveSpeed));
        if (key === 's') delta.add(forward.multiplyScalar(-moveSpeed));
        if (key === 'd') delta.add(right.multiplyScalar(moveSpeed));
        if (key === 'a') delta.add(right.multiplyScalar(-moveSpeed));
        
        // Move camera
        state.camera.position.add(delta);
        // Update target to be a fixed distance in front of camera (pivot point follows camera)
        updateOrbitTarget();
    }
    // Q/E for vertical camera movement
    else if ((key === 'q' || key === 'e') && !event.ctrlKey && !state.placingObject) {
        const moveSpeed = event.shiftKey ? 2.0 : 0.5;
        const delta = key === 'e' ? moveSpeed : -moveSpeed;
        state.camera.position.y += delta;
        // Update target to be a fixed distance in front of camera (pivot point follows camera)
        updateOrbitTarget();
    }
    // Transform mode shortcuts (only when an object is selected)
    else if (key === 'g' && state.selectedObject) {
        setTransformMode('translate');
    } else if (key === 'r' && !event.ctrlKey) {
        if (event.shiftKey) {
            // Quick rotate 45 degrees
            if (state.selectedObject) {
                state.selectedObject.rotation.y += Math.PI / 4;
                updatePropertiesPanel();
            } else if (state.placingObject) {
                state.placingObject.rotation.y += Math.PI / 4;
            }
        } else if (state.selectedObject) {
            setTransformMode('rotate');
        }
    }
    // Snap toggle
    else if (key === 'x') {
        toggleSnap();
    }
    // Duplicate
    else if (key === 'd' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        duplicateSelectedObject();
    }
    // Arrow key movement
    else if ((state.selectedObject || state.selectedSpawnPoint) && ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        event.preventDefault();
        const target = state.selectedObject || state.selectedSpawnPoint;
        
        if (state.selectedObject) {
            saveUndoState('move');
        }
        
        const step = event.shiftKey ? 0.1 : (state.snapEnabled ? state.snapValues.translate : 0.5);
        
        switch (key) {
            case 'arrowup':
                target.position.z -= step;
                break;
            case 'arrowdown':
                target.position.z += step;
                break;
            case 'arrowleft':
                target.position.x -= step;
                break;
            case 'arrowright':
                target.position.x += step;
                break;
        }
        
        if (state.selectedObject) {
            updatePropertiesPanel();
        }
        if (state.selectedSpawnPoint) {
            updateSpawnPointsList();
            showSpawnPointProperties(state.selectedSpawnPoint);
        }
    }
    // Page Up/Down for Y axis
    else if (state.selectedObject && (key === 'pageup' || key === 'pagedown')) {
        event.preventDefault();
        saveUndoState('move Y');
        const step = event.shiftKey ? 0.1 : 0.5;
        state.selectedObject.position.y += key === 'pageup' ? step : -step;
        updatePropertiesPanel();
    }
    // +/- for scale
    else if (state.selectedObject && (key === '+' || key === '=' || key === '-' || key === '_')) {
        saveUndoState('scale');
        const delta = (key === '+' || key === '=') ? 0.1 : -0.1;
        adjustScale(delta);
    }
    // T = Snap TOP to Y:0, B = Snap BOTTOM to Y:0
    else if (key === 't' && state.selectedObject) {
        snapTopToGround();
    }
    else if (key === 'b' && state.selectedObject) {
        snapBottomToGround();
    }
    // V = Drop to surface below (works for placing, selected objects, AND spawn points)
    else if (key === 'v') {
        if (state.placingObject) {
            snapPlacingObjectToSurface();
        } else if (state.selectedObject) {
            snapToSurface();
        } else if (state.selectedSpawnPoint) {
            snapSpawnPointToSurface();
        }
    }
    // F or Home = Focus camera on map/scene
    else if (key === 'f' || key === 'home') {
        focusCameraOnScene();
    }
}

// Update orbit target to be a fixed distance in front of camera
// This makes the rotation pivot point follow the camera position
function updateOrbitTarget() {
    const PIVOT_DISTANCE = 5; // Distance in front of camera for pivot point
    const direction = new THREE.Vector3();
    state.camera.getWorldDirection(direction);
    state.controls.target.copy(state.camera.position).add(direction.multiplyScalar(PIVOT_DISTANCE));
    state.controls.update();
}

// Focus camera on the entire scene or imported map
function focusCameraOnScene() {
    const box = new THREE.Box3();
    
    // If we have an imported map, focus on that
    if (state.environmentObjects && state.environmentObjects.length > 0) {
        state.environmentObjects.forEach(obj => {
            if (obj.userData.type === 'imported-map' || obj.userData.type === 'backdrop') {
                box.expandByObject(obj);
            }
        });
    }
    
    // Also include user objects
    if (state.objects && state.objects.length > 0) {
        state.objects.forEach(obj => box.expandByObject(obj));
    }
    
    // Fallback to spawn points if nothing else
    if (box.isEmpty() && state.startPositions && state.startPositions.length > 0) {
        state.startPositions.forEach(sp => {
            box.expandByPoint(sp.position);
        });
    }
    
    // Fallback to origin
    if (box.isEmpty()) {
        box.set(new THREE.Vector3(-10, -1, -10), new THREE.Vector3(10, 10, 10));
    }
    
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    // Position camera to see the scene nicely
    state.controls.target.copy(center);
    state.camera.position.set(
        center.x + maxDim * 0.6,
        center.y + maxDim * 0.4,
        center.z + maxDim * 0.6
    );
    state.controls.update();
    
    console.log(`📷 Camera focused on scene: center(${center.x.toFixed(1)}, ${center.y.toFixed(1)}, ${center.z.toFixed(1)}) size(${size.x.toFixed(1)}, ${size.y.toFixed(1)}, ${size.z.toFixed(1)})`);
}

// ========================================
// TRANSFORM CONTROL FUNCTIONS
// ========================================

function setTransformMode(mode) {
    state.transformMode = mode;
    
    // Update transform controls if active
    if (state.transformControls && state.selectedObject) {
        state.transformControls.setMode(mode);
    }
    
    // Update UI
    document.querySelectorAll('.transform-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    
    // Update snap for this mode
    updateSnapForMode();
}

function toggleSnap() {
    state.snapEnabled = !state.snapEnabled;
    
    const btn = document.getElementById('snap-toggle');
    btn.classList.toggle('active', state.snapEnabled);
    
    updateSnapForMode();
}

function updateSnapForMode() {
    if (!state.transformControls) return;
    
    if (state.snapEnabled) {
        state.transformControls.setTranslationSnap(state.snapValues.translate);
        state.transformControls.setRotationSnap(state.snapValues.rotate);
        state.transformControls.setScaleSnap(state.snapValues.scale);
    } else {
        state.transformControls.setTranslationSnap(null);
        state.transformControls.setRotationSnap(null);
        state.transformControls.setScaleSnap(null);
    }
}

function adjustPosition(axis, delta) {
    const target = state.selectedObject || state.selectedSpawnPoint;
    if (!target) return;
    
    if (state.selectedObject) {
        saveUndoState('move');
    }
    
    const step = state.snapEnabled ? state.snapValues.translate : Math.abs(delta);
    const direction = delta > 0 ? 1 : -1;
    
    target.position[axis] += step * direction;
    
    if (state.selectedObject) {
        updatePropertiesPanel();
    }
    if (state.selectedSpawnPoint) {
        updateSpawnPointsList();
        showSpawnPointProperties(state.selectedSpawnPoint);
    }
}

function adjustRotation(degrees) {
    const target = state.selectedObject || state.selectedSpawnPoint;
    if (!target) return;
    
    if (state.selectedObject) {
        saveUndoState('rotate');
    }
    
    target.rotation.y += (degrees * Math.PI / 180);
    
    if (state.selectedObject) {
        updatePropertiesPanel();
    }
    if (state.selectedSpawnPoint) {
        updateSpawnPointsList();
        showSpawnPointProperties(state.selectedSpawnPoint);
    }
}

function adjustScale(delta) {
    if (!state.selectedObject) return;
    
    saveUndoState('scale');
    
    const currentScale = state.selectedObject.scale.x;
    const newScale = Math.max(0.1, Math.min(10, currentScale + delta));
    
    state.selectedObject.scale.set(newScale, newScale, newScale);
    updatePropertiesPanel();
    updateScaleUI(newScale);
}

function setScale(value) {
    if (!state.selectedObject) return;
    
    saveUndoState('scale');
    
    const newScale = Math.max(0.1, Math.min(10, value));
    state.selectedObject.scale.set(newScale, newScale, newScale);
    updatePropertiesPanel();
    updateScaleUI(newScale);
}

function updateScaleUI(value) {
    document.getElementById('scale').value = value;
    document.getElementById('scale-input').value = value.toFixed(2);
    
    // Update scale presets active state
    document.querySelectorAll('.scale-preset').forEach(btn => {
        const presetValue = parseFloat(btn.dataset.scale);
        btn.classList.toggle('active', Math.abs(presetValue - value) < 0.01);
    });
}

// ========================================
// GROUND SNAPPING
// ========================================

/**
 * Get the world-space bounding box of an object
 * Takes into account scale, rotation and any child meshes
 */
function getObjectBoundingBox(object) {
    const box = new THREE.Box3();
    
    // Clone the object's world matrix to not mess with the original
    object.updateMatrixWorld(true);
    
    // Compute bounding box from geometry
    box.setFromObject(object);
    
    return box;
}

/**
 * Snap object so its TOP surface is at Y=0
 * Ideal for ground pieces - they sit below Y=0 level
 */
function snapTopToGround() {
    if (!state.selectedObject) return;
    
    saveUndoState('snap-top');
    
    const box = getObjectBoundingBox(state.selectedObject);
    const offsetY = -box.max.y;
    
    state.selectedObject.position.y += offsetY;
    updatePropertiesPanel();
}

/**
 * Snap object so its BOTTOM sits at Y=0
 * Ideal for objects placed on the ground
 */
function snapBottomToGround() {
    if (!state.selectedObject) return;
    
    saveUndoState('snap-bottom');
    
    const box = getObjectBoundingBox(state.selectedObject);
    const offsetY = -box.min.y;
    
    state.selectedObject.position.y += offsetY;
    updatePropertiesPanel();
}

/**
 * Drop object onto the surface directly below it (raycast down)
 * Works with imported maps and other geometry
 */
function snapToSurface() {
    if (!state.selectedObject) return;
    
    saveUndoState('snap-to-surface');
    
    // Get object's bounding box to find its bottom
    const box = getObjectBoundingBox(state.selectedObject);
    const objectBottom = box.min.y;
    const objectCenter = new THREE.Vector3(
        state.selectedObject.position.x,
        state.selectedObject.position.y,
        state.selectedObject.position.z
    );
    
    // Start raycast from above the object, pointing down
    const rayStart = new THREE.Vector3(objectCenter.x, objectCenter.y + 100, objectCenter.z);
    const rayDirection = new THREE.Vector3(0, -1, 0);
    
    const raycaster = new THREE.Raycaster(rayStart, rayDirection);
    
    // Collect all meshes to test against (except the selected object itself)
    const meshesToTest = [];
    
    // Add environment/backdrop objects (imported maps)
    if (state.environmentObjects) {
        state.environmentObjects.forEach(obj => {
            obj.traverse(child => {
                if (child.isMesh) meshesToTest.push(child);
            });
        });
    }
    
    // Add other placed objects (not the selected one)
    state.objects.forEach(obj => {
        if (obj !== state.selectedObject) {
            obj.traverse(child => {
                if (child.isMesh) meshesToTest.push(child);
            });
        }
    });
    
    // Also include the ground plane if it exists
    if (state.groundMesh) {
        meshesToTest.push(state.groundMesh);
    }
    
    const intersects = raycaster.intersectObjects(meshesToTest, false);
    
    if (intersects.length > 0) {
        // Find the first intersection that's below the object
        const hitPoint = intersects[0].point;
        
        // Move the object so its bottom sits on the hit point
        const offsetY = hitPoint.y - objectBottom;
        state.selectedObject.position.y += offsetY;
        
        console.log(`📍 Snapped to surface at Y=${hitPoint.y.toFixed(2)}`);
        updatePropertiesPanel();
    } else {
        // No surface found below - snap to Y=0 as fallback
        const offsetY = -objectBottom;
        state.selectedObject.position.y += offsetY;
        console.log(`📍 No surface found - snapped to Y=0`);
        updatePropertiesPanel();
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
        // Clone default props
        const props = { ...definition.defaultProps };
        
        state.placingObject = definition.create(props);
        state.placingObject.userData.type = objectType;
        state.placingObject.userData.name = definition.name;
        state.placingObject.userData.props = props;
        
        // Make it semi-transparent
        setObjectOpacity(state.placingObject, 0.5);
        
        state.scene.add(state.placingObject);
        setMode('PLACE');
    }
}

function setObjectOpacity(object, opacity) {
    object.traverse((child) => {
        if (child.isMesh && child.material) {
            // Handle both single materials and material arrays
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            const updatedMaterials = materials.map(mat => {
                // Clone material if not already cloned for this preview
                let newMat = mat;
                if (!mat.userData?.isPreviewClone) {
                    newMat = mat.clone();
                    newMat.userData = newMat.userData || {};
                    newMat.userData.isPreviewClone = true;
                }
                
                // Only set transparent when opacity < 1 to avoid rendering issues
                newMat.transparent = opacity < 1;
                newMat.opacity = opacity;
                
                // Ensure proper depth testing for solid objects
                if (opacity >= 1) {
                    newMat.depthWrite = true;
                    newMat.needsUpdate = true;
                }
                return newMat;
            });
            
            // Assign back as array or single material
            child.material = Array.isArray(child.material) ? updatedMaterials : updatedMaterials[0];
        }
    });
}

function placeObject() {
    console.log('📍 placeObject() called - placingObject:', !!state.placingObject);
    if (!state.placingObject) return;
    
    console.log('📍 Placing object type:', state.placingObject.userData.type);
    saveUndoState('place object');
    
    // Save current rotation and height for new preview
    const currentRotationY = state.placingObject.rotation.y;
    const currentPositionY = state.placingObject.position.y; // Preserve height
    const currentPosition = state.placingObject.position.clone();
    
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
    console.log('✅ Object placed! Total objects:', state.objects.length, 'Type:', state.placingObject.userData.type);
    
    // Create new preview
    const objectType = state.placingObject.userData.type;
    
    // Handle custom models
    if (objectType === 'custom-model') {
        const modelId = state.placingObject.userData.customModelId;
        const model = state.customModels.find(m => m.id === modelId);
        
        if (model) {
            const newPlacing = model.scene.clone();
            newPlacing.userData.type = 'custom-model';
            newPlacing.userData.customModelId = modelId;
            newPlacing.userData.name = model.name;
            newPlacing.userData.props = {
                scale: 1,
                vertexCount: model.vertexCount,
                triangleCount: model.triangleCount
            };
            setObjectOpacity(newPlacing, 0.5);
            newPlacing.rotation.y = currentRotationY; // Preserve rotation
            newPlacing.position.copy(currentPosition); // Stay at same position
            state.placingObject = newPlacing;
            state.scene.add(newPlacing);
        }
    } else if (objectType === 'diy-object') {
        // Handle DIY objects
        const diyObjectId = state.placingObject.userData.diyObjectId;
        const diyObj = state.diyObjects.find(o => o.id === diyObjectId);
        
        if (diyObj && diyObj.mesh) {
            const newPlacing = diyObj.mesh.clone();
            newPlacing.userData.type = 'diy-object';
            newPlacing.userData.diyObjectId = diyObjectId;
            newPlacing.userData.name = diyObj.name;
            newPlacing.userData.props = {
                scale: 1,
                packName: diyObj.packName,
                filename: diyObj.filename
            };
            setObjectOpacity(newPlacing, 0.5);
            newPlacing.rotation.y = currentRotationY; // Preserve rotation
            newPlacing.position.copy(currentPosition); // Stay at same position
            state.placingObject = newPlacing;
            state.scene.add(newPlacing);
        }
    } else if (objectType === 'imported-3d') {
        // Handle imported 3D models
        console.log('🏗️ Handling imported-3d placement');
        const modelId = state.placingObject.userData.imported3DId;
        console.log('   Model ID:', modelId);
        const model = state.imported3DModels.find(m => m.id === modelId);
        console.log('   Found model:', !!model, model?.name);
        
        if (model && model.mesh) {
            console.log('   Creating new preview from model.mesh');
            const newPlacing = model.mesh.clone();
            newPlacing.userData.type = 'imported-3d';
            newPlacing.userData.imported3DId = modelId;
            newPlacing.userData.name = model.name;
            newPlacing.userData.props = {
                scale: 1,
                ...model.options
            };
            setObjectOpacity(newPlacing, 0.5);
            newPlacing.rotation.y = currentRotationY; // Preserve rotation
            newPlacing.position.copy(currentPosition); // Stay at same position
            state.placingObject = newPlacing;
            state.scene.add(newPlacing);
            console.log('   ✅ New preview created and added to scene');
        } else {
            console.error('   ❌ Model or model.mesh not found!');
        }
    } else {
        // Standard objects
        const definition = OBJECT_DEFINITIONS[objectType];
        const props = { ...definition.defaultProps };
        
        state.placingObject = definition.create(props);
        state.placingObject.userData.type = objectType;
        state.placingObject.userData.name = definition.name;
        state.placingObject.userData.props = props;
        setObjectOpacity(state.placingObject, 0.5);
        state.placingObject.rotation.y = currentRotationY; // Preserve rotation
        state.placingObject.position.copy(currentPosition); // Stay at same position
        state.scene.add(state.placingObject);
    }
    
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
    
    // Get all meshes from objects AND spawn points
    const meshes = [];
    const spawnMeshes = [];
    
    state.objects.forEach(obj => {
        obj.traverse((child) => {
            if (child.isMesh) {
                meshes.push(child);
            }
        });
    });
    
    // Also add spawn point meshes
    state.startPositions.forEach(sp => {
        sp.traverse((child) => {
            if (child.isMesh) {
                spawnMeshes.push(child);
            }
        });
    });
    
    // Check spawn points first (they're on top)
    const spawnIntersects = state.raycaster.intersectObjects(spawnMeshes);
    if (spawnIntersects.length > 0) {
        // Find the root spawn point
        let selected = spawnIntersects[0].object;
        while (selected.parent && !state.startPositions.includes(selected)) {
            selected = selected.parent;
        }
        
        if (state.startPositions.includes(selected)) {
            deselectObject();
            selectSpawnPoint(selected);
            return;
        }
    }
    
    const intersects = state.raycaster.intersectObjects(meshes);
    
    if (intersects.length > 0) {
        // Find the root object
        let selected = intersects[0].object;
        while (selected.parent && !state.objects.includes(selected)) {
            selected = selected.parent;
        }
        
        if (state.objects.includes(selected)) {
            deselectSpawnPoint();
            selectObject(selected);
        }
    } else {
        deselectObject();
        deselectSpawnPoint();
    }
}

function selectObject(object) {
    // Don't select locked/backdrop objects
    if (object.userData.locked || object.userData.isBackdrop) {
        return;
    }
    
    deselectObject();
    
    state.selectedObject = object;
    
    // Add highlight - be careful with material types
    object.traverse((child) => {
        if (child.isMesh) {
            child.userData.originalMaterial = child.material;
            const clonedMat = child.material.clone();
            
            // Only set emissive on materials that support it (Standard, Phong, Lambert)
            // MeshBasicMaterial does NOT have emissive property
            if (clonedMat.emissive !== undefined) {
                clonedMat.emissive = new THREE.Color(0xff3c00);
                clonedMat.emissiveIntensity = 0.3;
            } else {
                // For BasicMaterial, slightly tint the color
                if (clonedMat.color) {
                    child.userData.originalColor = clonedMat.color.clone();
                    clonedMat.color.lerp(new THREE.Color(0xff3c00), 0.3);
                }
            }
            
            child.material = clonedMat;
        }
    });
    
    // Attach transform controls
    if (state.transformControls) {
        state.transformControls.attach(object);
        state.transformControls.setMode(state.transformMode);
        updateSnapForMode();
    }
    
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
    
    // Detach transform controls
    if (state.transformControls) {
        state.transformControls.detach();
    }
    
    document.getElementById('no-selection').classList.remove('hidden');
    document.getElementById('object-properties').classList.add('hidden');
}

function deleteSelectedObject() {
    if (!state.selectedObject) return;
    
    saveUndoState('delete object');
    
    state.scene.remove(state.selectedObject);
    state.objects = state.objects.filter(o => o !== state.selectedObject);
    state.selectedObject = null;
    
    deselectObject();
    updateObjectCount();
}

function duplicateSelectedObject() {
    if (!state.selectedObject) return;
    
    saveUndoState('duplicate object');
    
    const objectType = state.selectedObject.userData.type;
    
    // Handle custom model duplication
    if (objectType === 'custom-model') {
        const modelId = state.selectedObject.userData.customModelId;
        const model = state.customModels.find(m => m.id === modelId);
        
        if (model) {
            const clone = model.scene.clone();
            clone.userData.type = 'custom-model';
            clone.userData.customModelId = modelId;
            clone.userData.name = model.name;
            clone.userData.props = { ...state.selectedObject.userData.props };
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
        return;
    }
    
    // Handle DIY object duplication
    if (objectType === 'diy-object') {
        const diyObjectId = state.selectedObject.userData.diyObjectId;
        const diyObj = state.diyObjects.find(o => o.id === diyObjectId);
        
        if (diyObj && diyObj.mesh) {
            const clone = diyObj.mesh.clone();
            clone.userData.type = 'diy-object';
            clone.userData.diyObjectId = diyObjectId;
            clone.userData.name = diyObj.name;
            clone.userData.props = { ...state.selectedObject.userData.props };
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
        return;
    }
    
    const definition = OBJECT_DEFINITIONS[objectType];
    if (!definition) return;
    const originalProps = state.selectedObject.userData.props || definition.defaultProps;
    
    if (definition) {
        const props = { ...originalProps };
        const clone = definition.create(props);
        clone.userData.type = objectType;
        clone.userData.name = definition.name;
        clone.userData.props = props;
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
    
    // Also clear environment objects (imported maps)
    if (state.environmentObjects) {
        state.environmentObjects.forEach(obj => state.scene.remove(obj));
        state.environmentObjects = [];
    }
    
    // Reset imported map data - new scene uses default units
    state.importedMapScale = 1;
    state.importedMapZip = null;
    state.importedMapGeometry = null;
    state.importedMapGeometryRaw = null;
    state.importedMapGeometryFileName = null;
    state.importedMapName = null;
    state.importedMapModJson = null;
    state.importedMapModJsonRaw = null;
    
    deselectObject();
    cancelPlacing();
    updateObjectCount();
}

// ========================================
// REGENERATE OBJECT
// ========================================

function regenerateSelectedObject() {
    if (!state.selectedObject) return;
    
    const objectType = state.selectedObject.userData.type;
    
    // Custom models don't regenerate - they only transform
    if (objectType === 'custom-model') {
        return;
    }
    
    const definition = OBJECT_DEFINITIONS[objectType];
    const props = state.selectedObject.userData.props;
    
    // Store transform
    const position = state.selectedObject.position.clone();
    const rotation = state.selectedObject.rotation.clone();
    const scale = state.selectedObject.scale.clone();
    
    // Remove old object
    state.scene.remove(state.selectedObject);
    const index = state.objects.indexOf(state.selectedObject);
    
    // Create new object with updated props
    const newObject = definition.create(props);
    newObject.userData.type = objectType;
    newObject.userData.name = definition.name;
    newObject.userData.props = props;
    
    // Restore transform
    newObject.position.copy(position);
    newObject.rotation.copy(rotation);
    newObject.scale.copy(scale);
    
    // Enable shadows
    newObject.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
    
    // Update arrays
    state.objects[index] = newObject;
    state.scene.add(newObject);
    
    // Re-select (adds highlight)
    state.selectedObject = null;
    selectObject(newObject);
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
    
    // Update object name
    const objectType = state.selectedObject.userData.type;
    document.getElementById('selected-object-name').textContent = state.selectedObject.userData.name || 'Unknown';
    document.getElementById('selected-object-type').textContent = objectType === 'custom-model' ? 'Poly.cam Import' : (objectType || '');
    
    // Update transform
    document.getElementById('pos-x').value = state.selectedObject.position.x.toFixed(1);
    document.getElementById('pos-y').value = state.selectedObject.position.y.toFixed(1);
    document.getElementById('pos-z').value = state.selectedObject.position.z.toFixed(1);
    document.getElementById('rot-y').value = (state.selectedObject.rotation.y * 180 / Math.PI).toFixed(0);
    
    const scale = state.selectedObject.scale.x;
    document.getElementById('scale').value = Math.min(5, scale);
    document.getElementById('scale-input').value = scale.toFixed(2);
    
    // Update scale presets active state
    document.querySelectorAll('.scale-preset').forEach(btn => {
        const presetValue = parseFloat(btn.dataset.scale);
        btn.classList.toggle('active', Math.abs(presetValue - scale) < 0.01);
    });
    
    // Show/hide mesh tools for custom models
    const meshTools = document.getElementById('custom-model-tools');
    if (meshTools) {
        const isCustomModel = state.selectedObject.userData.type === 'custom-model';
        meshTools.style.display = isCustomModel ? 'block' : 'none';
        
        // Count vertices and show warning if too many
        if (isCustomModel) {
            let vertexCount = 0;
            state.selectedObject.traverse((child) => {
                if (child.isMesh && child.geometry && child.geometry.attributes.position) {
                    vertexCount += child.geometry.attributes.position.count;
                }
            });
            
            const vertexWarning = document.getElementById('vertex-warning');
            const vertexCountSpan = document.getElementById('vertex-count');
            if (vertexWarning && vertexCountSpan) {
                const MAX_SAFE_VERTICES = 20000;
                if (vertexCount > MAX_SAFE_VERTICES) {
                    vertexCountSpan.textContent = vertexCount.toLocaleString();
                    vertexWarning.style.display = 'block';
                } else {
                    vertexWarning.style.display = 'none';
                }
            }
        }
        
        // Reset simplify options
        const simplifyOptions = document.getElementById('simplify-options');
        if (simplifyOptions) {
            simplifyOptions.style.display = 'none';
        }
    }
    
    // Build custom properties UI
    buildCustomPropertiesUI();
    
    // Update appearance controls
    updateAppearanceControls();
}

function buildCustomPropertiesUI() {
    const container = document.getElementById('custom-properties');
    container.innerHTML = '';
    
    if (!state.selectedObject) return;
    
    const objectType = state.selectedObject.userData.type;
    const props = state.selectedObject.userData.props;
    
    // Handle custom models differently
    if (objectType === 'custom-model') {
        buildCustomModelPropertiesUI(container, props);
        return;
    }
    
    const propDefs = PROPERTY_DEFINITIONS[objectType];
    
    if (!propDefs || !props) return;
    
    propDefs.forEach(propDef => {
        const group = document.createElement('div');
        group.className = 'property-row';
        
        const label = document.createElement('span');
        label.className = 'prop-label';
        label.textContent = propDef.label;
        group.appendChild(label);
        
        if (propDef.type === 'number') {
            const input = document.createElement('input');
            input.type = 'number';
            input.min = propDef.min;
            input.max = propDef.max;
            input.step = propDef.step;
            input.value = props[propDef.key];
            input.dataset.propKey = propDef.key;
            input.addEventListener('change', (e) => {
                props[propDef.key] = parseFloat(e.target.value);
                regenerateSelectedObject();
            });
            group.appendChild(input);
        } else if (propDef.type === 'color') {
            const colorWrapper = document.createElement('div');
            colorWrapper.className = 'color-input-wrapper';
            
            const input = document.createElement('input');
            input.type = 'color';
            input.value = props[propDef.key];
            input.dataset.propKey = propDef.key;
            input.addEventListener('input', (e) => {
                props[propDef.key] = e.target.value;
                regenerateSelectedObject();
            });
            colorWrapper.appendChild(input);
            
            const colorText = document.createElement('span');
            colorText.className = 'color-value';
            colorText.textContent = props[propDef.key];
            colorWrapper.appendChild(colorText);
            
            input.addEventListener('input', (e) => {
                colorText.textContent = e.target.value;
            });
            
            group.appendChild(colorWrapper);
        }
        
        container.appendChild(group);
    });
}

function buildCustomModelPropertiesUI(container, props) {
    // Model info section
    const infoDiv = document.createElement('div');
    infoDiv.className = 'custom-model-info';
    infoDiv.innerHTML = `
        <div style="font-size: 11px; color: var(--accent-warning);">📦 Poly.cam Model</div>
        <div class="model-stats">
            <span>Vertices: ${props?.vertexCount?.toLocaleString() || 'N/A'}</span>
            <span>Triangles: ${props?.triangleCount?.toLocaleString() || 'N/A'}</span>
        </div>
    `;
    container.appendChild(infoDiv);
    
    // Initialize material props if not exists
    if (!state.selectedObject.userData.materialProps) {
        state.selectedObject.userData.materialProps = {
            tintColor: '#ffffff',
            tintEnabled: false,
            roughness: 0.5,
            metalness: 0.0,
            opacity: 1.0,
            wireframe: false,
            flatShading: false
        };
    }
    const matProps = state.selectedObject.userData.materialProps;
    
    // === Tint Color Section ===
    const tintSection = document.createElement('div');
    tintSection.className = 'property-group';
    tintSection.innerHTML = `<label>Tint Color Override</label>`;
    
    const tintRow = document.createElement('div');
    tintRow.className = 'property-row';
    tintRow.style.cssText = 'display: flex; align-items: center; gap: 8px;';
    
    // Enable checkbox
    const tintCheck = document.createElement('input');
    tintCheck.type = 'checkbox';
    tintCheck.checked = matProps.tintEnabled;
    tintCheck.style.cssText = 'width: 18px; height: 18px; accent-color: var(--accent-warning);';
    tintCheck.addEventListener('change', (e) => {
        matProps.tintEnabled = e.target.checked;
        applyMaterialPropsToCustomModel();
    });
    tintRow.appendChild(tintCheck);
    
    // Color picker
    const colorWrapper = document.createElement('div');
    colorWrapper.className = 'color-input-wrapper';
    colorWrapper.style.flex = '1';
    
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = matProps.tintColor;
    colorInput.addEventListener('input', (e) => {
        matProps.tintColor = e.target.value;
        colorValue.textContent = e.target.value;
        if (matProps.tintEnabled) {
            applyMaterialPropsToCustomModel();
        }
    });
    colorWrapper.appendChild(colorInput);
    
    const colorValue = document.createElement('span');
    colorValue.className = 'color-value';
    colorValue.textContent = matProps.tintColor;
    colorWrapper.appendChild(colorValue);
    
    tintRow.appendChild(colorWrapper);
    tintSection.appendChild(tintRow);
    container.appendChild(tintSection);
    
    // === Material Properties Section ===
    const matSection = document.createElement('div');
    matSection.className = 'property-group';
    matSection.innerHTML = `<label>Material Properties</label>`;
    
    // Roughness slider
    const roughRow = document.createElement('div');
    roughRow.className = 'property-row';
    roughRow.innerHTML = `<span class="prop-label">Roughness</span>`;
    
    const roughSlider = document.createElement('input');
    roughSlider.type = 'range';
    roughSlider.min = '0';
    roughSlider.max = '1';
    roughSlider.step = '0.05';
    roughSlider.value = matProps.roughness;
    roughSlider.style.flex = '1';
    
    const roughValue = document.createElement('span');
    roughValue.style.cssText = 'min-width: 40px; text-align: right; font-size: 11px; color: var(--text-secondary);';
    roughValue.textContent = matProps.roughness.toFixed(2);
    
    roughSlider.addEventListener('input', (e) => {
        matProps.roughness = parseFloat(e.target.value);
        roughValue.textContent = matProps.roughness.toFixed(2);
        applyMaterialPropsToCustomModel();
    });
    
    roughRow.appendChild(roughSlider);
    roughRow.appendChild(roughValue);
    matSection.appendChild(roughRow);
    
    // Metalness slider
    const metalRow = document.createElement('div');
    metalRow.className = 'property-row';
    metalRow.innerHTML = `<span class="prop-label">Metalness</span>`;
    
    const metalSlider = document.createElement('input');
    metalSlider.type = 'range';
    metalSlider.min = '0';
    metalSlider.max = '1';
    metalSlider.step = '0.05';
    metalSlider.value = matProps.metalness;
    metalSlider.style.flex = '1';
    
    const metalValue = document.createElement('span');
    metalValue.style.cssText = 'min-width: 40px; text-align: right; font-size: 11px; color: var(--text-secondary);';
    metalValue.textContent = matProps.metalness.toFixed(2);
    
    metalSlider.addEventListener('input', (e) => {
        matProps.metalness = parseFloat(e.target.value);
        metalValue.textContent = matProps.metalness.toFixed(2);
        applyMaterialPropsToCustomModel();
    });
    
    metalRow.appendChild(metalSlider);
    metalRow.appendChild(metalValue);
    matSection.appendChild(metalRow);
    
    // Opacity slider
    const opacityRow = document.createElement('div');
    opacityRow.className = 'property-row';
    opacityRow.innerHTML = `<span class="prop-label">Opacity</span>`;
    
    const opacitySlider = document.createElement('input');
    opacitySlider.type = 'range';
    opacitySlider.min = '0.1';
    opacitySlider.max = '1';
    opacitySlider.step = '0.05';
    opacitySlider.value = matProps.opacity;
    opacitySlider.style.flex = '1';
    
    const opacityValue = document.createElement('span');
    opacityValue.style.cssText = 'min-width: 40px; text-align: right; font-size: 11px; color: var(--text-secondary);';
    opacityValue.textContent = matProps.opacity.toFixed(2);
    
    opacitySlider.addEventListener('input', (e) => {
        matProps.opacity = parseFloat(e.target.value);
        opacityValue.textContent = matProps.opacity.toFixed(2);
        applyMaterialPropsToCustomModel();
    });
    
    opacityRow.appendChild(opacitySlider);
    opacityRow.appendChild(opacityValue);
    matSection.appendChild(opacityRow);
    
    container.appendChild(matSection);
    
    // === Visual Options Section ===
    const visualSection = document.createElement('div');
    visualSection.className = 'property-group';
    visualSection.innerHTML = `<label>Visual Options</label>`;
    
    // Wireframe toggle
    const wireRow = document.createElement('div');
    wireRow.className = 'property-row';
    wireRow.style.cssText = 'display: flex; align-items: center; gap: 8px;';
    
    const wireCheck = document.createElement('input');
    wireCheck.type = 'checkbox';
    wireCheck.checked = matProps.wireframe;
    wireCheck.id = 'wireframe-check';
    wireCheck.style.cssText = 'width: 18px; height: 18px; accent-color: var(--accent-secondary);';
    wireCheck.addEventListener('change', (e) => {
        matProps.wireframe = e.target.checked;
        applyMaterialPropsToCustomModel();
    });
    
    const wireLabel = document.createElement('label');
    wireLabel.htmlFor = 'wireframe-check';
    wireLabel.style.cssText = 'font-size: 11px; color: var(--text-secondary); cursor: pointer;';
    wireLabel.textContent = 'Wireframe Mode';
    
    wireRow.appendChild(wireCheck);
    wireRow.appendChild(wireLabel);
    visualSection.appendChild(wireRow);
    
    // Flat shading toggle
    const flatRow = document.createElement('div');
    flatRow.className = 'property-row';
    flatRow.style.cssText = 'display: flex; align-items: center; gap: 8px;';
    
    const flatCheck = document.createElement('input');
    flatCheck.type = 'checkbox';
    flatCheck.checked = matProps.flatShading;
    flatCheck.id = 'flat-shading-check';
    flatCheck.style.cssText = 'width: 18px; height: 18px; accent-color: var(--accent-secondary);';
    flatCheck.addEventListener('change', (e) => {
        matProps.flatShading = e.target.checked;
        applyMaterialPropsToCustomModel();
    });
    
    const flatLabel = document.createElement('label');
    flatLabel.htmlFor = 'flat-shading-check';
    flatLabel.style.cssText = 'font-size: 11px; color: var(--text-secondary); cursor: pointer;';
    flatLabel.textContent = 'Flat Shading';
    
    flatRow.appendChild(flatCheck);
    flatRow.appendChild(flatLabel);
    visualSection.appendChild(flatRow);
    
    container.appendChild(visualSection);
    
    // === Quick Color Presets ===
    const presetsSection = document.createElement('div');
    presetsSection.className = 'property-group';
    presetsSection.innerHTML = `<label>Quick Color Presets</label>`;
    
    const presetGrid = document.createElement('div');
    presetGrid.style.cssText = 'display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px;';
    
    const colorPresets = [
        { color: '#ffffff', name: 'White' },
        { color: '#888888', name: 'Gray' },
        { color: '#333333', name: 'Dark' },
        { color: '#ff4444', name: 'Red' },
        { color: '#44ff44', name: 'Green' },
        { color: '#4488ff', name: 'Blue' },
        { color: '#ffcc00', name: 'Yellow' },
        { color: '#ff8800', name: 'Orange' },
        { color: '#cc44ff', name: 'Purple' },
        { color: '#00cccc', name: 'Teal' },
        { color: '#ff6699', name: 'Pink' },
        { color: '#8b4513', name: 'Brown' },
    ];
    
    colorPresets.forEach(preset => {
        const btn = document.createElement('button');
        btn.style.cssText = `
            width: 100%;
            aspect-ratio: 1;
            background: ${preset.color};
            border: 2px solid var(--border-color);
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.15s ease;
        `;
        btn.title = preset.name;
        btn.addEventListener('click', () => {
            matProps.tintColor = preset.color;
            matProps.tintEnabled = true;
            colorInput.value = preset.color;
            colorValue.textContent = preset.color;
            tintCheck.checked = true;
            applyMaterialPropsToCustomModel();
        });
        btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'scale(1.15)';
            btn.style.borderColor = 'var(--accent-primary)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'scale(1)';
            btn.style.borderColor = 'var(--border-color)';
        });
        presetGrid.appendChild(btn);
    });
    
    presetsSection.appendChild(presetGrid);
    container.appendChild(presetsSection);
    
    // Reset button
    const resetRow = document.createElement('div');
    resetRow.className = 'property-row';
    resetRow.style.marginTop = '8px';
    
    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn-secondary';
    resetBtn.style.cssText = 'padding: 8px 12px; font-size: 11px;';
    resetBtn.innerHTML = '🔄 Reset to Original';
    resetBtn.addEventListener('click', () => {
        matProps.tintEnabled = false;
        matProps.roughness = 0.5;
        matProps.metalness = 0.0;
        matProps.opacity = 1.0;
        matProps.wireframe = false;
        matProps.flatShading = false;
        applyMaterialPropsToCustomModel();
        buildCustomPropertiesUI(); // Rebuild UI to reflect reset
    });
    
    resetRow.appendChild(resetBtn);
    container.appendChild(resetRow);
}

/**
 * Apply material properties to all meshes in a custom model
 */
function applyMaterialPropsToCustomModel() {
    if (!state.selectedObject) return;
    
    const matProps = state.selectedObject.userData.materialProps;
    if (!matProps) return;
    
    state.selectedObject.traverse((child) => {
        if (child.isMesh && child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            
            materials.forEach(mat => {
                // Store original color if not already stored
                if (!mat.userData.originalColor && mat.color) {
                    mat.userData.originalColor = mat.color.clone();
                }
                
                // Apply tint color if enabled
                if (matProps.tintEnabled) {
                    mat.color.set(matProps.tintColor);
                } else if (mat.userData.originalColor) {
                    mat.color.copy(mat.userData.originalColor);
                }
                
                // Apply material properties
                if (mat.roughness !== undefined) {
                    mat.roughness = matProps.roughness;
                }
                if (mat.metalness !== undefined) {
                    mat.metalness = matProps.metalness;
                }
                
                // Apply opacity
                mat.opacity = matProps.opacity;
                mat.transparent = matProps.opacity < 1.0;
                
                // Apply wireframe
                mat.wireframe = matProps.wireframe;
                
                // Apply flat shading
                if (mat.flatShading !== matProps.flatShading) {
                    mat.flatShading = matProps.flatShading;
                    mat.needsUpdate = true;
                }
            });
        }
    });
}

function updateSelectedPosition() {
    const target = state.selectedObject || state.selectedSpawnPoint;
    if (!target) return;
    
    target.position.x = parseFloat(document.getElementById('pos-x').value) || 0;
    target.position.y = parseFloat(document.getElementById('pos-y').value) || 0;
    target.position.z = parseFloat(document.getElementById('pos-z').value) || 0;
    
    // Update spawn points list if a spawn point is being edited
    if (state.selectedSpawnPoint) {
        updateSpawnPointsList();
    }
}

function updateSelectedRotation() {
    const target = state.selectedObject || state.selectedSpawnPoint;
    if (!target) return;
    
    const degrees = parseFloat(document.getElementById('rot-y').value) || 0;
    target.rotation.y = degrees * Math.PI / 180;
    
    // Update spawn points list if a spawn point is being edited
    if (state.selectedSpawnPoint) {
        updateSpawnPointsList();
    }
}

function updateSelectedScale() {
    if (!state.selectedObject) return;
    
    const scale = parseFloat(document.getElementById('scale').value) || 1;
    state.selectedObject.scale.set(scale, scale, scale);
    document.getElementById('scale-input').value = scale.toFixed(2);
    
    // Update scale presets active state
    document.querySelectorAll('.scale-preset').forEach(btn => {
        const presetValue = parseFloat(btn.dataset.scale);
        btn.classList.toggle('active', Math.abs(presetValue - scale) < 0.01);
    });
}

// ========================================
// TRUE SKATE FORMAT EXPORT
// ========================================

// Geometry generators for True Skate format
const TS_SCALE = 100.0; // True Skate uses larger coordinates

// Helper to convert hex color to RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 180, g: 180, b: 180 };
}

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

// Helper to generate a colored box
function generateColoredBoxGeometry(width, height, depth, offsetX, offsetY, offsetZ, color) {
    const geo = generateBoxGeometry(width, height, depth, offsetX, offsetY, offsetZ);
    if (color) {
        geo.vertices.forEach(v => { v.r = color.r; v.g = color.g; v.b = color.b; });
    }
    return geo;
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
    
    // Lift pyramid slightly above ground to prevent z-fighting
    const groundOffset = 0.01;
    
    const corners = [
        [-baseRadius, groundOffset, -baseRadius],
        [baseRadius, groundOffset, -baseRadius],
        [baseRadius, groundOffset, baseRadius],
        [-baseRadius, groundOffset, baseRadius],
    ];
    const apex = [0, height + groundOffset, 0];
    
    const calcNormal = (p1, p2, p3) => {
        const ax = p2[0] - p1[0], ay = p2[1] - p1[1], az = p2[2] - p1[2];
        const bx = p3[0] - p1[0], by = p3[1] - p1[1], bz = p3[2] - p1[2];
        const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        return len > 0 ? [nx / len, ny / len, nz / len] : [0, 1, 0];
    };
    
    // Only export the 4 sloped faces, NOT the bottom face
    // (bottom face sits on ground and causes z-fighting)
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
    
    // NO bottom face - it's not visible and causes z-fighting with ground
    
    return { vertices, indices };
}

function generateStairsGeometryExport(numSteps = 3, stepHeight = 0.4, stepDepth = 1.0, stepWidth = 3.0) {
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
    // Ground plane with TOP surface at Y=0 (skating surface)
    // Box height is 0.5, center at -0.25 puts top at 0
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

function generateManualPadGeometry(width, height, depth) {
    return generateBoxGeometry(width, height, depth, 0, height / 2, 0);
}

function generateBenchGeometry(props) {
    const allVertices = [];
    const allIndices = [];
    
    // Wood brown color for bench
    const woodColor = props && props.color ? hexToRgb(props.color) : { r: 139, g: 90, b: 43 };
    const metalColor = { r: 60, g: 60, b: 60 };
    
    // Seat - wood color
    const seat = generateBoxGeometry(2.0, 0.1, 0.5, 0, 0.5, 0);
    seat.vertices.forEach(v => { v.r = woodColor.r; v.g = woodColor.g; v.b = woodColor.b; });
    allVertices.push(...seat.vertices);
    allIndices.push(...seat.indices);
    
    // Legs - metal color
    for (const xOff of [-0.8, 0.8]) {
        const base = allVertices.length;
        const leg = generateBoxGeometry(0.1, 0.5, 0.5, xOff, 0.25, 0);
        leg.vertices.forEach(v => { v.r = metalColor.r; v.g = metalColor.g; v.b = metalColor.b; });
        allVertices.push(...leg.vertices);
        allIndices.push(...leg.indices.map(i => i + base));
    }
    
    return { vertices: allVertices, indices: allIndices };
}

function generateTrashCanGeometry(radius, height, props) {
    const trashColor = props && props.color ? hexToRgb(props.color) : { r: 80, g: 80, b: 80 }; // Gray
    const geo = generateBoxGeometry(radius * 2, height, radius * 2, 0, height / 2, 0);
    geo.vertices.forEach(v => { v.r = trashColor.r; v.g = trashColor.g; v.b = trashColor.b; });
    return geo;
}

function generatePicnicTableGeometry() {
    const allVertices = [];
    const allIndices = [];
    
    const woodColor = { r: 139, g: 90, b: 43 }; // Wood brown
    
    // Table top
    const top = generateBoxGeometry(2.0, 0.1, 1.0, 0, 0.75, 0);
    top.vertices.forEach(v => { v.r = woodColor.r; v.g = woodColor.g; v.b = woodColor.b; });
    allVertices.push(...top.vertices);
    allIndices.push(...top.indices);
    
    // Bench 1
    let base = allVertices.length;
    const bench1 = generateBoxGeometry(2.0, 0.1, 0.4, 0, 0.45, 0.6);
    bench1.vertices.forEach(v => { v.r = woodColor.r; v.g = woodColor.g; v.b = woodColor.b; });
    allVertices.push(...bench1.vertices);
    allIndices.push(...bench1.indices.map(i => i + base));
    
    // Bench 2
    base = allVertices.length;
    const bench2 = generateBoxGeometry(2.0, 0.1, 0.4, 0, 0.45, -0.6);
    bench2.vertices.forEach(v => { v.r = woodColor.r; v.g = woodColor.g; v.b = woodColor.b; });
    allVertices.push(...bench2.vertices);
    allIndices.push(...bench2.indices.map(i => i + base));
    
    // Legs
    const metalColor = { r: 60, g: 60, b: 60 };
    for (const xOff of [-0.7, 0.7]) {
        base = allVertices.length;
        const leg = generateBoxGeometry(0.1, 0.75, 1.5, xOff, 0.375, 0);
        leg.vertices.forEach(v => { v.r = metalColor.r; v.g = metalColor.g; v.b = metalColor.b; });
        allVertices.push(...leg.vertices);
        allIndices.push(...leg.indices.map(i => i + base));
    }
    
    return { vertices: allVertices, indices: allIndices };
}

// Export geometry generators that use object props
function getExportGeometry(obj) {
    const type = obj.userData.type;
    
    // Handle custom models (Poly.cam imports)
    if (type === 'custom-model') {
        return extractCustomModelGeometry(obj);
    }
    
    // Handle DIY objects - they already have proper geometry
    if (type === 'diy-object') {
        return extractCustomModelGeometry(obj);
    }
    
    // Handle backdrop objects (imported full maps)
    if (type === 'backdrop') {
        return extractCustomModelGeometry(obj);
    }
    
    // Handle backdrop parts (editable imported map parts)
    if (type === 'backdrop-part') {
        return extractCustomModelGeometry(obj);
    }
    
    // Get props, with fallback for unknown types
    const definition = OBJECT_DEFINITIONS[type];
    if (!definition) {
        console.warn(`⚠️ Unknown object type for export: ${type}, using fallback geometry`);
        return generateBoxGeometry(1, 1, 1);
    }
    
    const props = obj.userData.props || definition.defaultProps;
    
    switch (type) {
        case 'starter-floor':
            // Starter floor is a flat plane - use ground geometry at specified size
            return generateGroundGeometry(props.width || 60);
        case 'ground-flat':
            // Ground centered at origin (matches editor visual)
            // User should position at Y = height/2 to have bottom at Y=0
            return generateBoxGeometry(props.width, props.height, props.depth, 0, 0, 0);
        case 'ground-slope':
            return generateSlopeGeometry(props.length, props.height, props.width);
        case 'quarter-pipe':
            return generateQuarterPipeGeometry(props.radius, props.width);
        case 'half-pipe':
            return generateQuarterPipeGeometry(props.radius, props.width);
        case 'kicker':
            return generateKickerGeometry(props.length, props.height, props.width);
        case 'pyramid':
            return generatePyramidGeometry(props.size, props.height);
        case 'rail-flat':
            return generateRailGeometry(props.length, props.height, props.railRadius);
        case 'rail-down':
            return generateRailGeometry(props.length, (props.startHeight + props.endHeight) / 2, props.railRadius);
        case 'ledge':
            return generateLedgeGeometry(props.length, props.height, props.depth);
        case 'manual-pad':
            return generateManualPadGeometry(props.width, props.height, props.depth);
        case 'stairs-3':
        case 'stairs-5':
        case 'stairs-hubba':
            return generateStairsGeometryExport(props.steps, props.stepHeight, props.stepDepth, props.stepWidth);
        case 'bench':
            return generateBenchGeometry(props);
        case 'trash-can':
            return generateTrashCanGeometry(props.radius, props.height, props);
        case 'wall':
            // Wall with bottom at Y=0
            return generateBoxGeometry(props.width, props.height, props.depth, 0, props.height / 2, 0);
        case 'pillar':
            // Pillar with bottom at Y=0
            return generateBoxGeometry(props.width, props.height, props.depth, 0, props.height / 2, 0);
        case 'beam':
            // Ceiling beam at specified Y position
            return generateBoxGeometry(props.width, props.height, props.depth, 0, props.yPos, 0);
        
        // ==========================================
        // ENVIRONMENT OBJECTS - Export as simple geometry
        // ==========================================
        
        // Vegetation
        // For environment objects, extract actual geometry from the Three.js object
        // This preserves the nice spheres, cylinders, etc. from the editor!
        case 'tree-oak':
        case 'tree-pine':
        case 'tree-palm':
        case 'bush':
        case 'hedge':
        case 'flowers':
        case 'grass-patch':
            return extractThreeJsGeometry(obj);
        
        // Buildings (simplified as boxes)
        case 'building-small':
        case 'building-shop':
        case 'building-garage':
        case 'building-warehouse':
            return extractThreeJsGeometry(obj);
        
        // Street elements
        case 'lamp-post':
        case 'stop-sign':
        case 'traffic-cone':
        case 'barrier':
        case 'fence-wood':
        case 'fence-chainlink':
        case 'fire-hydrant':
            return extractThreeJsGeometry(obj);
        case 'road-segment': {
            const roadColor = { r: 60, g: 60, b: 65 }; // Dark asphalt
            return generateColoredBoxGeometry(props.width || 10, 0.1, props.depth || 10, 0, 0.05, 0, roadColor);
        }
        case 'ground-grass': {
            const grassColor = { r: 80, g: 160, b: 60 }; // Green
            return generateColoredBoxGeometry(props.width || 10, 0.1, props.depth || 10, 0, 0.05, 0, grassColor);
        }
        case 'ground-dirt': {
            const dirtColor = { r: 139, g: 90, b: 43 }; // Brown
            return generateColoredBoxGeometry(props.width || 10, 0.1, props.depth || 10, 0, 0.05, 0, dirtColor);
        }
        case 'ground-water': {
            const waterColor = { r: 50, g: 130, b: 200 }; // Blue
            return generateColoredBoxGeometry(props.width || 10, 0.1, props.depth || 10, 0, 0.05, 0, waterColor);
        }
        
        // Decorations/Props - extract actual geometry from Three.js objects
        case 'dumpster':
        case 'crate':
        case 'barrel':
        case 'parked-car':
        case 'bench':
        case 'trash-can':
        case 'picnic-table':
        case 'basketball-hoop':
        case 'skateboard-rack':
        case 'graffiti-wall':
            return extractThreeJsGeometry(obj);
        
        default:
            console.warn(`⚠️ No export geometry for type: ${type}, using bounding box`);
            return extractBoundingBoxGeometry(obj);
    }
}

// Generate tree geometry for export (simplified as trunk + crown)
function generateTreeGeometry(props) {
    const allVertices = [];
    const allIndices = [];
    
    const trunkH = props.trunkHeight || 3;
    const trunkR = props.trunkRadius || 0.3;
    const crownR = props.crownRadius || 2.5;
    
    // Get colors from props
    const trunkColor = props.trunkColor ? hexToRgb(props.trunkColor) : { r: 92, g: 64, b: 51 }; // Brown
    const leafColor = props.leafColor || props.crownColor;
    const leafColorRgb = leafColor ? hexToRgb(leafColor) : { r: 45, g: 90, b: 39 };  // Green
    
    // Trunk - tapered cylinder approximation (octagonal prism)
    const trunk = generateOctagonalPrism(trunkR, trunkR * 0.7, trunkH, 0, trunkH / 2, 0, trunkColor);
    allVertices.push(...trunk.vertices);
    allIndices.push(...trunk.indices);
    
    // Crown - multiple overlapping shapes for organic look
    // Layer 1: Bottom wide part
    let base = allVertices.length;
    const crown1 = generateOctagonalPrism(crownR * 0.9, crownR * 0.6, crownR * 0.8, 0, trunkH + crownR * 0.4, 0, leafColorRgb);
    allVertices.push(...crown1.vertices);
    allIndices.push(...crown1.indices.map(i => i + base));
    
    // Layer 2: Middle part
    base = allVertices.length;
    const crown2 = generateOctagonalPrism(crownR * 0.7, crownR * 0.4, crownR * 0.7, 0, trunkH + crownR * 1.0, 0, leafColorRgb);
    allVertices.push(...crown2.vertices);
    allIndices.push(...crown2.indices.map(i => i + base));
    
    // Layer 3: Top pointy part
    base = allVertices.length;
    const crown3 = generateOctagonalPrism(crownR * 0.4, crownR * 0.1, crownR * 0.5, 0, trunkH + crownR * 1.5, 0, leafColorRgb);
    allVertices.push(...crown3.vertices);
    allIndices.push(...crown3.indices.map(i => i + base));
    
    return { vertices: allVertices, indices: allIndices };
}

// Generate octagonal prism (approximates cylinder/cone) for export
function generateOctagonalPrism(radiusBottom, radiusTop, height, offsetX, offsetY, offsetZ, color) {
    const vertices = [];
    const indices = [];
    const segments = 8;
    
    // Generate vertices for top and bottom octagons
    for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        
        // Bottom vertex
        vertices.push({
            x: offsetX + cosA * radiusBottom,
            y: offsetY - height / 2,
            z: offsetZ + sinA * radiusBottom,
            nx: cosA, ny: 0, nz: sinA,
            u: i / segments, v: 0,
            r: color.r, g: color.g, b: color.b
        });
        
        // Top vertex
        vertices.push({
            x: offsetX + cosA * radiusTop,
            y: offsetY + height / 2,
            z: offsetZ + sinA * radiusTop,
            nx: cosA, ny: 0, nz: sinA,
            u: i / segments, v: 1,
            r: color.r, g: color.g, b: color.b
        });
    }
    
    // Side faces (quads as 2 triangles each)
    for (let i = 0; i < segments; i++) {
        const i0 = i * 2;           // bottom current
        const i1 = i * 2 + 1;       // top current
        const i2 = ((i + 1) % segments) * 2;      // bottom next
        const i3 = ((i + 1) % segments) * 2 + 1;  // top next
        
        indices.push(i0, i2, i1);
        indices.push(i1, i2, i3);
    }
    
    // Top cap center
    const topCenterIdx = vertices.length;
    vertices.push({
        x: offsetX, y: offsetY + height / 2, z: offsetZ,
        nx: 0, ny: 1, nz: 0,
        u: 0.5, v: 0.5,
        r: color.r, g: color.g, b: color.b
    });
    
    // Top cap triangles
    for (let i = 0; i < segments; i++) {
        const i1 = i * 2 + 1;       // top current
        const i3 = ((i + 1) % segments) * 2 + 1;  // top next
        indices.push(topCenterIdx, i1, i3);
    }
    
    // Bottom cap center
    const bottomCenterIdx = vertices.length;
    vertices.push({
        x: offsetX, y: offsetY - height / 2, z: offsetZ,
        nx: 0, ny: -1, nz: 0,
        u: 0.5, v: 0.5,
        r: color.r, g: color.g, b: color.b
    });
    
    // Bottom cap triangles
    for (let i = 0; i < segments; i++) {
        const i0 = i * 2;           // bottom current
        const i2 = ((i + 1) % segments) * 2;      // bottom next
        indices.push(bottomCenterIdx, i2, i0);
    }
    
    return { vertices, indices };
}

// Generate lamp post geometry for export
function generateLampPostGeometry(props) {
    const allVertices = [];
    const allIndices = [];
    
    const h = props.height || 5;
    const poleColor = props.poleColor ? hexToRgb(props.poleColor) : { r: 50, g: 50, b: 55 }; // Dark gray
    const lightColor = props.lightColor ? hexToRgb(props.lightColor) : { r: 255, g: 240, b: 180 }; // Warm yellow
    const armColor = { r: 45, g: 45, b: 50 }; // Slightly darker
    
    // Pole base (wider at bottom)
    const poleBase = generateOctagonalPrism(0.15, 0.08, h * 0.15, 0, h * 0.075, 0, poleColor);
    allVertices.push(...poleBase.vertices);
    allIndices.push(...poleBase.indices);
    
    // Main pole (tapered)
    let base = allVertices.length;
    const pole = generateOctagonalPrism(0.08, 0.06, h * 0.85, 0, h * 0.15 + h * 0.425, 0, poleColor);
    allVertices.push(...pole.vertices);
    allIndices.push(...pole.indices.map(i => i + base));
    
    // Arm extending out
    base = allVertices.length;
    const arm = generateBoxGeometry(0.8, 0.06, 0.06, 0.35, h, 0);
    arm.vertices.forEach(v => { v.r = armColor.r; v.g = armColor.g; v.b = armColor.b; });
    allVertices.push(...arm.vertices);
    allIndices.push(...arm.indices.map(i => i + base));
    
    // Light fixture (hanging lamp)
    base = allVertices.length;
    const light = generateOctagonalPrism(0.2, 0.15, 0.25, 0.7, h - 0.15, 0, lightColor);
    allVertices.push(...light.vertices);
    allIndices.push(...light.indices.map(i => i + base));
    
    return { vertices: allVertices, indices: allIndices };
}

// Generate sign geometry for export
function generateSignGeometry(props) {
    const allVertices = [];
    const allIndices = [];
    
    const h = props.height || 2.5;
    const poleColor = { r: 80, g: 80, b: 80 }; // Gray pole
    const signColor = { r: 255, g: 0, b: 0 }; // Red sign (stop sign)
    
    // Pole - gray
    const pole = generateBoxGeometry(0.08, h - 0.4, 0.08, 0, (h - 0.4) / 2, 0);
    pole.vertices.forEach(v => { v.r = poleColor.r; v.g = poleColor.g; v.b = poleColor.b; });
    allVertices.push(...pole.vertices);
    allIndices.push(...pole.indices);
    
    // Sign - red
    const base = allVertices.length;
    const sign = generateBoxGeometry(0.6, 0.6, 0.05, 0, h - 0.3, 0);
    sign.vertices.forEach(v => { v.r = signColor.r; v.g = signColor.g; v.b = signColor.b; });
    allVertices.push(...sign.vertices);
    allIndices.push(...sign.indices.map(i => i + base));
    
    return { vertices: allVertices, indices: allIndices };
}

// Generate car geometry for export (simplified box)
function generateCarGeometry(props) {
    const allVertices = [];
    const allIndices = [];
    
    const l = props.length || 4;
    const w = props.width || 1.8;
    const h = props.height || 1.4;
    
    // Get car body color from props
    const bodyColor = props.bodyColor ? hexToRgb(props.bodyColor) : { r: 200, g: 50, b: 50 }; // Default red
    const windowColor = { r: 40, g: 50, b: 70 }; // Dark glass blue-gray
    const wheelColor = { r: 30, g: 30, b: 30 }; // Black
    const trimColor = { r: 60, g: 60, b: 60 }; // Dark gray
    
    // Main body lower (wider at bottom)
    const body = generateBoxGeometry(l, h * 0.4, w, 0, h * 0.2, 0);
    body.vertices.forEach(v => { v.r = bodyColor.r; v.g = bodyColor.g; v.b = bodyColor.b; });
    allVertices.push(...body.vertices);
    allIndices.push(...body.indices);
    
    // Hood (front sloped section)
    let base = allVertices.length;
    const hood = generateBoxGeometry(l * 0.35, h * 0.15, w * 0.95, l * 0.3, h * 0.48, 0);
    hood.vertices.forEach(v => { v.r = bodyColor.r; v.g = bodyColor.g; v.b = bodyColor.b; });
    allVertices.push(...hood.vertices);
    allIndices.push(...hood.indices.map(i => i + base));
    
    // Trunk (rear section)
    base = allVertices.length;
    const trunk = generateBoxGeometry(l * 0.25, h * 0.12, w * 0.95, -l * 0.32, h * 0.46, 0);
    trunk.vertices.forEach(v => { v.r = bodyColor.r; v.g = bodyColor.g; v.b = bodyColor.b; });
    allVertices.push(...trunk.vertices);
    allIndices.push(...trunk.indices.map(i => i + base));
    
    // Cabin/windows (tapered)
    base = allVertices.length;
    const cabin = generateBoxGeometry(l * 0.4, h * 0.35, w * 0.85, -l * 0.05, h * 0.75, 0);
    cabin.vertices.forEach(v => { v.r = windowColor.r; v.g = windowColor.g; v.b = windowColor.b; });
    allVertices.push(...cabin.vertices);
    allIndices.push(...cabin.indices.map(i => i + base));
    
    // Wheels (4 small boxes)
    const wheelR = h * 0.18;
    const wheelPositions = [
        [l * 0.32, wheelR, w * 0.45],
        [l * 0.32, wheelR, -w * 0.45],
        [-l * 0.32, wheelR, w * 0.45],
        [-l * 0.32, wheelR, -w * 0.45]
    ];
    for (const [wx, wy, wz] of wheelPositions) {
        base = allVertices.length;
        const wheel = generateBoxGeometry(wheelR * 1.8, wheelR * 2, wheelR * 0.6, wx, wy, wz);
        wheel.vertices.forEach(v => { v.r = wheelColor.r; v.g = wheelColor.g; v.b = wheelColor.b; });
        allVertices.push(...wheel.vertices);
        allIndices.push(...wheel.indices.map(i => i + base));
    }
    
    // Bumpers
    base = allVertices.length;
    const frontBumper = generateBoxGeometry(0.15, h * 0.15, w * 1.02, l * 0.48, h * 0.1, 0);
    frontBumper.vertices.forEach(v => { v.r = trimColor.r; v.g = trimColor.g; v.b = trimColor.b; });
    allVertices.push(...frontBumper.vertices);
    allIndices.push(...frontBumper.indices.map(i => i + base));
    
    base = allVertices.length;
    const rearBumper = generateBoxGeometry(0.15, h * 0.15, w * 1.02, -l * 0.48, h * 0.1, 0);
    rearBumper.vertices.forEach(v => { v.r = trimColor.r; v.g = trimColor.g; v.b = trimColor.b; });
    allVertices.push(...rearBumper.vertices);
    allIndices.push(...rearBumper.indices.map(i => i + base));
    
    return { vertices: allVertices, indices: allIndices };
}

// Generate cone geometry for export
function generateConeGeometry(radiusBottom, height, x, y, z) {
    // Simplified as a small box
    return generateBoxGeometry(radiusBottom * 2, height, radiusBottom * 2, x, y + height / 2, z);
}

// Generate a solid color texture as base64 PNG
// True Skate uses textures for rendering, so we create simple color textures
function generateSolidColorTexture(r, g, b, size = 64) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Fill with solid color
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(0, 0, size, size);
    
    // Return as base64 data (without the data:image/png;base64, prefix)
    const dataUrl = canvas.toDataURL('image/png');
    return dataUrl.split(',')[1]; // Just the base64 part
}

// Extract actual Three.js geometry from editor objects
// This preserves the nice spheres, cylinders, etc. instead of simplified boxes!
// Returns an array of mesh parts, each with its own geometry and color
function extractThreeJsGeometry(obj) {
    const allVertices = [];
    const allIndices = [];
    
    // Traverse all meshes in the object
    obj.traverse((child) => {
        if (!child.isMesh || !child.geometry) return;
        
        const geo = child.geometry;
        const posAttr = geo.attributes.position;
        const normAttr = geo.attributes.normal;
        const uvAttr = geo.attributes.uv;
        
        if (!posAttr) return;
        
        // Get the mesh's world matrix to transform vertices to local object space
        // (relative to the object's origin, not world origin)
        const meshMatrix = child.matrixWorld.clone();
        const objMatrixInverse = obj.matrixWorld.clone().invert();
        const localMatrix = meshMatrix.premultiply(objMatrixInverse);
        
        // Get color from material
        let r = 200, g = 200, b = 200;
        if (child.material) {
            if (child.material.color) {
                r = Math.round(child.material.color.r * 255);
                g = Math.round(child.material.color.g * 255);
                b = Math.round(child.material.color.b * 255);
            }
        }
        
        const baseIdx = allVertices.length;
        
        // Extract vertices
        for (let i = 0; i < posAttr.count; i++) {
            // Get position and transform to local space
            const pos = new THREE.Vector3(
                posAttr.getX(i),
                posAttr.getY(i),
                posAttr.getZ(i)
            ).applyMatrix4(localMatrix);
            
            // Get normal and transform (rotation only)
            let nx = 0, ny = 1, nz = 0;
            if (normAttr) {
                const norm = new THREE.Vector3(
                    normAttr.getX(i),
                    normAttr.getY(i),
                    normAttr.getZ(i)
                );
                // Apply rotation part of matrix only
                const normalMatrix = new THREE.Matrix3().getNormalMatrix(localMatrix);
                norm.applyMatrix3(normalMatrix).normalize();
                nx = norm.x; ny = norm.y; nz = norm.z;
            }
            
            // Get UVs
            let u = 0, v = 0;
            if (uvAttr) {
                u = uvAttr.getX(i);
                v = uvAttr.getY(i);
            }
            
            allVertices.push({
                x: pos.x, y: pos.y, z: pos.z,
                nx, ny, nz,
                u, v,
                r, g, b
            });
        }
        
        // Extract indices
        if (geo.index) {
            for (let i = 0; i < geo.index.count; i++) {
                allIndices.push(baseIdx + geo.index.getX(i));
            }
        } else {
            // Non-indexed geometry - create sequential indices
            for (let i = 0; i < posAttr.count; i++) {
                allIndices.push(baseIdx + i);
            }
        }
    });
    
    if (allVertices.length === 0) {
        console.warn('extractThreeJsGeometry: No geometry found, using bounding box fallback');
        return extractBoundingBoxGeometry(obj);
    }
    
    return { vertices: allVertices, indices: allIndices };
}

// Extract geometry as SEPARATE MESHES for multi-part objects (trees, cars, etc.)
// Each mesh part gets its own material/texture
function extractThreeJsGeometryMultiPart(obj) {
    const meshParts = [];
    
    obj.traverse((child) => {
        if (!child.isMesh || !child.geometry) return;
        
        const geo = child.geometry;
        const posAttr = geo.attributes.position;
        const normAttr = geo.attributes.normal;
        const uvAttr = geo.attributes.uv;
        
        if (!posAttr) return;
        
        const meshMatrix = child.matrixWorld.clone();
        const objMatrixInverse = obj.matrixWorld.clone().invert();
        const localMatrix = meshMatrix.premultiply(objMatrixInverse);
        
        // Get color from material
        let r = 200, g = 200, b = 200;
        if (child.material && child.material.color) {
            r = Math.round(child.material.color.r * 255);
            g = Math.round(child.material.color.g * 255);
            b = Math.round(child.material.color.b * 255);
        }
        
        const vertices = [];
        const indices = [];
        
        // Extract vertices
        for (let i = 0; i < posAttr.count; i++) {
            const pos = new THREE.Vector3(
                posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)
            ).applyMatrix4(localMatrix);
            
            let nx = 0, ny = 1, nz = 0;
            if (normAttr) {
                const norm = new THREE.Vector3(
                    normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i)
                );
                const normalMatrix = new THREE.Matrix3().getNormalMatrix(localMatrix);
                norm.applyMatrix3(normalMatrix).normalize();
                nx = norm.x; ny = norm.y; nz = norm.z;
            }
            
            let u = 0, v = 0;
            if (uvAttr) {
                u = uvAttr.getX(i);
                v = uvAttr.getY(i);
            }
            
            vertices.push({ x: pos.x, y: pos.y, z: pos.z, nx, ny, nz, u, v, r, g, b });
        }
        
        // Extract indices
        if (geo.index) {
            for (let i = 0; i < geo.index.count; i++) {
                indices.push(geo.index.getX(i));
            }
        } else {
            for (let i = 0; i < posAttr.count; i++) {
                indices.push(i);
            }
        }
        
        if (vertices.length > 0) {
            meshParts.push({
                vertices,
                indices,
                color: { r, g, b }
            });
        }
    });
    
    return meshParts;
}

// Extract bounding box geometry as fallback
function extractBoundingBoxGeometry(obj) {
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    // Use bounding box dimensions
    return generateBoxGeometry(
        Math.max(size.x, 0.1), 
        Math.max(size.y, 0.1), 
        Math.max(size.z, 0.1),
        0, size.y / 2, 0  // Bottom at Y=0
    );
}

// Extract geometry from custom Poly.cam models with colors and textures
function extractCustomModelGeometry(obj) {
    const allVertices = [];
    const allIndices = [];
    const meshMaterials = []; // Track which materials are used
    
    // Traverse all meshes in the model
    obj.traverse((child) => {
        if (child.isMesh && child.geometry) {
            const geo = child.geometry;
            const baseIndex = allVertices.length;
            
            // Get world matrix for this mesh (includes parent transforms)
            child.updateWorldMatrix(true, false);
            const worldMatrix = child.matrixWorld.clone();
            
            // Remove the root object's transform (we apply that separately in transformVertex)
            const rootInverse = new THREE.Matrix4().copy(obj.matrixWorld).invert();
            worldMatrix.premultiply(rootInverse);
            
            // Normal matrix for transforming normals
            const normalMatrix = new THREE.Matrix3().getNormalMatrix(worldMatrix);
            
            // Get attributes
            const position = geo.attributes.position;
            const normal = geo.attributes.normal;
            const uv = geo.attributes.uv;
            const color = geo.attributes.color; // Vertex colors (common in Poly.cam)
            
            // Get material color - this is PRIMARY for SketchUp models
            let matColor = { r: 200, g: 200, b: 200 };
            if (child.material) {
                const mat = Array.isArray(child.material) ? child.material[0] : child.material;
                if (mat) {
                    // Try to get color from various material properties
                    if (mat.color) {
                        matColor = {
                            r: Math.round(mat.color.r * 255),
                            g: Math.round(mat.color.g * 255),
                            b: Math.round(mat.color.b * 255)
                        };
                    } else if (mat.emissive) {
                        // Some materials use emissive instead
                        matColor = {
                            r: Math.round(mat.emissive.r * 255),
                            g: Math.round(mat.emissive.g * 255),
                            b: Math.round(mat.emissive.b * 255)
                        };
                    }
                    
                    // Track texture name if available
                    let textureName = null;
                    if (mat.map && mat.map.image) {
                        // Try to get texture filename from source
                        if (mat.map.image.src) {
                            textureName = mat.map.image.src.split('/').pop().split('?')[0];
                        } else if (mat.map.name) {
                            textureName = mat.map.name;
                        }
                    }
                    
                    // Log material info for debugging
                    console.log(`🎨 Material: color=(${matColor.r},${matColor.g},${matColor.b})`, 
                        textureName ? `texture=${textureName}` : 'no texture',
                        mat.vertexColors ? 'has vertex colors' : 'no vertex colors');
                    
                    meshMaterials.push({ material: mat, textureName: textureName, color: matColor });
                }
            } else {
                meshMaterials.push({ material: null, textureName: null, color: matColor });
            }
            
            // Extract vertices
            for (let i = 0; i < position.count; i++) {
                const pos = new THREE.Vector3(
                    position.getX(i),
                    position.getY(i),
                    position.getZ(i)
                );
                
                // Apply local transforms
                pos.applyMatrix4(worldMatrix);
                
                // Get normal
                let nx = 0, ny = 1, nz = 0;
                if (normal) {
                    const n = new THREE.Vector3(
                        normal.getX(i),
                        normal.getY(i),
                        normal.getZ(i)
                    );
                    n.applyMatrix3(normalMatrix).normalize();
                    nx = n.x;
                    ny = n.y;
                    nz = n.z;
                }
                
                // Get UV
                let u = 0, v = 0;
                if (uv) {
                    u = uv.getX(i);
                    v = uv.getY(i);
                }
                
                // Get vertex color (Poly.cam photogrammetry often uses these)
                let r = matColor.r, g = matColor.g, b = matColor.b;
                if (color) {
                    r = Math.round(color.getX(i) * 255);
                    g = Math.round(color.getY(i) * 255);
                    b = Math.round(color.getZ(i) * 255);
                }
                
                allVertices.push({
                    x: pos.x,
                    y: pos.y,
                    z: pos.z,
                    nx: nx,
                    ny: ny,
                    nz: nz,
                    u: u,
                    v: v,
                    r: r,
                    g: g,
                    b: b,
                    a: 255
                });
            }
            
            // Extract indices
            if (geo.index) {
                for (let i = 0; i < geo.index.count; i++) {
                    allIndices.push(geo.index.getX(i) + baseIndex);
                }
            } else {
                // Non-indexed geometry
                for (let i = 0; i < position.count; i++) {
                    allIndices.push(i + baseIndex);
                }
            }
        }
    });
    
    // If no geometry found, return a placeholder box
    if (allVertices.length === 0) {
        console.warn('No geometry found in custom model, using placeholder');
        return generateBoxGeometry(1, 1, 1);
    }
    
    return { vertices: allVertices, indices: allIndices, materials: meshMaterials };
}

/**
 * Generate simplified collision mesh for complex custom models
 * Uses grid-based vertex decimation to preserve shape while reducing complexity
 */
function generateSimplifiedCollision(vertices, indices, targetVertices = 300) {
    const originalCount = vertices.length;
    
    // Find bounding box
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    
    for (const v of vertices) {
        minX = Math.min(minX, v.x);
        minY = Math.min(minY, v.y);
        minZ = Math.min(minZ, v.z);
        maxX = Math.max(maxX, v.x);
        maxY = Math.max(maxY, v.y);
        maxZ = Math.max(maxZ, v.z);
    }
    
    // Calculate grid size based on target vertex count
    // We want roughly targetVertices in a 3D grid
    const sizeX = maxX - minX;
    const sizeY = maxY - minY;
    const sizeZ = maxZ - minZ;
    const volume = sizeX * sizeY * sizeZ;
    
    // Grid cells per axis (aim for ~sqrt3(targetVertices) cells per axis)
    const cellsPerAxis = Math.max(4, Math.ceil(Math.pow(targetVertices, 1/3)));
    const cellSizeX = sizeX / cellsPerAxis;
    const cellSizeY = sizeY / cellsPerAxis;
    const cellSizeZ = sizeZ / cellsPerAxis;
    
    console.log(`🔷 Grid simplification: ${cellsPerAxis}x${cellsPerAxis}x${cellsPerAxis} cells`);
    
    // Group vertices into grid cells, keep one representative per cell
    const grid = new Map(); // "cellX,cellY,cellZ" -> vertex
    
    for (const v of vertices) {
        const cellX = Math.floor((v.x - minX) / cellSizeX);
        const cellY = Math.floor((v.y - minY) / cellSizeY);
        const cellZ = Math.floor((v.z - minZ) / cellSizeZ);
        const key = `${cellX},${cellY},${cellZ}`;
        
        if (!grid.has(key)) {
            grid.set(key, { x: v.x, y: v.y, z: v.z, count: 1 });
        } else {
            // Average position for vertices in same cell
            const existing = grid.get(key);
            const n = existing.count;
            existing.x = (existing.x * n + v.x) / (n + 1);
            existing.y = (existing.y * n + v.y) / (n + 1);
            existing.z = (existing.z * n + v.z) / (n + 1);
            existing.count++;
        }
    }
    
    // Convert grid to vertex array
    const simplifiedVerts = [];
    const vertexIndexMap = new Map();
    let idx = 0;
    
    for (const [key, v] of grid) {
        simplifiedVerts.push({ x: v.x, y: v.y, z: v.z });
        vertexIndexMap.set(key, idx++);
    }
    
    // If we still have too many vertices, use bounding box fallback
    if (simplifiedVerts.length > 500) {
        console.log(`⚠️ Grid still has ${simplifiedVerts.length} vertices, using convex hull approach`);
        return generateConvexHullCollision(vertices);
    }
    
    // Generate triangles by connecting nearby vertices
    // Use Delaunay-like approach: for each original triangle, map to simplified vertices
    const simplifiedIndices = [];
    const addedTriangles = new Set();
    
    for (let i = 0; i < indices.length; i += 3) {
        const v0 = vertices[indices[i]];
        const v1 = vertices[indices[i + 1]];
        const v2 = vertices[indices[i + 2]];
        
        // Map original vertices to grid cells
        const getKey = (v) => {
            const cellX = Math.floor((v.x - minX) / cellSizeX);
            const cellY = Math.floor((v.y - minY) / cellSizeY);
            const cellZ = Math.floor((v.z - minZ) / cellSizeZ);
            return `${cellX},${cellY},${cellZ}`;
        };
        
        const idx0 = vertexIndexMap.get(getKey(v0));
        const idx1 = vertexIndexMap.get(getKey(v1));
        const idx2 = vertexIndexMap.get(getKey(v2));
        
        // Skip degenerate triangles (all vertices in same cell)
        if (idx0 === idx1 || idx1 === idx2 || idx0 === idx2) continue;
        
        // Avoid duplicate triangles
        const triKey = [idx0, idx1, idx2].sort().join(',');
        if (addedTriangles.has(triKey)) continue;
        addedTriangles.add(triKey);
        
        simplifiedIndices.push(idx0, idx1, idx2);
    }
    
    // If no valid triangles, fall back to convex hull
    if (simplifiedIndices.length < 9) {
        console.log(`⚠️ No valid triangles after simplification, using convex hull`);
        return generateConvexHullCollision(vertices);
    }
    
    console.log(`✅ Simplified collision: ${originalCount} → ${simplifiedVerts.length} vertices, ${simplifiedIndices.length / 3} triangles`);
    
    return {
        vertices: simplifiedVerts,
        indices: simplifiedIndices,
        isRamp: true // Use ramp physics for smooth transitions
    };
}

/**
 * Generate convex hull collision as fallback
 * Creates a simple enclosing shape from extreme points
 */
function generateConvexHullCollision(vertices) {
    // Find extreme points (6 points: min/max of each axis)
    let minX = { x: Infinity }, maxX = { x: -Infinity };
    let minY = { y: Infinity }, maxY = { y: -Infinity };
    let minZ = { z: Infinity }, maxZ = { z: -Infinity };
    
    for (const v of vertices) {
        if (v.x < minX.x) minX = v;
        if (v.x > maxX.x) maxX = v;
        if (v.y < minY.y) minY = v;
        if (v.y > maxY.y) maxY = v;
        if (v.z < minZ.z) minZ = v;
        if (v.z > maxZ.z) maxZ = v;
    }
    
    // Create vertices from extreme points (removing duplicates)
    const extremePoints = [minX, maxX, minY, maxY, minZ, maxZ];
    const uniqueVerts = [];
    const seen = new Set();
    
    for (const v of extremePoints) {
        const key = `${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueVerts.push({ x: v.x, y: v.y, z: v.z });
        }
    }
    
    // Add more points for better coverage (sample evenly spaced vertices)
    const step = Math.max(1, Math.floor(vertices.length / 20));
    for (let i = 0; i < vertices.length; i += step) {
        const v = vertices[i];
        const key = `${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)}`;
        if (!seen.has(key) && uniqueVerts.length < 50) {
            seen.add(key);
            uniqueVerts.push({ x: v.x, y: v.y, z: v.z });
        }
    }
    
    // Generate triangles using convex hull approach (simple fan from centroid)
    const centroid = { x: 0, y: 0, z: 0 };
    for (const v of uniqueVerts) {
        centroid.x += v.x;
        centroid.y += v.y;
        centroid.z += v.z;
    }
    centroid.x /= uniqueVerts.length;
    centroid.y /= uniqueVerts.length;
    centroid.z /= uniqueVerts.length;
    
    // Add centroid as vertex
    const centroidIdx = uniqueVerts.length;
    uniqueVerts.push(centroid);
    
    // Create triangles from each pair of adjacent vertices to centroid
    const indices = [];
    for (let i = 0; i < centroidIdx; i++) {
        for (let j = i + 1; j < centroidIdx; j++) {
            indices.push(i, j, centroidIdx);
        }
    }
    
    console.log(`✅ Convex hull collision: ${vertices.length} → ${uniqueVerts.length} vertices, ${indices.length / 3} triangles`);
    
    return {
        vertices: uniqueVerts,
        indices: indices,
        isRamp: true
    };
}

/**
 * Legacy bounding box collision (simplest fallback)
 */
function generateBoundingBoxCollision(vertices) {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    
    for (const v of vertices) {
        minX = Math.min(minX, v.x);
        minY = Math.min(minY, v.y);
        minZ = Math.min(minZ, v.z);
        maxX = Math.max(maxX, v.x);
        maxY = Math.max(maxY, v.y);
        maxZ = Math.max(maxZ, v.z);
    }
    
    const boxVerts = [
        { x: minX, y: minY, z: minZ },
        { x: maxX, y: minY, z: minZ },
        { x: maxX, y: minY, z: maxZ },
        { x: minX, y: minY, z: maxZ },
        { x: minX, y: maxY, z: minZ },
        { x: maxX, y: maxY, z: minZ },
        { x: maxX, y: maxY, z: maxZ },
        { x: minX, y: maxY, z: maxZ },
    ];
    
    const boxIndices = [
        0, 2, 1, 0, 3, 2,
        4, 5, 6, 4, 6, 7,
        3, 6, 2, 3, 7, 6,
        0, 1, 5, 0, 5, 4,
        0, 4, 7, 0, 7, 3,
        1, 2, 6, 1, 6, 5
    ];
    
    console.log(`📦 Bounding box collision: 8 vertices, 12 triangles`);
    
    return {
        vertices: boxVerts,
        indices: boxIndices,
        isRamp: false
    };
}

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
        u: v.u, v: v.v,
        // Preserve vertex colors
        r: v.r, g: v.g, b: v.b, a: v.a
    };
}

// Transform collision vertex with full 3D rotation
function transformCollisionVertex(v, pos, rotation, scale) {
    let x = v.x * scale;
    let y = v.y * scale;
    let z = v.z * scale;
    
    // Support both old (single rotY number) and new (full rotation object) formats
    // NOTE: Do NOT negate Y rotation - this was causing objects to face 180° opposite in-game
    const rotX = typeof rotation === 'object' ? rotation.x : 0;
    const rotY = typeof rotation === 'object' ? rotation.y : rotation;
    const rotZ = typeof rotation === 'object' ? rotation.z : 0;
    
    // Build rotation matrix
    const cx = Math.cos(rotX), sx = Math.sin(rotX);
    const cy = Math.cos(rotY), sy = Math.sin(rotY);
    const cz = Math.cos(rotZ), sz = Math.sin(rotZ);
    
    const r00 = cy * cz;
    const r01 = sx * sy * cz - cx * sz;
    const r02 = cx * sy * cz + sx * sz;
    const r10 = cy * sz;
    const r11 = sx * sy * sz + cx * cz;
    const r12 = cx * sy * sz - sx * cz;
    const r20 = -sy;
    const r21 = sx * cy;
    const r22 = cx * cy;
    
    const newX = r00 * x + r01 * y + r02 * z;
    const newY = r10 * x + r11 * y + r12 * z;
    const newZ = r20 * x + r21 * y + r22 * z;
    
    return {
        x: (newX + pos.x) * TS_SCALE,
        y: (newY + pos.y) * TS_SCALE,
        z: (newZ + pos.z) * TS_SCALE
    };
}

/**
 * Parse a DIY object COMPLETELY - preserving all original data for perfect export.
 * Only vertex positions are transformed; everything else is kept verbatim.
 */
// Smart line parser - keeps section markers, strips inline comments
function parseLineSmartly(line) {
    const trimmed = line.trim();
    // Keep lines that START with # (section markers like #Material, #Color, etc.)
    if (trimmed.startsWith('#')) {
        return trimmed;
    }
    // For value lines, strip inline comments (e.g., "255 #r" -> "255")
    return trimmed.split('#')[0].trim();
}

function parseDIYObjectComplete(content, position, rotation, scale) {
    const lines = content.split('\n');
    // Smart parsing: keeps #Material etc, strips "255 #r" -> "255"
    const parsedLines = lines.map(parseLineSmartly);
    let lineIndex = 0;
    
    // Support both old (single rotationY number) and new (full rotation object) formats
    // NOTE: Do NOT negate Y rotation - this was causing objects to face 180° opposite in-game
    // The editor and True Skate use the same rotation direction for Y axis
    const rotX = typeof rotation === 'object' ? rotation.x : 0;
    const rotY = typeof rotation === 'object' ? rotation.y : rotation;
    const rotZ = typeof rotation === 'object' ? rotation.z : 0;
    
    // Skip header (84, 65, 83, 75 = "TASK")
    lineIndex = 4;
    
    // Version
    const version = parseInt(parsedLines[lineIndex++]);
    
    // Find <VIS section
    while (lineIndex < parsedLines.length && !parsedLines[lineIndex].startsWith('<VIS')) {
        lineIndex++;
    }
    if (lineIndex >= parsedLines.length) return null;
    lineIndex++; // Skip <VIS line
    
    const unknown1 = parseInt(parsedLines[lineIndex++]);
    const numTextures = parseInt(parsedLines[lineIndex++]);
    
    // Read texture names
    const textureNames = [];
    for (let i = 0; i < numTextures; i++) {
        textureNames.push(parsedLines[lineIndex++]);
    }
    
    const numMaterials = parseInt(parsedLines[lineIndex++]);
    
    // ROBUST APPROACH: Find #Num Vertices marker to determine where materials end
    // This handles variations in material format (different fields, comments, etc.)
    let numVerticesMarkerLine = -1;
    let numMeshesMarkerLine = -1;
    let firstMeshHeaderLine = -1;
    for (let i = lineIndex; i < parsedLines.length; i++) {
        const line = parsedLines[i];
        // Look for a line that contains just a number followed by #Num Vertices or similar
        // OR is just before #Mesh (the mesh count line)
        if (line && line.includes('#Num Vertices')) {
            numVerticesMarkerLine = i;
        }
        if (line === '#Mesh' && firstMeshHeaderLine === -1) {
            firstMeshHeaderLine = i;
            // The mesh count is 1 line before #Mesh, vertices count is 2 lines before
            if (numVerticesMarkerLine === -1 && i >= 2) {
                numVerticesMarkerLine = i - 2;
                numMeshesMarkerLine = i - 1;
            }
            break;
        }
    }
    
    // Parse materials using marker-based approach
    // Read material blocks until we reach numVerticesMarkerLine
    const materialData = [];
    const materialEndLine = numVerticesMarkerLine !== -1 ? numVerticesMarkerLine : firstMeshHeaderLine - 2;
    
    for (let m = 0; m < numMaterials; m++) {
        const mat = {
            rawLines: [],
            textureIndices: []
        };
        
        // Read lines until we hit #Num Layers (or a number followed by lines that are texture indices)
        // Material structure: #Material, values..., numLayers, texIdx, texIdx, ...
        if (parsedLines[lineIndex] !== '#Material') {
            console.warn(`⚠️ Expected #Material at line ${lineIndex}, got: "${parsedLines[lineIndex]}"`);
            // Try to find next #Material
            while (lineIndex < materialEndLine && parsedLines[lineIndex] !== '#Material') {
                lineIndex++;
            }
        }
        
        if (parsedLines[lineIndex] === '#Material') {
        mat.rawLines.push(parsedLines[lineIndex++]); // #Material
            
            // Read lines until we find #Num Layers or next #Material or end of materials section
            // TRUE SKATE MATERIALS HAVE ~35-38 LINES BEFORE numLayers
            // We must read at least 30 lines before considering something as numLayers
            const MIN_MATERIAL_LINES = 30;
            
            while (lineIndex < materialEndLine) {
                const line = parsedLines[lineIndex];
                
                // Only check for numLayers AFTER reading enough material properties
                // This prevents us from misidentifying early color values like "1" as numLayers
                if (mat.rawLines.length >= MIN_MATERIAL_LINES) {
                    // Check if this is numLayers line (a small integer 1-9)
                    const maybeNumLayers = parseInt(line);
                    
                    // Peek ahead to see if next lines are texture indices (small numbers 0-99)
                    if (!isNaN(maybeNumLayers) && maybeNumLayers >= 1 && maybeNumLayers <= 9) {
                        // Check if next few lines are also small integers (texture indices, typically 0-99)
                        let looksLikeNumLayers = true;
                        for (let check = 1; check <= maybeNumLayers && check < 5; check++) {
                            if (lineIndex + check >= parsedLines.length) {
                                looksLikeNumLayers = false;
                                break;
                            }
                            const nextLine = parsedLines[lineIndex + check];
                            const nextVal = parseInt(nextLine);
                            // Texture indices are typically 0-99, not 255 (color values)
                            if (isNaN(nextVal) || nextLine.startsWith('#') || nextVal > 99) {
                                looksLikeNumLayers = false;
                                break;
                            }
                        }
                        
                        if (looksLikeNumLayers) {
                            // This is numLayers
                            const numLayers = maybeNumLayers;
                            lineIndex++; // Skip numLayers line
        mat.numLayers = numLayers;
        for (let l = 0; l < numLayers; l++) {
            mat.textureIndices.push(parseInt(parsedLines[lineIndex++]));
                            }
                            break;
                        }
                    }
                }
                
                // Not numLayers yet, add to raw lines
                mat.rawLines.push(parsedLines[lineIndex++]);
                
                // Safety: check if we hit next #Material
                if (parsedLines[lineIndex] === '#Material') {
                    console.warn(`⚠️ Hit next #Material without finding numLayers for material ${m}`);
                    mat.numLayers = 3;
                    mat.textureIndices = [0, 0, 0];
                    break;
                }
            }
        }
        
        materialData.push(mat);
    }
    
    // Find total vertices and numMeshes using markers
    // Look for the line right before #Mesh
    let totalVertices = 0;
    let numMeshes = 0;
    
    if (firstMeshHeaderLine !== -1 && firstMeshHeaderLine >= 2) {
        // The two lines before #Mesh should be totalVertices and numMeshes
        totalVertices = parseInt(parsedLines[firstMeshHeaderLine - 2]) || 0;
        numMeshes = parseInt(parsedLines[firstMeshHeaderLine - 1]) || 0;
    } else {
        // Fallback: use sequential parsing (might fail on some files)
        totalVertices = parseInt(parsedLines[lineIndex++]) || 0;
        numMeshes = parseInt(parsedLines[lineIndex++]) || 0;
    }
    
    // Move lineIndex to first #Mesh
    lineIndex = firstMeshHeaderLine !== -1 ? firstMeshHeaderLine : lineIndex;
    
    console.log(`🔧 parseDIYObjectComplete: ${numTextures} textures, ${numMaterials} materials, ${numMeshes} meshes, ${totalVertices} vertices`);
    
    // Read mesh headers
    const meshHeaders = [];
    for (let m = 0; m < numMeshes; m++) {
        lineIndex++; // #Mesh
        const numIndices = parseInt(parsedLines[lineIndex++]);
        const numVertices = parseInt(parsedLines[lineIndex++]);
        lineIndex++; // #Normals
        const flags = parseInt(parsedLines[lineIndex++]);
        const numColorSets = parseInt(parsedLines[lineIndex++]);
        const numUvSets = parseInt(parsedLines[lineIndex++]);
        meshHeaders.push({ numIndices, numVertices, flags, numColorSets, numUvSets });
    }
    
    // Read and TRANSFORM vertex data
    // Build full 3D rotation matrix (XYZ order, each axis negated for True Skate handedness)
    // Rotation matrix = Rz * Ry * Rx (applied in order: first X, then Y, then Z)
    const cx = Math.cos(rotX), sx = Math.sin(rotX);
    const cy = Math.cos(rotY), sy = Math.sin(rotY);
    const cz = Math.cos(rotZ), sz = Math.sin(rotZ);
    
    // Combined rotation matrix elements (Rz * Ry * Rx)
    const r00 = cy * cz;
    const r01 = sx * sy * cz - cx * sz;
    const r02 = cx * sy * cz + sx * sz;
    const r10 = cy * sz;
    const r11 = sx * sy * sz + cx * cz;
    const r12 = cx * sy * sz - sx * cz;
    const r20 = -sy;
    const r21 = sx * cy;
    const r22 = cx * cy;
    
    const meshVertexData = [];
    for (let m = 0; m < numMeshes; m++) {
        const header = meshHeaders[m];
        lineIndex++; // #Mesh Vertices
        
        const vertices = [];
        for (let v = 0; v < header.numVertices; v++) {
            // Read position
            const x = parseFloat(parsedLines[lineIndex++]);
            const y = parseFloat(parsedLines[lineIndex++]);
            const z = parseFloat(parsedLines[lineIndex++]);
            
            // Read UVs (keep as-is)
            const uvData = [];
            for (let u = 0; u < header.numUvSets; u++) {
                uvData.push(parsedLines[lineIndex++]); // U
                uvData.push(parsedLines[lineIndex++]); // V
            }
            
            // Read colors (keep as-is)
            const colorData = [];
            for (let c = 0; c < header.numColorSets; c++) {
                colorData.push(parsedLines[lineIndex++]); // R
                colorData.push(parsedLines[lineIndex++]); // G
                colorData.push(parsedLines[lineIndex++]); // B
                colorData.push(parsedLines[lineIndex++]); // A
            }
            
            // Read normal
            const nx = parseFloat(parsedLines[lineIndex++]);
            const ny = parseFloat(parsedLines[lineIndex++]);
            const nz = parseFloat(parsedLines[lineIndex++]);
            
            // TRANSFORM position: scale first
            let tx = x * scale;
            let ty = y * scale;
            let tz = z * scale;
            
            // Apply full 3D rotation (rotation matrix * position)
            const rx = r00 * tx + r01 * ty + r02 * tz;
            const ry = r10 * tx + r11 * ty + r12 * tz;
            const rz = r20 * tx + r21 * ty + r22 * tz;
            
            // Translate (position is in meters, multiply by 100 for TrueSkate units)
            const fx = rx + position.x * TS_SCALE;
            const fy = ry + position.y * TS_SCALE;
            const fz = rz + position.z * TS_SCALE;
            
            // TRANSFORM normal: apply same rotation (no translation or scale)
            const rnx = r00 * nx + r01 * ny + r02 * nz;
            const rny = r10 * nx + r11 * ny + r12 * nz;
            const rnz = r20 * nx + r21 * ny + r22 * nz;
            
            vertices.push({
                position: [fx, fy, fz],
                uvData: uvData,
                colorData: colorData,
                normal: [rnx, rny, rnz]
            });
        }
        meshVertexData.push(vertices);
    }
    
    // Read indices (keep as-is, but we need to track mesh index offsets when combining)
    const meshIndexData = [];
    for (let m = 0; m < numMeshes; m++) {
        const header = meshHeaders[m];
        lineIndex++; // #Mesh Indices
        
        const indices = [];
        for (let i = 0; i < header.numIndices; i++) {
            indices.push(parseInt(parsedLines[lineIndex++]));
        }
        meshIndexData.push(indices);
    }
    
    // Now parse COL section
    while (lineIndex < parsedLines.length && !parsedLines[lineIndex].startsWith('<COL')) {
        lineIndex++;
    }
    
    let colData = null;
    if (lineIndex < parsedLines.length) {
        lineIndex++; // Skip <COL line
        
        const numColVerts = parseInt(parsedLines[lineIndex++]);
        const numPolygons = parseInt(parsedLines[lineIndex++]);
        const numPolyIndices = parseInt(parsedLines[lineIndex++]);
        
        // Skip comment lines and empty lines (like #Vertices header)
        while (lineIndex < parsedLines.length && 
               (parsedLines[lineIndex] === '' || parsedLines[lineIndex].startsWith('#'))) {
            lineIndex++;
        }
        
        // Read and transform collision vertices
        const colVertices = [];
        for (let i = 0; i < numColVerts; i++) {
            // Skip any comment lines that might appear in vertex data
            while (lineIndex < parsedLines.length && parsedLines[lineIndex].startsWith('#')) {
                lineIndex++;
            }
            
            const xLine = parsedLines[lineIndex++];
            const yLine = parsedLines[lineIndex++];
            const zLine = parsedLines[lineIndex++];
            
            const x = parseFloat(xLine);
            const y = parseFloat(yLine);
            const z = parseFloat(zLine);
            
            // Safety check for NaN - skip bad vertices
            if (isNaN(x) || isNaN(y) || isNaN(z)) {
                console.warn(`COL vertex ${i} has NaN: x=${xLine}, y=${yLine}, z=${zLine}`);
                colVertices.push([0, 0, 0]); // Placeholder
                continue;
            }
            
            // Transform: scale first
            let tx = x * scale;
            let ty = y * scale;
            let tz = z * scale;
            
            // Apply full 3D rotation (using same rotation matrix as visual vertices)
            const rx = r00 * tx + r01 * ty + r02 * tz;
            const ry = r10 * tx + r11 * ty + r12 * tz;
            const rz = r20 * tx + r21 * ty + r22 * tz;
            
            const fx = rx + position.x * TS_SCALE;
            
            // Sink DIY collision by 2 True Skate units (≈2cm) to overlap with ground
            // This creates seamless transitions while keeping visual mesh correct
            const DIY_COLLISION_SINK = 2.0;
            const fy = ry + position.y * TS_SCALE - DIY_COLLISION_SINK;
            const fz = rz + position.z * TS_SCALE;
            
            colVertices.push([fx, fy, fz]);
        }
        
        // Skip empty lines and comment lines (like #Polygons header)
        while (lineIndex < parsedLines.length && 
               (parsedLines[lineIndex] === '' || parsedLines[lineIndex].startsWith('#'))) {
            lineIndex++;
        }
        
        // Read polygons (keep as-is)
        const polygons = [];
        for (let i = 0; i < numPolygons; i++) {
            // Skip comment lines
            while (lineIndex < parsedLines.length && parsedLines[lineIndex].startsWith('#')) {
                lineIndex++;
            }
            
            const numSides = parseInt(parsedLines[lineIndex++]);
            const attribute = parseInt(parsedLines[lineIndex++]);
            
            if (isNaN(numSides) || isNaN(attribute)) {
                console.warn(`COL polygon ${i} has invalid numSides=${numSides} or attribute=${attribute}`);
                continue;
            }
            
            const indices = [];
            for (let j = 0; j < numSides; j++) {
                const idx = parseInt(parsedLines[lineIndex++]);
                if (!isNaN(idx)) {
                    indices.push(idx);
                }
            }
            if (indices.length === numSides) {
                polygons.push({ numSides, attribute, indices });
            }
        }
        
        colData = { vertices: colVertices, polygons };
    }
    
    // Parse EDGE section (grindable rails)
    while (lineIndex < parsedLines.length && !parsedLines[lineIndex].startsWith('<EDGE')) {
        lineIndex++;
    }
    
    let edgeData = null;
    if (lineIndex < parsedLines.length) {
        lineIndex++; // Skip <EDGE line
        
        const numEdges = parseInt(parsedLines[lineIndex++]);
        
        if (!isNaN(numEdges) && numEdges > 0) {
            const edges = [];
            for (let i = 0; i < numEdges; i++) {
                const attribute = parseInt(parsedLines[lineIndex++]);
                
                // Start point
                const x1 = parseFloat(parsedLines[lineIndex++]);
                const y1 = parseFloat(parsedLines[lineIndex++]);
                const z1 = parseFloat(parsedLines[lineIndex++]);
                
                // End point
                const x2 = parseFloat(parsedLines[lineIndex++]);
                const y2 = parseFloat(parsedLines[lineIndex++]);
                const z2 = parseFloat(parsedLines[lineIndex++]);
                
                if (!isNaN(attribute) && !isNaN(x1) && !isNaN(y1) && !isNaN(z1) &&
                    !isNaN(x2) && !isNaN(y2) && !isNaN(z2)) {
                    // Transform edge positions: scale first
                    let tx1 = x1 * scale, ty1 = y1 * scale, tz1 = z1 * scale;
                    let tx2 = x2 * scale, ty2 = y2 * scale, tz2 = z2 * scale;
                    
                    // Apply full 3D rotation (using same rotation matrix as vertices)
                    const rx1 = r00 * tx1 + r01 * ty1 + r02 * tz1;
                    const ry1 = r10 * tx1 + r11 * ty1 + r12 * tz1;
                    const rz1 = r20 * tx1 + r21 * ty1 + r22 * tz1;
                    const rx2 = r00 * tx2 + r01 * ty2 + r02 * tz2;
                    const ry2 = r10 * tx2 + r11 * ty2 + r12 * tz2;
                    const rz2 = r20 * tx2 + r21 * ty2 + r22 * tz2;
                    
                    // Translate
                    const fx1 = rx1 + position.x * TS_SCALE;
                    const fy1 = ry1 + position.y * TS_SCALE;
                    const fz1 = rz1 + position.z * TS_SCALE;
                    const fx2 = rx2 + position.x * TS_SCALE;
                    const fy2 = ry2 + position.y * TS_SCALE;
                    const fz2 = rz2 + position.z * TS_SCALE;
                    
                    edges.push({
                        attribute,
                        start: [fx1, fy1, fz1],
                        end: [fx2, fy2, fz2]
                    });
                }
            }
            edgeData = { edges };
            console.log(`🛹 Parsed ${edges.length} grind edges from DIY object`);
        }
    }
    
    return {
        textureNames,
        materials: materialData,
        meshHeaders,
        meshVertexData,
        meshIndexData,
        colData,
        edgeData
    };
}

// Parse VIS section vertices from original DIY object content (for aligned export)
function parseDIYVisualData(content) {
    const lines = content.split('\n').map(l => l.split('#')[0].trim());
    let lineIndex = 0;
    
    // Skip header
    lineIndex = 4;
    
    // Find <VIS section
    while (lineIndex < lines.length && !lines[lineIndex].startsWith('<VIS')) {
        lineIndex++;
    }
    if (lineIndex >= lines.length) return null;
    lineIndex++; // Skip <VIS line
    
    const unknown1 = parseInt(lines[lineIndex++]);
    const numTextures = parseInt(lines[lineIndex++]);
    
    // Read texture names for use in export
    const textureNames = [];
    for (let i = 0; i < numTextures; i++) {
        textureNames.push(lines[lineIndex++]);
    }
    
    const numMaterials = parseInt(lines[lineIndex++]);
    
    // Parse material definitions (preserve for export!)
    const materials = [];
    for (let m = 0; m < numMaterials; m++) {
        lineIndex++; // #Material
        const matType = parseInt(lines[lineIndex++]); // Material Type
        lineIndex++; // #Color
        const colorR = parseInt(lines[lineIndex++]);
        const colorG = parseInt(lines[lineIndex++]);
        const colorB = parseInt(lines[lineIndex++]);
        const colorA = parseInt(lines[lineIndex++]);
        const specular = parseFloat(lines[lineIndex++]);
        const gBlendSharpness = parseFloat(lines[lineIndex++]);
        const gBlendLevel = parseFloat(lines[lineIndex++]);
        const gBlendMode = parseFloat(lines[lineIndex++]);
        lineIndex++; // #G Shadow Color
        const gShadowR = parseInt(lines[lineIndex++]);
        const gShadowG = parseInt(lines[lineIndex++]);
        const gShadowB = parseInt(lines[lineIndex++]);
        const gShadowA = parseInt(lines[lineIndex++]);
        lineIndex++; // #G Highlight Color
        const gHighlightR = parseInt(lines[lineIndex++]);
        const gHighlightG = parseInt(lines[lineIndex++]);
        const gHighlightB = parseInt(lines[lineIndex++]);
        const gHighlightA = parseInt(lines[lineIndex++]);
        const gIgnoreBase = parseFloat(lines[lineIndex++]);
        const gSpecular = parseFloat(lines[lineIndex++]);
        const bBlendSharpness = parseFloat(lines[lineIndex++]);
        const bBlendLevel = parseFloat(lines[lineIndex++]);
        const bBlendMode = parseFloat(lines[lineIndex++]);
        lineIndex++; // #B Shadow Color
        const bShadowR = parseInt(lines[lineIndex++]);
        const bShadowG = parseInt(lines[lineIndex++]);
        const bShadowB = parseInt(lines[lineIndex++]);
        const bShadowA = parseInt(lines[lineIndex++]);
        lineIndex++; // #B Highlight Color
        const bHighlightR = parseInt(lines[lineIndex++]);
        const bHighlightG = parseInt(lines[lineIndex++]);
        const bHighlightB = parseInt(lines[lineIndex++]);
        const bHighlightA = parseInt(lines[lineIndex++]);
        const bIgnoreBase = parseFloat(lines[lineIndex++]);
        const bSpecular = parseFloat(lines[lineIndex++]);
        const numLayers = parseInt(lines[lineIndex++]);
        const layerTextures = [];
        for (let l = 0; l < numLayers; l++) {
            layerTextures.push(parseInt(lines[lineIndex++]));
        }
        
        materials.push({
            type: matType,
            color: { r: colorR, g: colorG, b: colorB, a: colorA },
            specular,
            gBlend: { sharpness: gBlendSharpness, level: gBlendLevel, mode: gBlendMode },
            gShadow: { r: gShadowR, g: gShadowG, b: gShadowB, a: gShadowA },
            gHighlight: { r: gHighlightR, g: gHighlightG, b: gHighlightB, a: gHighlightA },
            gIgnoreBase, gSpecular,
            bBlend: { sharpness: bBlendSharpness, level: bBlendLevel, mode: bBlendMode },
            bShadow: { r: bShadowR, g: bShadowG, b: bShadowB, a: bShadowA },
            bHighlight: { r: bHighlightR, g: bHighlightG, b: bHighlightB, a: bHighlightA },
            bIgnoreBase, bSpecular,
            textures: layerTextures
        });
    }
    
    const totalVertices = parseInt(lines[lineIndex++]);
    const numMeshes = parseInt(lines[lineIndex++]);
    
    // Read mesh headers
    const meshHeaders = [];
    for (let m = 0; m < numMeshes; m++) {
        lineIndex++; // #Mesh
        const numIndices = parseInt(lines[lineIndex++]);
        const numVertices = parseInt(lines[lineIndex++]);
        lineIndex++; // #Normals
        const flags = parseInt(lines[lineIndex++]);
        const numColorSets = parseInt(lines[lineIndex++]);
        const numUvSets = parseInt(lines[lineIndex++]);
        meshHeaders.push({ numIndices, numVertices, flags, numColorSets, numUvSets });
    }
    
    // Read vertices
    const allVertices = [];
    for (let m = 0; m < numMeshes; m++) {
        const header = meshHeaders[m];
        lineIndex++; // #Mesh Vertices
        
        for (let v = 0; v < header.numVertices; v++) {
            const x = parseFloat(lines[lineIndex++]) / TS_SCALE;
            const y = parseFloat(lines[lineIndex++]) / TS_SCALE;
            const z = parseFloat(lines[lineIndex++]) / TS_SCALE;
            
            // Read UVs (use first UV set)
            let u = 0, vCoord = 0;
            for (let uvSet = 0; uvSet < header.numUvSets; uvSet++) {
                const uVal = parseFloat(lines[lineIndex++]);
                const vVal = parseFloat(lines[lineIndex++]);
                if (uvSet === 0) { u = uVal; vCoord = vVal; }
            }
            
            // Read colors - prefer color set 2 (often has shading tints) over set 1 (often white)
            let r = 200, g = 200, b = 200, a = 255;
            let r2 = 200, g2 = 200, b2 = 200, a2 = 255;
            if (header.numColorSets > 0) {
                r = parseInt(lines[lineIndex++]);
                g = parseInt(lines[lineIndex++]);
                b = parseInt(lines[lineIndex++]);
                a = parseInt(lines[lineIndex++]);
            }
            if (header.numColorSets > 1) {
                r2 = parseInt(lines[lineIndex++]);
                g2 = parseInt(lines[lineIndex++]);
                b2 = parseInt(lines[lineIndex++]);
                a2 = parseInt(lines[lineIndex++]);
                // Skip any additional color sets
                for (let c = 2; c < header.numColorSets; c++) {
                    lineIndex += 4;
                }
            }
            // Use color set 2 if set 1 is pure white (common in DIY objects)
            if (r === 255 && g === 255 && b === 255 && (r2 !== 255 || g2 !== 255 || b2 !== 255)) {
                r = r2; g = g2; b = b2; a = a2;
            }
            
            // Read normals
            const nx = parseFloat(lines[lineIndex++]);
            const ny = parseFloat(lines[lineIndex++]);
            const nz = parseFloat(lines[lineIndex++]);
            
            allVertices.push({ x, y, z, r, g, b, a, nx, ny, nz, u, v: vCoord });
        }
    }
    
    // Read indices
    const allIndices = [];
    let vertexOffset = 0;
    for (let m = 0; m < numMeshes; m++) {
        const header = meshHeaders[m];
        lineIndex++; // #Mesh Indices
        
        // Read as triangle strip and convert
        const stripIndices = [];
        for (let i = 0; i < header.numIndices; i++) {
            stripIndices.push(parseInt(lines[lineIndex++]));
        }
        
        // Convert triangle strip to triangle list
        for (let i = 0; i < stripIndices.length - 2; i++) {
            const a = stripIndices[i] + vertexOffset;
            const b = stripIndices[i + 1] + vertexOffset;
            const c = stripIndices[i + 2] + vertexOffset;
            
            if (a === b || b === c || a === c) continue; // Skip degenerate
            
            if (i % 2 === 0) {
                allIndices.push(a, b, c);
            } else {
                allIndices.push(a, c, b);
            }
        }
        
        vertexOffset += header.numVertices;
    }
    
    return { 
        vertices: allVertices, 
        indices: allIndices,
        materials: materials,
        textureNames: textureNames
    };
}

// ============================================================
// TRUE SKATE _mod.json PARSER
// This file uses a non-standard JSON-like format without commas
// We use regex-based parsing to safely extract and update values
// ============================================================

/**
 * Parse True Skate's non-standard _mod.json format
 * Returns an object with all extracted values
 */
function parseModJsonCustom(content) {
    const result = {
        name: null,
        fileName: null,
        startPositions: [],
        skyBox: {},
        specularBox: {},
        skyAngle: 90.0,
        gamma: 1.0,
        colorBackground: { r: 0.5, g: 0.7, b: 1.0 },
        colorLightingDirect: { r: 1.0, g: 0.95, b: 0.9 },
        colorLightingAmbient: { r: 0.4, g: 0.45, b: 0.5 },
        lightDirection: { x: 0, y: 0, z: 0 }
    };
    
    // Extract name
    const nameMatch = content.match(/"name"\s*:\s*"([^"]+)"/);
    if (nameMatch) result.name = nameMatch[1];
    
    // Extract fileName
    const fileNameMatch = content.match(/"fileName"\s*:\s*"([^"]+)"/);
    if (fileNameMatch) result.fileName = fileNameMatch[1];
    
    // Extract skyAngle
    const skyAngleMatch = content.match(/"skyAngle"\s*:\s*([\d.]+)/);
    if (skyAngleMatch) result.skyAngle = parseFloat(skyAngleMatch[1]);
    
    // Extract gamma
    const gammaMatch = content.match(/"gamma"\s*:\s*([\d.]+)/);
    if (gammaMatch) result.gamma = parseFloat(gammaMatch[1]);
    
    // Extract skyBox textures
    const skyBoxKeys = ['skyBoxUp', 'skyBoxForward', 'skyBoxBack', 'skyBoxLeft', 'skyBoxRight', 'skyBoxDown'];
    for (const key of skyBoxKeys) {
        const match = content.match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`));
        if (match) result.skyBox[key] = match[1];
    }
    
    // Extract specularBox textures
    const specBoxKeys = ['specularBoxUp', 'specularBoxForward', 'specularBoxBack', 'specularBoxLeft', 'specularBoxRight', 'specularBoxDown'];
    for (const key of specBoxKeys) {
        const match = content.match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`));
        if (match) result.specularBox[key] = match[1];
    }
    
    // Extract color objects
    const colorBgMatch = content.match(/"colorBackground"\s*:\s*\{\s*"r"\s*:\s*([\d.]+)\s*,\s*"g"\s*:\s*([\d.]+)\s*,\s*"b"\s*:\s*([\d.]+)\s*\}/);
    if (colorBgMatch) {
        result.colorBackground = { r: parseFloat(colorBgMatch[1]), g: parseFloat(colorBgMatch[2]), b: parseFloat(colorBgMatch[3]) };
    }
    
    const colorDirectMatch = content.match(/"colorLightingDirect"\s*:\s*\{\s*"r"\s*:\s*([\d.]+)\s*,\s*"g"\s*:\s*([\d.]+)\s*,\s*"b"\s*:\s*([\d.]+)\s*\}/);
    if (colorDirectMatch) {
        result.colorLightingDirect = { r: parseFloat(colorDirectMatch[1]), g: parseFloat(colorDirectMatch[2]), b: parseFloat(colorDirectMatch[3]) };
    }
    
    const colorAmbientMatch = content.match(/"colorLightingAmbient"\s*:\s*\{\s*"r"\s*:\s*([\d.]+)\s*,\s*"g"\s*:\s*([\d.]+)\s*,\s*"b"\s*:\s*([\d.]+)\s*\}/);
    if (colorAmbientMatch) {
        result.colorLightingAmbient = { r: parseFloat(colorAmbientMatch[1]), g: parseFloat(colorAmbientMatch[2]), b: parseFloat(colorAmbientMatch[3]) };
    }
    
    const lightDirMatch = content.match(/"lightDirection"\s*:\s*\{\s*"x"\s*:\s*([\d.-]+)\s*,\s*"y"\s*:\s*([\d.-]+)\s*,\s*"z"\s*:\s*([\d.-]+)\s*\}/);
    if (lightDirMatch) {
        result.lightDirection = { x: parseFloat(lightDirMatch[1]), y: parseFloat(lightDirMatch[2]), z: parseFloat(lightDirMatch[3]) };
    }
    
    // Extract startPositions - this is the tricky part
    // Format: "startPosition": { "x": N, "y": N, "z": N, "angle": N }
    const spawnRegex = /"startPosition"\s*:\s*\{\s*"x"\s*:\s*([\d.-]+)\s*,\s*"y"\s*:\s*([\d.-]+)\s*,\s*"z"\s*:\s*([\d.-]+)\s*,\s*"angle"\s*:\s*([\d.-]+)\s*\}/g;
    let spawnMatch;
    while ((spawnMatch = spawnRegex.exec(content)) !== null) {
        result.startPositions.push({
            x: parseFloat(spawnMatch[1]),
            y: parseFloat(spawnMatch[2]),
            z: parseFloat(spawnMatch[3]),
            angle: parseFloat(spawnMatch[4])
        });
    }
    
    console.log(`📄 Parsed _mod.json: ${result.startPositions.length} spawn points, gamma=${result.gamma}`);
    return result;
}

/**
 * Update spawn positions in True Skate's _mod.json format
 * Replaces the entire startPositions section while preserving everything else
 * 
 * @param {string} originalContent - Original _mod.json content
 * @param {Array} newSpawns - Array of {x, y, z, angle} spawn positions
 * @returns {string} Updated _mod.json content
 */
function updateModJsonSpawnPositions(originalContent, newSpawns) {
    console.log(`🛹 Updating _mod.json with ${newSpawns.length} spawn points`);
    
    // Detect line ending style (Windows \r\n or Unix \n)
    const lineEnding = originalContent.includes('\r\n') ? '\r\n' : '\n';
    
    // Find the startPositions section: "startPositions": [ ... ],
    const startPosIndex = originalContent.indexOf('"startPositions"');
    if (startPosIndex === -1) {
        console.warn('⚠️ No startPositions found in _mod.json, adding new section');
        // Add startPositions before the first skyBox entry
        const skyBoxIndex = originalContent.indexOf('"skyBox');
        if (skyBoxIndex !== -1) {
            const newSection = generateStartPositionsSection(newSpawns, lineEnding);
            return originalContent.slice(0, skyBoxIndex) + newSection + lineEnding + '\t' + originalContent.slice(skyBoxIndex);
        }
        return originalContent;
    }
    
    // Find the opening [
    const openBracketIndex = originalContent.indexOf('[', startPosIndex);
    if (openBracketIndex === -1) {
        console.warn('⚠️ Malformed startPositions section');
        return originalContent;
    }
    
    // Find the matching closing ]
    let bracketCount = 1;
    let closeBracketIndex = openBracketIndex + 1;
    while (closeBracketIndex < originalContent.length && bracketCount > 0) {
        if (originalContent[closeBracketIndex] === '[') bracketCount++;
        if (originalContent[closeBracketIndex] === ']') bracketCount--;
        closeBracketIndex++;
    }
    
    if (bracketCount !== 0) {
        console.warn('⚠️ Could not find matching ] for startPositions');
        return originalContent;
    }
    
    // Generate new spawn positions content matching EXACT original format
    // Original format: "startPosition": \r\n\t\t\t{ \r\n\t\t\t\t"x": N, ...
    let newSpawnContent = lineEnding;
    for (let i = 0; i < newSpawns.length; i++) {
        const sp = newSpawns[i];
        newSpawnContent += `\t\t\t"startPosition": ${lineEnding}`;
        newSpawnContent += `\t\t\t{${lineEnding}`;
        newSpawnContent += `\t\t\t\t"x": ${sp.x.toFixed(2)},${lineEnding}`;
        newSpawnContent += `\t\t\t\t"y": ${sp.y.toFixed(2)},${lineEnding}`;
        newSpawnContent += `\t\t\t\t"z": ${sp.z.toFixed(2)},${lineEnding}`;
        newSpawnContent += `\t\t\t\t"angle": ${sp.angle.toFixed(1)}${lineEnding}`;
        newSpawnContent += `\t\t\t}`;
        if (i < newSpawns.length - 1) {
            newSpawnContent += `,${lineEnding}`;
        } else {
            newSpawnContent += lineEnding + '\t\t';
        }
    }
    
    // Replace: keep [ and ], replace content between
    const before = originalContent.slice(0, openBracketIndex + 1);
    const after = originalContent.slice(closeBracketIndex - 1); // Keep the ]
    
    const result = before + newSpawnContent + after;
    console.log(`✅ Updated startPositions section (${newSpawns.length} spawns, ${lineEnding === '\r\n' ? 'CRLF' : 'LF'})`);
    return result;
}

/**
 * Generate a new startPositions section for insertion
 */
function generateStartPositionsSection(spawns, lineEnding = '\r\n') {
    let section = `"startPositions": ${lineEnding}\t[${lineEnding}`;
    for (let i = 0; i < spawns.length; i++) {
        const sp = spawns[i];
        section += `\t\t\t"startPosition": ${lineEnding}`;
        section += `\t\t\t{${lineEnding}`;
        section += `\t\t\t\t"x": ${sp.x.toFixed(2)},${lineEnding}`;
        section += `\t\t\t\t"y": ${sp.y.toFixed(2)},${lineEnding}`;
        section += `\t\t\t\t"z": ${sp.z.toFixed(2)},${lineEnding}`;
        section += `\t\t\t\t"angle": ${sp.angle.toFixed(1)}${lineEnding}`;
        section += `\t\t\t}`;
        if (i < spawns.length - 1) section += ',';
        section += lineEnding;
    }
    section += `\t],${lineEnding}`;
    return section;
}

// ============================================================
// GEOMETRY FILE SECTION PARSERS
// For robust parsing of specific sections in True Skate .txt files
// ============================================================

/**
 * Find a section marker in the geometry file and return its line index
 */
function findSectionMarker(lines, marker) {
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === marker || lines[i].includes(marker)) {
            return i;
        }
    }
    return -1;
}

/**
 * Parse the header section (TASK signature + version)
 */
function parseGeometryHeader(lines) {
    // First 4 lines should be 84, 65, 83, 75 (TASK)
    const signature = [
        parseInt(lines[0]),
        parseInt(lines[1]),
        parseInt(lines[2]),
        parseInt(lines[3])
    ];
    
    // Line 5 should be version
    const versionMatch = lines[4].match(/(\d+)\s*#Version/);
    const version = versionMatch ? parseInt(versionMatch[1]) : 1003;
    
    // Line 6 should be <VIS
    const visStart = findSectionMarker(lines, '<VIS');
    
    // Line after <VIS is a number (17 typically)
    const visParam = visStart !== -1 ? parseInt(lines[visStart + 1]) : 17;
    
    return {
        signature,
        version,
        visStart,
        visParam,
        isValid: signature[0] === 84 && signature[1] === 65 && signature[2] === 83 && signature[3] === 75
    };
}

/**
 * Parse texture list from geometry file
 */
function parseTextureList(lines, startLine) {
    const countMatch = lines[startLine].match(/(\d+)\s*#Num Textures/);
    if (!countMatch) return { textures: [], endLine: startLine };
    
    const count = parseInt(countMatch[1]);
    const textures = [];
    
    for (let i = 0; i < count; i++) {
        textures.push(lines[startLine + 1 + i].trim());
    }
    
    return {
        textures,
        endLine: startLine + count
    };
}

/**
 * Parse material definitions from geometry file
 */
function parseMaterialList(lines, startLine) {
    const countMatch = lines[startLine].match(/(\d+)\s*#Num Materials/);
    if (!countMatch) return { materials: [], endLine: startLine };
    
    const count = parseInt(countMatch[1]);
    const materials = [];
    let lineIdx = startLine + 1;
    
    for (let m = 0; m < count; m++) {
        const material = {
            rawLines: [],
            type: 1,
            color: { r: 255, g: 255, b: 255, a: 255 },
            specular: 0.25,
            numLayers: 0,
            textureIndices: []
        };
        
        // Read until next #Material or #Num Vertices
        while (lineIdx < lines.length) {
            const line = lines[lineIdx];
            
            if (line === '#Material' && material.rawLines.length > 0) {
                break; // Start of next material
            }
            if (line.includes('#Num Vertices')) {
                break; // End of materials section
            }
            
            material.rawLines.push(line);
            
            // Parse specific values
            if (line.includes('#Material Type')) {
                material.type = parseInt(line);
            }
            if (line.includes('#Specular') && !line.includes('G ') && !line.includes('B ')) {
                material.specular = parseFloat(line);
            }
            if (line.includes('#Num Layers')) {
                material.numLayers = parseInt(line);
                // Next N lines are texture indices
                for (let t = 0; t < material.numLayers; t++) {
                    lineIdx++;
                    material.textureIndices.push(parseInt(lines[lineIdx]));
                    material.rawLines.push(lines[lineIdx]);
                }
            }
            
            lineIdx++;
        }
        
        materials.push(material);
    }
    
    return {
        materials,
        endLine: lineIdx
    };
}

/**
 * Parse mesh headers from geometry file
 */
function parseMeshHeaders(lines, startLine, numMeshes) {
    const headers = [];
    let lineIdx = startLine;
    
    for (let m = 0; m < numMeshes; m++) {
        // Find next #Mesh
        while (lineIdx < lines.length && lines[lineIdx] !== '#Mesh') {
            if (lines[lineIdx] === '#Mesh Vertices') {
                // Reached vertex data, stop
                return { headers, endLine: lineIdx };
            }
            lineIdx++;
        }
        
        if (lineIdx >= lines.length) break;
        
        lineIdx++; // Skip #Mesh line
        
        const header = {
            numIndices: 0,
            numVertices: 0,
            flags: 1,
            numColorSets: 2,
            numUvSets: 2
        };
        
        // Read header fields
        if (lines[lineIdx].includes('#Num Indices')) {
            header.numIndices = parseInt(lines[lineIdx]);
            lineIdx++;
        }
        if (lines[lineIdx].includes('#Num Vertices')) {
            header.numVertices = parseInt(lines[lineIdx]);
            lineIdx++;
        }
        // Skip #Normals line
        if (lines[lineIdx].includes('#Normals')) lineIdx++;
        if (lines[lineIdx].includes('#Flags')) {
            header.flags = parseInt(lines[lineIdx]);
            lineIdx++;
        }
        if (lines[lineIdx].includes('#Num Colour Sets')) {
            header.numColorSets = parseInt(lines[lineIdx]);
            lineIdx++;
        }
        if (lines[lineIdx].includes('#Num Uv Sets')) {
            header.numUvSets = parseInt(lines[lineIdx]);
            lineIdx++;
        }
        
        headers.push(header);
    }
    
    return { headers, endLine: lineIdx };
}

/**
 * Parse COL (collision) section from geometry file
 */
function parseCollisionSection(lines, startLine) {
    let lineIdx = startLine;
    
    // Skip <COL marker
    if (lines[lineIdx].includes('<COL')) lineIdx++;
    
    // Parse counts
    const numVertices = parseInt(lines[lineIdx++]) || 0;
    const numPolygons = parseInt(lines[lineIdx++]) || 0;
    const numIndices = parseInt(lines[lineIdx++]) || 0;
    
    // Skip #Vertices comment
    if (lines[lineIdx] === '#Vertices' || lines[lineIdx] === '') lineIdx++;
    
    // Read vertices
    const vertices = [];
    for (let v = 0; v < numVertices; v++) {
        const x = parseFloat(lines[lineIdx++]) || 0;
        const y = parseFloat(lines[lineIdx++]) || 0;
        const z = parseFloat(lines[lineIdx++]) || 0;
        vertices.push({ x, y, z });
    }
    
    // Skip #Polygons comment
    while (lineIdx < lines.length && (lines[lineIdx] === '#Polygons' || lines[lineIdx] === '')) {
        lineIdx++;
    }
    
    // Read polygons
    const polygons = [];
    for (let p = 0; p < numPolygons; p++) {
        const numSides = parseInt(lines[lineIdx++]) || 3;
        const attribute = parseInt(lines[lineIdx++]) || 0;
        const indices = [];
        for (let j = 0; j < numSides; j++) {
            indices.push(parseInt(lines[lineIdx++]) || 0);
        }
        polygons.push({ numSides, attribute, indices });
    }
    
    return {
        numVertices,
        numPolygons,
        numIndices,
        vertices,
        polygons,
        endLine: lineIdx
    };
}

/**
 * Parse VOLU (volume) section from geometry file
 */
function parseVoluSection(lines, startLine) {
    const rawLines = [];
    let lineIdx = startLine;
    
    // Copy until closing >
    while (lineIdx < lines.length) {
        rawLines.push(lines[lineIdx]);
        if (lines[lineIdx].trim() === '>') {
            lineIdx++;
            break;
        }
        lineIdx++;
    }
    
    return { rawLines, endLine: lineIdx };
}

/**
 * Parse EDGE section from geometry file (if present)
 */
function parseEdgeSection(lines, startLine) {
    const rawLines = [];
    let lineIdx = startLine;
    
    // Copy until closing >
    while (lineIdx < lines.length) {
        rawLines.push(lines[lineIdx]);
        if (lines[lineIdx].trim() === '>') {
            lineIdx++;
            break;
        }
        lineIdx++;
    }
    
    return { rawLines, endLine: lineIdx };
}

/**
 * Comprehensive geometry file parser
 * Parses all sections and returns structured data
 */
function parseGeometryFileComplete(content) {
    const lines = content.split('\n').map(l => l.trim());
    
    console.log('📊 Parsing geometry file...');
    
    // Parse header
    const header = parseGeometryHeader(lines);
    if (!header.isValid) {
        console.warn('⚠️ Invalid geometry file header');
    }
    
    // Find key markers
    const numTexturesLine = findSectionMarker(lines, '#Num Textures');
    const numMaterialsLine = findSectionMarker(lines, '#Num Materials');
    const numVerticesLine = findSectionMarker(lines, '#Num Vertices');
    const colSectionLine = findSectionMarker(lines, '<COL');
    const voluSectionLine = findSectionMarker(lines, '<VOLU');
    const edgeSectionLine = findSectionMarker(lines, '<EDGE');
    
    // Parse textures
    const textureData = numTexturesLine !== -1 ? 
        parseTextureList(lines, numTexturesLine) : { textures: [], endLine: 0 };
    
    // Parse materials
    const materialData = numMaterialsLine !== -1 ?
        parseMaterialList(lines, numMaterialsLine) : { materials: [], endLine: 0 };
    
    // Get vertex and mesh counts
    const totalVertices = numVerticesLine !== -1 ? parseInt(lines[numVerticesLine]) : 0;
    const numMeshes = numVerticesLine !== -1 ? parseInt(lines[numVerticesLine + 1]) : 0;
    
    // Parse mesh headers
    const meshHeaderData = numVerticesLine !== -1 ?
        parseMeshHeaders(lines, numVerticesLine + 2, numMeshes) : { headers: [], endLine: 0 };
    
    // Parse collision
    const collisionData = colSectionLine !== -1 ?
        parseCollisionSection(lines, colSectionLine) : null;
    
    // Parse VOLU
    const voluData = voluSectionLine !== -1 ?
        parseVoluSection(lines, voluSectionLine) : null;
    
    // Parse EDGE
    const edgeData = edgeSectionLine !== -1 ?
        parseEdgeSection(lines, edgeSectionLine) : null;
    
    const result = {
        header,
        textures: textureData.textures,
        materials: materialData.materials,
        totalVertices,
        numMeshes,
        meshHeaders: meshHeaderData.headers,
        collision: collisionData,
        volu: voluData,
        edge: edgeData,
        // Line indices for reconstruction
        indices: {
            numTextures: numTexturesLine,
            numMaterials: numMaterialsLine,
            numVertices: numVerticesLine,
            colSection: colSectionLine,
            voluSection: voluSectionLine,
            edgeSection: edgeSectionLine,
            meshHeadersEnd: meshHeaderData.endLine
        }
    };
    
    console.log(`📊 Parsed: ${result.textures.length} textures, ${result.materials.length} materials, ${result.numMeshes} meshes, ${result.totalVertices} vertices`);
    if (result.collision) {
        console.log(`📊 Collision: ${result.collision.vertices.length} verts, ${result.collision.polygons.length} polys`);
    }
    
    return result;
}

// Parse COL section from original DIY object content
function parseDIYCollisionData(content) {
    const lines = content.split('\n').map(l => l.split('#')[0].trim());
    let lineIndex = 0;
    
    // Find <COL section
    while (lineIndex < lines.length && !lines[lineIndex].startsWith('<COL')) {
        lineIndex++;
    }
    if (lineIndex >= lines.length) return null;
    lineIndex++; // Skip <COL line
    
    const numVertices = parseInt(lines[lineIndex++]);
    const numPolygons = parseInt(lines[lineIndex++]); // Polygon count
    const numPolyIndices = parseInt(lines[lineIndex++]); // Total indices
    
    // Skip #Vertices comment
    if (lines[lineIndex] === '#Vertices' || lines[lineIndex] === '') lineIndex++;
    
    // Read vertices
    const vertices = [];
    for (let i = 0; i < numVertices; i++) {
        const x = parseFloat(lines[lineIndex++]) / TS_SCALE; // Convert back to meters
        const y = parseFloat(lines[lineIndex++]) / TS_SCALE;
        const z = parseFloat(lines[lineIndex++]) / TS_SCALE;
        vertices.push({ x, y, z });
    }
    
    // Skip #Polygons comment
    if (lines[lineIndex] === '#Polygons' || lines[lineIndex] === '') lineIndex++;
    
    // Read polygons
    const polygons = [];
    for (let i = 0; i < numPolygons; i++) {
        const numSides = parseInt(lines[lineIndex++]);
        const attribute = parseInt(lines[lineIndex++]);
        const indices = [];
        for (let j = 0; j < numSides; j++) {
            indices.push(parseInt(lines[lineIndex++]));
        }
        polygons.push({ numSides, attribute, indices });
    }
    
    return { vertices, polygons };
}

/**
 * Merge user objects into imported True Skate map geometry
 * 
 * TRUE SKATE FILE STRUCTURE (based on Wallenberg analysis):
 * Lines 0-4:     Header (84, 65, 83, 75 = "TASK", then version)
 * Line 5:        <VIS
 * Line 6:        17 (unknown fixed value)
 * Line 7:        NUM #Num Textures
 * Lines 8+:      Texture names (NUM lines)
 * Next line:     NUM #Num Materials
 * Following:     Material definitions (variable length each)
 * Following:     Mesh headers (7 lines each: #Mesh, #Num Indices, #Num Vertices, #Normals, #Flags, #Num Colour Sets, #Num Uv Sets)
 * Following:     #Mesh Vertices blocks (marker + 18 values per vertex * vertex count)
 * Following:     #Mesh Indices blocks (marker + index values)
 * Line:          > (close VIS)
 * Line:          <COL
 * Following:     Collision data
 * Line:          > (close COL)
 */
function mergeUserObjectsIntoImportedGeometry(importedGeometry, builtInMeshes, diyObjects, globalTextureList) {
    console.log('🔀 Merging user objects into imported map geometry...');
    console.log(`   User objects: ${builtInMeshes.length} built-in, ${diyObjects.length} DIY`);
    
    // If no user objects, return original geometry unchanged
    if (builtInMeshes.length === 0 && diyObjects.length === 0) {
        console.log('   No user objects to merge, using original geometry');
        return importedGeometry;
    }
    
    const lines = importedGeometry.split('\n');
    
    // === STEP 1: Find section boundaries ===
    let numTexturesLine = -1;
    let numMaterialsLine = -1;
    let firstMeshHeaderLine = -1;
    let firstMeshVerticesLine = -1;
    let firstMeshIndicesLine = -1;
    let visCloseLine = -1;
    let colStartLine = -1;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.includes('#Num Textures') && numTexturesLine === -1) {
            numTexturesLine = i;
        }
        if (line.includes('#Num Materials') && numMaterialsLine === -1) {
            numMaterialsLine = i;
        }
        if (line === '#Mesh' && firstMeshHeaderLine === -1) {
            firstMeshHeaderLine = i;
        }
        if (line === '#Mesh Vertices' && firstMeshVerticesLine === -1) {
            firstMeshVerticesLine = i;
        }
        if (line === '#Mesh Indices' && firstMeshIndicesLine === -1) {
            firstMeshIndicesLine = i;
        }
        if (line === '<COL' || line === '<COL ') {
            colStartLine = i;
        }
        // VIS close is the > right before <COL
        if ((line === '<COL' || line === '<COL ') && i > 0) {
            // Find the > before this
            for (let j = i - 1; j >= 0; j--) {
                if (lines[j].trim() === '>') {
                    visCloseLine = j;
                    break;
                }
            }
        }
    }
    
    console.log(`   Section boundaries:`);
    console.log(`     #Num Textures:    line ${numTexturesLine}`);
    console.log(`     #Num Materials:   line ${numMaterialsLine}`);
    console.log(`     First #Mesh:      line ${firstMeshHeaderLine}`);
    console.log(`     First Vertices:   line ${firstMeshVerticesLine}`);
    console.log(`     First Indices:    line ${firstMeshIndicesLine}`);
    console.log(`     VIS close (>):    line ${visCloseLine}`);
    console.log(`     <COL:             line ${colStartLine}`);
    
    // Validate we found all markers
    if (numTexturesLine === -1 || numMaterialsLine === -1 || firstMeshHeaderLine === -1 ||
        firstMeshVerticesLine === -1 || firstMeshIndicesLine === -1 || visCloseLine === -1) {
        console.error('❌ Could not find all required section markers!');
        return importedGeometry;
    }
    
    // === STEP 2: Parse original counts ===
    const origNumTextures = parseInt(lines[numTexturesLine]);
    const origNumMaterials = parseInt(lines[numMaterialsLine]);
    
    // Count original meshes by counting #Mesh headers
    let origNumMeshes = 0;
    for (let i = firstMeshHeaderLine; i < firstMeshVerticesLine; i++) {
        if (lines[i].trim() === '#Mesh') origNumMeshes++;
    }
    
    console.log(`   Original counts: ${origNumTextures} textures, ${origNumMaterials} materials, ${origNumMeshes} meshes`);
    
    // === STEP 3: Prepare user object data ===
    const SCALE = 100.0; // Editor uses meters, True Skate uses centimeters
    const textureIndexOffset = origNumTextures;
    
    // Collect all user meshes
    const userMeshes = [];
    
    // Process built-in meshes
    for (const mesh of builtInMeshes) {
        const verts = mesh.vertices;
        const indices = mesh.indices;
        const textureName = mesh.texture || 'white_environment_texture';
        
        // Find or add texture index
        let texIdx = globalTextureList.indexOf(textureName);
        if (texIdx === -1) {
            texIdx = globalTextureList.length;
            globalTextureList.push(textureName);
        }
        texIdx += textureIndexOffset;
        
        userMeshes.push({
            numIndices: indices.length,
            numVertices: verts.length,
            vertices: verts.map(v => ({
                x: v.x * SCALE,
                y: v.y * SCALE,
                z: v.z * SCALE,
                u1: v.u || 0,
                v1: v.v || 0,
                u2: v.u || 0,
                v2: v.v || 0,
                r1: 255, g1: 255, b1: 255, a1: 255,
                r2: 255, g2: 255, b2: 255, a2: 255,
                nx: v.nx || 0,
                ny: v.ny || 1,
                nz: v.nz || 0
            })),
            indices: indices,
            textureIndex: texIdx,
            isGrindable: mesh.type === 'rail' || mesh.type === 'ledge'
        });
    }
    
    // Process DIY objects
    // NOTE: DIY vertices are ALREADY transformed by parseDIYObjectComplete
    // They're in True Skate coordinates (cm), so we don't scale again
    // DIY vertex structure: { position: [x,y,z], uvData: [...], colorData: [...], normal: [nx,ny,nz] }
    for (const diy of diyObjects) {
        if (!diy.parsed || !diy.parsed.meshVertexData) continue;
        
        const meshCount = diy.parsed.meshVertexData.length;
        const materials = diy.parsed.materials || [];
        // Use the textureIndexMap that was built with brightness-modified texture names!
        const diyTextureIndexMap = diy.textureIndexMap || {};
        
        for (let m = 0; m < meshCount; m++) {
            const verts = diy.parsed.meshVertexData[m];
            const indices = diy.parsed.meshIndexData[m];
            
            // Get texture index from material's texture indices
            // The textureIndexMap maps local texture indices to global texture list indices
            // (which includes brightness-modified texture names like "quarter_bake_b300")
            let texIdx = 0;  // Default to first texture
            if (materials[m] && materials[m].textureIndices && materials[m].textureIndices.length > 0) {
                const localTexIdx = materials[m].textureIndices[0];
                // Look up in the brightness-aware textureIndexMap
                if (diyTextureIndexMap[localTexIdx] !== undefined) {
                    texIdx = diyTextureIndexMap[localTexIdx];
                }
            }
            
            // Get the actual texture name for logging
            const textureName = globalTextureList[texIdx] || 'unknown';
            console.log(`   DIY mesh ${m}: texture index = ${texIdx} ("${textureName}")`);
            
            // Add the texture offset for the merged file
            texIdx += textureIndexOffset;
            
            userMeshes.push({
                numIndices: indices.length,
                numVertices: verts.length,
                vertices: verts.map(v => {
                    // DIY vertex structure from parseDIYObjectComplete
                    const pos = v.position || [0, 0, 0];
                    // uvData contains STRINGS, not numbers! Parse them.
                    const uv = v.uvData || [];
                    const color = v.colorData || [];
                    const normal = v.normal || [0, 1, 0];
                    
                    return {
                        x: pos[0], y: pos[1], z: pos[2],
                        u1: parseFloat(uv[0]) || 0, v1: parseFloat(uv[1]) || 0,
                        u2: parseFloat(uv[2]) || parseFloat(uv[0]) || 0, 
                        v2: parseFloat(uv[3]) || parseFloat(uv[1]) || 0,
                        r1: parseInt(color[0]) || 255, g1: parseInt(color[1]) || 255, 
                        b1: parseInt(color[2]) || 255, a1: parseInt(color[3]) || 255,
                        r2: parseInt(color[4]) || 255, g2: parseInt(color[5]) || 255, 
                        b2: parseInt(color[6]) || 255, a2: parseInt(color[7]) || 255,
                        nx: normal[0] || 0, ny: normal[1] || 1, nz: normal[2] || 0
                    };
                }),
                indices: indices,
                textureIndex: texIdx,
                isGrindable: false
            });
        }
    }
    
    console.log(`   User meshes prepared: ${userMeshes.length}`);
    
    // === STEP 4: Build the merged file ===
    const output = [];
    
    // 4a. Copy header up to and including line before #Num Textures
    for (let i = 0; i < numTexturesLine; i++) {
        output.push(lines[i]);
    }
    
    // 4b. Write new texture count
    const newTextureCount = origNumTextures + globalTextureList.length;
    output.push(`${newTextureCount} #Num Textures`);
    
    // 4c. Copy original textures
    for (let i = numTexturesLine + 1; i < numTexturesLine + 1 + origNumTextures; i++) {
        output.push(lines[i]);
    }
    
    // 4d. Add new textures
    for (const tex of globalTextureList) {
        output.push(tex);
    }
    
    // 4e. Write new material count
    const newMaterialCount = origNumMaterials + userMeshes.length;
    output.push(`${newMaterialCount} #Num Materials`);
    
    // 4f. Find where materials end and global summary begins
    // The summary section has "#Num Vertices" followed by mesh count before "#Mesh"
    let materialEndLine = firstMeshHeaderLine;
    for (let i = firstMeshHeaderLine - 1; i > numMaterialsLine; i--) {
        const line = lines[i].trim();
        if (line.includes('#Num Vertices')) {
            materialEndLine = i;
            break;
        }
    }
    console.log(`   Material end line: ${materialEndLine} (summary starts here)`);
    
    // Copy original materials (from after #Num Materials to before global summary)
    for (let i = numMaterialsLine + 1; i < materialEndLine; i++) {
        output.push(lines[i]);
    }
    
    // 4g. Add new materials for user meshes
    for (const mesh of userMeshes) {
        output.push('#Material');
        output.push('1 #Material Type (Solid)');
        output.push('#Color');
        output.push('255');
        output.push('255');
        output.push('255');
        output.push('255');
        output.push('1.000000 #Specular');
        output.push('5.583000 #G Blend Sharpness');
        output.push('0.858000 #G Blend Level');
        output.push('0.626000 #G Blend Mode');
        output.push('#G Shadow Color');
        output.push('203');
        output.push('203');
        output.push('203');
        output.push('255');
        output.push('#G Highlight Color');
        output.push('255');
        output.push('255');
        output.push('255');
        output.push('255');
        output.push('0.000000 #G Ignore Base Color');
        output.push('0.342000 #G Specular');
        output.push('5.500000 #B Blend Sharpness');
        output.push('0.800000 #B Blend Level');
        output.push('0.655000 #B Blend Mode');
        output.push('#B Shadow Color');
        output.push('214');
        output.push('214');
        output.push('214');
        output.push('255');
        output.push('#B Highlight Color');
        output.push('255');
        output.push('255');
        output.push('255');
        output.push('255');
        output.push('0.023000 #B Ignore Base Color');
        output.push('0.372000 #B Specular');
        output.push('3 #Num Layers');
        output.push(`${mesh.textureIndex} #Texture index`);  // Base texture (with label!)
        output.push(`${mesh.textureIndex}`);                  // Lightmap (same as base for user objects)
        output.push(`${mesh.textureIndex}`);                  // Third layer (same as base)
    }
    
    // 4h. Write the global summary section (total vertices, mesh count)
    // Parse original values from the summary section
    const origTotalVertices = parseInt(lines[materialEndLine]);
    const origMeshCount = parseInt(lines[materialEndLine + 1]);
    
    // Calculate new totals
    let userTotalVertices = 0;
    for (const mesh of userMeshes) {
        userTotalVertices += mesh.numVertices;
    }
    const newTotalVertices = origTotalVertices + userTotalVertices;
    const newMeshCount = origMeshCount + userMeshes.length;
    
    output.push(`${newTotalVertices} #Num Vertices`);
    output.push(`${newMeshCount}`);
    console.log(`   Updated summary: ${newTotalVertices} vertices, ${newMeshCount} meshes`);
    
    // 4j. Copy original mesh headers (from first #Mesh to first #Mesh Vertices)
    for (let i = firstMeshHeaderLine; i < firstMeshVerticesLine; i++) {
        output.push(lines[i]);
    }
    
    // 4k. Add new mesh headers for user meshes
    for (const mesh of userMeshes) {
        output.push('#Mesh');
        output.push(`${mesh.numIndices} #Num Indices`);
        output.push(`${mesh.numVertices} #Num Vertices`);
        output.push('#Normals (Flags |= 0x1)');
        output.push('1 #Flags');
        output.push('2 #Num Colour Sets');
        output.push('2 #Num Uv Sets');
    }
    
    // 4l. Copy original vertex data (from first #Mesh Vertices to first #Mesh Indices)
    for (let i = firstMeshVerticesLine; i < firstMeshIndicesLine; i++) {
        output.push(lines[i]);
    }
    
    // 4m. Add new vertex data for user meshes
    for (const mesh of userMeshes) {
        output.push('#Mesh Vertices');
        for (const v of mesh.vertices) {
            output.push(`${v.x.toFixed(6)} #x`);
            output.push(`${v.y.toFixed(6)} #y`);
            output.push(`${v.z.toFixed(6)} #z`);
            output.push(`${v.u1.toFixed(6)} #u`);
            output.push(`${v.v1.toFixed(6)} #v`);
            output.push(`${v.u2.toFixed(6)} #u`);
            output.push(`${v.v2.toFixed(6)} #v`);
            output.push(`${v.r1} #r`);
            output.push(`${v.g1} #g`);
            output.push(`${v.b1} #b`);
            output.push(`${v.a1} #a`);
            output.push(`${v.r2} #r`);
            output.push(`${v.g2} #g`);
            output.push(`${v.b2} #b`);
            output.push(`${v.a2} #a`);
            output.push(`${v.nx.toFixed(6)} #nx`);
            output.push(`${v.ny.toFixed(6)} #ny`);
            output.push(`${v.nz.toFixed(6)} #nz`);
        }
    }
    
    // 4n. Copy original index data (from first #Mesh Indices to VIS close)
    for (let i = firstMeshIndicesLine; i < visCloseLine; i++) {
        output.push(lines[i]);
    }
    
    // 4o. Add new index data for user meshes
    for (const mesh of userMeshes) {
        output.push('#Mesh Indices');
        for (const idx of mesh.indices) {
            output.push(`${idx}`);
        }
    }
    
    // 4p. Copy VIS close marker
    output.push(lines[visCloseLine]); // The ">" that closes VIS
    
    // Collision merging - now with CORRECT count calculations!
    const ENABLE_COLLISION_MERGE = true;
    
    if (!ENABLE_COLLISION_MERGE) {
        // Just copy everything from COL onwards unchanged
        console.log('   ⚠️ Collision merge DISABLED - copying original COL/EDGE/VOLU');
        for (let i = colStartLine; i < lines.length; i++) {
            output.push(lines[i]);
        }
        
        const result = output.join('\n');
        console.log(`✅ Merged geometry: ${newTextureCount} textures, ${newMaterialCount} materials, ${origNumMeshes + userMeshes.length} meshes`);
        return result;
    }
    
    // 4q. Handle COL section with DIY collision data
    // Find COL section boundaries and EDGE section
    let colHeaderLine = -1;
    let colVerticesLine = -1;
    let colPolygonsLine = -1;  // First polygon line
    let edgeSectionLine = -1;
    let voluSectionLine = -1;
    
    for (let i = colStartLine; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('<COL')) colHeaderLine = i;
        if (line === '#Vertices') colVerticesLine = i;
        if (line.includes('#Num Sides') && colPolygonsLine === -1) colPolygonsLine = i;
        if (line.startsWith('<EDGE')) edgeSectionLine = i;
        if (line.startsWith('<VOLU')) voluSectionLine = i;
    }
    
    // Collect DIY collision data
    const diyColVertices = [];
    const diyColPolygons = [];
    const diyEdges = [];
    
    for (const diy of diyObjects) {
        if (diy.parsed && diy.parsed.colData) {
            const vertOffset = diyColVertices.length;
            
            // Add vertices (already transformed)
            for (const v of diy.parsed.colData.vertices) {
                diyColVertices.push(v);
            }
            
            // Add polygons with adjusted indices
            for (const poly of diy.parsed.colData.polygons) {
                diyColPolygons.push({
                    numSides: poly.numSides,
                    attribute: poly.attribute,
                    indices: poly.indices.map(idx => idx + vertOffset)
                });
            }
        }
        
        if (diy.parsed && diy.parsed.edgeData && diy.parsed.edgeData.edges) {
            for (const edge of diy.parsed.edgeData.edges) {
                diyEdges.push(edge);
            }
        }
    }
    
    console.log(`   DIY collision: ${diyColVertices.length} vertices, ${diyColPolygons.length} polygons, ${diyEdges.length} edges`);
    
    if (colHeaderLine !== -1 && diyColVertices.length > 0) {
        // Parse original COL counts
        const origColVerts = parseInt(lines[colHeaderLine + 1]);
        const origColPolyVerts = parseInt(lines[colHeaderLine + 2]);
        const origColPolyIndices = parseInt(lines[colHeaderLine + 3]);
        
        // Calculate new counts
        // IMPORTANT: The field names are misleading!
        // - "#Num Polygon Vertices" = actually POLYGON COUNT
        // - "#Num Polygon Indices" = sum of all numSides (vertex references)
        const newColVerts = origColVerts + diyColVertices.length;
        const diyPolyCount = diyColPolygons.length;  // Number of polygons
        const diyPolyRefs = diyColPolygons.reduce((sum, p) => sum + p.numSides, 0);  // Sum of numSides
        const newColPolyVerts = origColPolyVerts + diyPolyCount;  // Polygon count
        const newColPolyIndices = origColPolyIndices + diyPolyRefs;  // Vertex references
        
        console.log(`   COL counts: ${newColVerts} verts, ${newColPolyVerts} polys (orig ${origColPolyVerts} + ${diyPolyCount}), ${newColPolyIndices} refs`);
        
        // Write updated COL header
        output.push('<COL ');
        output.push(`${newColVerts} #Num Vertices`);
        output.push(`${newColPolyVerts} #Num Polygon Vertices`);
        output.push(`${newColPolyIndices} #Num Polygon Indices`);
        
        // Copy original COL vertices (from #Vertices to first polygon)
        for (let i = colVerticesLine; i < colPolygonsLine; i++) {
            output.push(lines[i]);
        }
        
        // Add DIY collision vertices
        for (let v = 0; v < diyColVertices.length; v++) {
            const vert = diyColVertices[v];
            output.push(`${vert[0].toFixed(6)}`);
            output.push(`${vert[1].toFixed(6)}`);
            output.push(`${vert[2].toFixed(6)}`);
        }
        
        // Copy original polygons (from first polygon to closing >, EXCLUDING the >)
        // The > is at edgeSectionLine - 1
        const colCloseTagLine = edgeSectionLine - 1;
        for (let i = colPolygonsLine; i < colCloseTagLine; i++) {
            output.push(lines[i]);
        }
        
        // Add DIY collision polygons with adjusted vertex indices
        const vertIndexOffset = origColVerts;
        for (const poly of diyColPolygons) {
            output.push(`${poly.numSides}`);
            output.push(`${poly.attribute}`);
            for (const idx of poly.indices) {
                output.push(`${idx + vertIndexOffset}`);
            }
        }
        
        // Add closing tag for COL section
        output.push('>');
    } else {
        // No DIY collision or no COL section - copy original
        for (let i = colStartLine; i < (edgeSectionLine !== -1 ? edgeSectionLine : (voluSectionLine !== -1 ? voluSectionLine : lines.length)); i++) {
            output.push(lines[i]);
        }
    }
    
    // 4r. Handle EDGE section with DIY grind edges
    if (edgeSectionLine !== -1) {
        if (diyEdges.length > 0) {
            // Parse original edge count
            const origEdgeCount = parseInt(lines[edgeSectionLine + 1]);
            const newEdgeCount = origEdgeCount + diyEdges.length;
            
            // Write updated EDGE header
            output.push('<EDGE');
            output.push(`${newEdgeCount} #Num Edges`);
            
            // Copy original edges (from after count to closing >, EXCLUDING the >)
            // The > is at voluSectionLine - 1
            const edgeCloseTagLine = voluSectionLine - 1;
            for (let i = edgeSectionLine + 2; i < edgeCloseTagLine; i++) {
                output.push(lines[i]);
            }
            
            // Add DIY edges
            for (const edge of diyEdges) {
                output.push(`${edge.attribute}`);
                output.push(`${edge.start[0].toFixed(6)}`);
                output.push(`${edge.start[1].toFixed(6)}`);
                output.push(`${edge.start[2].toFixed(6)}`);
                output.push(`${edge.end[0].toFixed(6)}`);
                output.push(`${edge.end[1].toFixed(6)}`);
                output.push(`${edge.end[2].toFixed(6)}`);
            }
            
            // Add closing tag for EDGE section
            output.push('>');
            
            console.log(`   Added ${diyEdges.length} grind edges`);
        } else {
            // No DIY edges - copy original EDGE section (including closing >)
            const edgeEndLine = voluSectionLine !== -1 ? voluSectionLine : lines.length;
            for (let i = edgeSectionLine; i < edgeEndLine; i++) {
                output.push(lines[i]);
            }
        }
    }
    
    // 4s. Copy VOLU section and remaining content
    if (voluSectionLine !== -1) {
        for (let i = voluSectionLine; i < lines.length; i++) {
            output.push(lines[i]);
        }
    }
    
    const result = output.join('\n');
    console.log(`✅ Merged geometry: ${newTextureCount} textures, ${newMaterialCount} materials, ${origNumMeshes + userMeshes.length} meshes`);
    
    return result;
}



/**
 * Generate TrueSkate geometry file with PERFECT DIY object preservation.
 * DIY objects keep their exact original materials, only positions transformed.
 */
function generateTrueSkateGeometryFilePerfect(builtInMeshes, diyObjects, globalTextureList) {
    const lines = [];
    
    // Header
    lines.push('84', '65', '83', '75', '1003 #Version', '<VIS ', '17');
    
    // Textures (global list)
    lines.push(`${globalTextureList.length} #Num Textures`);
    for (const tex of globalTextureList) {
        lines.push(tex);
    }
    
    // CRITICAL: In TrueSkate format, #materials MUST equal #meshes
    // Count what we're going to ACTUALLY WRITE
    let materialCount = builtInMeshes.length;  // 1 material per built-in mesh
    let meshCount = builtInMeshes.length;      // 1 mesh per built-in mesh
    
    for (const diy of diyObjects) {
        // For materials: we write diy.parsed.materials
        materialCount += diy.parsed.materials.length;
        // For meshes: we write diy.parsed.meshHeaders
        meshCount += diy.parsed.meshHeaders.length;
    }
    
    console.log(`📊 Material count: ${materialCount}, Mesh count: ${meshCount}`);
    
    if (materialCount !== meshCount) {
        console.error(`❌ CRITICAL: Material/mesh count mismatch! This will cause PARK LOAD FAILURE`);
        console.error(`   Materials: ${materialCount}, Meshes: ${meshCount}`);
        // Force use mesh count and we'll generate materials to match
    }
    
    // Use mesh count as the authoritative count (since each mesh needs exactly 1 material)
    const totalMaterials = meshCount;
    lines.push(`${totalMaterials} #Num Materials`);
    
    // Write built-in mesh materials using STANDARD values from real maps
    // These exact values are used by 95%+ of materials in working maps
    for (const mesh of builtInMeshes) {
        const texIdx = mesh.textureIndex || 0;
        
        // Get the actual material color from the mesh (not hardcoded white!)
        const matColor = mesh.materialColor || { r: 200, g: 200, b: 200 };
        
        lines.push('#Material');
        lines.push('1 #Material Type (Solid)');
        lines.push('#Color');
        lines.push(`${matColor.r}`, `${matColor.g}`, `${matColor.b}`, '255');
        lines.push('1.000000 #Specular');
        // Standard G Channel values (used in 99% of materials)
        lines.push('5.583000 #G Blend Sharpness');
        lines.push('0.858000 #G Blend Level');
        lines.push('0.626000 #G Blend Mode');
        lines.push('#G Shadow Color');
        lines.push('203', '203', '203', '255');  // Standard gray shadow
        lines.push('#G Highlight Color');
        lines.push('255', '255', '255', '255');
        lines.push('0.000000 #G Ignore Base Color');
        lines.push('0.342000 #G Specular');
        // Standard B Channel values
        lines.push('5.500000 #B Blend Sharpness');
        lines.push('0.800000 #B Blend Level');
        lines.push('0.655000 #B Blend Mode');
        lines.push('#B Shadow Color');
        lines.push('214', '214', '214', '255');  // Standard gray shadow
        lines.push('#B Highlight Color');
        lines.push('255', '255', '255', '255');
        lines.push('0.023000 #B Ignore Base Color');
        lines.push('0.372000 #B Specular');
        // Always 3 texture layers: main, lightmap, environment
        lines.push('3 #Num Layers');
        lines.push(`${texIdx} #Texture index`);
        lines.push(`${Math.min(texIdx + 1, globalTextureList.length - 1)}`);  // Lightmap
        lines.push(`${Math.min(texIdx + 2, globalTextureList.length - 1)}`);  // Environment
    }
    
    // Write DIY object materials - one per mesh
    // CRITICAL: Must write exactly meshHeaders.length materials per DIY object
    let totalDIYMaterialsWritten = 0;
    for (const diy of diyObjects) {
        const textureIndexMap = diy.textureIndexMap;
        const numMeshes = diy.parsed.meshHeaders.length;
        const numMaterials = diy.parsed.materials.length;
        const brightness = diy.brightness || 1.0;
        
        console.log(`📦 DIY object: meshes=${numMeshes}, materials=${numMaterials}, brightness=${brightness}`);
        
        for (let m = 0; m < numMeshes; m++) {
            totalDIYMaterialsWritten++;
            if (m < numMaterials) {
                // Use the original material
                const mat = diy.parsed.materials[m];
                
                // Write raw material lines, applying brightness to color values
                // Material format: #Color is followed by R, G, B, A values
                let inColorSection = false;
                let colorIndex = 0;
                for (const line of mat.rawLines) {
                    if (line === '#Color' || line.includes('#Color')) {
                        inColorSection = true;
                        colorIndex = 0;
                        lines.push(line);
                    } else if (inColorSection && colorIndex < 3) {
                        // Apply brightness to R, G, B (not A)
                        const numVal = parseInt(line) || 0;
                        const brightened = Math.round(Math.min(255, Math.max(0, numVal * brightness)));
                        lines.push(String(brightened));
                        colorIndex++;
                        if (colorIndex >= 3) {
                            inColorSection = false;  // Next value is Alpha, don't modify
                        }
                    } else {
                        lines.push(line);
                        // Check if we just passed alpha (4th color value)
                        if (inColorSection) {
                            inColorSection = false;
                        }
                    }
                }
                
                // Write remapped texture indices
                lines.push(`${mat.numLayers} #Num Layers`);
                for (let ti = 0; ti < mat.textureIndices.length; ti++) {
                    const origIdx = mat.textureIndices[ti];
                    const newIdx = textureIndexMap[origIdx] !== undefined ? textureIndexMap[origIdx] : 0;
                    // First texture index has label, rest are bare numbers
                    if (ti === 0) {
                        lines.push(`${newIdx} #Texture index`);
                    } else {
                    lines.push(`${newIdx}`);
                    }
                }
            } else {
                // Generate a default material for meshes without materials
                console.warn(`⚠️ DIY object missing material for mesh ${m}, generating default`);
                lines.push('#Material');
                lines.push('1 #Material Type (Solid)');
                lines.push('#Color');
                lines.push('255', '255', '255', '255');
                lines.push('1.000000 #Specular');
                lines.push('5.583000 #G Blend Sharpness');
                lines.push('0.858000 #G Blend Level');
                lines.push('0.626000 #G Blend Mode');
                lines.push('#G Shadow Color');
                lines.push('203', '203', '203', '255');
                lines.push('#G Highlight Color');
                lines.push('255', '255', '255', '255');
                lines.push('0.000000 #G Ignore Base Color');
                lines.push('0.342000 #G Specular');
                lines.push('5.500000 #B Blend Sharpness');
                lines.push('0.800000 #B Blend Level');
                lines.push('0.655000 #B Blend Mode');
                lines.push('#B Shadow Color');
                lines.push('214', '214', '214', '255');
                lines.push('#B Highlight Color');
                lines.push('255', '255', '255', '255');
                lines.push('0.023000 #B Ignore Base Color');
                lines.push('0.372000 #B Specular');
                lines.push('3 #Num Layers');
                lines.push('0 #Texture index');
                lines.push('0');
                lines.push('0');
            }
        }
    }
    
    // Verify we wrote the correct number of materials
    const totalMaterialsWritten = builtInMeshes.length + totalDIYMaterialsWritten;
    console.log(`✅ Materials written: ${totalMaterialsWritten} (${builtInMeshes.length} built-in + ${totalDIYMaterialsWritten} DIY)`);
    console.log(`✅ Declared: ${totalMaterials} #Num Materials`);
    if (totalMaterialsWritten !== totalMaterials) {
        console.error(`❌ FATAL: Written ${totalMaterialsWritten} but declared ${totalMaterials}!`);
    }
    
    // Count total vertices and meshes
    let totalVerts = builtInMeshes.reduce((sum, m) => sum + m.vertices.length, 0);
    let totalMeshes = builtInMeshes.length;
    for (const diy of diyObjects) {
        for (const meshVerts of diy.parsed.meshVertexData) {
            totalVerts += meshVerts.length;
            totalMeshes++;
        }
    }
    
    lines.push(`${totalVerts} #Num Vertices`);
    lines.push(`${totalMeshes}`);
    
    // Mesh headers - built-in first
    // Flag 33 = 0x21 = Has normals (0x01) + Triangle List mode (0x20)
    for (const mesh of builtInMeshes) {
        lines.push('#Mesh');
        lines.push(`${mesh.indices.length} #Num Indices`);
        lines.push(`${mesh.vertices.length} #Num Vertices`);
        lines.push('#Normals (Flags |= 0x1)');
        lines.push('1 #Flags');  // Use flag 1 like working files
        lines.push('2 #Num Colour Sets');
        lines.push('2 #Num Uv Sets');
    }
    
    // Mesh headers - DIY objects (use original headers)
    for (const diy of diyObjects) {
        for (let m = 0; m < diy.parsed.meshHeaders.length; m++) {
            const header = diy.parsed.meshHeaders[m];
            lines.push('#Mesh');
            lines.push(`${diy.parsed.meshIndexData[m].length} #Num Indices`);
            lines.push(`${diy.parsed.meshVertexData[m].length} #Num Vertices`);
            lines.push('#Normals (Flags |= 0x1)');
            lines.push(`${header.flags} #Flags`);
            lines.push(`${header.numColorSets} #Num Colour Sets`);
            lines.push(`${header.numUvSets} #Num Uv Sets`);
        }
    }
    
    // Vertex data - built-in meshes
    for (const mesh of builtInMeshes) {
        lines.push('#Mesh Vertices');
        let firstVert = true;
        for (const v of mesh.vertices) {
            const r = v.r !== undefined ? v.r : 255;
            const g = v.g !== undefined ? v.g : 255;
            const b = v.b !== undefined ? v.b : 255;
            const a = v.a !== undefined ? v.a : 255;
            
            if (firstVert) {
                lines.push(`${v.x.toFixed(6)} #x`);
                lines.push(`${v.y.toFixed(6)} #y`);
                lines.push(`${v.z.toFixed(6)} #z`);
                lines.push(`${v.u.toFixed(6)} #u`);
                lines.push(`${v.v.toFixed(6)} #v`);
                lines.push(`${v.u.toFixed(6)} #u`);
                lines.push(`${v.v.toFixed(6)} #v`);
                lines.push(`${r} #r`, `${g} #g`, `${b} #b`, `${a} #a`);
                lines.push(`${r} #r`, `${g} #g`, `${b} #b`, `${a} #a`);
                lines.push(`${v.nx.toFixed(6)} #normal x`);
                lines.push(`${v.ny.toFixed(6)} #normal y`);
                lines.push(`${v.nz.toFixed(6)} #normal z`);
                firstVert = false;
            } else {
                lines.push(v.x.toFixed(6), v.y.toFixed(6), v.z.toFixed(6));
                lines.push(v.u.toFixed(6), v.v.toFixed(6));
                lines.push(v.u.toFixed(6), v.v.toFixed(6));
                lines.push(String(r), String(g), String(b), String(a));
                lines.push(String(r), String(g), String(b), String(a));
                lines.push(v.nx.toFixed(6), v.ny.toFixed(6), v.nz.toFixed(6));
            }
        }
    }
    
    // Vertex data - DIY objects (transformed positions, original UVs/colors with brightness baked)
    for (const diy of diyObjects) {
        const brightness = diy.brightness || 1.0;  // Get brightness multiplier
        
        // Helper to apply brightness to color value (skip alpha at indices 3, 7)
        const applyBrightness = (colorData) => {
            if (brightness === 1.0) return colorData;  // No change needed
            
            return colorData.map((val, idx) => {
                // Alpha values are at indices 3 and 7 - don't modify them
                if (idx === 3 || idx === 7) return val;
                // Multiply RGB values by brightness, clamp to 0-255
                const numVal = parseInt(val) || 0;
                const brightened = Math.round(Math.min(255, Math.max(0, numVal * brightness)));
                return String(brightened);
            });
        };
        
        for (const meshVerts of diy.parsed.meshVertexData) {
            lines.push('#Mesh Vertices');
            let firstVert = true;
            
            for (const v of meshVerts) {
                const bakedColors = applyBrightness(v.colorData);
                
                if (firstVert) {
                    lines.push(`${v.position[0].toFixed(6)} #x`);
                    lines.push(`${v.position[1].toFixed(6)} #y`);
                    lines.push(`${v.position[2].toFixed(6)} #z`);
                    // UVs - preserved exactly
                    for (const uv of v.uvData) {
                        lines.push(`${uv} #uv`);
                    }
                    // Colors - with brightness baked in
                    for (const col of bakedColors) {
                        lines.push(`${col} #color`);
                    }
                    // Normal - transformed
                    lines.push(`${v.normal[0].toFixed(6)} #normal x`);
                    lines.push(`${v.normal[1].toFixed(6)} #normal y`);
                    lines.push(`${v.normal[2].toFixed(6)} #normal z`);
                    firstVert = false;
                } else {
                    lines.push(v.position[0].toFixed(6), v.position[1].toFixed(6), v.position[2].toFixed(6));
                    for (const uv of v.uvData) {
                        lines.push(uv);
                    }
                    for (const col of bakedColors) {
                        lines.push(col);
                    }
                    lines.push(v.normal[0].toFixed(6), v.normal[1].toFixed(6), v.normal[2].toFixed(6));
                }
            }
        }
        
        if (brightness !== 1.0) {
            console.log(`🎨 Baked brightness ${Math.round(brightness * 100)}% into DIY object vertex colors`);
        }
    }
    
    // Indices - built-in meshes
    for (const mesh of builtInMeshes) {
        lines.push('#Mesh Indices');
        for (const idx of mesh.indices) {
            lines.push(String(idx));
        }
    }
    
    // Indices - DIY objects (kept as-is, these are local to each mesh)
    for (const diy of diyObjects) {
        for (const meshIndices of diy.parsed.meshIndexData) {
            lines.push('#Mesh Indices');
            for (const idx of meshIndices) {
                lines.push(String(idx));
            }
        }
    }
    
    lines.push('>');
    
    // COL section
    // For custom models with many vertices, use simplified bounding box collision
    // This prevents performance issues and crashes
    const MAX_COL_VERTICES = 500; // Threshold for simplification
    
    // Pre-process builtInMeshes to create simplified collision data
    const collisionMeshes = builtInMeshes.map(mesh => {
        // If mesh has too many vertices AND is a custom model, simplify
        if (mesh.vertices.length > MAX_COL_VERTICES && mesh.isCustomModel) {
            console.log(`🔷 Simplifying collision for custom model (${mesh.vertices.length} vertices)`);
            // Use grid-based simplification to preserve shape
            return generateSimplifiedCollision(mesh.vertices, mesh.indices, MAX_COL_VERTICES);
        }
        // For simple built-in objects, use original vertices
        return {
            vertices: mesh.vertices,
            indices: mesh.indices,
            isRamp: mesh.isRamp
        };
    });
    
    // Calculate totals using collision meshes (not visual meshes)
    let colVertCount = collisionMeshes.reduce((sum, m) => sum + m.vertices.length, 0);
    let colPolyCount = collisionMeshes.reduce((sum, m) => sum + m.indices.length / 3, 0);
    let colPolyIndices = collisionMeshes.reduce((sum, m) => sum + m.indices.length, 0);
    
    for (const diy of diyObjects) {
        if (diy.parsed.colData) {
            colVertCount += diy.parsed.colData.vertices.length;
            colPolyCount += diy.parsed.colData.polygons.length;
            colPolyIndices += diy.parsed.colData.polygons.reduce((s, p) => s + p.indices.length, 0);
        }
    }
    
    lines.push('<COL ');
    lines.push(`${colVertCount} #Num Vertices`);
    lines.push(`${colPolyCount} #Num Polygon Vertices`);
    lines.push(`${colPolyIndices} #Num Polygon Indices`);
    
    // Collision vertices - built-in (using simplified collision meshes)
    let vertexOffset = 0;
    lines.push('#Vertices');
    let firstColVert = true;
    
    for (const colMesh of collisionMeshes) {
        for (const v of colMesh.vertices) {
            if (firstColVert) {
                lines.push(`${v.x.toFixed(6)} #x`);
                lines.push(`${v.y.toFixed(6)} #y`);
                lines.push(`${v.z.toFixed(6)} #z`);
                firstColVert = false;
            } else {
                lines.push(v.x.toFixed(6), v.y.toFixed(6), v.z.toFixed(6));
            }
        }
        vertexOffset += colMesh.vertices.length;
    }
    
    // Collision vertices - DIY (already transformed)
    const diyColOffsets = [];
    for (const diy of diyObjects) {
        diyColOffsets.push(vertexOffset);
        if (diy.parsed.colData) {
            for (const v of diy.parsed.colData.vertices) {
                if (firstColVert) {
                    lines.push(`${v[0].toFixed(6)} #x`);
                    lines.push(`${v[1].toFixed(6)} #y`);
                    lines.push(`${v[2].toFixed(6)} #z`);
                    firstColVert = false;
                } else {
                    lines.push(v[0].toFixed(6), v[1].toFixed(6), v[2].toFixed(6));
                }
            }
            vertexOffset += diy.parsed.colData.vertices.length;
        }
    }
    
    // Collision polygons - built-in (using simplified collision meshes)
    // Collision attributes from real maps:
    // 1310720 (0x140000) = Standard skateable ground (flat)
    // 2097152 (0x200000) = Ramp/transition surface (curved)
    lines.push('#Polygons');
    let polyOffset = 0;
    let firstPoly = true;
    
    for (const colMesh of collisionMeshes) {
        // Use 0 for obstacles (collision but not skateable)
        // Use 2097152 for ramps, 1310720 for flat skateable
        let colAttribute;
        if (colMesh.isObstacle) {
            colAttribute = 0;  // Non-skateable obstacle
        } else if (colMesh.isRamp) {
            colAttribute = 2097152;  // Ramp surface
        } else {
            colAttribute = 1310720;  // Flat skateable surface
        }
        
        for (let i = 0; i < colMesh.indices.length; i += 3) {
            if (firstPoly) {
                lines.push('3 #Num Sides');
                lines.push(`${colAttribute} #Atttribute`);
                lines.push(`${colMesh.indices[i] + polyOffset} #index`);
                lines.push(`${colMesh.indices[i + 1] + polyOffset} #index`);
                lines.push(`${colMesh.indices[i + 2] + polyOffset} #index`);
                firstPoly = false;
            } else {
                lines.push('3', String(colAttribute));
                lines.push(String(colMesh.indices[i] + polyOffset));
                lines.push(String(colMesh.indices[i + 1] + polyOffset));
                lines.push(String(colMesh.indices[i + 2] + polyOffset));
            }
        }
        polyOffset += colMesh.vertices.length;
    }
    
    // Collision polygons - DIY (use original with offset)
    for (let d = 0; d < diyObjects.length; d++) {
        const diy = diyObjects[d];
        const offset = diyColOffsets[d];
        
        if (diy.parsed.colData) {
            for (const poly of diy.parsed.colData.polygons) {
                if (firstPoly) {
                    lines.push(`${poly.numSides} #Num Sides`);
                    lines.push(`${poly.attribute} #Atttribute`);
                    for (let i = 0; i < poly.indices.length; i++) {
                        lines.push(`${poly.indices[i] + offset} #index`);
                    }
                    firstPoly = false;
                } else {
                    lines.push(String(poly.numSides), String(poly.attribute));
                    for (const idx of poly.indices) {
                        lines.push(String(idx + offset));
                    }
                }
            }
        }
    }
    
    lines.push('>');
    
    // EDGE section - grindable rails from DIY objects
    const allEdges = [];
    for (const diy of diyObjects) {
        if (diy.parsed.edgeData && diy.parsed.edgeData.edges) {
            allEdges.push(...diy.parsed.edgeData.edges);
        }
    }
    
    lines.push('<EDGE ');
    if (allEdges.length > 0) {
        lines.push(`${allEdges.length} #Num Edges`);
        for (let i = 0; i < allEdges.length; i++) {
            const edge = allEdges[i];
            if (i === 0) {
                lines.push(`${edge.attribute} #Attribute`);
                lines.push(`${edge.start[0].toFixed(6)} #x 1`);
                lines.push(`${edge.start[1].toFixed(6)} #y 1`);
                lines.push(`${edge.start[2].toFixed(6)} #z 1`);
                lines.push(`${edge.end[0].toFixed(6)} #x 2`);
                lines.push(`${edge.end[1].toFixed(6)} #y 2`);
                lines.push(`${edge.end[2].toFixed(6)} #z 2`);
            } else {
                lines.push(`${edge.attribute}`);
                lines.push(`${edge.start[0].toFixed(6)}`);
                lines.push(`${edge.start[1].toFixed(6)}`);
                lines.push(`${edge.start[2].toFixed(6)}`);
                lines.push(`${edge.end[0].toFixed(6)}`);
                lines.push(`${edge.end[1].toFixed(6)}`);
                lines.push(`${edge.end[2].toFixed(6)}`);
            }
        }
        console.log(`🛹 Exported ${allEdges.length} grind edges`);
    } else {
        lines.push('0 #Num Edges');
    }
    lines.push('>');
    
    // VOLU section - volume triggers (required, even if empty)
    lines.push('<VOLU');
    lines.push('0');
    lines.push('>');
    
    // =====================================================
    // VALIDATION - Verify file structure before export
    // =====================================================
    const fileContent = lines.join('\n');
    const validationErrors = validateTrueSkateGeometryFile(fileContent);
    if (validationErrors.length > 0) {
        console.error('❌ VALIDATION FAILED:');
        validationErrors.forEach(err => console.error(`   - ${err}`));
        alert('Export validation failed! Check console for details.');
    } else {
        console.log('✅ Validation passed - file structure is correct');
    }
    
    return fileContent;
}

// Validate True Skate geometry file structure
function validateTrueSkateGeometryFile(content) {
    const errors = [];
    const lines = content.split('\n');
    
    // Find declared counts
    let declaredMaterials = 0;
    let declaredMeshes = 0;
    let actualMaterials = 0;
    let actualMeshes = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Count declared materials
        if (line.includes('#Num Materials')) {
            declaredMaterials = parseInt(line.split('#')[0].trim());
        }
        
        // Count actual #Material entries
        if (line === '#Material') {
            actualMaterials++;
        }
        
        // Count actual #Mesh entries (but not #Mesh Vertices or #Mesh Indices)
        if (line === '#Mesh') {
            actualMeshes++;
        }
    }
    
    // Find declared mesh count (line after total vertices)
    const numVerticesMatch = content.match(/(\d+)\s*#Num Vertices\n(\d+)/);
    if (numVerticesMatch) {
        declaredMeshes = parseInt(numVerticesMatch[2]);
    }
    
    // Validate counts match
    if (declaredMaterials !== actualMaterials) {
        errors.push(`Material count mismatch: declared ${declaredMaterials}, found ${actualMaterials} #Material entries`);
    }
    
    if (declaredMeshes !== actualMeshes) {
        errors.push(`Mesh count mismatch: declared ${declaredMeshes}, found ${actualMeshes} #Mesh entries`);
    }
    
    if (declaredMaterials !== declaredMeshes) {
        errors.push(`Material/mesh count mismatch: ${declaredMaterials} materials vs ${declaredMeshes} meshes`);
    }
    
    // Check for required sections
    if (!content.includes('<VIS')) {
        errors.push('Missing <VIS section');
    }
    if (!content.includes('<COL')) {
        errors.push('Missing <COL section');
    }
    if (!content.includes('<VOLU')) {
        errors.push('Missing <VOLU section');
    }
    
    // Check for section closers
    const visCount = (content.match(/<VIS/g) || []).length;
    const colCount = (content.match(/<COL/g) || []).length;
    const voluCount = (content.match(/<VOLU/g) || []).length;
    const closerCount = (content.match(/^>$/gm) || []).length;
    
    if (closerCount < visCount + colCount + voluCount) {
        errors.push(`Missing section closers: found ${closerCount} ">" but have ${visCount + colCount + voluCount} sections`);
    }
    
    return errors;
}

function generateTrueSkateGeometryFile(meshes, textureNames = null, diyCollisionData = []) {
    const lines = [];
    
    // Use provided texture names or defaults
    const textures = textureNames || ['concrete_gray', 'black_overlay_texture', 'concrete_gray_lightmap'];
    
    // Header
    lines.push('84', '65', '83', '75', '1003 #Version', '<VIS ', '17');
    
    // Textures
    lines.push(`${textures.length} #Num Textures`);
    for (const tex of textures) {
        lines.push(tex);
    }
    
    // ONE material PER mesh (matching reference: 97 materials for 97 meshes)
    lines.push(`${meshes.length} #Num Materials`);
    
    for (let i = 0; i < meshes.length; i++) {
        const mesh = meshes[i];
        // Use mesh's texture index if available, otherwise default to 0
        const texIdx = mesh.textureIndex !== undefined ? mesh.textureIndex : 0;
        
        // Check if this mesh has preserved DIY material definition
        const matDef = mesh.materialDef;
        
        if (matDef) {
            // Use preserved DIY material definition (exact original values)
            lines.push('#Material');
            lines.push('1 #Material Type (Solid)');
            lines.push('#Color');
            lines.push('255', '255', '255', '255');  // Base color is WHITE
            lines.push(`${matDef.specular.toFixed(6)} #Specular`);
            lines.push(`${matDef.gBlend.sharpness.toFixed(6)} #G Blend Sharpness`);
            lines.push(`${matDef.gBlend.level.toFixed(6)} #G Blend Level`);
            lines.push(`${matDef.gBlend.mode.toFixed(6)} #G Blend Mode`);
            lines.push('#G Shadow Color');
            lines.push(`${matDef.gShadow.r}`, `${matDef.gShadow.g}`, `${matDef.gShadow.b}`, `${matDef.gShadow.a}`);
            lines.push('#G Highlight Color');
            lines.push(`${matDef.gHighlight.r}`, `${matDef.gHighlight.g}`, `${matDef.gHighlight.b}`, `${matDef.gHighlight.a}`);
            lines.push(`${matDef.gIgnoreBase.toFixed(6)} #G Ignore Base Color`);
            lines.push(`${matDef.gSpecular.toFixed(6)} #G Specular`);
            lines.push(`${matDef.bBlend.sharpness.toFixed(6)} #B Blend Sharpness`);
            lines.push(`${matDef.bBlend.level.toFixed(6)} #B Blend Level`);
            lines.push(`${matDef.bBlend.mode.toFixed(6)} #B Blend Mode`);
            lines.push('#B Shadow Color');
            lines.push(`${matDef.bShadow.r}`, `${matDef.bShadow.g}`, `${matDef.bShadow.b}`, `${matDef.bShadow.a}`);
            lines.push('#B Highlight Color');
            lines.push(`${matDef.bHighlight.r}`, `${matDef.bHighlight.g}`, `${matDef.bHighlight.b}`, `${matDef.bHighlight.a}`);
            lines.push(`${matDef.bIgnoreBase.toFixed(6)} #B Ignore Base Color`);
            lines.push(`${matDef.bSpecular.toFixed(6)} #B Specular`);
            
            // Use preserved texture layers
            lines.push(`${matDef.textures.length} #Num Layers`);
            for (let ti = 0; ti < matDef.textures.length; ti++) {
                const layerIdx = matDef.textures[ti];
                if (ti === 0) {
                    lines.push(`${layerIdx} #Texture index`);
                } else {
                lines.push(`${layerIdx}`);
                }
            }
        } else {
            // Generate material using STANDARD values from real maps
            // These exact values are used in 99% of materials in working maps
        
        lines.push('#Material');
        lines.push('1 #Material Type (Solid)');
        lines.push('#Color');
        lines.push('255', '255', '255', '255');
        lines.push('1.000000 #Specular');
        lines.push('5.583000 #G Blend Sharpness');
        lines.push('0.858000 #G Blend Level');
        lines.push('0.626000 #G Blend Mode');
        lines.push('#G Shadow Color');
            lines.push('203', '203', '203', '255');  // Standard
        lines.push('#G Highlight Color');
        lines.push('255', '255', '255', '255');
        lines.push('0.000000 #G Ignore Base Color');
        lines.push('0.342000 #G Specular');
        lines.push('5.500000 #B Blend Sharpness');
        lines.push('0.800000 #B Blend Level');
        lines.push('0.655000 #B Blend Mode');
        lines.push('#B Shadow Color');
            lines.push('214', '214', '214', '255');  // Standard
        lines.push('#B Highlight Color');
        lines.push('255', '255', '255', '255');
        lines.push('0.023000 #B Ignore Base Color');
        lines.push('0.372000 #B Specular');
        
            // ALWAYS use 3 layers: base texture, overlay (index 1), environment (index 2)
            const baseTexIdx = texIdx;
        lines.push('3 #Num Layers');
        lines.push(`${baseTexIdx} #Texture index`);
            lines.push('1');
            lines.push('2');
        }
    }
    
    // Total vertices and mesh count (should equal material count)
    const totalVerts = meshes.reduce((sum, m) => sum + m.vertices.length, 0);
    lines.push(`${totalVerts} #Num Vertices`);
    lines.push(`${meshes.length}`);
    
    // Mesh headers - Flag 33 = Has normals (0x01) + Triangle List (0x20)
    for (const mesh of meshes) {
        lines.push('#Mesh');
        lines.push(`${mesh.indices.length} #Num Indices`);
        lines.push(`${mesh.vertices.length} #Num Vertices`);
        lines.push('#Normals (Flags |= 0x1)');
        lines.push('1 #Flags');  // Use flag 1 like working files
        lines.push('2 #Num Colour Sets');
        lines.push('2 #Num Uv Sets');
    }
    
    // Vertex data - CORRECT ORDER: Position, UV1, UV2, Color1, Color2, Normal
    // CRITICAL: #Mesh Vertices marker before EACH mesh's data!
    // First vertex of each mesh has comments like #x, #y, #z, #u, #v, #r, #g, #b, #a, #normal x, #normal y, #normal z
    for (const mesh of meshes) {
        lines.push('#Mesh Vertices');
        let firstVert = true;
        for (const v of mesh.vertices) {
            // Get vertex colors (use white as default if not specified)
            const r = v.r !== undefined ? v.r : 255;
            const g = v.g !== undefined ? v.g : 255;
            const b = v.b !== undefined ? v.b : 255;
            const a = v.a !== undefined ? v.a : 255;
            
            if (firstVert) {
                // First vertex gets comments
                lines.push(`${v.x.toFixed(6)} #x`);
                lines.push(`${v.y.toFixed(6)} #y`);
                lines.push(`${v.z.toFixed(6)} #z`);
                lines.push(`${v.u.toFixed(6)} #u`);
                lines.push(`${v.v.toFixed(6)} #v`);
                lines.push(`${v.u.toFixed(6)} #u`);
                lines.push(`${v.v.toFixed(6)} #v`);
                // Color set 1 - use actual vertex colors!
                lines.push(`${r} #r`, `${g} #g`, `${b} #b`, `${a} #a`);
                // Color set 2 - same colors
                lines.push(`${r} #r`, `${g} #g`, `${b} #b`, `${a} #a`);
                lines.push(`${v.nx.toFixed(6)} #normal x`);
                lines.push(`${v.ny.toFixed(6)} #normal y`);
                lines.push(`${v.nz.toFixed(6)} #normal z`);
                firstVert = false;
            } else {
                // Position (x, y, z)
                lines.push(v.x.toFixed(6), v.y.toFixed(6), v.z.toFixed(6));
                // UV set 1
                lines.push(v.u.toFixed(6), v.v.toFixed(6));
                // UV set 2 (same as UV1 for now)
                lines.push(v.u.toFixed(6), v.v.toFixed(6));
                // Color set 1 (RGBA) - use actual vertex colors!
                lines.push(String(r), String(g), String(b), String(a));
                // Color set 2 (RGBA) - same colors
                lines.push(String(r), String(g), String(b), String(a));
                // Normal (nx, ny, nz) - comes LAST
                lines.push(v.nx.toFixed(6), v.ny.toFixed(6), v.nz.toFixed(6));
            }
        }
    }
    
    // Indices - each mesh needs #Mesh Indices marker
    for (const mesh of meshes) {
        lines.push('#Mesh Indices');
        for (const idx of mesh.indices) {
            lines.push(String(idx));
        }
    }
    
    // Close VIS section
    lines.push('>');
    
    // COL section - Collision geometry (needed for skating physics!)
    // Filter out meshes that have their own collision data (DIY objects)
    const colMeshes = meshes.filter(m => !m.skipCollision);
    
    // Calculate totals including DIY collision data
    const meshPolygons = colMeshes.reduce((sum, m) => sum + m.indices.length / 3, 0);
    const meshVertCount = colMeshes.reduce((sum, m) => sum + m.vertices.length, 0);
    const diyPolygons = diyCollisionData.reduce((sum, d) => sum + d.polygons.length, 0);
    const diyVertices = diyCollisionData.reduce((sum, d) => sum + d.vertices.length, 0);
    
    const totalColVerts = meshVertCount + diyVertices;
    const totalPolygons = meshPolygons + diyPolygons;
    const totalPolyIndices = colMeshes.reduce((sum, m) => sum + m.indices.length, 0) +
                             diyCollisionData.reduce((sum, d) => sum + d.polygons.reduce((s, p) => s + p.indices.length, 0), 0);
    
    lines.push('<COL ');
    lines.push(`${totalColVerts} #Num Vertices`);
    lines.push(`${totalPolygons} #Num Polygon Vertices`);  // This is actually polygon COUNT
    lines.push(`${totalPolyIndices} #Num Polygon Indices`);
    lines.push('#Vertices');
    
    // Collision vertices - first vertex gets #x #y #z comments
    let firstVert = true;
    for (const mesh of colMeshes) {
        for (const v of mesh.vertices) {
            if (firstVert) {
                lines.push(`${v.x.toFixed(6)} #x`);
                lines.push(`${v.y.toFixed(6)} #y`);
                lines.push(`${v.z.toFixed(6)} #z`);
                firstVert = false;
            } else {
                lines.push(v.x.toFixed(6));
                lines.push(v.y.toFixed(6));
                lines.push(v.z.toFixed(6));
            }
        }
    }
    
    // DIY collision vertices (already transformed)
    for (const diy of diyCollisionData) {
        for (const v of diy.vertices) {
            if (firstVert) {
                lines.push(`${v.x.toFixed(6)} #x`);
                lines.push(`${v.y.toFixed(6)} #y`);
                lines.push(`${v.z.toFixed(6)} #z`);
                firstVert = false;
            } else {
                lines.push(v.x.toFixed(6));
                lines.push(v.y.toFixed(6));
                lines.push(v.z.toFixed(6));
            }
        }
    }
    
    // Polygons
    lines.push('#Polygons');
    
    // Collision attribute values from real maps:
    // 1310720 (0x140000) = Standard skateable ground (flat)
    // 2097152 (0x200000) = Ramp/transition surface (curved)
    // These are now set per-mesh based on mesh.isRamp flag
    const GROUND_ATTR = 1310720;
    const RAMP_ATTR = 2097152;
    
    let indexOffset = 0;
    let firstPoly = true;
    
    // Regular mesh polygons (excluding DIY objects which have their own COL data)
    for (const mesh of colMeshes) {
        // Use correct collision attribute based on surface type:
        // 0 = obstacle (collision but not skateable)
        // RAMP_ATTR = ramp/curved surface
        // GROUND_ATTR = flat skateable surface
        let attr;
        if (mesh.isObstacle) {
            attr = 0;  // Non-skateable obstacle
        } else if (mesh.isRamp) {
            attr = RAMP_ATTR;
        } else {
            attr = GROUND_ATTR;
        }
        
        for (let i = 0; i < mesh.indices.length; i += 3) {
            if (firstPoly) {
                lines.push('3 #Num Sides');
                lines.push(`${attr} #Atttribute`);  // Note: original has typo "Atttribute"
                lines.push(`${mesh.indices[i] + indexOffset} #Vertex Index`);
                lines.push(`${mesh.indices[i + 1] + indexOffset} #Vertex Index`);
                lines.push(`${mesh.indices[i + 2] + indexOffset} #Vertex Index`);
                firstPoly = false;
            } else {
                lines.push('3');
                lines.push(String(attr));
                lines.push(String(mesh.indices[i] + indexOffset));
                lines.push(String(mesh.indices[i + 1] + indexOffset));
                lines.push(String(mesh.indices[i + 2] + indexOffset));
            }
        }
        indexOffset += mesh.vertices.length;
    }
    
    // DIY collision polygons (with original attributes preserved)
    for (const diy of diyCollisionData) {
        for (const poly of diy.polygons) {
            if (firstPoly) {
                lines.push(`${poly.numSides} #Num Sides`);
                lines.push(`${poly.attribute} #Atttribute`);
                for (let i = 0; i < poly.indices.length; i++) {
                    lines.push(`${poly.indices[i] + indexOffset} #Vertex Index`);
                }
                firstPoly = false;
            } else {
                lines.push(String(poly.numSides));
                lines.push(String(poly.attribute));
                for (const idx of poly.indices) {
                    lines.push(String(idx + indexOffset));
                }
            }
        }
        indexOffset += diy.vertices.length;
    }
    
    lines.push('>');
    
    // EDGE section - grinding edges (empty for now, rails could add these later)
    lines.push('<EDGE');
    lines.push('0 #Num Edges');
    lines.push('>');
    
    // VOLU section - volume triggers (empty)
    lines.push('<VOLU');
    lines.push('0');
    lines.push('>');
    
    return lines.join('\n');
}

function generateModJson(name) {
    // Start position coordinate system (from real map analysis):
    // x = horizontal X position in METERS (same as editor position.x)
    // y = horizontal Z position in METERS (same as editor position.z) 
    // z = HEIGHT above ground in METERS (same as editor position.y)
    // angle = facing direction in degrees
    
    // Generate start positions from user-placed spawn points
    let startPositionsStr = '';
    const positions = state.startPositions.length > 0 ? state.startPositions : [{ position: { x: 0, z: 0 }, rotation: { y: 0 } }];
    
    // Check if we have an imported map - spawn coordinates need to match original geometry scale
    // Imported maps have geometry divided by 100 for editor display, so spawn must be multiplied back
    const spawnScale = state.importedMapScale || 1;
    if (spawnScale !== 1) {
        console.log(`🛹 Scaling spawn positions by ${spawnScale}x for imported map`);
    }
    
    positions.forEach((sp, index) => {
        // Get editor coordinates
        let x = sp.position ? sp.position.x : 0;  // Editor X → Spawn X
        let y = sp.position ? sp.position.z : 0;  // Editor Z → Spawn Y (horizontal)
        // Height (spawn Z) - use editor's Y position
        let height = sp.position ? sp.position.y : 0;
        
        // Scale coordinates if we have an imported map
        // This converts editor coordinates back to original geometry coordinates
        x *= spawnScale;
        y *= spawnScale;
        height = Math.max(50, (height + 0.5) * spawnScale);  // Add offset and scale, minimum 50 units above ground
        
        // Angle in degrees (counter-clockwise from positive X axis)
        let angle = sp.rotation ? (sp.rotation.y * 180 / Math.PI) : 0;
        
        console.log(`🛹 Spawn ${index + 1}: editor(${(x/spawnScale).toFixed(1)}, ${(height/spawnScale).toFixed(1)}, ${(y/spawnScale).toFixed(1)}) → export(${x.toFixed(1)}, ${height.toFixed(1)}, ${y.toFixed(1)})`);
        
        startPositionsStr += `\t\t\t"startPosition":
\t\t\t{ 
\t\t\t\t"x":${x.toFixed(2)}, 
\t\t\t\t"y":${y.toFixed(2)}, 
\t\t\t\t"z":${height.toFixed(2)}
\t\t\t\t"angle":${angle.toFixed(1)}
\t\t\t}`;
        if (index < positions.length - 1) {
            startPositionsStr += '\n';
        }
    });
    
    return `"modWorldInfo":
{
\t"name":"${name}",
\t"fileName":"${name.replace(/\s+/g, '_').toLowerCase()}.txt"
\t"startPositions":
\t[
${startPositionsStr}
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

// White lightmap texture (neutral lighting)
function generateWhiteTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 256, 256);
    return canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
}

// Black overlay texture (must be PNG format!)
function generateBlackTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 256, 256);
    return canvas.toDataURL('image/png').split(',')[1];  // PNG format for .png file
}

/**
 * Apply brightness adjustment to an image blob
 * @param {Blob} blob - The original image blob
 * @param {number} brightness - Brightness multiplier (1.0 = no change, 2.0 = 200%, etc.)
 * @returns {Promise<Blob>} - The brightness-adjusted image blob
 */
async function applyBrightnessToImage(blob, brightness) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            
            // Draw original image
            ctx.drawImage(img, 0, 0);
            
            // Get pixel data
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            // Apply brightness to each pixel
            for (let i = 0; i < data.length; i += 4) {
                data[i] = Math.min(255, Math.round(data[i] * brightness));     // R
                data[i + 1] = Math.min(255, Math.round(data[i + 1] * brightness)); // G
                data[i + 2] = Math.min(255, Math.round(data[i + 2] * brightness)); // B
                // Alpha (data[i + 3]) stays unchanged
            }
            
            // Put modified data back
            ctx.putImageData(imageData, 0, 0);
            
            // Convert to blob (preserve format based on original)
            const mimeType = blob.type || 'image/jpeg';
            canvas.toBlob((newBlob) => {
                if (newBlob) {
                    console.log(`🎨 Applied ${Math.round(brightness * 100)}% brightness to texture (${img.width}x${img.height})`);
                    resolve(newBlob);
                } else {
                    reject(new Error('Failed to create blob from canvas'));
                }
            }, mimeType, 0.9);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = URL.createObjectURL(blob);
    });
}

async function exportToTrueSkate() {
    // Allow export if: we have user objects OR we have an imported map
    if (state.objects.length === 0 && !state.importedMapZip) {
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
        // Map of known texture name -> actual file in our extracted folder
        const textureFileMap = {
            'gray_seamless': 'gray_seamless.jpg',
            'white_environment_texture': 'white_environment_texture.jpg',
            'Concrete030_1K_Color_blue': 'Concrete030_1K_Color_blue.jpg',
            'blue_rail_worn_512': 'blue_rail_worn_512.jpg',
            '2017tampa_wood_1_c': '2017tampa_wood_1_c.jpg',
            'Metal029_1K_Color': 'Metal029_1K_Color.jpg',
            'braille_logo_blue': 'braille_logo_blue.jpg',
            // Common TrueSkate texture name mappings
            'metal_sheets': 'Metal029_1K_Color.jpg',
            'black_overlay_texture': 'gray_seamless.jpg', // fallback
            'concrete_gray': 'gray_seamless.jpg'
        };
        
        // Collect all textures from custom models
        const customTextures = [];
        
        // =====================================================
        // NEW PERFECT EXPORT: Separate DIY objects from built-in
        // =====================================================
        
        // Collect DIY objects with complete parsing
        const diyObjectsForExport = [];
        const builtInMeshes = [];
        
        // Build GLOBAL texture list: start with all DIY textures
        const globalTextureList = [];
        
        // First pass: collect all DIY textures and parse DIY objects
        for (const obj of state.objects) {
            if (obj.userData.type === 'diy-object') {
                const diyObjectId = obj.userData.diyObjectId;
                const diyObj = state.diyObjects.find(o => o.id === diyObjectId);
                
                if (diyObj && (diyObj.originalContent || diyObj.content)) {
                    const content = diyObj.originalContent || diyObj.content;
                    
                    // Parse COMPLETELY - all data preserved with full 3D rotation
                    const parsed = parseDIYObjectComplete(
                        content,
                        obj.position,
                        obj.rotation,  // Pass full rotation object (x, y, z)
                        obj.scale.x
                    );
                    
                    if (parsed) {
                        const brightness = obj.userData.brightness || 1.0;
                        console.log(`📦 DIY object "${diyObj.name}": brightness = ${brightness} (${Math.round(brightness * 100)}%)`);
                        
                        // Add this DIY's textures to global list (avoiding duplicates)
                        // If brightness != 1.0, create brightness-modified texture names
                        const textureIndexMap = {};
                        for (let i = 0; i < parsed.textureNames.length; i++) {
                            const originalTexName = parsed.textureNames[i];
                            let texName = originalTexName;
                            
                            // If brightness is modified, create a unique texture name
                            if (brightness !== 1.0) {
                                const brightnessPercent = Math.round(brightness * 100);
                                texName = `${originalTexName}_b${brightnessPercent}`;
                                console.log(`   🎨 Texture brightness: ${originalTexName} -> ${texName}`);
                            }
                            
                            let globalIdx = globalTextureList.indexOf(texName);
                            if (globalIdx === -1) {
                                globalIdx = globalTextureList.length;
                                globalTextureList.push(texName);
                            }
                            textureIndexMap[i] = globalIdx;
                        }
                        
                        diyObjectsForExport.push({
                            parsed: parsed,
                            textureIndexMap: textureIndexMap,
                            brightness: brightness,  // Bake brightness on export
                            originalTextureNames: parsed.textureNames  // Keep original names for blob lookup
                        });
                    }
                }
            }
        }
        
        // Helper to find texture index by name in global list
        const getTextureIndex = (name) => {
            let idx = globalTextureList.indexOf(name);
            if (idx === -1) {
                idx = globalTextureList.length;
                globalTextureList.push(name);
            }
            return idx;
        };
        
        // Ensure we have base textures
        getTextureIndex('gray_seamless');
        getTextureIndex('white_environment_texture');
        
        // Only add a ground plane if NOT importing an existing map
        // Imported maps already have their own floor geometry
        if (!state.importedMapGeometry) {
            // Check if there's a starter floor - use its size and color for ground
        const starterFloor = state.objects.find(o => o.userData.type === 'starter-floor');
        const groundSize = starterFloor ? (starterFloor.userData.props?.width || 60) : 50;
            
            // Get floor color from props (set by environment template)
            const floorColorHex = starterFloor?.userData?.props?.color || '#505050';
            const floorColor = hexToRgb(floorColorHex);
            
            console.log(`🏗️ Exporting ground: size=${groundSize}, color=${floorColorHex}`);
        
        // Ground plane first
        // Use flat ground attribute (1310720) for proper skating physics
        const groundGeo = generateGroundGeometry(groundSize);
        builtInMeshes.push({
            vertices: groundGeo.vertices.map(v => transformVertex(v, { x: 0, y: 0, z: 0 }, 0, 1)),
            indices: groundGeo.indices,
            textureIndex: getTextureIndex('gray_seamless'),
                materialColor: floorColor,  // Use floor color from environment
            isRamp: false  // Flat ground uses 1310720 for proper skating speed
        });
        } else {
            console.log(`⏭️ Skipping ground plane (imported map has its own floor)`);
        }
        
        // Process non-DIY objects
        console.log(`📦 Processing ${state.objects.length} objects...`);
        for (const obj of state.objects) {
            const objType = obj.userData.type;
            const objName = obj.userData.name || 'unnamed';
            
            console.log(`  → Object: type="${objType}", name="${objName}", isBackdrop=${obj.userData.isBackdrop}`);
            
            // Skip DIY objects (already handled)
            if (objType === 'diy-object') {
                console.log(`    ⏭️ Skipping (DIY - handled separately)`);
                continue;
            }
            
            // Skip starter-floor (already exported as ground plane)
            if (objType === 'starter-floor') {
                console.log(`    ⏭️ Skipping (starter-floor - already in ground)`);
                continue;
            }
            
            // Backdrop objects (imported True Skate maps)
            // If we have an imported map, SKIP these - they're already in the original geometry file
            // The merge function will handle combining with user objects
            if (objType === 'backdrop' || objType === 'backdrop-part') {
                if (state.importedMapGeometry) {
                    console.log(`    ⏭️ Skipping ${objType} - already in imported map geometry`);
                    continue;  // Skip! Original map geometry is used as base for merging
                } else {
                    console.log(`    🏞️ Including ${objType} as environment geometry (no imported base)`);
                }
            }
            
            // For multi-part environment objects (trees, cars), export each part separately
            const multiPartTypes = ['tree-oak', 'tree-pine', 'tree-palm', 'parked-car', 'lamp-post'];
            
            if (multiPartTypes.includes(objType)) {
                const meshParts = extractThreeJsGeometryMultiPart(obj);
                console.log(`    🌳 Multi-part object: ${meshParts.length} parts`);
                
                for (let partIdx = 0; partIdx < meshParts.length; partIdx++) {
                    const part = meshParts[partIdx];
                    if (!part.vertices || part.vertices.length === 0) continue;
                    
                    // Transform vertices
                    const transformedVertices = part.vertices.map(v => {
                        const transformed = transformVertex(
                            { x: v.x, y: v.y, z: v.z, nx: v.nx, ny: v.ny, nz: v.nz, u: v.u, v: v.v },
                            obj.position, obj.rotation.y, obj.scale.x
                        );
                        transformed.r = v.r;
                        transformed.g = v.g;
                        transformed.b = v.b;
                        return transformed;
                    });
                    
                    // Create color texture for this part
                    const partColor = part.color;
                    const colorKey = `solid_${partColor.r}_${partColor.g}_${partColor.b}`;
                    let texIdx = globalTextureList.indexOf(colorKey);
                    if (texIdx === -1) {
                        const colorTexData = generateSolidColorTexture(partColor.r, partColor.g, partColor.b);
                        customTextures.push({ name: colorKey, data: colorTexData, format: 'png' });
                        globalTextureList.push(colorKey);
                        texIdx = globalTextureList.length - 1;
                        console.log(`      🎨 Part ${partIdx}: RGB(${partColor.r},${partColor.g},${partColor.b})`);
                    } else {
                        texIdx = texIdx;
                    }
                    
                    builtInMeshes.push({
                        vertices: transformedVertices,
                        indices: part.indices,
                        textureIndex: texIdx,
                        materialColor: { r: 255, g: 255, b: 255 }, // White to let texture show
                        isRamp: false,
                        isObstacle: true
                    });
                }
                continue; // Skip normal processing for multi-part objects
            }
            
            const geo = getExportGeometry(obj);
            
            // Skip objects with empty or invalid geometry
            if (!geo || !geo.vertices || geo.vertices.length === 0) {
                console.warn(`    ⚠️ Skipping ${objType} - no valid geometry`);
                continue;
            }
            
            console.log(`    ✅ Adding: ${geo.vertices.length} vertices, ${geo.indices.length} indices`);
            
            // TRUE SKATE MESH LIMIT: Large meshes cause crashes!
            // Max safe vertex count is around 10,000-20,000 per mesh
            // BUT: Skip this check for imported map parts (they're already optimized for True Skate)
            const MAX_VERTICES = 20000;
            const isImportedMapPart = obj.userData.isImportedMapPart || 
                                      obj.userData.fromImportedMap || 
                                      obj.userData.isBackdrop ||
                                      obj.userData.type === 'backdrop' ||
                                      obj.userData.type === 'backdrop-part';
            
            if (geo.vertices.length > MAX_VERTICES && !isImportedMapPart) {
                console.error(`    ❌ MESH TOO LARGE: ${geo.vertices.length} vertices (max: ${MAX_VERTICES})`);
                console.error(`    💡 Custom models from Poly.cam must be simplified before export!`);
                console.error(`    💡 Select the model and click "Simplify" in the right panel first.`);
                
                alert(`Export failed!\n\nThe custom model "${objName}" has ${geo.vertices.length} vertices.\nTrue Skate can only handle ~${MAX_VERTICES} vertices per mesh.\n\nPlease select the model and use "Simplify" in the Tools panel to reduce its complexity.`);
                
                throw new Error(`Mesh too large: ${geo.vertices.length} vertices`);
            } else if (geo.vertices.length > MAX_VERTICES && isImportedMapPart) {
                console.log(`    📦 Large imported map part: ${geo.vertices.length} vertices (allowed)`);
            }
            
            const props = obj.userData.props || {};
            
            // Get color from object props (for built-in objects)
            let objColor = { r: 180, g: 180, b: 180 };
            if (props.color) {
                objColor = hexToRgb(props.color);
            }
            
            // For environment objects, extract color from the actual mesh material
            // This handles trees (green leaves), lamp posts (metal gray), cars, etc.
            const isEnvironmentObject = [
                'tree-oak', 'tree-pine', 'tree-palm', 'bush', 'hedge', 'flowers', 'grass-patch',
                'building-small', 'building-shop', 'building-garage', 'building-warehouse',
                'lamp-post', 'stop-sign', 'traffic-cone', 'barrier', 'fence-wood', 'fence-chainlink', 
                'fire-hydrant', 'dumpster', 'crate', 'barrel', 'parked-car', 'trash-can',
                'picnic-table', 'basketball-hoop', 'skateboard-rack', 'graffiti-wall',
                'bench', 'road-segment', 'ground-grass', 'ground-dirt', 'ground-water'
            ].includes(objType);
            
            // For environment objects, try to get primary color from material
            if (isEnvironmentObject) {
                if (props.leafColor) objColor = hexToRgb(props.leafColor);
                else if (props.trunkColor) objColor = hexToRgb(props.trunkColor);
                else if (props.buildingColor) objColor = hexToRgb(props.buildingColor);
                else if (props.bodyColor) objColor = hexToRgb(props.bodyColor);
                else if (props.poleColor) objColor = hexToRgb(props.poleColor);
                else {
                    // Extract color from the first mesh we find in the object
                    obj.traverse((child) => {
                        if (child.isMesh && child.material && child.material.color) {
                            const c = child.material.color;
                            objColor = { 
                                r: Math.round(c.r * 255), 
                                g: Math.round(c.g * 255), 
                                b: Math.round(c.b * 255) 
                            };
                        }
                    });
                }
            }
            
            // Steel color for base of ramps/pyramids
            const steelColor = { r: 90, g: 95, b: 105 };
            const steelBaseHeight = 0.2;
            const hasSteel = ['pyramid', 'kicker', 'quarter-pipe', 'half-pipe', 'ground-slope'].includes(objType);
            
            // Check if this is a custom model (preserve its original colors)
            const isCustomModel = objType === 'custom-model';
            
            // Apply color to vertices
            const coloredVertices = geo.vertices.map(v => {
                const transformed = transformVertex(v, obj.position, obj.rotation.y, obj.scale.x);
                
                // For custom models, preserve original extracted colors
                if (isCustomModel) {
                    // Colors already extracted from material in extractCustomModelGeometry
                    transformed.r = v.r !== undefined ? v.r : 200;
                    transformed.g = v.g !== undefined ? v.g : 200;
                    transformed.b = v.b !== undefined ? v.b : 200;
                    return transformed;
                }
                
                // For environment objects with baked-in colors, preserve them
                if (isEnvironmentObject) {
                    // Use the baked-in color from geometry generator
                    transformed.r = v.r !== undefined ? v.r : 200;
                    transformed.g = v.g !== undefined ? v.g : 200;
                    transformed.b = v.b !== undefined ? v.b : 200;
                    return transformed;
                }
                
                // For built-in objects, apply object color and steel zones
                const localY = v.y / TS_SCALE;
                const isInSteelZone = hasSteel && localY < steelBaseHeight;
                
                if (v.r === 255 && v.g === 255 && v.b === 255) {
                    if (isInSteelZone) {
                        transformed.r = steelColor.r;
                        transformed.g = steelColor.g;
                        transformed.b = steelColor.b;
                    } else {
                        transformed.r = objColor.r;
                        transformed.g = objColor.g;
                        transformed.b = objColor.b;
                    }
                }
                return transformed;
            });
            
            // For environment objects: We need to handle multi-part objects (like trees)
            // Each part may have a different color that needs its own texture
            let textureIdx;
            
            if (isEnvironmentObject) {
                // Get the FIRST mesh color as the dominant color for this object
                // (Trees will be split into multiple meshes later)
                let dominantColor = { r: 128, g: 128, b: 128 };
                
                // Check vertex colors first (they have the actual baked colors)
                if (geo.vertices && geo.vertices.length > 0) {
                    const v = geo.vertices[0];
                    if (v.r !== undefined && v.g !== undefined && v.b !== undefined) {
                        // Skip white vertices (placeholder)
                        if (!(v.r === 255 && v.g === 255 && v.b === 255)) {
                            dominantColor = { r: v.r, g: v.g, b: v.b };
                        }
                    }
                }
                
                // If still gray, try to get from object materials
                if (dominantColor.r === 128 && dominantColor.g === 128) {
                    obj.traverse((child) => {
                        if (child.isMesh && child.material && child.material.color) {
                            const c = child.material.color;
                            dominantColor = { 
                                r: Math.round(c.r * 255), 
                                g: Math.round(c.g * 255), 
                                b: Math.round(c.b * 255) 
                            };
                        }
                    });
                }
                
                // Create solid color texture for this color
                const colorKey = `solid_${dominantColor.r}_${dominantColor.g}_${dominantColor.b}`;
                let existingIdx = globalTextureList.indexOf(colorKey);
                if (existingIdx === -1) {
                    const colorTexData = generateSolidColorTexture(dominantColor.r, dominantColor.g, dominantColor.b);
                    customTextures.push({
                        name: colorKey,
                        data: colorTexData,
                        format: 'png'
                    });
                    globalTextureList.push(colorKey);
                    textureIdx = globalTextureList.length - 1;
                    console.log(`    🎨 Created color texture: RGB(${dominantColor.r},${dominantColor.g},${dominantColor.b})`);
                } else {
                    textureIdx = existingIdx;
                }
            } else {
                textureIdx = getTextureIndex('gray_seamless');
            }
            
            // Determine collision type:
            // - Ramps (curved) use 2097152
            // - Flat skateable surfaces use 1310720  
            // - Obstacles/props (not skateable) use 0
            const rampTypes = ['pyramid', 'kicker', 'quarter-pipe', 'half-pipe', 'ground-slope'];
            const obstacleTypes = [
                'tree-oak', 'tree-pine', 'tree-palm', 'bush', 'hedge', 'flowers', 'grass-patch',
                'building-small', 'building-shop', 'building-garage', 'building-warehouse',
                'lamp-post', 'stop-sign', 'traffic-cone', 'barrier', 'fence-wood', 'fence-chainlink', 
                'fire-hydrant', 'dumpster', 'crate', 'barrel', 'parked-car', 'trash-can',
                'picnic-table', 'basketball-hoop', 'skateboard-rack', 'graffiti-wall'
            ];
            
            const isRampType = rampTypes.includes(objType);
            const isObstacle = obstacleTypes.includes(objType);
            
            // For environment objects with baked-in vertex colors, use WHITE material
            // so vertex colors show through (material color multiplies with vertex colors)
            // For regular skate objects, use the object color
            const finalMaterialColor = isEnvironmentObject 
                ? { r: 255, g: 255, b: 255 }  // White = vertex colors show through
                : objColor;
            
            const meshData = {
                vertices: coloredVertices,
                indices: geo.indices,
                textureIndex: textureIdx,
                materialColor: finalMaterialColor,
                isRamp: isRampType,      // Ramps use 2097152
                isObstacle: isObstacle,  // Obstacles use 0 (collision but not skateable)
                isCustomModel: objType === 'custom-model'  // Flag for collision simplification
            };
            
            // Custom models with textures
            if (objType === 'custom-model') {
                const modelId = obj.userData.customModelId;
                const model = state.customModels.find(m => m.id === modelId);
                
                if (model && model.textures && model.textures.length > 0) {
                    for (const tex of model.textures) {
                        const texName = `custom_${safeName}_${customTextures.length}`;
                        customTextures.push({
                            name: texName,
                            data: tex.data,
                            format: tex.format || 'jpg'
                        });
                        globalTextureList.push(texName);
                        meshData.textureIndex = globalTextureList.length - 1;
                    }
                }
            }
            
            builtInMeshes.push(meshData);
        }
        
        // Generate geometry file using PERFECT method
        console.log(`🎯 Exporting: ${builtInMeshes.length} built-in meshes, ${diyObjectsForExport.length} DIY objects`);
        console.log(`📝 Global texture list:`, globalTextureList);
        
        // Validate built-in meshes before export
        for (let i = 0; i < builtInMeshes.length; i++) {
            const mesh = builtInMeshes[i];
            if (!mesh.vertices || mesh.vertices.length === 0) {
                console.error(`❌ Built-in mesh ${i} has no vertices!`);
            }
            if (!mesh.indices || mesh.indices.length === 0) {
                console.error(`❌ Built-in mesh ${i} has no indices!`);
            }
            console.log(`📊 Mesh ${i}: ${mesh.vertices.length} vertices, ${mesh.indices.length} indices`);
        }
        
        // Validate DIY objects
        for (let i = 0; i < diyObjectsForExport.length; i++) {
            const diy = diyObjectsForExport[i];
            console.log(`📊 DIY ${i}: ${diy.parsed.meshHeaders.length} mesh parts`);
        }
        
        const geometryFile = generateTrueSkateGeometryFilePerfect(
            builtInMeshes,
            diyObjectsForExport,
            globalTextureList
        );
        const modJson = generateModJson(parkName);
        
        // Create zip
        const zip = new JSZip();
        
        // =====================================================
        // IMPORTED MAP HANDLING: If we loaded an existing map,
        // copy all original files and merge with user objects
        // =====================================================
        if (state.importedMapZip && state.importedMapGeometry) {
            console.log('🗺️ Exporting with imported map base:', state.importedMapName);
            
            // ===========================================
            // INCREMENTAL TEST MODE
            // Enable features one by one to find the breaking point
            // ===========================================
            const DIAGNOSTIC_PASSTHROUGH = false;  // ✅ PASSED - zip handling works
            const ENABLE_MODJSON_UPDATE = true;    // ✅ PASSED - spawn points work
            const ENABLE_GEOMETRY_MERGE = true;    // 🧪 TESTING NOW - object merging
            
            console.log('🔍 DEBUG: state.importedMapModJson =', state.importedMapModJson ? `(${state.importedMapModJson.length} chars)` : 'NULL');
            
            if (DIAGNOSTIC_PASSTHROUGH) {
                console.log('🔬 DIAGNOSTIC MODE: Copying original zip byte-for-byte');
                
                for (const [name, file] of Object.entries(state.importedMapZip.files)) {
                    if (file.dir || name.startsWith('__MACOSX') || name.startsWith('.')) {
                        continue;
                    }
                    try {
                        const content = await file.async('arraybuffer');
                        zip.file(name, content);
                        console.log(`📦 Copied: ${name} (${content.byteLength} bytes)`);
                    } catch (e) {
                        console.warn(`⚠️ Failed: ${name}`, e);
                    }
                }
                
                console.log('✅ DIAGNOSTIC: All files copied from original zip');
                console.log('💡 If this STILL fails in True Skate, the problem is zip handling');
                console.log('💡 If this WORKS, the problem is our modifications');
                
                // Skip all our normal processing
                // Jump directly to the download
                const blob = await zip.generateAsync({ type: 'blob' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${safeName}_diagnostic.zip`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                document.getElementById('btn-export').textContent = '⬇️ EXPORT';
                document.getElementById('btn-export').disabled = false;
                
                alert('DIAGNOSTIC MODE: Exported original zip with no modifications.\n\nIf this loads in True Skate, the problem is our code.\nIf this FAILS, the problem is zip library handling.');
                return;
            }
            
            // STEP 1: Copy ALL files from original zip (as binary)
            console.log('📦 Copying all files from original zip...');
            for (const [name, file] of Object.entries(state.importedMapZip.files)) {
                if (file.dir || name.startsWith('__MACOSX') || name.startsWith('.')) {
                    continue;
                }
                
                // Decide if we should skip this file (because we'll write our own version)
                const isGeoFile = name === state.importedMapGeometryFileName;
                const isModJson = name.endsWith('_mod.json') || name.endsWith('mod.json');
                
                // Skip files we're going to modify (only if those features are enabled)
                if (isGeoFile && ENABLE_GEOMETRY_MERGE) {
                    console.log(`⏭️ Skipping geo (will merge): ${name}`);
                    continue;
                }
                if (isModJson && ENABLE_MODJSON_UPDATE && state.importedMapModJson) {
                    console.log(`⏭️ Skipping _mod.json (will update): ${name}`);
                    continue;
                }
                
                try {
                    const content = await file.async('arraybuffer');
                    zip.file(name, content);
                    console.log(`📦 Copied: ${name} (${content.byteLength} bytes)`);
                } catch (e) {
                    console.warn(`⚠️ Failed to copy: ${name}`, e);
                }
            }
            
            // STEP 2: Handle geometry (only if ENABLE_GEOMETRY_MERGE is true)
            if (ENABLE_GEOMETRY_MERGE) {
                const geoFileName = state.importedMapGeometryFileName || `${safeName}.txt`;
                const hasUserObjects = builtInMeshes.length > 0 || diyObjectsForExport.length > 0;
                
                if (hasUserObjects && state.importedMapGeometry) {
                    console.log(`🔀 Merging ${builtInMeshes.length} built-in + ${diyObjectsForExport.length} DIY objects...`);
                    try {
                        const mergedGeometry = mergeUserObjectsIntoImportedGeometry(
                            state.importedMapGeometry,
                            builtInMeshes,
                            diyObjectsForExport,
                            globalTextureList
                        );
                        zip.file(geoFileName, mergedGeometry);
                        console.log(`✅ Merged geometry: ${geoFileName} (${mergedGeometry.length} chars)`);
                        
                        // DEBUG: Save merged geometry locally for analysis
                        const debugBlob = new Blob([mergedGeometry], { type: 'text/plain' });
                        const debugUrl = URL.createObjectURL(debugBlob);
                        const debugLink = document.createElement('a');
                        debugLink.href = debugUrl;
                        debugLink.download = 'DEBUG_merged_geometry.txt';
                        debugLink.click();
                        URL.revokeObjectURL(debugUrl);
                        console.log('📄 DEBUG: Saved merged geometry to DEBUG_merged_geometry.txt');
                    } catch (e) {
                        console.error('❌ Merge failed, using original geometry:', e);
                        if (state.importedMapGeometryRaw) {
                            zip.file(geoFileName, state.importedMapGeometryRaw);
                        }
                    }
                } else if (state.importedMapGeometryRaw) {
                    // No user objects - use original geometry unchanged
                    zip.file(geoFileName, state.importedMapGeometryRaw);
                    console.log(`✅ Added original geometry: ${geoFileName}`);
                }
            }
            
            // STEP 3: Handle _mod.json (only if ENABLE_MODJSON_UPDATE is true)
            if (ENABLE_MODJSON_UPDATE && state.importedMapModJson) {
                const positions = state.startPositions.length > 0 ? state.startPositions : 
                    [{ position: { x: 0, z: 0, y: 0 }, rotation: { y: 0 } }];
                
                // NOTE: _mod.json spawn positions are in METERS (same as editor display)
                // NOT in centimeters like the geometry file!
                // So we do NOT scale for imported maps.
                
                const tsSpawns = positions.map((sp, idx) => {
                    // True Skate coordinate mapping:
                    // TS x = Editor x (horizontal)
                    // TS y = Editor z (horizontal, perpendicular) - NEGATED for correct direction
                    // TS z = Editor y (height/up)
                    const x = sp.position ? sp.position.x : 0;
                    const y = sp.position ? -sp.position.z : 0;  // Negate Z
                    const z = sp.position ? Math.max(0.5, sp.position.y + 0.5) : 1.0;
                    let angle = sp.rotation ? (sp.rotation.y * 180 / Math.PI) : 0;
                    angle = (angle + 360) % 360;
                    
                    console.log(`🎯 Spawn ${idx}: editor(${sp.position?.x?.toFixed(2)}, ${sp.position?.y?.toFixed(2)}, ${sp.position?.z?.toFixed(2)}) → TS(${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`);
                    return { x, y, z, angle };
                });
                
                const updatedModJson = updateModJsonSpawnPositions(state.importedMapModJson, tsSpawns);
                zip.file('_mod.json', updatedModJson);
                console.log('✅ Updated _mod.json with spawn positions');
            }
            
            console.log('✅ Export complete');
            console.log(`   ENABLE_MODJSON_UPDATE: ${ENABLE_MODJSON_UPDATE}`);
            console.log(`   ENABLE_GEOMETRY_MERGE: ${ENABLE_GEOMETRY_MERGE}`);
            
        } else {
            // Original behavior: generate geometry from scratch
        zip.file(`${safeName}.txt`, geometryFile);
        zip.file('_mod.json', modJson);
        }
        
        // Load and add texture files based on globalTextureList
        console.log('📷 Loading textures...');
        const addedTextureFiles = new Set();
        
        // Build a map of all available textures from loaded DIY packs
        const availableTextures = {};
        for (const pack of state.diyPacks) {
            if (pack.textures) {
                for (const [filename, texData] of Object.entries(pack.textures)) {
                    // Get texture name without extension
                    const nameWithoutExt = filename.replace(/\.(jpg|jpeg|png|JPG|JPEG|PNG)$/i, '');
                    if (texData && texData.blob) {
                        // Store with multiple key variations for robust matching
                        availableTextures[nameWithoutExt] = { filename: filename, blob: texData.blob };
                        availableTextures[nameWithoutExt.toLowerCase()] = { filename: filename, blob: texData.blob };
                        availableTextures[filename] = { filename: filename, blob: texData.blob };
                        availableTextures[filename.toLowerCase()] = { filename: filename, blob: texData.blob };
                    }
                }
            }
        }
        
        // Also add textures from custom models (OBJ+MTL imports)
        for (const obj of state.objects) {
            if (obj.userData.type === 'custom-model' && obj.userData.customModelTextures) {
                for (const [filename, blob] of Object.entries(obj.userData.customModelTextures)) {
                    const nameWithoutExt = filename.replace(/\.(jpg|jpeg|png|JPG|JPEG|PNG)$/i, '');
                    availableTextures[nameWithoutExt] = { filename: filename, blob: blob };
                    availableTextures[nameWithoutExt.toLowerCase()] = { filename: filename, blob: blob };
                    availableTextures[filename] = { filename: filename, blob: blob };
                    availableTextures[filename.toLowerCase()] = { filename: filename, blob: blob };
                    console.log(`📷 Custom model texture available: ${filename}`);
                }
            }
        }
        
        console.log('📦 Available textures:', Object.keys(availableTextures));
        
        // Add ALL textures from globalTextureList
        for (const texName of globalTextureList) {
            const jpgName = texName.includes('.') ? texName : `${texName}.jpg`;
            
            if (!addedTextureFiles.has(jpgName)) {
                let loaded = false;
                
                // Check if this is a brightness-modified texture name (e.g., "texture_b150")
                const brightnessMatch = texName.match(/^(.+)_b(\d+)$/);
                let originalTexName = texName;
                let brightnessLevel = 1.0;
                
                if (brightnessMatch) {
                    originalTexName = brightnessMatch[1];
                    brightnessLevel = parseInt(brightnessMatch[2]) / 100;
                    console.log(`🎨 Brightness-modified texture detected: ${texName} (original: ${originalTexName}, brightness: ${brightnessLevel})`);
                }
                
                // First: try to find in loaded DIY pack textures
                const texData = availableTextures[originalTexName] || availableTextures[originalTexName.toLowerCase()];
                if (texData && texData.blob) {
                    let blobToAdd = texData.blob;
                    
                    // Apply brightness modification if needed
                    if (brightnessLevel !== 1.0) {
                        try {
                            blobToAdd = await applyBrightnessToImage(texData.blob, brightnessLevel);
                            console.log(`🎨 Applied ${Math.round(brightnessLevel * 100)}% brightness to ${originalTexName}`);
                        } catch (err) {
                            console.warn(`⚠️ Failed to apply brightness to ${originalTexName}:`, err);
                        }
                    }
                    
                    zip.file(jpgName, blobToAdd);
                    addedTextureFiles.add(jpgName);
                    console.log(`📷 Added texture: ${texName} (from DIY pack${brightnessLevel !== 1.0 ? ', brightness adjusted' : ''})`);
                    loaded = true;
                }
                
                // Second: try filesystem fallbacks
                if (!loaded) {
                    const lookupName = brightnessMatch ? originalTexName : texName;
                    const actualFileName = textureFileMap[lookupName] || (lookupName.includes('.') ? lookupName : `${lookupName}.jpg`);
                    const possiblePaths = [
                        `braillehouse_diys_extracted/${actualFileName}`,
                        `braillehouse_diys_extracted/${lookupName}.jpg`,
                        `braillehouse_diys_extracted/${lookupName}.png`
                    ];
                    
                    for (const path of possiblePaths) {
                        if (loaded) break;
                        try {
                            const response = await fetch(path);
                            if (response.ok) {
                                let blob = await response.blob();
                                
                                // Apply brightness modification if needed
                                if (brightnessLevel !== 1.0) {
                                    try {
                                        blob = await applyBrightnessToImage(blob, brightnessLevel);
                                    } catch (err) {
                                        console.warn(`⚠️ Failed to apply brightness:`, err);
                                    }
                                }
                                
                                zip.file(jpgName, blob);
                                addedTextureFiles.add(jpgName);
                                console.log(`📷 Added texture: ${texName} (from ${path}${brightnessLevel !== 1.0 ? ', brightness adjusted' : ''})`);
                                loaded = true;
                            }
                        } catch (e) {
                            // Try next path
                        }
                    }
                }
                
                // Last resort: gray fallback
                if (!loaded) {
                    zip.file(jpgName, generateGrayTexture(), { base64: true });
                    addedTextureFiles.add(jpgName);
                    console.log(`⚠️ Added fallback for: ${texName}`);
                }
            }
        }
        
        // Add custom textures from Poly.cam models
        for (const tex of customTextures) {
            const filename = `${tex.name}.${tex.format}`;
            zip.file(filename, tex.data, { base64: true });
            console.log(`📷 Added custom texture: ${filename}`);
        }
        
        // Add textures from the texture library (for environment objects)
        if (state.texturesNeeded && state.texturesNeeded.size > 0) {
            console.log(`📂 Loading ${state.texturesNeeded.size} textures from library...`);
            for (const textureName of state.texturesNeeded) {
                try {
                    // Fetch texture from the textures folder
                    const response = await fetch(`textures/${textureName}`);
                    if (response.ok) {
                        const blob = await response.blob();
                        const arrayBuffer = await blob.arrayBuffer();
                        const ext = textureName.split('.').pop().toLowerCase();
                        const baseName = textureName.replace(/\.(png|jpg|jpeg)$/i, '');
                        
                        zip.file(textureName, arrayBuffer);
                        console.log(`📷 Added library texture: ${textureName}`);
                    } else {
                        console.warn(`⚠️ Could not load texture: ${textureName}`);
                    }
                } catch (err) {
                    console.warn(`⚠️ Error loading texture ${textureName}:`, err);
                }
            }
            // Clear the set for next export
            state.texturesNeeded.clear();
        }
        
        // Skybox textures
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
        
        const texCount = customTextures.length;
        alert(`Exported "${parkName}" with ${state.objects.length} objects${texCount > 0 ? ` and ${texCount} custom textures` : ''}!\n\nUpload the .zip file to mod.io to play it on your phone!`);
        
    } catch (error) {
        console.error('Export error:', error);
        alert('Export failed: ' + error.message);
    } finally {
        document.getElementById('btn-export').textContent = 'EXPORT';
        document.getElementById('btn-export').disabled = false;
    }
}

// ========================================
// OBJECT EDITOR
// ========================================

const editorState = {
    active: false,
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    currentObject: null,
    mode: 'easy', // easy, advanced, berserk
    objectType: 'ledge',
    settings: {
        height: 40,
        length: 200,
        width: 35,
        material: 'concrete',
        color: '#888888',
        grindTop: true,
        grindFront: false,
        grindBack: false
    },
    materials: {
        concrete: { color: 0x666666, roughness: 0.9 },
        marble: { color: 0xcccccc, roughness: 0.3 },
        brick: { color: 0x994433, roughness: 0.95 },
        metal: { color: 0x667788, roughness: 0.4 },
        wood: { color: 0x885522, roughness: 0.8 },
        granite: { color: 0x445566, roughness: 0.6 }
    },
    presets: {
        ledge: [
            { name: 'Street Curb', height: 15, length: 300, width: 30 },
            { name: 'Marble Ledge', height: 45, length: 200, width: 40, material: 'marble' },
            { name: 'Hubba Ledge', height: 80, length: 250, width: 35 },
            { name: 'Low Box', height: 30, length: 180, width: 50 },
            { name: 'Picnic Table', height: 75, length: 180, width: 60, material: 'wood' }
        ],
        rail: [
            { name: 'Flat Bar Low', height: 30, length: 200, width: 5 },
            { name: 'Flat Bar High', height: 60, length: 250, width: 5 },
            { name: 'Round Rail', height: 45, length: 200, width: 5 },
            { name: 'Handrail', height: 90, length: 300, width: 5 }
        ],
        ramp: [
            { name: 'Mellow Kicker', height: 30, length: 150, angle: 20 },
            { name: 'Steep Kicker', height: 50, length: 100, angle: 35 },
            { name: 'Quarter Pipe', height: 120, length: 200, angle: 75 },
            { name: 'Bank', height: 60, length: 250, angle: 25 }
        ],
        stairs: [
            { name: '3 Stair', steps: 3, height: 45 },
            { name: '5 Stair', steps: 5, height: 75 },
            { name: '7 Stair', steps: 7, height: 105 },
            { name: '10 Stair', steps: 10, height: 150 }
        ]
    }
};

function initObjectEditor() {
    const canvas = document.getElementById('editor-canvas');
    if (!canvas) return;
    
    // Create separate renderer for editor
    editorState.renderer = new THREE.WebGLRenderer({ 
        canvas, 
        antialias: true,
        alpha: true 
    });
    editorState.renderer.setPixelRatio(window.devicePixelRatio);
    editorState.renderer.setClearColor(0x0a0a0c);
    
    // Create scene
    editorState.scene = new THREE.Scene();
    
    // Camera
    editorState.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    editorState.camera.position.set(3, 2, 3);
    
    // Controls
    editorState.controls = new OrbitControls(editorState.camera, canvas);
    editorState.controls.enableDamping = true;
    editorState.controls.dampingFactor = 0.1;
    editorState.controls.target.set(0, 0.5, 0);
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    editorState.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    editorState.scene.add(directionalLight);
    
    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
    fillLight.position.set(-5, 3, -5);
    editorState.scene.add(fillLight);
    
    // Grid
    const grid = new THREE.GridHelper(10, 20, 0x333344, 0x222233);
    editorState.scene.add(grid);
    
    // Setup event listeners
    setupEditorListeners();
    
    // Create initial object
    updateEditorObject();
    
    console.log('🛠️ Object Editor initialized');
}

function setupEditorListeners() {
    // Back button
    document.getElementById('btn-back-to-map')?.addEventListener('click', closeObjectEditor);
    
    // Open editor button
    document.getElementById('btn-object-editor')?.addEventListener('click', openObjectEditor);
    
    // Mode switcher
    document.querySelectorAll('.mode-btn[data-editor-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.editorMode;
            setEditorMode(mode);
        });
    });
    
    // Object type buttons
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            editorState.objectType = btn.dataset.objType;
            loadPresetsForType(editorState.objectType);
            updateEditorObject();
        });
    });
    
    // Easy mode sliders
    ['height', 'length', 'width'].forEach(prop => {
        const slider = document.getElementById(`edit-${prop}`);
        const display = document.getElementById(`${prop}-value`);
        if (slider) {
            slider.addEventListener('input', () => {
                editorState.settings[prop] = parseInt(slider.value);
                if (display) display.textContent = slider.value;
                updateEditorObject();
            });
        }
    });
    
    // Material buttons
    document.querySelectorAll('.material-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.material-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            editorState.settings.material = btn.dataset.material;
            updateEditorObject();
        });
    });
    
    // Color picker
    document.getElementById('edit-color')?.addEventListener('input', (e) => {
        editorState.settings.color = e.target.value;
        updateEditorObject();
    });
    
    // Grind checkboxes
    ['grind-top', 'grind-front', 'grind-back'].forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.addEventListener('change', () => {
                const key = id.replace('grind-', 'grind') + id.split('-')[1].charAt(0).toUpperCase() + id.split('-')[1].slice(1);
                editorState.settings[key.replace('grind', 'grind')] = checkbox.checked;
                updateEditorObject();
            });
        }
    });
    
    // View buttons
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            setEditorView(btn.dataset.view);
        });
    });
    
    // Add to map button
    document.getElementById('btn-add-to-map')?.addEventListener('click', addEditorObjectToMap);
    
    // Export as DIY
    document.getElementById('btn-export-diy')?.addEventListener('click', exportEditorObjectAsDIY);
}

function openObjectEditor() {
    const editor = document.getElementById('object-editor');
    const app = document.getElementById('app');
    
    if (editor && app) {
        editor.classList.remove('hidden');
        app.style.display = 'none';
        editorState.active = true;
        
        // Initialize if needed
        if (!editorState.renderer) {
            initObjectEditor();
        }
        
        // Resize
        resizeEditorViewport();
        
        // Start render loop
        animateEditor();
        
        // Load presets
        loadPresetsForType(editorState.objectType);
    }
}

function closeObjectEditor() {
    const editor = document.getElementById('object-editor');
    const app = document.getElementById('app');
    
    if (editor && app) {
        editor.classList.add('hidden');
        app.style.display = 'grid';
        editorState.active = false;
    }
}

function setEditorMode(mode) {
    editorState.mode = mode;
    
    // Update buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.editorMode === mode);
    });
    
    // Show/hide panels
    document.getElementById('easy-mode-controls')?.classList.toggle('hidden', mode !== 'easy');
    document.getElementById('advanced-mode-controls')?.classList.toggle('hidden', mode !== 'advanced');
    document.getElementById('berserk-mode-controls')?.classList.toggle('hidden', mode !== 'berserk');
}

function setEditorView(view) {
    if (!editorState.camera || !editorState.controls) return;
    
    const distance = 4;
    
    switch (view) {
        case 'top':
            editorState.camera.position.set(0, distance, 0.01);
            break;
        case 'front':
            editorState.camera.position.set(0, 0.5, distance);
            break;
        case 'side':
            editorState.camera.position.set(distance, 0.5, 0);
            break;
        default: // 3D
            editorState.camera.position.set(3, 2, 3);
    }
    
    editorState.controls.target.set(0, 0.5, 0);
    editorState.controls.update();
}

function loadPresetsForType(type) {
    const container = document.getElementById('editor-presets');
    if (!container) return;
    
    const presets = editorState.presets[type] || [];
    container.innerHTML = '';
    
    presets.forEach((preset, idx) => {
        const btn = document.createElement('button');
        btn.className = 'preset-btn';
        btn.textContent = preset.name;
        btn.addEventListener('click', () => {
            applyPreset(preset);
        });
        container.appendChild(btn);
    });
}

function applyPreset(preset) {
    // Apply preset values to settings
    if (preset.height !== undefined) {
        editorState.settings.height = preset.height;
        const slider = document.getElementById('edit-height');
        const display = document.getElementById('height-value');
        if (slider) slider.value = preset.height;
        if (display) display.textContent = preset.height;
    }
    
    if (preset.length !== undefined) {
        editorState.settings.length = preset.length;
        const slider = document.getElementById('edit-length');
        const display = document.getElementById('length-value');
        if (slider) slider.value = preset.length;
        if (display) display.textContent = preset.length;
    }
    
    if (preset.width !== undefined) {
        editorState.settings.width = preset.width;
        const slider = document.getElementById('edit-width');
        const display = document.getElementById('width-value');
        if (slider) slider.value = preset.width;
        if (display) display.textContent = preset.width;
    }
    
    if (preset.material) {
        editorState.settings.material = preset.material;
        document.querySelectorAll('.material-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.material === preset.material);
        });
    }
    
    updateEditorObject();
}

function updateEditorObject() {
    if (!editorState.scene) return;
    
    // Remove old object
    if (editorState.currentObject) {
        editorState.scene.remove(editorState.currentObject);
    }
    
    // Create new object based on type and settings
    const { height, length, width, material } = editorState.settings;
    const matProps = editorState.materials[material] || editorState.materials.concrete;
    
    // Convert cm to meters for display
    const h = height / 100;
    const l = length / 100;
    const w = width / 100;
    
    let geometry;
    
    switch (editorState.objectType) {
        case 'ledge':
        case 'box':
        case 'manual-pad':
            geometry = new THREE.BoxGeometry(l, h, w);
            break;
        case 'rail':
            geometry = new THREE.CylinderGeometry(w / 2, w / 2, l, 8);
            geometry.rotateZ(Math.PI / 2);
            break;
        case 'ramp':
            geometry = createRampGeometry(l, h, w);
            break;
        case 'stairs':
            geometry = createStairsGeometry(l, h, w, 5);
            break;
        case 'gap':
            geometry = new THREE.BoxGeometry(l, 0.1, w);
            break;
        default:
            geometry = new THREE.BoxGeometry(l, h, w);
    }
    
    // Create material
    const color = new THREE.Color(matProps.color);
    const threeMaterial = new THREE.MeshStandardMaterial({
        color: color,
        roughness: matProps.roughness,
        metalness: material === 'metal' ? 0.6 : 0.1
    });
    
    // Create mesh
    const mesh = new THREE.Mesh(geometry, threeMaterial);
    mesh.position.y = h / 2;
    
    // Add grind edge indicators
    if (editorState.settings.grindTop) {
        const edgeMat = new THREE.LineBasicMaterial({ color: 0x00ff88 });
        const points = [
            new THREE.Vector3(-l/2, h/2, -w/2),
            new THREE.Vector3(l/2, h/2, -w/2)
        ];
        const edgeGeo = new THREE.BufferGeometry().setFromPoints(points);
        const edge = new THREE.Line(edgeGeo, edgeMat);
        mesh.add(edge);
    }
    
    editorState.currentObject = mesh;
    editorState.scene.add(mesh);
}

function createRampGeometry(length, height, width) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(length, 0);
    shape.lineTo(length, height);
    shape.lineTo(0, 0);
    
    const extrudeSettings = {
        steps: 1,
        depth: width,
        bevelEnabled: false
    };
    
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.translate(-length/2, -height/2, -width/2);
    geometry.rotateY(Math.PI / 2);
    
    return geometry;
}

function createStairsGeometry(length, height, width, steps) {
    const group = new THREE.Group();
    const stepHeight = height / steps;
    const stepDepth = length / steps;
    
    for (let i = 0; i < steps; i++) {
        const stepGeo = new THREE.BoxGeometry(width, stepHeight, stepDepth);
        const step = new THREE.Mesh(stepGeo);
        step.position.set(0, stepHeight * (i + 0.5), -stepDepth * i);
        group.add(step);
    }
    
    // Merge into single geometry (simplified)
    const boxGeo = new THREE.BoxGeometry(width, height, length);
    return boxGeo;
}

function resizeEditorViewport() {
    const viewport = document.getElementById('editor-viewport');
    if (!viewport || !editorState.renderer) return;
    
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    
    editorState.renderer.setSize(width, height);
    editorState.camera.aspect = width / height;
    editorState.camera.updateProjectionMatrix();
}

function animateEditor() {
    if (!editorState.active) return;
    
    requestAnimationFrame(animateEditor);
    
    if (editorState.controls) {
        editorState.controls.update();
    }
    
    if (editorState.renderer && editorState.scene && editorState.camera) {
        editorState.renderer.render(editorState.scene, editorState.camera);
    }
}

function addEditorObjectToMap() {
    if (!editorState.currentObject) {
        alert('No object to add!');
        return;
    }
    
    // Convert editor object to map object
    const { height, length, width, material } = editorState.settings;
    
    // Create object definition based on type
    const objectType = editorState.objectType;
    
    // Close editor and add to map
    closeObjectEditor();
    
    // Create the object in the main scene
    const props = {
        width: length / 100,
        height: height / 100,
        depth: width / 100,
        color: editorState.settings.color
    };
    
    // Use existing object creation flow
    let obj;
    
    switch (objectType) {
        case 'ledge':
            obj = OBJECT_DEFINITIONS['ledge'].create();
            obj.userData.props = { ...OBJECT_DEFINITIONS['ledge'].defaultProps, ...props };
            break;
        case 'rail':
            obj = OBJECT_DEFINITIONS['rail-flat'].create();
            obj.userData.props = { ...OBJECT_DEFINITIONS['rail-flat'].defaultProps, length: length / 100 };
            break;
        default:
            obj = OBJECT_DEFINITIONS['ledge'].create();
            obj.userData.props = { ...OBJECT_DEFINITIONS['ledge'].defaultProps, ...props };
    }
    
    obj.userData.type = objectType === 'ledge' ? 'ledge' : (objectType === 'rail' ? 'rail-flat' : 'ledge');
    obj.userData.name = `Custom ${objectType}`;
    
    // Position at center
    obj.position.set(0, 0, 0);
    
    // Add to scene
    state.scene.add(obj);
    state.objects.push(obj);
    selectObject(obj);
    saveUndoState();
    
    console.log(`✅ Added custom ${objectType} to map`);
}

function exportEditorObjectAsDIY() {
    if (!editorState.currentObject) {
        alert('No object to export!');
        return;
    }
    
    const name = prompt('Enter object name:', `custom_${editorState.objectType}`);
    if (!name) return;
    
    // Generate True Skate .txt format
    const txtContent = generateDIYFromEditorObject(name);
    
    // Download
    const blob = new Blob([txtContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    alert(`Exported "${name}.txt"!\nYou can now use this in DIY packs.`);
}

function generateDIYFromEditorObject(name) {
    // Get geometry from current object
    const geo = editorState.currentObject.geometry;
    const position = geo.attributes.position;
    const normal = geo.attributes.normal;
    const uv = geo.attributes.uv;
    
    const { height, length, width } = editorState.settings;
    const matProps = editorState.materials[editorState.settings.material];
    const color = new THREE.Color(matProps.color);
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    
    // Scale to True Skate units
    const scale = TS_SCALE;
    
    let lines = [];
    
    // VIS section
    lines.push('<VIS ');
    lines.push('1 #Number of Textures');
    lines.push('gray_seamless');
    lines.push('1 #Number of Materials');
    lines.push('#Material 0');
    lines.push('0 #Texture Index');
    lines.push('1 #Material Flags');
    lines.push('1 #Number of Meshes');
    
    // Mesh data
    const vertCount = position.count;
    const indexCount = geo.index ? geo.index.count : vertCount;
    
    lines.push('#Mesh 0');
    lines.push('0 #Material Index');
    lines.push(`${vertCount} #Number of Vertices`);
    lines.push(`${indexCount} #Number of Indices`);
    
    // Vertices
    lines.push('#Mesh Vertices');
    for (let i = 0; i < vertCount; i++) {
        lines.push(`${(position.getX(i) * scale).toFixed(6)} #x`);
        lines.push(`${(position.getY(i) * scale).toFixed(6)} #y`);
        lines.push(`${(position.getZ(i) * scale).toFixed(6)} #z`);
        lines.push(`${normal ? normal.getX(i).toFixed(6) : '0'} #nx`);
        lines.push(`${normal ? normal.getY(i).toFixed(6) : '1'} #ny`);
        lines.push(`${normal ? normal.getZ(i).toFixed(6) : '0'} #nz`);
        lines.push(`${uv ? uv.getX(i).toFixed(6) : '0'} #u`);
        lines.push(`${uv ? (1 - uv.getY(i)).toFixed(6) : '0'} #v`);
        lines.push(`${r} #r`);
        lines.push(`${g} #g`);
        lines.push(`${b} #b`);
        lines.push('255 #a');
    }
    
    // Indices
    lines.push('#Mesh Indices');
    if (geo.index) {
        for (let i = 0; i < geo.index.count; i++) {
            lines.push(String(geo.index.getX(i)));
        }
    } else {
        for (let i = 0; i < vertCount; i++) {
            lines.push(String(i));
        }
    }
    
    lines.push('>');
    
    // COL section (simple box collision)
    lines.push('<COL ');
    lines.push('8 #Num Vertices');
    lines.push('12 #Num Polygon Vertices');
    lines.push('36 #Num Polygon Indices');
    
    // Box vertices
    const hh = (height / 100) * scale / 2;
    const hl = (length / 100) * scale / 2;
    const hw = (width / 100) * scale / 2;
    
    const boxVerts = [
        [-hl, -hh, -hw], [hl, -hh, -hw], [hl, -hh, hw], [-hl, -hh, hw],
        [-hl, hh, -hw], [hl, hh, -hw], [hl, hh, hw], [-hl, hh, hw]
    ];
    
    for (const v of boxVerts) {
        lines.push(`${v[0].toFixed(6)} #x`);
        lines.push(`${v[1].toFixed(6)} #y`);
        lines.push(`${v[2].toFixed(6)} #z`);
    }
    
    // Box faces (12 triangles)
    const faces = [
        [0,2,1], [0,3,2], [4,5,6], [4,6,7],
        [0,1,5], [0,5,4], [2,3,7], [2,7,6],
        [0,4,7], [0,7,3], [1,2,6], [1,6,5]
    ];
    
    for (const face of faces) {
        lines.push('3 #Num Sides');
        lines.push('1310720 #Attribute'); // Ground
        for (const idx of face) {
            lines.push(String(idx));
        }
    }
    
    lines.push('>');
    
    // EDGE section (grind edges)
    if (editorState.settings.grindTop) {
        lines.push('<EDGE ');
        lines.push('1 #Num Edges');
        lines.push(`${-hl} #x1`);
        lines.push(`${hh} #y1`);
        lines.push(`${-hw} #z1`);
        lines.push(`${hl} #x2`);
        lines.push(`${hh} #y2`);
        lines.push(`${-hw} #z2`);
        lines.push('>');
    }
    
    return lines.join('\n');
}

// Add resize listener for editor
window.addEventListener('resize', () => {
    if (editorState.active) {
        resizeEditorViewport();
    }
});

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
    document.addEventListener('DOMContentLoaded', () => {
        init();
        setupModioBrowser();
        setupLocalMapsBrowser();
    });
} else {
    init();
    setupModioBrowser();
    setupLocalMapsBrowser();
}

// ========================================
// MOD.IO BROWSER INTEGRATION
// ========================================

function setupModioBrowser() {
    console.log('🌐 Setting up mod.io browser...');
    
    let modioBrowser;
    try {
        modioBrowser = new ModioBrowser();
    } catch (e) {
        console.error('Failed to create ModioBrowser:', e);
        // Create inline fallback
        modioBrowser = {
            allMods: [],
            fetchAllMods: async () => [],
            downloadMod: async () => null
        };
    }
    
    let allMods = [];
    let filteredMods = [];
    
    // Modal elements
    const modal = document.getElementById('modio-modal');
    const openBtn = document.getElementById('btn-modio');
    const closeBtn = document.getElementById('close-modio-modal');
    const gridContainer = document.getElementById('modio-grid');
    const filterInput = document.getElementById('modio-filter');
    const countSpan = document.getElementById('modio-count');
    const loadMoreBtn = document.getElementById('btn-load-more');
    
    console.log('Modal:', modal);
    console.log('Open button:', openBtn);
    
    if (!modal) {
        console.error('❌ Modal element not found!');
        return;
    }
    
    if (!openBtn) {
        console.error('❌ MOD.IO button not found!');
        return;
    }
    
    console.log('✅ Mod.io browser elements found');
    
    // Open modal and load maps
    openBtn.addEventListener('click', async () => {
        console.log('🖱️ MOD.IO button clicked!');
        modal.style.display = 'flex';
        console.log('Modal display set to flex');
        
        if (allMods.length === 0) {
            await loadAllMaps();
        }
    });
    
    // Close modal
    closeBtn?.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    // Load all maps
    async function loadAllMaps() {
        if (!gridContainer) return;
        
        gridContainer.innerHTML = `
            <div class="modio-loading-spinner">
                <div class="spinner"></div>
                <p>Loading maps from mod.io...</p>
            </div>
        `;
        
        allMods = await modioBrowser.fetchAllMods(200);
        filteredMods = allMods;
        
        if (countSpan) {
            countSpan.textContent = `${allMods.length} maps loaded`;
        }
        
        renderGrid(filteredMods);
    }
    
    // Render thumbnail grid
    function renderGrid(mods) {
        if (!gridContainer) return;
        
        if (!mods || mods.length === 0) {
            gridContainer.innerHTML = `
                <div class="modio-loading-spinner">
                    <p>No maps found. Enter an API key and click Reload.</p>
                </div>
            `;
            return;
        }
        
        gridContainer.innerHTML = '';
        
        for (const mod of mods) {
            const card = document.createElement('div');
            card.className = 'modio-map-card';
            
            // Handle both real mod.io mods and sample maps
            const thumbUrl = mod.logo?.thumb_320x180 || mod.logo?.original || mod.thumbnail || '';
            const downloads = mod.stats?.downloads_total || 0;
            const ratings = mod.stats?.ratings_positive || 0;
            const author = mod.submitted_by?.username || 'Sample';
            const description = mod.summary || mod.description || '';
            
            // For sample maps without real thumbnails, show a placeholder
            const imgHTML = thumbUrl 
                ? `<img src="${thumbUrl}" alt="${mod.name}" class="modio-map-thumb" 
                     onerror="this.parentElement.querySelector('.modio-map-thumb').outerHTML='<div class=\\'modio-map-thumb modio-placeholder\\'>🛹</div>';">`
                : `<div class="modio-map-thumb modio-placeholder">🛹</div>`;
            
            card.innerHTML = `
                ${imgHTML}
                <div class="modio-map-info">
                    <h4 class="modio-map-name" title="${mod.name}">${mod.name}</h4>
                    <p class="modio-map-author">by ${author}</p>
                    ${downloads > 0 ? `
                    <p class="modio-map-stats">
                        <span>⬇️ ${downloads.toLocaleString()}</span>
                        <span>⭐ ${ratings}</span>
                    </p>` : `<p class="modio-map-desc">${description}</p>`}
                </div>
            `;
            
            // Click to use as starter
            card.addEventListener('click', async () => {
                await useMapAsStarter(mod, card);
            });
            
            gridContainer.appendChild(card);
        }
    }
    
    // API key handling
    const apiKeyInput = document.getElementById('modio-api-key');
    const setApiKeyBtn = document.getElementById('btn-set-api-key');
    const apiSection = document.getElementById('modio-api-section');
    
    if (setApiKeyBtn && apiKeyInput) {
        // Pre-fill if we have a saved key
        if (modioBrowser.apiKey) {
            apiKeyInput.value = modioBrowser.apiKey;
            apiSection?.classList.add('has-key');
        }
        
        setApiKeyBtn.addEventListener('click', async () => {
            const key = apiKeyInput.value.trim();
            if (key) {
                modioBrowser.setApiKey(key);
                modioBrowser.allMods = []; // Reset to force reload
                await loadAllMaps();
                apiSection?.classList.add('has-key');
            }
        });
    }
    
    // Use a mod.io map as starter
    async function useMapAsStarter(mod, card) {
        // Show loading state
        const originalContent = card.innerHTML;
        card.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:20px;">
                <div class="spinner"></div>
                <p style="color:#fff;font-size:11px;margin-top:10px;">Downloading...</p>
            </div>
        `;
        card.style.pointerEvents = 'none';
        
        try {
            // Download the map
            const blob = await modioBrowser.downloadMod(mod);
            
            if (!blob) {
                throw new Error('Download failed');
            }
            
            // Close modal
            modal.style.display = 'none';
            
            // Import the map as editable backdrop
            const file = new File([blob], `${mod.name}.zip`, { type: 'application/zip' });
            
            // Clear current scene and import
            clearScene();
            await importMapAsBackdrop(file, mod.name);
            
            console.log(`✅ Loaded "${mod.name}" as starter map!`);
            
        } catch (error) {
            console.error('Error loading map:', error);
            alert(`Failed to load map: ${error.message}`);
            
            // Restore card
            card.innerHTML = originalContent;
            card.style.pointerEvents = 'auto';
        }
    }
    
    // Filter maps by name
    filterInput?.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        
        if (!query) {
            filteredMods = allMods;
        } else {
            filteredMods = allMods.filter(mod => 
                mod.name.toLowerCase().includes(query) ||
                (mod.submitted_by?.username || '').toLowerCase().includes(query)
            );
        }
        
        if (countSpan) {
            countSpan.textContent = `${filteredMods.length} maps`;
        }
        
        renderGrid(filteredMods);
    });
    
    // Reload button
    loadMoreBtn?.addEventListener('click', async () => {
        loadMoreBtn.textContent = '⏳ Reloading...';
        loadMoreBtn.disabled = true;
        
        // Reset and reload
        modioBrowser.allMods = [];
        await loadAllMaps();
        
        loadMoreBtn.textContent = '🔄 Reload Maps';
        loadMoreBtn.disabled = false;
    });
}

// ==================== LOCAL MAPS BROWSER ====================
function setupLocalMapsBrowser() {
    console.log('📂 Setting up local maps browser...');
    
    const modal = document.getElementById('local-maps-modal');
    const openBtn = document.getElementById('btn-local-maps');
    const closeBtn = document.getElementById('close-local-maps');
    const gridContainer = document.getElementById('local-maps-grid');
    const filterInput = document.getElementById('local-maps-filter');
    const countSpan = document.getElementById('local-maps-count');
    
    if (!modal || !openBtn) {
        console.error('❌ Local maps modal elements not found');
        return;
    }
    
    let allMaps = [];
    let filteredMaps = [];
    
    // Open modal
    openBtn.addEventListener('click', async () => {
        modal.style.display = 'flex';
        if (allMaps.length === 0) {
            await loadLocalMaps();
        }
    });
    
    // Close modal
    closeBtn?.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });
    
    // Filter input
    filterInput?.addEventListener('input', () => {
        const query = filterInput.value.toLowerCase().trim();
        if (!query) {
            filteredMaps = allMaps;
        } else {
            filteredMaps = allMaps.filter(m => m.name.toLowerCase().includes(query));
        }
        renderLocalMaps(filteredMaps);
        if (countSpan) countSpan.textContent = `${filteredMaps.length} maps`;
    });
    
    async function loadLocalMaps() {
        if (!gridContainer) return;
        console.log('📂 Loading local maps...');
        
        gridContainer.innerHTML = `
            <div class="modio-loading-spinner">
                <div class="spinner"></div>
                <p>Loading local maps...</p>
            </div>
        `;
        
        try {
            const response = await fetch('local_maps.json?t=' + Date.now());
            allMaps = await response.json();
            filteredMaps = allMaps;
            console.log('📂 Loaded', allMaps.length, 'maps from JSON');
            
            if (countSpan) countSpan.textContent = `${allMaps.length} maps`;
            renderLocalMaps(filteredMaps);
        } catch (e) {
            console.error('Failed to load local maps:', e);
            gridContainer.innerHTML = `
                <div class="modio-loading-spinner">
                    <p>Could not load maps. Run list_maps.py first.</p>
                </div>
            `;
        }
    }
    
    function renderLocalMaps(maps) {
        if (!gridContainer) return;
        
        if (!maps || maps.length === 0) {
            gridContainer.innerHTML = `
                <div class="modio-loading-spinner">
                    <p>No maps found matching filter.</p>
                </div>
            `;
            return;
        }
        
        gridContainer.innerHTML = '';
        console.log('📂 Rendering', maps.length, 'map cards');
        
        for (const map of maps) {
            const card = document.createElement('div');
            card.className = 'modio-map-card local-map-card';
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            card.setAttribute('aria-label', `Load ${map.name}`);
            
            const sizeMB = (map.size / 1024 / 1024).toFixed(1);
            
            card.innerHTML = `
                <div class="local-map-thumb">🛹</div>
                <div class="local-map-info">
                    <h4 class="local-map-name">${map.name}</h4>
                    <p class="local-map-stats">${sizeMB} MB</p>
                </div>
            `;
            
            const handleClick = async () => {
                await loadLocalMapAsBase(map);
                modal.style.display = 'none';
            };
            card.addEventListener('click', handleClick);
            card.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleClick();
            });
            
            gridContainer.appendChild(card);
        }
        console.log('📂 Created', gridContainer.children.length, 'cards in grid');
    }
    
    async function loadLocalMapAsBase(map) {
        console.log('📂 Loading local map:', map.name, 'file:', map.filename);
        
        // Show loading indicator
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'map-loading-indicator';
        loadingDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.9);padding:30px 50px;border-radius:10px;z-index:10000;color:white;font-size:18px;text-align:center;';
        loadingDiv.innerHTML = `<div style="font-size:40px;margin-bottom:10px;">⏳</div>Loading ${map.name}...<br><span style="font-size:12px;color:#888;">(${(map.size/1024/1024).toFixed(1)} MB - may take a moment)</span>`;
        document.body.appendChild(loadingDiv);
        
        try {
            console.log('📂 Fetching zip file...');
            // Fetch the zip file
            // Try project root first, then modio_maps_only folder
        let response = await fetch(map.filename);
        if (!response.ok) {
            response = await fetch(`modio_maps_only/${map.filename}`);
        }
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            console.log('📂 Got response, converting to blob...');
            const blob = await response.blob();
            console.log('📂 Blob size:', blob.size, 'bytes');
            
            // Clear the scene
            clearScene();
            
            // Import the map
            console.log('📂 Importing map as backdrop...');
            await importMapAsBackdrop(blob, map.name);
            
            console.log('✅ Map loaded:', map.name);
        } catch (e) {
            console.error('❌ Failed to load map:', e);
            alert('Failed to load map: ' + e.message);
        } finally {
            // Remove loading indicator
            const indicator = document.getElementById('map-loading-indicator');
            if (indicator) indicator.remove();
        }
    }
    
    console.log('✅ Local maps browser ready');
}

// Import a map as editable backdrop
async function importMapAsBackdrop(file, mapName) {
    try {
        const JSZip = (await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm')).default;
        const zip = await JSZip.loadAsync(file);
        
        // Store the original zip for export later (so we can include original map + user objects)
        state.importedMapZip = zip;
        state.importedMapName = mapName;
        
        // Find geometry file
        let geoContent = null;
        let geoFileName = null;
        
        // List all files for debugging
        const allFiles = Object.keys(zip.files);
        console.log('📦 Files in zip:', allFiles);
        
        for (const [name, zipFile] of Object.entries(zip.files)) {
            // Skip directories, hidden files, and non-geometry files
            if (zipFile.dir || name.startsWith('__MACOSX') || name.startsWith('.')) {
                continue;
            }
            
            // Accept .txt files or files with no extension (potential geometry data)
            const hasNoExtension = !name.includes('.') || (!name.endsWith('.png') && !name.endsWith('.jpg') && !name.endsWith('.jpeg'));
            const isTxt = name.endsWith('.txt');
            const isModJson = name.endsWith('_mod.json') || name.endsWith('mod.json');
            
            if ((isTxt || hasNoExtension) && !isModJson) {
                // Read as array buffer first to check format
                const rawData = await zipFile.async('arraybuffer');
                const bytes = new Uint8Array(rawData);
                
                // Check for Unity Asset Bundle header "UnityFS"
                const header = String.fromCharCode(...bytes.slice(0, 7));
                if (header === 'UnityFS') {
                    console.warn('⚠️ File', name, 'is a Unity Asset Bundle (binary format)');
                    throw new Error('This map is a Unity Asset Bundle (binary format) which cannot be imported. Only text-based True Skate maps (.txt format) are supported. Try a different community-made map.');
                }
                
                // Convert to string for text-based parsing
                const content = new TextDecoder('utf-8').decode(bytes);
                
                // Check if it looks like geometry data (starts with number or has vertex-like content)
                if (content.match(/^[\d\-\s]/) || content.includes('vertex') || content.length > 1000) {
                    geoContent = content;
                    geoFileName = name;
                    // Store the RAW binary immediately (we already have it!)
                    state.importedMapGeometryRaw = rawData;
                    console.log('📄 Found geometry file:', name, '(', content.length, 'chars,', rawData.byteLength, 'bytes raw)');
                    break;
                }
            }
        }
        
        if (!geoContent) {
            console.error('❌ No geometry file found. Files in zip:', allFiles);
            throw new Error('No compatible geometry file found. This may be a deck/clothing mod, not a map. Files: ' + allFiles.join(', '));
        }
        
        // Store original geometry for export (will append user objects to this)
        state.importedMapGeometry = geoContent;  // Text version for parsing/merging
        state.importedMapGeometryFileName = geoFileName;
        // Raw binary already stored above when we found the geometry file
        
        // Store original _mod.json for export (to keep correct filename, skybox, etc.)
        state.importedMapModJson = null;
        console.log('🔍 Looking for _mod.json in zip...');
        for (const [name, zipFile] of Object.entries(zip.files)) {
            if (name.toLowerCase().includes('mod.json')) {
                console.log(`   Found candidate: "${name}"`);
            }
            if ((name.endsWith('_mod.json') || name === 'mod.json' || name === '_mod.json') && !name.startsWith('__MACOSX')) {
                try {
                    const content = await zipFile.async('string');
                    state.importedMapModJson = content;
                    console.log(`📄 Found _mod.json: "${name}" (${content.length} chars)`);
                } catch (e) {
                    console.warn('Could not read _mod.json:', e);
                }
                break;
            }
        }
        console.log(`🔍 Result: state.importedMapModJson = ${state.importedMapModJson ? state.importedMapModJson.length + ' chars' : 'NULL'}`);
        
        // Load textures
        const textures = {};
        for (const [name, zipFile] of Object.entries(zip.files)) {
            if (name.match(/\.(png|jpg|jpeg)$/i) && !name.startsWith('__MACOSX')) {
                try {
                    const data = await zipFile.async('arraybuffer');
                    const blob = new Blob([data]);
                    const url = URL.createObjectURL(blob);
                    const texture = await new THREE.TextureLoader().loadAsync(url);
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.colorSpace = THREE.SRGBColorSpace;  // Correct color display
                    
                    const baseName = name.split('/').pop().replace(/\.(png|jpg|jpeg)$/i, '');
                    textures[baseName] = texture;
                } catch (e) {
                    console.warn(`Failed to load texture: ${name}`);
                }
            }
        }
        
        console.log(`📦 Loaded ${Object.keys(textures).length} textures`);
        
        // Parse and create the map mesh
        const mapGroup = parseTrueSkateMap(geoContent, textures);
        
        if (mapGroup) {
            mapGroup.userData.type = 'imported-map';
            mapGroup.userData.name = mapName;
            mapGroup.userData.importScale = 100;  // Geometry was divided by 100 during import
            state.scene.add(mapGroup);
            
            // Mark that we have an imported map - spawn coordinates need to be scaled
            state.importedMapScale = 100;
            
            if (!state.environmentObjects) state.environmentObjects = [];
            state.environmentObjects.push(mapGroup);
            
            // Center camera on the imported map
            const box = new THREE.Box3().setFromObject(mapGroup);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            console.log(`📐 Map bounds: center=${center.x.toFixed(1)}, ${center.y.toFixed(1)}, ${center.z.toFixed(1)} size=${size.x.toFixed(1)}, ${size.y.toFixed(1)}, ${size.z.toFixed(1)}`);
            
            // Position camera at ~10m height above map center, looking down at an angle
            const groundY = box.min.y;
            const cameraHeight = 10; // 10 meters above ground
            const cameraOffset = 15; // Offset from center for better viewing angle
            state.controls.target.set(center.x, groundY, center.z);
            state.camera.position.set(center.x + cameraOffset, groundY + cameraHeight, center.z + cameraOffset);
            state.controls.update();
            
            console.log(`✅ Imported "${mapName}" as backdrop`);
            
            // Hide grid to avoid z-fighting with imported map's floor
            if (state.gridHelper) {
                state.gridHelper.visible = false;
            }
            
            // Ensure bright lighting for imported maps
            ensureBrightLighting();
            
            // Add a spawn point at the center of the map, at the correct height
            // The spawn point should be about 1m above the ground level (skater height)
            // For imported maps, use the bottom of the bounding box as ground reference
            const spawnX = center.x;
            const spawnZ = center.z;
            // Use the minimum Y (ground level) plus offset for skater standing height
            const SPAWN_HEIGHT_ABOVE_SURFACE = 1.0;  // 1 meter above ground
            const spawnY = box.min.y + SPAWN_HEIGHT_ABOVE_SURFACE;
            
            // Clear existing spawn points and add one for this map
            while (state.startPositions.length > 0) {
                removeSpawnPoint(0);
            }
            addSpawnPoint(spawnX, spawnZ, 0, spawnY);
            console.log(`🛹 Added spawn point at center of map: (${spawnX.toFixed(1)}, ${spawnY.toFixed(1)}, ${spawnZ.toFixed(1)})`);
            
            // Auto-select the newly created spawn point so user can immediately use "Drop to Surface"
            if (state.startPositions.length > 0) {
                const newSpawnPoint = state.startPositions[state.startPositions.length - 1];
                selectSpawnPoint(newSpawnPoint);
                console.log('🛹 Auto-selected spawn point');
            }
        }
        
    } catch (error) {
        console.error('Import error:', error);
        throw error;
    }
}

// Ensure bright lighting for viewing imported maps
function ensureBrightLighting() {
    // Remove existing lights
    const lightsToRemove = [];
    state.scene.traverse((obj) => {
        if (obj.isLight) {
            lightsToRemove.push(obj);
        }
    });
    lightsToRemove.forEach(light => state.scene.remove(light));
    
    // Add bright ambient light
    const ambient = new THREE.AmbientLight(0xffffff, 1.0);
    state.scene.add(ambient);
    
    // Add strong directional light (sun)
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(50, 100, 50);
    sun.castShadow = true;
    state.scene.add(sun);
    
    // Add fill light from opposite side
    const fill = new THREE.DirectionalLight(0xaaccff, 0.5);
    fill.position.set(-30, 50, -30);
    state.scene.add(fill);
    
    // Add hemisphere light for natural outdoor look
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    state.scene.add(hemi);
    
    console.log('💡 Added bright lighting for imported map');
}

// Parse True Skate map geometry - uses the same parser as DIY objects
function parseTrueSkateMap(content, textures) {
    console.log('🗺️ parseTrueSkateMap called, content length:', content?.length);
    console.log('🗺️ textures:', Object.keys(textures || {}));
    
    try {
        // Use the full geometry parser (same as DIY objects)
        console.log('🗺️ Calling parseTrueSkateObject...');
        const result = parseTrueSkateObject(content, textures);
        
        if (result) {
            console.log('✅ Parsed full map geometry!', result);
            if (result.isGroup) {
                console.log('   Group has', result.children.length, 'children');
            }
            return result;
        }
        
        console.warn('⚠️ Full parser returned null/undefined');
        return null;
    } catch (error) {
        console.error('❌ Parse error in parseTrueSkateMap:', error);
        return null;
    }
}

// Save extracted textures
async function saveExtractedTextures(textures, modName) {
    // For browser, we can't directly save to filesystem
    // Instead, add them to state so they're available for export
    if (!state.extractedTextures) state.extractedTextures = [];
    
    for (const tex of textures) {
        // Convert ArrayBuffer to base64
        const bytes = new Uint8Array(tex.data);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        
        state.extractedTextures.push({
            name: tex.name,
            data: base64,
            source: modName
        });
    }
    
    console.log(`📦 Added ${textures.length} textures from ${modName} to library`);
}

// Setup bulk download buttons
function setupBulkDownload() {
    const btn30 = document.getElementById('btn-bulk-download-30');
    const btn100 = document.getElementById('btn-bulk-download-100');
    const progressDiv = document.getElementById('bulk-progress');
    const progressFill = document.querySelector('.progress-fill');
    const progressText = document.querySelector('.progress-text');
    
    async function doBulkDownload(maxMods) {
        if (!progressDiv || !progressFill || !progressText) return;
        
        progressDiv.style.display = 'block';
        btn30.disabled = true;
        btn100.disabled = true;
        
        const downloader = new BulkDownloader();
        
        try {
            const result = await downloader.bulkDownload({
                maxMods: maxMods,
                onProgress: (p) => {
                    const percent = (p.current / p.total) * 100;
                    progressFill.style.width = `${percent}%`;
                    progressText.textContent = p.status;
                }
            });
            
            progressText.textContent = `Creating texture pack (${result.texturesFound} textures)...`;
            
            // Create and download zip
            const zipBlob = await downloader.createTexturePackZip();
            
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `trueskate_texture_pack_${result.texturesFound}.zip`;
            a.click();
            URL.revokeObjectURL(url);
            
            progressText.textContent = `✅ Done! Downloaded ${result.texturesFound} textures from ${result.modsProcessed} maps`;
            
            // Also save to state for immediate use
            for (const tex of result.textures) {
                await saveExtractedTextures([tex], tex.source);
            }
            
        } catch (error) {
            console.error('Bulk download error:', error);
            progressText.textContent = `❌ Error: ${error.message}`;
        }
        
        btn30.disabled = false;
        btn100.disabled = false;
    }
    
    btn30?.addEventListener('click', () => doBulkDownload(30));
    btn100?.addEventListener('click', () => doBulkDownload(100));
}

// Call setup after DOM loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupBulkDownload);
} else {
    setupBulkDownload();
}


