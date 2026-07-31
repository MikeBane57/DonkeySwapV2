export function BidToolsPrintStyles() {
    return (
        <style>{`
            @media print {
                @page {
                    size: landscape;
                    margin: 0.15in;
                }

                body.bid-tools-printing * {
                    visibility: hidden;
                }

                body.bid-tools-printing .bid-tools-print-active,
                body.bid-tools-printing .bid-tools-print-active * {
                    visibility: visible;
                }

                body.bid-tools-printing .bid-tools-print-active {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                    padding: 0 !important;
                    margin: 0 !important;
                }

                body:not(.bid-tools-printing) * {
                    visibility: hidden;
                }

                body:not(.bid-tools-printing) .bid-tools-print,
                body:not(.bid-tools-printing) .bid-tools-print * {
                    visibility: visible;
                }

                body:not(.bid-tools-printing) .bid-tools-print {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                    padding: 0 !important;
                    margin: 0 !important;
                }

                .no-print,
                .print-hide {
                    display: none !important;
                }

                .print-only {
                    display: block !important;
                }

                .bid-tools-print-title {
                    font-size: 11pt;
                    font-weight: 600;
                    margin: 0 0 2px;
                    line-height: 1.1;
                }

                .bid-tools-print-subtitle {
                    font-size: 7pt;
                    color: #444;
                    margin: 0 0 4px;
                    line-height: 1.2;
                }

                .bid-tools-print-table {
                    width: 100% !important;
                    min-width: 0 !important;
                    font-size: 6.5pt;
                    line-height: 1.05;
                    border-collapse: collapse;
                    table-layout: fixed;
                }

                .bid-tools-print-table th,
                .bid-tools-print-table td {
                    padding: 1px 2px !important;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    border-bottom: 0.5px solid #ccc;
                }

                .bid-tools-print-table th {
                    font-weight: 600;
                    background: #f0f0f0 !important;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }

                .bid-tools-print-table .wrap {
                    white-space: normal;
                    font-size: 6pt;
                    line-height: 1.05;
                }

                .buddy-bid-print-month {
                    break-inside: avoid;
                    margin-bottom: 6px;
                }

                .buddy-bid-print-month-title {
                    margin: 0 0 2px;
                    line-height: 1.1;
                }

                .buddy-bid-print-calendar-stack {
                    display: block;
                }

                .buddy-bid-status-cell {
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                    font-size: 6pt;
                    font-weight: 600;
                }
            }

            @media screen {
                .print-only {
                    display: none !important;
                }
            }
        `}</style>
    );
}
