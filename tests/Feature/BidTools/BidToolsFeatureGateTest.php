<?php

use App\Models\User;

test('bid tools routes return 404 when feature disabled', function () {
    config(['features.bid_tools' => false]);

    $user = User::factory()->create();
    $this->actingAs($user);

    $this->get('/app/bid-tools')->assertNotFound();
});

test('authenticated user can open bid tools hub when feature enabled', function () {
    config(['features.bid_tools' => true]);

    $user = User::factory()->create();
    $this->actingAs($user);

    $this->get('/app/bid-tools')->assertOk();
});
