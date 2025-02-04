const drag = document.getElementById('drag');
const infinitySymbol = document.getElementById('infinity');
const message = document.getElementById('message');
const proverbLink = document.querySelector('.proverb-link');

let isDragging = false;
let offsetX = 0;

drag.addEventListener('mousedown', (e) => {
  isDragging = true;
  offsetX = e.clientX - drag.offsetLeft;
  message.textContent = 'Dragging...';
});

document.addEventListener('mousemove', (e) => {
  if (isDragging) {
    const newLeft = e.clientX - offsetX;
    drag.style.left = `${newLeft}px`;
    checkOverlap();
  }
});

document.addEventListener('mouseup', () => {
  isDragging = false;
  message.textContent = '';
});

function checkOverlap() {
  const dragRect = drag.getBoundingClientRect();
  const infinityRect = infinitySymbol.getBoundingClientRect();

  if (
    dragRect.right > infinityRect.left &&
    dragRect.left < infinityRect.right &&
    dragRect.bottom > infinityRect.top &&
    dragRect.top < infinityRect.bottom
  ) {
    proverbLink.style.display = 'block';
  } else {
    proverbLink.style.display = 'none';
  }
}
