<?php

use App\Models\User;

test('registration screen can be rendered', function () {
    $response = $this->get(route('register'));

    $response->assertOk();
});

test('new users can register', function () {
    $email = 'test-'.uniqid().'@example.com';

    $response = $this->post(route('register.store'), [
        'name' => 'Test User',
        'email' => $email,
        'employee_id' => 'test-'.uniqid(),
        'password' => 'password',
        'password_confirmation' => 'password',
        'preferred_contact_method' => 'email',
    ]);

    $response->assertRedirect(route('dashboard', absolute: false));
    expect(User::where('email', $email)->exists())->toBeTrue();
    $this->assertAuthenticated();
});
