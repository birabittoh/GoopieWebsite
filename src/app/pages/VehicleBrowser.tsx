import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { renderToDataURL } from '../components/WebGLViewport';

// ── Shaders ──────────────────────────────────────────────────────────────────

const VERTEX_SHADER = /* glsl */`\
#version 300 es
precision highp float;
layout (location=0) in vec3 aPosition;
layout (location=1) in vec3 aColor;
uniform mat4 uMVP;
out vec3 vColor;
void main() {
  vColor = aColor;
  gl_Position = uMVP * vec4(aPosition, 1.0);
}
`;

const FRAGMENT_SHADER = /* glsl */`\
#version 300 es
precision highp float;
in vec3 vColor;
out vec4 fragColor;
void main() {
  fragColor = vec4(vColor, 1.0);
}
`;

// ── mat4 math (column-major Float32Array[16]) ─────────────────────────────────

function mat4mul(a: Float32Array, b: Float32Array): Float32Array {
  const r = new Float32Array(16);
  for (let col = 0; col < 4; col++)
    for (let row = 0; row < 4; row++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + row] * b[col * 4 + k];
      r[col * 4 + row] = s;
    }
  return r;
}

function mat4perspective(fovY: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

/** Look-at with world up = (0,1,0). */
function mat4lookAt(ex: number, ey: number, ez: number, cx: number, cy: number, cz: number): Float32Array {
  let fx = cx - ex, fy = cy - ey, fz = cz - ez;
  const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  // right = forward × (0,1,0)
  let sx = -fz, sz = fx;
  const sl = Math.hypot(sx, sz); sx /= sl; sz /= sl;
  // true up = right × forward  (sy=0 since right.y is always 0)
  const vx = -sz * fy, vy = sz * fx - sx * fz, vz = sx * fy;
  return new Float32Array([
    sx, vx, -fx, 0,
    0,  vy, -fy, 0,
    sz, vz, -fz, 0,
    -(sx * ex + sz * ez),
    -(vx * ex + vy * ey + vz * ez),
    fx * ex + fy * ey + fz * ez,
    1,
  ]);
}

function buildMVP(aspect: number): Float32Array {
  return mat4mul(
    mat4perspective(Math.PI / 4, aspect, 0.1, 100),
    mat4lookAt(1.8, 1.4, 1.8, 0, 0, 0),
  );
}

// ── Geometry builders ─────────────────────────────────────────────────────────

interface Geometry { positions: Float32Array; colors: Float32Array; vertexCount: number; }

function makeCube(r: number, g: number, b: number): Geometry {
  const pos: number[] = [], col: number[] = [];
  const face = (verts: [number, number, number][], l: number) =>
    verts.forEach(([x, y, z]) => { pos.push(x, y, z); col.push(r * l, g * l, b * l); });
  const H = 0.5;
  face([[-H, H,-H],[ H, H,-H],[ H, H, H],[-H, H,-H],[ H, H, H],[-H, H, H]], 1.00); // +Y top
  face([[-H,-H,-H],[ H,-H, H],[ H,-H,-H],[-H,-H,-H],[-H,-H, H],[ H,-H, H]], 0.20); // -Y bottom
  face([[-H,-H, H],[ H,-H, H],[ H, H, H],[-H,-H, H],[ H, H, H],[-H, H, H]], 0.85); // +Z front
  face([[ H,-H,-H],[-H,-H,-H],[-H, H,-H],[ H,-H,-H],[-H, H,-H],[ H, H,-H]], 0.40); // -Z back
  face([[ H,-H, H],[ H,-H,-H],[ H, H,-H],[ H,-H, H],[ H, H,-H],[ H, H, H]], 0.70); // +X right
  face([[-H,-H,-H],[-H,-H, H],[-H, H, H],[-H,-H,-H],[-H, H, H],[-H, H,-H]], 0.55); // -X left
  return { positions: new Float32Array(pos), colors: new Float32Array(col), vertexCount: 36 };
}

function makePyramid(r: number, g: number, b: number): Geometry {
  const pos: number[] = [], col: number[] = [];
  const tri = (v0: number[], v1: number[], v2: number[], l: number) => {
    for (const [x, y, z] of [v0, v1, v2]) { pos.push(x, y, z); col.push(r * l, g * l, b * l); }
  };
  const A = [-0.5,-0.5, 0.5], B = [0.5,-0.5, 0.5];
  const C = [ 0.5,-0.5,-0.5], D = [-0.5,-0.5,-0.5], P = [0, 0.5, 0];
  tri(P, A, B, 0.85); tri(P, B, C, 0.70); tri(P, C, D, 0.40); tri(P, D, A, 0.55);
  tri(A, C, B, 0.20); tri(A, D, C, 0.20); // base
  return { positions: new Float32Array(pos), colors: new Float32Array(col), vertexCount: 18 };
}

function makeCylinder(r: number, g: number, b: number, N = 20): Geometry {
  const pos: number[] = [], col: number[] = [];
  const L = Math.hypot(1, 2, 1.5);
  const lx = 1 / L, lz = 1.5 / L;
  const pv = (x: number, y: number, z: number, l: number) => {
    pos.push(x, y, z); col.push(r * l, g * l, b * l);
  };
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
    const am = (a0 + a1) / 2;
    const x0 = Math.cos(a0) * 0.5, z0 = Math.sin(a0) * 0.5;
    const x1 = Math.cos(a1) * 0.5, z1 = Math.sin(a1) * 0.5;
    const sl = Math.max(0, Math.cos(am) * lx + Math.sin(am) * lz) * 0.7 + 0.3;
    // Side quad
    pv(x0, 0.5, z0, sl); pv(x0,-0.5, z0, sl); pv(x1,-0.5, z1, sl);
    pv(x0, 0.5, z0, sl); pv(x1,-0.5, z1, sl); pv(x1, 0.5, z1, sl);
    // Top cap
    pv(0, 0.5, 0, 1.0); pv(x1, 0.5, z1, 1.0); pv(x0, 0.5, z0, 1.0);
    // Bottom cap
    pv(0,-0.5, 0, 0.2); pv(x0,-0.5, z0, 0.2); pv(x1,-0.5, z1, 0.2);
  }
  return { positions: new Float32Array(pos), colors: new Float32Array(col), vertexCount: N * 12 };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => { const k = (n + h / 30) % 12; return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1); };
  return [f(0), f(8), f(4)];
}

// ── Data ──────────────────────────────────────────────────────────────────────

const BASE_NAMES = ['Renut-mobile'];
type ShapeType = 'cube' | 'cylinder' | 'pyramid';
const SHAPE_TYPES: ShapeType[] = ['cube', 'cylinder', 'pyramid'];
const SHAPE_LABELS: Record<ShapeType, string> = { cube: 'Cube', cylinder: 'Cylinder', pyramid: 'Pyramid' };

interface VehicleEntry { id: number; name: string; shape: ShapeType; hue: number; }

const VEHICLES: VehicleEntry[] = Array.from({ length: 100 }, (_, i) => {
  const base = BASE_NAMES[i % BASE_NAMES.length];
  const gen = Math.floor(i / BASE_NAMES.length);
  return { id: i, name: gen === 0 ? base : `${base} Mk${gen + 1}`, shape: SHAPE_TYPES[i % 3], hue: (i / 100) * 360 };
});

const PAGE_SIZE = 25;
const TOTAL_PAGES = Math.ceil(VEHICLES.length / PAGE_SIZE);

// ── Page ──────────────────────────────────────────────────────────────────────

export function VehicleBrowser() {
  const [page, setPage] = useState(0);
  const [snapshots, setSnapshots] = useState<Record<number, string>>({});

  useEffect(() => {
    const mvp = buildMVP(320 / 200);
    const result: Record<number, string> = {};
    for (const v of VEHICLES) {
      const [r, g, b] = hslToRgb(v.hue, 0.9, 0.55);
      const geo = v.shape === 'cube' ? makeCube(r, g, b)
        : v.shape === 'cylinder' ? makeCylinder(r, g, b)
        : makePyramid(r, g, b);
      const url = renderToDataURL({
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        attributes: [
          { name: 'aPosition', data: geo.positions, size: 3 },
          { name: 'aColor',    data: geo.colors,    size: 3 },
        ],
        vertexCount: geo.vertexCount,
        uniforms: [{ name: 'uMVP', type: 'mat4', value: mvp }],
        depth: true,
        width: 320,
        height: 200,
      });
      if (url) result[v.id] = url;
    }
    setSnapshots(result);
  }, []);

  const pageVehicles = useMemo(() => VEHICLES.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [page]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0a0a' }}>
      <header className="px-8 py-4 flex items-center gap-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <h1 className="text-white text-xl font-semibold tracking-wide">Vehicle Browser</h1>
        <span className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>{VEHICLES.length} vehicles</span>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
          {pageVehicles.map(v => (
            <div key={v.id} className="rounded-lg overflow-hidden flex flex-col"
              style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="w-full" style={{ aspectRatio: '16/10', background: '#0d0d0d' }}>
                {snapshots[v.id] ? (
                  <img src={snapshots[v.id]} alt={v.name} className="w-full h-full"
                    style={{ display: 'block', objectFit: 'cover' }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs"
                    style={{ color: 'rgba(255,255,255,0.2)' }}>Rendering…</div>
                )}
              </div>
              <div className="px-3 py-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>{v.name}</p>
                <span className="text-xs shrink-0 px-1.5 py-0.5 rounded"
                  style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)' }}>
                  {SHAPE_LABELS[v.shape]}
                </span>
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer className="px-8 py-4 flex items-center justify-between border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 0}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Previous
        </Button>
        <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Page {page + 1} of {TOTAL_PAGES}
        </span>
        <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page === TOTAL_PAGES - 1}>
          Next <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </footer>
    </div>
  );
}

