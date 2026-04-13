"use client";

import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { Starfield } from "@/components/Starfield";

interface GraphCanvasProps {
  children: React.ReactNode;
  onPointerMissed?: () => void;
}

export function GraphCanvas({ children, onPointerMissed }: GraphCanvasProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 90], fov: 60, near: 0.1, far: 1000 }}
      style={{ position: "absolute", inset: 0 }}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ gl }) => {
        gl.setClearColor("#050510");
      }}
      onPointerMissed={onPointerMissed}
    >
      <ambientLight intensity={0.15} />
      <pointLight position={[50, 50, 50]} intensity={0.5} />

      <Starfield />
      {children}

      <EffectComposer>
        <Bloom
          intensity={0.08}
          luminanceThreshold={0.92}
          luminanceSmoothing={0.15}
          mipmapBlur
        />
      </EffectComposer>
    </Canvas>
  );
}
