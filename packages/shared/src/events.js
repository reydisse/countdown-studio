'use strict';

const SERVER_EVENTS = Object.freeze({
  TIMER_TICK:     'timer:tick',
  TIMER_STATE:    'timer:state',
  CUE_FIRED:      'cue:fired',
  ASSET_ADDED:    'asset:added',
  ASSET_REMOVED:  'asset:removed',
  PROJECT_SAVED:  'project:saved',
  ROOM_JOINED:    'room:joined',
  ROOM_NOT_FOUND: 'room:not_found',
  PROMPTER_STATE: 'prompter:state',
  PROMPTER_TICK:  'prompter:tick',
});

const CLIENT_EVENTS = Object.freeze({
  TIMER_PLAY:        'timer:play',
  TIMER_PAUSE:       'timer:pause',
  TIMER_STOP:        'timer:stop',
  TIMER_RESET:       'timer:reset',
  TIMER_SET:         'timer:set',
  LOAD_PROJECT:      'project:load',
  FIRE_CUE:          'cue:fire',
  JOIN_ROOM:         'room:join',
  LEAVE_ROOM:        'room:leave',
  PROMPTER_PLAY:     'prompter:play',
  PROMPTER_PAUSE:    'prompter:pause',
  PROMPTER_STOP:     'prompter:stop',
  PROMPTER_SPEED:    'prompter:speed',
  PROMPTER_SEEK:     'prompter:seek',
  PROMPTER_SETTINGS: 'prompter:settings',
});

module.exports = { SERVER_EVENTS, CLIENT_EVENTS };
