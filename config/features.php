<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Pre-release / beta features (no per-feature .env keys)
    |--------------------------------------------------------------------------
    | Off when APP_ENV is production until you change the rule here (or adopt DB flags).
    | Uses existing APP_ENV only — no separate env key per feature.
    | See .cursor/rules/feature-gates.mdc.
    */
    'bid_tools' => env('APP_ENV', 'production') !== 'production',
];
