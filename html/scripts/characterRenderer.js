import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadItemGeometry } from '/resource/tgxmLoader.js';

const CLASS_COLORS = { 0: 0x4466FF, 1: 0x44FF66, 2: 0xAA44FF };

// colorOrConfig: [r,g,b,a] array OR { color, roughness, metalness }
function applyPrimaryColor(group, colorOrConfig) {
    const cfg = Array.isArray(colorOrConfig)
        ? { color: colorOrConfig, roughness: null, metalness: null }
        : colorOrConfig;
    if (!Array.isArray(cfg.color) || cfg.color.length < 3) return;
    let [r, g, b] = cfg.color;
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    if (luma < 0.005) return;
    // Lift very dark shaders so geometry detail is visible without textures.
    const MIN_LUMA = 0.04;
    if (luma < MIN_LUMA) {
        const scale = MIN_LUMA / luma;
        r = Math.min(r * scale, 1.0);
        g = Math.min(g * scale, 1.0);
        b = Math.min(b * scale, 1.0);
    }
    group.traverse(obj => {
        if (obj.isMesh && obj.material) {
            const m = obj.material.clone();
            m.color.setRGB(r, g, b);
            m.metalness = cfg.metalness ?? 0.1;
            m.roughness = cfg.roughness ?? 0.6;
            if (cfg.emissive) {
                m.emissive.setRGB(cfg.emissive[0], cfg.emissive[1], cfg.emissive[2]);
                m.emissiveIntensity = 0.25;
            }
            obj.material = m;
        }
    });
}

function buildHumanoidRig(classType) {
    const color = CLASS_COLORS[classType] ?? 0x888888;
    const mat = new THREE.MeshStandardMaterial({ color });
    const group = new THREE.Group();

    const parts = [
        { geo: new THREE.CapsuleGeometry(0.18, 0.45), x:  0.00, y: 0.90 },
        { geo: new THREE.SphereGeometry(0.14),         x:  0.00, y: 1.52 },
        { geo: new THREE.CapsuleGeometry(0.07, 0.40),  x: -0.27, y: 0.85 },
        { geo: new THREE.CapsuleGeometry(0.07, 0.40),  x:  0.27, y: 0.85 },
        { geo: new THREE.CapsuleGeometry(0.09, 0.45),  x: -0.12, y: 0.22 },
        { geo: new THREE.CapsuleGeometry(0.09, 0.45),  x:  0.12, y: 0.22 },
    ];

    parts.forEach(({ geo, x, y }) => {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, 0);
        group.add(mesh);
    });
    return group;
}

function fitCameraToObjects(camera, controls, objects) {
    const box = new THREE.Box3();
    objects.forEach(o => box.expandByObject(o));
    if (box.isEmpty()) return;
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    const { center, radius } = sphere;
    if (radius === 0) return;
    const fov  = camera.fov * Math.PI / 180;
    const dist = (radius / Math.sin(fov / 2)) * 1.05;
    const azimuth   = Math.PI / 6;
    const elevation = Math.PI / 9;
    camera.position.set(
        center.x + dist * Math.sin(azimuth) * Math.cos(elevation),
        center.y + dist * Math.sin(elevation),
        center.z + dist * Math.cos(azimuth) * Math.cos(elevation)
    );
    camera.near = Math.max(0.0001, dist * 0.001);
    camera.far  = dist * 1000;
    camera.updateProjectionMatrix();
    camera.lookAt(center);
    controls.target.copy(center);
    controls.update();
}

function fitCameraToGroup(camera, controls, group) {
    fitCameraToObjects(camera, controls, [group]);
}

const DEFAULT_SHADER    = 4248210736;
const DEFAULT_ORNAMENTS = new Set([2931483505, 1959648454, 702981643, 3854296178]);
const SHADER_CAT_HASH   = 2973005342;

const ARMOR_BUCKETS = new Set([
    3448274439, // Helmet
    3551918588, // Gauntlets
    14239492,   // Chest Armor
    20886954,   // Leg Armor
    1585787867, // Class Armor
]);

const WEAPON_SLOT_ORDER = [
    1498876634, // Kinetic (Primary)
    2465295065, // Energy
    953998645,  // Power
];

let _assetDumped = false;
async function loadGearItem(itemHash, visualHash) {
    const hash = visualHash ?? itemHash;
    let assetResp = await fetch(`/api/gear/assets/${hash}`);
    // Cosmetic override failed — fall back to base geometry
    if (!assetResp.ok && hash !== itemHash) {
        assetResp = await fetch(`/api/gear/assets/${itemHash}`);
    }
    if (!assetResp.ok) return null;
    const asset = await assetResp.json();
    if (!_assetDumped) {
        _assetDumped = true;
        console.log('[asset] full structure for', hash, JSON.stringify(asset));
    }
    const geomFiles = asset?.content?.[0]?.geometry ?? [];
    if (!geomFiles.length) return null;

    const g = new THREE.Group();
    g.rotation.x = -Math.PI / 2;
    await Promise.allSettled(geomFiles.map(async f => {
        try { const m = await loadItemGeometry(f); if (m) g.add(m); } catch {}
    }));
    return g.children.length ? g : null;
}

async function loadCharacterGear(equipment, fallbackColor) {
    const armorItems = equipment.filter(item => ARMOR_BUCKETS.has(item.bucketHash));

    const [armorParts, weaponGroups] = await Promise.all([
        Promise.allSettled(armorItems.map(async item => {
            const g = await loadGearItem(item.itemHash, item.visualHash);
            if (g) {
                const mat = await getShaderColor(item.plugHashes ?? []);
                const color = mat ?? fallbackColor;
                if (color) applyPrimaryColor(g, color);
            }
            return g;
        })),
        Promise.all(WEAPON_SLOT_ORDER.map(async bucket => {
            const item = equipment.find(i => i.bucketHash === bucket);
            if (!item) return null;
            try {
                const g = await loadGearItem(item.itemHash, item.visualHash);
                if (g) {
                    const shaderMat = await getShaderColor(item.plugHashes ?? []);
                    const mat = shaderMat ?? await fetchItemGearColor(item.visualHash ?? item.itemHash);
                    const color = mat ?? fallbackColor;
                    if (color) applyPrimaryColor(g, color);
                }
                return g;
            } catch { return null; }
        })),
    ]);

    // loadGearItem already applies Z-up→Y-up rotation on each piece;
    // armorGroup is an unrotated container for bbox/scene management only.
    const armorGroup = new THREE.Group();
    armorParts.forEach(r => { if (r.status === 'fulfilled' && r.value) armorGroup.add(r.value); });

    return { armorGroup: armorGroup.children.length ? armorGroup : null, weaponGroups };
}

function showFallback(canvas) {
    const wrapper = canvas.closest('.canvasWrapper');
    if (!wrapper) return;
    canvas.style.display = 'none';
    const spinner  = wrapper.querySelector('.canvasSpinner');
    const fallback = wrapper.querySelector('.canvasFallback');
    if (spinner)  spinner.style.display  = 'none';
    if (fallback) fallback.style.display = 'block';
}

function addSceneLights(scene) {
    scene.add(new THREE.AmbientLight(0xffffff, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(5, 10, 7.5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.6);
    fill.position.set(-4, 4, 6);
    scene.add(fill);
    const front = new THREE.DirectionalLight(0xffffff, 0.4);
    front.position.set(0, 1, 10);
    scene.add(front);
    const rim = new THREE.DirectionalLight(0x4466ff, 0.3);
    rim.position.set(-5, 2, -5);
    scene.add(rim);
}


function initScene(canvas) {
    const wrapper = canvas.closest('.canvasWrapper');
    const spinner = wrapper ? wrapper.querySelector('.canvasSpinner') : null;

    try {
        const renderData = JSON.parse(canvas.dataset.render || '{}');
        const statsData = JSON.parse(canvas.dataset.stats || '{}');
        buildInfoBox(canvas, renderData, statsData); // async — runs independently of 3D render
        const w = canvas.clientWidth  || 416;
        const h = canvas.clientHeight || 500;

        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(w, h, false);
        renderer.setClearColor(0x0c0c14, 1);

        const scene = new THREE.Scene();
        addSceneLights(scene);

        const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 500);
        camera.position.set(0, 0.9, 3.2);
        camera.lookAt(0, 0.9, 0);

        const controls = new OrbitControls(camera, canvas);
        controls.target.set(0, 0.9, 0);
        controls.enableDamping  = true;
        controls.dampingFactor  = 0.05;
        controls.autoRotate      = true;
        controls.autoRotateSpeed = 1.5;

        (function animate() {
            requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        })();

        const equipment = Array.isArray(renderData.equipment) ? renderData.equipment : [];

        // Rig always present — gear overlays on top in bind-pose space
        const rig = buildHumanoidRig(renderData.classType);
        rig.rotation.y = -Math.PI / 2;
        scene.add(rig);
        fitCameraToGroup(camera, controls, rig);

        if (equipment.length) {
            loadCharacterGear(equipment, renderData.primaryColor).then(({ armorGroup, weaponGroups }) => {
                const anchor = armorGroup ?? rig;

                if (armorGroup) {
                    armorGroup.rotation.y = -Math.PI / 2;
                    scene.add(armorGroup);
                    rig.visible = false;
                }

                const charBox  = new THREE.Box3().setFromObject(anchor);
                const charH    = charBox.max.y - charBox.min.y;
                const targetSz = charH * 0.4;
                const gap      = charH * 0.06;
                let stackY     = charBox.max.y;
                const visible  = [anchor];

                weaponGroups.forEach(wGroup => {
                    if (!wGroup) { stackY -= targetSz + gap; return; }
                    scene.add(wGroup);

                    const rawBox  = new THREE.Box3().setFromObject(wGroup);
                    const rawSz   = rawBox.getSize(new THREE.Vector3());
                    const maxDim  = Math.max(rawSz.x, rawSz.y, rawSz.z);
                    wGroup.scale.setScalar(maxDim > 0 ? targetSz / maxDim : 1);

                    const sBox   = new THREE.Box3().setFromObject(wGroup);
                    const center = sBox.getCenter(new THREE.Vector3());
                    const sSz    = sBox.getSize(new THREE.Vector3());

                    wGroup.position.x += (charBox.max.x + gap + sSz.x * 0.5) - center.x;
                    wGroup.position.y += (stackY - sSz.y * 0.5) - center.y;
                    wGroup.position.z -= center.z;

                    stackY -= sSz.y + gap;
                    visible.push(wGroup);
                });

                fitCameraToObjects(camera, controls, visible);
                if (spinner) spinner.style.display = 'none';
            }).catch(() => {
                if (spinner) spinner.style.display = 'none';
            });
        } else {
            if (spinner) spinner.style.display = 'none';
        }

    } catch(e) {
        showFallback(canvas);
    }
}

// ---- Info box ----

const _defCache = new Map();
function fetchItemDef(hash) {
    if (_defCache.has(hash)) return _defCache.get(hash);
    const p = fetch(`/api/gear/item-def/${hash}`)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null);
    _defCache.set(hash, p);
    return p;
}

const _shaderColorCache = new Map();
async function getShaderColor(plugHashes) {
    for (const ph of plugHashes) {
        if (ph === DEFAULT_SHADER) continue;
        const def = await fetchItemDef(ph);
        // Armor shaders: plugCategoryHash 2973005342
        // Weapon cosmetics: plugCategoryIdentifier contains 'cosmetics' (no standard shader hash)
        const isShader   = def?.plugCategoryHash === SHADER_CAT_HASH;
        const isWepCosmetic = !isShader && def?.plugCategoryIdentifier?.includes('cosmetics');
        if (!isShader && !isWepCosmetic) continue;
        if (_shaderColorCache.has(ph)) return _shaderColorCache.get(ph);
        const mat = await (async () => {
            try {
                const ar = await fetch(`/api/gear/assets/${ph}`);
                console.log(`[shader] ${ph} asset HTTP ${ar.status}`);
                if (!ar.ok) return null;
                const asset = await ar.json();
                console.log(`[shader] ${ph} asset keys:`, Object.keys(asset));
                const gf = asset?.gear?.[0];
                if (!gf) { console.log(`[shader] ${ph} no gear file`); return null; }
                const dr = await fetch(`/api/gear/gear-desc/${gf}`);
                if (!dr.ok) { console.log(`[shader] ${ph} desc HTTP ${dr.status}`); return null; }
                const desc = await dr.json();
                console.log(`[shader] ${ph} material_properties:`, JSON.stringify(desc?.default_dyes?.[0]?.material_properties));
                const mp  = desc?.default_dyes?.[0]?.material_properties ?? {};
                const tint = mp.primary_albedo_tint;
                if (!Array.isArray(tint) || tint.length < 3) return null;
                // primary_material_params = [metallic, roughness, specular_intensity, ?]
                const matParams = mp.primary_material_params ?? [];
                const emissive  = mp.primary_emissive_tint_color_and_intensity_bias;
                // [1,1,1,1] is the neutral/no-emissive default; anything else is a real glow color.
                // Emissive needs the texture mask to look correct so we apply at low constant intensity.
                const hasEmissive = Array.isArray(emissive) &&
                    !(emissive[0] === 1 && emissive[1] === 1 && emissive[2] === 1);
                return {
                    color:     [tint[0], tint[1], tint[2], tint[3] ?? 1.0],
                    metalness: matParams[0] ?? 0.1,
                    roughness: matParams[1] ?? 0.6,
                    emissive:  hasEmissive ? [emissive[0], emissive[1], emissive[2]] : null,
                };
            } catch(e) { console.log(`[shader] ${ph} error:`, e); return null; }
        })();
        _shaderColorCache.set(ph, mat);
        return mat;
    }
    return null;
}

// Fetch the item's own gear descriptor color (used for weapons that have no shader plug).
const _gearColorCache = new Map();
async function fetchItemGearColor(itemHash) {
    if (_gearColorCache.has(itemHash)) return _gearColorCache.get(itemHash);
    const result = await (async () => {
        try {
            const ar = await fetch(`/api/gear/assets/${itemHash}`);
            if (!ar.ok) return null;
            const asset = await ar.json();
            const gf = asset?.gear?.[0];
            if (!gf) return null;
            const dr = await fetch(`/api/gear/gear-desc/${gf}`);
            if (!dr.ok) return null;
            const desc = await dr.json();
            const mp   = desc?.default_dyes?.[0]?.material_properties ?? {};
            const tint = mp.primary_albedo_tint;
            if (!Array.isArray(tint) || tint.length < 3) return null;
            const matParams = mp.primary_material_params ?? [];
            return {
                color:     [tint[0], tint[1], tint[2], tint[3] ?? 1.0],
                metalness: matParams[0] ?? 0.1,
                roughness: matParams[1] ?? 0.6,
            };
        } catch { return null; }
    })();
    _gearColorCache.set(itemHash, result);
    return result;
}

const SLOT_NAMES = {
    3448274439: 'Helmet',   3551918588: 'Gauntlets',
    14239492:   'Chest',    20886954:   'Legs',
    1585787867: 'Class',    1498876634: 'Kinetic',
    2465295065: 'Energy',   953998645:  'Power',
};
const CLASS_NAMES = { 0: 'Titan', 1: 'Hunter', 2: 'Warlock' };
const STAT_DEFS = [
    { hash: '2996146975', icon: '/resource/weapons.png', label: 'Mobility'    },
    { hash: '392767087',  icon: '/resource/health.png',  label: 'Resilience'  },
    { hash: '1943323491', icon: '/resource/class.png',   label: 'Recovery'    },
    { hash: '1735777505', icon: '/resource/grenade.png', label: 'Discipline'  },
    { hash: '144602215',  icon: '/resource/super.png',   label: 'Intellect'   },
    { hash: '4244567218', icon: '/resource/melee.png',   label: 'Strength'    },
];

function gibRow(slot, iconPath, name, emptyClass) {
    const r = document.createElement('div');
    r.className = 'gib-row' + (emptyClass ? ' gib-empty' : '');
    if (slot !== null) {
        const iconHtml = iconPath
            ? `<img class="gib-icon" src="/api/gear/icon?path=${encodeURIComponent(iconPath)}" loading="lazy" alt="">`
            : ``;
        r.innerHTML = `<span class="gib-slot">${slot}</span>${iconHtml}<span class="gib-name">${name}</span>`;
    } else {
        r.innerHTML = `<span class="gib-name">${name}</span>`;
    }
    return r;
}

function gibSection(box, title) {
    const s = document.createElement('div');
    s.className = 'gib-section';
    const h = document.createElement('div');
    h.className = 'gib-header';
    h.textContent = title;
    s.appendChild(h);
    box.appendChild(s);
    return s;
}

async function buildInfoBox(canvas, renderData, statsData) {
    const wrapper = canvas.closest('.canvasWrapper');
    if (!wrapper) return;

    const box = document.createElement('div');
    box.className = 'gearInfoBox';
    wrapper.insertAdjacentElement('afterend', box);

    // Character + stats
    const charSec = gibSection(box, 'Character');
    charSec.appendChild(gibRow(
        CLASS_NAMES[renderData.classType] ?? 'Unknown',
        null, '', false
    ));

    const stats = statsData ?? {};
    if (Object.keys(stats).length) {
        const statGrid = document.createElement('div');
        statGrid.className = 'gib-stat-grid';
        STAT_DEFS.forEach(({ hash, icon, label }) => {
            const val = stats[hash];
            if (val === undefined) return;
            const cell = document.createElement('div');
            cell.className = 'gib-stat';
            cell.innerHTML = `<img src="${icon}" title="${label}"><span>${val}</span>`;
            statGrid.appendChild(cell);
        });
        charSec.appendChild(statGrid);
    }

    const gearSec     = gibSection(box, 'Gear');
    const transmogSec = gibSection(box, 'Transmog');
    const shaderSec   = gibSection(box, 'Shaders');

    const relevant = (renderData.equipment ?? []).filter(i => SLOT_NAMES[i.bucketHash]);

    const results = await Promise.allSettled(relevant.map(async item => {
        const slot = SLOT_NAMES[item.bucketHash];
        const plugHashes = item.plugHashes ?? [];

        const [baseDef, visualDef, plugDefs] = await Promise.all([
            fetchItemDef(item.itemHash),
            item.visualHash ? fetchItemDef(item.visualHash) : Promise.resolve(null),
            Promise.all(plugHashes.map(ph => fetchItemDef(ph))),
        ]);

        return { slot, item, baseDef, visualDef, plugDefs, plugHashes };
    }));

    let hasTransmog = false, hasShader = false;

    results.forEach(r => {
        if (r.status !== 'fulfilled') return;
        const { slot, item, baseDef, visualDef, plugDefs, plugHashes } = r.value;

        gearSec.appendChild(gibRow(slot, baseDef?.icon ?? null, baseDef?.name ?? '—', false));

        // Transmog: server-resolved visualHash is authoritative (overrideStyleItemHash).
        // Fallback: scan plugs for ornament by plugCategoryIdentifier or itemSubType, excluding defaults.
        if (item.visualHash && item.visualHash !== item.itemHash) {
            transmogSec.appendChild(gibRow(slot, visualDef?.icon ?? null, visualDef?.name ?? '—', false));
            hasTransmog = true;
        } else {
            const oi = plugDefs.findIndex((d, i) =>
                d && !d.isDummyPlug &&
                !DEFAULT_ORNAMENTS.has(plugHashes[i]) &&
                (d.plugCategoryIdentifier?.includes('skin') || d.itemSubType === 21)
            );
            if (oi !== -1) {
                transmogSec.appendChild(gibRow(slot, plugDefs[oi]?.icon ?? null, plugDefs[oi].name ?? '—', false));
                hasTransmog = true;
            }
        }

        // Shader: plugCategoryHash 2973005342 (primary) or itemSubType 6 (fallback).
        // Exclude default no-shader placeholder.
        const si = plugDefs.findIndex((d, i) =>
            plugHashes[i] !== DEFAULT_SHADER &&
            (d?.plugCategoryHash === SHADER_CAT_HASH || d?.itemSubType === 6)
        );
        if (si !== -1) {
            shaderSec.appendChild(gibRow(slot, plugDefs[si]?.icon ?? null, plugDefs[si].name ?? '—', false));
            hasShader = true;
        }
        console.log('[gear]', slot, {
            plugHashes, visualHash: item.visualHash,
            plugDefs: plugDefs.map((d,i) => ({ h: plugHashes[i], cat: d?.plugCategoryHash, id: d?.plugCategoryIdentifier, sub: d?.itemSubType, dummy: d?.isDummyPlug }))
        });
    });

    if (!hasTransmog) transmogSec.appendChild(gibRow(null, '', 'None', true));
    if (!hasShader)   shaderSec.appendChild(gibRow(null, '',  'None', true));
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.characterCanvas').forEach(initScene);
});
