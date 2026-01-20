/**
 * Solana Edition Fixer
 *
 * A comprehensive tool to fix Rust edition 2024 compatibility issues
 * for Solana/Anchor projects using older toolchains.
 *
 * Problem: Solana platform-tools use Cargo 1.75-1.84, but edition 2024 requires Cargo 1.85+
 * Solution: Pin dependencies to versions that don't require edition 2024
 *
 * @module solana-edition-fixer
 * @author Volta Team
 * @license MIT
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

// Load the database
const database = require('../data/edition2024-database.json');

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
};

/**
 * Print colored text to console
 */
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Print the banner
 */
function printBanner() {
  console.log('');
  log('╔════════════════════════════════════════════════════════════════════╗', 'cyan');
  log('║                                                                    ║', 'cyan');
  log('║   ███████╗ ██████╗ ██╗      █████╗ ███╗   ██╗ █████╗              ║', 'cyan');
  log('║   ██╔════╝██╔═══██╗██║     ██╔══██╗████╗  ██║██╔══██╗             ║', 'cyan');
  log('║   ███████╗██║   ██║██║     ███████║██╔██╗ ██║███████║             ║', 'cyan');
  log('║   ╚════██║██║   ██║██║     ██╔══██║██║╚██╗██║██╔══██║             ║', 'cyan');
  log('║   ███████║╚██████╔╝███████╗██║  ██║██║ ╚████║██║  ██║             ║', 'cyan');
  log('║   ╚══════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝             ║', 'cyan');
  log('║                                                                    ║', 'cyan');
  log('║   Edition 2024 Fixer                                               ║', 'cyan');
  log('║   Fix Rust edition 2024 compatibility for Solana/Anchor           ║', 'cyan');
  log('║                                                                    ║', 'cyan');
  log('║   Created by Volta Team                                            ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════════════╝', 'cyan');
  console.log('');
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
${colors.bold}Usage:${colors.reset}
  solana-edition-fixer [options] [project-path]
  sef [options] [project-path]
  npx solana-edition-fixer [options] [project-path]

${colors.bold}Options:${colors.reset}
  --fix, -f        Apply fixes automatically
  --dry-run, -d    Show what would be changed (default)
  --check, -c      Check only, exit with error if issues found
  --verbose, -v    Show detailed output
  --json           Output as JSON (for CI/CD)
  --quiet, -q      Minimal output
  --help, -h       Show this help message
  --version        Show version number

${colors.bold}Examples:${colors.reset}
  ${colors.dim}# Check current directory for issues${colors.reset}
  solana-edition-fixer

  ${colors.dim}# Check a specific project${colors.reset}
  solana-edition-fixer ./my-anchor-project

  ${colors.dim}# Apply fixes automatically${colors.reset}
  solana-edition-fixer --fix

  ${colors.dim}# Check in CI (exits with error code if issues found)${colors.reset}
  solana-edition-fixer --check

  ${colors.dim}# Output as JSON for scripting${colors.reset}
  solana-edition-fixer --json | jq '.issues'

${colors.bold}What it does:${colors.reset}
  1. Scans your Cargo.lock for dependencies requiring edition 2024
  2. Identifies problematic crate versions
  3. Runs 'cargo update -p <crate> --precise <version>' to downgrade
  4. Creates .cargo/config.toml with MSRV-aware resolver settings

${colors.bold}More info:${colors.reset}
  https://github.com/volta-team/solana-edition-fixer
`);
}

/**
 * Parse Cargo.lock file and extract package information
 */
function parseCargoLock(lockPath) {
  if (!fs.existsSync(lockPath)) {
    return null;
  }

  const content = fs.readFileSync(lockPath, 'utf8');
  const packages = [];

  // Match package blocks - handles both v3 and v4 format
  const lines = content.split('\n');
  let currentPackage = null;

  for (const line of lines) {
    if (line === '[[package]]') {
      if (currentPackage && currentPackage.name && currentPackage.version) {
        packages.push(currentPackage);
      }
      currentPackage = {};
    } else if (currentPackage) {
      const nameMatch = line.match(/^name\s*=\s*"([^"]+)"/);
      const versionMatch = line.match(/^version\s*=\s*"([^"]+)"/);
      const sourceMatch = line.match(/^source\s*=\s*"([^"]+)"/);

      if (nameMatch) currentPackage.name = nameMatch[1];
      if (versionMatch) currentPackage.version = versionMatch[1];
      if (sourceMatch) currentPackage.source = sourceMatch[1];
    }
  }

  // Don't forget the last package
  if (currentPackage && currentPackage.name && currentPackage.version) {
    packages.push(currentPackage);
  }

  return packages;
}

/**
 * Compare semantic versions
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
function compareVersions(v1, v2) {
  // Handle versions with pre-release tags
  const clean1 = v1.split('-')[0].split('+')[0];
  const clean2 = v2.split('-')[0].split('+')[0];

  const parts1 = clean1.split('.').map(s => parseInt(s, 10) || 0);
  const parts2 = clean2.split('.').map(s => parseInt(s, 10) || 0);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

/**
 * Find problematic dependencies in the package list
 */
function findProblematicDeps(packages) {
  const issues = [];
  const crates = database.crates;

  for (const pkg of packages) {
    const crateInfo = crates[pkg.name];
    if (crateInfo) {
      const comparison = compareVersions(pkg.version, crateInfo.maxCompatible);
      if (comparison > 0) {
        issues.push({
          name: pkg.name,
          currentVersion: pkg.version,
          maxCompatible: crateInfo.maxCompatible,
          firstIncompatible: crateInfo.firstIncompatible,
          reason: crateInfo.reason || 'Requires edition 2024',
          usedBy: crateInfo.usedBy || [],
          source: pkg.source
        });
      }
    }
  }

  return issues;
}

/**
 * Generate cargo update commands for fixing issues
 */
function generateCargoUpdateCommands(issues) {
  return issues.map(issue =>
    `cargo update -p ${issue.name} --precise ${issue.maxCompatible}`
  );
}

/**
 * Generate patch section for Cargo.toml
 */
function generatePatchSection(issues) {
  const lines = ['[patch.crates-io]'];
  for (const issue of issues) {
    lines.push(`${issue.name} = "=${issue.maxCompatible}"`);
  }
  return lines.join('\n');
}

/**
 * Generate .cargo/config.toml content
 */
function generateCargoConfig() {
  return `# Cargo configuration for Solana/Anchor compatibility
# Generated by solana-edition-fixer
# https://github.com/volta-team/solana-edition-fixer

[resolver]
# MSRV-aware resolver - prefer versions compatible with rust-version
# Requires Cargo 1.84+ to have effect
incompatible-rust-versions = "fallback"

[net]
# Use git CLI for fetching (more reliable on some systems)
git-fetch-with-cli = true

[registries.crates-io]
# Use sparse registry protocol (faster and more stable)
protocol = "sparse"

[build]
# Recommended for Solana builds
rustflags = ["-C", "target-cpu=sbfv2"]
`;
}

/**
 * Check if Cargo.toml has rust-version set
 */
function checkCargoToml(projectPath) {
  const cargoTomlPath = path.join(projectPath, 'Cargo.toml');
  if (!fs.existsSync(cargoTomlPath)) {
    return { exists: false };
  }

  const content = fs.readFileSync(cargoTomlPath, 'utf8');
  const hasRustVersion = /rust-version\s*=/.test(content);
  const hasPatchSection = /\[patch\.crates-io\]/.test(content);

  // Try to extract rust-version
  const rustVersionMatch = content.match(/rust-version\s*=\s*"([^"]+)"/);
  const rustVersion = rustVersionMatch ? rustVersionMatch[1] : null;

  return {
    exists: true,
    hasRustVersion,
    rustVersion,
    hasPatchSection,
    path: cargoTomlPath
  };
}

/**
 * Apply fixes to the project
 */
function applyFixes(projectPath, issues, options = {}) {
  const results = {
    updated: [],
    failed: [],
    skipped: [],
    configCreated: false,
    cargoTomlUpdated: false
  };

  if (!options.quiet) {
    log('\nApplying fixes...', 'cyan');
  }

  // Step 1: Create .cargo/config.toml if it doesn't exist
  const cargoConfigPath = path.join(projectPath, '.cargo', 'config.toml');
  const cargoDir = path.join(projectPath, '.cargo');

  if (!fs.existsSync(cargoConfigPath)) {
    try {
      if (!fs.existsSync(cargoDir)) {
        fs.mkdirSync(cargoDir, { recursive: true });
      }
      fs.writeFileSync(cargoConfigPath, generateCargoConfig());
      results.configCreated = true;
      if (!options.quiet) {
        log('  ✓ Created .cargo/config.toml', 'green');
      }
    } catch (err) {
      if (!options.quiet) {
        log(`  ✗ Failed to create .cargo/config.toml: ${err.message}`, 'red');
      }
    }
  } else if (!options.quiet) {
    log('  - .cargo/config.toml already exists', 'yellow');
  }

  // Step 2: Run cargo update commands
  for (const issue of issues) {
    const cmd = `cargo update -p ${issue.name} --precise ${issue.maxCompatible}`;
    if (options.verbose) {
      log(`  Running: ${cmd}`, 'dim');
    }

    try {
      const result = spawnSync('cargo', [
        'update', '-p', issue.name, '--precise', issue.maxCompatible
      ], {
        cwd: projectPath,
        stdio: options.verbose ? 'inherit' : 'pipe',
        encoding: 'utf8'
      });

      if (result.status === 0) {
        results.updated.push(issue.name);
        if (!options.quiet) {
          log(`  ✓ ${issue.name}: ${issue.currentVersion} → ${issue.maxCompatible}`, 'green');
        }
      } else {
        // Check if it's just not in the tree
        if (result.stderr && result.stderr.includes('not found')) {
          results.skipped.push(issue.name);
          if (options.verbose) {
            log(`  - ${issue.name}: not in dependency tree`, 'yellow');
          }
        } else {
          results.failed.push({
            name: issue.name,
            error: result.stderr || 'Unknown error'
          });
          if (!options.quiet) {
            log(`  ✗ ${issue.name}: failed to update`, 'red');
          }
        }
      }
    } catch (err) {
      results.failed.push({ name: issue.name, error: err.message });
      if (!options.quiet) {
        log(`  ✗ ${issue.name}: ${err.message}`, 'red');
      }
    }
  }

  return results;
}

/**
 * Main function - analyze project and optionally apply fixes
 */
function analyze(projectPath, options = {}) {
  const cargoLockPath = path.join(projectPath, 'Cargo.lock');
  const cargoTomlPath = path.join(projectPath, 'Cargo.toml');

  // Check if project exists
  if (!fs.existsSync(cargoTomlPath)) {
    return {
      success: false,
      error: `No Cargo.toml found in ${path.resolve(projectPath)}`
    };
  }

  // Check Cargo.toml configuration
  const cargoTomlInfo = checkCargoToml(projectPath);

  // Parse Cargo.lock
  const packages = parseCargoLock(cargoLockPath);

  if (!packages) {
    return {
      success: false,
      error: 'No Cargo.lock found. Run `cargo generate-lockfile` first.',
      cargoTomlInfo
    };
  }

  // Find problematic dependencies
  const issues = findProblematicDeps(packages);

  return {
    success: true,
    projectPath: path.resolve(projectPath),
    totalPackages: packages.length,
    issues,
    cargoTomlInfo,
    commands: generateCargoUpdateCommands(issues),
    patchSection: generatePatchSection(issues)
  };
}

/**
 * CLI entry point
 */
function run(args) {
  // Parse arguments
  const options = {
    fix: args.includes('--fix') || args.includes('-f'),
    dryRun: args.includes('--dry-run') || args.includes('-d'),
    check: args.includes('--check') || args.includes('-c'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    quiet: args.includes('--quiet') || args.includes('-q'),
    json: args.includes('--json'),
    help: args.includes('--help') || args.includes('-h'),
    version: args.includes('--version')
  };

  // Get project path (first non-flag argument)
  const projectPath = args.find(arg => !arg.startsWith('-')) || '.';

  // Handle special flags
  if (options.version) {
    const pkg = require('../package.json');
    console.log(pkg.version);
    return;
  }

  if (options.help) {
    printBanner();
    printHelp();
    return;
  }

  // Print banner unless in quiet/json mode
  if (!options.json && !options.quiet) {
    printBanner();
  }

  // Analyze project
  const result = analyze(projectPath, options);

  // Handle JSON output
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    if (options.check && result.issues && result.issues.length > 0) {
      process.exit(1);
    }
    return;
  }

  // Handle errors
  if (!result.success) {
    log(`Error: ${result.error}`, 'red');
    process.exit(1);
  }

  // Print analysis results
  if (!options.quiet) {
    log(`Project: ${result.projectPath}`, 'blue');
    log(`Packages in Cargo.lock: ${result.totalPackages}`, 'blue');
    console.log('');
  }

  // Check rust-version
  if (!options.quiet && result.cargoTomlInfo && !result.cargoTomlInfo.hasRustVersion) {
    log('⚠ Warning: No rust-version specified in Cargo.toml', 'yellow');
    log('  Add: rust-version = "1.75" to your [package] section', 'dim');
    console.log('');
  }

  // No issues found
  if (result.issues.length === 0) {
    if (!options.quiet) {
      log('════════════════════════════════════════════════════════════════════', 'green');
      log('✓ No edition 2024 compatibility issues found!', 'green');
      log('════════════════════════════════════════════════════════════════════', 'green');
    }
    return;
  }

  // Print issues
  if (!options.quiet) {
    log(`Found ${result.issues.length} problematic dependencies:`, 'yellow');
    console.log('');

    for (const issue of result.issues) {
      log(`  ⚠ ${issue.name}`, 'yellow');
      log(`    Current: ${issue.currentVersion}`, 'red');
      log(`    Compatible: ${issue.maxCompatible}`, 'green');
      if (options.verbose && issue.reason) {
        log(`    Reason: ${issue.reason}`, 'dim');
      }
      console.log('');
    }
  }

  // Check mode - just report and exit
  if (options.check) {
    log('════════════════════════════════════════════════════════════════════', 'red');
    log(`✗ Found ${result.issues.length} compatibility issues`, 'red');
    log('════════════════════════════════════════════════════════════════════', 'red');
    process.exit(1);
  }

  // Apply fixes
  if (options.fix) {
    const fixResults = applyFixes(projectPath, result.issues, options);

    console.log('');
    log('════════════════════════════════════════════════════════════════════', 'cyan');
    log('Results:', 'cyan');
    log(`  Updated: ${fixResults.updated.length}`, 'green');
    log(`  Skipped: ${fixResults.skipped.length}`, 'yellow');
    log(`  Failed:  ${fixResults.failed.length}`, 'red');
    if (fixResults.configCreated) {
      log(`  Created: .cargo/config.toml`, 'green');
    }
    log('════════════════════════════════════════════════════════════════════', 'cyan');

    if (fixResults.failed.length > 0) {
      console.log('');
      log('Some dependencies could not be updated automatically.', 'yellow');
      log('Try adding a [patch.crates-io] section to your Cargo.toml:', 'yellow');
      console.log('');
      console.log(generatePatchSection(
        result.issues.filter(i => fixResults.failed.some(f => f.name === i.name))
      ));
    }

    console.log('');
    log('Next steps:', 'cyan');
    log('  1. Try building: cargo build-sbf', 'white');
    log('  2. Or with Anchor: anchor build', 'white');
    console.log('');
  } else {
    // Dry run - show instructions
    console.log('');
    log('════════════════════════════════════════════════════════════════════', 'cyan');
    log('To fix these issues, run:', 'cyan');
    log('════════════════════════════════════════════════════════════════════', 'cyan');
    console.log('');

    log('Option 1: Run this tool with --fix', 'blue');
    console.log('');
    log('  solana-edition-fixer --fix', 'white');

    console.log('');
    log('Option 2: Run cargo update commands manually', 'blue');
    console.log('');
    for (const cmd of result.commands) {
      log(`  ${cmd}`, 'white');
    }

    console.log('');
    log('Option 3: Add to Cargo.toml', 'blue');
    console.log('');
    console.log(result.patchSection);

    console.log('');
  }
}

// Export for programmatic use
module.exports = {
  analyze,
  applyFixes,
  parseCargoLock,
  findProblematicDeps,
  generateCargoUpdateCommands,
  generatePatchSection,
  generateCargoConfig,
  compareVersions,
  database,
  run
};
