/**
 * scripts/update-riddle-questions.js
 *
 * Updates all 10 checkpoint questions in MongoDB with clear, authentic,
 * and engaging problem statements that describe the puzzle properly.
 */

require("dotenv").config({ path: ".env" });
const mongoose = require("mongoose");

const QUESTIONS_DATA = [
  {
    seq: 1,
    prompt: "Intercepted Binary Transmission from the Server Vault: [ 01001000  01000001  01000011  01001011 ]. Decode each 8-bit ASCII binary octet to reveal the 4-letter secret authorization keyword.",
    hint: "Convert each 8-bit binary octet into standard ASCII characters (01001000 = H ...).",
  },
  {
    seq: 2,
    prompt: "Which fundamental digital logic gate outputs HIGH (1) if and only if its two input bits are completely distinct (one input is 0 and the other input is 1)?",
    hint: "Think of an exclusive binary operation: 0^1 = 1, 1^0 = 1, but 1^1 = 0.",
  },
  {
    seq: 3,
    prompt: "What is the worst-case time complexity of the standard QuickSort algorithm when a naive pivot (such as always choosing the first or last element) is selected on an already-sorted array of n elements?",
    hint: "When the partition is completely unbalanced at each recursive step, the recurrence relation becomes T(n) = T(n-1) + O(n).",
  },
  {
    seq: 4,
    prompt: "A precision robotic arm is powered by a bipolar stepper motor with a step angle of 1.8° per pulse. How many full electrical step pulses are required for the motor shaft to complete one full 360° rotation?",
    hint: "Calculate: 360 degrees divided by 1.8 degrees per step.",
  },
  {
    seq: 5,
    prompt: "Which foundational quantum information theorem, formulated by Wootters and Zurek in 1982, states that it is mathematically impossible to create an identical copy of an arbitrary unknown quantum state?",
    hint: "Known as the foundational principle preventing the duplication of quantum qubits.",
  },
  {
    seq: 6,
    prompt: "What is the name of the classic S-shaped neural network activation function that maps any real-valued number into a smooth probability output strictly between the open interval (0, 1)?",
    hint: "Represented mathematically by the logistic sigmoid curve: σ(x) = 1 / (1 + e^(-x)).",
  },
  {
    seq: 7,
    prompt: "A secret campus signal was encrypted using a classic Caesar Cipher with a forward shift of +3: 'WHFKHVW'. Decrypt this ciphertext (shift each character backwards by 3 positions) to uncover the original word.",
    hint: "Shift backwards by 3 letters in the alphabet: W -> T, H -> E, F -> C, K -> H ...",
  },
  {
    seq: 8,
    prompt: "Which fundamental data structure operates strictly on a Last-In, First-Out (LIFO) order, where elements are both inserted (pushed) and removed (popped) exclusively from the top?",
    hint: "Think of push and pop operations, opposite of a FIFO Queue.",
  },
  {
    seq: 9,
    prompt: "What official standard TCP port number is assigned by IANA for secure web communication over HTTPS (TLS / SSL)?",
    hint: "Standard port for encrypted HTTP over TLS (unlike unencrypted HTTP on port 80).",
  },
  {
    seq: 10,
    prompt: "🏆 GRAND FINAL MILESTONE REACHED! Choose Box 1, Box 2, or Box 3 and physically present your claim token to the Chief Event Marshall at the Stage Vault to verify your victory!",
    hint: "Confer with the TechFest Box Marshall at the amphitheater stage to claim your physical box.",
  },
];

async function main() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/tech_mystery_hunt";
  console.log("Connecting to MongoDB...");
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const cpCol = db.collection("checkpoints");
  const qCol = db.collection("questions");

  console.log("Updating checkpoint questions...");

  for (const item of QUESTIONS_DATA) {
    const cp = await cpCol.findOne({ sequenceNumber: item.seq });
    if (!cp) {
      console.warn(`⚠️ Checkpoint #${item.seq} not found!`);
      continue;
    }

    const res = await qCol.updateOne(
      { checkpointId: String(cp._id) },
      {
        $set: {
          prompt: item.prompt,
          hint: item.hint,
          updatedAt: new Date(),
        },
      }
    );

    console.log(`✓ CP #${item.seq} (${cp.name}) question prompt updated:`, res.modifiedCount > 0 ? "MODIFIED" : "ALREADY MATCHED");
  }

  console.log("\n✅ All checkpoint questions updated successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to update questions:", err);
  process.exit(1);
});
