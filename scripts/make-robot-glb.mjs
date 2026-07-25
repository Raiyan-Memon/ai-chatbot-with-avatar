/**
 * Generates a robot avatar as a binary glTF, with the morph targets the lip
 * sync needs: `jawOpen` on the jaw, `eyeBlinkLeft`/`eyeBlinkRight` on the eyes.
 *
 *   node scripts/make-robot-glb.mjs
 *
 * Geometry comes from three.js primitives with their transforms baked in, so
 * every node sits at the origin and no skeleton is involved.
 */

import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";

const OUTPUT = path.join(process.cwd(), "public", "robot.glb");

const FLOAT = 5126;
const UNSIGNED_INT = 5125;
const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;

const materials = [
  // 0 — brushed metal shell
  {
    name: "Shell",
    pbrMetallicRoughness: {
      baseColorFactor: [0.63, 0.67, 0.73, 1],
      metallicFactor: 0.9,
      roughnessFactor: 0.35,
    },
  },
  // 1 — matte dark, for the visor and the inside of the mouth
  {
    name: "Dark",
    pbrMetallicRoughness: {
      baseColorFactor: [0.06, 0.07, 0.09, 1],
      metallicFactor: 0.3,
      roughnessFactor: 0.6,
    },
  },
  // 2 — glowing eyes
  {
    name: "Eye",
    pbrMetallicRoughness: {
      baseColorFactor: [0.2, 0.85, 1, 1],
      metallicFactor: 0,
      roughnessFactor: 0.25,
    },
    emissiveFactor: [0.1, 0.7, 0.9],
  },
  // 3 — antenna tip
  {
    name: "Accent",
    pbrMetallicRoughness: {
      baseColorFactor: [1, 0.42, 0.24, 1],
      metallicFactor: 0.1,
      roughnessFactor: 0.4,
    },
    emissiveFactor: [0.7, 0.22, 0.08],
  },
];

const bufferViews = [];
const accessors = [];
const blobs = [];
let offset = 0;

function align() {
  const padding = (4 - (offset % 4)) % 4;
  if (padding) {
    blobs.push(Buffer.alloc(padding));
    offset += padding;
  }
}

function addBufferView(typed, target) {
  align();

  const view = { buffer: 0, byteOffset: offset, byteLength: typed.byteLength };
  if (target) view.target = target;

  bufferViews.push(view);
  blobs.push(Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength));
  offset += typed.byteLength;

  return bufferViews.length - 1;
}

/** Vec3 float accessor. glTF requires min/max on anything used as POSITION. */
function addVec3(values, target) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  for (let i = 0; i < values.length; i += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], values[i + axis]);
      max[axis] = Math.max(max[axis], values[i + axis]);
    }
  }

  accessors.push({
    bufferView: addBufferView(values, target),
    componentType: FLOAT,
    count: values.length / 3,
    type: "VEC3",
    min,
    max,
  });

  return accessors.length - 1;
}

function addIndices(values) {
  accessors.push({
    bufferView: addBufferView(values, ELEMENT_ARRAY_BUFFER),
    componentType: UNSIGNED_INT,
    count: values.length,
    type: "SCALAR",
  });

  return accessors.length - 1;
}

/**
 * @param {THREE.BufferGeometry} geometry  transforms already baked in
 * @param {Record<string, (x,y,z) => [number,number,number]>} [morphs]
 *        target name -> per-vertex delta
 */
function addMesh(name, geometry, material, morphs) {
  const position = geometry.getAttribute("position").array;
  const normal = geometry.getAttribute("normal").array;
  const index = geometry.getIndex().array;

  const primitive = {
    attributes: {
      POSITION: addVec3(new Float32Array(position), ARRAY_BUFFER),
      NORMAL: addVec3(new Float32Array(normal), ARRAY_BUFFER),
    },
    indices: addIndices(new Uint32Array(index)),
    material,
  };

  const mesh = { name, primitives: [primitive] };

  if (morphs) {
    const names = Object.keys(morphs);

    primitive.targets = names.map((target) => {
      const deltas = new Float32Array(position.length);

      for (let i = 0; i < position.length; i += 3) {
        const [dx, dy, dz] = morphs[target](
          position[i],
          position[i + 1],
          position[i + 2],
        );
        deltas[i] = dx;
        deltas[i + 1] = dy;
        deltas[i + 2] = dz;
      }

      return { POSITION: addVec3(deltas) };
    });

    // targetNames is what three.js reads to build morphTargetDictionary.
    mesh.extras = { targetNames: names };
    mesh.weights = names.map(() => 0);
  }

  meshes.push(mesh);
  nodes.push({ mesh: meshes.length - 1, name });
}

const meshes = [];
const nodes = [];

function baked(geometry, { position = [0, 0, 0], rotation, scale } = {}) {
  const result = geometry.toNonIndexed ? geometry : geometry;
  if (scale) result.scale(...scale);
  if (rotation) {
    if (rotation[0]) result.rotateX(rotation[0]);
    if (rotation[1]) result.rotateY(rotation[1]);
    if (rotation[2]) result.rotateZ(rotation[2]);
  }
  result.translate(...position);
  return result;
}

// ---------------------------------------------------------------- the robot

// Head shell. Slightly tapered so it reads as a face, not a crate.
addMesh(
  "Head",
  baked(new THREE.BoxGeometry(1.12, 1.06, 0.94, 4, 4, 4), {
    position: [0, 0.1, 0],
  }),
  0,
);

// Recessed visor the eyes sit in.
addMesh(
  "Visor",
  baked(new THREE.BoxGeometry(0.94, 0.36, 0.06, 2, 2, 2), {
    position: [0, 0.28, 0.47],
  }),
  1,
);

// Eyes. Blinking squashes them flat against their own centre.
for (const [side, x] of [
  ["Left", -0.24],
  ["Right", 0.24],
]) {
  const centreY = 0.28;

  addMesh(
    `Eye${side}`,
    baked(new THREE.CylinderGeometry(0.11, 0.11, 0.07, 24), {
      rotation: [Math.PI / 2, 0, 0],
      position: [x, centreY, 0.5],
    }),
    2,
    {
      [`eyeBlink${side}`]: (_, y) => [0, -(y - centreY) * 0.92, 0],
    },
  );
}

// Dark cavity behind the jaw, revealed as the mouth opens.
addMesh(
  "MouthCavity",
  baked(new THREE.BoxGeometry(0.62, 0.3, 0.12), {
    position: [0, -0.16, 0.42],
  }),
  1,
);

// Jaw. `jawOpen` swings it down and back around a hinge behind the head,
// which reads far better than sliding it straight down.
const hinge = new THREE.Vector3(0, 0.02, 0.06);
// Positive X rotation swings the front of the jaw down and back, since the
// hinge sits above and behind it.
const swing = new THREE.Matrix4().makeRotationX(0.42);

addMesh(
  "Jaw",
  baked(new THREE.BoxGeometry(0.72, 0.26, 0.42, 3, 2, 3), {
    position: [0, -0.18, 0.32],
  }),
  0,
  {
    jawOpen: (x, y, z) => {
      const point = new THREE.Vector3(x, y, z).sub(hinge);
      const swung = point.clone().applyMatrix4(swing).add(hinge);
      return [swung.x - x, swung.y - y, swung.z - z];
    },
  },
);

// Ear cans.
for (const [side, x] of [
  ["Left", -0.6],
  ["Right", 0.6],
]) {
  addMesh(
    `Ear${side}`,
    baked(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 20), {
      rotation: [0, 0, Math.PI / 2],
      position: [x, 0.16, 0],
    }),
    0,
  );
}

// Antenna.
addMesh(
  "Antenna",
  baked(new THREE.CylinderGeometry(0.025, 0.035, 0.34, 12), {
    position: [0, 0.8, -0.05],
  }),
  0,
);

addMesh(
  "AntennaTip",
  baked(new THREE.SphereGeometry(0.075, 20, 16), {
    position: [0, 0.99, -0.05],
  }),
  3,
);

// Neck.
addMesh(
  "Neck",
  baked(new THREE.CylinderGeometry(0.19, 0.24, 0.24, 20), {
    position: [0, -0.52, 0],
  }),
  0,
);

// ------------------------------------------------------------------- output

const binary = Buffer.concat(blobs);

const gltf = {
  asset: { version: "2.0", generator: "make-robot-glb" },
  scene: 0,
  scenes: [{ nodes: nodes.map((_, index) => index) }],
  nodes,
  meshes,
  materials,
  accessors,
  bufferViews,
  buffers: [{ byteLength: binary.length }],
};

const jsonChunk = Buffer.from(JSON.stringify(gltf), "utf8");
const jsonPadding = (4 - (jsonChunk.length % 4)) % 4;
const jsonPadded = Buffer.concat([jsonChunk, Buffer.alloc(jsonPadding, 0x20)]);

const binPadding = (4 - (binary.length % 4)) % 4;
const binPadded = Buffer.concat([binary, Buffer.alloc(binPadding)]);

const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0); // "glTF"
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonPadded.length + 8 + binPadded.length, 8);

function chunk(data, type) {
  const head = Buffer.alloc(8);
  head.writeUInt32LE(data.length, 0);
  head.writeUInt32LE(type, 4);
  return Buffer.concat([head, data]);
}

fs.writeFileSync(
  OUTPUT,
  Buffer.concat([
    header,
    chunk(jsonPadded, 0x4e4f534a), // JSON
    chunk(binPadded, 0x004e4942), // BIN
  ]),
);

const morphed = meshes.filter((mesh) => mesh.extras?.targetNames);

console.log(`wrote ${OUTPUT}`);
console.log(`  ${(fs.statSync(OUTPUT).size / 1024).toFixed(1)} KB`);
console.log(`  ${meshes.length} meshes, ${materials.length} materials`);
for (const mesh of morphed) {
  console.log(`  morphs on "${mesh.name}": ${mesh.extras.targetNames.join(", ")}`);
}
