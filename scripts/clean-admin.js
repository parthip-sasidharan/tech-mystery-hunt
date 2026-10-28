const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'app', 'admin', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// The block that was duplicated 23 times:
const duplicateBlock = `          {/* Physical Treasure Box Clues Configuration Card */}
          <div className="glow-card rounded-2xl p-6 border-surface-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
              <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-400" /> Sequential Physical Box Clues (Checkpoint #10)
              </h3>
              {cluesSuccessMsg && (
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-lg">
                  ✓ {cluesSuccessMsg}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mb-6">
              When teams scan Checkpoint #10, they automatically see the clue for the active prize box. As soon as a box is verified by the Marshall, the clue transitions sequentially (Box 1 → Box 2 → Box 3).
            </p>

            <form onSubmit={handleSaveBoxClues} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Box 1 */}
                <div className="p-4 rounded-xl bg-surface-50 border border-amber-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-bold text-amber-400 flex items-center gap-1.5">
                      🥇 BOX #1 CLUE (1ST PLACE)
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={boxClues[1] || ""}
                    onChange={(e) => setBoxCluesState((prev) => ({ ...prev, 1: e.target.value }))}
                    placeholder="Enter physical location clue for Box 1..."
                    className="w-full px-3 py-2 rounded-lg bg-surface-100 border border-surface-border text-white text-xs font-mono focus:outline-none focus:border-amber-400"
                  />
                  <div className="text-[10px] text-slate-400 mt-1">
                    Displayed to all teams until Box #1 is confirmed by Marshall.
                  </div>
                </div>

                {/* Box 2 */}
                <div className="p-4 rounded-xl bg-surface-50 border border-cyan-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-bold text-cyan-400 flex items-center gap-1.5">
                      🥈 BOX #2 CLUE (2ND PLACE)
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={boxClues[2] || ""}
                    onChange={(e) => setBoxCluesState((prev) => ({ ...prev, 2: e.target.value }))}
                    placeholder="Enter physical location clue for Box 2..."
                    className="w-full px-3 py-2 rounded-lg bg-surface-100 border border-surface-border text-white text-xs font-mono focus:outline-none focus:border-cyan-400"
                  />
                  <div className="text-[10px] text-slate-400 mt-1">
                    Displayed once Box #1 is won, until Box #2 is confirmed.
                  </div>
                </div>

                {/* Box 3 */}
                <div className="p-4 rounded-xl bg-surface-50 border border-purple-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-bold text-purple-400 flex items-center gap-1.5">
                      🥉 BOX #3 CLUE (3RD PLACE)
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={boxClues[3] || ""}
                    onChange={(e) => setBoxCluesState((prev) => ({ ...prev, 3: e.target.value }))}
                    placeholder="Enter physical location clue for Box 3..."
                    className="w-full px-3 py-2 rounded-lg bg-surface-100 border border-surface-border text-white text-xs font-mono focus:outline-none focus:border-purple-400"
                  />
                  <div className="text-[10px] text-slate-400 mt-1">
                    Displayed once Box #2 is won, until 3rd place is confirmed.
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingClues}
                  className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold font-mono text-xs shadow-glow-amber transition-all disabled:opacity-50"
                >
                  {savingClues ? "Saving Clues..." : "Save Physical Box Clues"}
                </button>
              </div>
            </form>
          </div>

          {/* Global Tournament Broadcast Alert Control Card */}
          <div className="glow-card rounded-2xl p-6 border-surface-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
              <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" /> Global Tournament Broadcast Alert System
              </h3>
              {activeBroadcastState && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-rose-300 bg-rose-500/20 border border-rose-500/40 px-3 py-1 rounded-lg flex items-center gap-1.5 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-rose-500" /> LIVE BROADCAST ACTIVE
                  </span>
                  <button
                    type="button"
                    onClick={handleClearBroadcast}
                    disabled={sendingBroadcast}
                    className="text-xs font-mono text-slate-400 hover:text-white px-2.5 py-1 rounded border border-surface-border bg-surface-50"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-400 mb-6">
              Publish an unmissable warning/alert popup to all logged-in teams and mobile devices. Use this to declare the hunt officially over, announce winners, or issue urgent directives.
            </p>

            {broadcastSuccessMsg && (
              <div className="p-3 mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
                ✓ {broadcastSuccessMsg}
              </div>
            )}

            <form onSubmit={handleSendBroadcast} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">
                  Broadcast Alert Title:
                </label>
                <input
                  type="text"
                  value={broadcastTitleInput}
                  onChange={(e) => setBroadcastTitleInput(e.target.value)}
                  placeholder="e.g. 🚨 THE TREASURE HUNT IS OFFICIALLY OVER!"
                  className="w-full px-3 py-2 rounded-xl bg-surface-50 border border-surface-border text-white text-xs font-mono focus:outline-none focus:border-rose-400"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">
                  Broadcast Message Body:
                </label>
                <textarea
                  rows={3}
                  value={broadcastMessageInput}
                  onChange={(e) => setBroadcastMessageInput(e.target.value)}
                  placeholder="Enter detailed announcement message..."
                  className="w-full px-3 py-2 rounded-xl bg-surface-50 border border-surface-border text-white text-xs font-mono focus:outline-none focus:border-rose-400"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="submit"
                  disabled={sendingBroadcast || !broadcastTitleInput.trim() || !broadcastMessageInput.trim()}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-black font-extrabold font-mono text-xs transition-all shadow-glow-amber disabled:opacity-50 flex items-center gap-2"
                >
                  <ShieldAlert className="w-4 h-4" />
                  {sendingBroadcast ? "Broadcasting..." : "Publish Global Warning Broadcast to All Screens"}
                </button>
              </div>
            </form>
          </div>
\n`;

// Normalize line endings to LF for clean regex replacement
const normalizedBlock = duplicateBlock.replace(/\r\n/g, '\n').trim();
const normalizedContent = content.replace(/\r\n/g, '\n');

// Replace all occurrences of normalizedBlock with empty string
let cleanedContent = normalizedContent.split(normalizedBlock).join('');
console.log('Cleaned occurrences! Length before:', content.length, 'Length after:', cleanedContent.length);

// Now insert normalizedBlock ONCE right after the unique string:
const uniqueTarget = '{/* Checkpoint Completion Breakdown Table */}';
const targetIndex = cleanedContent.indexOf(uniqueTarget);

if (targetIndex !== -1) {
  cleanedContent = cleanedContent.slice(0, targetIndex) + normalizedBlock + '\n\n          ' + cleanedContent.slice(targetIndex);
  console.log('Successfully inserted block once right before Checkpoint Completion Breakdown Table!');
} else {
  console.error('Could not find unique target!');
}

fs.writeFileSync(filePath, cleanedContent, 'utf8');
console.log('Saved clean admin page!');
