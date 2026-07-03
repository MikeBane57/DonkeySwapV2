<?php

namespace App\Services\BidTools;

use App\Models\BidSimulation;
use App\Models\BidSimulationParticipant;

final class SimulationParticipantSeniorityService
{
    public function makeRoomForInsert(BidSimulation $simulation, int $rank): void
    {
        $participants = BidSimulationParticipant::query()
            ->where('bid_simulation_id', $simulation->id)
            ->where('seniority_rank', '>=', $rank)
            ->orderByDesc('seniority_rank')
            ->get();

        foreach ($participants as $participant) {
            $participant->update([
                'seniority_rank' => $participant->seniority_rank + 1,
            ]);
        }
    }

    public function reposition(
        BidSimulationParticipant $participant,
        int $newRank,
        int $oldRank,
    ): void {
        if ($newRank === $oldRank) {
            return;
        }

        $simulationId = (int) $participant->bid_simulation_id;
        $tempRank = (int) BidSimulationParticipant::query()
            ->where('bid_simulation_id', $simulationId)
            ->max('seniority_rank') + 1000;

        $participant->update(['seniority_rank' => $tempRank]);

        if ($newRank < $oldRank) {
            $toShift = BidSimulationParticipant::query()
                ->where('bid_simulation_id', $simulationId)
                ->where('id', '!=', $participant->id)
                ->where('seniority_rank', '>=', $newRank)
                ->where('seniority_rank', '<', $oldRank)
                ->orderByDesc('seniority_rank')
                ->get();

            foreach ($toShift as $row) {
                $row->update(['seniority_rank' => $row->seniority_rank + 1]);
            }
        } else {
            $toShift = BidSimulationParticipant::query()
                ->where('bid_simulation_id', $simulationId)
                ->where('id', '!=', $participant->id)
                ->where('seniority_rank', '>', $oldRank)
                ->where('seniority_rank', '<=', $newRank)
                ->orderBy('seniority_rank')
                ->get();

            foreach ($toShift as $row) {
                $row->update(['seniority_rank' => $row->seniority_rank - 1]);
            }
        }

        $participant->update(['seniority_rank' => $newRank]);
    }
}
