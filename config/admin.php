<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default password for admin-created and imported users
    |--------------------------------------------------------------------------
    |
    | Applied server-side only (not validated with Password::defaults()).
    | Users should change this after first login. Override per environment with
    | ADMIN_DEFAULT_USER_PASSWORD if needed.
    |
    */
    'default_user_password' => env('ADMIN_DEFAULT_USER_PASSWORD', 'TWU550dispatch'),

];
