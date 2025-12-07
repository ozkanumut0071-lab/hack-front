import React, { useState, useEffect } from 'react';
import { useSuiClient } from '@mysten/dapp-kit';

/**
 * HistoryPage - Display wallet transaction history from Sui blockchain
 */
function HistoryPage({ walletAddress }) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const suiClient = useSuiClient();

    useEffect(() => {
        if (walletAddress) {
            fetchTransactionHistory();
        }
    }, [walletAddress]);

    const fetchTransactionHistory = async () => {
        if (!walletAddress) return;

        setLoading(true);
        setError(null);

        try {
            // Query transaction blocks for the user's address
            // Note: Querying all transactions and filtering client-side for simplicity
            const response = await suiClient.queryTransactionBlocks({
                filter: {
                    FromAddress: walletAddress,
                },
                options: {
                    showInput: true,
                    showEffects: true,
                    showEvents: true,
                    showBalanceChanges: true,
                },
                limit: 50,
                order: 'descending', // Most recent first
            });

            // Parse transactions
            const parsedTxs = response.data.map((tx, index) => {
                const digest = tx.digest;
                const timestamp = tx.timestampMs ?
                    new Date(parseInt(tx.timestampMs)).toLocaleString() :
                    'Unknown';

                // Determine transaction type
                let txType = 'Unknown';
                let asset = 'SUI';
                let amount = '-';
                let recipient = '-';

                // Check balance changes
                const balanceChanges = tx.balanceChanges || [];
                const suiChange = balanceChanges.find(change =>
                    change.coinType === '0x2::sui::SUI' && change.owner === walletAddress
                );

                if (suiChange) {
                    const amountInSui = Math.abs(parseInt(suiChange.amount)) / 1e9;
                    amount = `${amountInSui.toFixed(4)} SUI`;

                    // Determine if sent or received
                    if (parseInt(suiChange.amount) < 0) {
                        txType = 'SEND';
                    } else {
                        txType = 'RECEIVE';
                    }
                }

                // Check for specific transaction types
                const txInput = tx.transaction?.data?.transaction;
                if (txInput?.kind === 'ProgrammableTransaction') {
                    const commands = txInput.transactions || [];

                    // Check for stake/unstake
                    commands.forEach(cmd => {
                        if (cmd.MoveCall) {
                            const func = cmd.MoveCall.function;
                            if (func === 'stake') {
                                txType = 'STAKE';
                            } else if (func === 'unstake') {
                                txType = 'UNSTAKE';
                            }
                        }
                    });
                }

                return {
                    id: digest.slice(0, 12) + '...',
                    fullDigest: digest,
                    type: txType,
                    asset: asset,
                    amount: amount,
                    status: tx.effects?.status?.status === 'success' ? 'Success' : 'Failed',
                    time: timestamp,
                    recipient: recipient,
                    viaAgent: false, // We can't determine this from on-chain data alone
                };
            });

            setTransactions(parsedTxs);
        } catch (err) {
            console.error('Error fetching transaction history:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!walletAddress) {
        return (
            <div className="page">
                <div className="page-header">
                    <h2>Transaction History</h2>
                    <p>Connect your wallet to view transaction history.</p>
                </div>
                <div className="page-card" style={{ textAlign: 'center', padding: '60px' }}>
                    <h3 style={{ marginBottom: '16px' }}>🔒 Wallet Not Connected</h3>
                    <p style={{ opacity: 0.7 }}>Please connect your wallet to view your transaction history.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="page-header">
                <h2>Transaction History</h2>
                <p>
                    All on-chain activity for your wallet address. Data pulled directly from Sui blockchain.
                </p>
                {walletAddress && (
                    <p style={{ fontSize: '12px', opacity: 0.7, fontFamily: 'monospace', marginTop: '8px' }}>
                        Address: {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
                    </p>
                )}
            </div>

            <div className="history-layout">
                <div className="page-card history-card">
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px' }}>
                            <p>Loading transaction history...</p>
                        </div>
                    ) : error ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#ef4444' }}>
                            <p>Error: {error}</p>
                            <button
                                className="btn btn-ghost"
                                onClick={fetchTransactionHistory}
                                style={{ marginTop: '16px' }}
                            >
                                Retry
                            </button>
                        </div>
                    ) : transactions.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px' }}>
                            <p style={{ opacity: 0.7 }}>No transactions found for this wallet.</p>
                        </div>
                    ) : (
                        <>
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Tx Digest</th>
                                        <th>Type</th>
                                        <th>Amount</th>
                                        <th>Status</th>
                                        <th>Time</th>
                                        <th>Explorer</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.map((tx, index) => (
                                        <tr key={index}>
                                            <td className="mono" style={{ fontSize: '12px' }}>
                                                {tx.id}
                                            </td>
                                            <td>
                                                <span className="badge badge-outline">
                                                    {tx.type}
                                                </span>
                                            </td>
                                            <td>{tx.amount}</td>
                                            <td>
                                                <span
                                                    className={
                                                        "badge " +
                                                        (tx.status === "Success"
                                                            ? "badge-success"
                                                            : "badge-danger")
                                                    }
                                                >
                                                    {tx.status}
                                                </span>
                                            </td>
                                            <td className="mono" style={{ fontSize: '11px' }}>
                                                {tx.time}
                                            </td>
                                            <td>
                                                <a
                                                    href={`https://suiscan.xyz/testnet/tx/${tx.fullDigest}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="btn btn-ghost"
                                                    style={{
                                                        padding: '4px 12px',
                                                        fontSize: '12px',
                                                        textDecoration: 'none'
                                                    }}
                                                >
                                                    View →
                                                </a>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div style={{
                                marginTop: '16px',
                                padding: '12px',
                                background: 'rgba(96, 165, 250, 0.1)',
                                borderRadius: '8px',
                                fontSize: '13px'
                            }}>
                                <p style={{ margin: 0, opacity: 0.8 }}>
                                    ℹ️ Showing last {transactions.length} transactions.
                                    <button
                                        className="btn btn-ghost"
                                        onClick={fetchTransactionHistory}
                                        style={{ marginLeft: '12px', padding: '4px 12px' }}
                                    >
                                        Refresh
                                    </button>
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default HistoryPage;
