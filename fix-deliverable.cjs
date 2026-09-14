const fs = require('fs');
let js = fs.readFileSync('js/pages/project.js', 'utf8');

const regex = /\s*\}\);\s*document\.querySelectorAll\("\.art-filter-chip"\)\.forEach\(chip => \{/;

if (regex.test(js)) {
    const fixedLogic = `        });
        window.Clarity.toast.show("Successfully generated " + (res.artifact?.filename || "file"), "success");
        if (statusMsg) {
          statusMsg.style.color = "var(--success)";
          statusMsg.textContent = "✓ " + currentType.toUpperCase() + " generated!";
        }
        
        await l(); // Re-fetch artifacts
        d(); // Re-render list
        
        if (res.artifact && window.Clarity.artifact && window.Clarity.artifact.openPreview) {
          setTimeout(() => window.Clarity.artifact.openPreview(res.artifact), 500);
        }
      } catch (err) {
        if (statusMsg) {
          statusMsg.style.color = "var(--danger)";
          statusMsg.textContent = "Failed: " + (err.message || "");
        }
        window.Clarity.toast.show("Generation error: " + (err.message || ""), "danger");
      } finally {
        setTimeout(() => {
          if (statusMsg) {
            statusMsg.style.display = "none";
          }
          btn.style.border = "1px solid var(--line)";
          btn.style.background = "var(--canvas)";
        }, 3000);
      }
    });
  });
  
  document.querySelectorAll(".art-filter-chip").forEach(chip => {`;

    js = js.replace(regex, fixedLogic);
    fs.writeFileSync('js/pages/project.js', js, 'utf8');
    console.log("Fixed missing catch block");
} else {
    console.log("Could not find injection target");
}
