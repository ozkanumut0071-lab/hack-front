
import React from 'react';

/**
 * TransactionQueue - Displays a list of queued transactions waiting for batch execution
 * @param {Array} queue - List of transaction objects
 * @param {Function} onExecute - Callback to execute all transactions
 * @param {Function} onClear - Callback to clear the queue
 * @param {Function} onRemove - Callback to remove a specific transaction (by index)
 * @param {Boolean} isLoading - Whether execution is in progress
 */
const TransactionQueue = ({ queue, onExecute, onClear, onRemove, isLoading }) => {
    if (!queue || queue.length === 0) return null;

    return (
        <div className="transaction-queue-card" style={{
            marginBottom: '20px',
            background: 'rgba(30, 41, 59, 0.7)',
            borderRadius: '16px',
            padding: '16px',
            border: '1px solid var(--border-subtle)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'var(--text-main)' }}>
                    Transaction Queue ({queue.length})
                </h3>
                <button
                    className="btn btn-xs btn-ghost"
                    onClick={onClear}
                    style={{ color: 'var(--text-soft)', fontSize: '12px' }}
                    disabled={isLoading}
                >
                    Clear All
                </button>
            </div>

            <div className="queue-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                {queue.map((tx, index) => (
                    <div key={index} className="queue-item" style={{
                        background: 'rgba(15, 23, 42, 0.5)',
                        padding: '10px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderLeft: '3px solid var(--primary)'
                    }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>
                                {tx.type === 'transfer' ? 'Transfer' :
                                    tx.type === 'move_call' ? 'Contract Call' : 'Transaction'}
                            </div>
                            <div style={{ color: 'var(--text-soft)', fontSize: '11px', marginTop: '2px' }}>
                                {getTxSummary(tx)}
                            </div>
                        </div>
                        {onRemove && (
                            <button
                                onClick={() => onRemove(index)}
                                className="btn-icon"
                                style={{ marginLeft: '8px', opacity: 0.6, cursor: 'pointer', background: 'none', border: 'none', color: '#ef4444' }}
                                disabled={isLoading}
                                title="Remove"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                ))}
            </div>

            <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <button
                    className="btn btn-primary btn-block"
                    onClick={onExecute}
                    disabled={isLoading}
                    style={{ width: '100%', justifyContent: 'center' }}
                >
                    {isLoading ? 'Processing...' : `Execute Batch (${queue.length})`}
                </button>
            </div>
        </div>
    );
};

// Helper to generate a human-readable summary of the transaction
function getTxSummary(tx) {
    if (tx.type === 'transfer') {
        const amount = tx.amount_formatted || tx.amount;
        const token = tx.token || 'SUI';
        const to = tx.recipient ? `${tx.recipient.slice(0, 6)}...` : 'Unknown';
        return `${amount} ${token} -> ${to}`;
    } else if (tx.type === 'move_call') {
        if (tx.function_name === 'create_address_book') return 'Create Address Book';
        if (tx.function_name === 'add_contact') return `Add Contact: ${tx.arguments?.[1]?.value || 'Unknown'}`;

        // Generic move call
        const targetParts = tx.target?.split('::');
        const funcName = targetParts ? targetParts[2] : 'Function Call';
        return funcName;
    }
    return 'Detailed operation';
}

export default TransactionQueue;
