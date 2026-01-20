#!/usr/bin/env node
/**
 * Solana Edition Fixer CLI
 *
 * Fix Rust edition 2024 compatibility issues for Solana/Anchor projects
 *
 * Usage:
 *   npx solana-edition-fixer [options] [project-path]
 *   sef [options] [project-path]
 *
 * Created by: Volta Team
 * License: MIT
 */

const { run } = require('../src/index');

run(process.argv.slice(2));
