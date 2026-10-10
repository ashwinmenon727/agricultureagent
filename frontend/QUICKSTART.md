# QUICKSTART – Get the Unified Vayal Dashboard Running in 5 minutes

## 📦 What you need
- The **`index.html`** file (provided above)  
- A web server that can serve static files (any simple HTTP server will do).  
- A modern browser (Chrome, Edge, Firefox, Safari) – no extra libraries or build steps required.

## 🚀 Step‑by‑step

1. **Locate your existing web root**  
   The current dashboards live under `c:\Users\ASHWIN MENON\agri-agent\frontend`.  
   The file that powers the old dashboard is `index.html`.

2. **Replace the old file**
   ```powershell
   # Backup the original just in case
   copy .\frontend\index.html .\frontend\index.backup.html

   # Overwrite with the new unified dashboard
   copy .\frontend\unified_dashboard.html .\frontend\index.html
   ```
   *If you named the new file something else, rename it to `index.html`.*

3. **Start a static server** (choose one of the three quick options)

   - **Python 3** (already installed on most systems)
     ```powershell
     cd .\frontend
     python -m http.server 8000
     ```
   - **Node.js** – `http-server` (install once)
     ```powershell
     npm i -g http-server
     cd .\frontend
     http-server -p 8000
     ```
   - **PowerShell built‑in**
     ```powershell
     cd .\frontend
     Start-Process "powershell.exe" -ArgumentList "-NoProfile -Command \"while($true){Start-Sleep -Seconds 3600}\""
     ```

4. **Open the dashboard**  
   Navigate to `http://127.0.0.1:8000/` (or the URL your server reports).  
   You should see the new unified layout with the chat hero in the centre.

5. **Verify basic interactivity**

   | Feature | How to test |
   |---------|-------------|
   | **Chat** | Type a message → press **Send** or **Enter**. Your text appears on the right and a dummy assistant reply shows after ~600 ms. |
   | **Quick actions** | Click any of the six grid buttons below the chat. A contextual message appears in the chat. |
   | **Sidebar navigation** | Click any item in the left menu – the blue background moves to the selected entry. |
   | **Toggles** | Click any switch in the right panel – the thumb slides and the background turns green. |
   | **Responsive layout** | Resize the browser window or open on a tablet/phone – the panels collapse/stack automatically. |

## ❓ Common Questions

- **“Where do I add a custom quick‑action button?”**  
  Open `index.html`, locate the `<div class="actions">` block, copy an existing `<button>` element, change `data-action="Your label"` and the inner emoji/text. No other code changes are required.

- **“Can I change the colour scheme?”**  
  Edit the CSS variables at the top of the `<style>` section (e.g., `--accent-blue`). All components use these variables.

- **“My server already serves `agri_guide_dashboard.html` – do I need to keep it?”**  
  No. The unified file works for **both** URLs (see the Server‑Setup guide for optional redirects). You can safely delete the old file after confirming the new dashboard works.

---

👍 **You’re all set!** The dashboard now lives at a single URL, is fully interactive, and can be extended without rebuilding. Happy farming!
