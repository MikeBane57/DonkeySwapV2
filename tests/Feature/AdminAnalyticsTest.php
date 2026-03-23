<?php

use App\Models\User;

test('admin can view analytics page', function () {
    $admin = User::factory()->admin()->create();
    $this->actingAs($admin);

    $response = $this->get(route('admin.analytics', ['days' => 14]));

    $response->assertOk();
});
