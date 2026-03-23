<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('admin can view active sessions page', function () {
    $admin = User::factory()->admin()->create();
    $this->actingAs($admin);

    $response = $this->get(route('admin.active-sessions'));

    $response->assertOk();
    $response->assertInertia(fn (Assert $page) => $page
        ->component('admin/active-sessions')
        ->where('sessions_unavailable', true));
});

test('non-admin cannot view active sessions', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $this->get(route('admin.active-sessions'))->assertForbidden();
});
