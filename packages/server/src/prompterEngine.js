'use strict';

const { SERVER_EVENTS } = require('@showstack/shared');

const TICK_INTERVAL_MS = 50; // 20fps
// px per tick — keep in sync with Cloudflare RoomPrompter and reader UI.
const SPEED_PX = { 1:1, 2:2, 3:3, 4:4, 5:5, 6:7, 7:9, 8:11, 9:13, 10:15 };

function createPrompterEngine(broadcast) {
  let scrollPosition = 0;
  let totalHeight    = 0;
  let isPlaying      = false;
  let speed          = 3;
  let _interval      = null;

  const displaySettings = {
    fontSize:           48,
    lineWidth:          70,
    fontFamily:         'dm-sans',
    textColor:          '#ffffff',
    bgColor:            '#000000',
    isMirrored:         false,
    isFlippedVertical:  false,
    showFocusLine:      true,
    focusLinePosition:  40,
  };

  function pxPerTick() {
    return SPEED_PX[speed] ?? 3;
  }

  function tick() {
    if (!isPlaying) return;
    if (totalHeight > 0) {
      scrollPosition = Math.min(scrollPosition + pxPerTick(), totalHeight);
      if (scrollPosition >= totalHeight) { pause(); return; }
    } else {
      scrollPosition += pxPerTick();
    }
    broadcast(SERVER_EVENTS.PROMPTER_TICK, { scrollPosition, isPlaying, speed });
  }

  function play() {
    if (isPlaying || (totalHeight > 0 && scrollPosition >= totalHeight)) return;
    isPlaying = true;
    _interval = setInterval(tick, TICK_INTERVAL_MS);
    broadcast(SERVER_EVENTS.PROMPTER_TICK, { scrollPosition, isPlaying, speed });
  }

  function pause() {
    if (!isPlaying) return;
    clearInterval(_interval);
    _interval = null;
    isPlaying = false;
    broadcast(SERVER_EVENTS.PROMPTER_TICK, { scrollPosition, isPlaying, speed });
  }

  function stop() {
    clearInterval(_interval);
    _interval = null;
    isPlaying      = false;
    scrollPosition = 0;
    broadcast(SERVER_EVENTS.PROMPTER_TICK, { scrollPosition, isPlaying, speed });
  }

  function setSpeed(s) {
    speed = Math.max(1, Math.min(10, Number(s)));
    broadcast(SERVER_EVENTS.PROMPTER_TICK, { scrollPosition, isPlaying, speed });
  }

  function seekTo(position) {
    scrollPosition = Math.max(0, Math.min(Number(position), Math.max(0, totalHeight)));
    broadcast(SERVER_EVENTS.PROMPTER_TICK, { scrollPosition, isPlaying, speed });
  }

  function applySettings(patch) {
    Object.assign(displaySettings, patch);
    if (patch.totalHeight !== undefined) totalHeight = patch.totalHeight;
    broadcast('prompter:display', { ...displaySettings });
  }

  function getState() {
    return { scrollPosition, isPlaying, speed, totalHeight, ...displaySettings };
  }

  function destroy() {
    clearInterval(_interval);
    _interval = null;
  }

  return { play, pause, stop, setSpeed, seekTo, applySettings, getState, destroy };
}

module.exports = { createPrompterEngine };
