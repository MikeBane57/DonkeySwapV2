<?php

use App\Models\User;
use App\Models\Workgroup;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

test('admin can delete another user', function () {
    $admin = User::factory()->admin()->create();
    $worker = User::factory()->create();
    $this->actingAs($admin);

    $response = $this->delete(route('admin.users.destroy', $worker));

    $response->assertRedirect(route('admin.users'));
    $this->assertDatabaseMissing('users', ['id' => $worker->id]);
});

test('admin cannot delete themselves', function () {
    $admin = User::factory()->admin()->create();
    $this->actingAs($admin);

    $response = $this->from(route('admin.users'))->delete(route('admin.users.destroy', $admin));

    $response->assertSessionHasErrors('user');
    $this->assertDatabaseHas('users', ['id' => $admin->id]);
});

test('admin can create user without sending password; default is applied', function () {
    $admin = User::factory()->admin()->create();
    $wg = Workgroup::factory()->create();
    $this->actingAs($admin);

    $response = $this->from(route('admin.users'))->post(route('admin.users.store'), [
        'name' => 'New Hire',
        'email' => 'newhire@example.test',
        'employee_id' => null,
        'role' => 'worker',
        'time_display_preference' => 'central',
        'preferred_contact_method' => 'email',
        'phone' => null,
        'workgroups' => [
            [
                'workgroup_id' => $wg->id,
                'classification_seniority_date' => null,
                'qualification_ids' => [],
            ],
        ],
    ]);

    $response->assertRedirect(route('admin.users'));
    $user = User::where('email', 'newhire@example.test')->firstOrFail();
    expect(Hash::check((string) config('admin.default_user_password'), $user->password))->toBeTrue();
});

test('admin can reset user password to default', function () {
    $admin = User::factory()->admin()->create();
    $worker = User::factory()->create(['password' => 'something-else-password']);
    $this->actingAs($admin);

    $response = $this->post(route('admin.users.reset-password', $worker));

    $response->assertRedirect(route('admin.users'));
    $worker->refresh();
    expect(Hash::check((string) config('admin.default_user_password'), $worker->password))->toBeTrue();
});

test('admin can import users from csv content', function () {
    $admin = User::factory()->admin()->create();
    $wg = Workgroup::factory()->create(['name' => 'Import Test WG']);
    $this->actingAs($admin);

    $csv = "name,email,workgroups\nImport One,import1@example.test,Import Test WG\nImport Two,import2@example.test,";

    $response = $this->post(route('admin.users.import'), [
        'csv_content' => $csv,
    ]);

    $response->assertRedirect(route('admin.users'));
    $this->assertDatabaseHas('users', ['email' => 'import1@example.test']);
    $this->assertDatabaseHas('users', ['email' => 'import2@example.test']);

    $u1 = User::where('email', 'import1@example.test')->firstOrFail();
    $this->assertTrue(
        DB::table('user_workgroups')->where('user_id', $u1->id)->where('workgroup_id', $wg->id)->exists()
    );
    $u2 = User::where('email', 'import2@example.test')->firstOrFail();
    $this->assertSame(0, DB::table('user_workgroups')->where('user_id', $u2->id)->count());
});

test('import skips duplicate emails', function () {
    $admin = User::factory()->admin()->create();
    User::factory()->create(['email' => 'existing@example.test']);
    $this->actingAs($admin);

    $csv = "name,email,workgroups\nNew User,new@example.test,\nDup,existing@example.test,";

    $this->post(route('admin.users.import'), [
        'csv_content' => $csv,
    ]);

    $this->assertDatabaseHas('users', ['email' => 'new@example.test']);
    $this->assertEquals(1, User::where('email', 'existing@example.test')->count());
});

test('import fails row with unknown workgroup name', function () {
    $admin = User::factory()->admin()->create();
    Workgroup::factory()->create(['name' => 'Only Real WG']);
    $this->actingAs($admin);

    $csv = "name,email,workgroups\nBad User,bad-wg@example.test,Not A Real WG";

    $this->post(route('admin.users.import'), [
        'csv_content' => $csv,
    ]);

    $this->assertDatabaseMissing('users', ['email' => 'bad-wg@example.test']);
});
