# Contributing to Solana Edition Fixer

Thank you for your interest in contributing! This tool helps thousands of Solana developers, and your contributions make a real difference.

## How to Contribute

### Reporting New Problematic Crates

The most valuable contribution is identifying new crates that require edition 2024. If you encounter a build failure due to edition 2024:

1. Open an issue with:
   - The crate name and version that failed
   - The error message
   - Your Solana/Anchor version

2. Or submit a PR adding the crate to `data/edition2024-database.json`:

```json
{
  "crate-name": {
    "maxCompatible": "X.Y.Z",
    "firstIncompatible": "X.Y.W",
    "reason": "X.Y.W+ requires edition 2024",
    "usedBy": ["parent-crate-1", "parent-crate-2"],
    "priority": "high|medium|low"
  }
}
```

### Priority Levels

- **critical**: Blocks most Solana builds (e.g., blake3, constant_time_eq)
- **high**: Common in Solana/Anchor projects (e.g., crypto crates)
- **medium**: Less common but still problematic
- **low**: Rarely encountered

### Finding Compatible Versions

To find the last compatible version:

1. Check the crate's Cargo.toml history on GitHub
2. Look for when `edition = "2024"` was added
3. The version just before that change is the `maxCompatible`

Or use:
```bash
cargo search <crate-name> --limit 10
```

### Code Contributions

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Test locally: `node bin/cli.js --dry-run`
5. Submit a PR

### Code Style

- Use ES6+ JavaScript
- Keep functions small and focused
- Add comments for complex logic
- Test with both `--fix` and `--dry-run` modes

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR-USERNAME/solana-edition-fixer.git
cd solana-edition-fixer

# Install dependencies (none currently required)
# npm install

# Test locally
node bin/cli.js --help
node bin/cli.js /path/to/test/project --dry-run
```

## Questions?

Open an issue or reach out to the Volta Team!
