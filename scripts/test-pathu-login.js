async function testNewAuth() {
  const base = 'http://localhost:3000';

  const testCases = [
    { id: 'pathu', pass: '123', expected: 'ADMIN' },
    { id: 'pathu', pass: '1234', expected: 'VOLUNTEER' },
    { id: 'admin', pass: '123', expected: 'ADMIN' },
    { id: 'volunteer1', pass: '1234', expected: 'VOLUNTEER' },
  ];

  for (const tc of testCases) {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: tc.id, password: tc.pass })
    });
    const data = await res.json();
    console.log(`ID: "${tc.id}" + Pass: "${tc.pass}" => Success: ${data.success}, Role: ${data.role}, Redirect: ${data.redirectUrl}`);
  }
}

testNewAuth().catch(console.error);
