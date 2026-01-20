# Solana Edition Fixer

[![npm version](https://badge.fury.io/js/solana-edition-fixer.svg)](https://www.npmjs.com/package/solana-edition-fixer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Fix Rust edition 2024 compatibility issues for Solana/Anchor projects.**

Many Rust crates now require `edition = "2024"`, but Solana's platform-tools use Cargo 1.75-1.84 which doesn't support it. This tool automatically downgrades problematic dependencies to compatible versions.

## The Problem

When building Solana programs, you may see errors like:

```
error: failed to download `blake3 v1.8.3`

Caused by:
  feature `edition2024` is required

  The package requires the Cargo feature called `edition2024`, but that feature is
  not stabilized in this version of Cargo (1.75.0).
```

This happens because:
- **Solana platform-tools** (v1.42 - v1.52) bundle **Cargo 1.75 - 1.84**
- **Rust edition 2024** requires **Cargo 1.85+**
- Many popular crates have updated to edition 2024

## Quick Start

### Option 1: npx (Recommended)

```bash
# Check for issues
npx solana-edition-fixer

# Apply fixes
npx solana-edition-fixer --fix
```

### Option 2: Global Install

```bash
npm install -g solana-edition-fixer

# Then use anywhere
solana-edition-fixer --fix
# or the short alias
sef --fix
```

### Option 3: Shell Script (No Node.js Required)

```bash
curl -sSL https://raw.githubusercontent.com/volta-team/solana-edition-fixer/main/scripts/fix-edition2024.sh | bash
```

## Usage

```bash
solana-edition-fixer [options] [project-path]

Options:
  --fix, -f        Apply fixes automatically
  --dry-run, -d    Show what would be changed (default)
  --check, -c      Check only, exit with error if issues found (for CI)
  --verbose, -v    Show detailed output
  --json           Output as JSON
  --quiet, -q      Minimal output
  --help, -h       Show help message
  --version        Show version number
```

### Examples

```bash
# Check current directory
solana-edition-fixer

# Check specific project
solana-edition-fixer ./my-anchor-project

# Apply fixes automatically
solana-edition-fixer --fix

# Use in CI/CD (fails if issues found)
solana-edition-fixer --check

# Get JSON output for scripting
solana-edition-fixer --json | jq '.issues'
```

## What It Does

1. **Scans** your `Cargo.lock` for dependencies requiring edition 2024
2. **Identifies** problematic crate versions using our curated database
3. **Runs** `cargo update -p <crate> --precise <version>` to downgrade
4. **Creates** `.cargo/config.toml` with MSRV-aware resolver settings

### Fixed Crates

The tool fixes 40+ crates including:

| Crate | Incompatible | Compatible |
|-------|-------------|------------|
| `blake3` | >= 1.6.0 | 1.5.0 |
| `constant_time_eq` | >= 0.4.0 | 0.3.1 |
| `base64ct` | >= 1.7.0 | 1.6.0 |
| `subtle` | >= 2.6.0 | 2.5.0 |
| `zeroize` | >= 1.8.0 | 1.7.0 |
| `wit-bindgen` | >= 0.25.0 | 0.24.0 |
| `yoke` | >= 0.8.0 | 0.7.4 |

See [data/edition2024-database.json](./data/edition2024-database.json) for the complete list.

## Manual Fix

If you prefer to fix manually:

### 1. Add to Cargo.toml

```toml
[package]
# ... your package info
rust-version = "1.75"  # Enables MSRV-aware resolver

[patch.crates-io]
# Pin problematic crates
blake3 = "=1.5.0"
constant_time_eq = "=0.3.1"
```

### 2. Create .cargo/config.toml

```toml
[resolver]
incompatible-rust-versions = "fallback"

[net]
git-fetch-with-cli = true

[registries.crates-io]
protocol = "sparse"
```

### 3. Run cargo update

```bash
cargo update -p blake3 --precise 1.5.0
cargo update -p constant_time_eq --precise 0.3.1
```

## CI/CD Integration

### GitHub Actions

```yaml
- name: Fix Solana Dependencies
  run: npx solana-edition-fixer --fix

- name: Build Solana Program
  run: cargo build-sbf
```

### Check Mode

Use `--check` to fail CI if issues are found:

```yaml
- name: Check Dependencies
  run: npx solana-edition-fixer --check
```

## Programmatic API

```javascript
const { analyze, applyFixes, database } = require('solana-edition-fixer');

// Analyze a project
const result = analyze('./my-project');
console.log(result.issues);

// Apply fixes
if (result.issues.length > 0) {
  const fixResult = applyFixes('./my-project', result.issues);
  console.log(`Fixed ${fixResult.updated.length} dependencies`);
}

// Access the database directly
console.log(database.crates['blake3'].maxCompatible); // "1.5.0"
```

## Contributing

Found a new problematic crate? Please contribute!

1. Fork the repository
2. Add the crate to `data/edition2024-database.json`:

```json
{
  "new-crate": {
    "maxCompatible": "X.Y.Z",
    "firstIncompatible": "X.Y.W",
    "reason": "X.Y.W+ requires edition 2024",
    "usedBy": ["parent-crate"],
    "priority": "medium"
  }
}
```

3. Submit a PR

## Why Not Just Upgrade Solana?

Solana's toolchain is intentionally conservative about Rust versions to ensure:
- Deterministic builds across all validators
- BPF/SBF bytecode compatibility
- Security audit consistency

Until Solana's platform-tools upgrade to Cargo 1.85+, this workaround is necessary.

## Related Links

- [Solana Platform Tools](https://github.com/solana-labs/platform-tools)
- [Cargo MSRV-aware Resolver](https://doc.rust-lang.org/cargo/reference/resolver.html#msrv-aware-resolver)
- [Rust Edition 2024](https://doc.rust-lang.org/edition-guide/rust-2024/)
- [Anchor Framework](https://github.com/coral-xyz/anchor)

## License

MIT - Created by **[Volta Team](https://github.com/volta-team)**

---

**Found this helpful?** Give us a star on GitHub!
