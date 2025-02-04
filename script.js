const drag = document.getElementById('drag');
const message = document.getElementById('message');
const line = document.querySelector('.line');
const proverbLink = document.querySelector('.proverb-link');
const infinitySymbol = document.getElementById('infinity');

let isDragging = false;
let initialX = 0;
let offsetX = 0;

drag.addEventListener('mousedown', (e) => {
  isDragging = true;
  initialX = e.clientX - offsetX;
  message.textContent = 'Hold on!';
});

document.addEventListener('mousemove', (e) => {
  if (isDragging) {
    offsetX = e.clientX - initialX;
    drag.style.left = `calc(50% + ${offsetX}px)`;

    // Check for overlap
    checkOverlap();
  }
});

document.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;

    if (!checkOverlap()) {
      resetDragPosition();
    } else {
      window.location.href = proverbLink.href;
    }
  }
});

function resetDragPosition() {
  offsetX = 0;
  drag.style.left = '50%';
  message.textContent = '';
}

function checkOverlap() {
  const dragRect = drag.getBoundingClientRect();
  const infinityRect = infinitySymbol.getBoundingClientRect();

  const isOverlapping = !(
    dragRect.right < infinityRect.left ||
    dragRect.left > infinityRect.right ||
    dragRect.bottom < infinityRect.top ||
    dragRect.top > infinityRect.bottom
  );

  proverbLink.style.display = isOverlapping ? 'block' : 'none';
  return isOverlapping;
}
