import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadItemGeometry, loadItemGeometryFromBuffer } from '/resource/tgxmLoader.js';

const CLASS_COLORS = { 0: 0x4466FF, 1: 0x44FF66, 2: 0xAA44FF };

// colorOrConfig: [r,g,b,a] array OR { color, roughness, metalness } — flat fallback when no shader
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
            obj.material = m;
        }
    });
}

function calcRoughness(params, remap) {
    const raw = params[3] ?? 0.6;
    if (!Array.isArray(remap) || remap.length < 4) return raw;
    return Math.min(Math.max(raw * remap[1] + remap[0], Math.min(remap[2], remap[3])), Math.max(remap[2], remap[3]));
}

function liftDark(c) {
    const luma = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
    if (luma < 0.005) return [0.04, 0.04, 0.04];
    if (luma < 0.04) {
        const s = 0.04 / luma;
        return [Math.min(c[0]*s, 1), Math.min(c[1]*s, 1), Math.min(c[2]*s, 1)];
    }
    return [c[0], c[1], c[2]];
}

// ---- Dye texture loading ----

function _decodeBC1Block(data, off, out, bx, by, w, force4) {
    const c0v=data[off]|data[off+1]<<8, c1v=data[off+2]|data[off+3]<<8;
    const r0=(c0v>>11&31)*255/31|0, g0=(c0v>>5&63)*255/63|0, b0=(c0v&31)*255/31|0;
    const r1=(c1v>>11&31)*255/31|0, g1=(c1v>>5&63)*255/63|0, b1=(c1v&31)*255/31|0;
    const pal=[[r0,g0,b0,255],[r1,g1,b1,255],[0,0,0,255],[0,0,0,0]];
    if (force4||c0v>c1v) {
        pal[2]=[(2*r0+r1)/3|0,(2*g0+g1)/3|0,(2*b0+b1)/3|0,255];
        pal[3]=[(r0+2*r1)/3|0,(g0+2*g1)/3|0,(b0+2*b1)/3|0,255];
    } else { pal[2]=[(r0+r1)>>1,(g0+g1)>>1,(b0+b1)>>1,255]; }
    for (let py=0;py<4;py++) {
        const row=data[off+4+py];
        for (let px=0;px<4;px++) {
            const x=bx*4+px, y=by*4+py;
            if (x>=w) continue;
            const p=pal[(row>>(px*2))&3], i=(y*w+x)*4;
            out[i]=p[0]; out[i+1]=p[1]; out[i+2]=p[2]; out[i+3]=p[3];
        }
    }
}

function _decodeBC3Block(data, off, out, bx, by, w) {
    _decodeBC1Block(data, off+8, out, bx, by, w, true);
    const a0=data[off],a1=data[off+1],ap=[a0,a1];
    if (a0>a1) { for(let k=1;k<7;k++) ap.push(((7-k)*a0+k*a1)/7|0); }
    else { for(let k=1;k<5;k++) ap.push(((5-k)*a0+k*a1)/5|0); ap.push(0,255); }
    const ab=[data[off+2],data[off+3],data[off+4],data[off+5],data[off+6],data[off+7]];
    for (let i=0;i<16;i++) {
        const bit=i*3,b2=bit>>3,sh=bit&7;
        const idx=sh<=5?(ab[b2]>>sh)&7:((ab[b2]>>sh)|(ab[b2+1]<<(8-sh)))&7;
        const x=bx*4+(i&3),y=by*4+(i>>2);
        if (x<w) out[(y*w+x)*4+3]=ap[idx];
    }
}

function _decodeBC4Block(data, off, out, bx, by, w) {
    const r0=data[off],r1=data[off+1],rp=[r0,r1];
    if (r0>r1) { for(let k=1;k<7;k++) rp.push(((7-k)*r0+k*r1)/7|0); }
    else { for(let k=1;k<5;k++) rp.push(((5-k)*r0+k*r1)/5|0); rp.push(0,255); }
    const rb=[data[off+2],data[off+3],data[off+4],data[off+5],data[off+6],data[off+7]];
    for (let i=0;i<16;i++) {
        const bit=i*3,b2=bit>>3,sh=bit&7;
        const idx=sh<=5?(rb[b2]>>sh)&7:((rb[b2]>>sh)|(rb[b2+1]<<(8-sh)))&7;
        const x=bx*4+(i&3),y=by*4+(i>>2);
        if (x<w) { const p=(y*w+x)*4; out[p]=out[p+1]=out[p+2]=rp[idx]; out[p+3]=255; }
    }
}

async function loadDyeTexture(filename) {
    try {
        const buf = _textureCache.has(filename)
            ? _textureCache.get(filename)
            : await fetch(`/api/gear/Texture/${filename}`).then(r => r.ok ? r.arrayBuffer() : null);
        if (!buf) return null;
        const b = new Uint8Array(buf);
        if (b[0]!==84||b[1]!==71||b[2]!==88||b[3]!==77) return null;

        const fOff=(b[8]|b[9]<<8|b[10]<<16|b[11]<<24)>>>0;
        const fCnt=(b[12]|b[13]<<8|b[14]<<16|b[15]<<24)>>>0;
        let meta=null, pix=null;
        for (let f=0;f<fCnt;f++) {
            const base=fOff+0x110*f;
            let name=''; for (let i=0;i<256&&b[base+i];i++) name+=String.fromCharCode(b[base+i]);
            const doff=(b[base+256]|b[base+257]<<8|b[base+258]<<16|b[base+259]<<24)>>>0;
            const dsz =(b[base+264]|b[base+265]<<8|b[base+266]<<16|b[base+267]<<24)>>>0;
            if (name.endsWith('.js')) meta=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,doff,dsz)));
            else pix=new Uint8Array(buf,doff,dsz);
        }
        if (!meta||!pix) return null;

        const w=meta.width??64, h=meta.height??64;
        const fmt=String(meta.format??'').toUpperCase();
        const tmp=new Uint8Array(w*h*4);
        const bW=Math.ceil(w/4), bH=Math.ceil(h/4);

        if (fmt.includes('BC1')||fmt==='71') {
            for (let by=0;by<bH;by++) for (let bx=0;bx<bW;bx++)
                _decodeBC1Block(pix,(by*bW+bx)*8,tmp,bx,by,w,false);
        } else if (fmt.includes('BC3')||fmt==='77') {
            for (let by=0;by<bH;by++) for (let bx=0;bx<bW;bx++)
                _decodeBC3Block(pix,(by*bW+bx)*16,tmp,bx,by,w);
        } else if (fmt.includes('BC4')||fmt==='80') {
            for (let by=0;by<bH;by++) for (let bx=0;bx<bW;bx++)
                _decodeBC4Block(pix,(by*bW+bx)*8,tmp,bx,by,w);
        } else {
            const raw=pix.slice(0,w*h*4);
            if (fmt.includes('BGR')||fmt==='87') {
                for (let i=0;i<raw.length;i+=4) { tmp[i]=raw[i+2];tmp[i+1]=raw[i+1];tmp[i+2]=raw[i];tmp[i+3]=raw[i+3]??255; }
            } else { tmp.set(raw); }
        }

        // Flip Y: BC/image data is top-to-bottom, DataTexture expects bottom-to-top
        const rgba=new Uint8Array(w*h*4);
        for (let row=0;row<h;row++) rgba.set(tmp.subarray(row*w*4,(row+1)*w*4),(h-1-row)*w*4);

        const tex=new THREE.DataTexture(rgba,w,h,THREE.RGBAFormat,THREE.UnsignedByteType);
        tex.needsUpdate=true;
        console.log(`[dye-tex] loaded ${filename} ${w}×${h} fmt=${fmt}`);
        return tex;
    } catch(e) {
        console.warn('[dye-tex] failed:', e.message);
        return null;
    }
}

function makeDyeMaterial(cfg, dyeTex) {
    const p = cfg.primary;
    const s = cfg.secondary ?? cfg.primary;
    const w = cfg.worn     ?? cfg.primary;
    const pCol = liftDark(p.color), sCol = liftDark(s.color), wCol = liftDark(w.color);

    const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });
    // Must be set before onBeforeCompile — defines determine which shader template is selected
    if (dyeTex) mat.defines.USE_UV = '';
    mat.onBeforeCompile = (shader) => {
        shader.uniforms.u_pColor = { value: new THREE.Color(pCol[0], pCol[1], pCol[2]) };
        shader.uniforms.u_sColor = { value: new THREE.Color(sCol[0], sCol[1], sCol[2]) };
        shader.uniforms.u_wColor = { value: new THREE.Color(wCol[0], wCol[1], wCol[2]) };
        shader.uniforms.u_pRough = { value: p.roughness ?? 0.6 };
        shader.uniforms.u_sRough = { value: s.roughness ?? p.roughness ?? 0.6 };
        shader.uniforms.u_pMetal = { value: p.metalness ?? 0.1 };
        shader.uniforms.u_sMetal = { value: s.metalness ?? p.metalness ?? 0.1 };

        if (dyeTex) {
            shader.uniforms.u_dyeMap = { value: dyeTex };
            const fp =
                'uniform vec3 u_pColor, u_sColor, u_wColor;\n' +
                'uniform float u_pRough, u_sRough, u_pMetal, u_sMetal;\n' +
                'uniform sampler2D u_dyeMap;\n';
            shader.fragmentShader = fp + shader.fragmentShader
                .replace('#include <color_fragment>', `
#include <color_fragment>
{
  vec3 zm = texture2D(u_dyeMap, vUv).rgb;
  float pm = clamp(zm.r, 0.0, 1.0);
  float sm = clamp(zm.g, 0.0, 1.0);
  float wm = clamp(1.0 - pm - sm, 0.0, 1.0);
  diffuseColor.rgb = u_pColor * pm + u_sColor * sm + u_wColor * wm;
}`)
                .replace('#include <roughnessmap_fragment>', `
#include <roughnessmap_fragment>
{ float pm=clamp(texture2D(u_dyeMap,vUv).r,0.0,1.0); roughnessFactor=u_pRough*pm+u_sRough*(1.0-pm); }`)
                .replace('#include <metalnessmap_fragment>', `
#include <metalnessmap_fragment>
{ float pm=clamp(texture2D(u_dyeMap,vUv).r,0.0,1.0); metalnessFactor=u_pMetal*pm+u_sMetal*(1.0-pm); }`);
        } else {
            // Vertex mask fallback: color0.g=primary, color0.b=secondary (currently all G=1 → all primary)
            shader.vertexShader =
                'attribute vec4 dyeMask;\nvarying vec4 vDyeMask;\n' +
                shader.vertexShader.replace('void main() {', 'void main() {\n  vDyeMask = dyeMask;');
            const fp =
                'varying vec4 vDyeMask;\n' +
                'uniform vec3 u_pColor, u_sColor, u_wColor;\n' +
                'uniform float u_pRough, u_sRough, u_pMetal, u_sMetal;\n';
            shader.fragmentShader = fp + shader.fragmentShader
                .replace('#include <color_fragment>', `
#include <color_fragment>
{
  float pm=clamp(vDyeMask.g,0.0,1.0); float sm=clamp(vDyeMask.b,0.0,1.0);
  diffuseColor.rgb=u_pColor*pm+u_sColor*sm+u_wColor*clamp(1.0-pm-sm,0.0,1.0);
}`)
                .replace('#include <roughnessmap_fragment>', `
#include <roughnessmap_fragment>
{ float pm=clamp(vDyeMask.g,0.0,1.0); roughnessFactor=u_pRough*pm+u_sRough*(1.0-pm); }`)
                .replace('#include <metalnessmap_fragment>', `
#include <metalnessmap_fragment>
{ float pm=clamp(vDyeMask.g,0.0,1.0); metalnessFactor=u_pMetal*pm+u_sMetal*(1.0-pm); }`);
        }
    };
    mat.customProgramCacheKey = () => `dye:${dyeTex?'tex':'vtx'}:${pCol}:${sCol}:${wCol}:${p.roughness}:${p.metalness}`;
    return mat;
}

function applyDyeColor(group, cfg, dyeTex) {
    const mat = makeDyeMaterial(cfg, dyeTex);
    group.traverse(obj => { if (obj.isMesh) obj.material = mat; });
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

async function loadGearItem(itemHash, visualHash, assetMap, geomMap) {
    const hash = visualHash ?? itemHash;

    let asset = assetMap?.[hash] ?? assetMap?.[itemHash] ?? null;
    if (!asset) {
        let assetResp = await fetch(`/api/gear/assets/${hash}`);
        if (!assetResp.ok && hash !== itemHash) assetResp = await fetch(`/api/gear/assets/${itemHash}`);
        if (!assetResp.ok) return null;
        asset = await assetResp.json();
    }
    if (!asset) return null;

    const geomFiles = asset?.content?.[0]?.geometry ?? [];
    if (!geomFiles.length) return null;

    const allTex  = asset?.content?.[0]?.textures ?? [];
    const dyeIdxs = asset?.content?.[0]?.dye_index_set?.textures ?? [];
    const dyeFile = dyeIdxs.length ? allTex[dyeIdxs[0]] : null;

    const [group, dyeTex] = await Promise.all([
        (async () => {
            const g = new THREE.Group();
            g.rotation.x = -Math.PI / 2;
            try {
                const geomBuf = geomMap?.[geomFiles[0]];
                const m = geomBuf
                    ? loadItemGeometryFromBuffer(geomBuf)
                    : await loadItemGeometry(geomFiles[0]);
                if (m) g.add(m);
            } catch {}
            return g.children.length ? g : null;
        })(),
        dyeFile ? loadDyeTexture(dyeFile) : Promise.resolve(null),
    ]);

    return group ? { group, dyeTex } : null;
}

async function loadCharacterGear(equipment, fallbackColor) {
    const armorItems  = equipment.filter(item => ARMOR_BUCKETS.has(item.bucketHash));
    const weaponItems = WEAPON_SLOT_ORDER
        .map(bucket => equipment.find(i => i.bucketHash === bucket))
        .filter(Boolean);
    const allItems = [...armorItems, ...weaponItems];

    // Phase 1: one assets request for all items in this character
    const allHashes = [...new Set(allItems.flatMap(i => {
        const h = [i.itemHash];
        if (i.visualHash && i.visualHash !== i.itemHash) h.push(i.visualHash);
        return h;
    }))];
    const assetMap = allHashes.length
        ? await fetch('/api/gear/assets-batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ hashes: allHashes }),
          }).then(r => r.ok ? r.json() : {}).catch(() => ({}))
        : {};

    // Phase 2: extract file sets and plug hashes from assetMap
    const geomSet = new Set(), dyeSet = new Set();
    for (const item of allItems) {
        const asset   = assetMap[item.visualHash ?? item.itemHash] ?? assetMap[item.itemHash];
        const geom    = asset?.content?.[0]?.geometry?.[0];
        if (geom) geomSet.add(geom);
        const allTex  = asset?.content?.[0]?.textures ?? [];
        const dyeIdxs = asset?.content?.[0]?.dye_index_set?.textures ?? [];
        if (dyeIdxs.length) { const f = allTex[dyeIdxs[0]]; if (f) dyeSet.add(f); }
    }
    const allPlugHashes = [...new Set(allItems.flatMap(i => i.plugHashes ?? []))];
    const uncachedPlugs = allPlugHashes.filter(h => !_defCache.has(h));

    // Phase 3: geometry + textures + plug defs in parallel
    const [geomMap, , plugDefBulk] = await Promise.all([
        geomSet.size ? fetchGeometryBatch([...geomSet]) : Promise.resolve({}),
        dyeSet.size  ? fetchTexturesBatch([...dyeSet]).then(map => {
            for (const [f, buf] of Object.entries(map)) _textureCache.set(f, buf);
        }) : Promise.resolve(),
        uncachedPlugs.length
            ? fetch('/api/gear/item-defs', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ hashes: uncachedPlugs }),
              }).then(r => r.ok ? r.json() : {}).catch(() => ({}))
            : Promise.resolve({}),
    ]);
    for (const h of uncachedPlugs) {
        if (!_defCache.has(h)) _defCache.set(h, Promise.resolve(plugDefBulk[h] ?? null));
    }

    // Phase 4: identify shader plugs; pre-populate weapon assets from assetMap
    const resolvedPlugDefs = await Promise.all(allPlugHashes.map(h => _defCache.get(h) ?? Promise.resolve(null)));
    const shaderPlugHashes = [];
    for (let i = 0; i < allPlugHashes.length; i++) {
        const h = allPlugHashes[i], def = resolvedPlugDefs[i];
        if (!def || h === DEFAULT_SHADER) continue;
        if (def.plugCategoryHash === SHADER_CAT_HASH || def.plugCategoryIdentifier?.includes('cosmetics'))
            shaderPlugHashes.push(h);
    }
    for (const item of weaponItems) {
        const h = item.visualHash ?? item.itemHash;
        const asset = assetMap[h] ?? assetMap[item.itemHash];
        if (asset) { _shaderAssetCache.set(h, asset); _shaderAssetCache.set(item.itemHash, asset); }
    }

    // Phase 5: batch shader plug assets not already cached
    const missingShaderHashes = shaderPlugHashes.filter(h => !_shaderAssetCache.has(h));
    if (missingShaderHashes.length) {
        const bulk = await fetch('/api/gear/assets-batch', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hashes: missingShaderHashes }),
        }).then(r => r.ok ? r.json() : {}).catch(() => ({}));
        for (const [h, asset] of Object.entries(bulk)) _shaderAssetCache.set(Number(h), asset);
    }

    // Phase 6: extract gear-desc files from shader+weapon assets, batch fetch
    const gearDescFileSet = new Set();
    for (const asset of _shaderAssetCache.values()) {
        const gf = asset?.gear?.[0];
        if (gf && !_gearDescCache.has(gf)) gearDescFileSet.add(gf);
    }
    if (gearDescFileSet.size) {
        const descBulk = await fetchGearDescsBatch([...gearDescFileSet]);
        for (const [f, desc] of Object.entries(descBulk)) _gearDescCache.set(f, desc);
    }

    // Phase 7: render all items — all caches warm, no individual requests fire
    const [armorParts, weaponGroups] = await Promise.all([
        Promise.allSettled(armorItems.map(async item => {
            const result = await loadGearItem(item.itemHash, item.visualHash, assetMap, geomMap);
            if (result) {
                const { group: g, dyeTex } = result;
                const dyeSpec = await getShaderColor(item.plugHashes ?? []);
                if (dyeSpec) applyDyeColor(g, dyeSpec, dyeTex);
                else if (fallbackColor) applyPrimaryColor(g, fallbackColor);
                return g;
            }
            return null;
        })),
        Promise.all(WEAPON_SLOT_ORDER.map(async bucket => {
            const item = equipment.find(i => i.bucketHash === bucket);
            if (!item) return null;
            try {
                const result = await loadGearItem(item.itemHash, item.visualHash, assetMap, geomMap);
                if (result) {
                    const { group: g, dyeTex } = result;
                    const dyeSpec = await getShaderColor(item.plugHashes ?? []) ?? await fetchItemGearColor(item.visualHash ?? item.itemHash);
                    if (dyeSpec) applyDyeColor(g, dyeSpec, dyeTex);
                    else if (fallbackColor) applyPrimaryColor(g, fallbackColor);
                    return g;
                }
                return null;
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
        renderer.toneMapping         = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        renderer.outputColorSpace    = THREE.SRGBColorSpace;
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

const _defCache        = new Map();
const _textureCache    = new Map(); // filename → ArrayBuffer
const _gearDescCache   = new Map(); // md5 → descriptor
const _shaderAssetCache = new Map(); // hash → asset JSON

function fetchItemDef(hash) {
    if (_defCache.has(hash)) return _defCache.get(hash);
    const p = fetch(`/api/gear/item-def/${hash}`)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null);
    _defCache.set(hash, p);
    return p;
}

async function _unpackBinaryBatch(endpoint, body) {
    const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    }).catch(() => null);
    if (!resp?.ok) return {};
    const buf   = await resp.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const view  = new DataView(buf);
    const result = {};
    let off = 0;
    const count = view.getUint32(off, true); off += 4;
    for (let i = 0; i < count; i++) {
        const nameLen = view.getUint16(off, true); off += 2;
        const name    = new TextDecoder().decode(bytes.subarray(off, off + nameLen)); off += nameLen;
        const dataLen = view.getUint32(off, true); off += 4;
        result[name]  = buf.slice(off, off + dataLen); off += dataLen;
    }
    return result;
}

const fetchGeometryBatch = (files) => _unpackBinaryBatch('/api/gear/geometry-batch', { files });

const fetchTexturesBatch  = (files) => _unpackBinaryBatch('/api/gear/textures-batch', { files });
const fetchGearDescsBatch = (files) => fetch('/api/gear/gear-descs-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
}).then(r => r.ok ? r.json() : {}).catch(() => ({}));

const _iconCache = new Map();

async function prefetchIcons(paths) {
    const uncached = paths.filter(p => p && !_iconCache.has(p));
    if (!uncached.length) return;

    const pack = await fetch('/api/gear/icons-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: uncached }),
    }).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null);
    if (!pack) return;

    const bytes = new Uint8Array(pack);
    const view  = new DataView(pack);
    const dec   = new TextDecoder();
    let off = 0;
    const count = view.getUint32(off, true); off += 4;
    for (let i = 0; i < count; i++) {
        const pLen = view.getUint16(off, true); off += 2;
        const path = dec.decode(bytes.subarray(off, off + pLen)); off += pLen;
        const cLen = view.getUint16(off, true); off += 2;
        const ct   = dec.decode(bytes.subarray(off, off + cLen)); off += cLen;
        const dLen = view.getUint32(off, true); off += 4;
        const blob = new Blob([pack.slice(off, off + dLen)], { type: ct }); off += dLen;
        _iconCache.set(path, URL.createObjectURL(blob));
    }
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
                const asset = _shaderAssetCache.has(ph)
                    ? _shaderAssetCache.get(ph)
                    : await fetch(`/api/gear/assets/${ph}`).then(r => {
                        console.log(`[shader] ${ph} asset HTTP ${r.status}`);
                        return r.ok ? r.json() : null;
                    });
                if (!asset) { console.log(`[shader] ${ph} no asset`); return null; }
                console.log(`[shader] ${ph} asset keys:`, Object.keys(asset));
                const gf = asset?.gear?.[0];
                if (!gf) { console.log(`[shader] ${ph} no gear file`); return null; }
                const desc = _gearDescCache.has(gf)
                    ? _gearDescCache.get(gf)
                    : await fetch(`/api/gear/gear-desc/${gf}`).then(r => {
                        console.log(`[shader] ${ph} desc HTTP ${r.status}`);
                        return r.ok ? r.json() : null;
                    });
                console.log(`[shader] ${ph} material_properties:`, JSON.stringify(desc?.default_dyes?.[0]?.material_properties));
                const mp    = desc?.default_dyes?.[0]?.material_properties ?? {};
                const pTint = mp.primary_albedo_tint;
                if (!Array.isArray(pTint) || pTint.length < 3) return null;
                const pParams = mp.primary_material_params ?? [];
                const sTint   = mp.secondary_albedo_tint;
                const sParams = mp.secondary_material_params ?? [];
                const wTint   = mp.primary_worn_albedo_tint;
                console.log(`[shader-zones] ${ph} pri`, pTint.slice(0,3).map(v=>v.toFixed(3)), 'sec', sTint?.slice(0,3).map(v=>v.toFixed(3)));
                return {
                    primary: {
                        color:     [pTint[0], pTint[1], pTint[2], pTint[3] ?? 1.0],
                        metalness: pParams[0] ?? 0.1,
                        roughness: calcRoughness(pParams, mp.primary_roughness_remap),
                    },
                    secondary: Array.isArray(sTint) && sTint.length >= 3 ? {
                        color:     [sTint[0], sTint[1], sTint[2], sTint[3] ?? 1.0],
                        metalness: sParams[0] ?? 0.1,
                        roughness: calcRoughness(sParams, mp.secondary_roughness_remap),
                    } : null,
                    worn: Array.isArray(wTint) && wTint.length >= 3 ? {
                        color: [wTint[0], wTint[1], wTint[2], wTint[3] ?? 1.0],
                    } : null,
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
            const asset = _shaderAssetCache.has(itemHash)
                ? _shaderAssetCache.get(itemHash)
                : await fetch(`/api/gear/assets/${itemHash}`).then(r => r.ok ? r.json() : null);
            if (!asset) return null;
            const gf = asset?.gear?.[0];
            if (!gf) return null;
            const desc = _gearDescCache.has(gf)
                ? _gearDescCache.get(gf)
                : await fetch(`/api/gear/gear-desc/${gf}`).then(r => r.ok ? r.json() : null);
            const mp    = desc?.default_dyes?.[0]?.material_properties ?? {};
            const pTint = mp.primary_albedo_tint;
            if (!Array.isArray(pTint) || pTint.length < 3) return null;
            const pParams = mp.primary_material_params ?? [];
            const sTint   = mp.secondary_albedo_tint;
            const sParams = mp.secondary_material_params ?? [];
            const wTint   = mp.primary_worn_albedo_tint;
            return {
                primary: {
                    color:     [pTint[0], pTint[1], pTint[2], pTint[3] ?? 1.0],
                    metalness: pParams[0] ?? 0.1,
                    roughness: calcRoughness(pParams, mp.primary_roughness_remap),
                },
                secondary: Array.isArray(sTint) && sTint.length >= 3 ? {
                    color:     [sTint[0], sTint[1], sTint[2], sTint[3] ?? 1.0],
                    metalness: sParams[0] ?? 0.1,
                    roughness: calcRoughness(sParams, mp.secondary_roughness_remap),
                } : null,
                worn: Array.isArray(wTint) && wTint.length >= 3 ? {
                    color: [wTint[0], wTint[1], wTint[2], wTint[3] ?? 1.0],
                } : null,
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
        const src = iconPath
            ? (_iconCache.get(iconPath) ?? `/api/gear/icon?path=${encodeURIComponent(iconPath)}`)
            : null;
        const iconHtml = src ? `<img class="gib-icon" src="${src}" loading="lazy" alt="">` : ``;
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

    // Bulk-prefetch all item defs in one server round-trip before the render loop
    const _allHashes = new Set();
    for (const item of relevant) {
        _allHashes.add(item.itemHash);
        if (item.visualHash) _allHashes.add(item.visualHash);
        for (const ph of (item.plugHashes ?? [])) _allHashes.add(ph);
    }
    const _uncached = [..._allHashes].filter(h => !_defCache.has(h));
    if (_uncached.length) {
        const _bulk = await fetch('/api/gear/item-defs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hashes: _uncached }),
        }).then(r => r.ok ? r.json() : {}).catch(() => ({}));
        for (const h of _uncached) {
            _defCache.set(h, Promise.resolve(_bulk[h] ?? null));
        }
    }

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

    // Batch-fetch all icons for this character before building DOM
    const _iconPaths = new Set();
    for (const r of results) {
        if (r.status !== 'fulfilled') continue;
        const { baseDef, visualDef, plugDefs } = r.value;
        if (baseDef?.icon)   _iconPaths.add(baseDef.icon);
        if (visualDef?.icon) _iconPaths.add(visualDef.icon);
        for (const d of (plugDefs ?? [])) if (d?.icon) _iconPaths.add(d.icon);
    }
    await prefetchIcons([..._iconPaths]);

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
