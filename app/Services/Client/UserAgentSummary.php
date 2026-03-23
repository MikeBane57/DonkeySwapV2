<?php

namespace App\Services\Client;

/**
 * Lightweight browser/OS labels from a User-Agent string (no external deps).
 */
final class UserAgentSummary
{
    /**
     * @return array{browser: string, os: string}
     */
    public function summarize(?string $userAgent): array
    {
        $ua = $userAgent ?? '';
        $ua = trim(mb_substr($ua, 0, 500));

        return [
            'browser' => $this->browserLabel($ua),
            'os' => $this->osLabel($ua),
        ];
    }

    private function browserLabel(string $ua): string
    {
        if ($ua === '') {
            return 'Unknown';
        }

        if (preg_match('/Edg(?:e|A|iOS)?\/([\d.]+)/i', $ua, $m)) {
            return 'Edge '.$m[1];
        }
        if (preg_match('/OPR\/([\d.]+)/', $ua, $m)) {
            return 'Opera '.$m[1];
        }
        if (preg_match('/CriOS\/([\d.]+)/', $ua, $m)) {
            return 'Chrome (iOS) '.$m[1];
        }
        if (preg_match('/Chrome\/([\d.]+)/', $ua, $m) && ! preg_match('/Edg\//', $ua)) {
            return 'Chrome '.$m[1];
        }
        if (preg_match('/Firefox\/([\d.]+)/', $ua, $m)) {
            return 'Firefox '.$m[1];
        }
        if (preg_match('/Version\/([\d.]+).*Safari/', $ua, $m) && ! str_contains($ua, 'Chrome')) {
            return 'Safari '.$m[1];
        }
        if (preg_match('/SamsungBrowser\/([\d.]+)/', $ua, $m)) {
            return 'Samsung Internet '.$m[1];
        }

        return 'Other';
    }

    private function osLabel(string $ua): string
    {
        if ($ua === '') {
            return 'Unknown';
        }

        if (preg_match('/Windows NT 10\.0/i', $ua)) {
            return 'Windows';
        }
        if (preg_match('/Windows NT 6\.3/i', $ua)) {
            return 'Windows 8.1';
        }
        if (preg_match('/Windows NT 6\.2/i', $ua)) {
            return 'Windows 8';
        }
        if (preg_match('/Windows NT 6\.1/i', $ua)) {
            return 'Windows 7';
        }
        if (preg_match('/Android ([\d._]+)/i', $ua, $m)) {
            return 'Android '.$m[1];
        }
        if (preg_match('/CPU (?:iPhone )?OS ([\d_]+)/i', $ua, $m)) {
            return 'iOS '.str_replace('_', '.', $m[1]);
        }
        if (preg_match('/iPad.*OS ([\d_]+)/i', $ua, $m)) {
            return 'iPadOS '.str_replace('_', '.', $m[1]);
        }
        if (preg_match('/Mac OS X ([\d_]+)/i', $ua, $m)) {
            return 'macOS '.str_replace('_', '.', $m[1]);
        }
        if (stripos($ua, 'Linux') !== false) {
            return 'Linux';
        }
        if (stripos($ua, 'CrOS') !== false) {
            return 'Chrome OS';
        }

        return 'Unknown';
    }
}
