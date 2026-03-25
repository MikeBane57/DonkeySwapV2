<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TutorialMarkSeenTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_mark_tutorial_seen(): void
    {
        $this->post(route('tutorial.mark-seen'), [
            'feature_ids' => ['get-started'],
        ])->assertRedirect(route('login'));
    }

    public function test_authenticated_user_can_merge_seen_feature_ids(): void
    {
        $user = User::factory()->create([
            'tutorial_progress' => ['seen_feature_ids' => ['a']],
        ]);

        $this->actingAs($user)
            ->post(route('tutorial.mark-seen'), [
                'feature_ids' => ['b', 'get-started'],
            ])
            ->assertRedirect();

        $user->refresh();
        $this->assertEqualsCanonicalizing(
            ['a', 'b', 'get-started'],
            $user->seenTutorialFeatureIds()
        );
    }
}
