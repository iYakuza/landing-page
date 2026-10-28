/* Shared story navigation: every destination has a clear way forward. */
(() => {
  'use strict';
  const path = location.pathname.replace(/\/+$/, '');
  if (!path || path === '/landing-page' || path === '/landing-page/index.html') return;
  if (document.querySelector('.gd-journey-bridge')) return;

  const chapters = [
    {name:'01 / THE AWAKENING', title:'The Disturbance', href:'/landing-page/posts/the-awakening/', note:'Notice the signal.'},
    {name:'02 / THE DESCENT', title:'The First Chord', href:'/landing-page/posts/the-descent/', note:'Enter the unknown.'},
    {name:'03 / THE RECONNECTION', title:'A Thousand Frequencies', href:'/landing-page/posts/the-reconnection/', note:'Find the living world.'},
    {name:'04 / THE TRANSFORMATION', title:'One Frequency', href:'/landing-page/posts/the-transformation/', note:'Let patterns align.'},
    {name:'05 / THE RETURN', title:'The God Beneath the Noise', href:'/landing-page/posts/the-return/', note:'Return to silence.'}
  ];
  const project = '/landing-page/green-dream/';
  const music = '/landing-page/music.html';
  const archive = '/landing-page/posts/';
  const community = '/landing-page/posts/community/';
  let current = -1;
  chapters.forEach((chapter, index) => {
    if (path === chapter.href.replace(/\/$/, '') || path === chapter.href + 'index.html') current = index;
  });

  let label = 'KEEP FOLLOWING THE SIGNAL';
  let title = 'Every page is part of the journey.';
  let previous = {label:'PROJECT NOTES', href:project};
  let next = {label:'BEGIN WITH THE AWAKENING', href:chapters[0].href};
  let progress = 0;
  if (current >= 0) {
    const chapter = chapters[current];
    label = 'MOVEMENT ' + (current + 1) + ' OF 5';
    title = chapter.title;
    progress = (current + 1) * 20;
    previous = current === 0
      ? {label:'RETURN HOME', href:'/landing-page/'}
      : {label:chapters[current - 1].name, href:chapters[current - 1].href};
    next = current === 4
      ? {label:'ENTER THE LISTENING ROOM', href:music}
      : {label:chapters[current + 1].name, href:chapters[current + 1].href};
  } else if (path === project.replace(/\/$/, '') || path === project + 'index.html') {
    label = 'FIELD NOTES / THE WORLD BEHIND THE MUSIC';
    title = 'Understand the world. Then enter it.';
    previous = {label:'HOME / THE ENTRANCE', href:'/landing-page/'};
    next = {label:'BEGIN WITH THE AWAKENING', href:chapters[0].href};
  } else if (path === music.replace(/\/$/, '') || path === '/landing-page/music/index.html') {
    label = 'LISTENING ROOM / SOUND WITHOUT A RUSH';
    title = 'Stay with the sound a little longer.';
    previous = {label:'MOVEMENT 05 / THE RETURN', href:chapters[4].href};
    next = {label:'LEAVE A COMMUNITY SIGNAL', href:community};
  } else if (path === archive.replace(/\/$/, '') || path === archive + 'index.html') {
    label = 'TRANSMISSIONS / THE WRITTEN ARCHIVE';
    title = 'Read in order, or follow a thread.';
    previous = {label:'PROJECT NOTES', href:project};
    next = {label:'START WITH THE AWAKENING', href:chapters[0].href};
  } else if (path === community.replace(/\/$/, '') || path === community + 'index.html') {
    label = 'COMMUNITY SIGNALS / YOUR TURN';
    title = 'The story continues when someone answers.';
    previous = {label:'LISTENING ROOM', href:music};
    next = {label:'RETURN TO THE JOURNEY', href:'/landing-page/'};
  } else {
    return;
  }

  const bridge = document.createElement('section');
  bridge.className = 'gd-journey-bridge';
  bridge.setAttribute('aria-label', 'Continue the GREEN DREAM journey');
  bridge.innerHTML =
    '<div class="gd-journey-bridge-inner">' +
      '<div class="gd-journey-bridge-copy">' +
        '<p class="gd-kicker">' + label + '</p>' +
        '<h2>' + title + '</h2>' +
        (current >= 0 ? '<div class="gd-journey-progress" role="progressbar" aria-label="Journey progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + progress + '"><span style="width:' + progress + '%"></span></div>' : '') +
      '</div>' +
      '<nav class="gd-journey-bridge-actions" aria-label="Previous and next destinations">' +
        '<a class="gd-journey-prev" href="' + previous.href + '"><small>← PREVIOUS / SIDE PATH</small><strong>' + previous.label + '</strong></a>' +
        '<a class="gd-journey-next" href="' + next.href + '"><small>NEXT / KEEP GOING →</small><strong>' + next.label + '</strong></a>' +
      '</nav>' +
    '</div>';
  const footer = document.querySelector('footer.gd-footer, .gd-footer, footer');
  if (footer && footer.parentNode) footer.parentNode.insertBefore(bridge, footer);
  else document.body.appendChild(bridge);
})();