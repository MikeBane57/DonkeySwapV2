<?php

namespace App\Services\BidTools;

final class BidLinePreferenceCatalog
{
    public function __construct(
        private readonly CondensedDeskClassifier $deskClassifier,
    ) {}

    /**
     * Desk buckets present in this import (for scenario UI + scoring keys).
     *
     * @return list<array{key: string, label: string}>
     */
    public function deskCatalogForImport(int $bidImportId): array
    {
        return $this->deskClassifier->deskCatalogForImport($bidImportId);
    }

    /**
     * @return list<string>
     */
    public function deskKeysForImport(int $bidImportId, array $mappings = [], array $lineBuckets = []): array
    {
        return $this->deskClassifier->bucketsPresentInImport($bidImportId, $mappings, $lineBuckets);
    }

    /**
     * @return list<array{
     *   desk_group: string,
     *   start_time: string,
     *   auto_bucket: string,
     *   desk_bucket: string,
     *   is_manual: bool,
     *   line_count: int,
     *   sample_line_num: string,
     * }>
     */
    public function deskBucketReferenceForImport(int $bidImportId, array $mappings = []): array
    {
        return $this->deskClassifier->bucketReferenceForImport($bidImportId, $mappings);
    }
}
