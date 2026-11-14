// Sediakan fail besar yang TIDAK disimpan dalam GitHub (had muat naik 25MB):
// 1) enjin ONNX (wasm) dan pemproses SoundTouch dari node_modules
// 2) model AI htdemucs dari pakej npm "demucs" (dipecah kepada bahagian 23MB)
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const pub = join(root, 'public');
const nm = join(root, 'node_modules');

mkdirSync(join(pub, 'ort'), { recursive: true });
for (const f of ['ort-wasm-simd-threaded.asyncify.mjs', 'ort-wasm-simd-threaded.asyncify.wasm']) {
  copyFileSync(join(nm, 'onnxruntime-web', 'dist', f), join(pub, 'ort', f));
}
copyFileSync(join(nm, '@soundtouchjs', 'audio-worklet', '.dist', 'soundtouch-processor.js'), join(pub, 'soundtouch-processor.js'));
console.log('✓ enjin ONNX & SoundTouch disalin');

const MODEL_SHA = 'da9e5101ee0804d04933974b59d8aae9c862e80e14f2f24e7c74cae76bdbe748';
const PART = 23 * 1024 * 1024;
const PARTS = 8;
const modelsDir = join(pub, 'models');
const lastPart = join(modelsDir, `htdemucs_4s.onnx.part${PARTS - 1}`);
if (existsSync(lastPart)) {
  console.log('✓ model AI sudah ada');
} else {
  console.log('… muat turun model AI dari npm (demucs@1.0.0, ±174MB)');
  const tmp = mkdtempSync(join(tmpdir(), 'lepak-'));
  execSync('npm pack demucs@1.0.0 --silent', { cwd: tmp, stdio: 'inherit' });
  execSync('tar -xzf demucs-1.0.0.tgz package/htdemucs.onnx', { cwd: tmp, stdio: 'inherit' });
  const buf = readFileSync(join(tmp, 'package', 'htdemucs.onnx'));
  const sha = createHash('sha256').update(buf).digest('hex');
  if (sha !== MODEL_SHA) throw new Error(`Model rosak (sha ${sha})`);
  mkdirSync(modelsDir, { recursive: true });
  for (let i = 0; i < PARTS; i++) writeFileSync(join(modelsDir, `htdemucs_4s.onnx.part${i}`), buf.subarray(i * PART, (i + 1) * PART));
  rmSync(tmp, { recursive: true, force: true });
  console.log('✓ model AI disediakan');
}
