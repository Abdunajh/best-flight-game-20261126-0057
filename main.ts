// Island Hopper — the hand-in program. It copies game/ and screenshots/
// from this repository into the output directory and writes dossier.json
// with buildDossier from vendor/makefun-game.ts. Standard library only,
// no network, deterministic: two runs write the same bytes.
import { buildDossier } from './vendor/makefun-game.ts';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// The repository root is the directory holding this file.
const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
};

// Copy one directory tree, files and directories only, preserving bytes.
function copyTree(src, dest) {
  cpSync(src, dest, { recursive: true, dereference: false });
}

function handIn() {
  // Start from an empty output directory so a second run cannot leave
  // stale files behind: the two graded runs must write the same bytes.
  // Never remove the output directory itself — the grader may run with a
  // read-only parent, so only its contents are cleared.
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  for (const entry of readdirSync(outDir)) {
    rmSync(join(outDir, entry), { recursive: true, force: true });
  }

  const gameSrc = join(repoRoot, 'game');
  const shotsSrc = join(repoRoot, 'screenshots');
  if (!existsSync(gameSrc)) throw new Error('game/ is missing from the repository');
  if (!existsSync(shotsSrc)) throw new Error('screenshots/ is missing from the repository');
  copyTree(gameSrc, join(outDir, 'game'));
  copyTree(shotsSrc, join(outDir, 'screenshots'));

  const dossier = buildDossier(outDir, DOSSIER_CAPS);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  console.log('handed in: game/, screenshots/ and dossier.json -> ' + outDir);
}

handIn();
