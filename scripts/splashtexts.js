function initializeSplashTextAnimator() {
    // --- Existing Global Variables (ensure these are defined in your script) ---
    let isUpdating = false; // Your global flag to prevent overlapping animations
    const splashTexts = [
    "Is fine-tuning your site's look too fiddly?",
    "Need to keep your rules in order?",
    "Is your code getting clouded?",
    "Is your code becoming a maze?",
    "Drowning in a sea of selectors?",
    "Does your code make you cringe?",
    "Is updating your site's style a chore?",
    "Is your site's style not stacking up?",
    "Feeling lost in the stylesheets?",
    "Is organizing your website's look a headache?",
    "Want your styles and HTML structure to correlate?"
    ];

    // --- Optimized Scramble Function (Choose V1 or V2 from previous examples) ---
    const uppercaseACode = 'A'.charCodeAt(0);
    const lowercaseACode = 'a'.charCodeAt(0);
    const alphabetLength = 26;

    function _scrambleSingleText(textToScramble) { // Or _OptimizedV2
        const length = textToScramble.length;
        if (length === 0) {
            return "";
        }
        const scrambledChars = new Array(length);

        for (let i = 0; i < length; i++) {
            const ch = textToScramble[i];
            if (ch === ' ') {
                scrambledChars[i] = ' ';
                continue;
            }
            const code = ch.charCodeAt(0);
            let newCharacterCode;
            if (code >= uppercaseACode && code < uppercaseACode + alphabetLength) {
                newCharacterCode = uppercaseACode + Math.floor(Math.random() * alphabetLength);
            } else if (code >= lowercaseACode && code < lowercaseACode + alphabetLength) {
                newCharacterCode = lowercaseACode + Math.floor(Math.random() * alphabetLength);
            } else {
                scrambledChars[i] = ch;
                continue;
            }
            scrambledChars[i] = String.fromCharCode(newCharacterCode);
        }
        return scrambledChars.join('');
    };

    // --- Animation State Object ---
    let animationState = {
        originalText: "",
        newText: "",
        currentDisplaySring: "", // The string currently being built/animated
        currentIndex: 0,       // Current character index for building/deconstructing
        direction: -1,         // -1 for animating out, 1 for animating in
        
        animationFrameId: null,
        lastTimestamp: 0,
        accumulatedTime: 0,
        
        maxScrambleLength: 8,   // Default, can be updated
        stepInterval: 32,       // Desired ms between logical animation steps
        
        onCompleteCallback: null // Optional callback when animation finishes
    };

    // --- Core Animation Loop Function (Driven by requestAnimationFrame) ---
    function animationLoop(timestamp) {
        if (!isUpdating) { // Check global flag; if false, animation was externally stopped/completed
            if (animationState.animationFrameId) {
                cancelAnimationFrame(animationState.animationFrameId);
                animationState.animationFrameId = null;
            }
            return;
        }

        if (!animationState.lastTimestamp) {
            animationState.lastTimestamp = timestamp;
        }
        const deltaTime = timestamp - animationState.lastTimestamp;
        animationState.lastTimestamp = timestamp;
        animationState.accumulatedTime += deltaTime;

        // Process steps if enough time has passed
        // This loop allows "catching up" if frames were dropped or delayed
        let stepsProcessedThisFrame = 0;
        const maxStepsPerFrame = 8; // Safety: limit steps per rAF to prevent freezing on very slow systems

        while (animationState.accumulatedTime >= animationState.stepInterval && stepsProcessedThisFrame < maxStepsPerFrame) {
            let animationFinishedThisStep = false;

            // --- Phase 1: Animate out originalText (Backwards) ---
            if (animationState.direction === -1) {
                if (animationState.currentIndex <= animationState.originalText.length) {
                    // Text that remains static (shrinks from the right)
                    let staticPart = animationState.originalText.substring(0, animationState.originalText.length - animationState.currentIndex);
                    
                    // Determine the part to scramble at the end of the shrinking staticPart
                    let scrambleLength = Math.min(animationState.maxScrambleLength, staticPart.length);
                    let partToKeepStaticInThisStep = staticPart.substring(0, staticPart.length - scrambleLength);
                    let partToScramble = staticPart.substring(staticPart.length - scrambleLength);

                    animationState.currentDisplaySring = partToKeepStaticInThisStep + _scrambleSingleText(partToScramble);
                    splashTextElem.textContent = animationState.currentDisplaySring;
                    
                    animationState.currentIndex++;

                    if (staticPart.length === 0) { // Fully cleared, switch to forwards
                        animationState.direction = 1;
                        animationState.currentIndex = 0;
                        animationState.currentDisplaySring = ""; // Start fresh for animating in
                    }
                } else { // Should have already switched direction or completed
                    animationState.direction = 1;
                    animationState.currentIndex = 0;
                    animationState.currentDisplaySring = "";
                }
            }
            // --- Phase 2: Animate in newText (Forwards) ---
            else if (animationState.direction === 1) {
                if (animationState.currentIndex <= animationState.newText.length) {
                    // Static part of the new text (grows from the left)
                    let staticPart = animationState.newText.substring(0, animationState.currentIndex);
                    
                    // Part of the new text that will be scrambled (following the static part)
                    let remainingLengthForScramble = animationState.newText.length - animationState.currentIndex;
                    let scrambleLength = Math.min(animationState.maxScrambleLength, remainingLengthForScramble);
                    let partToScramble = animationState.newText.substring(animationState.currentIndex, animationState.currentIndex + scrambleLength);

                    animationState.currentDisplaySring = staticPart + _scrambleSingleText(partToScramble);
                    splashTextElem.textContent = animationState.currentDisplaySring;

                    animationState.currentIndex++;

                    if (staticPart.length === animationState.newText.length) { // Fully formed
                        animationFinishedThisStep = true;
                    }
                } else { // Should have completed
                    animationFinishedThisStep = true;
                }
            }

            if (animationFinishedThisStep) {
                splashTextElem.textContent = animationState.newText;
                
                if (animationState.onCompleteCallback) {
                    animationState.onCompleteCallback();
                }
                // Reset some state for next time, but keep animationFrameId null until next start
                animationState.lastTimestamp = 0;
                animationState.accumulatedTime = 0;
                animationState.animationFrameId = null; // Important: mark as not actively looping
                return; // Stop the rAF loop
            }

            animationState.accumulatedTime -= animationState.stepInterval;
            stepsProcessedThisFrame++;
        } // End of while loop for processing steps

        // If animation is still ongoing, request the next frame
        if (isUpdating) { // Re-check global flag
            animationState.animationFrameId = requestAnimationFrame(animationLoop);
        } else if (animationState.animationFrameId) { // If global isUpdating was set false externally
            cancelAnimationFrame(animationState.animationFrameId);
            animationState.animationFrameId = null;
        }
    };

    // --- Function to Start/Trigger the Animation ---
    function startSplashTextAnimation(originalText, newText) {
        // 1. Check for reduced motion preference
        // 2. If they want reduced motion, just "snap" the text and skip the logic
        if (window.prefersReducedMotion) {
            splashTextElem.textContent = newText;
            // Trigger the "cooldown" immediately so the next update can happen later
            isUpdating = true;
            setTimeout(() => { isUpdating = false; }, 1000); 
            return; 
        }
        
        if (isUpdating && animationState.animationFrameId) return;
        
        isUpdating = true;

        splashTextElem.style.willChange = "contents";
        splashTextElem.ariaBusy = "true";

        // Cancel any lingering animation frame from a previous, possibly aborted, run
        if (animationState.animationFrameId) {
            cancelAnimationFrame(animationState.animationFrameId);
        }

        // Calculate maxScramble based on the shortest string in the array, capped at 8
        const minLengthInArray = splashTexts.reduce((min, text) => Math.min(min, text.length), Infinity);
        const currentMaxScramble = Math.min(8, minLengthInArray > 0 ? minLengthInArray : 8);

        // Initialize animation state
        animationState = {
            ...animationState, // Preserve stepInterval, etc. if you want them configurable elsewhere
            originalText: originalText,
            newText: newText,
            currentDisplaySring: originalText, // Start displaying the original text
            currentIndex: 0,
            direction: -1, // Start by animating out

            maxScrambleLength: currentMaxScramble,
            lastTimestamp: 0,
            accumulatedTime: 0,

            onCompleteCallback: () => { // Cooldown after animation finishes
                splashTextElem.style.willChange = "auto";
                splashTextElem.ariaBusy = "false";

                setTimeout(() => {
                    isUpdating = false;
                }, 5000); // Original cooldown was 500ms after animation logic complete
            }
        };
        
        splashTextElem.textContent = originalText; // Set initial text immediately

        // Start the animation loop
        animationState.animationFrameId = requestAnimationFrame(animationLoop);
    };

    // --- Event Listener ---
    window.attemptSplashTextUpdate = () => {
    if (!isUpdating) { // Check global flag
        let currentSplashText = splashTextElem.textContent;
        let tempSplashTexts = clone(splashTexts).toSpliced(splashTexts.findIndex((text) => text === currentSplashText), 1);
        let newSplashText = tempSplashTexts[Math.floor(Math.random() * tempSplashTexts.length)];

        startSplashTextAnimation(currentSplashText, newSplashText);
    }
    };

    // --- Initial Animation Call ---
    setTimeout(() => startSplashTextAnimation("", splashTexts[Math.floor(Math.random() * splashTexts.length)]), 2000);
};