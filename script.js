const drag = document.getElementById('drag');
const message = document.getElementById('message');
const line = document.querySelector('.line'); // Reference to the line container
const proverbLink = document.querySelector('.proverb-link'); // Reference to the "Proverb Thirty-One" link
const infinitySymbol = document.getElementById('infinity'); // Reference to the infinity symbol
const whiteSymbol = document.querySelector('.symbol.right'); // Reference to the white `&` symbol
const kText = document.createElement('div'); // Create a div for the `/k/` text

let isDragging = false;
let initialX = 0;
let offsetX = 0;
const lineWidth = line.offsetWidth; // Get the width of the line
let dragStartX = lineWidth / 2; // Initial center position of the drag
let isOverlapping = false; // Check if the `&` symbol is overlapping the infinity symbol
let isWhiteSymbolOverlapping = false; // Check if the white `&` symbol is overlapping the black `&`

// Append the /k/ text to the white `&` symbol, initially hidden
kText.textContent = '/k/';
kText.style.position = 'absolute';
kText.style.top = '100%';
kText.style.left = '50%';
kText.style.transform = 'translateX(-50%)';
kText.style.color = 'black'; // Set the text color
kText.style.display = 'none'; // Initially hide the text
whiteSymbol.appendChild(kText);

drag.addEventListener('mousedown', (e) => {
  isDragging = true;
  initialX = e.clientX - offsetX;
  message.innerHTML = 'Hold on';
  checkOverlap(); // Check if the `&` is overlapping the infinity symbol when drag starts
});

document.addEventListener('mousemove', (e) => {
  if (isDragging) {
    offsetX = e.clientX - initialX;
    drag.style.transform = `translateX(${offsetX}px) translateY(-50%)`;
    checkOverlap(); // Continuously check overlap during dragging
    checkWhiteSymbolOverlap(); // Check if the white `&` symbol is overlapping
  }
});

document.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;

    // Check if the dragged element triggers the text below the white `&` symbol or the infinity symbol
    if (isOverlapping && proverbLink.style.display === 'block') {
      window.location.href = 'https://youtube.com/playlist?list=PLR_JNmB8WadYL_yu9DFqyerN6BJhV0XKt&si=LsuGCaFX6iz4FlrM'; // Infinity symbol
    } else if (isWhiteSymbolOverlapping && kText.style.display === 'block') {
      window.location.href = 'https://emanuelstefancu.com'; // White `&` symbol
    } else {
      // Reset to center if it's not near the edges
      drag.style.transform = `translateX(0) translateY(-50%)`; // Reset position visually to the center
      message.innerHTML = ''; // Clear message

      // Reset the offsetX to zero when it's not near the left or right
      offsetX = 0;

      // Ensure the drag element resets to the center of the line
      drag.style.left = `${lineWidth / 2 - drag.offsetWidth / 2}px`; // Center the `&` symbol
    }
  }
});

// Check if the black `&` symbol is overlapping the infinity symbol
function checkOverlap() {
  const dragRect = drag.getBoundingClientRect();
  const infinityRect = infinitySymbol.getBoundingClientRect();

  // Check for overlap: If any part of the `&` symbol overlaps with the infinity symbol
  isOverlapping = !(dragRect.right < infinityRect.left || dragRect.left > infinityRect.right || dragRect.bottom < infinityRect.top || dragRect.top > infinityRect.bottom);

  if (isDragging && isOverlapping) {
    proverbLink.style.display = 'block'; // Show the link if overlapping
  } else {
    proverbLink.style.display = 'none'; // Hide the link if not overlapping
  }
}

// Check if the white `&` symbol is overlapping the black `&` symbol
function checkWhiteSymbolOverlap() {
  const dragRect = drag.getBoundingClientRect();
  const whiteRect = whiteSymbol.getBoundingClientRect();

  // Check if the white `&` symbol is overlapping the black `&` symbol
  isWhiteSymbolOverlapping = !(dragRect.right < whiteRect.left || dragRect.left > whiteRect.right || dragRect.bottom < whiteRect.top || dragRect.top > whiteRect.bottom);

  if (isDragging && isWhiteSymbolOverlapping) {
    kText.style.display = 'block'; // Show the /k/ text if overlapping
  } else {
    kText.style.display = 'none'; // Hide the /k/ text if not overlapping
  }
}
