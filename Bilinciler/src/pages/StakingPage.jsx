import React, { useState, useEffect } from "react";

// ---- PAGE: STAKING ----

function StakingPage({ walletAddress, suiBalance, signAndExecute, isConnected }) {
    const [stakeAmount, setStakeAmount] = useState("");
    const [unstakeAmount, setUnstakeAmount] = useState("");
    const [isStaking, setIsStaking] = useState(false);
    const [isUnstaking, setIsUnstaking] = useState(false);
    const [stakeInfo, setStakeInfo] = useState(null);
    const [statusMessage, setStatusMessage] = useState("");
    const [loadingInfo, setLoadingInfo] = useState(false);

    // Staking configuration - matches backend
    const STAKE_PACKAGE_ID = "0x8e385abb2ccefc0aed625567e72c8005f06ae3a97d534a25cb8e5dd2b62f6f9c";
    const STAKE_MODULE = "stake";
    const STAKE_POOL_ID = "0x3115704216024fdfb16b823bb5b4f6a7113747ef1c28435fb14e44b5ad19ebd9";

    // Fetch stake info on mount and after transactions
    useEffect(() => {
        if (walletAddress) {
            fetchStakeInfo();
        }
    }, [walletAddress]);

    const fetchStakeInfo = async () => {
        setLoadingInfo(true);
        try {
            // Query StakePool object for total staked
            const response = await fetch("https://fullnode.testnet.sui.io", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 1,
                    method: "sui_getObject",
                    params: [STAKE_POOL_ID, { showContent: true }]
                })
            });
            const result = await response.json();
            const fields = result?.result?.data?.content?.fields || {};
            const totalBalance = parseInt(fields?.balance || 0);

            setStakeInfo({
                totalStaked: (totalBalance / 1e9).toFixed(4),
                poolId: STAKE_POOL_ID.slice(0, 12) + "..."
            });
        } catch (err) {
            console.error("Error fetching stake info:", err);
        }
        setLoadingInfo(false);
    };

    const handleStake = async () => {
        if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
            setStatusMessage("Please enter a valid amount to stake");
            return;
        }

        setIsStaking(true);
        setStatusMessage("Building stake transaction...");

        try {
            const amountMist = Math.floor(parseFloat(stakeAmount) * 1e9);

            // Import Transaction from @mysten/sui
            const { Transaction } = await import("@mysten/sui/transactions");
            const tx = new Transaction();

            // Split coins for exact amount to stake
            const [coinToStake] = tx.splitCoins(tx.gas, [tx.pure.u64(amountMist)]);

            // Call stake function
            tx.moveCall({
                target: `${STAKE_PACKAGE_ID}::${STAKE_MODULE}::stake`,
                arguments: [
                    tx.object(STAKE_POOL_ID),
                    coinToStake
                ]
            });

            setStatusMessage("Please sign the transaction in your wallet...");

            signAndExecute(
                { transaction: tx },
                {
                    onSuccess: (result) => {
                        setStatusMessage(`✅ Staked ${stakeAmount} SUI! TX: ${result.digest.slice(0, 12)}...`);
                        setStakeAmount("");
                        fetchStakeInfo();
                    },
                    onError: (error) => {
                        setStatusMessage(`❌ Stake failed: ${error.message}`);
                    }
                }
            );
        } catch (error) {
            console.error("Stake error:", error);
            setStatusMessage(`❌ Error: ${error.message}`);
        }
        setIsStaking(false);
    };

    const handleUnstake = async () => {
        if (!unstakeAmount || parseFloat(unstakeAmount) <= 0) {
            setStatusMessage("Please enter a valid amount to unstake");
            return;
        }

        setIsUnstaking(true);
        setStatusMessage("Building unstake transaction...");

        try {
            const amountMist = Math.floor(parseFloat(unstakeAmount) * 1e9);

            const { Transaction } = await import("@mysten/sui/transactions");
            const tx = new Transaction();

            // Call unstake function
            tx.moveCall({
                target: `${STAKE_PACKAGE_ID}::${STAKE_MODULE}::unstake`,
                arguments: [
                    tx.object(STAKE_POOL_ID),
                    tx.pure.u64(amountMist)
                ]
            });

            setStatusMessage("Please sign the transaction in your wallet...");

            signAndExecute(
                { transaction: tx },
                {
                    onSuccess: (result) => {
                        setStatusMessage(`✅ Unstaked ${unstakeAmount} SUI! TX: ${result.digest.slice(0, 12)}...`);
                        setUnstakeAmount("");
                        fetchStakeInfo();
                    },
                    onError: (error) => {
                        setStatusMessage(`❌ Unstake failed: ${error.message}`);
                    }
                }
            );
        } catch (error) {
            console.error("Unstake error:", error);
            setStatusMessage(`❌ Error: ${error.message}`);
        }
        setIsUnstaking(false);
    };

    if (!isConnected) {
        return (
            <div className="page">
                <div className="page-header">
                    <h2>SUI Staking Pool</h2>
                    <p>Connect your wallet to stake SUI and earn rewards.</p>
                </div>
                <div className="page-card" style={{ textAlign: 'center', padding: '60px' }}>
                    <h3 style={{ marginBottom: '16px' }}>🔒 Wallet Not Connected</h3>
                    <p style={{ opacity: 0.7 }}>Please connect your wallet to access staking features.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="page-header">
                <h2>SUI Staking Pool</h2>
                <p>Stake your SUI tokens to earn rewards. By using staking contract.</p>
            </div>

            {/* Status Message */}
            {statusMessage && (
                <div className="page-card" style={{
                    marginBottom: '16px',
                    padding: '12px 16px',
                    borderLeft: statusMessage.includes('✅') ? '4px solid #10b981' :
                        statusMessage.includes('❌') ? '4px solid #ef4444' : '4px solid #60a5fa'
                }}>
                    {statusMessage}
                </div>
            )}

            <div className="staking-layout">
                {/* Pool Info Card */}
                <div className="page-card" style={{ marginBottom: '24px' }}>
                    <h3 style={{ marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
                        📊 Pool Statistics
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                        <div>
                            <div style={{ opacity: 0.7, fontSize: '12px', marginBottom: '4px' }}>TOTAL STAKED IN POOL</div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#60a5fa' }}>
                                {loadingInfo ? '...' : `${stakeInfo?.totalStaked || '0'} SUI`}
                            </div>
                        </div>
                        <div>
                            <div style={{ opacity: 0.7, fontSize: '12px', marginBottom: '4px' }}>YOUR BALANCE</div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>
                                {suiBalance?.toFixed(4) || '0'} SUI
                            </div>
                        </div>
                        <div>
                            <div style={{ opacity: 0.7, fontSize: '12px', marginBottom: '4px' }}>POOL ADDRESS</div>
                            <div style={{ fontSize: '14px', fontFamily: 'monospace' }}>
                                {stakeInfo?.poolId || STAKE_POOL_ID.slice(0, 12) + '...'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stake / Unstake Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    {/* Stake Card */}
                    <div className="page-card staking-column">
                        <h3 style={{ marginBottom: '16px', color: '#10b981' }}>➕ Stake SUI</h3>
                        <p style={{ opacity: 0.7, fontSize: '14px', marginBottom: '16px' }}>
                            Lock your SUI in the staking pool.
                        </p>
                        <div style={{ marginBottom: '16px' }}>
                            <input
                                type="number"
                                placeholder="Amount in SUI"
                                value={stakeAmount}
                                onChange={(e) => setStakeAmount(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    fontSize: '16px',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    color: 'inherit'
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                            <button
                                className="btn btn-ghost"
                                onClick={() => setStakeAmount((suiBalance * 0.25).toFixed(4))}
                                style={{ flex: 1 }}
                            >25%</button>
                            <button
                                className="btn btn-ghost"
                                onClick={() => setStakeAmount((suiBalance * 0.5).toFixed(4))}
                                style={{ flex: 1 }}
                            >50%</button>
                            <button
                                className="btn btn-ghost"
                                onClick={() => setStakeAmount((suiBalance * 0.75).toFixed(4))}
                                style={{ flex: 1 }}
                            >75%</button>
                            <button
                                className="btn btn-ghost"
                                onClick={() => setStakeAmount((suiBalance * 0.95).toFixed(4))}
                                style={{ flex: 1 }}
                            >MAX</button>
                        </div>
                        <button
                            className="btn btn-primary"
                            onClick={handleStake}
                            disabled={isStaking || !stakeAmount}
                            style={{ width: '100%', padding: '14px' }}
                        >
                            {isStaking ? 'Staking...' : 'Stake SUI'}
                        </button>
                    </div>

                    {/* Unstake Card */}
                    <div className="page-card staking-column">
                        <h3 style={{ marginBottom: '16px', color: '#ef4444' }}>➖ Unstake SUI</h3>
                        <p style={{ opacity: 0.7, fontSize: '14px', marginBottom: '16px' }}>
                            Withdraw your SUI from the staking pool.
                        </p>
                        <div style={{ marginBottom: '16px' }}>
                            <input
                                type="number"
                                placeholder="Amount in SUI"
                                value={unstakeAmount}
                                onChange={(e) => setUnstakeAmount(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    fontSize: '16px',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    color: 'inherit'
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                            <button
                                className="btn btn-ghost"
                                onClick={() => setUnstakeAmount("0.1")}
                                style={{ flex: 1 }}
                            >0.1</button>
                            <button
                                className="btn btn-ghost"
                                onClick={() => setUnstakeAmount("0.5")}
                                style={{ flex: 1 }}
                            >0.5</button>
                            <button
                                className="btn btn-ghost"
                                onClick={() => setUnstakeAmount("1")}
                                style={{ flex: 1 }}
                            >1</button>
                            <button
                                className="btn btn-ghost"
                                onClick={() => setUnstakeAmount("5")}
                                style={{ flex: 1 }}
                            >5</button>
                        </div>
                        <button
                            className="btn btn-secondary"
                            onClick={handleUnstake}
                            disabled={isUnstaking || !unstakeAmount}
                            style={{ width: '100%', padding: '14px' }}
                        >
                            {isUnstaking ? 'Unstaking...' : 'Unstake SUI'}
                        </button>
                    </div>
                </div>

                {/* Instructions */}
                <div className="page-card" style={{ marginTop: '24px' }}>
                    <h4 style={{ marginBottom: '12px' }}>💡 How it works</h4>
                    <ul style={{ opacity: 0.8, lineHeight: 1.8, paddingLeft: '20px' }}>
                        <li>Stake your SUI tokens to participate in the pool</li>
                        <li>Your staked amount is locked in the smart contract</li>
                        <li>Unstake anytime to withdraw your SUI</li>
                        <li>You can also stake via AI Agent: "Stake 1 SUI"</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

export default StakingPage;
