# 📝 NestYourCSS - Development To-Do List

This document tracks upcoming features, bug fixes, and architectural changes for the NestYourCSS monorepo. Tasks are categorized by difficulty and impact.

## 🟢 Tier 1 – Trivial (Single Attribute/Line Changes)

*   **Set minimum max depth level to 3**
    *   **Context:** `index.html` & `apps/quickly/index.html` (Settings section).
    *   **Action:** Find `<nycss-stepper id="nestingDepth" min="1" max="10">` and change the `min` attribute to `3`.
*   **Disable stepper if "Infinite" is selected**
    *   **Context:** `packages/ui/src/stepper.js` and the state bindings in `scripts/nestingSettings.js` / `apps/quickly/scripts/settings.js`.
    *   **Action:** Ensure the `nestingDepthInfinite` subscriber in the store properly toggles the `disabled` attribute or class on the `<nycss-stepper id="nestingDepth">` element.
*   **Add placeholders to setting components**
    *   **Context:** `packages/ui/src/combobox.js` and `dropdown.js`.
    *   **Action:** Ensure the web components correctly parse and render the `placeholder` attribute down to the internal `<input>` or `<div contenteditable="true">`.
*   **Show file size checkbox**
    *   **Context:** `index.html` (Settings panel) & `src/main.js` (State config).
    *   **Action:** Add a `<nycss-toggle id="showFileSize">` to the HTML, add it to the proxy store default values, and link it to a UI function that calculates `new Blob([editor.getValue()]).size`.
*   **Show minimap checkbox**
    *   **Context:** Settings HTML and Ace Editor initialization (`scripts/setup.js`).
    *   **Action:** Add `<nycss-toggle id="showMinimap">`, add state variable, and dynamically toggle the Ace Editor minimap (requires Ace minimap extension).
*   **Show sticky scroll checkbox**
    *   **Context:** Settings HTML and Ace Editor.
    *   **Action:** Add `<nycss-toggle id="showStickyScroll">`. Link it to Ace's sticky scroll configuration.
*   **Indentation input field**
    *   **Context:** Settings HTML.
    *   **Action:** Validate if the current `<nycss-stepper id="indentationSize">` satisfies this. If a direct text input is preferred, swap it for a standard input or `<nycss-combobox>`.

---

## 🟡 Tier 2 – Very Easy (< 1 hour, Existing Infrastructure)

*   **Sticky Scroll**
    *   **Context:** `index.html` and `scripts/setup.js`.
    *   **Action:** Uncomment `<script src="./lib/ace/scripts/ext-stickyscroll.js"></script>` in `index.html`. In `setup.js`, add `editor.setOption("stickyScroll", true)` inside `initEditor()`, bound to the new store setting.
*   **Fix PWA caching**
    *   **Context:** `packages/pwa/src/sw.js` and Vite build process.
    *   **Action:** Currently, `sw.js` hardcodes `/styles/app.min.css`. Since Vite hashes filenames (e.g., `main-[hash].css`), use Vite PWA plugin (`vite-plugin-pwa`) or write a script in `postbuild.mjs` to inject the correct hashed filenames into the Service Worker cache list.
*   **Add an anti-adblock background with a border**
    *   **Context:** `styles/main.css` (Ads scope: `#textSide > figure`).
    *   **Action:** Add a background placeholder image/text and a border behind the `.adsbygoogle` container. If the ad fails to load (height == 0), the fallback UI will naturally show.
*   **Auto-save every minute**
    *   **Context:** `scripts/setup.js` (Editor initialization) and `packages/state`.
    *   **Action:** Attach a `setInterval` or a debounced `editor.getSession().on('change')` listener that saves `editor.getValue()` to `localStorage`. Add a `<nycss-toggle id="autoSave">` to settings.
*   **Light/Dark mode toggle**
    *   **Context:** `styles/main.css` (Root variables) and `packages/state`.
    *   **Action:** Add a `theme` property to the store. Create a CSS `[data-theme="light"]` selector in `main.css` that overrides the `--shades-*` and background color variables. Swap the Ace editor theme accordingly.

---

## 🟠 Tier 3 – Easy (1-2 hours, Single Features)

*   **Button to enable diffs**
    *   **Context:** `index.html` and `scripts/handlers.js`.
    *   **Action:** Uncomment `ext-diff.min.js`. Add a toggle button in `.tabButtons`. When clicked, split the output editor to show the diff between `inputEditorInstance.getValue()` and `outputEditorInstance.getValue()`. Add a warning note about formatting/comment removal.
*   **Enable Ace minimap extension**
    *   **Context:** `index.html` and `scripts/setup.js`.
    *   **Action:** Load `ext-minimap.js`. Bind the Tier 1 "Show Minimap" toggle to `editor.setOption("showMinimap", true)`. Ensure CSS layout accommodates the extra width.
*   **Add settings to toggle de-duplication**
    *   **Context:** `packages/engine/src/engine.js` (`minifyCSS` / `renestCSS`) and `packages/state`.
    *   **Action:** Add a `deduplicate` boolean to `configureEngine`. If true, parse the AST for identical properties inside the same Rule node and remove duplicates before stringifying.
*   **Mobile mode settings on main**
    *   **Context:** `scripts/nestingSettings.js` & `styles/main.css`.
    *   **Action:** The logic for popping open the settings on mobile is partially there. Refine the CSS `@media (max-aspect-ratio: 1.097 / 1)` to ensure the settings panel slides up cleanly over the editor.
*   **Provide functionality for the 5 hero section buttons**
    *   **Context:** `index.html` (`#textSide > header > nav > a`).
    *   **Action:** Currently, these are anchors. Wire them up to either trigger scroll-to functions, open new browser tabs, or trigger modals (for feedback/history).

---

## 🟠 Tier 4 – Medium (2-4 hours, Multiple Components)

*   **Make history, settings, "share feedback" and "report a bug" pages**
    *   **Context:** Vite routing (`vite.config.main.mjs`) and UI structure.
    *   **Action:** Create new HTML files (e.g., `history.html`, `feedback.html`) or implement a single-page modal system. Add them to Vite's `rollupOptions.input` array so they get bundled.
*   **Allow `input.css` to be clickable & fetch external CSS**
    *   **Context:** `scripts/setup.js` (inside `createEditorTab`) and `scripts/nestingSettings.js`.
    *   **Action:** Change the `.fileName` div to `contenteditable="true"`. On `blur` or `Enter`, grab the text. If it's a URL, use the existing `fetch()` logic from `nestingSettings.js` (External CSS setting) to load the code into the editor and update the filename label.
*   **Centralize the two settings UI**
    *   **Context:** `index.html` vs `apps/quickly/index.html` and `nestingSettings.js` vs `settings.js`.
    *   **Action:** The `<aside id="mainSettings">` is duplicated. Extract this into a Web Component (e.g., `<nycss-settings-panel>`) in `packages/ui` to maintain a single source of truth for UI and state binding.
*   **Add ability to change the colour theme (Hue Rotation)**
    *   **Context:** `styles/main.css` (`#mainContent`) and `packages/ui/src/stepper.js`.
    *   **Action:** Add a range slider to settings. Bind it to `store.themeHue`. Apply `filter: hue-rotate(var(--rotation))` to `#mainContent`. Ensure the logo/images get a reverse `hue-rotate` so they retain their original colors.
*   **Table of Contents for nested selectors**
    *   **Context:** `packages/engine/src/engine.js` (`parseCSS`) and `index.html` (Settings panel).
    *   **Action:** After parsing the AST, extract all `Rule` node selectors. Render them as a hierarchical `<ul>` list inside the Settings panel. Add click listeners to trigger Ace Editor's `gotoLine()` based on the node's line number (requires modifying the parser to track line numbers).

---

## 🔴 Tier 5 – Hard (4-8 hours, Engine/Complex UI)

*   **Make depth recursion work from bottom to top**
    *   **Context:** `packages/engine/src/engine.js` (`renestCSS` function).
    *   **Action:** Currently, `renestCSS` groups top-level elements first. Rewrite the sorting/scoring logic in `renestCSS` to evaluate and group the longest (deepest) descendant selectors first, bubbling up to the parents.
*   **History of all conversions to Nested CSS**
    *   **Context:** `scripts/nesting.js` (`nestCode()`) and `packages/state`.
    *   **Action:** On successful conversion, push an object `{ timestamp, input, output, mode }` to an IndexedDB or LocalStorage array. Build a "History" UI panel to preview and restore previous states.
*   **Add AceDiff**
    *   **Context:** `#codeEditor` layout in `styles/main.css` and `scripts/setup.js`.
    *   **Action:** Integrate the `ace-diff` package. This requires instantiating the AceDiff wrapper instead of two standalone editors. CSS grid/flex layouts will need to be adjusted to accommodate the middle gutter SVG canvas used by AceDiff.
*   **Button to use the previous selector instead**
    *   **Context:** `packages/engine/src/engine.js` and `scripts/handlers.js`.
    *   **Action:** Requires mapping the output AST nodes back to the input AST nodes. Add a hover UI on the output editor (via Ace Editor gutter annotations/markers) that allows reverting a specific nested block back to its flat state.
*   **Option to allow Emmet**
    *   **Context:** `scripts/setup.js` and Ace Editor imports.
    *   **Action:** Import `emmet-core` and `ext-emmet.js`. Add `<nycss-toggle id="enableEmmet">`. When true, run `editor.setOption("enableEmmet", true)`.
*   **Allow Editor Customization (Shortcuts & Themes)**
    *   **Context:** `packages/state` and `index.html`.
    *   **Action:** Add `<nycss-dropdown>` for Ace themes (e.g., Monokai, Github) and Keybindings (Standard, Vim, Emacs). Dynamically load the Ace extension files based on the selection.
*   **Re-make `#codeEditor` with CSS Grid**
    *   **Context:** `styles/main.css` (`@scope (#editorSide)`).
    *   **Action:** Replace the complex absolute/aspect-ratio math (e.g., `--total-editor-width`) with a modern `display: grid; grid-template-columns: 1fr auto 1fr;` layout utilizing container queries (`@container`) for responsive resizing.
*   **Provide information on how to manually nest your CSS**
    *   **Context:** `index.html` (Article sections).
    *   **Action:** Design and write a new `<section>` on the homepage that explains the W3C CSS Nesting spec, using `#miniEditor` syntax highlighting to show examples.

---

## 🟣 Tier 6 – Very Hard (Days+, Major Architecture)

*   **Implement Paredit (Structured Editing)**
    *   **Context:** `scripts/setup.js` (Ace Editor commands).
    *   **Action:** Implement LISP-style structural editing (slurping/barfing brackets) adapted for CSS ASTs. Requires deep interception of keystrokes to ensure `{ }` blocks remain structurally valid while typing.
*   **Design nesting editors like Google Docs**
    *   **Context:** Main UI layout (`index.html` and `styles/main.css`).
    *   **Action:** Shift from a side-by-side split view to a centered, top-down view (toolbar at top, input above output, or toggled views). Requires a total layout overhaul.
*   **Make settings area fixed width, center editors**
    *   **Context:** `styles/main.css` (`#mainSettings` and `#codeEditor`).
    *   **Action:** Decouple the settings panel from the flex layout. Make it a fixed sidebar (`position: fixed` or rigid grid column) and ensure the remaining space centers the editor canvas perfectly.
*   **Allow input for both HTML and CSS code**
    *   **Context:** `packages/engine` and `index.html`.
    *   **Action:** Add a third editor for HTML. Build a parser that extracts inline `<style>` tags or maps inline `style="..."` attributes, passes them to `@nycss/engine`, and outputs the nested CSS while optionally stripping the inline styles from the HTML output.
*   **Enable nesting multiple CSS files simultaneously**
    *   **Context:** `packages/engine/src/engine.js` and Editor UI.
    *   **Action:** Add a tabbed interface to `inputEditorWrapper`. Modify the engine to accept an array of strings, resolve CSS `@import` statements (if applicable), merge the ASTs, deduplicate, and output a single bundled stylesheet.
*   **Implement Locomotive Scroll (or similar)**
    *   **Context:** `scripts/smoothlyScroll.js` and `package.json`.
    *   **Action:** Rip out the current `Lenis` implementation. Install `locomotive-scroll`. Rewrite the scroll-trigger logic, ensuring the `fallingbadge.js` and `IntersectionObserver` logic syncs correctly with Locomotive's virtual scroll container.
*   **Full design revamp**
    *   **Context:** Entire repository.
    *   **Action:** Start a new Figma design phase. Rewrite `main.css`, typography, and animations from scratch.