'use strict';

const SERVER_EVENTS = Object.freeze({
  TIMER_TICK:     'timer:tick',
  TIMER_STATE:    'timer:state',
  CUE_FIRED:      'cue:fired',
  ASSET_ADDED:    'asset:added',
  ASSET_REMOVED:  'asset:removed',
  PROJECT_SAVED:  'project:saved',
});

const CLIENT_EVENTS = Object.freeze({
  TIMER_PLAY:   'timer:play',
  TIMER_PAUSE:  'timer:pause',
  TIMER_STOP:   'timer:stop',
  TIMER_RESET:  'timer:reset',
  TIMER_SET:    'timer:set',
  LOAD_PROJECT: 'project:load',
  FIRE_CUE:     'cue:fire',
});

module.exports = { SERVER_EVENTS, CLIENT_EVENTS };
