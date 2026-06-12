# 📝 NestYourCSS - Development To-Do List

This document tracks a list of features, bug fixes, and architectural changes that feasibly could and might be implemented. Tasks are categorized by perceived difficulty.

*   **Add ability to change the colour theme (Hue Rotation)**
    *   **Context:** `styles/main.css` (`#mainContent`) and `packages/ui/src/stepper.js`.
    *   **Action:** Add a range slider to settings. Bind it to `store.themeHue`. Apply `filter: hue-rotate(var(--rotation))` to `#mainContent`. Ensure the logo/images get a reverse `hue-rotate` so they retain their original colors.
*   **Show minimap checkbox**
    *   **Context:** Settings HTML and Ace Editor initialization (`scripts/setup.js`).
    *   **Action:** Add `<nycss-toggle id="showMinimap">`, add state variable, and dynamically toggle the Ace Editor minimap (requires Ace minimap extension).
*   **Enable Ace minimap extension**
    *   **Context:** `index.html` and `scripts/setup.js`.
    *   **Action:** Load `ext-minimap.js`. Bind the Tier 1 "Show Minimap" toggle to `editor.setOption("showMinimap", true)`. Ensure CSS layout accommodates the extra width.
*   **History of all conversions to Nested CSS**
    *   **Context:** `scripts/nesting.js` (`nestCode()`) and `packages/state`.
    *   **Action:** On successful conversion, push an object `{ timestamp, input, output, mode }` to an IndexedDB or LocalStorage array. Build a "History" UI panel to preview and restore previous states.
*   **Option to allow Emmet**
    *   **Context:** `scripts/setup.js` and Ace Editor imports.
    *   **Action:** Import `emmet-core` and `ext-emmet.js`. Add `<nycss-toggle id="enableEmmet">`. When true, run `editor.setOption("enableEmmet", true)`.
*   **Implement Paredit (Structured Editing)**
    *   **Context:** `scripts/setup.js` (Ace Editor commands).
    *   **Action:** Implement LISP-style structural editing (slurping/barfing brackets) adapted for CSS ASTs. Requires deep interception of keystrokes to ensure `{ }` blocks remain structurally valid while typing.
*   **Table of Contents for nested selectors**
    *   **Context:** `packages/engine/src/engine.js` (`parseCSS`) and `index.html` (Settings panel).
    *   **Action:** After parsing the AST, extract all `Rule` node selectors. Render them as a hierarchical `<ul>` list inside the Settings panel. Add click listeners to trigger Ace Editor's `gotoLine()` based on the node's line number (requires modifying the parser to track line numbers).
*   **Re-make `#codeEditor` with CSS Grid**
    *   **Context:** `styles/main.css` (`@scope (#editorSide)`).
    *   **Action:** Replace the complex absolute/aspect-ratio math (e.g., `--total-editor-width`) with a modern `display: grid; grid-template-columns: 1fr auto 1fr;` layout utilizing container queries (`@container`) for responsive resizing.
*   **Make history, settings, "share feedback" and "report a bug" pages**
    *   **Context:** Vite routing (`vite.config.main.mjs`) and UI structure.
    *   **Action:** Create new HTML files (e.g., `history.html`, `feedback.html`) or implement a single-page modal system. Add them to Vite's `rollupOptions.input` array so they get bundled.
    *   **Developer Note:** So, a settings and history modal have already been discussed, currently feedback/share-your-mind (currently hidden/replaced by the link to 'Quickly') and report a bug just like to GitHub, I'd prefer a more bespoke experience.
*   **Allow Editor Customization (Shortcuts & Themes)**
    *   **Context:** `packages/state` and `index.html`.
    *   **Action:** Add `<nycss-dropdown>` for Ace themes (e.g., Monokai, Github) and Keybindings (Standard, Vim, Emacs), including the ability to create custom ones. Dynamically load the Ace extension files based on the selection.
    *   **Developer Note:** Basically, we want a full-on, site-wide settings page, triggered via the settings button in the current navbar. We could also include customization for things like editor settings positions, what settings even show up in that panel, the order of the tab buttons (or the inclusion of new tab buttons, which could act as quick settings). 
*   **Sticky Scroll**
    *   **Context:** `index.html` and `scripts/setup.js`.
    *   **Action:** Uncomment `<script src="./lib/ace/scripts/ext-stickyscroll.js"></script>` in `index.html`. And... fix it up or see if someone has finally made a working version. In `setup.js`, add `editor.setOption("stickyScroll", true)` inside `initEditor()`, bound to the new store setting.
*   **Show sticky scroll checkbox**
    *   **Context:** Settings HTML and Ace Editor.
    *   **Action:** Add `<nycss-toggle id="showStickyScroll">`. Link it to Ace's sticky scroll configuration.
*   **Add AceDiff**
    *   **Context:** `#codeEditor` layout in `styles/main.css` and `scripts/setup.js`.
    *   **Action:** Integrate the `ace-diff` package. This requires instantiating the AceDiff wrapper instead of two standalone editors. CSS grid/flex layouts will need to be adjusted to accommodate the middle gutter SVG canvas used by AceDiff.
*   **Button to enable diffs**
    *   **Context:** `index.html` and `scripts/handlers.js`.
    *   **Action:** Uncomment `ext-diff.min.js`. Add a toggle button in `.tabButtons`. When clicked, split the output editor to show the diff between `inputEditorInstance.getValue()` and `outputEditorInstance.getValue()`. Add a warning note about formatting/comment removal.
*   **Button to use the previous selector instead**
    *   **Context:** `packages/engine/src/engine.js` and `scripts/handlers.js`.
    *   **Action:** Requires mapping the output AST nodes back to the input AST nodes. Add a hover UI on the output editor (via Ace Editor gutter annotations/markers) that allows reverting a specific nested block back to its flat state.
    *   **Developer Note:** What I mean by this is a line-by-line 'Revert button' in the middle of the diff, my original intention was for this feature to only be for selectors. But perhaps declarations, comments and entire rule blocks too.
*   **Provide information on how to manually nest your CSS**
    *   **Context:** `index.html` (Article sections).
    *   **Action:** Design and write a new `<section>` on the homepage that explains the W3C CSS Nesting spec, with the aim of getting people to learn how to use native CSS nesting without the NYCSS tool.
*   **Design nesting editors like Google Docs**
    *   **Context:** Main UI layout (`index.html` and `styles/main.css`).
    *   **Action:** Shift from a side-by-side split view to a centered, top-down view (toolbar at top, input/output in the centre, or toggle views so only one shows a time). Requires a total layout overhaul.
*   **Allow input for both HTML and CSS code**
    *   **Context:** `packages/engine` and `index.html`.
    *   **Action:** Add a third editor for HTML. Use the DOM tree to remove redundancy and provide more optimal selectors. Build a parser that extracts inline `<style>` tags or maps inline `style="..."` attributes, passes them to `@nycss/engine`, and outputs the optimized nested CSS, with formerly inline CSS as declarations of a block, with the option of stripping the inline styles from the HTML too.
*   **Enable nesting multiple CSS files simultaneously via UI**
    *   **Context:** `packages/engine/src/engine.js` and Editor UI.
    *   **Action:** Add a tabbed interface to `inputEditorWrapper`. Modify the engine to accept an array of strings, resolve CSS `@import` statements (if applicable), merge the ASTs, deduplicate, and output a single bundled stylesheet.
    *   **Developer Note:** This would be truly Awwwards-winning, and I'd have to dedicate months to this project - this will likely never be done. 
*   **Full design revamp**
    *   **Context:** Entire repository.
    *   **Action:** Start a new Figma design phase. Rewrite `main.css`, typography, and animations from scratch.
    *   **Developer Note:** This would be truly Awwwards-winning, and I'd have to dedicate months to this project - this will likely never be done.