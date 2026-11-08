import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function createPuppetScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-2, 2, 1.8, -1.8, .1, 30);
  camera.position.set(3.2, 3.1, 7);
  camera.lookAt(0, 1.32, 0);

  scene.add(new THREE.HemisphereLight(0xfff3e4, 0x483054, 2.1));
  function light(color, intensity, x, y, z) {
    const source = new THREE.DirectionalLight(color, intensity);
    source.position.set(x, y, z);
    scene.add(source);
  }
  light(0xffe8d1, 3.1, -3, 5, 5);
  light(0x9fc8ff, 1.8, 3, 2, -3);

  const material = (color, options) => new THREE.MeshStandardMaterial({ color, roughness: .38, ...options });
  const orange = material(0xf6531c);
  const brim = material(0xff8a2f);
  const skin = material(0xe99a61);
  const pearl = material(0xffead0, { metalness: .26 });
  const dark = material(0x211d29, { roughness: .52 });
  const silver = material(0x80798a, { metalness: .62 });
  const glass = material(0x151426, { roughness: .16 });
  const glow = (color) => material(color, { emissive: color, emissiveIntensity: .55 });
  const lime = glow(0xa5ff54);
  const purple = glow(0xbb68ff);
  const coral = glow(0xff6a38);

  function mesh(parent, geometry, surface, x, y, z) {
    const shape = new THREE.Mesh(geometry, surface);
    shape.position.set(x, y, z);
    parent.add(shape);
    return shape;
  }
  function box(parent, surface, x, y, z, width, height, depth, radius = .08) {
    return mesh(parent, new RoundedBoxGeometry(width, height, depth, 3, radius), surface, x, y, z);
  }
  function ball(parent, surface, x, y, z, a, b, c) {
    const shape = mesh(parent, new THREE.SphereGeometry(1, 24, 16), surface, x, y, z);
    shape.scale.set(a, b, c);
    return shape;
  }
  function ring(parent, surface, x, y, z, radius, tube, arc = Math.PI * 2) {
    return mesh(parent, new THREE.TorusGeometry(radius, tube, 10, 48, arc), surface, x, y, z);
  }
  function group(parent, x, y, z) {
    const item = new THREE.Group();
    item.position.set(x, y, z);
    parent.add(item);
    return item;
  }
  function limb(parent, surface, start, end, radius) {
    const a = new THREE.Vector3(...start);
    const b = new THREE.Vector3(...end);
    const midpoint = a.clone().lerp(b, .5);
    const bone = mesh(parent, new THREE.CapsuleGeometry(radius, Math.max(.02, a.distanceTo(b) - radius * 2), 6, 12), surface, midpoint.x, midpoint.y, midpoint.z);
    bone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
  }

  const toy = group(scene, 0, 0, -.15);
  box(toy, orange, 0, 1.04, 0, 1.11, .88, .66, .24);
  box(toy, brim, 0, 1.43, .06, .52, .22, .5, .1);
  box(toy, pearl, 0, 1.13, .341, .22, .15, .025, .02).rotation.z = -.18;
  const head = group(toy, 0, 1.97, 0);
  ball(head, skin, 0, 0, 0, .65, .57, .53);
  const cap = mesh(head, new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI * .58), orange, 0, .28, -.06);
  cap.scale.set(.66, .42, .54);
  ball(head, brim, 0, .265, .42, .60, .066, .36).rotation.x = .12;
  box(head, pearl, .1, .48, .43, .13, .1, .035, .025).rotation.z = -.2;
  ring(head, pearl, 0, .16, -.05, .68, .064, Math.PI);
  for (const side of [-1, 1]) {
    box(head, silver, side * .65, -.02, -.02, .26, .49, .41, .13);
    box(head, pearl, side * .77, -.02, -.02, .10, .39, .32, .045);
  }
  box(head, lime, 0, -.03, .42, 1.18, .40, .24, .14);
  box(head, glass, 0, -.03, .555, 1.06, .30, .075, .10);
  const visorBars = Array.from({ length: 9 }, (_, i) => box(head, lime, (i - 4) * .085, -.035, .598, .024, .145, .018, .01));
  ball(head, dark, .04, -.354, .41, .145, .042, .022).rotation.z = .12;

  const raised = group(toy, -.46, 1.28, .03);
  limb(raised, orange, [0, 0, 0], [-.33, .20, .11], .145);
  limb(raised, orange, [-.31, .12, .10], [-.50, .52, .14], .12);
  ball(raised, skin, -.51, .54, .14, .133, .15, .109);
  limb(raised, skin, [-.57, .56, .16], [-.67, .82, .14], .054);
  limb(raised, skin, [-.48, .57, .15], [-.47, .83, .13], .053);
  const mixerArm = group(toy, .46, 1.28, .06);
  limb(mixerArm, orange, [0, 0, 0], [.28, -.24, .24], .146);
  limb(mixerArm, orange, [.28, -.20, .22], [.27, -.49, .51], .12);
  ball(mixerArm, skin, .27, -.52, .56, .15, .095, .14);

  const mixer = group(scene, 0, 0, .35);
  box(mixer, dark, 0, .37, 0, 2.75, .49, 1.43, .20);
  box(mixer, silver, 0, .575, 0, 2.68, .13, 1.38, .064);
  box(mixer, glass, 0, .31, .70, 1.34, .19, .05, .025);
  const platters = [purple, lime].map((surface, index) => {
    const deck = group(mixer, index ? .72 : -.72, .63, -.04);
    mesh(deck, new THREE.CylinderGeometry(.47, .47, .11, 40), dark, 0, .045, 0);
    ring(deck, surface, 0, .10, 0, .32, .029).rotation.x = Math.PI / 2;
    mesh(deck, new THREE.CylinderGeometry(.23, .23, .045, 30), surface, 0, .102, 0);
    const rotor = group(deck, 0, .133, 0);
    box(rotor, pearl, .21, 0, 0, .105, .023, .036, .008);
    return rotor;
  });
  for (const x of [-.32, -.11, .11, .32]) {
    box(mixer, dark, x, .65, .47, .08, .065, .12, .025);
  }
  [purple, coral, lime].forEach((surface, i) => ball(mixer, surface, (i - 1) * .26, .31, .735, .058, .043, .026));

  let phase = 0;
  let previousTime = null;
  return {
    resize(width, height) {
      const aspect = width / height;
      const halfHeight = Math.max(1.70, 1.85 / aspect);
      camera.left = -halfHeight * aspect;
      camera.right = halfHeight * aspect;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    },
    render(time, { playing, levels }, reducedMotion) {
      const a = levels[0] / 100;
      const b = levels[1] / 100;
      const strength = Math.max(a, b);
      const dt = previousTime === null ? 0 : Math.min(.05, (time - previousTime) / 1000);
      previousTime = time;
      if (reducedMotion) {
        toy.position.y = 0;
        head.rotation.set(0, 0, 0);
        raised.rotation.z = 0;
        mixerArm.rotation.x = 0;
      } else if (playing && strength > 0) {
        phase += dt * 5;
        toy.position.y = Math.sin(phase) * strength * .035;
        head.rotation.x = Math.sin(phase) * strength * .11;
        head.rotation.z = Math.sin(phase * .5) * .08 + (a - b) * .08;
        raised.rotation.z = Math.sin(phase * .54) * strength * .18;
        mixerArm.rotation.x = Math.sin(phase * 1.6) * strength * .09;
        platters[0].rotation.y += dt * a * 3;
        platters[1].rotation.y += dt * b * 3;
      }
      visorBars.forEach((bar, i) => {
        bar.scale.y = .35 + strength * (reducedMotion ? .45 : .25 + Math.abs(Math.sin(phase * 1.7 + i * .68)) * .75);
      });
      purple.emissiveIntensity = .26 + a;
      lime.emissiveIntensity = .34 + b * .75;
      renderer.render(scene, camera);
    },
    dispose() {
      const materials = new Set();
      scene.traverse((object) => {
        object.geometry?.dispose();
        if (object.material) materials.add(object.material);
      });
      materials.forEach((surface) => surface.dispose());
      renderer.dispose();
    },
  };
}
