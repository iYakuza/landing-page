const drag = document.getElementById('drag');
const message = document.getElementById('message');
const line = document.querySelector('.line');
const proverbLink = document.querySelector('.proverb-link');
const infinitySymbol = document.getElementById('infinity');
const whiteSymbol = document.querySelector('.symbol.right');
const kText = document.createElement('div');

// Add `/k/` text
kText.textContent = '/k/';
kText.style.position = 'absolute';
kText.style.top = '100%';
kText.style.left = '50%';
kText.style.transform = 'translateX(-50%)';
kText.style.color = 'black';
kText.style.display = 'none';
whiteSymbol.appendChild(kText);

let isDragging = false;
let initialX = 0;
let offsetX = 0;
let isOverlapping = false;
let isWhiteSymbolOverlapping = false;

// Add event listeners
drag.addEventListener('mousedown', (e) => {
  isDragging = true;
  initialX = e.clientX - offsetX;
  message.innerHTML = 'Hold on';
});

document.addEventListener('mousemove', (e) => {
  if (isDragging) {
    offsetX = e.clientX - initialX;
    drag.style.transform = `translateX(${offsetX}px) translateY(-50%)`;

    // Check overlaps
    checkOverlap();
    checkWhiteSymbolOverlap();
  }
});

document.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;

    // Trigger actions based on overlap
    if (isOverlapping && proverbLink.style.display === 'block') {
      window.location.href = 'https://youtube.com/playlist?list=PLR_JNmB8WadYL_yu9DFqyerN6BJhV0XKt&si=LsuGCaFX6iz4FlrM';
    } else if (isWhiteSymbolOverlapping && kText.style.display === 'block') {
      window.location.href = 'https://emanuelstefancu.com';
    } else {
      resetDragPosition();
    }
  }
});

// Reset drag position to center
function resetDragPosition() {
  offsetX = 0;
  drag.style.transform = `translateX(0) translateY(-50%)`;
  message.innerHTML = '';
}

// Check overlap between `&` and `∞`
function checkOverlap() {
  const dragRect = drag.getBoundingClientRect();
  const infinityRect = infinitySymbol.getBoundingClientRect();

  isOverlapping = !(dragRect.right < infinityRect.left ||
    dragRect.left > infinityRect.right ||
    dragRect.bottom < infinityRect.top ||
    dragRect.top > infinityRect.bottom);

  proverbLink.style.display = isOverlapping ? 'block' : 'none';
}

// Check overlap between black `&` and white `&`
function checkWhiteSymbolOverlap() {
  const dragRect = drag.getBoundingClientRect();
  const whiteRect = whiteSymbol.getBoundingClientRect();

  isWhiteSymbolOverlapping = !(dragRect.right < whiteRect.left ||
    dragRect.left > whiteRect.right ||
    dragRect.bottom < whiteRect.top ||
    dragRect.top > whiteRect.bottom);

  kText.style.display = isWhiteSymbolOverlapping ? 'block' : 'none';
}
