/**
 * Supabase Environment Initialization Script
 */
import fs from 'fs';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const envExample = '.env.example';
const envLocal = '.env';
const missing: string[] = [];
const warnings: string[] = [];

if (!fs.existsSync(path.join(rootDir, envLocal))) {
  if (!fs.existsSync(path.join(rootDir, envExample))) {
    console.log('ERROR: Neither .env nor .env.example found.');
    process.exit(1);
  }
  fs.copyFileSync(path.join(rootDir, envExample), path.join(rootDir, envLocal));
  console.log('Created .env from .env.example — please edit with your credentials.');
} else {
  const content = fs.readFileSync(path.join(rootDir, envLocal), 'utf-8');
  if (!content.includes('SUPABASE_URL') || content.includes('your-project-ref')) {
    missing.push('SUPABASE_URL');
    warnings.push('Supabase URL not configured — set SUPABASE_URL in .env');
  }
  if (!content.includes('SUPABASE_ANON_KEY') || content.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...')) {
    missing.push('SUPABASE_ANON_KEY');
    warnings.push('Anon key not configured — set SUPABASE_ANON_KEY in .env');
  }
  if (!content.includes('SUPABASE_SERVICE_ROLE_KEY') || content.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...')) {
    missing.push('SUPABASE_SERVICE_ROLE_KEY');
    warnings.push('Service role key not configured — set SUPABASE_SERVICE_ROLE_KEY in .env');
  }
  if (missing.length > 0) {
    console.log(`WARNING: Missing Supabase credentials: ${missing.join(', ')}`);
    for (const w of warnings) console.log(`  ⚠️  ${w}`);
    console.log('\n  Run: npx supabase login');
    console.log('  Then: npx supabase link --project-ref <your-project-ref>');
    console.log('  Then: npx supabase db push');
    console.log('\n  Or run migrations manually: npx supabase migration up');
  } else {
    console.log('✅ Supabase credentials configured in .env');
  }
  if (content.includes('BINANCE_API_KEY') && !content.includes('your-b')) {
    console.log('✅ CEX API keys present');
  } else {
    console.log('⚠️  CEX API keys not configured — live data feeds disabled');
  }
  if (content.includes('ETHEREUM_RPC_URL') && !content.includes('your-key')) {
    console.log('✅ DEX RPC endpoints present');
  } else {
    console.log('⚠️  DEX RPC endpoints not configured — DEX discovery disabled');
  }
}

const supabaseDir = path.join(rootDir, 'supabase');
if (!fs.existsSync(path.join(supabaseDir, 'config.toml'))) {
  fs.writeFileSync(path.join(supabaseDir, 'config.toml'), '# Supabase CLI configuration\nproject_id = "nova-arbitrage-pro"\nname = "Nova Arbitrage Pro"\norg_id = "your-org-id"\n');
  console.log('Created supabase/config.toml');
}

const migrationsDir = path.join(supabaseDir, 'migrations');
if (!fs.existsSync(migrationsDir)) {
  fs.mkdirSync(migrationsDir, { recursive: true });
  console.log('Created supabase/migrations/');
}

const migrations = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
console.log(`\nMigrations found: ${migrations.length}`);
for (const m of migrations) {
  console.log(`  📄 ${m}`);
}

if (missing.length === 0) {
  console.log('\n✅ Supabase environment ready');
} else {
  console.log('\n⚠️  Supabase environment needs configuration');
  process.exit(0);
}

console.log('\nNext steps:');
console.log('  1. Edit .env with your SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY');
console.log('  2. Run: npx supabase login');
console.log('  3. Run: npx supabase link --project-ref <your-project-ref>');
console.log('  4. Run: npx supabase db push');
console.log('  5. Run: npx tsx scripts/seed-dev-data.ts');
console.log('\nOr, if using remote Supabase:');
console.log('  1. Run migrations from the Supabase dashboard SQL editor');
console.log('  2. Verify with: npx tsx scripts/seed-dev-data.ts');