import assert from 'assert';

const BASE_URL = 'http://localhost:3000/api';
let passed = 0;
let failed = 0;

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`✅ [PASS] ${name}`);
    passed++;
  } catch (error) {
    console.error(`❌ [FAIL] ${name}`);
    console.error(`   Error: ${error.message}`);
    failed++;
  }
}

async function main() {
  console.log('--- Starting API QA Tests ---');

  // Test Warehouses
  await runTest('GET /api/warehouses returns 200 and is array', async () => {
    const res = await fetch(`${BASE_URL}/warehouses`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert(Array.isArray(data), 'Expected array');
  });

  await runTest('POST /api/warehouses with invalid data returns 400', async () => {
    const res = await fetch(`${BASE_URL}/warehouses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }) // Missing zone, negative components etc
    });
    assert.strictEqual(res.status, 400);
  });

  await runTest('POST /api/warehouses with valid data returns 201 (or 409 if exists)', async () => {
    const res = await fetch(`${BASE_URL}/warehouses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'QA Test Warehouse 2', zone: 'Test Zone', total_components: 100, status: 'Active' })
    });
    assert(res.status === 201 || res.status === 409, `Expected 201 or 409, got ${res.status}`);
  });

  await runTest('POST /api/warehouses with duplicate name returns 409', async () => {
    const res = await fetch(`${BASE_URL}/warehouses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'QA Test Warehouse 2', zone: 'Test Zone', total_components: 100, status: 'Active' })
    });
    assert(res.status === 409, `Expected 409, got ${res.status}`);
  });

  console.log(`\n--- Test Summary: ${passed} passed, ${failed} failed ---`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
