import "./styles.css";
import React, { useState, useEffect, useRef } from "react";
import { useEnokiFlow, useZkLogin, useAuthCallback } from "@mysten/enoki/react";
import { useCurrentAccount, useSuiClientQuery, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { WalletConnectModal } from "./components/WalletConnectModal";
import AgentPage from "./pages/AgentPage";
import StakingPage from "./pages/StakingPage";
import HistoryPage from "./pages/HistoryPage";

// ---- COINMARKETCAP HELPERS ----

const CMC_ENDPOINT =
    "/api/v1/cryptocurrency/listings/latest?start=1&limit=50&convert=USD";

async function fetchCoinsFromCMC() {
    try {
        const response = await fetch(CMC_ENDPOINT, {
            headers: {
                "X-CMC_PRO_API_KEY": import.meta.env.VITE_CMC_API_KEY,
            },
        });

        if (!response.ok) {
            console.error("CMC API ERROR:", response.status, await response.text());
            return [];
        }

        const data = await response.json();
        return data.data.map(mapCMCToCoin);

    } catch (err) {
        console.error("CMC FETCH ERROR:", err);
        return [];
    }
}

function mapCMCToCoin(coin) {
    const quote = coin.quote?.USD || {};
    return {
        id: coin.id,
        name: coin.name,
        symbol: coin.symbol,
        logo: `https://s2.coinmarketcap.com/static/img/coins/64x64/${coin.id}.png`,
        price: quote.price || 0,
        change24h: quote.percent_change_24h || 0,
        change7d: quote.percent_change_7d || 0,
        marketCap: formatBigNumber(quote.market_cap),
        volume24h: formatBigNumber(quote.volume_24h),
        dominance: (quote.market_cap_dominance || 0).toFixed(1) + "%",
        circulatingSupply:
            formatBigNumber(coin.circulating_supply) + " " + coin.symbol,
        sparkline: generateFakeSparkline(quote.percent_change_24h || 0),
        holdings: null,
    };
}


function formatBigNumber(n) {
    if (!n && n !== 0) return "—";
    if (n >= 1e12) return (n / 1e12).toFixed(2) + "T";
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(2) + "K";
    return n.toFixed(2);
}

function generateFakeSparkline(change24h = 0) {
    // “değişim”e göre 8 noktadan oluşan ufak bir eğri
    const base = 50;
    const steps = 8;
    const slope = change24h / steps;
    const arr = [];

    for (let i = 0; i < steps; i++) {
        const v = base + slope * i;
        arr.push(Math.max(10, Math.min(90, v)));
    }

    return arr;
}

function generateFakeHistoryData(range, basePrice) {
    // Range'e göre farklı veri noktası sayısı ve oynaklık simüle et
    let steps = 20;
    let volatility = 0.05; // %5

    switch (range) {
        case "1D": steps = 24; volatility = 0.02; break;
        case "1W": steps = 7; volatility = 0.05; break;
        case "1M": steps = 30; volatility = 0.10; break;
        case "1Y": steps = 12; volatility = 0.20; break;
        case "ALL": steps = 50; volatility = 0.50; break;
    }

    const arr = [];
    let current = basePrice;

    for (let i = 0; i < steps; i++) {
        // Rastgele artış/azalış (-0.5 ile 0.5 arası * volatility)
        const change = (Math.random() - 0.5) * volatility;
        current = current * (1 + change);
        arr.push(current);
    }
    return arr;
}



// ---- PAGES ----
const PAGES = {
    HOME: "home",
    AGENT: "agent",
    COINS: "coins",
    STAKING: "staking",
    HISTORY: "history",
    WALLET: "wallet",
};

// ... FALLBACK COINS will be rendered below this (was lines 110-374) ...

// ---- MOCK DATA (FALLBACK) ----
const FALLBACK_COINS = [
    {
        name: "Bitcoin",
        symbol: "BTC",
        logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/1.png",
        price: 89620.6,
        change24h: -1.88,
        change7d: -1.16,
        marketCap: "1.79T",
        volume24h: "59.10B",
        dominance: "47.9%",
        circulatingSupply: "19.7M BTC",
        sparkline: [40, 55, 50, 70, 65, 80, 75, 90],
        holdings: 0.23,
    },
    {
        name: "Ethereum",
        symbol: "ETH",
        logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png",
        price: 3037.15,
        change24h: -2.83,
        change7d: 1.33,
        marketCap: "366.4B",
        volume24h: "22.87B",
        dominance: "20.0%",
        circulatingSupply: "120.1M ETH",
        sparkline: [38, 42, 45, 50, 53, 57, 60, 64],
        holdings: 1.8,
    },
    {
        name: "Tether USDT",
        symbol: "USDT",
        logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/825.png",
        price: 1.0,
        change24h: 0.02,
        change7d: -0.02,
        marketCap: "185.7B",
        volume24h: "86.07B",
        dominance: "7.2%",
        circulatingSupply: "185.6B USDT",
        sparkline: [48, 49, 50, 49, 50, 49, 50, 49],
        holdings: 3000,
    },
    {
        name: "Sui",
        symbol: "SUI",
        logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/20947.png",
        price: 1.52,
        change24h: 3.21,
        change7d: 6.8,
        marketCap: "3.2B",
        volume24h: "480M",
        dominance: "0.1%",
        circulatingSupply: "2.1B SUI",
        sparkline: [30, 32, 34, 40, 45, 43, 48, 52],
        holdings: 248.73,
    },
    {
        name: "Solana",
        symbol: "SOL",
        logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/5426.png",
        price: 182.45,
        change24h: 4.12,
        change7d: 9.34,
        marketCap: "85.3B",
        volume24h: "6.2B",
        dominance: "3.9%",
        circulatingSupply: "443M SOL",
        sparkline: [30, 35, 45, 60, 58, 62, 70, 68],
        holdings: 12.4,
    },
    {
        name: "BNB",
        symbol: "BNB",
        logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/1839.png",
        price: 612.31,
        change24h: -0.85,
        change7d: 2.41,
        marketCap: "94.6B",
        volume24h: "1.9B",
        dominance: "4.1%",
        circulatingSupply: "155M BNB",
        sparkline: [50, 52, 51, 55, 57, 60, 58, 62],
        holdings: 3.1,
    },
    {
        name: "Avalanche",
        symbol: "AVAX",
        logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/5805.png",
        price: 42.17,
        change24h: 1.73,
        change7d: 5.66,
        marketCap: "16.2B",
        volume24h: "820M",
        dominance: "0.7%",
        circulatingSupply: "385M AVAX",
        sparkline: [25, 28, 27, 30, 34, 33, 36, 38],
        holdings: 45.7,
    },
    {
        name: "XRP",
        symbol: "XRP",
        logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/52.png",
        price: 0.72,
        change24h: -0.94,
        change7d: 0.53,
        marketCap: "39.8B",
        volume24h: "2.3B",
        dominance: "1.7%",
        circulatingSupply: "55.4B XRP",
        sparkline: [35, 34, 36, 38, 37, 39, 40, 41],
        holdings: 920,
    },
    {
        name: "Dogecoin",
        symbol: "DOGE",
        logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/74.png",
        price: 0.18,
        change24h: 6.32,
        change7d: 11.9,
        marketCap: "26.5B",
        volume24h: "1.6B",
        dominance: "1.1%",
        circulatingSupply: "144B DOGE",
        sparkline: [20, 21, 23, 25, 28, 30, 32, 34],
        holdings: 5200,
    },
    {
        name: "Cardano",
        symbol: "ADA",
        logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/2010.png",
        price: 0.62,
        change24h: -1.2,
        change7d: 3.7,
        marketCap: "21.3B",
        volume24h: "740M",
        dominance: "0.9%",
        circulatingSupply: "34.3B ADA",
        sparkline: [28, 29, 31, 33, 32, 35, 37, 36],
        holdings: 1600,
    },
    {
        name: "Polkadot",
        symbol: "DOT",
        logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/6636.png",
        price: 7.84,
        change24h: 0.45,
        change7d: 2.19,
        marketCap: "10.2B",
        volume24h: "410M",
        dominance: "0.4%",
        circulatingSupply: "1.3B DOT",
        sparkline: [26, 27, 27, 29, 30, 31, 32, 33],
        holdings: 210,
    },
    {
        name: "Chainlink",
        symbol: "LINK",
        price: 18.93,
        change24h: 2.75,
        change7d: 7.14,
        marketCap: "11.1B",
        volume24h: "680M",
        dominance: "0.5%",
        circulatingSupply: "587M LINK",
        sparkline: [24, 26, 28, 31, 33, 36, 35, 38],
        holdings: 84,
    },
    {
        name: "Uniswap",
        symbol: "UNI",
        price: 9.42,
        change24h: -0.33,
        change7d: 4.02,
        marketCap: "5.5B",
        volume24h: "290M",
        dominance: "0.2%",
        circulatingSupply: "587M UNI",
        sparkline: [22, 23, 24, 26, 27, 29, 28, 30],
        holdings: 120,
    },
    {
        name: "Litecoin",
        symbol: "LTC",
        price: 86.53,
        change24h: 1.12,
        change7d: 3.59,
        marketCap: "6.4B",
        volume24h: "320M",
        dominance: "0.3%",
        circulatingSupply: "74.8M LTC",
        sparkline: [27, 28, 30, 32, 34, 35, 36, 37],
        holdings: 9.6,
    },
    {
        name: "Pepe",
        symbol: "PEPE",
        price: 0.000012,
        change24h: 8.31,
        change7d: 19.4,
        marketCap: "4.1B",
        volume24h: "1.1B",
        dominance: "0.17%",
        circulatingSupply: "420T PEPE",
        sparkline: [18, 19, 21, 24, 26, 29, 31, 33],
        holdings: 12000000,
    },
    {
        name: "Toncoin",
        symbol: "TON",
        price: 6.12,
        change24h: 3.02,
        change7d: 5.88,
        marketCap: "21.7B",
        volume24h: "560M",
        dominance: "0.9%",
        circulatingSupply: "3.5B TON",
        sparkline: [29, 31, 33, 36, 38, 40, 41, 43],
        holdings: 57.4,
    },
];

const INITIAL_NFTS = [
    {
        id: 1,
        name: "Sui Voyager #001",
        description: "Genesis explorer of the Sui network.",
        prompt: "retro neon space voyager",
        imageUrl: "https://placehold.co/400x400/0f172a/9ca3af?text=Voyager+001",
        staked: true,
        apy: 18,
    },
    {
        id: 2,
        name: "Flow Orb #023",
        description: "Dynamic orb reacting to on-chain activity.",
        prompt: "minimal glowing orb",
        imageUrl: "https://placehold.co/400x400/020617/60a5fa?text=Orb+023",
        staked: false,
        apy: 14,
    },
];

const MOCK_HISTORY = [
    {
        id: "tx_01",
        type: "SWAP",
        asset: "SUI → USDC",
        amount: "100 SUI",
        status: "Success",
        time: "2025-12-05 21:14",
        viaAgent: true,
        promptSummary: "Swap 100 SUI to USDC at best price.",
    },
    {
        id: "tx_02",
        type: "MINT_NFT",
        asset: "Sui Voyager #001",
        amount: "1 NFT",
        status: "Success",
        time: "2025-12-04 18:03",
        viaAgent: true,
        promptSummary: "Create a neon space pilot NFT.",
    },
    {
        id: "tx_03",
        type: "STAKE",
        asset: "Sui Voyager #001",
        amount: "1 NFT",
        status: "Pending",
        time: "2025-12-03 11:52",
        viaAgent: false,
        promptSummary: "Stake NFT for yield.",
    },
];

// ---- APP ROOT ----

function App() {
    const [activePage, setActivePage] = useState(PAGES.HOME);
    const [theme, setTheme] = useState("dark");
    const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

    // Dapp Kit Hooks
    const currentAccount = useCurrentAccount();
    const { mutate: signAndExecute } = useSignAndExecuteTransaction();

    // Fetch SUI Balance
    const { data: balanceData } = useSuiClientQuery("getBalance", {
        owner: currentAccount?.address,
    }, {
        enabled: !!currentAccount,
        refetchInterval: 10000,
    });

    // Merge Dapp Kit account with local wallet state for compatibility
    const [wallet, setWallet] = useState({
        connected: false,
        address: "",
        suiBalance: 0,
    });

    useEffect(() => {
        if (currentAccount) {
            const mist = balanceData ? Number(balanceData.totalBalance) : 0;
            setWallet(prev => ({
                ...prev,
                connected: true,
                address: currentAccount.address,
                suiBalance: mist / 1e9,
            }));
        } else {
            setWallet(prev => ({
                ...prev,
                connected: false,
                address: "",
                suiBalance: 0,
            }));
        }
    }, [currentAccount, balanceData]);

    const [coins, setCoins] = useState([]);
    const [coinsLoading, setCoinsLoading] = useState(false);
    const [coinsError, setCoinsError] = useState(null);

    const [nfts, setNfts] = useState(INITIAL_NFTS);
    const [history] = useState(MOCK_HISTORY);

    // Enoki Hooks
    const enokiFlow = useEnokiFlow();
    const { address: enokiAddress } = useZkLogin();
    const { handled } = useAuthCallback(); // Handle Google Redirect

    // User requested sidebar hidden if not connected
    const isWalletConnected = wallet.connected || !!enokiAddress;

    // Redirect to HOME when disconnecting
    const [wasConnected, setWasConnected] = useState(false);

    useEffect(() => {
        // If we WERE connected, and now we are NOT, trigger redirect
        if (wasConnected && !isWalletConnected) {
            setActivePage(PAGES.HOME);
        }
        // Update the tracker
        setWasConnected(isWalletConnected);
    }, [isWalletConnected]);

    // Google Login Function
    const handleGoogleLogin = async () => {
        const protocol = window.location.protocol;
        const host = window.location.host;
        const redirectUrl = `${protocol}//${host}/`; // Redirect back to root

        console.log("Initiating Google Login...");
        console.log("Redirect URL:", redirectUrl);
        console.log("Client ID:", import.meta.env.VITE_GOOGLE_CLIENT_ID);

        try {
            const url = await enokiFlow.createAuthorizationURL({
                provider: "google",
                network: "testnet",
                clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
                redirectUrl: redirectUrl,
                extraParams: {
                    scope: ["openid", "email", "profile"],
                },
            });
            console.log("Generated Auth URL:", url);
            window.location.href = url;
        } catch (error) {
            console.error("Google Login Error:", error);
        }
    };

    useEffect(() => {
        let API_KEY;

        // Vite (VITE_CMC_API_KEY)
        if (
            typeof import.meta !== "undefined" &&
            import.meta.env &&
            import.meta.env.VITE_CMC_API_KEY
        ) {
            API_KEY = import.meta.env.VITE_CMC_API_KEY;
        }
        // CRA (REACT_APP_CMC_API_KEY)
        else if (
            typeof process !== "undefined" &&
            process.env &&
            process.env.REACT_APP_CMC_API_KEY
        ) {
            API_KEY = process.env.REACT_APP_CMC_API_KEY;
        }

        if (!API_KEY) {
            console.warn(
                "CoinMarketCap API key bulunamadı, fallback COINS kullanılıyor."
            );
            setCoins(FALLBACK_COINS);
            return;
        }

        const fetchCoins = async () => {
            try {
                setCoinsLoading(true);
                setCoinsError(null);

                const res = await fetch(CMC_ENDPOINT, {
                    headers: {
                        "X-CMC_PRO_API_KEY": API_KEY,
                        Accept: "application/json",
                    },
                });

                if (!res.ok) {
                    throw new Error("HTTP error " + res.status);
                }

                const json = await res.json();
                let data = json?.data || [];
                const mapped = data.map(mapCMCToCoin);

                if (mapped.length > 0) {
                    setCoins(mapped);
                } else {
                    console.warn(
                        "API boş veya beklenmeyen format, fallback COINS kullanılıyor."
                    );
                    setCoins(FALLBACK_COINS);
                }
            } catch (err) {
                console.error("CoinMarketCap fetch error:", err);
                setCoinsError(err.message);
                setCoins(FALLBACK_COINS);
            } finally {
                setCoinsLoading(false);
            }
        };

        fetchCoins();
    }, []);

    const handleConnectWallet = () => {
        setIsWalletModalOpen(true);
    };

    const handleToggleStake = (nftId) => {
        setNfts((prev) =>
            prev.map((nft) =>
                nft.id === nftId ? { ...nft, staked: !nft.staked } : nft
            )
        );
    };

    const handleToggleTheme = () => {
        setTheme((prev) => (prev === "dark" ? "light" : "dark"));
    };

    return (
        <div className={`app-root theme-${theme}`}>
            {isWalletConnected && (
                <Sidebar activePage={activePage} onChangePage={setActivePage} />
            )}

            <div className="app-main">
                <Topbar
                    wallet={wallet}
                    onConnectWallet={handleConnectWallet}
                    theme={theme}
                    onToggleTheme={handleToggleTheme}
                    onGoogleLogin={handleGoogleLogin}
                    enokiAddress={enokiAddress}
                    showLogo={!isWalletConnected}
                />

                {coinsError && (
                    <div
                        className="page-card"
                        style={{ marginBottom: 8, borderColor: "#f97373" }}
                    >
                        <strong>CMC API hatası:</strong> {coinsError} — şu anda mock coin
                        verisi gösteriliyor.
                    </div>
                )}

                <div className="app-content">
                    {activePage === PAGES.HOME && <HomePage onChangePage={setActivePage} />}
                    {activePage === PAGES.AGENT && <AgentPage coins={coins} userAddress={wallet.address} />}
                    {activePage === PAGES.COINS && <CoinsPage coins={coins} />}
                    {activePage === PAGES.STAKING && (
                        <StakingPage
                            walletAddress={wallet.address || enokiAddress || ""}
                            suiBalance={wallet.suiBalance}
                            signAndExecute={signAndExecute}
                            isConnected={wallet.connected || !!enokiAddress}
                        />
                    )}
                    {activePage === PAGES.HISTORY && <HistoryPage walletAddress={wallet.address || enokiAddress || ""} />}
                    {activePage === PAGES.WALLET && (
                        <WalletPage wallet={wallet} coins={coins} />
                    )}
                </div>
            </div>

            <WalletConnectModal
                isOpen={isWalletModalOpen}
                onClose={() => setIsWalletModalOpen(false)}
            />
        </div>
    );
}

// ---- LAYOUT COMPONENTS ----

function Sidebar({ activePage, onChangePage }) {
    const items = [
        { key: PAGES.AGENT, label: "AI Agent" },
        { key: PAGES.COINS, label: "Coins" },
        { key: PAGES.STAKING, label: "Staking" },
        { key: PAGES.HISTORY, label: "History" },
        { key: PAGES.WALLET, label: "Wallet" },
    ];

    return (
        <aside className="sidebar">
            <div
                className="sidebar-logo"
                onClick={() => onChangePage(PAGES.HOME)}
                style={{ cursor: "pointer" }}
            >
                <img src="/logo.png" alt="Bilinciler Logo" className="sidebar-logo-img" />
                <div className="sidebar-logo-text">
                    <span>Jellyfish
                    </span>
                </div>
            </div>

            <nav className="sidebar-nav">
                {items.map((item) => (
                    <button
                        key={item.key}
                        className={
                            "sidebar-nav-item" +
                            (activePage === item.key ? " sidebar-nav-item--active" : "")
                        }
                        onClick={() => onChangePage(item.key)}
                    >
                        <span>{item.label}</span>
                    </button>
                ))}
            </nav>

            <div className="sidebar-footer">
                <span className="sidebar-badge">Sui • Dev / Test</span>
            </div>
        </aside>
    );
}

function Topbar({ wallet, onConnectWallet, theme, onToggleTheme, onGoogleLogin, enokiAddress, showLogo }) {
    return (
        <header className={`topbar ${showLogo ? "topbar--centered" : ""}`}>
            <div className="topbar-left" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {showLogo && (
                    <img
                        src="/logo.png"
                        alt="Logo"
                        className="topbar-logo-img"
                    />
                )}
                <div>
                    <h1 className="topbar-title">Jellyfish</h1>
                    <p className="topbar-subtitle">

                    </p>
                </div>
            </div>
            <div className="topbar-right">
                {/* If connected (Sui or Enoki), show address FIRST */}
                {wallet.connected && (
                    <div className="wallet-info" style={{ marginRight: '16px' }}>
                        <span className="wallet-address">
                            {wallet.address.slice(0, 4)}...{wallet.address.slice(-4)}
                        </span>
                        <span className="wallet-balance">
                            {wallet.suiBalance.toFixed(2)} SUI
                        </span>
                    </div>
                )}
                {enokiAddress && !wallet.connected && (
                    <div className="wallet-info" style={{ marginRight: '16px' }}>
                        <span className="wallet-balance" style={{ fontSize: '10px', color: '#999' }}>zkLogin</span>
                        <span className="wallet-address" title={enokiAddress}>
                            {enokiAddress.slice(0, 4)}...{enokiAddress.slice(-4)}
                        </span>
                    </div>
                )}

                <button className="btn btn-ghost theme-toggle" onClick={onToggleTheme}>
                    {theme === "dark" ? "Light mode" : "Dark mode"}
                </button>

                <div className="topbar-wallet">
                    {!enokiAddress && !wallet.connected && (
                        <button
                            onClick={onGoogleLogin}
                            className="btn btn-secondary"
                            style={{
                                marginRight: '10px',
                                fontSize: '18px',
                                padding: '14px 20px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.8-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z" />
                            </svg>
                            Sign in with Google
                        </button>
                    )}

                    {wallet.connected ? (
                        <button className="btn btn-ghost" onClick={onConnectWallet}>
                            Disconnect
                        </button>
                    ) : (
                        <>
                            {/* Connect button only if not logged in via Enoki either? Or allow both? Assuming allow both for now */}
                            {!enokiAddress && (
                                <button className="btn btn-primary" onClick={onConnectWallet}>
                                    Connect Wallet
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}

// ---- PAGE: HOME (LANDING) ----
function HomePage({ onChangePage }) {
    return (
        <div className="page home-page">
            <div className="home-hero">
                <div className="home-hero-text">
                    <h1 className="home-title">
                        Stake your SUI,<br />
                        earn rewards, &<br />
                        secure the Network
                    </h1>
                    <p className="home-subtitle">
                        Bilinciler is the leading AI-powered liquid staking and transaction
                        protocol for the Sui ecosystem.
                    </p>
                    <div className="home-cta-group">
                        <button
                            className="btn btn-primary btn-lg"
                            onClick={() => onChangePage(PAGES.COINS)}
                        >
                            Liquid Staking
                        </button>
                        <button
                            className="btn btn-secondary btn-lg"
                            onClick={() => onChangePage(PAGES.AGENT)}
                        >
                            Talk to Agent
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}

// ---- PAGE: AI AGENT ----
// ---- PAGE: AI AGENT (Moved to src/pages/AgentPage.jsx) ----

// ---- COIN LIST + MINI CHART ----

// ---- CHART HELPERS ----

function getChartColor(change) {
    // Pozitif veya 0 ise yeşil, negatif ise kırmızı
    return change >= 0 ? "#10b981" : "#ef4444";
}

function normalizeDataToPoints(data, width, height) {
    if (!data || data.length === 0) return "";

    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1; // 0'a bölünmeyi önle

    const stepX = width / (data.length - 1);

    const points = data.map((val, i) => {
        const x = i * stepX;
        // Y ekseni ters (üst 0), bu yüzden (1 - normalized) yapıyoruz
        // Kenarlardan biraz boşluk bırakmak (padding) iyi olabilir ama basitlik için tam boyut kullanıyoruz
        const normalizedY = (val - min) / range;
        const y = height - normalizedY * height;
        return { x, y, val };
    });

    return points;
}

// ---- COIN LIST + MINI CHART ----

// ---- COIN LIST + MINI CHART (Removed, used from components) ----

// ---- COIN DETAIL CHART ----

function CoinDetailChart({ coin }) {
    const [activeRange, setActiveRange] = useState("1M");
    const [chartData, setChartData] = useState(coin.sparkline || []);

    // Aralık değiştiğinde veya coin değiştiğinde veriyi güncelle
    useEffect(() => {
        if (activeRange === "1D") {
            // 1D için orijinal veriyi veya mock veriyi kullan
            setChartData(coin.sparkline || generateFakeSparkline(coin.change24h));
        } else {
            // Diğer aralıklar için rastgele veri üret
            setChartData(generateFakeHistoryData(activeRange, coin.price));
        }
    }, [activeRange, coin]);

    // Son verilere göre değişim (mock)
    const firstVal = chartData[0] || 0;
    const lastVal = chartData[chartData.length - 1] || 0;
    // Eğer 1D ise api'den gelen change24h'yi kullan, değilse hesapla
    const change = activeRange === "1D" ? coin.change24h : ((lastVal - firstVal) / firstVal) * 100;
    const color = getChartColor(change);

    // SVG boyutları
    const width = 600;
    const height = 200;

    const points = normalizeDataToPoints(chartData, width, height);
    const polylinePoints = points.map(p => `${p.x},${p.y}`).join(" ");

    const ranges = ["1D", "1W", "1M", "1Y", "ALL"];

    return (
        <div className="coin-chart">
            <div className="coin-chart-header">
                <h3>
                    {coin.name} <span className="coin-symbol">({coin.symbol})</span>
                </h3>
                <div className="coin-chart-price-line">
                    <div className="coin-chart-price">
                        ${coin.price.toLocaleString()}
                    </div>
                    <div className="coin-change" style={{ color }}>
                        {change >= 0 ? "+" : ""}
                        {change.toFixed(2)}%
                        <span style={{ fontSize: "0.8em", opacity: 0.7, marginLeft: 4 }}>
                            ({activeRange})
                        </span>
                    </div>
                </div>
                <p className="coin-chart-caption">
                    Live sparkline visualization
                </p>
            </div>

            <div className="coin-chart-body" style={{ height: "auto", minHeight: "220px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "100%", overflow: "visible" }}>
                    <polyline
                        points={polylinePoints}
                        fill="none"
                        stroke={color}
                        strokeWidth="3"
                    />
                    {points.map((p, i) => (
                        <circle
                            key={i}
                            cx={p.x}
                            cy={p.y}
                            r="4"
                            fill="#1e293b"
                            stroke={color}
                            strokeWidth="2"
                        />
                    ))}
                </svg>
            </div>

            <div className="coin-chart-stats">
                <div className="coin-chart-stat">
                    <span>Market cap</span>
                    <strong>{coin.marketCap}</strong>
                </div>
                <div className="coin-chart-stat">
                    <span>24h volume</span>
                    <strong>{coin.volume24h}</strong>
                </div>
                <div className="coin-chart-stat">
                    <span>Dominance</span>
                    <strong>{coin.dominance}</strong>
                </div>
                <div className="coin-chart-stat">
                    <span>Circulating supply</span>
                    <strong>{coin.circulatingSupply}</strong>
                </div>
            </div>

            <div className="coin-chart-footer">
                {ranges.map(r => (
                    <button
                        key={r}
                        className={`btn btn-sm ${activeRange === r ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setActiveRange(r)}
                        style={{ minWidth: 40 }}
                    >
                        {r}
                    </button>
                ))}
            </div>
        </div>
    );
}

// ---- PAGE: COINS ----

function CoinsPage({ coins }) {
    const [selectedCoin, setSelectedCoin] = useState(coins[0] || null);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        if (coins.length && !selectedCoin) {
            setSelectedCoin(coins[0]);
        }
    }, [coins, selectedCoin]);

    const filteredCoins = coins.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="page">
            <div className="page-header">
                <h2 className="page-title--xl">Coins</h2>
                <p>
                    Market overview. Select a coin on the left to see its chart on the
                    right.
                </p>
            </div>

            <div className="coins-page">
                <div className="page-card coins-table-card">
                    <div className="coins-table-header">
                        <div>
                            <h3>All markets</h3>
                            <p>Static demo data — later you will plug your API here.</p>
                        </div>
                        <div className="coins-table-controls">
                            <input
                                type="text"
                                placeholder="Search coin..."
                                className="coins-search"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="coins-table-scroll">
                        <table className="table coins-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Asset</th>
                                    <th>Price</th>
                                    <th>24h</th>
                                    <th>7d</th>

                                </tr>
                            </thead>
                            <tbody>
                                {filteredCoins.map((coin, index) => {
                                    const isActive =
                                        selectedCoin && selectedCoin.symbol === coin.symbol;

                                    return (
                                        <tr
                                            key={coin.symbol}
                                            className={
                                                isActive ? "coins-row coins-row--active" : "coins-row"
                                            }
                                            onClick={() => setSelectedCoin(coin)}
                                        >
                                            <td>{index + 1}</td>
                                            <td>
                                                <div className="table-asset">
                                                    {coin.logo ? (
                                                        <img
                                                            src={coin.logo}
                                                            alt={coin.name}
                                                            className="coin-logo-img"
                                                            onError={(e) => {
                                                                e.target.style.display = "none";
                                                                e.target.nextSibling.style.display = "flex";
                                                            }}
                                                        />
                                                    ) : null}
                                                    <div
                                                        className="coin-avatar small"
                                                        style={{ display: coin.logo ? "none" : "flex" }}
                                                    >
                                                        {coin.symbol[0]}
                                                    </div>
                                                    <div className="coin-name">
                                                        {coin.name}{" "}
                                                        <span className="coin-symbol">· {coin.symbol}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>${coin.price.toLocaleString()}</td>
                                            <td>
                                                <span
                                                    className={
                                                        "coin-change " +
                                                        (coin.change24h >= 0
                                                            ? "coin-change--up"
                                                            : "coin-change--down")
                                                    }
                                                >
                                                    {coin.change24h >= 0 ? "+" : ""}
                                                    {coin.change24h.toFixed(2)}%
                                                </span>
                                            </td>
                                            <td>
                                                <span
                                                    className={
                                                        "coin-change " +
                                                        (coin.change7d >= 0
                                                            ? "coin-change--up"
                                                            : "coin-change--down")
                                                    }
                                                >
                                                    {coin.change7d >= 0 ? "+" : ""}
                                                    {coin.change7d.toFixed(2)}%
                                                </span>
                                            </td>

                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="page-card coins-chart-card">
                    {selectedCoin ? (
                        <CoinDetailChart coin={selectedCoin} />
                    ) : (
                        <div className="empty-text">
                            Select a coin from the left to see its chart.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}



// ---- PAGE: HISTORY (Moved to src/pages/HistoryPage.jsx) ----


// ---- PAGE: WALLET ----

function WalletPage({ wallet, coins }) {
    const [copied, setCopied] = useState(false);

    const copyAddress = () => {
        if (wallet.address) {
            navigator.clipboard.writeText(wallet.address);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="page">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2>Wallet overview</h2>
                    <p>
                        Data here will come from Slash wallet / Sui wallet adapter. This is a
                        read-only overview for your agent.
                    </p>
                </div>
                {wallet.connected && (
                    <div className="wallet-balance-header" style={{ marginRight: '15px' }}>
                        {wallet.suiBalance.toFixed(2)} SUI
                    </div>
                )}
            </div>
            <div className="wallet-layout">
                <div className="page-card wallet-card">
                    <h3>Address</h3>
                    <div className="wallet-content-scroll">
                        {wallet.connected ? (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <p className="mono wallet-address-big" style={{ margin: 0, fontSize: '18px' }}>{wallet.address}</p>
                                    <button className="btn btn-ghost" onClick={copyAddress} style={{ padding: '8px 16px', fontSize: '14px' }}>
                                        {copied ? 'Copied!' : 'Copy'}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <p className="empty-text">
                                Wallet not connected. Use the button in the top-right.
                            </p>
                        )}
                    </div>
                </div>

                {wallet.suiBalance > 0 && (
                    <div className="page-card wallet-card">
                        <h3>Token balances</h3>
                        <div className="wallet-content-scroll">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Asset</th>
                                        <th>Balance</th>
                                        <th>Value (approx)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>
                                            <div className="table-asset">
                                                <img
                                                    src="https://s2.coinmarketcap.com/static/img/coins/64x64/20947.png"
                                                    alt="SUI"
                                                    className="coin-logo-img"
                                                />
                                                <span>Sui (SUI)</span>
                                            </div>
                                        </td>
                                        <td>{wallet.suiBalance.toFixed(4)} SUI</td>
                                        <td>~${(wallet.suiBalance * 1.5).toFixed(2)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>

    );
}



// ---- PAGE: HISTORY ----



// ---- PAGE: WALLET ----



// ---- PAGE: STAKING ----



export default App;
