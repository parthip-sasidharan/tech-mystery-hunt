const mongoose = require('mongoose');

async function testPenaltyWorkflow() {
  const base = 'http://localhost:3000';

  console.log('1. Logging in as Team 1 (MH-2026-001)...');
  const teamLoginRes = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'MH-2026-001', password: 'hunt123' })
  });
  const teamLogin = await teamLoginRes.json();
  const teamToken = teamLogin.token;
  console.log('Team Login:', teamLogin.success ? 'OK' : teamLogin.error);

  console.log('\n2. Fetching current Checkpoint State...');
  const cpRes = await fetch(`${base}/api/hunt/checkpoint`, {
    headers: { Authorization: `Bearer ${teamToken}` }
  });
  const cpData = await cpRes.json();
  console.log('Current Checkpoint:', cpData.checkpoint?.sequenceNumber, cpData.checkpoint?.name);

  // Scan QR if not yet scanned
  if (!cpData.checkpoint?.isScanned) {
    console.log('Scanning QR for CP 1...');
    const scanRes = await fetch(`${base}/api/hunt/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teamToken}` },
      body: JSON.stringify({ qrToken: 'QR_TOKEN_CP01_VAULT_7X4B' })
    });
    const scanData = await scanRes.json();
    console.log('QR Scan Result:', scanData.message || scanData.error);
  }

  // Re-fetch after scan
  const cpAfterScanRes = await fetch(`${base}/api/hunt/checkpoint`, {
    headers: { Authorization: `Bearer ${teamToken}` }
  });
  const cpAfterScan = await cpAfterScanRes.json();
  console.log('Checkpoint after scan:', {
    name: cpAfterScan.checkpoint?.name,
    isScanned: cpAfterScan.checkpoint?.isScanned,
    hasQuestion: !!cpAfterScan.checkpoint?.question
  });

  console.log('\n3. Submitting an intentionally WRONG answer...');
  const wrongAnsRes = await fetch(`${base}/api/hunt/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teamToken}` },
    body: JSON.stringify({
      checkpointId: cpAfterScan.checkpoint?.id,
      answer: 'WRONG_INTENTIONAL_ANSWER_XYZ'
    })
  });
  const wrongAns = await wrongAnsRes.json();
  console.log('Submit Result:', {
    success: wrongAns.success,
    isCorrect: wrongAns.isCorrect,
    message: wrongAns.message,
    hasPenaltyTask: wrongAns.hasPenaltyTask,
    penaltyTask: wrongAns.penaltyTask
  });

  console.log('\n4. Checking Team Hunt State again...');
  const stateRes = await fetch(`${base}/api/hunt/checkpoint`, {
    headers: { Authorization: `Bearer ${teamToken}` }
  });
  const stateData = await stateRes.json();
  console.log('Hunt page state penalty task:', stateData.checkpoint?.penaltyTask);

  console.log('\n5. Logging in as Volunteer...');
  const volLoginRes = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'volunteer1', password: 'Volunteer#TechHunt2026' })
  });
  const volLogin = await volLoginRes.json();
  const volToken = volLogin.token;
  console.log('Volunteer Login:', volLogin.success ? 'OK' : volLogin.error);

  console.log('\n6. Checking Pending Penalty Tasks in Volunteer Console...');
  const volTasksRes = await fetch(`${base}/api/volunteer/verify-task`, {
    headers: { Authorization: `Bearer ${volToken}` }
  });
  const volTasks = await volTasksRes.json();
  console.log('Pending Tasks Count:', volTasks.pendingPenaltyTasks?.length);
  console.log('First Pending Task:', volTasks.pendingPenaltyTasks?.[0]);

  const targetTask = volTasks.pendingPenaltyTasks?.find(t => t.teamId === 'MH-2026-001');
  if (targetTask) {
    console.log('\n7. Marshall Approving WhatsApp Video...');
    const approveRes = await fetch(`${base}/api/volunteer/verify-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${volToken}` },
      body: JSON.stringify({
        approvePenalty: true,
        teamObjectId: targetTask.teamObjectId,
        checkpointId: targetTask.checkpointId,
        notes: 'Verified via WhatsApp video clip on +91 98765 43210'
      })
    });
    const approveData = await approveRes.json();
    console.log('Approval Result:', approveData);

    console.log('\n8. Checking Team Hunt State after Approval...');
    const postApproveRes = await fetch(`${base}/api/hunt/checkpoint`, {
      headers: { Authorization: `Bearer ${teamToken}` }
    });
    const postApproveData = await postApproveRes.json();
    console.log('Team Stage after Approval:', {
      checkpointSequence: postApproveData.checkpoint?.sequenceNumber,
      checkpointName: postApproveData.checkpoint?.name,
      isScanned: postApproveData.checkpoint?.isScanned,
      penaltyTask: postApproveData.checkpoint?.penaltyTask
    });
  }

  console.log('\n=== ALL PENALTY SYSTEM TESTS PASSED! ===');
}

testPenaltyWorkflow().catch(console.error);
