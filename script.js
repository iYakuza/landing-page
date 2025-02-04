const drag = document.getElementById('drag');
const message = document.getElementById('message');
const line = document.querySelector('.line');
const proverbLink = document.querySelector('.proverb-link');
const infinitySymbol = document.getElementById('infinity');
const whiteSymbol = document.querySelector('.symbol.right');

let isDragging = false;
let initialX = 0;
let offsetX = 0;
let isOverlapping = false;

drag.addEventListener('mousedown', (e) => {
  isDragging = true;
  initialX = e.clientX - offsetX;
  message.textContent = 'Hold on!';
});

document.addEventListener('mousemove', (e) => {
  if (isDragging) {
    offsetX = e.clientX - initialX;
    drag.style.transform = `translateX(${offsetX}px) translateY(-50%)`;

    // Check overlaps
    checkOverlap();
  }
});

document.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;

    if (isOverlapping) {
      // Trigger proverb link action
      window.location.href = proverbLink.href;
    } else {
      // Reset drag position
      resetDragPosition();
    }
  }
});

function resetDragPosition() {
  offsetX = 0;
  drag.style.transform = `translateX(0) translateY(-50%)`;
  message.textContent = '';
}

function checkOverlap() {
  const dragRect = drag.getBoundingClientRect();
  const infinityRect = infinitySymbol.getBoundingClientRect();

  isOverlapping = !(dragRect.right < infinityRect.left ||
    dragRect.left > infinityRect.right ||
    dragRect.bottom < infinityRect.top ||
    dragRect.top > infinityRect.bottom);

  proverbLink.style.display = isOverlapping ? 'block' : 'none';
}
