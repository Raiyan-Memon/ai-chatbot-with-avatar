"use client";

import * as React from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";

// A .vrm is a GLB with VRM extensions, so GLTFLoader reads it directly — the
// extension in the filename makes no difference.
export const MODEL_URL = "/avatar.vrm";

// Every generator names its blendshapes differently — ARKit, the Oculus viseme
// set, or VRM's Japanese-derived scheme. Take the first one the model has, most
// specific first.
const MOUTH_TARGETS = [
  "jawOpen", // ARKit (Avaturn, MetaPerson, Faceit)
  "mouthOpen", // legacy Ready Player Me, various exporters
  "Fcl_MTH_A", // VRM / VRoid Studio
  "viseme_aa", // Oculus viseme set
  "viseme_O",
  "mouthFunnel", // ARKit fallback
  "A", // bare VRM expression name, last resort
];

const BLINK_TARGETS = [
  "eyeBlinkLeft",
  "eyeBlinkRight",
  "eyesClosed",
  "Fcl_EYE_Close",
  "blink",
];

/** Pairs every morphable mesh with the blendshape indices it should drive. */
function collectMorphTargets(scene) {
  const entries = [];

  scene.traverse((child) => {
    if (!child.isMesh || !child.morphTargetDictionary) return;

    const dictionary = child.morphTargetDictionary;
    const mouth = MOUTH_TARGETS.map((name) => dictionary[name]).find(
      (index) => index !== undefined,
    );
    const eyes = BLINK_TARGETS.map((name) => dictionary[name]).filter(
      (index) => index !== undefined,
    );

    if (mouth !== undefined || eyes.length)
      entries.push({ mesh: child, mouth, eyes });
  });

  return entries;
}

// Humanoid rigs name these consistently enough to find by suffix. Ordered so
// the hierarchy's first match wins (Spine before Chest before UpperChest).
// How far to swing the upper arms down out of the T-pose, in radians.
const ARM_REST = 1.15;

// Resting elbow flexion, so the arms aren't held rigidly straight.
const ELBOW_BEND = 0.22;

const IDLE_BONES = {
  head: /head$/i,
  neck: /neck$/i,
  spine: /(spine|chest|upperchest)$/i,
  hips: /hips$/i,
};

/** Finds the bones idle motion drives, recording their rest pose to offset from. */
function collectIdleRig(scene) {
  const bones = {};
  const arms = {};

  scene.traverse((child) => {
    if (!child.isBone) return;

    // Rigs ship in a T-pose. Collect each arm as a chain so the whole limb can
    // be posed and gestured, not just dropped at the shoulder.
    const side = /(_l_|left)/i.test(child.name)
      ? "left"
      : /(_r_|right)/i.test(child.name)
        ? "right"
        : null;

    if (side) {
      // Forearm first — "UpperArm" would otherwise match the generic arm test.
      const part = /(forearm|lowerarm)$/i.test(child.name)
        ? "lower"
        : /arm$/i.test(child.name)
          ? "upper"
          : /hand$/i.test(child.name)
            ? "hand"
            : null;

      if (part) {
        arms[side] ??= {};
        arms[side][part] ??= { bone: child, rest: child.rotation.clone() };
        return;
      }
    }

    for (const [key, pattern] of Object.entries(IDLE_BONES)) {
      if (!bones[key] && pattern.test(child.name)) {
        bones[key] = {
          bone: child,
          rest: child.rotation.clone(),
          restY: child.position.y,
        };
        break;
      }
    }
  });

  return {
    bones,
    arms,
    root: { y: scene.position.y, x: scene.rotation.x, rotY: scene.rotation.y },
    time: 0,
    look: {
      yaw: 0,
      pitch: 0,
      targetYaw: 0,
      targetPitch: 0,
      timer: 0,
      next: 1.2,
    },
  };
}

/**
 * Poses both arms and gestures with them. `gesture` is a slow 0..1 envelope of
 * speech — gestures happen across phrases, not on individual syllables, so it
 * deliberately lags the mouth.
 */
function animateArms(arms, time, gesture, breath) {
  for (const [side, chain] of Object.entries(arms)) {
    const sign = side === "left" ? -1 : 1;
    // Offsetting the sides keeps the two arms from moving as a mirrored pair.
    const phase = side === "left" ? 0 : 2.1;

    const drift = Math.sin(time * 0.6 + phase) * 0.03 + breath * 0.015;
    const beat = Math.sin(time * 2.6 + phase) * gesture;
    const lift = gesture * 0.5;

    if (chain.upper) {
      const { bone, rest } = chain.upper;
      // Arms come away from the body and swing forward as they talk.
      bone.rotation.z = rest.z + sign * (ARM_REST - lift * 0.3 + drift);
      bone.rotation.x = rest.x - lift * 0.45 + beat * 0.3;
    }

    if (chain.lower) {
      const { bone, rest } = chain.lower;
      // Only z bends the elbow here — rotating y twists along the bone's own
      // length, which shears the hand mesh into a spike.
      bone.rotation.z = rest.z + sign * (ELBOW_BEND + lift * 0.7);
    }

    if (chain.hand) {
      const { bone, rest } = chain.hand;
      bone.rotation.z = rest.z + sign * drift + beat * 0.3;
    }
  }
}

/**
 * Keeps the avatar alive between sentences: breathing, a slow weight shift, and
 * eyes wandering to a new spot every few seconds rather than staring ahead.
 */
function animateIdle(state, scene, delta, openness, gesture) {
  state.time += delta;

  const { look } = state;
  look.timer += delta;

  // Hold a gaze, then pick somewhere new — people glance, they don't sweep.
  if (look.timer >= look.next) {
    look.timer = 0;
    look.next = 1.6 + Math.random() * 3.4;
    look.targetYaw = (Math.random() - 0.5) * 0.9;
    look.targetPitch = (Math.random() - 0.5) * 0.32;
  }

  // Speaking means holding eye contact: the wandering target is scaled toward
  // centre as the speech envelope rises, so the head settles to front rather
  // than snapping there, and glances resume once it goes quiet again.
  const wander = 1 - THREE.MathUtils.clamp(gesture * 1.4, 0, 1);

  look.yaw = THREE.MathUtils.damp(
    look.yaw,
    look.targetYaw * wander,
    2.4,
    delta,
  );
  look.pitch = THREE.MathUtils.damp(
    look.pitch,
    look.targetPitch * wander,
    2.4,
    delta,
  );

  const breath = Math.sin(state.time * 1.5);
  const sway = Math.sin(state.time * 0.45);
  const { head, neck, spine, hips } = state.bones;

  if (head) {
    // Splitting the turn between head and neck avoids the owl look.
    head.bone.rotation.y = head.rest.y + look.yaw * 0.68;
    head.bone.rotation.x =
      head.rest.x + look.pitch + breath * 0.012 + openness * 0.04;
    head.bone.rotation.z = head.rest.z + sway * 0.03;
  }

  if (neck) {
    neck.bone.rotation.y = neck.rest.y + look.yaw * 0.32;
    neck.bone.rotation.x = neck.rest.x + look.pitch * 0.4;
  }

  if (spine) {
    spine.bone.rotation.x = spine.rest.x + breath * 0.02;
    spine.bone.rotation.y = spine.rest.y + sway * 0.035;
  }

  if (hips) {
    hips.bone.position.y = hips.restY + breath * 0.004;
    hips.bone.rotation.y = hips.rest.y + sway * 0.05;
  }

  animateArms(state.arms, state.time, gesture, breath);

  // Unrigged models (the robot) take the same motion on the root instead.
  if (!head) {
    scene.rotation.y = state.root.rotY + look.yaw * 0.5 + sway * 0.06;
    scene.rotation.x = state.root.x + look.pitch * 0.5;
    scene.position.y = state.root.y + breath * 0.02;
  }
}

/**
 * Points the camera at the head. Rigged avatars expose a Head bone; anything
 * else falls back to fitting the whole model in view.
 */
function frameOn(scene, camera, controls) {
  // Bone world positions are stale until the graph is resolved, and this can
  // run before the first full update — without it the head reads as the origin.
  scene.updateMatrixWorld(true);

  let head = null;
  scene.traverse((child) => {
    if (!head && child.isBone && /head$/i.test(child.name)) head = child;
  });

  const focus = new THREE.Vector3();
  let distance;

  if (head) {
    // Framed on the upper body rather than the face: hand gestures happen
    // around hip height and would otherwise sit entirely outside the shot.
    head.getWorldPosition(focus);
    focus.y -= 0.01;
    distance = 0.75;
  } else {
    const box = new THREE.Box3().setFromObject(scene);
    box.getCenter(focus);
    distance = box.getSize(new THREE.Vector3()).length() * 0.9;
  }

  camera.position.set(focus.x, focus.y, focus.z + distance);
  camera.lookAt(focus);

  controls.target.copy(focus);
  controls.update();

  return focus;
}

/** Reads the analyser and returns loudness for this instant, as 0..1. */
function readLevel(analyser, buffer) {
  analyser.getByteTimeDomainData(buffer);

  let sum = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    const sample = (buffer[index] - 128) / 128;
    sum += sample * sample;
  }

  const rms = Math.sqrt(sum / buffer.length);

  // Subtract a noise floor so silence between words fully closes the mouth,
  // then scale up — speech rarely exceeds ~0.12 RMS.
  return THREE.MathUtils.clamp((rms - 0.008) * 9, 0, 1);
}

/**
 * Owns the mouth/blink animation. Returns a ref holding the current openness so
 * the value can be driven at 60fps without re-rendering React.
 */
function useMouthMotion(analyser) {
  const buffer = React.useMemo(
    () => (analyser ? new Uint8Array(analyser.fftSize) : null),
    [analyser],
  );

  const openness = React.useRef(0);
  const gesture = React.useRef(0);
  const blink = React.useRef({ elapsed: 0, next: 2.5, value: 0 });

  function advance(delta) {
    const target = analyser && buffer ? readLevel(analyser, buffer) : 0;

    // Opening fast and closing slower reads as speech rather than flapping.
    const speed = target > openness.current ? 20 : 10;
    openness.current = THREE.MathUtils.damp(
      openness.current,
      target,
      speed,
      delta,
    );

    // A much slower envelope than the mouth: it rises once talking starts and
    // eases off over about a second of silence, so gestures ride the phrase
    // instead of twitching on every syllable.
    const speaking = target > 0.06 ? 1 : 0;
    gesture.current = THREE.MathUtils.damp(
      gesture.current,
      speaking,
      speaking ? 2.2 : 0.9,
      delta,
    );

    const state = blink.current;
    state.elapsed += delta;

    if (state.elapsed >= state.next) {
      const progress = (state.elapsed - state.next) / 0.14;
      state.value = progress < 0.5 ? progress * 2 : 2 - progress * 2;

      if (progress >= 1) {
        state.value = 0;
        state.elapsed = 0;
        state.next = 2.5 + Math.random() * 4;
      }
    }

    return {
      openness: openness.current,
      gesture: gesture.current,
      blink: state.value,
    };
  }

  return advance;
}

function Model({ analyser, url, onRig }) {
  const { scene } = useGLTF(url);
  const { camera, controls } = useThree();
  const advance = useMouthMotion(analyser);

  // A model with no blendshapes cannot move its mouth at all. Surface that
  // instead of failing silently, which just looks like broken lip sync.
  React.useEffect(() => {
    const entries = collectMorphTargets(scene);
    const hasMouth = entries.some((entry) => entry.mouth !== undefined);

    if (!hasMouth) {
      console.warn(
        `[avatar] ${url} has no usable mouth blendshape, so lip sync cannot run. ` +
          `Expected one of: ${MOUTH_TARGETS.join(", ")}.`,
      );
    }

    onRig?.(hasMouth);
  }, [scene, url, onRig]);

  // Populated on the first frame and whenever the model changes. Resolved
  // inside useFrame rather than an effect or memo, since these meshes are
  // mutated every frame and React only sanctions that through untracked refs.
  const rigged = React.useRef({ scene: null, entries: [] });

  useFrame((_, delta) => {
    if (rigged.current.scene !== scene) {
      rigged.current = {
        scene,
        entries: collectMorphTargets(scene),
        idle: collectIdleRig(scene),
        framed: false,
      };
    }

    const current = rigged.current;

    // Deliberately not an effect: OrbitControls mounts on its own schedule and
    // resets its target to the origin, so framing has to happen once controls
    // genuinely exist — otherwise it gets silently undone.
    if (!current.framed && controls) {
      current.focus = frameOn(scene, camera, controls);
      current.framed = true;
    }

    // Reasserted every frame: OrbitControls keeps resetting target to the
    // origin. Panning is off, so the target is meant to be fixed anyway —
    // orbiting and zooming both preserve it.
    if (current.focus && controls) controls.target.copy(current.focus);

    const { openness, gesture, blink } = advance(delta);

    for (const entry of current.entries) {
      const influences = entry.mesh.morphTargetInfluences;
      if (!influences) continue;

      if (entry.mouth !== undefined) influences[entry.mouth] = openness;
      for (const index of entry.eyes) influences[index] = blink;
    }

    animateIdle(current.idle, current.scene, delta, openness, gesture);
  });

  return <primitive object={scene} />;
}

/** Stands in until a real model is dropped in, so the pipeline is testable. */
function PlaceholderHead({ analyser }) {
  const jaw = React.useRef(null);
  const advance = useMouthMotion(analyser);

  useFrame((_, delta) => {
    const { openness } = advance(delta);
    if (jaw.current) jaw.current.scale.y = 0.12 + openness * 0.85;
  });

  return (
    <group scale={0.6} position={[0, 0.08, 0]}>
      <mesh>
        <sphereGeometry args={[1, 48, 48]} />
        <meshStandardMaterial color="#a1a1aa" roughness={0.45} />
      </mesh>
      <mesh position={[-0.32, 0.22, 0.86]}>
        <sphereGeometry args={[0.11, 24, 24]} />
        <meshStandardMaterial color="#18181b" />
      </mesh>
      <mesh position={[0.32, 0.22, 0.86]}>
        <sphereGeometry args={[0.11, 24, 24]} />
        <meshStandardMaterial color="#18181b" />
      </mesh>
      <mesh ref={jaw} position={[0, -0.34, 0.84]}>
        <boxGeometry args={[0.62, 0.5, 0.16]} />
        <meshStandardMaterial color="#3f3f46" />
      </mesh>
    </group>
  );
}

class ModelBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onFailure?.();
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function Avatar({ analyser, className }) {
  // Checked up front so a missing model shows the placeholder quietly, rather
  // than throwing to the boundary and tripping the dev error overlay.
  const [status, setStatus] = React.useState("checking");
  const [riggedForSpeech, setRiggedForSpeech] = React.useState(true);

  React.useEffect(() => {
    let active = true;

    fetch(MODEL_URL, { method: "HEAD" })
      .then(
        (response) => active && setStatus(response.ok ? "ready" : "missing"),
      )
      .catch(() => active && setStatus("missing"));

    return () => {
      active = false;
    };
  }, []);

  const placeholder = <PlaceholderHead analyser={analyser} />;

  return (
    <div className={className}>
      {/* Pinned to the parent box: left to fill normally, R3F's measured size
          goes stale inside a flex column and the canvas ends up short. */}
      <Canvas
        camera={{ fov: 30, position: [0, 0, 3.2] }}
        dpr={[1, 2]}
        style={{ position: "absolute", inset: 0 }}
      >
        {/* Lit with plain lights rather than drei's <Environment>, which pulls
              an HDR from a CDN and suspends the whole canvas until it lands. */}
        <ambientLight intensity={1.1} />
        <hemisphereLight args={["#dfe7ff", "#3a3a44", 1.2]} />
        <directionalLight position={[2, 3, 4]} intensity={2.1} />
        <directionalLight position={[-3, 1, -2]} intensity={0.7} />
        <directionalLight position={[0, -2, 3]} intensity={0.35} />

        {status === "ready" ? (
          <ModelBoundary
            fallback={placeholder}
            onFailure={() => setStatus("missing")}
          >
            <React.Suspense fallback={placeholder}>
              <Model
                analyser={analyser}
                url={MODEL_URL}
                onRig={setRiggedForSpeech}
              />
            </React.Suspense>
          </ModelBoundary>
        ) : (
          placeholder
        )}

        <OrbitControls
          makeDefault
          enablePan={false}
          minDistance={0.35}
          maxDistance={6}
        />
      </Canvas>

      {status === "missing" && (
        <p className="pointer-events-none absolute inset-x-0 bottom-0 bg-card/85 py-2 text-center text-xs text-muted-foreground">
          Placeholder shown — add your model at{" "}
          <code className="font-mono">public/avatar.glb</code>
        </p>
      )}

      {status === "ready" && !riggedForSpeech && (
        <p className="pointer-events-none absolute inset-x-0 bottom-0 bg-card/85 py-2 text-center text-xs text-muted-foreground">
          This model has no mouth blendshapes, so it cannot lip sync
        </p>
      )}
    </div>
  );
}
