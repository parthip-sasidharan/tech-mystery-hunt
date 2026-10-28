const fs = require("fs");
const path = require("path");

const adminPath = path.join(__dirname, "..", "src", "app", "admin", "page.tsx");
let content = fs.readFileSync(adminPath, "utf8");

const modalRegex = /\s*\{\/\* ═+\s+MODAL: RESTART \/ RESET GAME MODAL\s+═+\s*\*\/\}\s*\{showResetModal && \([\s\S]*?Confirm Restart\s*<\/>\s*\)\}\s*<\/button>\s*<\/div>\s*<\/div>\s*<\/div>\s*\)\}/g;

const matches = content.match(modalRegex);
console.log("Found matches:", matches ? matches.length : 0);

if (matches && matches.length > 0) {
  const singleModal = matches[0];
  content = content.replace(modalRegex, "");
  
  // Insert singleModal right before the closing </div> of the component
  const insertIndex = content.lastIndexOf("</div>\n  );\n}");
  if (insertIndex !== -1) {
    content = content.slice(0, insertIndex) + "\n\n" + singleModal + "\n    " + content.slice(insertIndex);
    fs.writeFileSync(adminPath, content, "utf8");
    console.log("Successfully placed exactly one modal before closing </div>!");
  } else {
    console.log("Could not find closing </div>");
  }
}
