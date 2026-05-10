import * as THREE from 'three';

// ---- Binary helpers ----

function u32(bytes, off) {
    return (bytes[off] | bytes[off+1]<<8 | bytes[off+2]<<16 | bytes[off+3]<<24) >>> 0;
}

function str(bytes, off, maxLen) {
    let s = '';
    for (let i = 0; i < maxLen && bytes[off+i] !== 0; i++) s += String.fromCharCode(bytes[off+i]);
    return s;
}

// ---- Container ----

function parseTGXMContainer(buffer) {
    const bytes = new Uint8Array(buffer);
    if (str(bytes, 0, 4) !== 'TGXM') throw new Error('Not a TGXM file');

    const fileOffset = u32(bytes, 0x08);
    const fileCount  = u32(bytes, 0x0C);
    const files = [];
    const lookup = {};

    for (let f = 0; f < fileCount; f++) {
        const base = fileOffset + 0x110 * f;
        const name       = str(bytes, base, 256);
        const dataOffset = u32(bytes, base + 0x100);
        const byteSize   = u32(bytes, base + 0x108);
        let data = buffer.slice(dataOffset, dataOffset + byteSize);
        if (name.endsWith('.js')) {
            data = JSON.parse(new TextDecoder().decode(new Uint8Array(data)));
        }
        lookup[name] = files.length;
        files.push({ name, data });
    }
    return { files, lookup };
}

function getFile(container, name) {
    const idx = container.lookup[name];
    return idx !== undefined ? container.files[idx] : null;
}

// ---- Vertex decoding ----

const TYPE_MAP = [
    ['float',  4, (b,o) => new DataView(b.buffer, b.byteOffset+o).getFloat32(0,true)],
    ['ushort', 2, (b,o) => b[o] | b[o+1]<<8],
    ['short',  2, (b,o) => { const v = b[o]|b[o+1]<<8; return (v<<16)>>16; }],
    ['ubyte',  1, (b,o) => b[o]],
    ['byte',   1, (b,o) => (b[o]<<24)>>24],
];

function decodeElement(bytes, off, typeName, normalized) {
    for (const [type, stride, read] of TYPE_MAP) {
        if (!typeName.startsWith(type)) continue;
        const count = parseInt(typeName.slice(type.length));
        const vals = [];
        for (let j = 0; j < count; j++) {
            let v = read(bytes, off + j*stride);
            if (normalized) {
                if (type === 'ubyte')  v = v / 255;
                else if (type === 'byte')   v = Math.max(v / 127, -1);
                else if (type === 'ushort') v = v / 65535;
                else if (type === 'short')  v = Math.max(v / 32767, -1);
            }
            vals.push(v);
        }
        return vals;
    }
    return [0];
}

// el.offset is in WORD (2-byte) units — multiply by 2 to get byte offset within stride.
function decodeVertexBuffer(bufferData, stride, elements) {
    const bytes = new Uint8Array(bufferData);
    const count = Math.floor(bytes.byteLength / stride);
    const verts = new Array(count);
    for (let v = 0; v < count; v++) {
        const base = v * stride;
        const vert = {};
        for (const el of elements) {
            const typeName = el.type.replace('_vertex_format_attribute_', '');
            const key = el.semantic.replace('_tfx_vb_semantic_', '') + (el.semantic_index ?? 0);
            vert[key] = decodeElement(bytes, base + el.offset * 2, typeName, el.normalized ?? false);
        }
        verts[v] = vert;
    }
    return verts;
}

// ---- Index helpers ----

// Convert D3D triangle strip to CCW triangle list.
// D3D CW: even=[i,i+1,i+2], odd=[i+1,i,i+2] → CCW: even=[i+2,i+1,i], odd=[i+2,i,i+1]
function stripToTriangles(indexBuffer, start, count) {
    const tris = [];
    for (let i = 0; i < count; i++) {
        const o = i & 1 ? [2, 0, 1] : [2, 1, 0];
        const a = indexBuffer[start + i + o[0]];
        const b = indexBuffer[start + i + o[1]];
        const c = indexBuffer[start + i + o[2]];
        if (a === b || b === c || a === c) continue;
        tris.push(a, b, c);
    }
    return tris;
}

// ---- BufferGeometry builder ----

function buildBufferGeometry(verts, indices, posOff, posScl, tcSu, tcSv, tcOu, tcOv) {
    if (!verts.length || !indices.length) return null;
    const vc = verts.length;
    const positions = new Float32Array(vc * 3);
    const normals   = new Float32Array(vc * 3);
    const uvs       = new Float32Array(vc * 2);
    const dyeMasks  = new Float32Array(vc * 4);
    let hasNormals = false;

    for (let v = 0; v < vc; v++) {
        const vt = verts[v];
        const p  = vt.position0 ?? [0,0,0,1];
        positions[v*3]   = p[0] * posScl[0] + posOff[0];
        positions[v*3+1] = p[1] * posScl[1] + posOff[1];
        positions[v*3+2] = p[2] * posScl[2] + posOff[2];

        const tc = vt.texcoord0 ?? [0, 0];
        uvs[v*2]   = tc[0] * tcSu + tcOu;
        uvs[v*2+1] = tc[1] * tcSv + tcOv;

        // Real authored normals — XYZ from short4 normalized (W = tangent sign, ignored).
        const n = vt.normal0;
        if (n && n.length >= 3) {
            normals[v*3]   = n[0];
            normals[v*3+1] = n[1];
            normals[v*3+2] = n[2];
            hasNormals = true;
        }

        // color0: R=AO, G=primary dye zone mask, B=secondary dye zone mask, A=worn/emissive.
        // Default [1,1,0,0] = full AO, fully primary zone, no secondary or worn.
        const c = vt.color0 ?? [1, 1, 0, 0];
        dyeMasks[v*4]   = c[0] ?? 1;
        dyeMasks[v*4+1] = c[1] ?? 1;
        dyeMasks[v*4+2] = c[2] ?? 0;
        dyeMasks[v*4+3] = c[3] ?? 0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv',       new THREE.BufferAttribute(uvs,       2));
    geo.setAttribute('dyeMask',  new THREE.BufferAttribute(dyeMasks,  4));
    geo.setIndex(indices);
    if (hasNormals) {
        geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    } else {
        geo.computeVertexNormals();
    }
    geo.computeBoundingBox();
    return geo;
}

// ---- LOD check (mirrors reference checkRenderPart) ----

const RENDER_LOD_CATEGORIES = new Set([0, 1, 2, 3]);

function shouldRenderPart(sp) {
    const lodVal = sp.lod_category?.value;
    if (lodVal !== undefined && !RENDER_LOD_CATEGORIES.has(lodVal)) return false;
    if (sp.shader?.type === -1) return false;
    return true;
}

// ---- Render mesh assembly ----

function buildRenderMesh(container, rm) {
    const vbInfos    = rm.vertex_buffers;
    const ibInfo     = rm.index_buffer;
    const layoutDefs = rm.stage_part_vertex_stream_layout_definitions;
    if (!vbInfos?.length || !ibInfo || !layoutDefs?.length) return null;

    const formats = layoutDefs[0].formats;

    // Merge vertex buffers
    const mergedVerts = [];
    for (let i = 0; i < vbInfos.length; i++) {
        const vbInfo = vbInfos[i];
        const entry  = getFile(container, vbInfo.file_name);
        if (!entry || !formats[i]) continue;
        const decoded = decodeVertexBuffer(entry.data, vbInfo.stride_byte_size, formats[i].elements);
        for (let v = 0; v < decoded.length; v++) {
            if (!mergedVerts[v]) mergedVerts[v] = {};
            Object.assign(mergedVerts[v], decoded[v]);
        }
    }
    if (!mergedVerts.length) return null;

    // Index buffer
    const ibEntry = getFile(container, ibInfo.file_name);
    if (!ibEntry) return null;
    const ibBytes = new Uint8Array(ibEntry.data);
    const totalIdx = ibInfo.byte_size / ibInfo.value_byte_size;
    const allIdx = new Uint16Array(totalIdx);
    for (let i = 0; i < totalIdx; i++) allIdx[i] = ibBytes[i*2] | ibBytes[i*2+1]<<8;

    // Transform params
    // Search all format groups for the position element (not just vb0).
    const allElements = formats.flatMap(fmt => fmt?.elements ?? []);
    const posEl       = allElements.find(e => e.semantic === '_tfx_vb_semantic_position');
    const posIsFloat  = posEl?.type?.includes('float') ?? false;
    // Float4 positions are already in world space; position_scale/offset apply only to quantized formats.
    const posOff = posIsFloat ? [0,0,0,0] : (rm.position_offset ?? [0,0,0,0]);
    const posScl = posIsFloat ? [1,1,1,1] : (rm.position_scale  ?? [1,1,1,1]);
    const tc0    = rm.texcoord0_scale_offset ?? rm.texcoord_scale_offset ?? [1,1,0,0];
    const [tcSu, tcSv, tcOu, tcOv] = tc0;

    // Stage 0 only: offsets[0]=start, offsets[1]=end (exclusive) of stage 0 in stage_part_list.
    // Using offsets[4] included shadow/depth/LOD stages — geometry in those stages is wrong for display.
    const offsets    = rm.stage_part_offsets ?? [];
    const partStart  = offsets[0] ?? 0;
    const partEnd    = offsets[1] ?? (rm.stage_part_list?.length ?? 0);
    const seenStart  = new Set();

    const group = new THREE.Group();
    for (let p = partStart; p < partEnd; p++) {
        const sp = rm.stage_part_list?.[p];
        if (!sp) continue;
        if (!shouldRenderPart(sp)) continue;

        const idxStart = sp.start_index ?? sp.index_offset ?? 0;
        if (seenStart.has(idxStart)) continue;
        seenStart.add(idxStart);

        const idxCount = sp.index_count ?? 0;
        const primType = sp.primitive_type ?? 3;
        if (idxCount === 0) continue;

        let rawTris;
        if (primType === 5) {
            rawTris = stripToTriangles(allIdx, idxStart, idxCount - 2);
        } else {
            // Triangle list: D3D CW → CCW, swap index 0 and 2 of each triple
            rawTris = Array.from(allIdx.slice(idxStart, idxStart + idxCount));
            for (let t = 0; t < rawTris.length; t += 3) {
                const tmp = rawTris[t]; rawTris[t] = rawTris[t+2]; rawTris[t+2] = tmp;
            }
        }
        if (!rawTris.length) continue;

        // Drop any triangle referencing an out-of-bounds index (strip restart sentinels,
        // 0xFFFF pad values, or idxCount overshoots produce indices >= vertex count,
        // which Three.js maps to position (0,0,0) — visible as lines to world origin).
        const vc = mergedVerts.length;
        const validTris = [];
        for (let t = 0; t < rawTris.length; t += 3) {
            if (rawTris[t] < vc && rawTris[t+1] < vc && rawTris[t+2] < vc) {
                validTris.push(rawTris[t], rawTris[t+1], rawTris[t+2]);
            }
        }
        if (!validTris.length) continue;

        const geo = buildBufferGeometry(mergedVerts, validTris, posOff, posScl, tcSu, tcSv, tcOu, tcOv);
        if (!geo) continue;

        const mat = new THREE.MeshStandardMaterial({
            color:     0x888888,
            metalness: 0.1,
            roughness: 0.6,
            side:      THREE.DoubleSide,
        });
        group.add(new THREE.Mesh(geo, mat));
    }

    return group.children.length ? group : null;
}

// ---- Public API ----

export async function loadItemGeometry(geomFileName) {
    const resp = await fetch(`/api/gear/Geometry/${geomFileName}`);
    if (!resp.ok) throw new Error(`Geometry fetch failed: HTTP ${resp.status}`);

    const buffer    = await resp.arrayBuffer();
    const container = parseTGXMContainer(buffer);

    const metaEntry = container.files.find(f => f.name.endsWith('.js') && typeof f.data === 'object');
    if (!metaEntry) throw new Error('No render_metadata in TGXM');

    // render_meshes[0] = primary opaque mesh. Additional meshes are LOD variants, gender
    // alternates, or shadow casters — rendering all causes overlapping chaotic geometry.
    const renderMeshes = metaEntry.data.render_model?.render_meshes ?? [];
    const group = new THREE.Group();
    const meshGroup = renderMeshes[0] ? buildRenderMesh(container, renderMeshes[0]) : null;
    if (meshGroup) group.add(meshGroup);

    if (!group.children.length) throw new Error('No geometry built from TGXM');
    return group;
}

export function loadItemGeometryFromBuffer(buffer) {
    const container = parseTGXMContainer(buffer);
    const metaEntry = container.files.find(f => f.name.endsWith('.js') && typeof f.data === 'object');
    if (!metaEntry) throw new Error('No render_metadata in TGXM');
    const renderMeshes = metaEntry.data.render_model?.render_meshes ?? [];
    const group = new THREE.Group();
    const meshGroup = renderMeshes[0] ? buildRenderMesh(container, renderMeshes[0]) : null;
    if (meshGroup) group.add(meshGroup);
    if (!group.children.length) throw new Error('No geometry built from TGXM');
    return group;
}
