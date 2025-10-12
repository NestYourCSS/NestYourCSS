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

- [About The Project](#about-the-project)
- [Built With](#built-with)
- [Features](#features)
- [Getting Started](#getting-started)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgements](#acknowledgements)

---

## About The Project

With the arrival of the native CSS Nesting module, there was a clear need for a simple, pure CSS converter. The available tools were often CSS-to-SCSS converters that produced code requiring significant manual cleanup.

**Nest Your CSS was created to fill that gap.**

The project began with a simple goal: create a reliable A-to-B converter. This goal expanded into a mission to build a portfolio-worthy, "Awwwards-level" application that champions high-quality user experience, accessibility, and modern web standards.

The result is [nestyourcss.com](https://nestyourcss.com/): a free, open-source tool with no backend and no sign-up required, now maintained as a public, open-source application.

## Built With

This project is a testament to the power of web fundamentals, built with **zero frameworks**.

-   HTML5 (Semantic & ARIA-enhanced)
-   CSS3 (Utilizing modern features like `@layer`, Container Queries, and Relative Color Syntax)
-   Vanilla JavaScript (ES6+)
-   [Ace Editor](https://ace.c9.io/) for the code editing experience
-   [Lenis](https://lenis.studiofreight.com/) for smooth scrolling effects

## Features

-   **Nest CSS:** Convert standard CSS to the latest native nested syntax.
-   **De-nest CSS:** Flatten nested CSS back to standard, browser-compatible CSS.
-   **Minify CSS:** Optimize your stylesheets by removing unnecessary characters.
-   **Beautify CSS:** Format and indent your code for maximum readability and maintainability.
-   **Customizable Editor:** Adjust font, font size, indentation, and word wrap to your preference.
-   **Load External CSS:** Fetch and convert stylesheets directly from a URL.
-   **Deep Accessibility:** Fully navigable and usable with screen readers, thanks to extensive ARIA implementation.
-   **Awwwards-Inspired UI/UX:** A focus on smooth animations, visual appeal, and a high-quality user experience.

## Getting Started

To get a local copy up and running for development or contribution, follow these simple steps.

### Prerequisites

Make sure you have Node.js and npm installed on your machine.
-   You can download them from [nodejs.org](https://nodejs.org/).

### Installation & Production Build

1.  Clone the repo:
    ```sh
    git clone https://github.com/NestYourCSS/NestYourCSS.git
    ```
2.  Navigate to the project directory:
    ```sh
    cd NestYourCSS
    ```
3.  Install NPM packages and build the project for production:
    ```sh
    npm install && npm run build
    ```
4.  This will create a `dist` folder with the optimized production files. Open `dist/index.html` in your browser to run the live version locally.

#### Development Mode

If you simply want to view the raw, `in-development` files without running the build process, you can open the `index.html` file in the root directory directly in your browser after cloning. Note that some features may behave differently than in the production build.

## Contributing

Contributions are the lifeblood of the open-source community and are **greatly appreciated**. If you have suggestions to improve this project, please feel free to fork the repo and create a pull request, or simply open an issue with the "enhancement" tag.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Acknowledgements

-   [Ace Editor](https://ace.c9.io/)
-   [Lenis](https://lenis.studiofreight.com/)
-   [Figma](https://www.figma.com/)
-   [Codepen](https://codepen.io/)
-   [Scroll-Driven Animations Debugger Chrome Extension](https://chromewebstore.google.com/detail/ojihehfngalmpghicjgbfdmloiifhoce)
