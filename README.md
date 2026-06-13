# Nest Your CSS

![Nest Your CSS Github Banner](https://github.com/user-attachments/assets/193bee28-d84c-4e47-8241-b152aa1b0f3a)

An Awwwards-inspired online converter tool to minify, beautify, denest, and nest CSS code according to the latest CSS specs. Originally created as a [personal portfolio project](https://github.com/TimChinye/NestYourCSS), it has since evolved into a well-rounded, publicly open-source tool for the modern front-end developer.

<p align="center">
  <a href="https://nestyourcss.com/">View Website</a>
  ·
  <a href="https://www.figma.com/design/D4ZY8722MG7WeCsUgCfDup/Nest-Your-CSS">View Figma Design</a>
  ·
  <a href="https://codepen.io/collection/EPYjje/?sort_by=ItemCreatedAt">View Codepen Collection</a>
</p>

---

## Table of Contents

- [The NYCSS Suite](#the-nycss-suite)
- [Features](#features)
- [NYCSS vs. Preprocessors](#nycss-vs-preprocessors)
- [CLI Documentation](#cli-documentation)
- [Monorepo Architecture](#monorepo-architecture)
- [Accessibility Commitment](#accessibility-commitment)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgements](#acknowledgements)

---

## The NYCSS Suite

Nest Your CSS is a full suite of tools designed to bring native CSS nesting and more, into any workflow, exactly how you need it:

1. **Main:** The primary site featuring the full, accessible interactive converter and an Awwwards-inspired, scroll-driven educational experience.
2. **Quickly:** A lightweight, visual, and highly accessible browser-based GUI focused entirely on fast conversions.
3. **CLI (`@nycss/cli`):** A robust command-line interface for local terminal processing, batch conversions, and build-step integration.
4. **Engine (`@nycss/engine`):** The core. A zero-dependency Vanilla JS parsing and transforming library ready to be imported into any JavaScript/Node.js project.

![Screenshot of the Quickly Web GUI showing the minimilistic UI, customizable editor settings, and formatted CSS output](https://github.com/user-attachments/assets/7ab29d2a-09c2-4a5d-8041-4b94ee5652a7)

## Features

-   **Nest CSS:** Convert any standard CSS to the latest native nested syntax.
-   **Denest CSS:** Flatten nested CSS back to standard, legacy-browser-compatible CSS.
-   **Minify CSS:** Optimize your stylesheets by removing unnecessary characters.
-   **Beautify CSS:** Format and indent your code for maximum readability.
-   **Nesting Strategy:** Choose how deeply the engine nests your CSS — `balanced` (splits deep selectors), `maximize` (prefers depth over readability), or `flattened` (caps at one level of nesting).
-   **Configurable Depth Limit:** Set a maximum depth of your choice to avoid overly specific selectors while maintaining readability (3-4 is industry standard).
-   **Deduplication:** Automatically remove duplicate declarations from your output CSS.
-   **File Size Display:** Toggle the display of file sizes in the editor tabs.
-   **Minimap:** Toggle a code minimap in the editor for quick visual navigation of your stylesheets.
-   **Batch Processing:** Watch and transform entire directories of stylesheets using the CLI.
-   **Customizable Editor:** Adjust font, font size, indentation, and word wrap to your preference.
-   **Load External CSS:** Fetch and convert stylesheets directly from a URL.
-   **Deep Accessibility:** Fully navigable and usable with screen readers, thanks to extensive ARIA implementation.
-   **Awwwards-Inspired UI/UX:** A focus on smooth animations, visual appeal, and a high-quality user experience.
-   **Zero Dependencies:** The core `@nycss/engine` is written in 100% Vanilla JavaScript without a single external dependency.
-   **Custom Lexer/Parser:** NYCSS achieves high performance on large stylesheets by avoiding expensive, heavy Regular Expressions. It parses code character-by-character statelessly, ensuring accurate AST generation without freezing the browser.
-   **Modern Standards:** Native support for complex pseudo-classes like `:is()`, relative color syntax, and structural grouping.

## NYCSS vs. Preprocessors

How does Nest Your CSS compare to established preprocessors like Sass, Less, or PostCSS?

| Feature | Nest Your CSS (NYCSS) | Sass / PostCSS |
| :--- | :--- | :--- |
| **Syntax** | Follows the W3C Native CSS Nesting specification. | Uses proprietary preprocessor syntax or plugins. |
| **No Build Step?**| **Yes.** Browsers can read Native Nested CSS directly. | **No.** Raw Sass/SCSS files must be converted into CSS. |
| **Bidirectional?** | **Yes.** You can nest *and* denest instantly. | **No.** Compilation is strictly a one-way street. |

*Native CSS nesting is the future of the web. NYCSS bridges the gap by letting you easily convert old codebases to modern standards, without locking you into a proprietary build ecosystem.*

## CLI Documentation

You can also use NYCSS directly into your terminal or build pipelines.

![GIF showing the nycss CLI running in a terminal, watching for file changes, and processing multiple CSS files simultaneously](https://github.com/user-attachments/assets/ed89202e-3e5d-4711-ac50-459f010c212e)


### Installation

Install the CLI globally to use it anywhere:
```sh
npm install -g @nycss/cli
```

### Basic Usage

Transform a single file and output it to a new destination:
```sh
nycss input.css -o output.css
```

You can also pipe standard input directly into NYCSS:
```sh
cat input.css | nycss --mode minify > output.min.css
```

### Arguments Table

| Flag | Description | Default |
| :--- | :--- | :--- |
| `-m, --mode <mode>` | The processing mode. Valid options: `nest`, `denest`, `minify`, `beautify`. | `nest` |
| `-d, --depth <level>` | Max nesting depth. Limits how deep selectors can nest (use `0` for infinite). | Infinite |
| `-i, --indent <size>` | Indent size. Use a number (e.g; `2`, `4`) or `tab`. | `4` |
| `--no-comments` | Strips all comments from the output CSS. | `false` (keeps comments) |
| `--dedupe` | Removes duplicate rules and declarations from the output. | `false` |
| `-o, --out <path>` | Output destination (file or directory). | N/A |
| `--out-dir <dir>` | Output directory for batch processing. | N/A |
| `--base <dir>` | Base directory for preserving the folder structure during batch processing. | Auto-detected |
| `-w, --watch` | Watches the input files/globs for changes and recompiles automatically. | `false` |

### Batch Processing

You can process entire directories using glob patterns. When doing so, use `--out-dir` (and optionally `--base` to preserve the exact folder hierarchy).

```sh
# Process all CSS files in /src and output them to /dist
nycss "src/**/*.css" --out-dir dist --base src
```

## Monorepo Architecture

The project is structured as a `pnpm` monorepo, separating core logic from user interfaces.

- `packages/engine/` - The core, zero-dependency Vanilla JS parsing and transforming logic.
- `packages/cli/` - The terminal command-line interface.
- `packages/ui/` - Reusable, framework-agnostic web components (Dropdowns, Steppers, Toggles, etc.).
- `packages/state/` - Custom proxy-based state management logic.
- `packages/pwa/` - Service worker caching and offline capabilities.

## Accessibility Commitment

We believe developer tools should be accessible to all developers. NYCSS is built with deep adherence to `a11y` principles:

-   **Live Regions:** Screen readers are notified gracefully of file imports, clipboard copies, and conversion success/errors via `aria-live` regions.
-   **Keyboard Navigation:** Custom web components (`@nycss/ui`) are rigorously tested for full keyboard support, trapping, and focus management.
-   **Interactive Error Tables:** Syntax errors populate a semantic HTML table where each row acts as an interactive, focusable button that automatically transports you to the exact line/column in the code editor.
-   **Respect for User Preferences:** Respects `@media (prefers-reduced-motion: reduce)` to disable heavy canvas gradients, smooth scrolling, and UI transitions automatically.

*If you are a screen-reader user and experience friction, please open an issue! Your feedback is highly valued.*

## Contributing

Contributions are the lifeblood of the open-source community and are **greatly appreciated**. If you have suggestions to improve this project, please feel free to fork the repo and create a pull request, or simply open an issue with the "enhancement" tag.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

Want to contribute to the project? We use `pnpm` for workspace management.

### Prerequisites

- [Node.js](https://nodejs.org/) (Recommended: v24)
- [pnpm](https://pnpm.io/installation) (Recommended: v11)

### Installation & Local Development

1. Clone the repo and navigate to the project directory:
   ```sh
   git clone https://github.com/NestYourCSS/NestYourCSS.git
   cd NestYourCSS
   ```
2. Install dependencies across all packages:
   ```sh
   pnpm install
   ```

**Running the Development Servers:**
- To run the **Main Site**: `pnpm run dev:main`
- To run **Quickly**: `pnpm run dev:quickly`
- To run both/default routing: `pnpm run dev`

**Building for Production:**
- Build the **Main Site**: `pnpm run build:main`
- Build **Quickly**: `pnpm run build:quickly`
- Build everything: `pnpm run build`

*(Built assets are output to the `/dist` directory via the postbuild script).*

**Previewing Production Builds locally:**
- Preview the **Main Site**: `pnpm run preview:main`
- Preview **Quickly**: `pnpm run preview:quickly`

### Testing the CLI Locally

To test CLI changes locally during development:
```sh
cd packages/cli
pnpm add -g .
```
You can now run the `nycss` command anywhere on your local machine.

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Acknowledgements

-   [Ace Editor](https://ace.c9.io/)
-   [Lenis](https://lenis.studiofreight.com/)
-   [Figma](https://www.figma.com/)
-   [Codepen](https://codepen.io/)
-   [Scroll-Driven Animations Debugger Chrome Extension](https://chromewebstore.google.com/detail/ojihehfngalmpghicjgbfdmloiifhoce)